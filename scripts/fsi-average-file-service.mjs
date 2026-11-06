import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {publishJson} from './json-artifacts.mjs';
import {printedAbsolutePath,printedPathKey,preparePrintedInputPath,preparePrintedOutputPath,readPrintedInputSnapshot} from './printed-identification-file-io.mjs';

export const FSI_AVERAGE_FILE_LIMITS=Object.freeze({requestBytes:65536,artifactBytes:4194304,timeoutMs:120000,resultValues:200000});
const prefix='FSI_AVERAGE_FILE_',failure=code=>Object.assign(Error(code),{code}),fail=code=>{throw failure(code);};
const safeCode=e=>typeof e?.code==='string'&&/^(?:FSI_AVERAGE(?:_FILE)?|PRINTED_IDENTIFICATION)_[A-Z0-9_]+$/.test(e.code)?e.code:prefix+'IO';
const hash=b=>createHash('sha256').update(b).digest('hex');
const abortedGetter=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get;
export function fsiAbortRequested(signal){if(signal===undefined)return false;try{return abortedGetter.call(signal);}catch{fail(prefix+'ARGUMENTS');}}
function record(o,keys,required=keys){
 if(!o||![Object.prototype,null].includes(Object.getPrototypeOf(o)))fail(prefix+'ARGUMENTS');
 const own=Reflect.ownKeys(o);if(own.length>keys.length||own.some(k=>!keys.includes(k))||required.some(k=>!Object.hasOwn(o,k)))fail(prefix+'ARGUMENTS');
 const p={};for(const k of own){const d=Object.getOwnPropertyDescriptor(o,k);if(!d.enumerable||!Object.hasOwn(d,'value'))fail(prefix+'ARGUMENTS');p[k]=d.value;}return p;
}
function pathsSnapshot(o){const p=record(o,['request','output']);for(const k of ['request','output'])p[k]=printedAbsolutePath(p[k]);if(printedPathKey(p.request)===printedPathKey(p.output))fail(prefix+'PATH_ALIAS');return p;}
export function parseFsiAverageArgs(args){
 if(!Array.isArray(args)||args.length!==4)fail(prefix+'ARGUMENTS');const p={};for(let i=0;i<4;i+=2){if(!['--request','--output'].includes(args[i])||Object.hasOwn(p,args[i].slice(2)))fail(prefix+'ARGUMENTS');p[args[i].slice(2)]=args[i+1];}return pathsSnapshot(p);
}
// Bounded JSON parser with decoded-key uniqueness. Ordinary own data records are
// created without invoking __proto__ setters, as required by the pure input gate.
function parseRequest(text){
 let at=0,count=0;const invalid=()=>fail(prefix+'JSON'),ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){if(text[at]==='"'){at++;try{const s=JSON.parse(text.slice(start,at));if(s.length>256)invalid();return s;}catch{invalid();}}if(text[at]==='\\')at++;}invalid();}
 function value(depth){
  if(depth>6||++count>2048)invalid();ws();const c=text[at];if(c==='"')return string();
  if(c==='{'||c==='['){const obj=c==='{',out=obj?{}:[],seen=new Set();at++;ws();if(text[at]===(obj?'}':']')){at++;return out;}
   for(;;){ws();if(obj){if(text[at]!=='"')invalid();const key=string();if(seen.has(key)||seen.size>=16)invalid();seen.add(key);ws();if(text[at++]!==':')invalid();Object.defineProperty(out,key,{enumerable:true,configurable:true,writable:true,value:value(depth+1)});}else{if(out.length>=512)invalid();out.push(value(depth+1));}ws();if(text[at]===(obj?'}':']')){at++;return out;}if(text[at++]!==',')invalid();}
  }
  const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)invalid();at+=m[0].length;const v=JSON.parse(m[0]);if(typeof v==='number'&&!Number.isFinite(v))invalid();return v;
 }
 const valueRead=value(0);ws();if(at!==text.length)invalid();return valueRead;
}
function finiteJson(root){
 let count=0;function walk(v,depth){if(++count>FSI_AVERAGE_FILE_LIMITS.resultValues||depth>12)fail(prefix+'RESULT');if(v===null||typeof v==='boolean'||typeof v==='string')return;if(typeof v==='number'){if(!Number.isFinite(v))fail(prefix+'RESULT');return;}
  if(!v||typeof v!=='object'||![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)))fail(prefix+'RESULT');
  if(Array.isArray(v)){const length=Object.getOwnPropertyDescriptor(v,'length')?.value;if(!Number.isSafeInteger(length)||length>5000||Reflect.ownKeys(v).length!==length+1)fail(prefix+'RESULT');for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail(prefix+'RESULT');walk(d.value,depth+1);}return;}
  for(const k of Reflect.ownKeys(v)){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))fail(prefix+'RESULT');walk(d.value,depth+1);}
 }walk(root,0);
}
const canonical=o=>JSON.stringify(o&&typeof o==='object'?Array.isArray(o)?o.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(o).sort().map(k=>[k,JSON.parse(canonical(o[k]))])):o);
function validateResult(result,input){
 finiteJson(result);
 if(result?.schemaVersion!==1||result.method!=='time-averaged-midpoint'||result.synthetic!==true||result.calibrated!==false||!Array.isArray(result.profile)||result.profile.length!==input.fluid?.cellsY||!Array.isArray(result.history)||result.history.length!==input.steps+1||!Number.isSafeInteger(result.work?.cellStepsUpperBound)||result.work.cellStepsUpperBound<1||result.work.cellStepsUpperBound>2000000||result.work?.responseSolves!==3*input.steps*input.microsteps||!Number.isFinite(result.initialEnergy)||result.initialEnergy<0||!Number.isFinite(result.maxXSpread)||result.maxXSpread<0)fail(prefix+'RESULT');
 const base=['t','d','v','fluidEnergy','plateEnergy','dissipated','interfaceWork','energyDefectJPerM2','energyDefect'],step=['wallVelocity','forceOnPlate','forceOnFluid','interfaceImpulse','bottomImpulse','stepDissipated','stepInterfaceWork','fluidEnergyDefectJPerM2','plateEnergyDefectJPerM2','momentumDefectKgPerMS','forceResidualPa','scaledForceResidual'];
 if(result.profile.some(v=>typeof v!=='number'||!Number.isFinite(v))||result.history.some((h,i)=>[...base,...(i?step:[])].some(k=>!Number.isFinite(h?.[k]))))fail(prefix+'RESULT');
 const expected={...input,fluid:{...input.fluid,cellsX:input.fluid.cellsX??4,length:input.fluid.length??input.fluid.height},initialProfile:input.initialProfile??new Array(input.fluid.cellsY).fill(0)};
 if(canonical(expected)!==canonical(result.input)||result.history.some((h,i)=>h.t!==i*input.dt))fail(prefix+'RESULT');
 return result;
}
function runtimeOptions(value){
 const o=record(value,['signal','timeoutMs'],[]),timeoutMs=o.timeoutMs??FSI_AVERAGE_FILE_LIMITS.timeoutMs;
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>FSI_AVERAGE_FILE_LIMITS.timeoutMs)fail(prefix+'ARGUMENTS');
 fsiAbortRequested(o.signal);return {signal:o.signal,timeoutMs};
}
async function execute(input,options,createWorker){
 const {signal,timeoutMs}=options;if(fsiAbortRequested(signal))fail(prefix+'CANCELLED');
 let worker,exited=false,exitCode=null,message=null,hasMessage=false,settled=false,timer,resolveExit;const exit=new Promise(resolve=>resolveExit=resolve);
 let rejectOutcome;const abort=()=>rejectOutcome(failure(prefix+'CANCELLED'));
 try{
  const outcome=new Promise((resolve,reject)=>{
   rejectOutcome=e=>{if(!settled){settled=true;reject(e);}};
   worker=createWorker(new URL('./fsi-average-worker.mjs',import.meta.url),{workerData:input,execArgv:[],stdout:true,stderr:true,resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
   let stdoutEnded=!worker.stdout,stderrEnded=!worker.stderr;
   const finish=()=>{if(settled||!exited||!stdoutEnded||!stderrEnded)return;settled=true;
    if(exitCode!==0||!message||!['completed','failed'].includes(message.type))reject(failure(prefix+'WORKER_EXIT'));
    else if(message.type==='failed')reject(failure(/^FSI_AVERAGE_[A-Z0-9_]+$/.test(message.code)?message.code:prefix+'COMPUTE'));
    else resolve(message.result);
   };
   for(const role of ['stdout','stderr'])if(worker[role]){const stream=worker[role];stream.on('data',chunk=>{if(chunk.length)rejectOutcome(failure(prefix+'WORKER_OUTPUT'));});stream.once('error',()=>rejectOutcome(failure(prefix+'WORKER_OUTPUT')));stream.once('end',()=>{if(role==='stdout')stdoutEnded=true;else stderrEnded=true;finish();});}
   worker.on('message',value=>{if(settled)return;if(hasMessage){rejectOutcome(failure(prefix+'PROTOCOL'));return;}hasMessage=true;message=value;});
   worker.once('error',()=>rejectOutcome(failure(prefix+'WORKER')));
   worker.once('exit',code=>{exited=true;exitCode=code;resolveExit();finish();});
   timer=setTimeout(()=>rejectOutcome(failure(prefix+'TIMEOUT')),timeoutMs);if(signal)EventTarget.prototype.addEventListener.call(signal,'abort',abort,{once:true});if(fsiAbortRequested(signal))abort();
  });
  const result=await outcome;return {result,worker:{executionSettled:true,exitCode}};
 }finally{
  clearTimeout(timer);if(signal)EventTarget.prototype.removeEventListener.call(signal,'abort',abort);
  // A result message is not release: normal completion waits for exit; cancellation
  // and errors await owned termination AND the exit event before returning.
  if(worker&&!exited){await worker.terminate();await exit;}
 }
}
/** Shared immutable-text worker boundary. Third argument is a private host test seam. */
export async function runFsiAverageConfiguration(rawConfiguration,options={},dependencies={}){
 if(typeof rawConfiguration!=='string'||rawConfiguration.length>FSI_AVERAGE_FILE_LIMITS.requestBytes||Buffer.byteLength(rawConfiguration)>FSI_AVERAGE_FILE_LIMITS.requestBytes)fail(prefix+'JSON');
 const runtime=runtimeOptions(options),input=parseRequest(rawConfiguration),completed=await execute(input,runtime,dependencies.createWorker??((url,opts)=>new Worker(url,opts)));
 if(fsiAbortRequested(runtime.signal))fail(prefix+'CANCELLED');validateResult(completed.result,input);return completed;
}
/** Third-argument worker factory is a private host test seam, never a file/CLI option. */
export async function writeFsiAverageFiles(request,options={},dependencies={}){
 const paths=pathsSnapshot(request),runtime=runtimeOptions(options);if(fsiAbortRequested(runtime.signal))fail(prefix+'CANCELLED');
 const output=await preparePrintedOutputPath(paths.output),source=await preparePrintedInputPath(paths.request);
 if(printedPathKey(source.path)===printedPathKey(output))fail(prefix+'PATH_ALIAS');
 let identity;
 try{
  const snapshot=await readPrintedInputSnapshot(source,FSI_AVERAGE_FILE_LIMITS.requestBytes);identity=snapshot.identity;
  const completed=await runFsiAverageConfiguration(snapshot.text,runtime,dependencies),result=completed.result,input=result.input;
  const artifact={schemaVersion:1,kind:'fsi-average-force-file',methodVersion:1,synthetic:true,calibrated:false,source:identity,configurationSha256:hash(canonical(result.input)),profileRepresentation:'finite-number-array-m/s',worker:completed.worker,result};
  if(Buffer.byteLength(JSON.stringify(artifact))+1>FSI_AVERAGE_FILE_LIMITS.artifactBytes)fail(prefix+'ARTIFACT_LIMIT');
  if(fsiAbortRequested(runtime.signal))fail(prefix+'CANCELLED');let integrity;
  // Publication is the commit point. A later abort does not undo a complete artifact.
  try{const published=await publishJson(output,artifact,{includeIntegrity:true});integrity={outputBytes:published.outputBytes,outputSha256:published.outputSha256,...(published.cleanupWarning?{cleanupWarning:{code:'ARTIFACT_TEMP_CLEANUP_FAILED'}}:{})};}catch(e){if(e.code==='EEXIST')fail(prefix+'OUTPUT_EXISTS');throw e;}
  const last=result.history.at(-1);return {schemaVersion:1,kind:'fsi-average-file-summary',status:'completed',methodVersion:1,synthetic:true,calibrated:false,source:identity,configurationSha256:artifact.configurationSha256,output,...integrity,worker:completed.worker,steps:input.steps,final:{timeSeconds:last.t,displacementM:last.d,velocityMPerS:last.v,energyDefectJPerM2:last.energyDefectJPerM2,relativeEnergyDefect:last.energyDefect},work:result.work};
 }catch(e){const known=identity??(e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'identity')?.value:undefined);if(known&&e&&typeof e==='object')e.requestIdentity=known;throw e;}
}
export function fsiAverageCliError(e){return {schemaVersion:1,kind:'fsi-average-file-summary',status:'error',code:safeCode(e),...(e?.requestIdentity?{source:e.requestIdentity}:{})};}
