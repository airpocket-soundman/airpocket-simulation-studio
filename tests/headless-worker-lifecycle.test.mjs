import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {createProjectFromBuiltin} from '../src/project-import.js';
const input=()=>createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,1,1,1]}});
class DeferredWorker extends EventEmitter{
 constructor(){super();this.stdout=this.stderr={pipe(){}};this.terminateCalls=0;this.posts=0;this.stopping=new Promise(resolve=>{this.startedStopping=resolve;});this.stopped=new Promise((resolve,reject)=>{this.complete=()=>{this.emit('exit',1);resolve(1);};this.failCleanup=reject;});}
 postMessage(message){this.posts++;this.input=message;if(this.postError)throw this.postError;}
 terminate(){this.terminateCalls++;this.startedStopping();if(this.terminateError)throw this.terminateError;return this.stopped;}
}
function launch(extra={}){const worker=new DeferredWorker(),controller=new AbortController();let adds=0,removes=0,settled=false;
 const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal);controller.signal.addEventListener=(...args)=>{adds++;return add(...args);};controller.signal.removeEventListener=(...args)=>{removes++;return remove(...args);};
 const promise=analyzeProject(input(),{},'mesh',{signal:controller.signal,createWorker:()=>worker,...extra});promise.then(()=>{settled=true;},()=>{settled=true;});return {worker,controller,promise,get settled(){return settled;},get listeners(){return {adds,removes};}};
}
for(const kind of ['success','worker-error','worker-reported-error','abort','timeout','early-exit'])test('headless '+kind+' owns the Worker until termination completes and settles once',async()=>{
 const h=launch(kind==='timeout'?{timeoutMs:5}:{});
 const original=Error('Worker engine failed');
 if(kind==='success')h.worker.emit('message',{result:{mesh:{summary:{synthetic:true}}}});
 if(kind==='worker-error')h.worker.emit('error',original);
 if(kind==='worker-reported-error')h.worker.emit('message',{error:'Native solver refused input'});
 if(kind==='abort')h.controller.abort();
 if(kind==='early-exit')h.worker.emit('exit',17);
 await h.worker.stopping;await Promise.resolve();assert.equal(h.settled,false);assert.equal(h.worker.terminateCalls,1);assert.deepEqual(h.listeners,{adds:1,removes:1});
 h.worker.emit('message',{result:{wrong:true}});h.worker.emit('message',{error:'late'});h.worker.emit('error',Error('late'));h.worker.emit('exit',99);assert.equal(h.worker.terminateCalls,1);h.worker.complete();
 if(kind==='success'){const result=await h.promise;assert.equal(result.mesh.summary.synthetic,true);assert.equal(result.wrong,undefined);}else await assert.rejects(h.promise,kind==='worker-error'?error=>error===original:kind==='worker-reported-error'?/Native solver refused input/:kind==='abort'?/cancelled/:kind==='early-exit'?/17/:/exceeded/);
 assert.equal(h.worker.terminateCalls,1);assert.equal(h.settled,true);
});

test('headless job clients enable observation transport and ACK accepted events but not the terminal summary',async()=>{
 const worker=new DeferredWorker(),events=[],promise=analyzeProject(input(),{},'mesh',{observe:true,onEvent:event=>events.push(event),createWorker:()=>worker});
 assert.equal(worker.input.observationTransportProtocol,1);
 worker.emit('message',{event:{stage:'mesh',metrics:{nodeCount:4}},observationAckId:8});
 assert.deepEqual(worker.input,{type:'analysis-observation-ack-v1',id:8});assert.equal(events.length,1);
 worker.emit('message',{event:{stage:'observation-transport',provisional:true,observationTransport:{terminal:true}}});
 assert.deepEqual(worker.input,{type:'analysis-observation-ack-v1',id:8});
 worker.emit('message',{result:{mesh:{summary:{nodeCount:4}}}});await worker.stopping;worker.complete();await promise;
});
test('headless cancellation after an observation ACK ignores stale events and reports terminal totals as unavailable',async()=>{
 const worker=new DeferredWorker(),controller=new AbortController(),events=[],promise=analyzeProject(input(),{},'mesh',{observe:true,onEvent:event=>events.push(event),signal:controller.signal,createWorker:()=>worker});
 assert.equal(worker.input.observationTransportProtocol,1);worker.emit('message',{event:{stage:'mesh',observationTransport:{sequence:1,dropped:0,terminal:false}},observationAckId:9});
 assert.deepEqual(worker.input,{type:'analysis-observation-ack-v1',id:9});controller.abort();await worker.stopping;
 worker.emit('message',{event:{stage:'mesh',observationTransport:{sequence:2,dropped:0}},observationAckId:10});
 worker.emit('message',{event:{stage:'observation-transport',provisional:true,observationTransport:{terminal:true,dropped:99}}});
 worker.complete();await assert.rejects(promise,/cancelled/);assert.equal(events.length,1);assert.equal(events.some(event=>event.stage==='observation-transport'),false);
});
test('postMessage failure rejects only after its Worker has stopped',async()=>{const worker=new DeferredWorker(),failure=Error('Cannot allocate message');worker.postError=failure;let settled=false;const promise=analyzeProject(input(),{},'mesh',{createWorker:()=>worker});promise.catch(()=>{settled=true;});await worker.stopping;assert.equal(settled,false);worker.complete();await assert.rejects(promise,error=>error===failure);assert.equal(worker.terminateCalls,1);});
test('cleanup rejection never yields success and preserves an earlier engine failure',async()=>{for(const failed of [false,true]){const h=launch(),original=Error('Engine failed'),cleanup=Error('Termination rejected');if(failed)h.worker.emit('error',original);else h.worker.emit('message',{result:{mesh:{}}});await h.worker.stopping;h.worker.failCleanup(cleanup);await assert.rejects(h.promise,error=>failed?error instanceof AggregateError&&error.errors[0]===original&&error.errors[1]===cleanup&&error.message.includes(original.message)&&error.message.includes(cleanup.message):error===cleanup);assert.equal(h.worker.terminateCalls,1);}});
test('synchronous cleanup failure rejects and cannot be replaced by late successful replies',async()=>{const h=launch(),cleanup=Error('Termination threw');h.worker.terminateError=cleanup;h.worker.emit('message',{result:{mesh:{}}});h.worker.emit('message',{result:{wrong:true}});await assert.rejects(h.promise,error=>error===cleanup);assert.equal(h.worker.terminateCalls,1);h.worker.complete();});
test('abort during Worker creation is rechecked before posting and waits for cleanup',async()=>{const controller=new AbortController(),worker=new DeferredWorker();const promise=analyzeProject(input(),{},'mesh',{signal:controller.signal,createWorker:()=>{controller.abort();return worker;}});await worker.stopping;assert.equal(worker.posts,0);worker.complete();await assert.rejects(promise,/cancelled/);assert.equal(worker.terminateCalls,1);});
test('sequential fulfilled analyses cannot create the next Worker before the first exits',async()=>{const workers=[];const createWorker=()=>{assert.ok(workers.length===0||workers.at(-1).closed);const worker=new DeferredWorker();workers.push(worker);return worker;};const first=analyzeProject(input(),{},'mesh',{createWorker});workers[0].emit('message',{result:{mesh:{}}});await workers[0].stopping;workers[0].closed=true;workers[0].complete();await first;const second=analyzeProject(input(),{},'mesh',{createWorker});workers[1].emit('message',{result:{mesh:{}}});workers[1].closed=true;workers[1].complete();await second;assert.equal(workers.length,2);});

test('host timeout override cannot exceed the fixed 120-second analysis limit',async()=>{for(const timeoutMs of [120001,Infinity,NaN,0,-1]){let created=false;await assert.rejects(analyzeProject(input(),{},'mesh',{timeoutMs,createWorker:()=>{created=true;return new DeferredWorker();}}),/Invalid analysis timeout/);assert.equal(created,false);}});

const runtimeIdentity=()=>({schemaVersion:1,target:'node',isolation:'worker-thread',build:{status:'unavailable'},engine:{requestedMethod:'wasm-pcg',actualEngine:null},assets:[{role:'kernel',bytes:10,sha256:'sha256:'+'a'.repeat(64),status:'observed'}]});
test('host preserves the returned execution identity without trusting project or option metadata',async()=>{
 const worker=new DeferredWorker(),identity=runtimeIdentity(),options={runtimeIdentity:{target:'forged'}},promise=analyzeProject(input(),options,'mesh',{createWorker:()=>worker});
 worker.emit('message',{result:{mesh:{summary:{}},runtimeIdentity:identity}});worker.complete();const result=await promise;
 assert.deepEqual(result.calculation.runtimeIdentity,identity);assert.equal(result.runtimeIdentity,undefined);identity.assets[0].bytes=999;assert.equal(result.calculation.runtimeIdentity.assets[0].bytes,10);
});
test('wrong host or isolation identity cannot be published, while legacy Workers remain compatible',async()=>{
 for(const change of [value=>value.target='browser',value=>value.isolation='process',value=>value.assets[0].sha256='bad']){
  const worker=new DeferredWorker(),identity=runtimeIdentity();change(identity);const promise=analyzeProject(input(),{},'mesh',{createWorker:()=>worker});worker.emit('message',{result:{mesh:{},runtimeIdentity:identity}});worker.complete();await assert.rejects(promise,/identity|runtime|asset/i);
 }
 const h=launch();h.worker.emit('message',{result:{mesh:{summary:{}}}});h.worker.complete();const result=await h.promise;assert.equal(Object.hasOwn(result.calculation,'runtimeIdentity'),false);
});
