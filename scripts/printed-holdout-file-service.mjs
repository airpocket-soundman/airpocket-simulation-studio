import {comparePrintedHoldoutPrediction} from '../src/printed-parameter-holdout.js';
import {publishJson} from './json-artifacts.mjs';
import {printedAbsolutePath,printedPathKey,preparePrintedInputPath,preparePrintedOutputPath,samePrintedFile,readPrintedInputSnapshot} from './printed-identification-file-io.mjs';

export const PRINTED_HOLDOUT_FILE_LIMITS=Object.freeze({requestBytes:65536,datasetBytes:2000000,artifactBytes:4194304});
const prefix='PRINTED_HOLDOUT_FILE_',fail=code=>{throw Object.assign(Error(code),{code});};
const exact=(o,keys)=>o&&[Object.prototype,null].includes(Object.getPrototypeOf(o))&&Reflect.ownKeys(o).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const safeCode=e=>typeof e?.code==='string'&&/^PRINTED_(?:HOLDOUT(?:_FILE)?|IDENTIFICATION|DATASET)_[A-Z_]+$/.test(e.code)?e.code:prefix+'IO';
export function printedHoldoutCliError(error){return{schemaVersion:1,kind:'printed-holdout-cli-summary',status:'error',code:safeCode(error)};}
function pathsSnapshot(value){
 if(!exact(value,['request','output']))fail(prefix+'ARGUMENTS');
 const p={request:printedAbsolutePath(value.request),output:printedAbsolutePath(value.output)};
 if(printedPathKey(p.request)===printedPathKey(p.output))fail(prefix+'PATH_ALIAS');return p;
}
export function parsePrintedHoldoutArgs(args){
 if(!Array.isArray(args)||args.length!==4)fail(prefix+'ARGUMENTS');const p={};
 for(let i=0;i<4;i+=2){if(!['--request','--output'].includes(args[i])||Object.hasOwn(p,args[i].slice(2)))fail(prefix+'ARGUMENTS');p[args[i].slice(2)]=args[i+1];}
 return pathsSnapshot(p);
}
// Parse bounded configuration before allocating nested records; reject decoded duplicate keys.
function configuration(text){
 let at=0,count=0;const invalid=()=>fail(prefix+'REQUEST_INVALID'),ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){if(text[at]==='"'){at++;try{return JSON.parse(text.slice(start,at));}catch{invalid();}}if(text[at]==='\\')at++;}invalid();}
 function value(depth){
  if(depth>8||++count>2048)invalid();ws();const c=text[at];if(c==='"')return string();
  if(c==='{'||c==='['){const object=c==='{',result=object?Object.create(null):[],seen=new Set();at++;ws();if(text[at]===(object?'}':']')){at++;return result;}
   for(;;){ws();if(object){if(text[at]!=='"')invalid();const k=string();if(seen.has(k)||seen.size>=16)invalid();seen.add(k);ws();if(text[at++]!==':')invalid();result[k]=value(depth+1);}else{if(result.length>=100)invalid();result.push(value(depth+1));}ws();if(text[at]===(object?'}':']')){at++;return result;}if(text[at++]!==',')invalid();}
  }
  const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)invalid();at+=m[0].length;const n=JSON.parse(m[0]);if(typeof n==='number'&&!Number.isFinite(n))invalid();return n;
 }
 const c=value(0);ws();if(at!==text.length||!exact(c,['schemaVersion','training','validation','options','specimenPairs'])||c.schemaVersion!==1)invalid();
 for(const role of ['training','validation']){if(!exact(c[role],['path','expectedSHA256'])||typeof c[role].expectedSHA256!=='string'||!/^[a-f0-9]{64}$/.test(c[role].expectedSHA256))invalid();c[role].path=printedAbsolutePath(c[role].path);}
 return c;
}
const finiteJson=v=>typeof v==='number'?Number.isFinite(v):v&&typeof v==='object'?Object.values(v).every(finiteJson):v===null||['string','boolean'].includes(typeof v);
export async function writePrintedHoldoutFiles(request){
 const paths=pathsSnapshot(request),output=await preparePrintedOutputPath(paths.output),source=await preparePrintedInputPath(paths.request);
 const inputs={request:null,training:null,validation:null};let result=null,refusal=null,c;
 try{const snap=await readPrintedInputSnapshot(source,65536);inputs.request=snap.identity;c=configuration(snap.text);}catch(e){inputs.request=e.identity??inputs.request;refusal={code:safeCode(e),stage:'request'};}
 if(!refusal){
  const sources=await Promise.all(['training','validation'].map(role=>preparePrintedInputPath(c[role].path)));
  if(samePrintedFile(sources[0].stat,sources[1].stat)||sources.some(s=>samePrintedFile(s.stat,source.stat))||new Set([source.path,output,...sources.map(s=>s.path)].map(printedPathKey)).size!==4)fail(prefix+'PATH_ALIAS');
  const reads=await Promise.allSettled(sources.map(s=>readPrintedInputSnapshot(s,2000000)));
  for(const [i,role]of ['training','validation'].entries()){const r=reads[i];inputs[role]=r.status==='fulfilled'?r.value.identity:r.reason.identity??null;if(r.status==='rejected')refusal??={code:safeCode(r.reason),stage:'read'};else if(r.value.identity.sha256!==c[role].expectedSHA256)refusal??={code:prefix+'SHA_MISMATCH',stage:'identity'};}
  if(!refusal)try{
   result=await comparePrintedHoldoutPrediction({rawTraining:reads[0].value.text,rawValidation:reads[1].value.text,options:c.options,specimenPairs:c.specimenPairs});
   if(result.training.sourceSha256!==inputs.training.sha256||result.validation.sourceSha256!==inputs.validation.sha256||!finiteJson(result)){result=null;refusal={code:prefix+'RESULT_IDENTITY',stage:'comparison'};}
   else if(result.summary.refused)refusal={code:prefix+'PAIR_REFUSED',stage:'comparison'};
  }catch(e){refusal={code:safeCode(e),stage:'comparison'};}
 }
 const status=refusal?'refused':'compared',artifact={schemaVersion:1,kind:'printed-holdout-file',status,calibrated:false,accuracyVerified:false,physicalIndependenceVerified:false,inputs,result,refusal};
 if(Buffer.byteLength(JSON.stringify(artifact))+1>4194304)fail(prefix+'ARTIFACT_LIMIT');
 let integrity;try{integrity=await publishJson(output,artifact,{includeIntegrity:true});}catch(e){if(e.code==='EEXIST')fail(prefix+'OUTPUT_EXISTS');throw e;}
 return{schemaVersion:1,kind:'printed-holdout-cli-summary',status,calibrated:false,accuracyVerified:false,physicalIndependenceVerified:false,output,...integrity,...(refusal?{refusalCode:refusal.code}:{})};
}
