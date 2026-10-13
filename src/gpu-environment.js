export async function requestGpuDevice(gpu=globalThis.navigator?.gpu){
 if(!gpu)throw Error('WebGPU API unavailable');let expired=false,timer,device;
 const pending=(async()=>{const adapter=await gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw Error('No WebGPU adapter');const d=await adapter.requestDevice();if(expired){d.destroy();throw Error('WebGPU startup expired');}device=d;return {device:d,info:{description:adapter.info?.description||adapter.info?.vendor||'WebGPU adapter',isFallbackAdapter:adapter.info?.isFallbackAdapter??adapter.isFallbackAdapter??null,maxStorageBufferBindingSize:d.limits.maxStorageBufferBindingSize}};})();
 try{return await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;device?.destroy();reject(Error('WebGPU startup timed out'));},8000);})]);}finally{clearTimeout(timer);}
}
export async function checkGpuEnvironment(gpu){let context;try{context=await requestGpuDevice(gpu);return {available:true,...context.info};}catch(e){return {available:false,reason:e.message};}finally{context?.device.destroy();}}
