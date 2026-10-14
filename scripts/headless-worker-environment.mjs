import {readFile} from 'node:fs/promises';
const assetRoot=new URL('../public/',import.meta.url);
const runtimeRoot=new URL('./worker-runtime/',import.meta.url);
/** Common local-asset environment for thread and opt-in process isolation. */
export async function initializeHeadlessWorker(send){
 globalThis.self={postMessage:send};
 globalThis.fetch=async url=>{
  let target=new URL(url);if(target.href===new URL('fem-kernel.wasm',runtimeRoot).href)target=new URL('fem-kernel.wasm',assetRoot);if(!target.href.startsWith(assetRoot.href))throw Error('Only local simulation assets may be loaded');
  const bytes=await readFile(target);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 await import('../src/analysis.worker.js');
 return data=>self.onmessage({data:{...data,base:runtimeRoot.href}});
}
