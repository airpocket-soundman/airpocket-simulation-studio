import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
const revision='sha256:'+'a'.repeat(64);
const args=(requestId='one')=>({requestId,expectedResultRevision:revision,format:'png',view:{field:'temperature',camera:{position:[1,2,3]}}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function terminal(api,job){for(let i=0;i<100;i++){const state=api.status(job);if(state.state!=='running')return state;await tick();}throw Error('Export did not terminate');}

test('PNG artifact has real bytes, digest, bounded pages and detached view',async()=>{
 const bytes=new Uint8Array(70000).map((_,i)=>i%251);let received;
 const api=createVisualExportJobs({render:value=>{received=value;value.onProgress(.4);return new Blob([bytes],{type:'image/png'});}}),input=args(),job=await api.start(input);
 input.view.camera.position[0]=99;received.view.camera.position[1]=99;
 const done=await terminal(api,job);assert.equal(done.state,'completed');assert.deepEqual(done.view.camera.position,[1,2,3]);assert.equal(done.artifact.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
 const first=api.artifact(job),last=api.artifact({...job,offset:first.nextOffset});assert.equal(first.nextOffset,65536);assert.equal(last.nextOffset,null);assert.deepEqual(Buffer.concat([Buffer.from(first.data,'base64'),Buffer.from(last.data,'base64')]),Buffer.from(bytes));
 assert.throws(()=>api.artifact({...job,length:65537}),/page/);assert.throws(()=>api.artifact({...job,offset:-1}),/page/);assert.equal(api.artifact({...job,offset:70000}).data,'');
});
test('same request is idempotent while running and rejects conflicts and competing jobs',async()=>{
 let finish,calls=0;const api=createVisualExportJobs({render:()=>{calls++;return new Promise(r=>finish=r);}}),job=await api.start(args());assert.equal((await api.start(args())).jobId,job.jobId);assert.equal(calls,1);
 await assert.rejects(api.start({...args(),seconds:2}),/conflict/);await assert.rejects(api.start(args('two')),/active/);assert.throws(()=>api.artifact(job),/unavailable/);
 finish(new Blob(['ok'],{type:'image/png'}));assert.equal((await terminal(api,job)).state,'completed');assert.equal((await api.start(args())).state,'completed');
});
test('cancel and release abort renderer and never expose late output',async()=>{
 let finish,signal;const api=createVisualExportJobs({render:value=>{signal=value.signal;return new Promise(r=>finish=r);}}),job=await api.start(args());assert.equal(api.cancel(job).state,'cancelled');assert.equal(signal.aborted,true);finish(new Blob(['late'],{type:'image/png'}));await tick();assert.throws(()=>api.artifact(job),/unavailable/);api.release(job);assert.throws(()=>api.status(job),/Unknown/);
 const next=await api.start(args('two'));api.release(next);assert.equal(signal.aborted,true);finish(new Blob(['late'],{type:'image/png'}));await tick();assert.throws(()=>api.status(next),/Unknown/);
});
test('retained byte and count budgets recover after release',async()=>{
 const api=createVisualExportJobs({maxBytes:5,maxJobs:2,render:()=>new Blob(['1234'],{type:'image/png'})}),one=await api.start(args());assert.equal((await terminal(api,one)).state,'completed');const two=await api.start(args('two'));assert.equal((await terminal(api,two)).state,'failed');assert.match(api.status(two).error,/budget/);await assert.rejects(api.start(args('three')),/limit/);api.release(one);const three=await api.start(args('three'));assert.equal((await terminal(api,three)).state,'completed');
});
test('prepare freezes revision/view and rechecks expiry before rendering',async()=>{
 let finishPrepare,renders=0,valid=true;const api=createVisualExportJobs({prepare:()=>new Promise(r=>finishPrepare=r),render:()=>{renders++;return new Blob(['ok'],{type:'image/png'});}});const pending=api.start(args(),{guard:()=>valid});await assert.rejects(api.start(args('other')),/active/);valid=false;finishPrepare({resultRevision:revision,view:{field:'temperature'}});await assert.rejects(pending,/expired/);assert.equal(renders,0);
 const wrong=createVisualExportJobs({prepare:async()=>({resultRevision:'other',view:{}}),render:()=>{renders++;}});await assert.rejects(wrong.start(args()),/revision conflict/);assert.equal(renders,0);
});
test('WebM metadata, renderer errors and invalid requests are explicit',async()=>{
 const api=createVisualExportJobs({render:()=>new Blob(['webm'],{type:'video/webm;codecs=vp9'})}),job=await api.start({...args(),format:'webm',animation:'time',seconds:15});assert.equal((await terminal(api,job)).artifact.mimeType,'video/webm;codecs=vp9');
 for(const patch of [{requestId:''},{expectedResultRevision:'bad'},{format:'jpeg'},{animation:'random'},{seconds:16}])await assert.rejects(api.start({...args('bad'),...patch}));
 const broken=createVisualExportJobs({render:()=>{throw Error('encoder failed');}}),failed=await broken.start(args());assert.equal((await terminal(broken,failed)).error,'encoder failed');
 const mime=createVisualExportJobs({render:()=>new Blob(['x'],{type:'text/plain'})}),invalid=await mime.start(args());assert.equal((await terminal(mime,invalid)).state,'failed');
});

test('release keeps renderer exclusive until aborted renderer actually settles',async()=>{
 let finish;const api=createVisualExportJobs({render:()=>new Promise(resolve=>finish=resolve)}),job=await api.start(args());api.release(job);await assert.rejects(api.start(args('next')),/active/);finish(new Blob(['late'],{type:'image/png'}));await tick();const next=await api.start(args('next'));assert.equal(next.state,'running');api.cancelAll();finish(new Blob(['late'],{type:'image/png'}));await tick();assert.equal(api.status(next).state,'cancelled');
});
test('disconnect during preparation prevents renderer start and concurrent retries share admission',async()=>{
 let complete,calls=0;const api=createVisualExportJobs({prepare:()=>new Promise(resolve=>complete=resolve),render:()=>{calls++;return new Blob(['x'],{type:'image/png'});}}),one=api.start(args()),retry=api.start(args());api.cancelAll();complete({resultRevision:revision,view:{field:'temperature'}});await assert.rejects(one,/expired/);await assert.rejects(retry,/expired/);assert.equal(calls,0);
});
