import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,parse,relative,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {identifyPrintedParameters} from '../src/printed-parameter-identification.js';
import {PRINTED_DATASET_LIMITS} from '../src/printed-measurement-dataset.js';
import {publishJson} from './json-artifacts.mjs';

export const PRINTED_IDENTIFICATION_FILE_LIMITS=Object.freeze({datasetBytes:PRINTED_DATASET_LIMITS.bytes,optionsBytes:16384,artifactBytes:524288,pathCharacters:4096,pathSegments:256});
const fail=code=>{throw Object.assign(Error(code),{code});};
const prefix='PRINTED_IDENTIFICATION_';
const safeCode=error=>typeof error?.code==='string'&&/^PRINTED_(?:IDENTIFICATION|DATASET)_[A-Z_]+$/.test(error.code)?error.code:prefix+'IO';
const key=path=>process.platform==='win32'?path.toLowerCase():path;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export function parsePrintedIdentificationArgs(args){
 const values={};
 if(!Array.isArray(args)||args.length!==6)fail(prefix+'CLI_ARGUMENTS');
 for(let i=0;i<args.length;i+=2){const flag=args[i],value=args[i+1];
  if(!['--dataset','--options','--output'].includes(flag)||Object.hasOwn(values,flag.slice(2))||typeof value!=='string')fail(prefix+'CLI_ARGUMENTS');
  values[flag.slice(2)]=value;
 }
 return snapshotPaths(values);
}
function snapshotPaths(value){
 if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==3)fail(prefix+'CLI_ARGUMENTS');
 const paths={};
 for(const name of ['dataset','options','output']){
  const d=Object.getOwnPropertyDescriptor(value,name),p=d?.value;
  if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof p!=='string'||!p.length||p.length>4096||p.includes('\0')||!isAbsolute(p))fail(prefix+'PATH');
  paths[name]=resolve(p);
 }
 if(new Set(Object.values(paths).map(key)).size!==3)fail(prefix+'PATH_ALIAS');
 return paths;
}
// Refuse symlink/junction components; publication uses the resolved physical parent afterwards.
async function noLinks(path){
 const root=parse(path).root,parts=relative(root,path).split(/[\\/]/).filter(Boolean);
 if(parts.length>PRINTED_IDENTIFICATION_FILE_LIMITS.pathSegments)fail(prefix+'PATH');
 let current=root;
 for(const part of parts){current=join(current,part);if((await lstat(current)).isSymbolicLink())fail(prefix+'SYMLINK');}
}
async function inputPath(path){
 await noLinks(path);const stat=await lstat(path,{bigint:true});
 if(!stat.isFile())fail(prefix+'REGULAR_FILE');
 return {path:await realpath(path),stat};
}
async function destinationPath(path){
 const parent=dirname(path);await noLinks(parent);if(!(await lstat(parent)).isDirectory())fail(prefix+'OUTPUT_PARENT');
 const destination=join(await realpath(parent),basename(path));
 try{await lstat(destination);fail(prefix+'OUTPUT_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
 return destination;
}
const sameFile=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
const unchanged=(a,b)=>sameFile(a,b)&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
async function boundedRead(source,limit){
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
// Identification options are a flat JSON object. Detect decoded duplicate keys before the existing pure gate.
function optionsJson(text){
 let at=0;const ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;},invalid=()=>fail(prefix+'OPTIONS_JSON');
 function string(){const start=at++;for(;at<text.length;at++){const c=text[at];if(c==='"'){at++;try{return JSON.parse(text.slice(start,at));}catch{invalid();}}if(c==='\\')at++;}invalid();}
 ws();if(text[at++]!=='{')invalid();const result=Object.create(null),seen=new Set();ws();
 if(text[at]!=='}')for(;;){
  ws();if(text[at]!=='"')invalid();const name=string();if(seen.has(name)||seen.size>=16)invalid();seen.add(name);ws();if(text[at++]!==':')invalid();ws();let value;
  if(text[at]==='"')value=string();else{const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)invalid();at+=m[0].length;value=JSON.parse(m[0]);if(typeof value==='number'&&!Number.isFinite(value))invalid();}
  result[name]=value;ws();if(text[at]==='}')break;if(text[at++]!==',')invalid();
 }
 if(text[at++]!=='}')invalid();ws();if(at!==text.length)invalid();return result;
}
function finiteJson(value){
 if(typeof value==='number')return Number.isFinite(value);
 if(value&&typeof value==='object')return Object.values(value).every(finiteJson);
 return value===null||typeof value==='boolean'||typeof value==='string';
}

export async function writePrintedIdentificationFiles(request){
 const paths=snapshotPaths(request),output=await destinationPath(paths.output);
 const sources=await Promise.all([inputPath(paths.dataset),inputPath(paths.options)]);
 if(sameFile(sources[0].stat,sources[1].stat)||new Set([...sources.map(s=>key(s.path)),key(output)]).size!==3)fail(prefix+'PATH_ALIAS');
 const inputs={dataset:null,options:null};let result=null,refusal=null;
 const reads=await Promise.allSettled(sources.map((source,i)=>boundedRead(source,i?PRINTED_IDENTIFICATION_FILE_LIMITS.optionsBytes:PRINTED_IDENTIFICATION_FILE_LIMITS.datasetBytes)));
 for(const [i,name]of ['dataset','options'].entries())inputs[name]=reads[i].status==='fulfilled'?reads[i].value.identity:reads[i].reason.identity??null;
 const failedRead=reads.find(r=>r.status==='rejected');
 if(failedRead)refusal={code:safeCode(failedRead.reason),stage:'read'};
 else try{
  const opts=optionsJson(reads[1].value.text);
  result=await identifyPrintedParameters(reads[0].value.text,opts);
  if(result.dataset.sourceSha256!==inputs.dataset.sha256){result=null;refusal={code:prefix+'INPUT_IDENTITY',stage:'identification'};}
  else if(!finiteJson(result)){result=null;refusal={code:prefix+'NONFINITE_RESULT',stage:'identification'};}
  else if(!result.identified)refusal={code:prefix+'FIT_REFUSED',stage:'fit'};
 }catch(error){refusal={code:safeCode(error),stage:'validation'};}
 const status=result?.identified===true?'identified':'refused';
 const artifact={schemaVersion:1,kind:'printed-parameter-identification-file',status,calibrated:false,accuracyVerified:false,inputs,result,refusal};
 if(Buffer.byteLength(JSON.stringify(artifact))+1>PRINTED_IDENTIFICATION_FILE_LIMITS.artifactBytes)fail(prefix+'ARTIFACT_LIMIT');
 let integrity;try{integrity=await publishJson(output,artifact,{includeIntegrity:true});}catch(error){if(error.code==='EEXIST')fail(prefix+'OUTPUT_EXISTS');throw error;}
 return {schemaVersion:1,kind:'printed-identification-cli-summary',status,identified:result?.identified===true,calibrated:false,accuracyVerified:false,output,...integrity,...(refusal?{refusalCode:refusal.code}:{})};
}

export function printedIdentificationCliError(error){return {schemaVersion:1,kind:'printed-identification-cli-summary',status:'error',code:safeCode(error)};}
