import {requireAnalysisPreflight} from './analysis-preflight.js';
import {requireResolvedCadConditions} from './cad-update-state.js';
import {createAnalysisJobs} from './analysis-jobs.js';
import {createBrowserIntermediateStore} from './browser-intermediate-store.js';
export function createAnalysisClient(getProject,onProgress=()=>{},runtime={}){
 const createWorker=runtime.createWorker||(()=>new Worker(new URL('./analysis.worker.js',import.meta.url),{type:'module'}));
 const isIsolated=runtime.isIsolated||(()=>globalThis.crossOriginIsolated);
 const baseUrl=runtime.baseUrl||(()=>new URL(import.meta.env?.BASE_URL||'/',location.href).href),timeoutMs=runtime.timeoutMs??120000;
 let active=null;
 function finish(job,error,result){
  if(active!==job||job.finishing)return;job.finishing=true;clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.abort);
  const settle=(failure)=>{if(active===job)active=null;if(failure){job.reject(failure);return;}try{job.resolve({...result,...(result.result?{result:{...result.result,analysisAssessment:job.analysisAssessment}}:{}),analysisAssessment:job.analysisAssessment,input:job.project,calculation:{operation:job.operation,options:job.options}});}catch(cause){job.reject(cause);}};
  const cleanupFailed=cause=>{const failure=cause instanceof Error?cause:new Error('Worker cleanup failed: '+String(cause),{cause});settle(error?new AggregateError([error,failure],'Analysis failed: '+(error?.message??String(error))+'; Worker cleanup failed: '+failure.message):failure);};
  let termination;try{termination=job.worker.terminate();}catch(cause){cleanupFailed(cause);return;}
  // Native browser terminate returns void; host adapters may return a cleanup promise.
  Promise.resolve(termination).then(()=>settle(error),cleanupFailed);
 }
 function start(operation,options={},snapshot,onEvent,signal,jobId){
 if(active)return Promise.reject(Error('A calculation is already running'));
 let project,settings,analysisAssessment;try{if(signal?.aborted)throw Error('Calculation cancelled');project=structuredClone(snapshot??getProject());if(operation!=='mesh')requireResolvedCadConditions(project);settings=structuredClone({size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options});if(!project.sourceModel)throw Error('Reload a STEP file or use the built-in sample; this project has no original solid');if(!isIsolated())throw Error('Browser isolation is not ready. Reload once, or use a compatible browser.');analysisAssessment=requireAnalysisPreflight(project,settings,{target:'browser',operation:operation==='mesh'?'mesh':'solve'});}catch(e){return Promise.reject(e);}
 return new Promise((resolve,reject)=>{let worker;try{worker=createWorker();}catch(e){reject(e);return;}const job={worker,project,operation,options:settings,resolve,reject,signal,jobId,analysisAssessment};active=job;
 if(!jobId)job.timer=setTimeout(()=>finish(job,Error(`Calculation exceeded ${timeoutMs/1000} seconds`)),timeoutMs);
 job.abort=()=>finish(job,Error('Calculation cancelled'));signal?.addEventListener('abort',job.abort,{once:true});
 worker.onerror=e=>finish(job,Error(e.message||'Worker failed'));
 worker.onmessage=({data})=>{if(active!==job||job.finishing)return;try{if(data.event){onEvent?.(data.event);return;}if(data.progress){onProgress(data.progress);onEvent?.({stage:'progress',message:data.progress,provisional:true});return;}finish(job,data.error?Error(data.error):null,data.result);}catch(error){finish(job,error);}};
 if(signal?.aborted){job.abort();return;}
 try{worker.postMessage({operation,project,source:project.sourceModel,options:structuredClone(job.options),base:baseUrl(),observe:!!onEvent});}catch(e){finish(job,e);}
 });
 }
 const results=new Map(),artifacts=createBrowserIntermediateStore({maxBytes:runtime.maxIntermediateBytes??64_000_000});
 const jobs=createAnalysisJobs({timeoutMs,execute:async({project,options,operation,jobId,signal,onEvent,context,inputRevision})=>{
  let chain=Promise.resolve(),reportedLimit=false;
  const emitObservation=(event,retained)=>{
   const {mesh,field,...summary}=event;
   if(retained?.limited&&!reportedLimit){reportedLimit=true;onEvent({stage:'observation-limit',provisional:true,message:'Browser intermediate storage limit reached; summaries continue',limitBytes:retained.limitBytes});}
   onEvent({...summary,...(retained?.artifact?{artifact:retained.artifact}:{}),...(field?{fieldSummary:{kind:field.kind,time:field.time,nodeCount:field.temperature?.length??field.pressure?.length},fieldAvailable:!!retained?.artifact}:{}),...(mesh?{meshAvailable:!!retained?.artifact}:{})});
  };
  const observe=event=>{if(!context.includeFields){emitObservation(event);return;}chain=chain.then(async()=>{if(signal.aborted)return;let retained;try{retained=await artifacts.capture(jobId,inputRevision,event,()=>!signal.aborted);}catch(error){onEvent({stage:'observation-error',provisional:true,message:error.message});}if(!signal.aborted)emitObservation(event,retained);});};
  try{const output=await start(operation,options,project,observe,signal,jobId);await chain;if(signal.aborted)throw Error('Calculation cancelled');results.set(jobId,output);return {kind:output.result?.kind,mesh:output.mesh?.summary,resultAvailable:true,analysisAssessment:output.analysisAssessment,intermediate:artifacts.summary(jobId)};}finally{await chain;}
 }});
 return {generateMesh:options=>start('mesh',options),analyze:options=>start('elastic',options),cancel:()=>{if(active?.jobId)jobs.cancel(active.jobId);else if(active)finish(active,Error('Calculation cancelled'));},
  startJob({operation='solve',options={},inputRevision,requestId,includeFields=false,origin='api'}={}){if(!['solve','mesh'].includes(operation)||typeof includeFields!=='boolean'||!['gui','api'].includes(origin))throw Error('Invalid analysis operation or includeFields');return jobs.start({project:getProject(),options,operation:operation==='mesh'?'mesh':'elastic',inputRevision,requestId,context:{includeFields,origin}});},
  isBusy:()=>active!==null||jobs.list().jobs.some(job=>!job.executionSettled),drainJobs:jobs.drain,
  listJobs:jobs.list,getJob:jobs.get,jobEvents:jobs.events,cancelJob:jobs.cancel,
  getJobResult(jobId){const job=jobs.get(jobId);if(job.state!=='succeeded'||!results.has(jobId))throw Error('Job result is not available');return structuredClone(results.get(jobId));},
  listJobArtifacts(jobId,args={}){const job=jobs.get(jobId);return {...artifacts.list(jobId,args),inputRevision:job.inputRevision,jobState:job.state};},
  getJobArtifact(jobId,artifactId,options={}){jobs.get(jobId);return artifacts.read(jobId,artifactId,options);},
  releaseJob(jobId){const result=jobs.release(jobId);results.delete(jobId);artifacts.release(jobId);return result;},closeJobs(){jobs.close();results.clear();artifacts.clear();},
  async closeJobsAsync(){const ids=jobs.list({limit:100}).jobs.map(job=>job.jobId);jobs.close();const drained=await jobs.drain();for(const jobId of ids){results.delete(jobId);artifacts.release(jobId);}return drained;}
 };
}
