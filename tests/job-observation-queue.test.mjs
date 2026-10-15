import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createJobObservationQueue,estimateObservationBytes} from '../src/job-observation-queue.js';
import {createAnalysisClient} from '../src/analysis-client.js';
import {createHeadlessJobService} from '../scripts/analysis-job-service.mjs';
import {createProjectFromBuiltin} from '../src/project-import.js';
const mesh=()=>({nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]});
const field=()=>({kind:'thermal',time:1,temperature:[20,30,40,50],units:{temperature:'degC'}});
const next=()=>new Promise(resolve=>setImmediate(resolve));

test('queue reserves count and structural bytes before consumption including in-flight payloads, while scalar events bypass',async()=>{
 let release;const consumed=[],summaries=[],drops=[],event={mesh:mesh()},bytes=estimateObservationBytes(event);
 const queue=createJobObservationQueue({maxEvents:2,maxBytes:bytes*2,consume:async(value,metadata)=>{consumed.push(metadata.observationSequence);await new Promise(resolve=>release=resolve);},onSummary:(_event,metadata)=>summaries.push(metadata.observationSequence),onDrop:(_event,metadata)=>drops.push(metadata)});
 assert.equal(queue.push(event).accepted,true);assert.equal(queue.push(event).accepted,true);assert.equal(queue.push(event).reason,'pending-events');
 queue.push({stage:'diagnostic',failure:{code:'TEST'}});assert.deepEqual(summaries,[4]);assert.equal(queue.snapshot().pendingEvents,2);assert.equal(queue.snapshot().pendingBytes,bytes*2);
 const drained=queue.drain();let settled=false;drained.then(()=>settled=true);await next();assert.equal(settled,false);
 queue.close();assert.equal(queue.snapshot().pendingEvents,1);release();await drained;assert.deepEqual(consumed,[1]);assert.equal(queue.snapshot().pendingBytes,0);assert.equal(queue.snapshot().latestAcceptedSequence,2);assert.equal(queue.snapshot().latestCompletedSequence,1);assert.equal(queue.push(event).reason,'closed');assert.equal(drops.length,1);
 let finish;const byteQueue=createJobObservationQueue({maxEvents:8,maxBytes:bytes,consume:()=>new Promise(resolve=>finish=resolve)});assert.equal(byteQueue.push(event).accepted,true);assert.equal(byteQueue.push(event).reason,'pending-bytes');byteQueue.close();finish();await byteQueue.drain();
});

test('failed mesh consumption invalidates already queued dependent fields and notification errors do not strand drain',async()=>{
 let reject;const consumed=[],drops=[];
 const queue=createJobObservationQueue({consume:async event=>{consumed.push(event);await new Promise((_resolve,fail)=>reject=fail);},onDrop:(_event,metadata)=>{drops.push(metadata.reason);throw Error('notification failed');},onError:()=>{throw Error('error notification failed');},onSummary:()=>{throw Error('summary failed');}});
 queue.push({mesh:mesh()});queue.push({field:field()});queue.push({stage:'diagnostic'});reject(Error('mesh failed'));await queue.drain();
 assert.equal(consumed.length,1);assert.deepEqual(drops,['mesh-consumer-failed']);assert.equal(queue.snapshot().pendingEvents,0);assert.equal(queue.snapshot().consumerErrors,1);assert.equal(queue.snapshot().notificationErrors,3);
 assert.equal(queue.push({field:field()}).reason,'mesh-unavailable');assert.equal(queue.push({mesh:mesh(),field:field()}).reason,'mixed-payload');queue.close();await queue.drain();
});

test('oversized mesh and dependent fields are omitted without serialization, and latest means last accepted snapshot',async()=>{
 let release;const drops=[],queue=createJobObservationQueue({maxEvents:1,maxBytes:2000,consume:()=>new Promise(resolve=>release=resolve),onDrop:(_event,metadata)=>drops.push(metadata)});
 queue.push({mesh:mesh()});assert.equal(queue.push({mesh:mesh()}).reason,'pending-events');assert.equal(queue.push({field:field()}).reason,'mesh-unavailable');release();await queue.drain();assert.equal(queue.push({field:field()}).reason,'mesh-unavailable');
 let called=false;const giant={mesh:{nodes:new Float64Array(1000),toJSON(){called=true;throw Error('must not serialize');}}};assert.equal(queue.push(giant).reason,'single-payload-bytes');assert.equal(called,false);assert.equal(queue.snapshot().latestAcceptedSequence,1);assert.ok(drops.every(drop=>drop.includesInFlight));queue.close();
 for(const config of [{maxEvents:0},{maxEvents:1.5},{maxEvents:1025},{maxBytes:0},{maxBytes:Infinity},{maxBytes:64_000_001}])assert.throws(()=>createJobObservationQueue({consume(){},...config}));
 for(const value of [null,0,Infinity,1.5]){assert.throws(()=>createAnalysisClient(()=>({}),()=>{},{maxPendingObservationEvents:value}));assert.throws(()=>createHeadlessJobService({maxPendingObservationBytes:value}));}
});

test('browser queue overflow preserves summaries, final output and immutable source order metadata',async()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,1,1,1]}}),workers=[];
 const api=createAnalysisClient(()=>project,()=>{},{maxPendingObservationEvents:2,isIsolated:()=>true,baseUrl:()=>'/fixture/',createWorker:()=>{const worker={postMessage(){},terminate(){},send(data){this.onmessage({data});}};workers.push(worker);return worker;}});
 const job=api.startJob({inputRevision:'test-version',operation:'mesh',includeFields:true});await next();const worker=workers[0];worker.send({event:{stage:'mesh',mesh:mesh()}});
 for(let i=0;i<20;i++)worker.send({event:{stage:'time-step',step:i+1,field:field()}});
 worker.send({result:{mesh:mesh(),result:{kind:'thermal',temperature:[100,100,100,100]}}});await api.drainJobs();
 const done=api.getJob(job.jobId),queue=done.result.intermediate.queue;assert.equal(done.state,'succeeded');assert.equal(queue.peakEvents,2);assert.equal(queue.dropped,19);assert.equal(queue.pendingEvents,0);assert.equal(queue.latestPolicy,'last-accepted-snapshot');
 assert.deepEqual(api.getJobResult(job.jobId).result.temperature,[100,100,100,100]);assert.equal(api.listJobArtifacts(job.jobId).total,2);
 const events=api.jobEvents(job.jobId,{limit:100}).events;assert.equal(events.filter(event=>event.stage==='time-step').length,20);assert.ok(events.some(event=>event.stage==='observation-queue-limit'&&event.observationQueue.dropped===19));assert.ok(events.filter(event=>event.stage==='time-step').every(event=>Number.isInteger(event.observationSequence)));
 api.releaseJob(job.jobId);
 const cancelled=api.startJob({inputRevision:'cancel',operation:'mesh',includeFields:true});await next();workers[1].send({event:{stage:'mesh',mesh:mesh()}});workers[1].send({event:{stage:'time-step',field:field()}});await api.closeJobsAsync();workers[1].send({event:{stage:'time-step',field:field()}});assert.equal(api.getJob(cancelled.jobId).state,'cancelled');assert.equal(api.getJob(cancelled.jobId).executionSettled,true);
});

test('Node queue single-payload overflow retains complete final mesh and publishes queue limits',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'observation-queue-')),service=createHeadlessJobService({maxPendingObservationBytes:1});
 try{const path=join(directory,'input.json'),outputPath=join(directory,'output.json');await writeFile(path,JSON.stringify(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,1,1,1]}})));
  const job=await service.start({path,outputPath,requestId:'queue-limit',operation:'mesh',includeFields:true});await service.drain();const done=service.get(job.jobId);assert.equal(done.state,'succeeded',JSON.stringify(done.error));assert.equal(done.result.intermediateQueue.droppedMeshes,1);assert.equal(done.result.intermediateQueue.maxBytes,1);assert.equal(service.listArtifacts(job.jobId).total,0);assert.ok(JSON.parse(await readFile(outputPath,'utf8')).mesh.tetrahedra.length);assert.ok(service.events(job.jobId,{limit:100}).events.some(event=>event.stage==='observation-queue-limit'));service.release(job.jobId);
 }finally{await service.closeAsync();await rm(directory,{recursive:true,force:true});}
});
