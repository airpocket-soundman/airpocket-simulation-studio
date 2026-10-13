import {parentPort} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
const assetRoot=new URL('../public/',import.meta.url);
globalThis.self={postMessage:message=>parentPort.postMessage(message)};
globalThis.fetch=async url=>{
 const target=new URL(url);if(!target.href.startsWith(assetRoot.href))throw Error('Only local simulation assets may be loaded');
 const bytes=await readFile(target);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
};
await import('../src/analysis.worker.js');
parentPort.on('message',data=>self.onmessage({data:{...data,base:assetRoot.href}}));
