import {printedAbsolutePath,printedPathKey,preparePrintedInputPath,preparePrintedOutputPath,samePrintedFile,readPrintedInputSnapshot} from './printed-identification-file-io.mjs';
import {evaluatePrintedIdentificationSnapshots,printedIdentificationCliError,PRINTED_IDENTIFICATION_FILE_LIMITS} from './printed-identification-file-service.mjs';
import {publishJson} from './json-artifacts.mjs';

export const PRINTED_IDENTIFICATION_BATCH_LIMITS=Object.freeze({entries:8,manifestBytes:131072,totalInputBytes:8388608,artifactBytes:4194304,manifestDepth:8,manifestValues:512});
const prefix='PRINTED_IDENTIFICATION_BATCH_',fail=code=>{throw Object.assign(Error(code),{code});},code=error=>printedIdentificationCliError(error).code;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));

export function parsePrintedBatchArgs(args){
 if(!Array.isArray(args)||args.length!==4)fail(prefix+'ARGUMENTS');const values={};
 for(let i=0;i<4;i+=2){if(!['--manifest','--output'].includes(args[i])||Object.hasOwn(values,args[i].slice(2)))fail(prefix+'ARGUMENTS');values[args[i].slice(2)]=args[i+1];}
 return requestSnapshot(values);
}
function requestSnapshot(value){
 if(!exact(value,['manifest','output']))fail(prefix+'ARGUMENTS');const paths={};
 for(const k of ['manifest','output']){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail(prefix+'ARGUMENTS');paths[k]=printedAbsolutePath(d.value);}
 if(printedPathKey(paths.manifest)===printedPathKey(paths.output))fail('PRINTED_IDENTIFICATION_PATH_ALIAS');return paths;
}
// Small strict JSON parser: duplicate decoded keys, depth, arrays and values are bounded before building a manifest.
function parseManifest(text){
 let at=0,count=0;const invalid=()=>fail(prefix+'MANIFEST_INVALID'),ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){const c=text[at];if(c==='"'){at++;try{const s=JSON.parse(text.slice(start,at));if(s.length>4096)invalid();return s;}catch{invalid();}}if(c==='\\')at++;}invalid();}
 function value(depth){
  if(depth>8||++count>512)invalid();ws();const c=text[at];if(c==='"')return string();
  if(c==='{'||c==='['){const object=c==='{',result=object?Object.create(null):[],seen=new Set();at++;ws();if(text[at]===(object?'}':']')){at++;return result;}
   for(;;){ws();if(object){if(text[at]!=='"')invalid();const key=string();if(seen.has(key)||seen.size>=16)invalid();seen.add(key);ws();if(text[at++]!==':')invalid();result[key]=value(depth+1);}
    else{if(result.length>=8)invalid();result.push(value(depth+1));}ws();if(text[at]===(object?'}':']')){at++;return result;}if(text[at++]!==',')invalid();}
  }
  const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)invalid();at+=m[0].length;const v=JSON.parse(m[0]);if(typeof v==='number'&&!Number.isFinite(v))invalid();return v;
 }
 const manifest=value(0);ws();if(at!==text.length)invalid();
 if(!exact(manifest,['schemaVersion','entries'])||manifest.schemaVersion!==1||!Array.isArray(manifest.entries)||!manifest.entries.length||manifest.entries.length>8)invalid();
 const ids=new Set(),jobs=new Set();
 const entries=manifest.entries.map(entry=>{
  if(!exact(entry,['id','dataset','options'])||typeof entry.id!=='string'||!entry.id.trim()||entry.id!==entry.id.trim()||entry.id.length>100||ids.has(entry.id))invalid();ids.add(entry.id);
  const row={id:entry.id};
  for(const role of ['dataset','options']){const v=entry[role];if(!exact(v,['path','expectedSHA256'])||typeof v.expectedSHA256!=='string'||!/^[a-f0-9]{64}$/.test(v.expectedSHA256))invalid();let path;try{path=printedAbsolutePath(v.path);}catch{invalid();}row[role]={path,expectedSHA256:v.expectedSHA256};}
  const job=entry.dataset.expectedSHA256+':'+entry.options.expectedSHA256;if(jobs.has(job))fail(prefix+'DUPLICATE_JOB');jobs.add(job);return row;
 });return entries;
}

export async function writePrintedIdentificationBatch(request){
 const paths=requestSnapshot(request),output=await preparePrintedOutputPath(paths.output),manifestSource=await preparePrintedInputPath(paths.manifest);
 const context={manifest:null,entries:[],refusal:null},nodes=[];let rows=[];
 let snapshot;
 try{snapshot=await readPrintedInputSnapshot(manifestSource,PRINTED_IDENTIFICATION_BATCH_LIMITS.manifestBytes);context.manifest=snapshot.identity;context.entries=parseManifest(snapshot.text);}
 catch(error){context.manifest=error.identity??context.manifest;context.refusal={code:code(error),stage:'manifest'};}
 if(!context.refusal){
  const byFile=new Map();let total=0n;
  // Preparation uses no open FD. All aliases/versions and aggregate sizes are checked before any dataset/options bytes or fit.
  for(const entry of context.entries)for(const role of ['dataset','options']){
   const requested=entry[role],source=await preparePrintedInputPath(requested.path),fileKey=source.stat.dev+':'+source.stat.ino;
   if(samePrintedFile(source.stat,manifestSource.stat)||printedPathKey(source.path)===printedPathKey(output))fail('PRINTED_IDENTIFICATION_PATH_ALIAS');
   let node=byFile.get(fileKey);
   if(node){
    if(node.role!==role||printedPathKey(node.source.path)!==printedPathKey(source.path))fail('PRINTED_IDENTIFICATION_PATH_ALIAS');
    if(node.expectedSHA256!==requested.expectedSHA256)context.refusal??={code:prefix+'SHA_CONFLICT',stage:'preflight'};
   }else{node={role,source,expectedSHA256:requested.expectedSHA256,snapshot:null,identity:null};byFile.set(fileKey,node);nodes.push(node);}
   requested.node=node;const limit=role==='dataset'?PRINTED_IDENTIFICATION_FILE_LIMITS.datasetBytes:PRINTED_IDENTIFICATION_FILE_LIMITS.optionsBytes;
   total+=source.stat.size;if(source.stat.size>BigInt(limit))context.refusal??={code:'PRINTED_IDENTIFICATION_BYTE_LIMIT',stage:'preflight'};
  }
  // Reused files count once for each manifest reference in the conservative total-byte budget.
  if(total>BigInt(PRINTED_IDENTIFICATION_BATCH_LIMITS.totalInputBytes))context.refusal??={code:prefix+'TOTAL_BYTE_LIMIT',stage:'preflight'};
  if(!context.refusal)for(const node of nodes){
   try{node.snapshot=await readPrintedInputSnapshot(node.source,node.role==='dataset'?PRINTED_IDENTIFICATION_FILE_LIMITS.datasetBytes:PRINTED_IDENTIFICATION_FILE_LIMITS.optionsBytes);node.identity=node.snapshot.identity;
    if(node.identity.sha256!==node.expectedSHA256){context.refusal={code:prefix+'SHA_MISMATCH',stage:'snapshot'};break;}}
   catch(error){node.identity=error.identity??null;context.refusal={code:code(error),stage:'snapshot'};break;}
  }
  const inputs=entry=>Object.fromEntries(['dataset','options'].map(role=>[role,{expectedSHA256:entry[role].expectedSHA256,actual:entry[role].node.identity}]));
  if(context.refusal)rows=context.entries.map(entry=>({id:entry.id,status:'refused',inputs:inputs(entry),result:null,refusal:{code:prefix+'NOT_RUN',stage:'preflight'}}));
  else for(const entry of context.entries){
   // Deliberately sequential. Every input version has already matched its expected raw SHA before the first fit.
   let {result,refusal}=await evaluatePrintedIdentificationSnapshots(entry.dataset.node.snapshot,entry.options.node.snapshot);
   let row={id:entry.id,status:result?.identified===true?'identified':'refused',inputs:inputs(entry),result,refusal};
   if(Buffer.byteLength(JSON.stringify(row))+1>PRINTED_IDENTIFICATION_FILE_LIMITS.artifactBytes)row={...row,status:'refused',result:null,refusal:{code:'PRINTED_IDENTIFICATION_ARTIFACT_LIMIT',stage:'identification'}};
   rows.push(row);
  }
 }
 const identified=rows.filter(row=>row.status==='identified').length,status=!context.refusal&&identified===rows.length?'identified':'refused';
 const artifact={schemaVersion:1,kind:'printed-parameter-identification-batch',status,calibrated:false,accuracyVerified:false,manifest:context.manifest,entries:rows,refusal:context.refusal};
 if(Buffer.byteLength(JSON.stringify(artifact))+1>PRINTED_IDENTIFICATION_BATCH_LIMITS.artifactBytes)fail(prefix+'ARTIFACT_LIMIT');
 let integrity;try{integrity=await publishJson(output,artifact,{includeIntegrity:true});}catch(error){if(error.code==='EEXIST')fail('PRINTED_IDENTIFICATION_OUTPUT_EXISTS');throw error;}
 return {schemaVersion:1,kind:'printed-identification-batch-summary',status,calibrated:false,accuracyVerified:false,counts:{entries:rows.length,identified,refused:rows.length-identified},output,...integrity,...(context.refusal?{refusalCode:context.refusal.code}:{})};
}
export function printedBatchCliError(error){return {schemaVersion:1,kind:'printed-identification-batch-summary',status:'error',code:code(error)};}
