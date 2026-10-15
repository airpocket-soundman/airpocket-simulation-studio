import {createJobObservationQueue,validateObservationQueueLimits,observationQueueDefaults} from './job-observation-queue.js';
import {createRuntimeIdentity,validateRuntimeIdentity} from './runtime-identity.js';
import {restoreAnalysisError,getAnalysisFailure} from './analysis-failure.js';
import {requireAnalysisPreflight} from './analysis-preflight.js';
import {requireResolvedCadConditions} from './cad-update-state.js';
import {createAnalysisJobs} from './analysis-jobs.js';
import {createBrowserIntermediateStore} from './browser-intermediate-store.js';
export function createAnalysisClient(getProject,onProgress=()=>{},runtime={}){
 validateObservationQueueLimits(runtime.maxPendingObservationEvents===undefined?observationQueueDefaults.maxEvents:runtime.maxPendingObservationEvents,runtime.maxPendingObservationBytes===undefined?observationQueueDefaults.maxBytes:runtime.maxPendingObservationBytes);
 const hostDescriptor=Object.getOwnPropertyDescriptor(runtime,'identityHost');
 const host=hostDescriptor?hostDescriptor.value:{target:'browser',isolation:'web-worker'};
 if(hostDescriptor&&!Object.hasOwn(hostDescriptor,'value')||!host||typeof host!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(host))||Reflect.ownKeys(host).length!==2||Reflect.ownKeys(host).some(key=>!['target','isolation'].includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(host,key),'value')))throw TypeError('Invalid runtime identity host');
 const identityHost=createRuntimeIdentity({target:host.target,isolation:host.isolation});
 const createWorker=runtime.createWorker||(()=>new Worker(new URL('./analysis.worker.js',import.meta.url),{type:'module'}));
 const isIsolated=runtime.isIsolated||(()=>globalThis.crossOriginIsolated);
 const baseUrl=runtime.baseUrl||(()=>{throw new Error('analysis client requires runtime.baseUrl (a function returning the asset base URL)');}),timeoutMs=runtime.timeoutMs??120000;
 let active=null;
 function finish(job,error,result){
  if(active!==job||job.finishing)return;job.finishing=true;clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.abort);
  const settle=(failure)=>{if(active===job)active=null;try{if(failure){job.reject(failure);return;}try{const identity=result?.runtimeIdentity===undefined?undefined:validateRuntimeIdentity(result.runtimeIdentity);if(identity&&(identity.target!==identityHost.target||identity.isolation!==identityHost.isolation))throw Error('Worker runtime identity host mismatch');const cleanResult=Object.fromEntries(Object.entries(result).filter(([key])=>key!=='runtimeIdentity'));job.resolve({...cleanResult,...(result.result?{result:{...result.result,analysisAssessment:job.analysisAssessment}}:{}),analysisAssessment:job.analysisAssessment,input:job.project,calculation:{operation:job.operation,options:job.options,...(identity?{runtimeIdentity:identity}:{})}});}catch(cause){job.reject(cause);}}finally{job.markSettled();}};
  const cleanupFailed=cause=>{const failure=cause instanceof Error?cause:new Error('Worker cleanup failed: '+String(cause),{cause});settle(error?new AggregateError([error,failure],'Analysis failed: '+(error?.message??String(error))+'; Worker cleanup failed: '+failure.message):failure);};
  let termination;try{termination=job.worker.terminate();}catch(cause){cleanupFailed(cause);return;}
  // Native browser terminate returns void; host adapters may return a cleanup promise.
  Promise.resolve(termination).then(()=>settle(error),cleanupFailed);
 }
 function start(operation,options={},snapshot,onEvent,signal,jobId,observeFields=false,reportProgress=true){
 if(active)return Promise.reject(Error('A calculation is already running'));
 let project,settings,analysisAssessment;try{if(signal?.aborted)throw Error('Calculation cancelled');project=structuredClone(snapshot??getProject());if(operation!=='mesh')requireResolvedCadConditions(project);settings=structuredClone({size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options});if(!project.sourceModel)throw Error('Reload a STEP file or use the built-in sample; this project has no original solid');if(!isIsolated())throw Error('Browser isolation is not ready. Reload once, or use a compatible browser.');analysisAssessment=requireAnalysisPreflight(project,settings,{target:identityHost.target,operation:operation==='mesh'?'mesh':'solve'});}catch(e){return Promise.reject(e);}
 return new Promise((resolve,reject)=>{let worker;try{worker=createWorker();}catch(e){reject(e);return;}let markSettled;const settled=new Promise(done=>{markSettled=done;});const job={worker,project,operation,options:settings,resolve,reject,signal,jobId,analysisAssessment,settled,markSettled};active=job;
 if(!jobId)job.timer=setTimeout(()=>finish(job,Error(`Calculation exceeded ${timeoutMs/1000} seconds`)),timeoutMs);
 job.abort=()=>finish(job,Error('Calculation cancelled'));signal?.addEventListener('abort',job.abort,{once:true});
 worker.onerror=e=>finish(job,Error(e.message||'Worker failed'));
   worker.onmessage=({data})=>{if(active!==job||job.finishing)return;try{if(data.event){if(data.event.stage==='diagnostic'){const failure=getAnalysisFailure({analysisFailure:data.event.failure});if(failure)onEvent?.({stage:'diagnostic',failure,converged:false,provisional:true});}else onEvent?.(data.event);if(Number.isSafeInteger(data.observationAckId)&&active===job&&!job.finishing)worker.postMessage({type:'analysis-observation-ack-v1',id:data.observationAckId});return;}if(data.progress){if(reportProgress)onProgress(data.progress);onEvent?.({stage:'progress',message:data.progress,provisional:true});return;}finish(job,data.error?restoreAnalysisError(data.error,data.failure):null,data.result);}catch(error){finish(job,error);}};
 if(signal?.aborted){job.abort();return;}
 try{worker.postMessage({operation,project,source:project.sourceModel,options:structuredClone(job.options),base:baseUrl(),observe:!!onEvent,observeFields,...(typeof onEvent==='function'?{observationTransportProtocol:1}:{})});}catch(e){finish(job,e);}
 });
 }
 const results=new Map(),artifacts=createBrowserIntermediateStore({maxBytes:runtime.maxIntermediateBytes??64_000_000});
 const jobs=createAnalysisJobs({timeoutMs,execute:async({project,options,operation,jobId,signal,onEvent,context,inputRevision})=>{
  let reportedLimit=false;
  const emitObservation=(event,retained)=>{
   const {mesh,field,...summary}=event;
   if(retained?.limited&&!reportedLimit){reportedLimit=true;onEvent({stage:'observation-limit',provisional:true,message:'Browser intermediate storage limit reached; summaries continue',limitBytes:retained.limitBytes});}
   onEvent({...summary,...(retained?.artifact?{artifact:retained.artifact}:{}),...(field?{fieldSummary:{kind:field.kind,...(field.time!==undefined?{time:field.time}:{}),...(field.step!==undefined?{solver:field.solver,step:field.step,steps:field.steps,loadFactor:field.loadFactor}:{}),nodeCount:field.displacement?field.displacement.length/3:field.temperature?.length??field.pressure?.length},fieldAvailable:!!retained?.artifact}:{}),...(mesh?{meshAvailable:!!retained?.artifact}:{})});
  };
  const queue=createJobObservationQueue({maxEvents:runtime.maxPendingObservationEvents===undefined?observationQueueDefaults.maxEvents:runtime.maxPendingObservationEvents,maxBytes:runtime.maxPendingObservationBytes===undefined?observationQueueDefaults.maxBytes:runtime.maxPendingObservationBytes,isActive:()=>!signal.aborted,
   consume:async(event,metadata)=>{let retained;try{retained=await artifacts.capture(jobId,inputRevision,event,()=>!signal.aborted);}catch(error){if(!signal.aborted)onEvent({stage:'observation-error',provisional:true,message:error.message,...metadata});}if(!signal.aborted)emitObservation({...event,...metadata},retained);},
   onSummary:(event,metadata)=>emitObservation({...event,...metadata}),
   onDrop:(event,metadata)=>{onEvent({stage:'observation-queue-limit',provisional:true,observationQueue:metadata});emitObservation({...event,observationSequence:metadata.observationSequence,observationQueue:{dropped:true,reason:metadata.reason}});}
  });
  const closeQueue=()=>queue.close();signal.addEventListener('abort',closeQueue,{once:true});
  const observe=event=>{if(!context.includeFields){emitObservation(event);return;}queue.push(event);};
  try{const output=await start(operation,options,project,observe,signal,jobId,context.includeFields,context.origin==='gui');await queue.drain();if(signal.aborted)throw Error('Calculation cancelled');results.set(jobId,output);return {kind:output.result?.kind,mesh:output.mesh?.summary,resultAvailable:true,analysisAssessment:output.analysisAssessment,intermediate:{...artifacts.summary(jobId),queue:queue.snapshot()}};}finally{queue.close();await queue.drain();signal.removeEventListener('abort',closeQueue);}
 }});
 return {generateMesh:options=>start('mesh',options),analyze:options=>start('elastic',options),cancel:()=>{if(active?.jobId)jobs.cancel(active.jobId);else if(active)finish(active,Error('Calculation cancelled'));},
  startJob({operation='solve',options={},inputRevision,requestId,includeFields=false,origin='api'}={}){if(!['solve','mesh'].includes(operation)||typeof includeFields!=='boolean'||!['gui','api'].includes(origin))throw Error('Invalid analysis operation or includeFields');return jobs.start({project:getProject(),options,operation:operation==='mesh'?'mesh':'elastic',inputRevision,requestId,context:{includeFields,origin}});},
  isBusy:()=>active!==null||jobs.list().jobs.some(job=>!job.executionSettled),
  // Like jobs.drain(), wait for the executions present at invocation; do not
  // cancel them or include executions started later. Direct calls have no ID.
  async drainJobs(){const direct=active&&!active.jobId?active.settled:undefined;const [drained]=await Promise.all([jobs.drain(),direct]);return drained;},
  listJobs:jobs.list,getJob:jobs.get,jobEvents:jobs.events,cancelJob:jobs.cancel,
  getJobResult(jobId){const job=jobs.get(jobId);if(job.state!=='succeeded'||!results.has(jobId))throw Error('Job result is not available');return structuredClone(results.get(jobId));},
  listJobArtifacts(jobId,args={}){const job=jobs.get(jobId);return {...artifacts.list(jobId,args),inputRevision:job.inputRevision,jobState:job.state};},
  getJobArtifact(jobId,artifactId,options={}){jobs.get(jobId);return artifacts.read(jobId,artifactId,options);},
  releaseJob(jobId){const result=jobs.release(jobId);results.delete(jobId);artifacts.release(jobId);return result;},closeJobs(){jobs.close();if(active&&!active.jobId)finish(active,Error('Calculation cancelled'));results.clear();artifacts.clear();},
  async closeJobsAsync(){const ids=jobs.list({limit:100}).jobs.map(job=>job.jobId),direct=active&&!active.jobId?active:undefined;jobs.close();if(direct)finish(direct,Error('Calculation cancelled'));const [drained]=await Promise.all([jobs.drain(),direct?.settled]);for(const jobId of ids){results.delete(jobId);artifacts.release(jobId);}return drained;}
 };
}
