// RESULTCURVE1 first unit: reduction of real linear-elastic results into a revisioned increment table.
// This module never solves, scales, interpolates or substitutes physics. Every row is the reduction of one
// independent solve result handed in by the caller. A set of independent solves is explicitly NOT a plastic
// load/unload history, and the maximum von Mises stress / maximum displacement are never used as gauge data.
import {getProjectRevision,getPhysicalRevision} from './project-revision.js';

export const INCREMENT_CURVE_SCHEMA_VERSION=1;
export const AXIS_UNIT_TOLERANCE=1e-9;
export const GAUGE_WEIGHT_TOLERANCE=1e-9;
// Acceptance criteria of the work order: axial reaction must balance the applied load, and a force-controlled
// step must match the applied axial load, both to this absolute error in N.
export const FORCE_BALANCE_TOLERANCE_N=1e-5;
export const CONTROLLED_FORCE_TOLERANCE_N=1e-5;
// Matches the existing constraint conflict tolerance of 1e-11 m, expressed in mm.
export const CONTROLLED_DISPLACEMENT_TOLERANCE_MM=1e-8;
// Initial gauge length and axis are checked against the actual mesh node coordinates in mm.
export const GAUGE_GEOMETRY_TOLERANCE_MM=1e-6;
// The controlled quantity is recorded, not solved here: extraction reads reactions and displacement identically.
// Prescribed-displacement rows additionally verify their explicit boundary and every constrained end-node value.
export const CONTROLLED_QUANTITIES=Object.freeze({force:'N',displacement:'mm'});

const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
// Negative zero would not survive a JSON roundtrip, so every emitted number is normalised.
const normalise=value=>value===0?0:value;
const sum3=(vector,axis)=>vector[0]*axis[0]+vector[1]*axis[1]+vector[2]*axis[2];

function requireUnitAxis(axis){
  if(!Array.isArray(axis)||axis.length!==3||!axis.every(finite))throw Error('axis must have three finite components');
  if(Math.abs(Math.hypot(...axis)-1)>AXIS_UNIT_TOLERANCE)throw Error('axis must be a unit vector');
  return axis.slice();
}
function requirePositive(value,label){
  if(!finite(value)||value<=0)throw Error(label+' must be a positive finite number');
  return value;
}
function requireNodeList(nodes,label,nodeCount){
  if(!Array.isArray(nodes)||!nodes.length||!nodes.every(node=>Number.isInteger(node)&&node>=0&&node<nodeCount))throw Error(label+' must list in-range node ids');
  if(new Set(nodes).size!==nodes.length)throw Error(label+' lists a duplicated node');
  return nodes.slice();
}
// Gauge points are weighted node sets: multiple nodes stay explicit and a maximum displacement is never substituted.
function requireWeightedNodeSet(side,label,nodeCount){
  if(!plain(side)||!Array.isArray(side.nodes)||!side.nodes.length||!Array.isArray(side.weights)||side.weights.length!==side.nodes.length)throw Error(label+' requires one weight per listed node');
  const seen=new Set();
  let weightSum=0;
  for(let i=0;i<side.nodes.length;i++){
    const node=side.nodes[i],weight=side.weights[i];
    if(!Number.isInteger(node)||node<0||node>=nodeCount)throw Error(label+' node id out of range: '+String(node));
    if(seen.has(node))throw Error(label+' lists a duplicated node: '+String(node));
    seen.add(node);
    if(!finite(weight)||weight<=0)throw Error(label+' weights must be positive finite numbers');
    weightSum+=weight;
  }
  if(Math.abs(weightSum-1)>GAUGE_WEIGHT_TOLERANCE)throw Error(label+' weights must sum to 1');
  return {nodes:side.nodes.slice(),weights:side.weights.slice()};
}
function weightedCentroid(mesh,side){
  const point=[0,0,0];
  for(let i=0;i<side.nodes.length;i++){
    const base=side.nodes[i]*3,weight=side.weights[i];
    for(let k=0;k<3;k++)point[k]+=weight*mesh.nodes[base+k];
  }
  return point;
}
// Labels alone must not stand in for the geometry: the declared initial gauge length is measured by projecting
// the weighted gauge-point separation on the declared axis, so a gauge on another face, a shorter gauge or a
// reversed axis fails here. The mesh content hash separately rejects a reordered mesh.
function requireGaugeGeometry(mesh,gauge,axis,lengthMm){
  const a=weightedCentroid(mesh,gauge.a),b=weightedCentroid(mesh,gauge.b);
  const delta=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],axial=sum3(delta,axis);
  if(Math.abs(axial-lengthMm)>GAUGE_GEOMETRY_TOLERANCE_MM)throw Error('Gauge initial length along the axis does not match initialGaugeLengthMm on the mesh');
}

/** Validate and normalise the immutable increment-curve input. Throws on any unsupported or ambiguous input. */
export function validateIncrementSpec(spec){
  if(!plain(spec))throw Error('Increment curve spec must be a plain object');
  if(spec.schemaVersion!==INCREMENT_CURVE_SCHEMA_VERSION)throw Error('Unsupported increment curve schema version');
  if(typeof spec.curveId!=='string'||!spec.curveId.trim()||spec.curveId.length>100)throw Error('curveId must be a non-empty string of at most 100 characters');
  if(!plain(spec.caseIdentity)||!Object.keys(spec.caseIdentity).length)throw Error('caseIdentity is required');
  if(!plain(spec.rowIdentity)||!['materialKey','geometryKey','gaugeKey'].every(key=>typeof spec.rowIdentity[key]==='string'&&spec.rowIdentity[key].trim()))throw Error('rowIdentity must declare materialKey, geometryKey and gaugeKey');
  if(!plain(spec.input))throw Error('spec.input is required to derive the input revision');
  if(!Number.isInteger(spec.nodeCount)||spec.nodeCount<1)throw Error('nodeCount must be a positive integer');
  if(!plain(spec.mesh)||!Array.isArray(spec.mesh.nodes)||spec.mesh.nodes.length!==spec.nodeCount*3||!spec.mesh.nodes.every(finite))throw Error('spec.mesh must provide three finite coordinates per declared node');
  const axis=requireUnitAxis(spec.axis),nodeCount=spec.nodeCount;
  const initialGaugeLengthMm=requirePositive(spec.initialGaugeLengthMm,'initialGaugeLengthMm');
  const initialAreaMm2=requirePositive(spec.initialAreaMm2,'initialAreaMm2');
  const fixedNodes=requireNodeList(spec.fixedNodes,'fixedNodes',nodeCount);
  const loadedNodes=requireNodeList(spec.loadedNodes,'loadedNodes',nodeCount);
  const fixed=new Set(fixedNodes);
  for(const node of loadedNodes)if(fixed.has(node))throw Error('A loaded node cannot also be a fixed node: '+String(node));
  if(!plain(spec.gauge))throw Error('gauge is required');
  const gauge={a:requireWeightedNodeSet(spec.gauge.a,'gauge.a',nodeCount),b:requireWeightedNodeSet(spec.gauge.b,'gauge.b',nodeCount)};
  const first=new Set(gauge.a.nodes);
  for(const node of gauge.b.nodes)if(first.has(node))throw Error('The two gauge points must not share a node: '+String(node));
  requireGaugeGeometry(spec.mesh,gauge,axis,initialGaugeLengthMm);
  return {axis,nodeCount,initialGaugeLengthMm,initialAreaMm2,fixedNodes,loadedNodes,gauge,rowIdentity:{materialKey:spec.rowIdentity.materialKey,geometryKey:spec.rowIdentity.geometryKey,gaugeKey:spec.rowIdentity.gaugeKey}};
}

function requireResult(result,nodeCount){
  if(!plain(result))throw Error('Step result must be a plain object');
  if(result.kind!=='elastic')throw Error('Increment extraction requires a linear elastic result');
  if(result.plasticity!==undefined||result.hyperelastic!==undefined||result.modes!==undefined)throw Error('Increment extraction rejects plasticity history, hyperelastic and modal results');
  if(!Array.isArray(result.displacement)||result.displacement.length!==nodeCount*3||!result.displacement.every(finite))throw Error('Result displacement must provide three finite components per node');
  if(!Array.isArray(result.constraintReactions))throw Error('Result must provide constraint reactions');
  if(!Array.isArray(result.applied)||result.applied.length!==3||!result.applied.every(finite))throw Error('Result must provide the applied load vector');
  const reactions=new Map();
  for(const entry of result.constraintReactions){
    if(!plain(entry)||!Number.isInteger(entry.node)||!Array.isArray(entry.force)||entry.force.length!==3||!entry.force.every(finite))throw Error('Invalid constraint reaction entry');
    if(reactions.has(entry.node))throw Error('Duplicated constraint reaction for node '+String(entry.node));
    reactions.set(entry.node,entry.force);
  }
  return reactions;
}

// Minimal provenance contract for one converged step: the actual input, mesh, calculation and result are hashed
// here. Any caller-supplied revision string is ignored, and a missing output input is a hard rejection.
function requireStepOutput(output,stepId){
  if(!plain(output))throw Error('Converged step '+stepId+' requires its output');
  if(!plain(output.input))throw Error('Step '+stepId+' output input is required to derive the input revision');
  if(!plain(output.mesh))throw Error('Step '+stepId+' output mesh is required to derive the mesh revision');
  if(!plain(output.calculation))throw Error('Step '+stepId+' output calculation is required to derive the calculation revision');
  if(!plain(output.result))throw Error('Converged step '+stepId+' requires its result');
  return output;
}
function requireCalculation(calculation,stepId,controlledQuantity,controlledValue,controlledUnit){
  if(calculation.controlledQuantity!==controlledQuantity)throw Error('Step '+stepId+' output calculation controlledQuantity does not match the step');
  if(!finite(calculation.controlledValue)||calculation.controlledValue!==controlledValue)throw Error('Step '+stepId+' output calculation controlledValue does not match the step');
  if(calculation.controlledUnit!==controlledUnit)throw Error('Step '+stepId+' output calculation controlledUnit does not match the step');
  if(calculation.plasticHistory!==false)throw Error('Step '+stepId+' output calculation must declare plasticHistory:false');
}
// Force control is accepted only when the declared value equals both the real applied axial resultant and the
// tensile axial reaction, sign included, within the explicit absolute tolerance in N.
function requireControlledForce(step,measurement){
  if(step.controlledQuantity!=='force')return;
  if(Math.abs(measurement.appliedAxisN-step.controlledValue)>CONTROLLED_FORCE_TOLERANCE_N)throw Error('Step '+step.stepId+' controlledValue does not match the applied axial force within '+CONTROLLED_FORCE_TOLERANCE_N+' N');
  if(Math.abs(measurement.tensileForceN-step.controlledValue)>CONTROLLED_FORCE_TOLERANCE_N)throw Error('Step '+step.stepId+' controlledValue does not match the axial reaction within '+CONTROLLED_FORCE_TOLERANCE_N+' N');
}

// The boundary is retained verbatim from the independent solve. A label alone is not proof of mm control.
function requireControlledDisplacement(step,output,validated){
  const boundary=output.calculation.boundary,keys=['fixed','forces','displacements'];
  if(!plain(boundary)||Object.keys(boundary).length!==keys.length||keys.some(key=>!Object.hasOwn(boundary,key)))throw Error('Displacement control requires an explicit fixed/forces/displacements solve boundary');
  const fixed=new Set(validated.fixedNodes),loaded=new Set(validated.loadedNodes);
  if(!Array.isArray(boundary.fixed)||boundary.fixed.length!==fixed.size||new Set(boundary.fixed).size!==fixed.size||!boundary.fixed.every(node=>fixed.has(node)))throw Error('Prescribed boundary fixed nodes differ from the spec');
  if(!Array.isArray(boundary.forces)||boundary.forces.length!==0)throw Error('Prescribed displacement steps require no applied nodal forces');
  if(!Array.isArray(boundary.displacements)||boundary.displacements.length!==loaded.size)throw Error('Prescribed boundary must constrain every loaded node exactly once');
  const seen=new Set();
  for(const entry of boundary.displacements){
    if(!plain(entry)||Object.keys(entry).length!==3||!['node','direction','valueMm'].every(key=>Object.hasOwn(entry,key))||!loaded.has(entry.node)||seen.has(entry.node)||!Array.isArray(entry.direction)||entry.direction.length!==3||!entry.direction.every(finite)||entry.direction.some((v,k)=>Math.abs(v-validated.axis[k])>AXIS_UNIT_TOLERANCE)||entry.valueMm!==step.controlledValue)throw Error('Prescribed boundary displacement differs from the controlled axis/value');
    seen.add(entry.node);
  }
  const reactions=requireResult(output.result,validated.nodeCount),u=output.result.displacement;
  if(!finite(output.result.residual)||output.result.residual<0||output.result.residual>=1e-8)throw Error('Displacement control requires a converged finite solver residual');
  if(reactions.size!==fixed.size+loaded.size||[...reactions.keys()].some(node=>!fixed.has(node)&&!loaded.has(node)))throw Error('Displacement control requires exactly the fixed and actuator nodal reactions');
  for(const node of fixed)if(u.slice(node*3,node*3+3).some(v=>Math.abs(v)>CONTROLLED_DISPLACEMENT_TOLERANCE_MM))throw Error('Fixed node displacement does not match its zero constraint');
  for(const node of loaded){const actual=sum3(u.slice(node*3,node*3+3),validated.axis);if(Math.abs(actual-step.controlledValue)>CONTROLLED_DISPLACEMENT_TOLERANCE_MM)throw Error('Loaded node displacement does not match the controlled value');}
}

/** Reduce one real linear-elastic result to the axial reaction, gauge extension and engineering stress/strain.
 * Sign convention: the gauge axis points from gauge point a to gauge point b, and tension is positive, so
 * tensileForceN = -(sum of support reaction projected on the axis). */
export function extractIncrementMeasurement({spec,result,controlledQuantity='force'}={}){
  if(!Object.hasOwn(CONTROLLED_QUANTITIES,controlledQuantity))throw Error('controlledQuantity must be force or displacement');
  const validated=validateIncrementSpec(spec);
  const {axis,nodeCount}=validated,reactions=requireResult(result,nodeCount),displacement=result.displacement;
  let reactionAxisN=0;
  for(const node of validated.fixedNodes){
    const force=reactions.get(node);
    if(!force)throw Error('Fixed node '+String(node)+' has no constraint reaction in the result');
    reactionAxisN+=sum3(force,axis);
  }
  const externalAppliedAxisN=sum3(result.applied,axis);
  let actuatorReactionAxisN=0;
  if(controlledQuantity==='displacement'){
    if(result.applied.some(value=>value!==0))throw Error('Prescribed displacement result must have zero external applied load');
    for(const node of validated.loadedNodes){const force=reactions.get(node);if(!force)throw Error('Loaded node '+node+' has no actuator reaction');actuatorReactionAxisN+=sum3(force,axis);}
  }
  const appliedAxisN=externalAppliedAxisN+actuatorReactionAxisN;
  const tensileForceN=-reactionAxisN;
  const forceBalanceErrorNAxialN=appliedAxisN+reactionAxisN;
  if(!finite(reactionAxisN)||!finite(tensileForceN)||!finite(forceBalanceErrorNAxialN))throw Error('Non-finite axial force');
  const axialDisplacement=side=>{let total=0;for(let i=0;i<side.nodes.length;i++){const base=side.nodes[i]*3;total+=side.weights[i]*sum3([displacement[base],displacement[base+1],displacement[base+2]],axis);}return total;};
  const extensionMm=axialDisplacement(validated.gauge.b)-axialDisplacement(validated.gauge.a);
  const engineeringStressPa=tensileForceN/(validated.initialAreaMm2*1e-6);
  const engineeringStrain=extensionMm/validated.initialGaugeLengthMm;
  if(!finite(extensionMm)||!finite(engineeringStressPa)||!finite(engineeringStrain))throw Error('Non-finite gauge extension, stress or strain');
  return Object.freeze({...(controlledQuantity==='displacement'?{actuatorReactionAxisN:normalise(actuatorReactionAxisN),externalAppliedAxisN:normalise(externalAppliedAxisN)}:{}),reactionAxisN:normalise(reactionAxisN),tensileForceN:normalise(tensileForceN),appliedAxisN:normalise(appliedAxisN),forceBalanceErrorNAxialN:normalise(forceBalanceErrorNAxialN),extensionMm:normalise(extensionMm),engineeringStressPa:normalise(engineeringStressPa),engineeringStrain:normalise(engineeringStrain)});
}

/** Area-weighted traction on the declared loaded surface. Boundary preparation for independent solves only;
 * it distributes the requested total force over the loaded triangles and never scales a computed result. */
export function loadedFaceTractionForces(mesh,{spec,totalForceN}={}){
  const validated=validateIncrementSpec(spec);
  if(!finite(totalForceN))throw Error('totalForceN must be finite');
  if(!plain(mesh)||!Array.isArray(mesh.nodes)||!Array.isArray(mesh.surface))throw Error('Mesh with nodes and surface triangles is required');
  if(mesh.nodes.length!==validated.nodeCount*3)throw Error('Mesh node count does not match the increment curve spec');
  const loaded=new Set(validated.loadedNodes),shares=new Map(),{axis}=validated;
  let faceAreaMm2=0;
  for(const face of mesh.surface){
    if(!plain(face)||!Array.isArray(face.nodes)||face.nodes.length!==3||!face.nodes.every(Number.isInteger))throw Error('Invalid surface triangle');
    if(!face.nodes.every(node=>loaded.has(node)))continue;
    const corners=face.nodes.map(node=>mesh.nodes.slice(node*3,node*3+3));
    if(!corners.every(corner=>corner.length===3&&corner.every(finite)))throw Error('Non-finite mesh coordinates');
    const u=corners[1].map((value,i)=>value-corners[0][i]),v=corners[2].map((value,i)=>value-corners[0][i]);
    const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
    if(!finite(area))throw Error('Non-finite loaded face area');
    faceAreaMm2+=area;
    for(const node of face.nodes)shares.set(node,(shares.get(node)||0)+area/3);
  }
  if(!(faceAreaMm2>0)||!finite(faceAreaMm2))throw Error('No loaded surface triangle is fully inside the declared loaded nodes');
  const tractionNPerMm2=totalForceN/faceAreaMm2;
  return [...shares.keys()].sort((a,b)=>a-b).map(node=>{const forceN=shares.get(node)*tractionNPerMm2;return {node,value:[axis[0]*forceN,axis[1]*forceN,axis[2]*forceN]};});
}

function deepFreeze(value){
  if(value&&typeof value==='object'){for(const key of Object.keys(value))deepFreeze(value[key]);Object.freeze(value);}
  return value;
}

/** Build the revisioned increment table from independent linear-elastic solve results.
 * Failed steps keep their state and null numbers; later steps are never interpolated from them. */
export async function buildIncrementCurve({spec,steps}={}){
  const validated=validateIncrementSpec(spec);
  if(!Array.isArray(steps)||!steps.length)throw Error('Increment curve requires at least one step');
  const [inputRevision,meshRevision]=await Promise.all([getProjectRevision(spec.input),getProjectRevision(spec.mesh)]),rows=[],stepIds=new Set();
  for(let index=0;index<steps.length;index++){
    const step=steps[index];
    if(!plain(step))throw Error('Each step must be a plain object');
    if(typeof step.stepId!=='string'||!step.stepId.trim()||step.stepId.length>100)throw Error('Each step requires a stepId of at most 100 characters');
    if(stepIds.has(step.stepId))throw Error('Duplicated step id: '+step.stepId);
    stepIds.add(step.stepId);
    if(typeof step.converged!=='boolean')throw Error('Each step requires a boolean converged flag');
    if(typeof step.provisional!=='boolean')throw Error('Each step requires a boolean provisional flag');
    if(!plain(step.rowIdentity)||Object.keys(validated.rowIdentity).some(key=>step.rowIdentity[key]!==validated.rowIdentity[key]))throw Error('Step '+step.stepId+' mixes a different material, geometry or gauge');
    if(!Object.hasOwn(CONTROLLED_QUANTITIES,step.controlledQuantity))throw Error('controlledQuantity must be force or displacement');
    if(!finite(step.controlledValue))throw Error('Each step requires a finite controlledValue');
    const row={stepIndex:index,stepId:step.stepId,controlledQuantity:step.controlledQuantity,controlledValue:step.controlledValue,controlledUnit:CONTROLLED_QUANTITIES[step.controlledQuantity],converged:step.converged,provisional:step.provisional};
    if(!step.converged){
      rows.push({...row,status:'failed',inputRevision:null,meshRevision:null,calculationRevision:null,resultRevision:null,reactionAxisN:null,tensileForceN:null,appliedAxisN:null,forceBalanceErrorNAxialN:null,extensionMm:null,engineeringStressPa:null,engineeringStrain:null});
      continue;
    }
    const output=requireStepOutput(step.output,step.stepId),controlledUnit=CONTROLLED_QUANTITIES[step.controlledQuantity];
    requireCalculation(output.calculation,step.stepId,step.controlledQuantity,step.controlledValue,controlledUnit);
    const stepInputRevision=await getProjectRevision(output.input);
    if(stepInputRevision!==inputRevision)throw Error('Step '+step.stepId+' output input differs from the curve input revision');
    const stepMeshRevision=await getProjectRevision(output.mesh);
    if(stepMeshRevision!==meshRevision)throw Error('Step '+step.stepId+' output mesh differs from the curve mesh revision');
    if(step.controlledQuantity==='displacement')requireControlledDisplacement(step,output,validated);
    const measurement=extractIncrementMeasurement({spec,result:output.result,controlledQuantity:step.controlledQuantity});
    if(Math.abs(measurement.forceBalanceErrorNAxialN)>FORCE_BALANCE_TOLERANCE_N)throw Error('Step '+step.stepId+' axial reaction does not balance the applied load within '+FORCE_BALANCE_TOLERANCE_N+' N');
    requireControlledForce(step,measurement);
    const resultRevision=await getPhysicalRevision({result:output.result});
    if(typeof resultRevision!=='string'||!resultRevision)throw Error('Missing result revision for step '+step.stepId);
    const calculationRevision=await getProjectRevision(output.calculation);
    rows.push({...row,status:'converged',inputRevision:stepInputRevision,meshRevision:stepMeshRevision,calculationRevision,resultRevision,...measurement});
  }
  return deepFreeze({
    schemaVersion:INCREMENT_CURVE_SCHEMA_VERSION,
    curveId:spec.curveId,
    caseIdentity:structuredClone(spec.caseIdentity),
    analysis:{kind:'independent-linear-solves',plasticHistory:false,note:'Each row is the reduction of one independent linear-elastic solve along the same axis. This is not a plastic load/unload history and no row is interpolated.'},
    inputRevision,
    meshRevision,
    tolerances:{...(steps.some(step=>step.controlledQuantity==='displacement')?{controlledDisplacementAbsoluteMm:CONTROLLED_DISPLACEMENT_TOLERANCE_MM}:{}),controlledForceAbsoluteN:CONTROLLED_FORCE_TOLERANCE_N,forceBalanceAbsoluteN:FORCE_BALANCE_TOLERANCE_N,gaugeGeometryMm:GAUGE_GEOMETRY_TOLERANCE_MM},
    axis:validated.axis,
    initialGaugeLengthMm:validated.initialGaugeLengthMm,
    initialAreaMm2:validated.initialAreaMm2,
    nodeCount:validated.nodeCount,
    fixedNodes:validated.fixedNodes,
    loadedNodes:validated.loadedNodes,
    gauge:structuredClone(validated.gauge),
    rowIdentity:structuredClone(validated.rowIdentity),
    units:{axis:'dimensionless unit vector',lengthMm:'mm',areaMm2:'mm^2',forceN:'N',engineeringStressPa:'Pa',engineeringStrain:'dimensionless',controlledForceN:'N',controlledDisplacementMm:'mm'},
    steps:rows
  });
}
