export function createAnalysisClient(getProject,onProgress){let worker=null,timer=null;
 function cancel(){worker?.terminate();worker=null;clearTimeout(timer);}
 let rejectActive=null;
 function start(operation,options={}){options={size:5,method:"wasm-pcg",...options};if(worker)return Promise.reject(Error('A calculation is already running'));const project=getProject();if(!project.sourceModel)return Promise.reject(Error('Reload a STEP file or use the built-in sample; this project has no original solid'));if(!crossOriginIsolated)return Promise.reject(Error('Browser isolation is not ready. Reload once, or use a compatible browser.'));
 return new Promise((resolve,reject)=>{rejectActive=reject;worker=new Worker(new URL('./analysis.worker.js',import.meta.url),{type:'module'});timer=setTimeout(()=>{cancel();reject(Error('Calculation exceeded 120 seconds'));},120000);worker.onerror=e=>{cancel();reject(Error(e.message));};worker.onmessage=({data})=>{if(data.progress){onProgress(data.progress);return;}cancel();rejectActive=null;data.error?reject(Error(data.error)):resolve({...data.result,input:project});};worker.postMessage({operation,project,source:project.sourceModel,options,base:new URL(import.meta.env.BASE_URL,location.href).href});});
 }
 return {generateMesh:options=>start('mesh',options),analyze:options=>start('elastic',options),cancel:()=>{cancel();rejectActive?.(Error('Calculation cancelled'));rejectActive=null;}};
}
