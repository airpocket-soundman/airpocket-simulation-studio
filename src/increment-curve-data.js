// RESULTCURVE1 first unit: reduction of real linear-elastic results into a revisioned increment table.
// This module never solves, scales, interpolates or substitutes physics. Every row is the reduction of one
// independent solve result handed in by the caller. A set of independent solves is explicitly NOT a plastic
// load/unload history, and the maximum von Mises stress / maximum displacement are never used as gauge data.
import {getProjectRevision,getPhysicalRevision} from './project-revision.js';

export const INCREMENT_CURVE_SCHEMA_VERSION=1;
export const AXIS_UNIT_TOLERANCE=1e-9;
export const GAUGE_WEIGHT_TOLERANCE=1e-9;
// Acceptance criterion of the work order: axial reaction must balance the applied load to this absolute error.
export const FORCE_BALANCE_TOLERANCE_N=1e-5;
// The controlled quantity is recorded, not solved here: extraction reads reactions and displacement identically.
// Only the force-controlled independent linear path is verified in this unit.
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

/** Validate and normalise the immutable increment-curve input. Throws on any unsupported or ambiguous input. */
export function validateIncrementSpec(spec){
  if(!plain(spec))throw Error('Increment curve spec must be a plain object');
  if(spec.schemaVersion!==INCREMENT_CURVE_SCHEMA_VERSION)throw Error('Unsupported increment curve schema version');
  if(typeof spec.curveId!=='string'||!spec.curveId.trim()||spec.curveId.length>100)throw Error('curveId must be a non-empty string of at most 100 characters');
  if(!plain(spec.caseIdentity)||!Object.keys(spec.caseIdentity).length)throw Error('caseIdentity is required');
  if(!plain(spec.rowIdentity)||!['materialKey','geometryKey','gaugeKey'].every(key=>typeof spec.rowIdentity[key]==='string'&&spec.rowIdentity[key].trim()))throw Error('rowIdentity must declare materialKey, geometryKey and gaugeKey');
  if(!plain(spec.input))throw Error('spec.input is required to derive the input revision');
  if(!Number.isInteger(spec.nodeCount)||spec.nodeCount<1)throw Error('nodeCount must be a positive integer');
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

/** Reduce one real linear-elastic result to the axial reaction, gauge extension and engineering stress/strain.
 * Sign convention: the gauge axis points from gauge point a to gauge point b, and tension is positive, so
 * tensileForceN = -(sum of support reaction projected on the axis). */
export function extractIncrementMeasurement({spec,result}={}){
  const validated=validateIncrementSpec(spec);
  const {axis,nodeCount}=validated,reactions=requireResult(result,nodeCount),displacement=result.displacement;
  let reactionAxisN=0;
  for(const node of validated.fixedNodes){
    const force=reactions.get(node);
    if(!force)throw Error('Fixed node '+String(node)+' has no constraint reaction in the result');
    reactionAxisN+=sum3(force,axis);
  }
  const appliedAxisN=sum3(result.applied,axis);
  const tensileForceN=-reactionAxisN;
  const forceBalanceErrorNAxialN=appliedAxisN+reactionAxisN;
  if(!finite(reactionAxisN)||!finite(tensileForceN)||!finite(forceBalanceErrorNAxialN))throw Error('Non-finite axial force');
  const axialDisplacement=side=>{let total=0;for(let i=0;i<side.nodes.length;i++){const base=side.nodes[i]*3;total+=side.weights[i]*sum3([displacement[base],displacement[base+1],displacement[base+2]],axis);}return total;};
  const extensionMm=axialDisplacement(validated.gauge.b)-axialDisplacement(validated.gauge.a);
  const engineeringStressPa=tensileForceN/(validated.initialAreaMm2*1e-6);
  const engineeringStrain=extensionMm/validated.initialGaugeLengthMm;
  if(!finite(extensionMm)||!finite(engineeringStressPa)||!finite(engineeringStrain))throw Error('Non-finite gauge extension, stress or strain');
  return Object.freeze({reactionAxisN:normalise(reactionAxisN),tensileForceN:normalise(tensileForceN),appliedAxisN:normalise(appliedAxisN),forceBalanceErrorNAxialN:normalise(forceBalanceErrorNAxialN),extensionMm:normalise(extensionMm),engineeringStressPa:normalise(engineeringStressPa),engineeringStrain:normalise(engineeringStrain)});
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
  const inputRevision=await getProjectRevision(spec.input),rows=[],stepIds=new Set();
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
      rows.push({...row,status:'failed',resultRevision:null,reactionAxisN:null,tensileForceN:null,appliedAxisN:null,forceBalanceErrorNAxialN:null,extensionMm:null,engineeringStressPa:null,engineeringStrain:null});
      continue;
    }
    if(step.result===undefined||step.result===null)throw Error('Converged step '+step.stepId+' requires its result');
    const measurement=extractIncrementMeasurement({spec,result:step.result});
    if(Math.abs(measurement.forceBalanceErrorNAxialN)>FORCE_BALANCE_TOLERANCE_N)throw Error('Step '+step.stepId+' axial reaction does not balance the applied load within '+FORCE_BALANCE_TOLERANCE_N+' N');
    const resultRevision=await getPhysicalRevision({result:step.result});
    if(typeof resultRevision!=='string'||!resultRevision)throw Error('Missing result revision for step '+step.stepId);
    rows.push({...row,status:'converged',resultRevision,...measurement});
  }
  return deepFreeze({
    schemaVersion:INCREMENT_CURVE_SCHEMA_VERSION,
    curveId:spec.curveId,
    caseIdentity:structuredClone(spec.caseIdentity),
    analysis:{kind:'independent-linear-solves',plasticHistory:false,note:'Each row is the reduction of one independent linear-elastic solve along the same axis. This is not a plastic load/unload history and no row is interpolated.'},
    inputRevision,
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
