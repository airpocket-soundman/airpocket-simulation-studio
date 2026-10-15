export function parseBrowserConnectorEndpoint(endpoint){
 if(typeof endpoint!=='string'||!/^http:\/\/127\.0\.0\.1(?::[0-9]{1,5})?\/?$/.test(endpoint))throw Error('Use an HTTP loopback endpoint');
 const url=new URL(endpoint);if(url.port&&(!Number.isInteger(Number(url.port))||Number(url.port)<1||Number(url.port)>65535))throw Error('Use an HTTP loopback endpoint');
 return url;
}
async function permissionStatus(permissions){
 if(!permissions||typeof permissions.query!=='function')return {name:null,status:'unsupported'};
 for(const name of ['loopback-network','local-network-access']){
  try{const result=await permissions.query({name});return {name,status:['granted','denied','prompt'].includes(result?.state)?result.state:'unknown'};}catch{/* Unsupported permission names do not imply denial. */}
 }
 return {name:null,status:'unsupported'};
}
async function boundedHealth(response){
 if(!response.ok)return false;
 const size=Number(response.headers?.get?.('content-length'));if(Number.isFinite(size)&&size>1024)return false;
 if(!response.body?.getReader)return false;
 const reader=response.body.getReader(),parts=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1024)return false;parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return value?.schemaVersion===1&&value.kind==='airpocket-browser-bridge'&&Object.keys(value).length===2;}catch{return false;}
}
/** No pairing credentials, scope, model data, or arbitrary error text enter this probe. */
export async function diagnoseBrowserConnection(endpoint,{fetcher=globalThis.fetch,permissions=globalThis.navigator?.permissions,timeoutMs=5000,signal}={}){
 if(signal?.aborted)return {health:'expired',permission:{name:null,status:'unknown'},authenticated:false};
 let url;try{url=parseBrowserConnectorEndpoint(endpoint);}catch{return {health:'invalid-endpoint',permission:{name:null,status:'unknown'},authenticated:false};}
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000)throw TypeError('Invalid diagnostic timeout');
 const controller=new AbortController();let timer,abort;
 const deadline=new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({health:'timeout',permission:{name:null,status:'unknown'},authenticated:false});},timeoutMs);abort=()=>{controller.abort();resolve({health:'expired',permission:{name:null,status:'unknown'},authenticated:false});};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
 const work=(async()=>{
  const permission=permissionStatus(permissions);
  let health;try{const response=await fetcher(url.origin+'/health',{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',targetAddressSpace:'loopback',signal:controller.signal});health=await boundedHealth(response)?'reachable':'invalid-response';}catch{health=controller.signal.aborted?'expired':'unreachable';}
  return {health,permission:await permission,authenticated:false};
 })();
 try{return await Promise.race([deadline,work]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}
}
export function createBrowserConnectionDiagnostics({diagnose=diagnoseBrowserConnection}={}){
 let epoch=0,controller;
 const invalidate=()=>{epoch++;controller?.abort();};
 return {invalidate,async run(endpoint){invalidate();const current=epoch;controller=new AbortController();const result=await diagnose(endpoint,{signal:controller.signal});return current===epoch?result:null;}};
}
