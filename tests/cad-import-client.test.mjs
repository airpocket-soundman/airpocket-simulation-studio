import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCadImportClient} from '../src/cad-import-client.js';
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};
function fixture(options={}){const instances=[],activity=[];const client=createCadImportClient({base:'https://example.invalid/',createWorker:()=>{const worker={postMessage(message,transfer){this.message=message;this.transfer=transfer;},terminate(){this.terminated=true;}};instances.push(worker);return worker;},onActive:worker=>activity.push(worker),...options});return {client,instances,activity};}
test('CAD success and error terminate the worker and detach handlers before settling',async()=>{for(const error of [false,true]){const h=fixture(),buffer=new ArrayBuffer(3),pending=h.client.import(buffer),worker=h.instances[0];assert.equal(h.client.isBusy(),true);assert.equal(worker.message.buffer,buffer);assert.deepEqual(worker.transfer,[buffer]);worker.onmessage({data:error?{error:'Parse failed'}:{result:{success:true}}});if(error)await assert.rejects(pending,/Parse failed/);else assert.deepEqual(await pending,{success:true});assert.equal(worker.terminated,true);assert.equal(worker.onmessage,null);assert.equal(worker.onerror,null);assert.equal(h.client.isBusy(),false);assert.equal(h.activity.at(-1),null);}});
test('abort keeps lease until asynchronous termination settles and ignores late messages',async()=>{const cleanup=deferred(),controller=new AbortController(),h=fixture({createWorker:()=>({postMessage(){},terminate:()=>cleanup.promise})}),pending=h.client.import(new ArrayBuffer(1),{signal:controller.signal});controller.abort();assert.equal(h.client.isBusy(),true);await assert.rejects(h.client.import(new ArrayBuffer(1)),/already running/);cleanup.resolve();await assert.rejects(pending,/aborted/);assert.equal(h.client.isBusy(),false);const stopped=new AbortController();stopped.abort();await assert.rejects(h.client.import(new ArrayBuffer(1),{signal:stopped.signal}),/aborted/);});
test('timeout, worker error and failed post all clean up and permit another import',async()=>{
 const h=fixture({timeoutMs:5});await assert.rejects(h.client.import(new ArrayBuffer(1)),/時間制限/);assert.equal(h.client.isBusy(),false);assert.equal(h.instances[0].terminated,true);
 const pending=h.client.import(new ArrayBuffer(1));h.instances[1].onerror({message:'Worker failed'});await assert.rejects(pending,/Worker failed/);assert.equal(h.client.isBusy(),false);
 let terminated=false;const broken=fixture({createWorker:()=>({postMessage(){throw Error('Post failed');},terminate(){terminated=true;}})});await assert.rejects(broken.client.import(new ArrayBuffer(1)),/Post failed/);assert.equal(terminated,true);assert.equal(broken.client.isBusy(),false);
});

test('falsy creation and cleanup rejections remain failures and late messages clean up once',async()=>{
 for(const value of [null,undefined,0]){
  const creation=fixture({createWorker:()=>{throw value;}});await assert.rejects(creation.client.import(new ArrayBuffer(1)),/CAD import failed/);assert.equal(creation.client.isBusy(),false);assert.deepEqual(creation.activity,[null]);
  let calls=0;const cleanup=fixture({createWorker:()=>({postMessage(){},terminate(){calls++;return Promise.reject(value);}})});const pending=cleanup.client.import(new ArrayBuffer(1));const worker=cleanup.activity[0],late=worker.onmessage;late({data:{result:{success:true}}});late({data:{result:{success:false}}});await assert.rejects(pending,/CAD import failed/);assert.equal(calls,1);assert.equal(cleanup.client.isBusy(),false);assert.equal(cleanup.activity.length,2);
 }
});
