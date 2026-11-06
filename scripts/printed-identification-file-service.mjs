import {isAbsolute,resolve} from 'node:path';
import {identifyPrintedParameters} from '../src/printed-parameter-identification.js';
import {PRINTED_DATASET_LIMITS} from '../src/printed-measurement-dataset.js';
import {publishJson} from './json-artifacts.mjs';
import {printedPathKey,preparePrintedInputPath as inputPath,preparePrintedOutputPath as destinationPath,samePrintedFile as sameFile,readPrintedInputSnapshot as boundedRead} from './printed-identification-file-io.mjs';

export const PRINTED_IDENTIFICATION_FILE_LIMITS=Object.freeze({datasetBytes:PRINTED_DATASET_LIMITS.bytes,optionsBytes:16384,artifactBytes:524288,pathCharacters:4096,pathSegments:256});
const fail=code=>{throw Object.assign(Error(code),{code});};
const prefix='PRINTED_IDENTIFICATION_';
const safeCode=error=>typeof error?.code==='string'&&/^PRINTED_(?:IDENTIFICATION|DATASET)_[A-Z_]+$/.test(error.code)?error.code:prefix+'IO';
const key=printedPathKey;

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

/** Internal shared evaluation of private bounded file snapshots; performs no filesystem writes. */
export async function evaluatePrintedIdentificationSnapshots(dataset,options){
 let result=null,refusal=null;
 try{
  const opts=optionsJson(options.text);
  result=await identifyPrintedParameters(dataset.text,opts);
  if(result.dataset.sourceSha256!==dataset.identity.sha256){result=null;refusal={code:prefix+'INPUT_IDENTITY',stage:'identification'};}
  else if(!finiteJson(result)){result=null;refusal={code:prefix+'NONFINITE_RESULT',stage:'identification'};}
  else if(!result.identified)refusal={code:prefix+'FIT_REFUSED',stage:'fit'};
 }catch(error){refusal={code:safeCode(error),stage:'validation'};}
 return {result,refusal};
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
 else ({result,refusal}=await evaluatePrintedIdentificationSnapshots(reads[0].value,reads[1].value));
 const status=result?.identified===true?'identified':'refused';
 const artifact={schemaVersion:1,kind:'printed-parameter-identification-file',status,calibrated:false,accuracyVerified:false,inputs,result,refusal};
 if(Buffer.byteLength(JSON.stringify(artifact))+1>PRINTED_IDENTIFICATION_FILE_LIMITS.artifactBytes)fail(prefix+'ARTIFACT_LIMIT');
 let integrity;try{integrity=await publishJson(output,artifact,{includeIntegrity:true});}catch(error){if(error.code==='EEXIST')fail(prefix+'OUTPUT_EXISTS');throw error;}
 return {schemaVersion:1,kind:'printed-identification-cli-summary',status,identified:result?.identified===true,calibrated:false,accuracyVerified:false,output,...integrity,...(refusal?{refusalCode:refusal.code}:{})};
}

export function printedIdentificationCliError(error){return {schemaVersion:1,kind:'printed-identification-cli-summary',status:'error',code:safeCode(error)};}
