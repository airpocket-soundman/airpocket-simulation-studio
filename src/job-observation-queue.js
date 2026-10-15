export const observationQueueDefaults=Object.freeze({maxEvents:8,maxBytes:8_000_000});
const {maxEvents:DEFAULT_EVENTS,maxBytes:DEFAULT_BYTES}=observationQueueDefaults;
export function validateObservationQueueLimits(maxEvents=DEFAULT_EVENTS,maxBytes=DEFAULT_BYTES){
 if(!Number.isSafeInteger(maxEvents)||maxEvents<1||maxEvents>1024||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>64_000_000)throw TypeError('Invalid observation queue limits');
}
// A conservative structural estimate, not serialization or a JS heap measurement.
export function estimateObservationBytes(value,limit=DEFAULT_BYTES){
 let bytes=0;const seen=new Set();
 const visit=(item,depth)=>{
  if(bytes>limit)return;
  if(item===null||item===undefined){bytes+=8;return;}
  if(typeof item==='number'||typeof item==='boolean'){bytes+=8;return;}
  if(typeof item==='string'){bytes+=32+item.length*2;return;}
  if(typeof item!=='object'||depth>32){bytes=limit+1;return;}
  if(seen.has(item))return;seen.add(item);
  if(ArrayBuffer.isView(item)){bytes+=64+item.byteLength;return;}
  if(item instanceof ArrayBuffer){bytes+=64+item.byteLength;return;}
  if(Array.isArray(item)){
   bytes+=32+item.length*8;
   for(let i=0;i<item.length&&bytes<=limit;i++){const field=Object.getOwnPropertyDescriptor(item,String(i));if(!field||!Object.hasOwn(field,'value')){bytes=limit+1;return;}visit(field.value,depth+1);}return;
  }
  if(![Object.prototype,null].includes(Object.getPrototypeOf(item))){bytes=limit+1;return;}
  const keys=Reflect.ownKeys(item);if(keys.length>256){bytes=limit+1;return;}bytes+=64;
  for(const key of keys){const field=Object.getOwnPropertyDescriptor(item,key);if(typeof key!=='string'||!Object.hasOwn(field,'value')){bytes=limit+1;return;}bytes+=32+key.length*2;visit(field.value,depth+1);if(bytes>limit)return;}
 };
 visit(value,0);return bytes;
}

/** Bounds full observation payloads including the active consumer. Scalar summaries bypass the queue.
 * Overflow keeps the last accepted snapshot, not the latest rejected one. Dropping a mesh also
 * drops following fields until a new mesh is accepted, so fields never bind to an older mesh.
 * observationSequence is source order; asynchronous publication order may differ.
 */
export function createJobObservationQueue({consume,onSummary=()=>{},onDrop=()=>{},onError=()=>{},isActive=()=>true,maxEvents=DEFAULT_EVENTS,maxBytes=DEFAULT_BYTES}={}){
 validateObservationQueueLimits(maxEvents,maxBytes);
 if(typeof consume!=='function'||![onSummary,onDrop,onError,isActive].every(v=>typeof v==='function'))throw TypeError('Invalid observation queue configuration');
 let closed=false,running=false,meshAccepted=false,meshEpoch=0,invalidMeshEpoch=null,sequence=0,pendingBytes=0,pendingEvents=0,peakBytes=0,peakEvents=0,accepted=0,dropped=0,droppedMeshes=0,droppedFields=0,consumerErrors=0,notificationErrors=0,latestAcceptedSequence=null,latestCompletedSequence=null;
 const queue=[],waiters=[];
 const snapshot=()=>({maxEvents,maxBytes,pendingEvents,pendingBytes,peakEvents,peakBytes,accepted,dropped,droppedMeshes,droppedFields,consumerErrors,notificationErrors,latestAcceptedSequence,latestCompletedSequence,latestPolicy:'last-accepted-snapshot',byteBasis:'conservative-structural-estimate',includesInFlight:true});
 const notify=(callback,...args)=>{try{callback(...args);}catch{notificationErrors++;}};
 const active=()=>{try{return isActive()===true;}catch{return false;}};
 const drop=(event,observationSequence,reason)=>{dropped++;if(event.mesh)droppedMeshes++;if(event.field)droppedFields++;notify(onDrop,event,{observationSequence,reason,...snapshot()});};
 const settle=()=>{if(!running&&!queue.length)while(waiters.length)waiters.shift()();};
 function close(){closed=true;for(const entry of queue){pendingBytes-=entry.bytes;pendingEvents--;}queue.length=0;settle();}
 async function pump(){
  if(running)return;running=true;
  try{while(queue.length){
   if(closed||!active()){close();break;}
   const entry=queue.shift();
   try{if(entry.event.field&&entry.meshEpoch===invalidMeshEpoch)drop(entry.event,entry.sequence,'mesh-consumer-failed');else{await consume(entry.event,{observationSequence:entry.sequence});latestCompletedSequence=entry.sequence;}}catch(error){consumerErrors++;if(entry.event.mesh){invalidMeshEpoch=entry.meshEpoch;if(meshEpoch===entry.meshEpoch)meshAccepted=false;}notify(onError,error,{observationSequence:entry.sequence});}
   finally{pendingBytes-=entry.bytes;pendingEvents--;entry.event=null;}
  }}finally{running=false;settle();}
 }
 return Object.freeze({snapshot,close,drain:()=>running||queue.length?new Promise(resolve=>waiters.push(resolve)):Promise.resolve(),
  push(event){
   if(closed||!active()){close();return {accepted:false,reason:'closed'};}
   const observationSequence=++sequence;
   if(!event.mesh&&!event.field){notify(onSummary,event,{observationSequence});return {accepted:true,summaryOnly:true};}
   if(event.mesh){meshEpoch++;meshAccepted=false;}
   const bytes=estimateObservationBytes(event,maxBytes);
   const reason=event.mesh&&event.field?'mixed-payload':event.field&&!meshAccepted?'mesh-unavailable':bytes>maxBytes?'single-payload-bytes':pendingEvents>=maxEvents?'pending-events':pendingBytes+bytes>maxBytes?'pending-bytes':null;
   if(reason){drop(event,observationSequence,reason);return {accepted:false,reason};}
   if(event.mesh)meshAccepted=true;
   pendingEvents++;pendingBytes+=bytes;accepted++;latestAcceptedSequence=observationSequence;peakEvents=Math.max(peakEvents,pendingEvents);peakBytes=Math.max(peakBytes,pendingBytes);
   queue.push({event,bytes,sequence:observationSequence,meshEpoch});void pump();return {accepted:true};
  }
 });
}
