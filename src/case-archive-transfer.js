const CHUNK=65536;
const hashPattern=/^sha256:[a-f0-9]{64}$/;
const fail=message=>{throw Error(message);};
const digest=async bytes=>'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const encode=bytes=>{let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));return btoa(value);};
function decode(value){
 if(typeof value!=='string'||value.length>Math.ceil(CHUNK/3)*4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail('Invalid archive base64 chunk');
 const text=atob(value),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
 if(!bytes.length||bytes.length>CHUNK||encode(bytes)!==value)fail('Invalid archive base64 chunk');return bytes;
}
/** Portable, bounded staging. Guards are private host callbacks, never wire data. */
export function createCaseArchiveTransfer({cases,maxBytes=100000000,maxTransfers=4,id=()=>crypto.randomUUID()}={}){
 if(!cases||typeof cases.exportArchive!=='function'||typeof cases.importArchive!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>100000000||!Number.isSafeInteger(maxTransfers)||maxTransfers<1||typeof id!=='function')throw TypeError('Invalid archive transfer configuration');
 const transfers=new Map(),issued=new Set();let retained=0;
 const guardCheck=guard=>{if(typeof guard!=='function'||!guard())fail('Archive transfer command expired');};
 const find=({transferId}={})=>transfers.get(transferId)??fail('Unknown or released archive transfer');
 const live=(entry,guard)=>{guardCheck(guard);if(transfers.get(entry.transferId)!==entry)fail('Archive transfer released or expired');};
 const metadata=entry=>({transferId:entry.transferId,direction:entry.direction,...(entry.archiveRevision?{archiveRevision:entry.archiveRevision}:{}),totalBytes:entry.totalBytes,sha256:entry.sha256,maxChunkBytes:CHUNK});
 function allocate(direction,totalBytes){
  if(transfers.size>=maxTransfers)fail('Archive transfer count limit exceeded');
  if(totalBytes>maxBytes-retained)fail('Archive transfer byte budget exceeded');
  const transferId=id();if(typeof transferId!=='string'||!transferId||issued.has(transferId))fail('Invalid archive transfer identity');
  const entry={transferId,direction,totalBytes,bytes:new Uint8Array(totalBytes),offset:0};issued.add(transferId);transfers.set(transferId,entry);retained+=totalBytes;return entry;
 }
 function releaseEntry(entry){if(transfers.delete(entry.transferId)){retained-=entry.bytes?.length??0;entry.bytes=null;}}
 return Object.freeze({
  async beginExport(args={}, {guard=()=>true}={}){
   guardCheck(guard);const value=typeof cases.exportArchiveJson==='function'?await cases.exportArchiveJson():await cases.exportArchive();guardCheck(guard);
   const bytes=new TextEncoder().encode(value.json??JSON.stringify(value.archive));
   if(!bytes.length||bytes.length>maxBytes)fail('Archive export byte limit exceeded');
   const entry=allocate('export',bytes.length);entry.bytes.set(bytes);entry.archiveRevision=value.archiveRevision;
   try{entry.sha256=await digest(entry.bytes);live(entry,guard);return metadata(entry);}catch(error){releaseEntry(entry);throw error;}
  },
  read({transferId,offset=0,length=CHUNK}={}){
   const entry=find({transferId});if(entry.direction!=='export')fail('Archive transfer is not an export');
   if(!Number.isSafeInteger(offset)||offset<0||offset>entry.totalBytes||!Number.isSafeInteger(length)||length<1||length>CHUNK)fail('Invalid archive read range');
   const end=Math.min(offset+length,entry.totalBytes);return {...metadata(entry),offset,data:encode(entry.bytes.subarray(offset,end)),nextOffset:end===entry.totalBytes?null:end};
  },
  beginImport({expectedArchiveRevision,totalBytes,sha256}={}, {guard=()=>true}={}){
   guardCheck(guard);if(!hashPattern.test(expectedArchiveRevision)||!hashPattern.test(sha256)||!Number.isSafeInteger(totalBytes)||totalBytes<1||totalBytes>maxBytes)fail('Invalid archive import metadata');
   const entry=allocate('import',totalBytes);entry.expectedArchiveRevision=expectedArchiveRevision;entry.sha256=sha256;return metadata(entry);
  },
  write({transferId,offset,data}={}, {guard=()=>true}={}){
   const entry=find({transferId});live(entry,guard);if(entry.direction!=='import'||entry.commitPromise||entry.completed)fail('Archive import is not writable');
   const bytes=decode(data);
   if(entry.previous&&offset===entry.previous.offset&&data===entry.previous.data)return {...metadata(entry),nextOffset:entry.offset};
   if(!Number.isSafeInteger(offset)||offset!==entry.offset||offset+bytes.length>entry.totalBytes)fail('Archive import chunk offset conflict');
   entry.bytes.set(bytes,offset);entry.offset+=bytes.length;entry.previous={offset,data};return {...metadata(entry),nextOffset:entry.offset};
  },
  async commit({transferId}={}, {guard=()=>true}={}){
   const entry=find({transferId});live(entry,guard);if(entry.direction!=='import')fail('Archive transfer is not an import');
   if(entry.completed)return structuredClone(entry.result);
   if(entry.commitPromise){await entry.commitPromise;live(entry,guard);return structuredClone(entry.result);}
   if(entry.offset!==entry.totalBytes)fail('Archive import is incomplete');
   entry.commitPromise=(async()=>{
    const actual=await digest(entry.bytes);live(entry,guard);if(actual!==entry.sha256)fail('Archive import hash mismatch');
    const archive=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(entry.bytes));live(entry,guard);
    const valid=()=>transfers.get(transferId)===entry&&guard();
    entry.result=await cases.importArchive({archive,expectedArchiveRevision:entry.expectedArchiveRevision},{guard:valid});
    entry.completed=true;return entry.result;
   })();
   try{await entry.commitPromise;live(entry,guard);return structuredClone(entry.result);}finally{entry.commitPromise=null;}
  },
  release(args){releaseEntry(find(args));return {released:true};},
  cancelAllImports(){for(const entry of transfers.values())if(entry.direction==='import')releaseEntry(entry);},
  disconnect(){for(const entry of transfers.values())if(entry.direction==='import')releaseEntry(entry);}
 });
}
