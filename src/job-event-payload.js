import {getAnalysisFailure} from './analysis-failure.js';

export const jobEventPayloadLimits=Object.freeze({eventBytes:32768,retainedBytes:1048576,pageBytes:65536,viewBytes:24576,messageChars:2048});
const encoder=new TextEncoder(),own=(value,key)=>{const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;};
const plain=value=>value!==null&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const size=value=>encoder.encode(JSON.stringify(value)).length;
const unsafeReasons=new Set(['non-finite','cycle','accessor','unsupported-type']);
class PayloadLimit extends Error{constructor(reason){super('Job payload omitted: '+reason);this.reason=reason;}}
const fail=reason=>{throw new PayloadLimit(reason);};
function snapshot(value,maxBytes){
 let bytes=0,nodes=0;const ancestors=new Set();
 const add=count=>{bytes+=count;if(bytes>maxBytes)fail('bytes');};
 const string=value=>{if(value.length>maxBytes-bytes)fail('bytes');const json=JSON.stringify(value);add(encoder.encode(json).length);return value;};
 function copy(value,depth){
  if(++nodes>8192||depth>16)fail('structure-limit');
  if(value===null){add(4);return null;}
  if(typeof value==='string')return string(value);
  if(typeof value==='boolean'){add(value?4:5);return value;}
  if(typeof value==='number'){if(!Number.isFinite(value))fail('non-finite');add(String(value).length);return Object.is(value,-0)?0:value;}
  if(typeof value!=='object')fail('unsupported-type');
  if(ancestors.has(value))fail('cycle');
  const array=Array.isArray(value);if(!array&&!plain(value))fail('unsupported-type');
  if(array&&value.length>2048)fail('structure-limit');
  const keys=Reflect.ownKeys(value);if(keys.length>(array?value.length+1:256))fail('structure-limit');
  if(array&&(keys.length!==value.length+1||keys.some(key=>key!=='length'&&(typeof key!=='string'||!/^\d+$/.test(key)||Number(key)>=value.length))))fail('unsupported-type');
  ancestors.add(value);add(2);const output=array?[]:{};
  try{
   const fields=array?Array.from({length:value.length},(_,index)=>String(index)):keys;
   let emitted=0;for(let i=0;i<fields.length;i++){
    const key=fields[i],descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=='string'||!descriptor?.enumerable)fail('unsupported-type');
    if(!Object.hasOwn(descriptor,'value'))fail('accessor');
    // Optional object metadata follows JSON wire omission; array holes/undefined do not.
    if(!array&&descriptor.value===undefined)continue;
    if(emitted++)add(1);if(!array){string(key);add(1);}
    const item=copy(descriptor.value,depth+1);Object.defineProperty(output,key,{value:item,enumerable:true,configurable:true,writable:true});
   }
  }finally{ancestors.delete(value);}
  return output;
 }
 const output=copy(value,0);return {value:output,bytes};
}
function budget(value,maximum){if(!Number.isSafeInteger(value)||value<512||value>maximum)throw TypeError('Invalid job payload byte budget');return value;}
function originalStage(data){if(!plain(data))return undefined;const value=own(data,'stage');return typeof value==='string'&&value.length<=100?value:undefined;}

/** Never clones or serializes unbounded input. Registry envelope fields are authoritative. */
export function snapshotJobEvent(data,envelope={}, {maxBytes=jobEventPayloadLimits.eventBytes}={}){
 budget(maxBytes,jobEventPayloadLimits.eventBytes);
 const header=snapshot(envelope,Math.min(8192,maxBytes-256)).value;
 try{
  const payload=snapshot(data,maxBytes).value;if(!plain(payload))fail('unsupported-type');
  const event={...payload,...header};const bytes=size(event);if(bytes>maxBytes)fail('bytes');return {event,bytes,gap:false};
 }catch(error){
  const reason=error instanceof PayloadLimit?error.reason:'unsupported-type',stage=originalStage(data);
  const event={...header,stage:'observation-event-gap',provisional:true,payloadOmitted:true,gap:{reason,...(stage!==undefined?{originalStage:stage}:{})}};
  const bytes=size(event);if(bytes>maxBytes)throw TypeError('Job event envelope exceeds byte budget');return {event,bytes,gap:true};
 }
}

/** Bound registry copies only; the thrown Error's original message is not modified. */
export function normalizeJobError(record){
 const output={};if(!record||typeof record!=='object')return {message:'[Message unavailable]',messageUnavailable:true};
 for(const key of ['code','sourceCode']){const value=own(record,key);if(typeof value==='string'&&value.length<=96)output[key]=value;else if(value!==undefined)output[key+'Omitted']=true;}
 for(const key of ['codeOmitted','sourceCodeOmitted','messageUnavailable'])if(own(record,key)===true)output[key]=true;
 const message=own(record,'message');
 if(typeof message==='string'){output.message=message.slice(0,jobEventPayloadLimits.messageChars);if(message.length>output.message.length){output.messageTruncated=true;output.originalMessageLength=message.length;}}
 else{output.message='[Message unavailable]';output.messageUnavailable=true;}
 const originalLength=own(record,'originalMessageLength');if(own(record,'messageTruncated')===true&&Number.isSafeInteger(originalLength)&&originalLength>=output.message.length){output.messageTruncated=true;output.originalMessageLength=Math.max(output.originalMessageLength??0,originalLength);}
 const failure=own(record,'failure');
 if(failure!==undefined){
  try{const detached=snapshot(failure,16384).value,valid=getAnalysisFailure({analysisFailure:detached});if(!valid)fail('unsupported-type');output.failure=valid;}
  catch(error){output.failureOmitted=true;output.failureOmissionReason=error instanceof PayloadLimit?error.reason:'unsupported-type';}
 }
 else if(own(record,'failureOmitted')===true){output.failureOmitted=true;const reason=own(record,'failureOmissionReason');output.failureOmissionReason=['bytes','structure-limit','non-finite','cycle','accessor','unsupported-type','view-bytes'].includes(reason)?reason:'unsupported-type';}
 return output;
}
function summary(value,maxBytes){
 try{return snapshot(value,maxBytes).value;}catch(error){if(!(error instanceof PayloadLimit)||unsafeReasons.has(error.reason))throw error;}
 if(!plain(value))return {summaryOmissions:[{field:'$',reason:'bytes-or-structure-limit'}]};
 const output={},omissions=[];
 const keys=Reflect.ownKeys(value);if(keys.length>256)return {summaryOmissions:[{field:'$',reason:'structure-limit'}]};
 for(const key of keys){
  const descriptor=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))fail('accessor');
  if(descriptor.value===undefined)continue;
  try{const detached=snapshot(descriptor.value,maxBytes).value;const proposed={...output,[key]:detached,summaryOmissions:omissions};if(size(proposed)>maxBytes-512)fail('bytes');Object.defineProperty(output,key,{value:detached,enumerable:true,writable:true,configurable:true});}
  catch(error){if(!(error instanceof PayloadLimit)||unsafeReasons.has(error.reason))throw error;if(omissions.length<16)omissions.push({field:key.slice(0,100),reason:error.reason});}
 }
 output.summaryOmissions=omissions;return snapshot(output,maxBytes).value;
}

/** Partial views are allowed. Small result fields and validated primary failure are preserved. */
export function snapshotJobView(view,{maxBytes=jobEventPayloadLimits.viewBytes}={}){
 budget(maxBytes,jobEventPayloadLimits.viewBytes);if(!plain(view))throw TypeError('Invalid job view');
 const output={},omissions=[];const keys=Reflect.ownKeys(view);if(keys.length>256)throw TypeError('Invalid job view fields');
 for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(view,key);if(typeof key!=='string'||!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))fail('accessor');if(['result','error','executionError'].includes(key)||descriptor.value===undefined)continue;Object.defineProperty(output,key,{value:snapshot(descriptor.value,8192).value,enumerable:true,configurable:true,writable:true});}
 for(const key of ['error','executionError'])if(Object.hasOwn(view,key)&&own(view,key)!==undefined){
  let value=normalizeJobError(own(view,key));
  if(size({...output,[key]:value})>maxBytes-512&&value.message.length>256){value={...value,message:value.message.slice(0,256),messageTruncated:true,originalMessageLength:value.originalMessageLength??value.message.length};}
  if(size({...output,[key]:value})>maxBytes-512&&value.failure){value={...value};delete value.failure;value.failureOmitted=true;value.failureOmissionReason='view-bytes';omissions.push({field:key+'.failure',reason:'view-bytes'});}
  if(size({...output,[key]:value})>maxBytes-512){omissions.push({field:key,reason:'view-bytes'});continue;}
  output[key]=value;
 }
 if(Object.hasOwn(view,'result')&&own(view,'result')!==undefined){const remaining=maxBytes-size(output)-1024;if(remaining>=512)output.result=summary(own(view,'result'),remaining);else omissions.push({field:'result',reason:'view-bytes'});}
 if(omissions.length)output.viewOmissions=omissions;
 return snapshot(output,maxBytes).value;
}
