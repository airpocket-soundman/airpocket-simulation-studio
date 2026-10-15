import {readFile} from 'node:fs/promises';
import {collectSourceBuildIdentity} from './source-build-identity.mjs';
const assetRoot=new URL('../public/',import.meta.url);
const runtimeRoot=new URL('./worker-runtime/',import.meta.url);
/** Common local-asset environment for thread and opt-in process isolation. */
export async function initializeHeadlessWorker(send,{isolation='worker-thread'}={}){
 if(!['worker-thread','process'].includes(isolation))throw Error('Invalid headless runtime isolation');
 // Capture in this execution host, before accepting requests. Request data and
 // saved project metadata never supply or update the executing build identity.
 const buildIdentity=await collectSourceBuildIdentity();
 globalThis.self={postMessage:send};
 globalThis.fetch=async url=>{
  let target=new URL(url);if(target.href===new URL('fem-kernel.wasm',runtimeRoot).href)target=new URL('fem-kernel.wasm',assetRoot);if(!target.href.startsWith(assetRoot.href))throw Error('Only local simulation assets may be loaded');
  const bytes=await readFile(target);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 const {configureAnalysisWorkerRuntime}=await import('../src/analysis.worker.js');
 configureAnalysisWorkerRuntime({target:'node',isolation,buildIdentity,readAssetBytes:async role=>{
  const target=role==='kernel'?new URL('fem-kernel.wasm',assetRoot):role==='mfem'?new URL('mfem/mfem.wasm',assetRoot):role==='gmsh'?new URL(import.meta.resolve('@loumalouomega/gmsh-wasm/gmsh-core.wasm')):null;
  if(!target)throw Error('Unknown headless runtime asset');
  return new Uint8Array(await readFile(target));
 }});
 return data=>self.onmessage({data:{...data,base:runtimeRoot.href}});
}
