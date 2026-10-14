import {canonicalJson,getProjectRevision} from './project-revision.js';
import {exteriorFluidSource,exteriorAcousticSource,internalFluidSource,validateFluidDomain} from './fluid-domain.js';
import {createStudioApi} from './studio-api.js';
import {inspectMesh} from './mesh-core.js';
import {validateInternalMesh} from './internal-fluid.js';
import {sourceFingerprint} from './source-identity.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const copy=value=>JSON.parse(canonicalJson(value));
const hash=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
function command(args,keys){if(!plain(args))throw Error('Invalid fluid domain request');const result=copy(args);if(Object.keys(result).some(key=>!keys.includes(key)))throw Error('Invalid fluid domain request');return result;}
/** Prepare new mesh-only input, not fluid physics or a generated fluid mesh.
 * Original CAD bytes are retained in sourceModel.solid. Old physical inputs,
 * confirmations, selection and solid refinements are deliberately cleared. */
export function prepareFluidDomainProject(project,args){
 const options=command(args,['mode','enclosure','paddingMm','seedPoint','portPlanes','name']),original=copy(project);
 if(options.name!==undefined&&(typeof options.name!=='string'||!options.name.trim()))throw Error('Invalid fluid domain name');
 let source;
 if(options.mode==='exterior'){
  if(!['box','sphere'].includes(options.enclosure)||Object.hasOwn(options,'seedPoint')||Object.hasOwn(options,'portPlanes'))throw Error('Exterior domain requires explicit box or sphere enclosure and padding');
  source=(options.enclosure==='sphere'?exteriorAcousticSource:exteriorFluidSource)(original,options.paddingMm);
 }else if(options.mode==='internal'){
  if(Object.hasOwn(options,'paddingMm'))throw Error('Internal domain does not accept padding');
  const solid=original.sourceModel?.kind==='fluidDomain'?original.sourceModel.solid:original.sourceModel;
  source=internalFluidSource({...original,sourceModel:solid},{enclosure:options.enclosure,seedPoint:options.seedPoint,portPlanes:options.portPlanes});
 }else throw Error('Invalid fluid domain mode');
 const candidate={...original,name:options.name??original.name,sourceModel:source,study:{kind:'fluidDomain'},materialProperties:{},meshSettings:{refinements:[]},conditions:[],selection:original.meshes.map(()=>[])};
 for(const key of ['inputProvenance','analysisIntent','planarRegion','cylindricalRegion'])delete candidate[key];
 return candidate;
}
function domainSummary(mesh){
 const d=mesh.domainSelection,ports=d?.ports??[],tags=new Set(ports.map(p=>p.faceTag));
 return {mode:d?'internal':'exterior',portCount:ports.length,ports:ports.slice(0,100).map(p=>({plane:p.plane,faceTag:p.faceTag})),portsTruncated:ports.length>100,wallFaceCount:new Set(mesh.surface.filter(f=>!tags.has(f.faceTag)).map(f=>f.faceTag)).size,...(d?.channel?{channel:Object.fromEntries(['model','axis','start','end','lengthM','widthMm','radiusMm','centerMm','hydraulicDiameterM','areaM2'].filter(key=>Object.hasOwn(d.channel,key)).map(key=>[key,copy(d.channel[key])]))}:{})};
}
/** Trusted getMeshJob returns {job,output}; no wire-supplied result is accepted.
 * loadProject must synchronously validate and atomically commit its input. */
export function createFluidDomainOperations({studio,getMeshJob,normalizeProject=project=>project,isBusy=()=>false}={}){
 if(typeof studio?.exportProject!=='function'||typeof studio?.loadProject!=='function'||getMeshJob!==undefined&&typeof getMeshJob!=='function'||typeof normalizeProject!=='function'||typeof isBusy!=='function')throw TypeError('Fluid domain operations require a studio adapter');
 let locked=false;
 const check=guard=>{if(typeof guard!=='function'||!guard())throw Error('Fluid domain permission expired');if(isBusy())throw Error('Studio is busy');};
 async function mutate(args,guard,build){
  if(locked)throw Error('Fluid domain operation in progress');check(guard);locked=true;
  try{
   if(!hash(args.expectedRevision))throw Error('Invalid expected project revision');
   const before=copy(studio.exportProject()),serialized=canonicalJson(before),previousRevision=await getProjectRevision(before);
   check(guard);if(previousRevision!==args.expectedRevision)throw Error('Project revision conflict');if(canonicalJson(studio.exportProject())!==serialized)throw Error('Project changed during fluid domain operation');
   const {project,extra}=await build(before);check(guard);
   if(normalizeProject.constructor?.name==='AsyncFunction')throw Error('Project normalization must be synchronous');
   const prepared=normalizeProject(structuredClone(project));if(prepared&&typeof prepared.then==='function'){Promise.resolve(prepared).catch(()=>{});throw Error('Project normalization must be synchronous');}
   const validation=createStudioApi();validation.loadProject(copy(prepared));const normalized=validation.exportProject(),response={schemaVersion:1,previousRevision,revision:await getProjectRevision(normalized),summary:validation.getSummary(),units:{geometry:'mm'},...extra};
   check(guard);if(canonicalJson(studio.exportProject())!==serialized)throw Error('Project changed during fluid domain operation');
   studio.loadProject(normalized);return response;
  }finally{locked=false;}
 }
 return Object.freeze({
  isBusy:()=>locked||isBusy(),
  async prepare(args,{guard=()=>true}={}){
   const frozen=command(args,['expectedRevision','mode','enclosure','paddingMm','seedPoint','portPlanes','name']);
   return mutate(frozen,guard,before=>{const {expectedRevision,...parameters}=frozen;return {project:prepareFluidDomainProject(before,parameters),extra:{prepared:true,meshGenerated:false,studyKind:'fluidDomain'}};});
  },
  async applyMesh(args,{guard=()=>true}={}){
   const frozen=command(args,['expectedRevision','jobId']);
   return mutate(frozen,guard,async before=>{
    if(typeof frozen.jobId!=='string'||!frozen.jobId||!getMeshJob)throw Error('Mesh job provider or identity unavailable');
    if(before.sourceModel?.kind!=='fluidDomain'||before.study?.kind!=='fluidDomain')throw Error('Prepare a mesh-only fluid domain first');validateFluidDomain(before.sourceModel);
    // Trusted job views may carry optional undefined members. Detach them,
    // then validate only the metadata and mesh actually consumed below.
    const value=structuredClone(await getMeshJob(frozen.jobId)),{job,output}=value;
    if(job?.jobId!==frozen.jobId||job.operation!=='mesh'||job.state!=='succeeded'||job.executionSettled!==true||job.inputRevision!==frozen.expectedRevision||value.inputRevision!==undefined&&value.inputRevision!==job.inputRevision)throw Error('A successful settled matching mesh job is required');
    if(!output||output.result!==undefined&&output.result!==null||canonicalJson(output.input)!==canonicalJson(before))throw Error('Mesh job input does not match current fluid domain');
    const mesh=output.mesh;
    if(!mesh||!Array.isArray(mesh.nodes)||mesh.nodes.length>360000||!Array.isArray(mesh.tetrahedra)||mesh.tetrahedra.length>30000||!Array.isArray(mesh.surface)||!mesh.surface.length||mesh.surface.length>120000)throw Error('Invalid fluid domain mesh');
    const summary=inspectMesh(mesh),n=summary.nodeCount;
    if(mesh.surface.some(f=>!Array.isArray(f.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||!f.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<n)||!Number.isSafeInteger(f.faceTag)||f.faceTag<1))throw Error('Invalid fluid domain surface');
    validateInternalMesh(mesh,before.sourceModel);
    if(mesh.sourceHash!==await sourceFingerprint(before.sourceModel))throw Error('Mesh source fingerprint mismatch');
    const display={positions:mesh.surface.flatMap(f=>f.nodes.flatMap(i=>mesh.nodes.slice(3*i,3*i+3))),faceIds:mesh.surface.map(f=>f.faceTag),kind:'gmsh-surface',sourceHash:mesh.sourceHash};
    return {project:{...before,meshes:[display],selection:[[]],conditions:[],study:{kind:'fluidDomain'}},extra:{applied:true,jobId:frozen.jobId,meshSummary:summary,domainSelection:domainSummary(mesh),studyKind:'fluidDomain'}};
   });
  }
 });
}
