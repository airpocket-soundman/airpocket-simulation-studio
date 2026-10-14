/** Worker termination is awaited when a host returns a promise. Browser terminate
 * is synchronous; this does not claim OS-thread termination acknowledgement. */
export function createCadImportClient({createWorker,base,onActive=()=>{},timeoutMs=90000}={}){
 if(typeof createWorker!=='function'||typeof onActive!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw TypeError('Invalid CAD import client');
 let active=null;
 return Object.freeze({isBusy:()=>active!==null,import(buffer,{signal}={}){
  if(active)return Promise.reject(Error('A CAD import is already running'));
  if(signal?.aborted)return Promise.reject(Error('CAD import aborted'));
  return new Promise((resolve,reject)=>{
   let worker,timer,finishing=false;
   const abort=()=>finish(Error('CAD import aborted'));
   const finish=async(error,result,failed=error!==null)=>{
    if(finishing)return;finishing=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
    if(worker){worker.onmessage=null;worker.onerror=null;try{await worker.terminate();}catch(cleanup){if(!failed)error=cleanup;failed=true;}}
    if(active===worker)active=null;
    try{onActive(null);}catch(callbackError){if(!failed)error=callbackError;failed=true;}
    failed?reject(error instanceof Error?error:Error('CAD import failed: '+String(error))):resolve(result);
   };
   try{
    worker=createWorker();active=worker;onActive(worker);
    worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.result);
    worker.onerror=event=>finish(Error(event.message));
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>finish(Error('読み込みが時間制限（90秒）を超えました。')),timeoutMs);
    if(signal?.aborted){abort();return;}
    worker.postMessage({buffer,base},[buffer]);
   }catch(error){finish(error,undefined,true);}
  });
 }});
}
