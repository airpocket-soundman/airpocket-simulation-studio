export function createAnalysisClient(getProject,onProgress=()=>{},runtime={}){
 const createWorker=runtime.createWorker||(()=>new Worker(new URL('./analysis.worker.js',import.meta.url),{type:'module'}));
 const isIsolated=runtime.isIsolated||(()=>globalThis.crossOriginIsolated);
 const baseUrl=runtime.baseUrl||(()=>new URL(import.meta.env?.BASE_URL||'/',location.href).href),timeoutMs=runtime.timeoutMs??120000;
 let active=null;
 function finish(job,error,result){if(active!==job)return;active=null;clearTimeout(job.timer);job.worker.terminate();error?job.reject(error):job.resolve({...result,input:job.project,calculation:{operation:job.operation,options:job.options}});}
 function start(operation,options={}){
 if(active)return Promise.reject(Error('A calculation is already running'));
 let project,settings;try{project=structuredClone(getProject());settings=structuredClone({size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options});if(!project.sourceModel)throw Error('Reload a STEP file or use the built-in sample; this project has no original solid');if(!isIsolated())throw Error('Browser isolation is not ready. Reload once, or use a compatible browser.');}catch(e){return Promise.reject(e);}
 return new Promise((resolve,reject)=>{let worker;try{worker=createWorker();}catch(e){reject(e);return;}const job={worker,project,operation,options:settings,resolve,reject};active=job;
 job.timer=setTimeout(()=>finish(job,Error(`Calculation exceeded ${timeoutMs/1000} seconds`)),timeoutMs);
 worker.onerror=e=>finish(job,Error(e.message||'Worker failed'));
 worker.onmessage=({data})=>{if(active!==job)return;if(data.progress){onProgress(data.progress);return;}finish(job,data.error?Error(data.error):null,data.result);};
 try{worker.postMessage({operation,project,source:project.sourceModel,options:structuredClone(job.options),base:baseUrl()});}catch(e){finish(job,e);}
 });
 }
 return {generateMesh:options=>start('mesh',options),analyze:options=>start('elastic',options),cancel:()=>{if(active)finish(active,Error('Calculation cancelled'));}};
}
