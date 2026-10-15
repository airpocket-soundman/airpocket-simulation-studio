import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAnalysisJobs} from '../src/analysis-jobs.js';
import {analysisError,createAnalysisFailure} from '../src/analysis-failure.js';
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
async function running(config={}){let input,finish;const api=createAnalysisJobs({execute:value=>{input=value;return new Promise(resolve=>finish=resolve);},...config}),job=api.start({project:{},inputRevision:'input-A'});await nextTurn();return {api,job,input,finish};}

test('event byte eviction preserves the original cursor sequence and exposes exact bounded retention metadata',async()=>{
 const h=await running({maxRetainedEventBytes:32768});try{
  for(let i=0;i<5;i++)h.input.onEvent({stage:'iteration',index:i,message:'x'.repeat(20000)});
  const page=h.api.events(h.job.jobId,{limit:100});assert.equal(page.events.length,1);assert.equal(page.events[0].index,4);assert.equal(page.events[0].sequence,6);assert.equal(page.firstAvailableSequence,6);assert.equal(page.truncated,true);assert.equal(page.nextSequence,6);assert.equal(page.hasMore,false);
  assert.equal(page.eventRetention.retainedEvents,1);assert.equal(page.eventRetention.retainedBytes,bytes(page.events[0]));assert.equal(page.eventRetention.maxRetainedBytes,32768);assert.equal(page.eventRetention.maxEventBytes,32768);assert.equal(page.eventRetention.maxEvents,256);assert.equal(page.eventPageBytes,bytes(page));assert.ok(bytes(page)<=65536);
  assert.equal(h.api.events(h.job.jobId,{afterSequence:5}).truncated,false);assert.equal(h.api.events(h.job.jobId,{afterSequence:6}).events.length,0);
  h.finish({ok:true});await h.api.drain();assert.equal(h.api.get(h.job.jobId).state,'succeeded');
 }finally{h.api.close();h.finish({});await h.api.drain();}
});

test('oversized or unsafe progress becomes a same-sequence gap without invoking getters or losing lifecycle',async()=>{
 const h=await running();let called=0;try{
  h.input.onEvent({stage:'large',message:'😀'.repeat(40000)});const unsafe={stage:'unsafe'};Object.defineProperty(unsafe,'hidden',{enumerable:true,get(){called++;throw Error('getter');}});h.input.onEvent(unsafe);
  const page=h.api.events(h.job.jobId,{limit:100});assert.deepEqual(page.events.map(e=>e.sequence),[1,2,3]);assert.equal(page.events[1].payloadOmitted,true);assert.equal(page.events[1].stage,'observation-event-gap');assert.equal(page.events[1].type,'progress');assert.equal(page.events[2].payloadOmitted,true);assert.equal(called,0);assert.ok(page.events.every(e=>bytes(e)<=32768));
  h.finish({ok:true});await h.api.drain();const done=h.api.get(h.job.jobId);assert.equal(done.state,'succeeded');assert.equal(done.executionSettled,true);assert.deepEqual(done.result,{ok:true});
 }finally{h.api.close();h.finish({});await h.api.drain();}
});

test('whole event pages obey their byte budget and cursor traversal visits each retained event exactly once',async()=>{
 const h=await running();try{
  for(let i=0;i<20;i++)h.input.onEvent({stage:'iteration',index:i,message:'x'.repeat(22000)});
  let cursor=0,seen=[];do{const page=h.api.events(h.job.jobId,{afterSequence:cursor,limit:100});assert.equal(page.eventPageBytes,bytes(page));assert.ok(bytes(page)<=page.eventRetention.maxPageBytes);assert.ok(page.events.length<100);seen.push(...page.events.map(e=>e.sequence));assert.ok(page.nextSequence>cursor);cursor=page.nextSequence;if(!page.hasMore)break;}while(true);
  assert.deepEqual(seen,Array.from({length:21},(_,i)=>i+1));
 }finally{h.api.close();h.finish({});await h.api.drain();}
});

test('bounded job views explicitly omit oversized summaries while preserving valid failures and terminal ownership',async()=>{
 const failure=createAnalysisFailure(analysisError('ANALYSIS_TEST','specific diagnostic',{stage:'solve',evidence:{values:Array(16).fill('x'.repeat(400))}}));
 const success=createAnalysisJobs({execute:()=>({small:'preserved',huge:'x'.repeat(100000)})}),one=success.start({project:{},inputRevision:'one'});await success.drain();const done=success.get(one.jobId);assert.equal(done.state,'succeeded');assert.equal(done.result.small,'preserved');assert.ok(done.result.summaryOmissions.length);assert.ok(bytes(done)<=24576);assert.ok(bytes(success.events(one.jobId))<=65536);
 const failed=createAnalysisJobs({execute:()=>{throw Object.assign(Error('😀'.repeat(100000)),{analysisFailure:failure});}}),two=failed.start({project:{},inputRevision:'two'});await failed.drain();const view=failed.get(two.jobId);assert.equal(view.state,'failed');assert.equal(view.error.code,'JOB_FAILED');assert.equal(view.error.messageTruncated,true);assert.equal(view.error.originalMessageLength,200000);assert.deepEqual(view.error.failure,failure);assert.ok(bytes(view)<=24576);assert.equal(view.releaseAllowed,true);failed.release(two.jobId);
 let called=0;const malicious={};Object.defineProperty(malicious,'message',{get(){called++;throw Error('getter');}});const rejected=createAnalysisJobs({execute:()=>{throw malicious;}}),three=rejected.start({project:{},inputRevision:'three'});await rejected.drain();assert.equal(called,0);assert.equal(rejected.get(three.jobId).state,'failed');
});

test('host limits and unbounded envelope identities are rejected before registry changes',()=>{
 for(const config of [{maxEvents:257},{maxEventBytes:24575},{maxEventBytes:32769},{maxJobViewBytes:24575},{maxRetainedEventBytes:32767},{maxRetainedEventBytes:1048577},{maxEventPageBytes:59391},{maxEventPageBytes:65537},{maxEventBytes:NaN}])assert.throws(()=>createAnalysisJobs({execute:()=>{},...config}));
 const api=createAnalysisJobs({execute:()=>{},id:()=> 'x'.repeat(201)});assert.throws(()=>api.start({project:{},inputRevision:'ok'}));assert.equal(api.list().total,0);assert.throws(()=>api.start({project:{},inputRevision:'x'.repeat(201)}));
});
