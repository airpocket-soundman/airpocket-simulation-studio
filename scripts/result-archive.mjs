import {open,stat,realpath} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {publishJson} from './json-artifacts.mjs';

export const RESULT_ARCHIVE_MAX_SOURCE_BYTES=100000000;
export const RESULT_ARCHIVE_MAX_TOTAL_BYTES=100000000;
const fail=(code,message)=>Object.assign(Error(message),{code});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const plain=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).every(k=>keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));
async function boundedRead(path){
 const file=await open(path,'r');
 try{const chunks=[];let bytes=0;for(;;){const chunk=Buffer.allocUnsafe(Math.min(1048576,RESULT_ARCHIVE_MAX_SOURCE_BYTES+1-bytes));const {bytesRead}=await file.read(chunk);if(!bytesRead)return Buffer.concat(chunks,bytes);bytes+=bytesRead;if(bytes>RESULT_ARCHIVE_MAX_SOURCE_BYTES)throw fail('RESULT_ARCHIVE_TOO_LARGE','Result source exceeds byte limit');chunks.push(chunk.subarray(0,bytesRead));}}
 finally{await file.close();}
}
/** Package explicitly selected saved results; never execute analysis or infer runtime identity. */
export async function archiveResults(args,{readSource=boundedRead,statSource=stat,realSource=realpath}={}){
 if(!plain(args,['results','outputPath'])||!Array.isArray(args.results)||args.results.length<1||args.results.length>8||typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||args.results.some(r=>!plain(r,['path','name','expectedSha256'])||typeof r.path!=='string'||!isAbsolute(r.path)||typeof r.name!=='string'||!r.name.trim()||r.name.length>100||typeof r.expectedSha256!=='string'||! /^[a-f0-9]{64}$/.test(r.expectedSha256)))throw fail('RESULT_ARCHIVE_ARGUMENT_INVALID','Supply 1–8 absolute result paths, unique names, SHA-256 digests and an absolute outputPath');
 const outputPath=resolve(args.outputPath),sources=[],paths=new Set(),names=new Set(),identities=new Set();let totalBytes=0;
 const store=createCaseStore();
 for(const result of args.results){
  const path=resolve(result.path),real=await realSource(path),info=await statSource(path,{bigint:true}),identity=String(info.dev)+':'+String(info.ino);
  if(path===outputPath||paths.has(real)||identities.has(identity)||names.has(result.name.trim()))throw fail('RESULT_ARCHIVE_PATH_CONFLICT','Result paths, file identities, names and output must be distinct');
  if(!info.isFile()||info.size>RESULT_ARCHIVE_MAX_SOURCE_BYTES)throw fail('RESULT_ARCHIVE_TOO_LARGE','Result source must be a file within the byte limit');
  paths.add(real);identities.add(identity);names.add(result.name.trim());
  const bytes=Buffer.from(await readSource(path));totalBytes+=bytes.length;
  if(bytes.length>RESULT_ARCHIVE_MAX_SOURCE_BYTES||totalBytes>RESULT_ARCHIVE_MAX_TOTAL_BYTES)throw fail('RESULT_ARCHIVE_TOO_LARGE','Result sources exceed byte limits');
  if(sha(bytes)!==result.expectedSha256)throw fail('RESULT_ARCHIVE_SOURCE_CHANGED','Result source digest differs from expectedSha256');
  const output=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  prepareCaseView(store.add(result.name,output));
  sources.push({path,name:result.name,sha256:result.expectedSha256,bytes:bytes.length});
 }
 const archive=store.export();
 if(Buffer.byteLength(JSON.stringify(archive)+'\n')>RESULT_ARCHIVE_MAX_TOTAL_BYTES)throw fail('RESULT_ARCHIVE_TOO_LARGE','Generated archive exceeds 100000000 bytes including newline');
 // Check every source again after all validation and before atomic publication.
 for(const source of sources){const current=Buffer.from(await readSource(source.path));if(current.length!==source.bytes||sha(current)!==source.sha256)throw fail('RESULT_ARCHIVE_SOURCE_CHANGED','Result source changed during archive preparation');}
 const publication=await publishJson(outputPath,archive,{includeIntegrity:true});
 return {schemaVersion:1,archiveVersion:1,outputPath,caseCount:store.count(),sources,...publication,limitations:['Saved result inputs, provenance and runtime identities are preserved as supplied. No analysis was executed or runtime identity inferred.']};
}
