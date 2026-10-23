// RESULTCURVE1 bounded generator: explicit force sequence -> independent Gmsh/elastic solves -> {spec,steps}.
// This never scales, copies or interpolates a solved displacement/reaction. A failed solve is retained as an
// explicit failed row without an output, and a failed generation never publishes a destination file.
import {lstat,open} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import gmshInitialize from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {solveElastic} from '../src/fem-core.js';
import {loadedFaceTractionForces} from '../src/increment-curve-data.js';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';
import {publishJson} from './json-artifacts.mjs';

export const INCREMENT_CURVE_BUNDLE_LIMITS=Object.freeze({
 requestBytes:65536,
 requestValues:100000,
 depth:24,
 loads:128,
 nodes:20000,
 elements:30000,
 boundsMm:1000000
});
const REQUEST_KEYS=Object.freeze(['synthetic','curveId','caseIdentity','rowIdentity','boundsMm','meshSizeMm','youngModulusPa','poissonRatio','axis','initialGaugeLengthMm','initialAreaMm2','loadsN']);
const POSITIVE_AXES=Object.freeze([[1,0,0],[0,1,0],[0,0,1]]);
const AXIS_TOLERANCE=1e-12;
const GEOMETRY_RELATIVE_TOLERANCE=1e-9;
const SOLVE_TOLERANCE=1e-8;
const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const positive=value=>finite(value)&&value>0;
const fail=message=>{throw Error(message);};
const absolute=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&isAbsolute(value)&&!value.includes('\0');
const near=(actual,expected)=>Math.abs(actual-expected)<=GEOMETRY_RELATIVE_TOLERANCE*Math.max(1,Math.abs(expected));

// The request is a JSON contract, not a Studio project. Reject accessors, cycles, non-JSON values and overlarge
// graphs before meshing so a hostile in-process caller cannot execute a getter or trigger an expensive solve.
function snapshotRequest(value){
 let count=0;
 const ancestors=new Set();
 const visit=(current,depth)=>{
  if(++count>INCREMENT_CURVE_BUNDLE_LIMITS.requestValues||depth>INCREMENT_CURVE_BUNDLE_LIMITS.depth)fail('Increment curve request exceeds graph/depth limit');
  if(current===null||typeof current==='boolean')return;
  if(typeof current==='number'){if(!Number.isFinite(current))fail('Increment curve request requires finite numbers');return;}
  if(typeof current==='string'){if(current.length>65536)fail('Increment curve request string exceeds limit');return;}
  if(typeof current!=='object')fail('Increment curve request must be plain JSON');
  if(!Array.isArray(current)&&!plain(current))fail('Increment curve request must be plain JSON');
  if(ancestors.has(current))fail('Increment curve request rejects cyclic JSON');
  ancestors.add(current);
  const keys=Reflect.ownKeys(current);
  if(keys.length>INCREMENT_CURVE_BUNDLE_LIMITS.requestValues)fail('Increment curve request object exceeds limit');
  for(const key of keys){
   if(Array.isArray(current)&&key==='length')continue;
   const descriptor=Object.getOwnPropertyDescriptor(current,key);
   if(typeof key!=='string'||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))fail('Increment curve request rejects accessors, symbols and hidden properties');
   if(Array.isArray(current)&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=current.length))fail('Increment curve request rejects decorated arrays');
   visit(key,depth+1);visit(descriptor.value,depth+1);
  }
  if(Array.isArray(current)&&keys.length!==current.length+1)fail('Increment curve request rejects sparse arrays');
  ancestors.delete(current);
 };
 visit(value,0);
 const text=JSON.stringify(value);
 if(Buffer.byteLength(text,'utf8')>INCREMENT_CURVE_BUNDLE_LIMITS.requestBytes)fail('Increment curve request exceeds 64 KiB');
 return JSON.parse(text);
}

function validateRequest(input){
 const request=snapshotRequest(input),keys=Reflect.ownKeys(request);
 if(keys.length!==REQUEST_KEYS.length||REQUEST_KEYS.some(key=>!Object.hasOwn(request,key)))fail('Increment curve request must contain exactly the documented fields');
 if(request.synthetic!==true)fail('This bounded generator only accepts synthetic:true reference requests');
 if(typeof request.curveId!=='string'||!request.curveId.trim()||request.curveId.length>100)fail('curveId must be a non-empty string of at most 100 characters');
 if(!plain(request.caseIdentity)||!Object.keys(request.caseIdentity).length)fail('caseIdentity must be a non-empty object');
 if(!plain(request.rowIdentity)||Reflect.ownKeys(request.rowIdentity).length!==3||!['materialKey','geometryKey','gaugeKey'].every(key=>typeof request.rowIdentity[key]==='string'&&request.rowIdentity[key].trim()&&request.rowIdentity[key].length<=100))fail('rowIdentity must contain exactly materialKey, geometryKey and gaugeKey strings');
 if(!Array.isArray(request.boundsMm)||request.boundsMm.length!==6||!request.boundsMm.every(finite)||request.boundsMm.some(value=>Math.abs(value)>INCREMENT_CURVE_BUNDLE_LIMITS.boundsMm))fail('boundsMm must contain six bounded finite coordinates');
 const bounds=request.boundsMm,extents=[bounds[3]-bounds[0],bounds[4]-bounds[1],bounds[5]-bounds[2]];
 if(extents.some(extent=>!(extent>0)))fail('boundsMm must describe a positive box');
 if(!positive(request.meshSizeMm))fail('meshSizeMm must be positive');
 const volume=extents[0]*extents[1]*extents[2];
 if(6*volume/request.meshSizeMm**3>INCREMENT_CURVE_BUNDLE_LIMITS.elements*4)fail('Requested mesh is too fine for the element limit; increase meshSizeMm');
 if(!positive(request.youngModulusPa))fail('youngModulusPa must be positive');
 if(!finite(request.poissonRatio)||request.poissonRatio<=-1||request.poissonRatio>=.49)fail('poissonRatio must be finite and between -1 and 0.49');
 if(!Array.isArray(request.axis)||request.axis.length!==3||!request.axis.every(finite))fail('axis must have three finite components');
 const axisIndex=POSITIVE_AXES.findIndex(axis=>axis.every((value,index)=>Math.abs(value-request.axis[index])<=AXIS_TOLERANCE));
 if(axisIndex<0)fail('axis must be one of the positive coordinate axes [1,0,0], [0,1,0] or [0,0,1]');
 if(!positive(request.initialGaugeLengthMm)||!near(request.initialGaugeLengthMm,extents[axisIndex]))fail('initialGaugeLengthMm must match the requested box span along the axis');
 const crossSection=extents.filter((_,index)=>index!==axisIndex).reduce((product,extent)=>product*extent,1);
 if(!positive(request.initialAreaMm2)||!near(request.initialAreaMm2,crossSection))fail('initialAreaMm2 must match the requested box cross-section');
 if(!Array.isArray(request.loadsN)||request.loadsN.length<1||request.loadsN.length>INCREMENT_CURVE_BUNDLE_LIMITS.loads||!request.loadsN.every(finite))fail('loadsN must contain 1..128 finite force values');
 return {request,axisIndex,extents};
}

function equalWeights(nodes){return nodes.map(()=>1/nodes.length);}

function makeSpec(request,mesh,axisIndex){
 const bounds=request.boundsMm.slice(),nodeCount=mesh.nodes.length/3;
 const min=bounds[axisIndex],max=bounds[axisIndex+3],span=max-min,tolerance=1e-7*Math.max(1,span);
 const fixedNodes=[],loadedNodes=[];
 for(let node=0;node<nodeCount;node++){
  const coordinate=mesh.nodes[node*3+axisIndex];
  if(Math.abs(coordinate-min)<=tolerance)fixedNodes.push(node);
  else if(Math.abs(coordinate-max)<=tolerance)loadedNodes.push(node);
 }
 if(!fixedNodes.length||!loadedNodes.length)fail('Generated mesh does not expose both end faces along the declared axis');
 return {
  schemaVersion:1,
  curveId:request.curveId,
  caseIdentity:structuredClone(request.caseIdentity),
  rowIdentity:{...request.rowIdentity},
  input:{
   synthetic:true,
   study:{kind:'structural'},
   sourceModel:{kind:'box',bounds},
   meshSize:request.meshSizeMm,
   materialProperties:{youngModulus:request.youngModulusPa,poissonRatio:request.poissonRatio}
  },
  mesh,
  nodeCount,
  axis:request.axis.slice(),
  initialGaugeLengthMm:request.initialGaugeLengthMm,
  initialAreaMm2:request.initialAreaMm2,
  fixedNodes,
  loadedNodes,
  gauge:{a:{nodes:fixedNodes.slice(),weights:equalWeights(fixedNodes)},b:{nodes:loadedNodes.slice(),weights:equalWeights(loadedNodes)}}
 };
}

/** Generate a re-inputable {spec,steps} bundle from one explicit force route using independent real solves. */
export async function createIncrementCurveBundle(input,{initialize=gmshInitialize,solve=solveElastic}={}){
 const {request,axisIndex}=validateRequest(input);
 const mesh=await generateMesh(initialize,{kind:'box',bounds:request.boundsMm.slice()},{size:request.meshSizeMm,maxElements:INCREMENT_CURVE_BUNDLE_LIMITS.elements});
 const nodeCount=mesh.nodes.length/3;
 if(nodeCount>INCREMENT_CURVE_BUNDLE_LIMITS.nodes)fail('Generated mesh exceeds the 20,000-node curve limit');
 const spec=makeSpec(request,mesh,axisIndex);
 // Boundary preparation is fatal input/mesh validation, not a converged-step failure.
 const forceSets=request.loadsN.map(force=>loadedFaceTractionForces(mesh,{spec,totalForceN:force}));
 const steps=[],failures=[];
 for(let index=0;index<request.loadsN.length;index++){
  const force=request.loadsN[index],stepId=`step-${index}-${force}N`,rowIdentity={...spec.rowIdentity};
  let solved;
  try{
   solved=solve(mesh,{youngModulus:request.youngModulusPa,poissonRatio:request.poissonRatio},{fixed:spec.fixedNodes,forces:forceSets[index]});
  }catch(error){
   failures.push({stepIndex:index,stepId,loadN:force,message:String(error?.message??error).slice(0,300)});
   steps.push({stepId,controlledQuantity:'force',controlledValue:force,converged:false,provisional:true,rowIdentity});
   continue;
  }
  if(!plain(solved)||solved.kind!=='elastic')fail('Solver returned an unsupported result for '+stepId);
  if(!finite(solved.residual)||solved.residual>=SOLVE_TOLERANCE){
   failures.push({stepIndex:index,stepId,loadN:force,message:'Solver residual did not converge: '+String(solved.residual)});
   steps.push({stepId,controlledQuantity:'force',controlledValue:force,converged:false,provisional:true,rowIdentity});
   continue;
  }
  // Exact solved vectors only. The saved subset omits tensor/visual/performance arrays, but each value here is
  // the result of this load's own solve; no vector is multiplied by a load ratio or reused from another step.
  const result={kind:solved.kind,displacement:Array.from(solved.displacement),constraintReactions:structuredClone(solved.constraintReactions),applied:Array.from(solved.applied),residual:solved.residual};
  steps.push({
   stepId,
   controlledQuantity:'force',
   controlledValue:force,
   converged:true,
   provisional:false,
   rowIdentity,
   output:{
    input:spec.input,
    mesh,
    calculation:{kind:'synthetic-independent-linear-elastic-solve',controlledQuantity:'force',controlledValue:force,controlledUnit:'N',plasticHistory:false},
    result
   }
  });
 }
 const bundle=JSON.parse(JSON.stringify({spec,steps}));
 // Reuse the canonical service before publication. A bad generated row cannot become a complete file.
 const artifacts=await createIncrementCurveArtifacts(bundle);
 return Object.freeze({bundle,curve:artifacts.curve,csv:artifacts.csv,json:artifacts.json,svg:artifacts.svg,failures});
}

async function readBoundedJson(path){
 const handle=await open(path,'r');let bytes;
 try{
  const info=await handle.stat();
  if(!info.isFile()||info.size>INCREMENT_CURVE_BUNDLE_LIMITS.requestBytes)fail('Increment curve request must be a regular file within 64 KiB');
  const buffer=Buffer.alloc(INCREMENT_CURVE_BUNDLE_LIMITS.requestBytes+1);let length=0;
  while(length<buffer.length){const read=await handle.read(buffer,length,buffer.length-length,length);if(!read.bytesRead)break;length+=read.bytesRead;}
  bytes=buffer.subarray(0,length);
 }finally{await handle.close();}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch(error){fail('Increment curve request is not valid UTF-8 JSON: '+error.message);}
}

/** Read a bounded request, generate/validate the bundle, then publish it without overwriting an existing path. */
export async function writeIncrementCurveBundle(args={},{publish=publishJson,create=createIncrementCurveBundle}={}){
 if(!plain(args)||Reflect.ownKeys(args).length!==2||!Object.hasOwn(args,'requestPath')||!Object.hasOwn(args,'outputPath')||Reflect.ownKeys(args).some(key=>!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value')))fail('Bundle writer requires exactly requestPath and outputPath data properties');
 if(!absolute(args.requestPath)||!absolute(args.outputPath))fail('Use absolute increment curve request and output paths');
 const requestPath=resolve(args.requestPath),outputPath=resolve(args.outputPath);
 if(requestPath.toLowerCase()===outputPath.toLowerCase())fail('Increment curve output must be distinct from the request');
 try{await lstat(outputPath);fail('Increment curve output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 const request=await readBoundedJson(requestPath);
 const result=await create(request);
 const publication=await publish(outputPath,result.bundle,{includeIntegrity:true});
 const failedSteps=result.curve.steps.filter(row=>row.status==='failed').map(row=>({stepIndex:row.stepIndex,stepId:row.stepId,controlledValue:row.controlledValue}));
 return {
  schemaVersion:1,
  kind:'increment-curve-reinput-bundle',
  format:'{spec,steps}',
  outputPath,
  outputBytes:publication.outputBytes,
  outputSha256:publication.outputSha256,
  curveId:result.curve.curveId,
  nodeCount:result.curve.nodeCount,
  steps:result.curve.steps.length,
  convergedSteps:result.curve.steps.length-failedSteps.length,
  failedSteps,
  inputRevision:result.curve.inputRevision,
  meshRevision:result.curve.meshRevision,
  analysis:result.curve.analysis,
  failures:result.failures,
  limitations:['Synthetic independent force-controlled linear-elastic solves only; not a plastic load/unload history.','The bundle is not a normal Studio project or the verified curve table JSON; it is a dedicated {spec,steps} input.','No GUI state is read or changed.']
 };
}

export function parseIncrementCurveBundleArgs(argv){
 const usage='Usage: node scripts/create-increment-curve-bundle.mjs --request <absolute-request.json> --output <absolute-bundle.json>';
 if(argv.length!==4)fail(usage);
 const args={};
 for(let index=0;index<argv.length;index+=2){
  const flag=argv[index],value=argv[index+1];
  if(flag!=='--request'&&flag!=='--output')fail(usage);
  if(Object.hasOwn(args,flag.slice(2)))fail(usage);
  args[flag.slice(2)+'Path']=value;
 }
 if(!args.requestPath||!args.outputPath)fail(usage);
 return args;
}
