import {Worker} from 'node:worker_threads';
import {createStudioApi} from '../src/studio-api.js';
import {requireAnalysisPreflight} from '../src/analysis-preflight.js';
export async function analyzeProject(project,options={},operation='elastic',runtime={}){
 const api=createStudioApi();api.loadProject(project);const input=api.exportProject();
 if(!input.sourceModel)throw Error('Project has no source model; import STEP/STL or use a built-in solid');
 if(!['mesh','elastic'].includes(operation))throw Error('Unknown analysis operation');
 const settings=structuredClone({size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options});
 if(!Number.isFinite(settings.size)||settings.size<=0||!['wasm-pcg','pcg','pcg-strict','mfem-wasm'].includes(settings.method))throw Error('Invalid CPU analysis settings');
 if(runtime.signal?.aborted)throw Error('Calculation cancelled');
 const analysisAssessment=requireAnalysisPreflight(input,settings,{target:'node',operation:operation==='mesh'?'mesh':'solve'});
 if(runtime.observeFields!==undefined&&typeof runtime.observeFields!=='boolean')throw Error('Invalid observation field flag');
 const timeoutMs=runtime.timeoutMs??120000;
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>120000)throw Error('Invalid analysis timeout');
 return new Promise((resolve,reject)=>{
  // Host-only injection supports lifecycle tests; wire options cannot select a Worker.
  const createWorker=runtime.createWorker??((url,options)=>new Worker(url,options));
  // A file Worker must not inherit inline/eval or test-runner launch flags.
  const worker=createWorker(new URL('./headless-worker.mjs',import.meta.url),{stdout:true,stderr:true,execArgv:[]});
  let finished=false,timer;
  const cancel=()=>finish(Error('Calculation cancelled'));
  const finish=(error,result)=>{
   if(finished)return;finished=true;clearTimeout(timer);runtime.signal?.removeEventListener('abort',cancel);
   const cleanupFailed=cleanup=>reject(error?new AggregateError([error,cleanup],'Analysis failed: '+(error?.message??String(error))+'; Worker cleanup failed: '+(cleanup?.message??String(cleanup))):cleanup);
   let termination;try{termination=worker.terminate();}catch(cleanup){cleanupFailed(cleanup);return;}
   // Ownership ends only after the thread has stopped, including cancellation.
   Promise.resolve(termination).then(()=>{
    if(error){reject(error);return;}
    try{resolve({...result,...(result.result?{result:{...result.result,analysisAssessment}}:{}),analysisAssessment,input,calculation:{operation,options:settings}});}catch(failure){reject(failure);}
   },cleanupFailed);
  };
  timer=setTimeout(()=>finish(Error('Analysis exceeded '+timeoutMs/1000+' seconds')),timeoutMs);
  worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!finished)finish(Error('Analysis worker exited before completion: '+code));});
  worker.on('message',message=>{if(finished)return;try{if(message.error)finish(Error(message.error));else if(message.result)finish(null,message.result);else if(message.event)runtime.onEvent?.(message.event);else if(message.progress)runtime.onEvent?.({stage:'progress',message:message.progress,provisional:true});}catch(error){finish(error);}});
  runtime.signal?.addEventListener('abort',cancel,{once:true});
  // The host may abort while creating the Worker, before the listener exists.
  if(runtime.signal?.aborted){cancel();return;}
  try{worker.stdout.pipe(process.stderr);worker.stderr.pipe(process.stderr);worker.postMessage({project:input,source:input.sourceModel,operation,options:settings,observe:runtime.observe===true,observeFields:runtime.observeFields===true});}catch(error){finish(error);}
 });
}
