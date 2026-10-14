import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAnalysisJobs} from '../src/analysis-jobs.js';

test('jobs freeze input, retry idempotently, guard identities and page bounded events',async()=>{
 let execution,finish;const manager=createAnalysisJobs({maxEvents:3,maxJobs:1,execute:input=>{execution=input;return new Promise(resolve=>finish=resolve);}});
 const input={project:{name:'original'},options:{nested:{size:2}},inputRevision:'rev-1',requestId:'request-1'};
 const first=manager.start(input);assert.equal(first.state,'running');
 assert.equal(manager.start(structuredClone(input)).jobId,first.jobId);
 assert.equal(manager.start({requestId:'request-1',inputRevision:'rev-1',options:{nested:{size:2}},project:{name:'original'}}).jobId,first.jobId);
 assert.throws(()=>manager.start({...input,options:{}}),/different input/);
 input.project.name='edited';input.options.nested.size=99;
 await nextTurn();assert.equal(execution.project.name,'original');assert.equal(execution.options.nested.size,2);
 for(let i=0;i<6;i++)execution.onEvent({stage:'iteration',iteration:i,jobId:'forged',inputRevision:'wrong',sequence:999});
 const page=manager.events(first.jobId,{afterSequence:0,limit:2});assert.equal(page.truncated,true);assert.equal(page.events.length,2);assert.equal(page.hasMore,true);
 assert.ok(page.events.every(e=>e.jobId===first.jobId&&e.inputRevision==='rev-1'&&e.sequence<999));
 const last=manager.events(first.jobId,{afterSequence:page.nextSequence});assert.equal(last.hasMore,false);
 assert.throws(()=>manager.events(first.jobId,{afterSequence:999}),/cursor/);
 assert.throws(()=>manager.start({project:{},inputRevision:'next'}),/retention/);
 assert.throws(()=>manager.release(first.jobId),/terminal/);
 execution.beginCommit();assert.equal(manager.cancel(first.jobId).cancelled,false);assert.equal(manager.get(first.jobId).state,'saving');
 finish({artifact:'saved'});await nextTurn();assert.equal(manager.get(first.jobId).state,'succeeded');
 const copy=manager.get(first.jobId);copy.result.artifact='tampered';assert.equal(manager.get(first.jobId).result.artifact,'saved');
 manager.release(first.jobId);assert.throws(()=>manager.get(first.jobId),/Unknown job/);
 manager.close();
});

test('cancellation and timeout are terminal, abort execution and ignore late results',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const calls=[];const manager=createAnalysisJobs({timeoutMs:25,execute:input=>{calls.push(input);return new Promise(resolve=>input.late=resolve);}});
 const a=manager.start({project:{},inputRevision:'a'});await nextTurn();assert.equal(manager.cancel(a.jobId).cancelled,true);assert.equal(calls[0].signal.aborted,true);
 const seq=manager.get(a.jobId).lastSequence;calls[0].onEvent({stage:'late'});calls[0].late({wrong:true});await nextTurn();assert.equal(manager.get(a.jobId).lastSequence,seq);assert.equal(manager.get(a.jobId).state,'cancelled');
 const b=manager.start({project:{},inputRevision:'b'});await nextTurn();t.mock.timers.tick(40);assert.equal(manager.get(b.jobId).state,'timed_out');assert.equal(calls[1].signal.aborted,true);calls[1].late({wrong:true});
 const c=manager.start({project:{},inputRevision:'c'});await nextTurn();manager.close();assert.equal(manager.get(c.jobId).state,'cancelled');calls[2].late({});
});

test('execution failures retain diagnostics and uncloneable inputs never start jobs',async()=>{
 const manager=createAnalysisJobs({maxJobs:1,execute:()=>{throw Error('Failed mesh');}});
 assert.throws(()=>manager.start({project:{},inputRevision:'x',options:{bad:()=>{}}}));
 const job=manager.start({project:{},inputRevision:'x'});await nextTurn();assert.deepEqual(manager.get(job.jobId).error,{code:'JOB_FAILED',message:'Failed mesh'});manager.close();
});
