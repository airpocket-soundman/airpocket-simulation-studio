import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkerObservationTransport} from '../src/worker-observation-transport.js';
import {estimateObservationBytes} from '../src/job-observation-queue.js';

test('synchronous observation flood has separate bounded in-flight and outbox budgets, coalesces scalar iterations and reports loss',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:2,maxBytes:10000,maxOutboxEvents:2,maxOutboxBytes:10000});
 for(let i=0;i<10000;i++)sender.post({stage:'iteration',metrics:{iteration:i}});
 assert.equal(messages.length,2);assert.equal(sender.snapshot().dropped,9997);assert.equal(sender.snapshot().peakEvents,2);assert.equal(sender.snapshot().outboxEvents,1);assert.equal(sender.snapshot().outboxPeakEvents,1);
 sender.close();sender.close();assert.equal(messages.length,3);
 assert.equal(messages[2].event.observationTransport.dropped,9998);assert.equal(messages[2].event.observationTransport.droppedReasons['terminal-unflushed'],1);assert.equal(messages[2].event.observationTransport.terminal,true);
 assert.ok(estimateObservationBytes(messages[2],4096)<=4096);
 assert.equal(sender.snapshot().pendingBytes,0);assert.equal(sender.post({stage:'late'}),false);
});
test('ACKs recover exact credits and pump the FIFO outbox; duplicates and unknown ACKs are ignored',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:1,maxBytes:10000});
 sender.post({stage:'first'});for(const id of [0,2,-1,1.5,'1',null])assert.equal(sender.acknowledge(id),false);
 assert.equal(sender.post({stage:'blocked'}),true);assert.equal(sender.snapshot().outboxEvents,1);assert.equal(sender.acknowledge(1),true);assert.equal(sender.acknowledge(1),false);
 assert.equal(messages[1].observationAckId,2);assert.equal(sender.post({stage:'recovered'}),true);assert.equal(sender.snapshot().outboxEvents,1);assert.equal(sender.acknowledge(2),true);assert.equal(messages[2].observationAckId,3);assert.equal(sender.snapshot().pendingEvents,1);
});
test('oversize/remesh loss prevents fields binding to an earlier mesh until a new mesh is sent',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:2,maxBytes:6000});
 assert.equal(sender.post({stage:'mesh',mesh:{nodes:[0,0,0]}}),true);sender.acknowledge(1);
 assert.equal(sender.post({stage:'mesh',mesh:{nodes:new Float64Array(10000)}}),false);
 assert.equal(sender.post({stage:'field',field:{temperature:[20]}}),false);
 assert.equal(sender.post({stage:'mesh',mesh:{nodes:[1,1,1]}}),true);
 assert.equal(sender.post({stage:'field',field:{temperature:[30]}}),true);
 assert.equal(sender.snapshot().droppedMeshes,1);assert.equal(sender.snapshot().droppedFields,1);
 assert.ok(sender.snapshot().peakBytes<=6000);
});
test('byte credit includes the actual envelope metadata and is freed after ACK',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:8,maxBytes:3000});
 assert.equal(sender.post({stage:'one'}),true);
 assert.equal(sender.snapshot().pendingBytes,estimateObservationBytes(messages[0],3000));
 assert.equal(sender.post({stage:'two'}),true);assert.equal(sender.snapshot().outboxEvents,1);
 sender.acknowledge(1);assert.equal(sender.snapshot().pendingBytes,estimateObservationBytes(messages[1],3000));
 assert.equal(sender.post({stage:'three'}),true);assert.equal(sender.snapshot().outboxEvents,1);
});
test('post failure releases credit and cannot establish a mesh for following fields',()=>{
 let fail=true;const messages=[],sender=createWorkerObservationTransport({send:m=>{if(fail)throw Error('clone failed');messages.push(m);},maxEvents:1});
 assert.throws(()=>sender.post({stage:'mesh',mesh:{nodes:[0,0,0]}}),/clone failed/);
 assert.equal(sender.snapshot().pendingEvents,0);assert.equal(sender.snapshot().pendingBytes,0);
 fail=false;assert.equal(sender.post({stage:'field',field:{temperature:[20]}}),false);
 assert.equal(sender.post({stage:'mesh',mesh:{nodes:[0,0,0]}}),true);
 assert.equal(messages.length,1);
});

test('drain resolves only after outbox deliveries are acknowledged and coalescing retains the latest scalar state',async()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:1,maxBytes:10000,maxOutboxEvents:3,maxOutboxBytes:10000});
 sender.post({stage:'iteration',solver:'pcg',phase:'restart',iteration:0,residual:1});
 sender.post({stage:'iteration',solver:'pcg',phase:'restart',iteration:1,residual:.5});
 sender.post({stage:'iteration',solver:'pcg',phase:'restart',iteration:2,residual:.25});
 sender.post({stage:'iteration',solver:'pcg',phase:'final-check',iteration:3,residual:.1});
 sender.post({stage:'frequency-step',phase:'complete',step:1,frequencyHz:500,metrics:{residual:.01}});
 assert.equal(sender.snapshot().maxTotalEvents,4);assert.ok(sender.snapshot().outboxEvents<=3);assert.ok(sender.snapshot().outboxBytes<=10000);
 let drained=false;const draining=sender.drain().then(()=>drained=true);await Promise.resolve();assert.equal(drained,false);
 for(let turn=0;turn<10&&!drained;turn++){sender.acknowledge(messages.at(-1).observationAckId);await Promise.resolve();}
 await draining;assert.equal(drained,true);assert.ok(messages.some(message=>message.event.phase==='final-check'));assert.ok(messages.some(message=>message.event.stage==='frequency-step'&&message.event.phase==='complete'));
 const lastIteration=messages.filter(message=>message.event.stage==='iteration'&&message.event.phase==='restart').at(-1);assert.equal(lastIteration.event.iteration,2);
});

test('FIFO outbox preserves a queued mesh before its dependent field even after ACK restores credit',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:1,maxBytes:10000,maxOutboxEvents:2,maxOutboxBytes:10000});
 sender.post({stage:'iteration',solver:'pcg',iteration:1});
 sender.post({stage:'mesh',mesh:{nodes:[1,2,3]}});sender.post({stage:'field',field:{temperature:[20]}});
 assert.equal(messages.length,1);assert.equal(sender.snapshot().outboxEvents,2);
 sender.acknowledge(messages[0].observationAckId);assert.equal(messages[1].event.stage,'mesh');assert.equal(messages.length,2);
 sender.acknowledge(messages[1].observationAckId);assert.equal(messages[2].event.stage,'field');assert.equal(sender.snapshot().droppedFields,0);
});

test('full-payload iteration events are neither coalesced nor priority-evicted as scalar summaries',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:1,maxBytes:10000,maxOutboxEvents:2,maxOutboxBytes:10000});
 sender.post({stage:'mesh',mesh:{nodes:[0,0,0]}});sender.acknowledge(1);sender.post({stage:'hold'});
 sender.post({stage:'iteration',solver:'stokes',phase:'restart-check',field:{value:[1]}});
 sender.post({stage:'iteration',solver:'stokes',phase:'restart-check',field:{value:[2]}});
 assert.equal(sender.snapshot().outboxEvents,2);assert.equal(sender.snapshot().dropped,0);
 sender.acknowledge(2);assert.deepEqual(messages.at(-1).event.field,{value:[1]});sender.acknowledge(messages.at(-1).observationAckId);
 assert.deepEqual(messages.at(-1).event.field,{value:[2]});
});

test('a send failure while pumping rejects drain instead of leaving it pending',async()=>{
 let fail=false;const messages=[],sender=createWorkerObservationTransport({send:m=>{if(fail)throw Error('pipe closed');messages.push(m);},maxEvents:1,maxBytes:10000});
 sender.post({stage:'first'});sender.post({stage:'queued'});const drain=sender.drain();fail=true;sender.acknowledge(messages[0].observationAckId);
 await assert.rejects(drain,/pipe closed/);fail=false;sender.close();assert.equal(messages.at(-1).event.observationTransport.droppedReasons['send-failure'],1);
});

test('queued observations are structured-cloned at acceptance so later solver mutation cannot alter them',()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:1,maxBytes:10000,maxOutboxEvents:4,maxOutboxBytes:10000});
 sender.post({stage:'hold'});
 const metrics={residual:.4},nodes=[1,2,3],temperature=[10];
 sender.post({stage:'iteration',solver:'pcg',phase:'restart',metrics});
 sender.post({stage:'mesh',mesh:{nodes}});
 sender.post({stage:'field',field:{temperature}});
 metrics.residual=99;nodes[0]=99;temperature[0]=99;
 sender.acknowledge(1);assert.equal(messages[1].event.metrics.residual,.4);
 sender.acknowledge(messages[1].observationAckId);assert.deepEqual(messages[2].event.mesh.nodes,[1,2,3]);
 sender.acknowledge(messages[2].observationAckId);assert.deepEqual(messages[3].event.field.temperature,[10]);
});

test('outbox clone failure leaves existing queue and byte accounting intact and rejects drain',async()=>{
 const messages=[],sender=createWorkerObservationTransport({send:m=>messages.push(m),maxEvents:1,maxBytes:10000,maxOutboxEvents:2,maxOutboxBytes:10000});
 sender.post({stage:'hold'});sender.post({stage:'queued',value:1});
 const before=sender.snapshot();
 const uncloneable=new Proxy({}, {ownKeys:()=>[],getPrototypeOf:()=>Object.prototype});
 assert.equal(sender.post({stage:'bad',value:uncloneable}),false);
 const after=sender.snapshot();assert.equal(after.outboxEvents,before.outboxEvents);assert.equal(after.outboxBytes,before.outboxBytes);
 await assert.rejects(sender.drain());sender.close();
 assert.equal(messages.at(-1).event.observationTransport.droppedReasons['outbox-clone-failure'],1);
});
