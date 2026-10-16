import {mkdirSync,lstatSync,readdirSync,readFileSync,writeFileSync,renameSync,unlinkSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {isAbsolute,resolve,join,parse} from 'node:path';
import {randomUUID} from 'node:crypto';

// Opt-in, bounded job RECORD store. Records are metadata only: never project data,
// result bodies, field arrays, output paths or intermediate artifacts.
export const jobStoreLimits=Object.freeze({maxRecords:256,maxRecordBytes:8192,maxMessageChars:400,maxDiagnostics:32});
export const INTERRUPTED_CODE='ANALYSIS_JOB_INTERRUPTED_BY_RESTART';
const idPattern=/^[A-Za-z0-9-]{1,64}$/,filePattern=/^([A-Za-z0-9-]{1,64})\.json$/,tmpPattern=/^\.tmp-[A-Za-z0-9-]{1,64}\.json$/;
const states=new Set(['running','saving','succeeded','failed','cancelled','timed_out','interrupted']);
const terminal=new Set(['succeeded','failed','cancelled','timed_out','interrupted']);
const clip=value=>typeof value==='string'?value.slice(0,jobStoreLimits.maxMessageChars):undefined;
const isTime=value=>Number.isFinite(value)&&value>=0;

export function validateJobStoreDirectory(directory){
 if(typeof directory!=='string'||!directory||directory.includes('\0')||!isAbsolute(directory))throw Error('--job-store requires an explicit absolute directory');
 if(directory.split(/[\\/]+/).includes('..'))throw Error('--job-store must not contain ".." segments');
 const full=resolve(directory);
 if(parse(full).root===full)throw Error('--job-store must not be a filesystem root');
 return full;
}
function toRecord(view,{requestId}={}){
 const error=view.error&&typeof view.error==='object'?{code:clip(view.error.code),message:clip(view.error.message)}:undefined;
 const executionErrorCode=clip(view.executionError?.code);
 const result=view.result&&typeof view.result==='object'&&Number.isSafeInteger(view.result.outputBytes)&&typeof view.result.outputSha256==='string'&&/^[0-9a-f]{64}$/.test(view.result.outputSha256)?{outputBytes:view.result.outputBytes,outputSha256:view.result.outputSha256}:undefined;
 return {schemaVersion:1,kind:'analysis-job-record',jobId:view.jobId,inputRevision:view.inputRevision,operation:view.operation,origin:view.origin,state:view.state,...(requestId?{requestId}:{}),startedAt:view.startedAt,updatedAt:view.updatedAt,executionSettled:view.executionSettled===true,...(error?{error}:{}),...(executionErrorCode?{executionErrorCode}:{}),...(result?{resultDigest:result}:{})};
}
function validateRecord(value,name){
 const fail=reason=>{throw Error(reason);};
 if(!value||typeof value!=='object'||Array.isArray(value))fail('record is not an object');
 const allowed=new Set(['schemaVersion','kind','jobId','inputRevision','operation','origin','state','requestId','startedAt','updatedAt','executionSettled','error','executionErrorCode','resultDigest']);
 for(const key of Object.keys(value))if(!allowed.has(key))fail('unknown field '+key);
 if(value.schemaVersion!==1||value.kind!=='analysis-job-record')fail('unsupported schema');
 if(typeof value.jobId!=='string'||!idPattern.test(value.jobId)||value.jobId!==name)fail('job ID does not match file name');
 if(typeof value.inputRevision!=='string'||!value.inputRevision||value.inputRevision.length>200)fail('invalid inputRevision');
 if(!['mesh','elastic'].includes(value.operation)||!['gui','api'].includes(value.origin)||!states.has(value.state))fail('invalid operation, origin or state');
 if(value.requestId!==undefined&&(typeof value.requestId!=='string'||!value.requestId||value.requestId.length>200))fail('invalid requestId');
 if(!isTime(value.startedAt)||!isTime(value.updatedAt)||typeof value.executionSettled!=='boolean')fail('invalid timestamps');
 if(value.error!==undefined&&(!value.error||typeof value.error!=='object'||Object.keys(value.error).some(k=>!['code','message'].includes(k))||value.error.code!==undefined&&typeof value.error.code!=='string'||value.error.message!==undefined&&typeof value.error.message!=='string'))fail('invalid error');
 if(value.executionErrorCode!==undefined&&typeof value.executionErrorCode!=='string')fail('invalid executionErrorCode');
 const digest=value.resultDigest;
 if(digest!==undefined&&(!digest||typeof digest!=='object'||Object.keys(digest).sort().join()!=='outputBytes,outputSha256'||!Number.isSafeInteger(digest.outputBytes)||digest.outputBytes<0||typeof digest.outputSha256!=='string'||!/^[0-9a-f]{64}$/.test(digest.outputSha256)))fail('invalid resultDigest');
 return value;
}
// A restored job is metadata only: terminal states keep their recorded state; anything that
// was still running or saving is reported as interrupted and is never resumed or re-run.
export function restoredJobView(record){
 const interrupted=!terminal.has(record.state)||record.state==='interrupted';
 const state=interrupted?'interrupted':record.state;
 const error=interrupted?{code:INTERRUPTED_CODE,message:'The MCP process stopped before this job finished. It was not resumed and no result is available; start a new job.'}:record.error;
 return {schemaVersion:1,jobId:record.jobId,inputRevision:record.inputRevision,state,executionSettled:true,resourceState:'settled',releaseAllowed:true,operation:record.operation,origin:record.origin,startedAt:record.startedAt,updatedAt:record.updatedAt,lastSequence:0,firstAvailableSequence:0,restored:true,resultAvailable:false,...(record.state!==state?{recordedState:record.state}:{}),...(record.resultDigest?{recordedResultDigest:record.resultDigest}:{}),...(error?{error}:{}),...(record.executionErrorCode?{executionErrorCode:record.executionErrorCode}:{})};
}
export function createJobStore(directory,{onDiagnostic}={}){
 const dir=validateJobStoreDirectory(directory),diagnostics=[];
 const note=(code,message)=>{const entry={code,message:String(message).slice(0,300)};if(diagnostics.length<jobStoreLimits.maxDiagnostics)diagnostics.push(entry);try{onDiagnostic?.(entry);}catch{/* diagnostics are best effort */}};
 let stat;try{stat=lstatSync(dir);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(stat){if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('--job-store must be a real directory');}
 else mkdirSync(dir);
 const known=new Set();
 const pathFor=jobId=>{if(typeof jobId!=='string'||!idPattern.test(jobId))throw Error('Invalid job ID for the job store');return join(dir,jobId+'.json');};
 function writeRecord(record){
  const json=JSON.stringify(record)+'\n';
  if(Buffer.byteLength(json)>jobStoreLimits.maxRecordBytes)throw Error('record exceeds size cap');
  if(!known.has(record.jobId)&&known.size>=jobStoreLimits.maxRecords)throw Error('record count cap reached; release jobs to persist more');
  const target=pathFor(record.jobId),temporary=join(dir,'.tmp-'+randomUUID()+'.json');
  try{writeFileSync(temporary,json,{flag:'wx'});const fd=openSync(temporary,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temporary,target);}
  catch(error){try{unlinkSync(temporary);}catch{/* already gone */}throw error;}
  known.add(record.jobId);
 }
 function persist(view,meta){try{writeRecord(toRecord(view,meta));}catch(error){note('ANALYSIS_JOB_STORE_WRITE_FAILED',(view?.jobId??'?')+': '+error.message);}}
 function remove(jobId){try{unlinkSync(pathFor(jobId));}catch(error){if(error.code!=='ENOENT')note('ANALYSIS_JOB_STORE_REMOVE_FAILED',jobId+': '+error.message);}known.delete(jobId);}
 function load(){
  const restored=new Map();let names;
  try{names=readdirSync(dir);}catch(error){note('ANALYSIS_JOB_STORE_READ_FAILED',error.message);return restored;}
  names.sort();
  for(const name of names){
   if(tmpPattern.test(name)){try{unlinkSync(join(dir,name));}catch{/* leave it */}continue;}
   const match=filePattern.exec(name);
   if(!match){note('ANALYSIS_JOB_STORE_FOREIGN_FILE_IGNORED',name.slice(0,80));continue;}
   if(restored.size>=jobStoreLimits.maxRecords){note('ANALYSIS_JOB_STORE_RECORD_CAP',name+' ignored: more than '+jobStoreLimits.maxRecords+' records');continue;}
   try{
    const file=join(dir,name),info=lstatSync(file);
    if(!info.isFile())throw Error('not a regular file');
    if(info.size>jobStoreLimits.maxRecordBytes)throw Error('record exceeds '+jobStoreLimits.maxRecordBytes+' bytes');
    const record=validateRecord(JSON.parse(readFileSync(file,'utf8')),match[1]);
    restored.set(record.jobId,record);known.add(record.jobId);
   }catch(error){note('ANALYSIS_JOB_STORE_CORRUPT_RECORD',name+' ignored: '+error.message);}
  }
  // Persist the interrupted classification so it stays stable across further restarts.
  for(const record of [...restored.values()])if(!terminal.has(record.state)){
   const next={...record,state:'interrupted',executionSettled:true};
   try{writeRecord(next);}catch(error){note('ANALYSIS_JOB_STORE_WRITE_FAILED',record.jobId+': '+error.message);}
  }
  return restored;
 }
 return Object.freeze({directory:dir,diagnostics,persist,remove,load});
}
