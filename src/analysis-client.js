import {requireResolvedCadConditions} from './cad-update-state.js';
import {createAnalysisJobs} from './analysis-jobs.js';
export function createAnalysisClient(getProject,onProgress=()=>{},runtime={}){
 const createWorker=runtime.createWorker||(()=>new Worker(new URL('./analysis.worker.js',import.meta.url),{type:'module'}));
 const isIsolated=runtime.isIsolated||(()=>globalThis.crossOriginIsolated);
 const baseUrl=runtime.baseUrl||(()=>new URL(import.meta.env?.BASE_URL||'/',location.href).href),timeoutMs=runtime.timeoutMs??120000;
 let active=null;
 function finish(job,error,result){if(active!==job)return;active=null;clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.abort);job.worker.terminate();error?job.reject(error):job.resolve({...result,input:job.project,calculation:{operation:job.operation,options:job.options}});}
 function start(operation,options={},snapshot,onEvent,signal,jobId){
 if(active)return Promise.reject(Error('A calculation is already running'));
 let project,settings;try{if(signal?.aborted)throw Error('Calculation cancelled');project=structuredClone(snapshot??getProject());if(operation!=='mesh')requireResolvedCadConditions(project);settings=structuredClone({size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options});if(!project.sourceModel)throw Error('Reload a STEP file or use the built-in sample; this project has no original solid');if(!isIsolated())throw Error('Browser isolation is not ready. Reload once, or use a compatible browser.');}catch(e){return Promise.reject(e);}
 return new Promise((resolve,reject)=>{let worker;try{worker=createWorker();}catch(e){reject(e);return;}const job={worker,project,operation,options:settings,resolve,reject,signal,jobId};active=job;
 if(!jobId)job.timer=setTimeout(()=>finish(job,Error(`Calculation exceeded ${timeoutMs/1000} seconds`)),timeoutMs);
 job.abort=()=>finish(job,Error('Calculation cancelled'));signal?.addEventListener('abort',job.abort,{once:true});
 worker.onerror=e=>finish(job,Error(e.message||'Worker failed'));
 worker.onmessage=({data})=>{if(active!==job)return;try{if(data.event){const {mesh,field,...summary}=data.event;onEvent?.({...summary,...(field?{fieldSummary:{kind:field.kind,time:field.time,nodeCount:field.temperature?.length??field.pressure?.length},fieldAvailable:false}:{}),...(mesh?{meshAvailable:false}:{})});return;}if(data.progress){onProgress(data.progress);onEvent?.({stage:'progress',message:data.progress,provisional:true});return;}finish(job,data.error?Error(data.error):null,data.result);}catch(error){finish(job,error);}};
 try{worker.postMessage({operation,project,source:project.sourceModel,options:structuredClone(job.options),base:baseUrl(),observe:!!onEvent});}catch(e){finish(job,e);}
 });
 }
 const results=new Map();
 const jobs=createAnalysisJobs({timeoutMs,execute:async({project,options,operation,jobId,signal,onEvent})=>{const output=await start(operation,options,project,onEvent,signal,jobId);if(signal.aborted)throw Error('Calculation cancelled');results.set(jobId,output);return {kind:output.result?.kind,mesh:output.mesh?.summary,resultAvailable:true};}});
 return {generateMesh:options=>start('mesh',options),analyze:options=>start('elastic',options),cancel:()=>{if(active?.jobId)jobs.cancel(active.jobId);else if(active)finish(active,Error('Calculation cancelled'));},
  startJob({operation='solve',options={},inputRevision,requestId}={}){if(!['solve','mesh'].includes(operation))throw Error('Unknown analysis operation');return jobs.start({project:getProject(),options,operation:operation==='mesh'?'mesh':'elastic',inputRevision,requestId});},
  getJob:jobs.get,jobEvents:jobs.events,cancelJob:jobs.cancel,
  getJobResult(jobId){const job=jobs.get(jobId);if(job.state!=='succeeded'||!results.has(jobId))throw Error('Job result is not available');return structuredClone(results.get(jobId));},
  releaseJob(jobId){const result=jobs.release(jobId);results.delete(jobId);return result;},closeJobs:jobs.close
 };
}
