import {lstat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import initialize from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {solveElastic} from '../src/fem-core.js';
import {loadedFaceTractionForces} from '../src/increment-curve-data.js';
import {createIncrementCurveArtifacts,INCREMENT_CURVE_EXPORT_LIMITS} from '../src/increment-curve-export.js';
import {publishJson} from './json-artifacts.mjs';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const FORCE_LIMIT_N=1e9;
const RESIDUAL_TOLERANCE=1e-8;

/** Independent force-controlled linear solves of a synthetic prismatic bar for an explicit force route.
 * Every step is re-solved on the same mesh; no result is scaled from another step. A step whose solve
 * throws or does not meet the residual tolerance is kept as converged:false and carries no numbers. */
export async function buildSyntheticBarBundle({forces,size=4,widthMm=10,heightMm=10,lengthMm=40,youngModulusPa=1e9,poissonRatio=0}={},{initializeGmsh=initialize,solve=solveElastic}={}){
  if(!Array.isArray(forces)||!forces.length||forces.length>INCREMENT_CURVE_EXPORT_LIMITS.steps||!forces.every(value=>finite(value)&&Math.abs(value)<=FORCE_LIMIT_N))throw Error('forces must be 1..'+INCREMENT_CURVE_EXPORT_LIMITS.steps+' finite values within +-1e9 N');
  if(![size,widthMm,heightMm,lengthMm,youngModulusPa].every(value=>finite(value)&&value>0)||!finite(poissonRatio)||poissonRatio<0||poissonRatio>=0.5)throw Error('Invalid bar dimensions or material');
  const bounds=[0,0,0,widthMm,heightMm,lengthMm],material={youngModulus:youngModulusPa,poissonRatio};
  const mesh=await generateMesh(initializeGmsh,{kind:'box',bounds},{size});
  const nodeCount=mesh.nodes.length/3,fixedNodes=[],loadedNodes=[];
  for(let node=0;node<nodeCount;node++){
    if(Math.abs(mesh.nodes[node*3+2])<1e-7)fixedNodes.push(node);
    if(Math.abs(mesh.nodes[node*3+2]-lengthMm)<1e-7)loadedNodes.push(node);
  }
  if(!fixedNodes.length||!loadedNodes.length)throw Error('Mesh has no fixed or loaded end-face nodes');
  const side=nodes=>({nodes,weights:nodes.map(()=>1/nodes.length)});
  const key='synthetic-E'+youngModulusPa+'-nu'+poissonRatio,geometryKey='box-'+widthMm+'x'+heightMm+'x'+lengthMm+'mm';
  const spec={schemaVersion:1,curveId:'synthetic-bar-independent-linear-solves',caseIdentity:{name:'Synthetic '+widthMm+'x'+heightMm+'x'+lengthMm+' mm bar',synthetic:true},rowIdentity:{materialKey:key,geometryKey,gaugeKey:'weighted-end-faces'},input:{synthetic:true,study:{kind:'structural'},sourceModel:{kind:'box',bounds},meshSize:size,materialProperties:material},mesh,nodeCount,axis:[0,0,1],initialGaugeLengthMm:lengthMm,initialAreaMm2:widthMm*heightMm,fixedNodes,loadedNodes,gauge:{a:side(fixedNodes),b:side(loadedNodes)}};
  const steps=forces.map((force,index)=>{
    const stepId='step-'+index+'-'+force+'N',base={stepId,controlledQuantity:'force',controlledValue:force,rowIdentity:{...spec.rowIdentity}};
    let solved;
    try{solved=solve(mesh,material,{fixed:fixedNodes,forces:loadedFaceTractionForces(mesh,{spec,totalForceN:force})});}
    catch{return {...base,converged:false,provisional:false};}
    if(!(solved.residual<RESIDUAL_TOLERANCE))return {...base,converged:false,provisional:false};
    const result={kind:solved.kind,displacement:solved.displacement,constraintReactions:solved.constraintReactions,applied:solved.applied,residual:solved.residual};
    return {...base,converged:true,provisional:false,output:{input:spec.input,mesh,calculation:{kind:'synthetic-independent-linear-elastic-solve',controlledQuantity:'force',controlledValue:force,controlledUnit:'N',plasticHistory:false},result}};
  });
  // JSON is the public interchange boundary: drop typed arrays and process-local references.
  const bundle=JSON.parse(JSON.stringify({spec,steps}));
  const artifacts=await createIncrementCurveArtifacts(bundle);
  return {bundle,artifacts};
}

/** Write the re-enterable {spec,steps} bundle without overwriting. The final name appears only after a complete write. */
export async function writeSyntheticBarBundle(options,outputPath,dependencies){
  if(typeof outputPath!=='string'||!isAbsolute(outputPath))throw Error('Output path must be absolute');
  const target=resolve(outputPath);
  try{await lstat(target);throw Error('Output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  const {bundle,artifacts}=await buildSyntheticBarBundle(options,dependencies);
  const saved=await publishJson(target,bundle,{includeIntegrity:true});
  return {outputPath:target,...saved,steps:artifacts.curve.steps};
}
