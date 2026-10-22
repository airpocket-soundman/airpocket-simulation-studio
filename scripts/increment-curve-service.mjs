import {createHash} from 'node:crypto';
import {open,lstat} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {publishJson} from './json-artifacts.mjs';

export const INCREMENT_CURVE_MCP_LIMITS=Object.freeze({inputBytes:1048576,responseBytes:65536,artifactBytes:2097152,bundleBytes:8388608,rows:50});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw Error(message);};
const absolute=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&isAbsolute(value);

// A bounded saved-file adapter. It never executes analysis, changes a browser,
// or accepts filesystem paths from the physical bundle itself.
// Optional publisher is a private host test seam, never an MCP argument.
export async function readIncrementCurve(args={}, {publish=publishJson}={}){
 if(!args||typeof args!=='object'||Array.isArray(args)||Reflect.ownKeys(args).some(key=>!['path','outputPath','offset','limit'].includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value')))fail('Invalid increment curve arguments');
 const {offset=0,limit=20}=args;
 if(!absolute(args.path)||args.outputPath!==undefined&&!absolute(args.outputPath)||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>INCREMENT_CURVE_MCP_LIMITS.rows)fail('Use absolute increment curve paths and bounded offset/limit');
 const inputPath=resolve(args.path),outputPath=args.outputPath===undefined?undefined:resolve(args.outputPath);
 if(outputPath){
  if(inputPath.toLowerCase()===outputPath.toLowerCase())fail('Increment curve output must be distinct from input');
  try{await lstat(outputPath);fail('Increment curve output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 const handle=await open(inputPath,'r');let bytes;
 try{
  const info=await handle.stat();if(!info.isFile()||info.size>INCREMENT_CURVE_MCP_LIMITS.inputBytes)fail('Increment curve input must be a regular file within 1 MiB');
  const buffer=Buffer.alloc(INCREMENT_CURVE_MCP_LIMITS.inputBytes+1);let length=0;
  while(length<buffer.length){const read=await handle.read(buffer,length,buffer.length-length,length);if(!read.bytesRead)break;length+=read.bytesRead;}
  if(length>INCREMENT_CURVE_MCP_LIMITS.inputBytes)fail('Increment curve input exceeds 1 MiB');bytes=buffer.subarray(0,length);
 }finally{await handle.close();}
 const bundle=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 const {createIncrementCurveArtifacts}=await import('../src/increment-curve-export.js');
 const artifacts=await createIncrementCurveArtifacts(bundle),{steps,...curve}=artifacts.curve;
 if(!Array.isArray(steps)||offset>steps.length)fail('Increment curve offset exceeds available rows');
 const descriptors={};
 for(const format of ['csv','json','svg']){
  if(typeof artifacts[format]!=='string')fail('Invalid increment curve artifact');
  const content=Buffer.from(artifacts[format],'utf8');if(content.length>INCREMENT_CURVE_MCP_LIMITS.artifactBytes)fail('Increment curve artifact exceeds 2 MiB');
  descriptors[format]={bytes:content.length,sha256:hash(content),encoding:'utf-8'};
 }
 const result={schemaVersion:1,kind:'increment-curve',source:{path:inputPath,bytes:bytes.length,sha256:hash(bytes),meaning:'raw-utf8-input-snapshot'},curve,page:{offset,limit,total:steps.length,nextOffset:offset+limit<steps.length?offset+limit:null,steps:steps.slice(offset,offset+limit)},artifacts:descriptors,limits:INCREMENT_CURVE_MCP_LIMITS,limitations:['Independent force-controlled linear solves only; not a plastic load/unload history or physical validation.','No browser state is read or changed. Artifact strings are retained only in an explicitly requested output bundle.']};
 if(outputPath)result.outputPath=outputPath;
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>INCREMENT_CURVE_MCP_LIMITS.responseBytes-2048)fail('Increment curve response exceeds its byte bound; request fewer rows');
 if(outputPath){
  const publication={schemaVersion:1,kind:'increment-curve-artifacts',source:result.source,...artifacts};
  if(Buffer.byteLength(JSON.stringify(publication)+'\n','utf8')>INCREMENT_CURVE_MCP_LIMITS.bundleBytes)fail('Increment curve output bundle exceeds its byte bound');
  const saved=await publish(outputPath,publication,{includeIntegrity:true});
  result.outputBytes=saved.outputBytes;result.outputSha256=saved.outputSha256;
  if(saved.cleanupWarning){
   const path=String(saved.cleanupWarning.path??''),message=String(saved.cleanupWarning.message??'');
   result.cleanupWarning={code:'ARTIFACT_TEMP_CLEANUP_FAILED',message:message.slice(0,128),...(path.length<=128?{path}:{pathPreview:path.slice(0,128),pathOmitted:true}),detailsTruncated:message.length>128||path.length>128};
   // Publication already succeeded: omit warning detail rather than turning a
   // complete publication into a failure or returning an oversized response.
   if(Buffer.byteLength(JSON.stringify(result),'utf8')>INCREMENT_CURVE_MCP_LIMITS.responseBytes)result.cleanupWarning={code:'ARTIFACT_TEMP_CLEANUP_FAILED',message:'Cleanup warning details omitted to preserve the response bound.',detailsTruncated:true};
  }
 }
 return result;
}
