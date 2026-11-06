import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,parse,relative,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
const prefix='PRINTED_IDENTIFICATION_',fail=code=>{throw Object.assign(Error(code),{code});},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const PRINTED_IDENTIFICATION_FILE_LIMITS=Object.freeze({pathSegments:256});
export const printedPathKey=path=>process.platform==='win32'?path.toLowerCase():path;
export function printedAbsolutePath(path){if(typeof path!=='string'||!path.length||path.length>4096||path.includes('\0')||!isAbsolute(path))fail(prefix+'PATH');return resolve(path);}
// Refuse symlink/junction components; publication uses the resolved physical parent afterwards.
async function noLinks(path){
 const root=parse(path).root,parts=relative(root,path).split(/[\\/]/).filter(Boolean);
 if(parts.length>PRINTED_IDENTIFICATION_FILE_LIMITS.pathSegments)fail(prefix+'PATH');
 let current=root;
 for(const part of parts){current=join(current,part);if((await lstat(current)).isSymbolicLink())fail(prefix+'SYMLINK');}
}
export async function preparePrintedInputPath(path){
 path=printedAbsolutePath(path);
 await noLinks(path);const stat=await lstat(path,{bigint:true});
 if(!stat.isFile())fail(prefix+'REGULAR_FILE');
 return {path:await realpath(path),stat};
}
export async function preparePrintedOutputPath(path){
 path=printedAbsolutePath(path);
 const parent=dirname(path);await noLinks(parent);if(!(await lstat(parent)).isDirectory())fail(prefix+'OUTPUT_PARENT');
 const destination=join(await realpath(parent),basename(path));
 try{await lstat(destination);fail(prefix+'OUTPUT_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
 return destination;
}
export const samePrintedFile=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
const unchanged=(a,b)=>samePrintedFile(a,b)&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
export async function readPrintedInputSnapshot(source,limit){
 if(!Number.isSafeInteger(limit)||limit<1||limit>2000000)fail(prefix+'BYTE_LIMIT');
 if(source.stat.size>BigInt(limit))fail(prefix+'BYTE_LIMIT');
 const handle=await open(source.path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const before=await handle.stat({bigint:true});
  if(!before.isFile()||!unchanged(before,source.stat))fail(prefix+'INPUT_CHANGED');
  if(before.size>BigInt(limit))fail(prefix+'BYTE_LIMIT');
  // At most limit+1 bytes are allocated/read even if the file grows after stat.
  const buffer=Buffer.alloc(limit+1);let size=0;
  while(size<buffer.length){const {bytesRead}=await handle.read(buffer,size,Math.min(65536,buffer.length-size),null);if(!bytesRead)break;size+=bytesRead;}
  if(size>limit)fail(prefix+'BYTE_LIMIT');
  const after=await handle.stat({bigint:true}),pathAfter=await lstat(source.path,{bigint:true});
  if(!pathAfter.isFile()||!unchanged(before,after)||!unchanged(after,pathAfter)||BigInt(size)!==after.size)fail(prefix+'INPUT_CHANGED');
  const bytes=buffer.subarray(0,size),identity={bytes:size,sha256:sha(bytes)};let text;
  const utf8Failure=()=>{throw Object.assign(Error(prefix+'UTF8'),{code:prefix+'UTF8',identity});};
  try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{utf8Failure();}
  if(text.charCodeAt(0)===0xfeff)utf8Failure();
  return {text,identity};
 }finally{await handle.close();}
}
