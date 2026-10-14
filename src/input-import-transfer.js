import {MAX_IMPORT_BYTES} from './project-import.js';
import {canonicalJson} from './project-revision.js';
const CHUNK=65536,hash=/^sha256:[a-f0-9]{64}$/;
const isHash=value=>typeof value==='string'&&hash.test(value);
const fail=message=>{throw Error(message);};
function command(value,allowed){const copy=JSON.parse(canonicalJson(value));if(!copy||typeof copy!=='object'||Array.isArray(copy)||Object.keys(copy).some(key=>!allowed.includes(key)))fail('Invalid input import transfer arguments');return copy;}
const digest=async bytes=>'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
function encode(bytes){const parts=[];for(let offset=0;offset<bytes.length;offset+=32768)parts.push(String.fromCharCode(...bytes.subarray(offset,offset+32768)));return btoa(parts.join(''));}
function decode(value){if(typeof value!=='string'||!value.length||value.length>Math.ceil(CHUNK/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail('Invalid input import base64 chunk');const bytes=Uint8Array.from(atob(value),character=>character.charCodeAt(0));if(!bytes.length||bytes.length>CHUNK||encode(bytes)!==value)fail('Invalid input import base64 chunk');return bytes;}
// The budget covers retained staging buffers, not parser/digest/base64 or peak heap.
// A failed commit is retained as a failed promise: release and begin a new transfer
// to retry. Successful retries reuse the saved response and never parse twice.
export function createInputImportTransfer({imports,maxBytes=100000000,maxTransfers=4,id=()=>crypto.randomUUID()}={}){
 if(!imports||typeof imports.import!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>100000000||!Number.isSafeInteger(maxTransfers)||maxTransfers<1||typeof id!=='function')throw TypeError('Invalid input import transfer configuration');
 const transfers=new Map(),issued=new Set();let retained=0;
 const check=guard=>{if(typeof guard!=='function'||!guard())fail('Input import transfer command expired');};
 const find=args=>{if(typeof args.transferId!=='string'||!args.transferId)fail('Invalid input import transfer identity');return transfers.get(args.transferId)??fail('Unknown or released input import transfer');};
 const live=(entry,guard)=>{check(guard);if(entry.controller.signal.aborted||transfers.get(entry.transferId)!==entry)fail('Input import transfer released or expired');};
 const metadata=entry=>({transferId:entry.transferId,direction:'import',totalBytes:entry.totalBytes,sha256:entry.sha256,maxChunkBytes:CHUNK});
 function release(entry){entry.controller.abort();if(transfers.delete(entry.transferId)){retained-=entry.totalBytes;entry.bytes=null;entry.previous=null;}}
 return Object.freeze({
  beginImport(args,{guard=()=>true}={}){
   args=command(args,['expectedRevision','format','name','scaleToMm','totalBytes','sha256']);check(guard);
   if(!isHash(args.expectedRevision)||!isHash(args.sha256)||!['step','stl'].includes(args.format)||!Number.isSafeInteger(args.totalBytes)||args.totalBytes<1||args.totalBytes>MAX_IMPORT_BYTES||args.name!==undefined&&(typeof args.name!=='string'||!args.name.trim()||args.name.length>1000))fail('Invalid input import metadata');
   if(args.format==='stl'?typeof args.scaleToMm!=='number'||!Number.isFinite(args.scaleToMm)||args.scaleToMm<=0:Object.hasOwn(args,'scaleToMm'))fail('STL requires a positive scaleToMm; STEP does not accept scaleToMm');
   if(transfers.size>=maxTransfers)fail('Input import transfer count limit exceeded');if(args.totalBytes>maxBytes-retained)fail('Input import transfer byte budget exceeded');
   const transferId=id();if(typeof transferId!=='string'||!transferId||transferId.length>200||issued.has(transferId))fail('Invalid or duplicate input import transfer identity');
   const entry={...args,transferId,controller:new AbortController(),bytes:new Uint8Array(args.totalBytes),offset:0};issued.add(transferId);transfers.set(transferId,entry);retained+=entry.totalBytes;return metadata(entry);
  },
  write(args,{guard=()=>true}={}){
   args=command(args,['transferId','offset','data']);const entry=find(args);live(entry,guard);if(entry.commitPromise)fail('Input import transfer is not writable');const bytes=decode(args.data);
   if(entry.previous&&args.offset===entry.previous.offset&&args.data===entry.previous.data)return {...metadata(entry),nextOffset:entry.offset};
   if(!Number.isSafeInteger(args.offset)||args.offset!==entry.offset||args.offset+bytes.length>entry.totalBytes)fail('Input import chunk offset conflict');entry.bytes.set(bytes,args.offset);entry.offset+=bytes.length;entry.previous={offset:args.offset,data:args.data};return {...metadata(entry),nextOffset:entry.offset};
  },
  async commit(args,{guard=()=>true}={}){
   args=command(args,['transferId']);const entry=find(args);live(entry,guard);
   if(!entry.commitPromise){if(entry.offset!==entry.totalBytes)fail('Input import transfer is incomplete');const valid=()=>transfers.get(entry.transferId)===entry&&!entry.controller.signal.aborted&&guard();
    entry.commitPromise=(async()=>{const actual=await digest(entry.bytes);live(entry,guard);if(actual!==entry.sha256)fail('Input import hash mismatch');const request={expectedRevision:entry.expectedRevision,format:entry.format,bytes:entry.bytes.slice(),...(entry.name!==undefined?{name:entry.name}:{}),...(entry.scaleToMm!==undefined?{scaleToMm:entry.scaleToMm}:{})};live(entry,guard);const result=await imports.import(request,{guard:valid,signal:entry.controller.signal});live(entry,guard);entry.result=structuredClone(result);return entry.result;})();
   }
   await entry.commitPromise;live(entry,guard);return structuredClone(entry.result);
  },
  release(args,{guard=()=>true}={}){args=command(args,['transferId']);check(guard);release(find(args));return {released:true};},
  clear(){for(const entry of transfers.values())release(entry);}
 });
}
