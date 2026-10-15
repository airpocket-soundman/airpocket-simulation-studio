import {canonicalJson,getProjectRevision} from './project-revision.js';

const CHUNK=65536,HASH=/^sha256:[a-f0-9]{64}$/;
const fail=message=>{throw Object.assign(new Error(message),{code:'JOB_RESULT_TRANSFER_INVALID'});};
const plain=v=>v!==null&&typeof v==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function query(args,keys){if(!plain(args)||Reflect.ownKeys(args).some(key=>typeof key!=='string'||!keys.includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value')))fail('Invalid job result transfer arguments');}
function encode(bytes){let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text);}
const digest=async bytes=>'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
// Preserve JSON-visible optional fields and numeric typed arrays without JSON's
// silent NaN/Infinity -> null conversion or executing getters/toJSON hooks.
function snapshot(value,seen=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))fail('Job result contains non-finite JSON values');return value;}
 if(typeof value!=='object'||seen.has(value))fail('Job result requires finite, acyclic JSON data');
 if(ArrayBuffer.isView(value)&&!(value instanceof DataView))return Array.from(value,item=>snapshot(item));
 if(!Array.isArray(value)&&!plain(value))fail('Job result requires plain JSON data');
 seen.add(value);let out;
 if(Array.isArray(value)){
  if(Reflect.ownKeys(value).length!==value.length+1||Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).some(d=>!d||!d.enumerable||!Object.hasOwn(d,'value')))fail('Job result has invalid JSON array');
  out=value.map(item=>snapshot(item,seen));
 }else{
  out=Object.create(null);
  for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))fail('Job result has invalid JSON property');if(d.value!==undefined)out[key]=snapshot(d.value,seen);}
 }
 seen.delete(value);return out;
}

/** Export-only staging of completed job output; never displays or applies it. */
export function createJobResultTransfer({analysis,maxBytes=100000000,maxTransfers=4,id=()=>crypto.randomUUID()}={}){
 if(!analysis||typeof analysis.getJob!=='function'||typeof analysis.getJobResult!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>100000000||!Number.isSafeInteger(maxTransfers)||maxTransfers<1||maxTransfers>16||typeof id!=='function')throw TypeError('Invalid job result transfer configuration');
 const transfers=new Map(),issued=new Set();let retained=0,epoch=0;
 const guardCheck=guard=>{if(typeof guard!=='function'||guard()!==true)fail('Job result transfer command expired');};
 const find=transferId=>transfers.get(transferId)??fail('Unknown or released job result transfer');
 const live=(entry,guard)=>{guardCheck(guard);if(transfers.get(entry.transferId)!==entry)fail('Job result transfer released or expired');};
 const releaseEntry=entry=>{if(transfers.delete(entry.transferId)){retained-=entry.totalBytes;entry.bytes=null;}};
 const metadata=entry=>({schemaVersion:1,transferId:entry.transferId,direction:'export',format:'analysis-output',jobId:entry.jobId,inputRevision:entry.inputRevision,kind:entry.kind,totalBytes:entry.totalBytes,sha256:entry.sha256,hashBasis:'raw-utf8',maxChunkBytes:CHUNK});
 function checkJob(jobId,inputRevision){const job=analysis.getJob(jobId);if(job.jobId!==jobId||job.state!=='succeeded'||job.executionSettled!==true||job.inputRevision!==inputRevision)fail('Job result requires a succeeded, settled job with the exact input revision');return job;}
 return Object.freeze({
  async beginExport(args={}, {guard=()=>true}={}){
   query(args,['jobId','inputRevision']);guardCheck(guard);
   const {jobId,inputRevision}=args;
   if(typeof jobId!=='string'||!jobId||jobId.length>200||typeof inputRevision!=='string'||!HASH.test(inputRevision))fail('Invalid job result identity or input revision');
   checkJob(jobId,inputRevision);const generation=epoch;
   // Validate and detach every field before the first asynchronous hash.
   const output=JSON.parse(canonicalJson(snapshot(analysis.getJobResult(jobId))));
   if(!plain(output)||!plain(output.input)||!plain(output.calculation)||!plain(output.mesh)||output.result!==undefined&&!plain(output.result)||output.boundary!==undefined&&!plain(output.boundary))fail('Invalid complete job result output');
   if(output.result===undefined&&output.calculation.operation!=='mesh')fail('Job result output is missing its computed result');
   const kind=output.result?.kind??'mesh';if(typeof kind!=='string'||!kind||kind.length>100)fail('Invalid job result kind');
   const bytes=new TextEncoder().encode(JSON.stringify(output));
   guardCheck(guard);if(generation!==epoch)fail('Job result transfer disconnected');
   if(transfers.size>=maxTransfers)fail('Job result transfer count limit exceeded');
   if(bytes.length>maxBytes-retained)fail('Job result transfer byte budget exceeded');
   const transferId=id();if(typeof transferId!=='string'||!transferId||transferId.length>200||issued.has(transferId))fail('Invalid job result transfer identity');
   const entry={transferId,jobId,inputRevision,kind,totalBytes:bytes.length,bytes,ready:false};issued.add(transferId);transfers.set(transferId,entry);retained+=bytes.length;
   try{
    const actualInputRevision=await getProjectRevision(output.input);live(entry,guard);
    if(actualInputRevision!==inputRevision)fail('Job result input revision mismatch');
    entry.sha256=await digest(bytes);live(entry,guard);checkJob(jobId,inputRevision);
    entry.ready=true;return metadata(entry);
   }catch(error){releaseEntry(entry);throw error;}
  },
  read(args={}, {guard=()=>true}={}){
   query(args,['transferId','offset','length']);const {transferId,offset=0,length=CHUNK}=args,entry=find(transferId);live(entry,guard);
   if(!entry.ready)fail('Job result transfer is not ready');
   if(!Number.isSafeInteger(offset)||offset<0||offset>entry.totalBytes||!Number.isSafeInteger(length)||length<1||length>CHUNK)fail('Invalid job result read range');
   const end=Math.min(offset+length,entry.totalBytes);return {...metadata(entry),offset,data:encode(entry.bytes.subarray(offset,end)),nextOffset:end===entry.totalBytes?null:end};
  },
  release(args={}, {guard=()=>true}={}){query(args,['transferId']);guardCheck(guard);releaseEntry(find(args.transferId));return {released:true};},
  disconnect(){epoch++;for(const entry of transfers.values())releaseEntry(entry);}
 });
}
