import {Worker} from 'node:worker_threads';
import {createStudioApi} from '../src/studio-api.js';
export async function analyzeProject(project,options={},operation='elastic'){
 const api=createStudioApi();api.loadProject(project);const input=api.exportProject();
 if(!input.sourceModel)throw Error('Project has no source model; import STEP/STL or use a built-in solid');
 if(!['mesh','elastic'].includes(operation))throw Error('Unknown analysis operation');
 const settings={size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options};
 if(!Number.isFinite(settings.size)||settings.size<=0||!['wasm-pcg','pcg','pcg-strict','mfem-wasm'].includes(settings.method))throw Error('Invalid CPU analysis settings');
 return new Promise((resolve,reject)=>{
  // A file Worker must not inherit inline/eval or test-runner launch flags.
  const worker=new Worker(new URL('./headless-worker.mjs',import.meta.url),{stdout:true,stderr:true,execArgv:[]});
  worker.stdout.pipe(process.stderr);worker.stderr.pipe(process.stderr);
  let finished=false;const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve({...result,input,calculation:{operation,options:settings}});};
  const timer=setTimeout(()=>finish(Error('Analysis exceeded 120 seconds')),120000);
  worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!finished)finish(Error('Analysis worker exited before completion: '+code));});
  worker.on('message',message=>{if(message.error)finish(Error(message.error));else if(message.result)finish(null,message.result);});
  worker.postMessage({project:input,source:input.sourceModel,operation,options:settings});
 });
}
