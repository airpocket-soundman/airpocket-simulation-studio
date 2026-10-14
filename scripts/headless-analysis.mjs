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
 return new Promise((resolve,reject)=>{
  // A file Worker must not inherit inline/eval or test-runner launch flags.
  const worker=new Worker(new URL('./headless-worker.mjs',import.meta.url),{stdout:true,stderr:true,execArgv:[]});
  worker.stdout.pipe(process.stderr);worker.stderr.pipe(process.stderr);
  let finished=false;const cancel=()=>finish(Error('Calculation cancelled'));
  const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);runtime.signal?.removeEventListener('abort',cancel);worker.terminate();error?reject(error):resolve({...result,...(result.result?{result:{...result.result,analysisAssessment}}:{}),analysisAssessment,input,calculation:{operation,options:settings}});};
  const timer=setTimeout(()=>finish(Error('Analysis exceeded 120 seconds')),120000);
  worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!finished)finish(Error('Analysis worker exited before completion: '+code));});
  runtime.signal?.addEventListener('abort',cancel,{once:true});
  worker.on('message',message=>{if(finished)return;try{if(message.error)finish(Error(message.error));else if(message.result)finish(null,message.result);else if(message.event)runtime.onEvent?.(message.event);else if(message.progress)runtime.onEvent?.({stage:'progress',message:message.progress,provisional:true});}catch(error){finish(error);}});
  try{worker.postMessage({project:input,source:input.sourceModel,operation,options:settings,observe:runtime.observe===true});}catch(error){finish(error);}
 });
}
