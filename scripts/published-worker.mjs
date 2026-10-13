import {fileURLToPath} from 'node:url';
import {parentPort,workerData} from 'node:worker_threads';
import {readFile,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const nativeFetch=globalThis.fetch;
globalThis.self={postMessage:data=>parentPort.postMessage(data)};
globalThis.fetch=async(url,options)=>String(url).startsWith('file:')?new Response(await readFile(new URL(url))):nativeFetch(url,options);
if(workerData.cad){const original=new URL('cad/occt-import-js.js',workerData.base),cjs=new URL('cad/occt-import-js.cjs',workerData.base);await copyFile(original,cjs);const factory=createRequire(import.meta.url)(fileURLToPath(cjs));
 globalThis.importScripts=url=>{if(url!==original.href)throw Error('Unexpected CAD script');};
 globalThis.self.occtimportjs=async options=>factory({...options,wasmBinary:await readFile(new URL('cad/occt-import-js.wasm',workerData.base))});
}
await import(workerData.module);
parentPort.on('message',data=>globalThis.self.onmessage({data}));
parentPort.postMessage({ready:true});
