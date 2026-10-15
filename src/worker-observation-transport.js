import {estimateObservationBytes,validateObservationQueueLimits,observationQueueDefaults} from './job-observation-queue.js';

// In-flight and unsent observations have separate fixed budgets. Solver callbacks
// never wait: overflow is coalesced where safe or reported as a drop.
// A single terminal control envelope is reserved outside both budgets (<=4096 bytes).
export function createWorkerObservationTransport({send,maxEvents=observationQueueDefaults.maxEvents,maxBytes=observationQueueDefaults.maxBytes,maxOutboxEvents=maxEvents,maxOutboxBytes=maxBytes}={}){
 validateObservationQueueLimits(maxEvents,maxBytes);validateObservationQueueLimits(maxOutboxEvents,maxOutboxBytes);
 if(typeof send!=='function')throw TypeError('Invalid observation transport sender');
 const pending=new Map(),outbox=[];
 const droppedReasons={'mixed-payload':0,'mesh-unavailable':0,'single-payload-bytes':0,'pending-events':0,'pending-bytes':0,'outbox-capacity':0,'outbox-coalesced':0,'outbox-priority-eviction':0,'terminal-unflushed':0,'send-failure':0,'outbox-clone-failure':0};
 let sequence=0,pendingBytes=0,outboxBytes=0,peakEvents=0,peakBytes=0,outboxPeakEvents=0,outboxPeakBytes=0,accepted=0,dropped=0,droppedMeshes=0,droppedFields=0,meshAvailable=false,meshGeneration=0,sentMeshGeneration=0,closed=false,failure=null;
 const waiters=[];
 const snapshot=()=>({schemaVersion:1,maxEvents,maxBytes,maxOutboxEvents,maxOutboxBytes,maxTotalEvents:maxEvents+maxOutboxEvents,maxTotalBytes:maxBytes+maxOutboxBytes,terminalControlMaxEvents:1,terminalControlMaxBytes:4096,pendingEvents:pending.size,pendingBytes,outboxEvents:outbox.length,outboxBytes,peakEvents,peakBytes,outboxPeakEvents,outboxPeakBytes,accepted,dropped,droppedMeshes,droppedFields,sourceSequence:sequence,byteBasis:'conservative-structural-envelope-estimate-including-transport-metadata',policy:'drop-immediately-or-coalesce-without-waiting',scope:'worker-observations'});
 const countDrop=(event,reason)=>{dropped++;droppedReasons[reason]++;if(event.mesh)droppedMeshes++;if(event.field)droppedFields++;};
 const settle=()=>{if(failure){while(waiters.length)waiters.shift().reject(failure);return;}if(!outbox.length&&!pending.size)while(waiters.length)waiters.shift().resolve();};
 const envelopeFor=entry=>({event:{...entry.event,observationTransport:{sequence:entry.id,...snapshot()}},observationAckId:entry.id});
 const eventBytes=entry=>estimateObservationBytes(envelopeFor(entry),maxOutboxBytes);
 const isIteration=event=>event.stage==='iteration'&&event.phase!=='final-check'&&!event.mesh&&!event.field;
 const iterationKey=entry=>JSON.stringify([entry.event.solver??null,entry.event.phase??null,entry.event.residualKind??null,entry.event.solvePhase??null,entry.event.step??null,entry.event.velocityElement??null,entry.event.kind??null,entry.event.frequencyHz??null,entry.meshGeneration]);
 const priority=event=>event.stage==='iteration'&&event.phase==='final-check'||event.stage==='frequency-step';
 function dispatch(entry){
  if(entry.event.field&&entry.meshGeneration!==sentMeshGeneration){countDrop(entry.event,'mesh-unavailable');return false;}
  const envelope=envelopeFor(entry),bytes=estimateObservationBytes(envelope,maxBytes);
  if(bytes>maxBytes){countDrop(entry.event,'single-payload-bytes');return false;}
  if(pending.size>=maxEvents||pendingBytes+bytes>maxBytes)return false;
  pending.set(entry.id,bytes);pendingBytes+=bytes;peakEvents=Math.max(peakEvents,pending.size);peakBytes=Math.max(peakBytes,pendingBytes);
  try{send(envelope);accepted++;if(entry.event.mesh)sentMeshGeneration=entry.meshGeneration;return true;}
  catch(error){pending.delete(entry.id);pendingBytes-=bytes;failure=error;countDrop(entry.event,'send-failure');settle();throw error;}
 }
 function pump(){
  try{while(!closed&&outbox.length){const entry=outbox[0];const envelope=envelopeFor(entry),bytes=estimateObservationBytes(envelope,maxBytes);if(bytes>maxBytes){outbox.shift();outboxBytes-=entry.bytes;countDrop(entry.event,'single-payload-bytes');if(entry.event.mesh&&entry.meshGeneration===meshGeneration)meshAvailable=false;continue;}if(pending.size>=maxEvents||pendingBytes+bytes>maxBytes)break;outbox.shift();outboxBytes-=entry.bytes;dispatch(entry);}}
  catch(error){failure=error;for(const entry of outbox)countDrop(entry.event,'send-failure');outbox.length=0;outboxBytes=0;}
  settle();
 }
 function enqueue(entry){
  entry.bytes=eventBytes(entry);
  if(entry.bytes>maxOutboxBytes){countDrop(entry.event,'single-payload-bytes');return false;}
  let replacementIndex=-1;
  if(isIteration(entry.event)){
   const key=iterationKey(entry);replacementIndex=outbox.findIndex(item=>isIteration(item.event)&&iterationKey(item)===key);
   if(replacementIndex>=0){const previous=outbox[replacementIndex];if(outboxBytes-previous.bytes+entry.bytes>maxOutboxBytes)replacementIndex=-1;}
  }
  const evictionIndexes=[];let projectedEvents=outbox.length,projectedBytes=outboxBytes;
  while(replacementIndex<0&&(projectedEvents>=maxOutboxEvents||projectedBytes+entry.bytes>maxOutboxBytes)){
   if(!priority(entry.event))break;
   const index=outbox.findIndex((item,itemIndex)=>!evictionIndexes.includes(itemIndex)&&isIteration(item.event)&&item.event.phase!=='final-check');if(index<0)break;
   evictionIndexes.push(index);projectedEvents--;projectedBytes-=outbox[index].bytes;
  }
  if(replacementIndex<0&&(projectedEvents>=maxOutboxEvents||projectedBytes+entry.bytes>maxOutboxBytes)){countDrop(entry.event,'outbox-capacity');return false;}
  let cloned;
  try{cloned={...entry,event:structuredClone(entry.event)};cloned.bytes=eventBytes(cloned);}
  catch(error){failure=error;countDrop(entry.event,'outbox-clone-failure');settle();return false;}
  if(cloned.bytes>maxOutboxBytes||(replacementIndex<0&&projectedBytes+cloned.bytes>maxOutboxBytes)||(replacementIndex>=0&&outboxBytes-outbox[replacementIndex].bytes+cloned.bytes>maxOutboxBytes)){countDrop(entry.event,'single-payload-bytes');return false;}
  for(const index of evictionIndexes.sort((a,b)=>b-a)){const [evicted]=outbox.splice(index,1);outboxBytes-=evicted.bytes;countDrop(evicted.event,'outbox-priority-eviction');}
  if(replacementIndex>=0){const previous=outbox[replacementIndex];outbox[replacementIndex]=cloned;outboxBytes+=cloned.bytes-previous.bytes;countDrop(previous.event,'outbox-coalesced');outboxPeakBytes=Math.max(outboxPeakBytes,outboxBytes);return true;}
  outbox.push(cloned);outboxBytes+=cloned.bytes;outboxPeakEvents=Math.max(outboxPeakEvents,outbox.length);outboxPeakBytes=Math.max(outboxPeakBytes,outboxBytes);return true;
 }
 return Object.freeze({snapshot,
  post(event){
   if(closed)return false;
   const id=++sequence;if(event.mesh){meshGeneration++;meshAvailable=false;}const entry={id,event,meshGeneration};
   const reason=event.mesh&&event.field?'mixed-payload':event.field&&!meshAvailable?'mesh-unavailable':null;
   if(reason){countDrop(event,reason);return false;}
   if(event.field&&!outbox.length&&entry.meshGeneration!==sentMeshGeneration){countDrop(event,'mesh-unavailable');return false;}
   if(estimateObservationBytes(envelopeFor(entry),maxBytes)>maxBytes||estimateObservationBytes(envelopeFor(entry),maxOutboxBytes)>maxOutboxBytes){countDrop(event,'single-payload-bytes');return false;}
   try{
    if(!outbox.length&&dispatch(entry)){if(event.mesh)meshAvailable=true;return true;}
    if(enqueue(entry)){if(event.mesh)meshAvailable=true;pump();return true;}
    return false;
   }catch(error){if(event.mesh)meshAvailable=false;throw error;}
  },
  acknowledge(id){
   if(closed||!Number.isSafeInteger(id)||!pending.has(id))return false;
   pendingBytes-=pending.get(id);pending.delete(id);pump();return true;
  },
  drain(){if(failure)return Promise.reject(failure);if(closed||(!outbox.length&&!pending.size))return Promise.resolve();return new Promise((resolve,reject)=>waiters.push({resolve,reject}));},
  close(){
   if(closed)return;
   closed=true;
   for(const entry of outbox)countDrop(entry.event,'terminal-unflushed');
   try{send({event:{stage:'observation-transport',provisional:true,observationTransport:{...snapshot(),droppedReasons:{...droppedReasons},terminal:true}}});}
   finally{pending.clear();pendingBytes=0;outbox.length=0;outboxBytes=0;settle();}
  }
 });
}
