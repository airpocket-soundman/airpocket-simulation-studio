import {snapshotJobEvent,snapshotJobView,normalizeJobError,jobEventPayloadLimits} from './job-event-payload.js';
import {getAnalysisFailure} from './analysis-failure.js';
import {canonicalJson} from './project-revision.js';
// Runtime-independent lifecycle. Hosts must settle execute only after their cleanup.
// executionSettled/resourceState report promise settlement, not independent proof
// that an operating-system thread or native allocation has been released.
const failureMetadata=error=>{const failure=getAnalysisFailure(error);return failure?{failure}:{};};
const errorValue=(error,key)=>{try{const descriptor=error&&Object.getOwnPropertyDescriptor(error,key);return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;}catch{return undefined;}};
const errorMessage=error=>typeof errorValue(error,'message')==='string'?errorValue(error,'message'):typeof error==='string'?error:'Analysis failed';
const terminal=new Set(['succeeded','failed','cancelled','timed_out']);
export function createAnalysisJobs({execute,id=()=>globalThis.crypto.randomUUID(),now=()=>Date.now(),maxJobs=32,maxEvents=256,timeoutMs=120000,maxEventBytes=32768,maxRetainedEventBytes=1048576,maxEventPageBytes=65536,maxJobViewBytes=24576,onRecord}={}){
 if(typeof execute!=='function'||!Number.isInteger(maxJobs)||maxJobs<1||!Number.isInteger(maxEvents)||maxEvents<2||maxEvents>256||!Number.isSafeInteger(maxEventBytes)||maxEventBytes<24576||maxEventBytes>jobEventPayloadLimits.eventBytes||!Number.isSafeInteger(maxJobViewBytes)||maxJobViewBytes!==jobEventPayloadLimits.viewBytes||!Number.isSafeInteger(maxRetainedEventBytes)||maxRetainedEventBytes<maxEventBytes||maxRetainedEventBytes>jobEventPayloadLimits.retainedBytes||!Number.isSafeInteger(maxEventPageBytes)||maxEventPageBytes<maxJobViewBytes+maxEventBytes+2048||maxEventPageBytes>jobEventPayloadLimits.pageBytes||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid job runtime');
 if(onRecord!==undefined&&typeof onRecord!=='function')throw Error('Invalid job runtime');
 const jobs=new Map(),requests=new Map();
 const copy=value=>structuredClone(value);
 function find(jobId){const job=jobs.get(jobId);if(!job)throw Error('Unknown job: '+jobId);return job;}
 const jsonBytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
 const retention=job=>({maxEvents,maxEventBytes,maxRetainedBytes:maxRetainedEventBytes,maxPageBytes:maxEventPageBytes,maxViewBytes:maxJobViewBytes,retainedEvents:job.events.length,retainedBytes:job.eventBytes});
 function emit(job,type,data={}){
  const envelope={schemaVersion:1,jobId:job.id,inputRevision:job.inputRevision,sequence:++job.sequence,elapsedMs:Math.max(0,now()-job.startedAt),type,executionSettled:job.executionSettled,resourceState:job.executionSettled?'settled':'pending',releaseAllowed:terminal.has(job.state)&&job.executionSettled};
  const snapshot=snapshotJobEvent(data,envelope,{maxBytes:maxEventBytes});
  job.events.push({event:snapshot.event,bytes:snapshot.bytes});job.eventBytes+=snapshot.bytes;
  while(job.events.length>maxEvents||job.eventBytes>maxRetainedEventBytes)job.eventBytes-=job.events.shift().bytes;
  // Optional host persistence hook; failures never affect the job.
  if(onRecord&&(type==='state'||type==='resource-state')){try{onRecord(view(job),{requestId:job.requestId});}catch{/* host reports its own diagnostics */}}
  return snapshot.event;
 }
 function view(job){return snapshotJobView({schemaVersion:1,jobId:job.id,inputRevision:job.inputRevision,state:job.state,executionSettled:job.executionSettled,resourceState:job.executionSettled?'settled':'pending',releaseAllowed:terminal.has(job.state)&&job.executionSettled,operation:job.operation,origin:job.origin,startedAt:job.startedAt,updatedAt:job.updatedAt,lastSequence:job.sequence,firstAvailableSequence:job.events[0]?.event.sequence??0,eventRetention:retention(job),...(job.result!==undefined?{result:job.result}:{}),...(job.error?{error:job.error}:{}),...(job.executionError?{executionError:job.executionError}:{})},{maxBytes:maxJobViewBytes});}
 function end(job,state,error){if(terminal.has(job.state))return;job.state=state;job.updatedAt=now();clearTimeout(job.timer);if(error)job.error=normalizeJobError({code:state==='timed_out'?'JOB_TIMEOUT':state==='cancelled'?'JOB_CANCELLED':'JOB_FAILED',message:errorMessage(error),...failureMetadata(error)});emit(job,'state',{state,...(job.error?{error:job.error}:{})});}
 function start({project,options={},operation='elastic',inputRevision,requestId,context={}}={}){
  if(context.origin!==undefined&&!['gui','api'].includes(context.origin))throw Error('Invalid job origin');
  if(!project||typeof project!=='object'||!['mesh','elastic'].includes(operation)||typeof inputRevision!=='string'||!inputRevision||inputRevision.length>200||requestId!==undefined&&(typeof requestId!=='string'||!requestId||requestId.length>200))throw Error('Invalid job input');
  // Clone before touching registry state: unserializable options must not leak a job.
  const input=copy({project,options,operation,inputRevision,context});
  const fingerprint=canonicalJson(input);
  if(requestId&&requests.has(requestId)){
   const old=jobs.get(requests.get(requestId));if(old.fingerprint!==fingerprint)throw Error('Request ID already used with different input');return view(old);
  }
  // Keep request identities until explicitly released, instead of silently executing old retries.
  if(jobs.size>=maxJobs)throw Error('Job retention limit reached; release a terminal job before starting another');
  const jobId=id();if(typeof jobId!=='string'||!jobId||jobId.length>200||jobs.has(jobId))throw Error('Invalid or duplicate job ID');
  const job={id:jobId,inputRevision,state:'running',executionSettled:false,operation,origin:context.origin??'api',startedAt:now(),updatedAt:now(),events:[],eventBytes:0,sequence:0,controller:new AbortController(),fingerprint,requestId};
  jobs.set(job.id,job);if(requestId)requests.set(requestId,job.id);
  emit(job,'state',{state:'running'});
  job.timer=setTimeout(()=>{if(job.state==='running'){end(job,'timed_out',Error('Analysis exceeded '+timeoutMs/1000+' seconds'));job.controller.abort();}},timeoutMs);
  // Execution never blocks start, and every promise has a rejection handler.
  job.executionPromise=Promise.resolve().then(()=>{
   if(job.state!=='running')return;
   return execute({...input,jobId:job.id,signal:job.controller.signal,
    onEvent:event=>{if(job.state==='running'){job.updatedAt=now();emit(job,'progress',event);}},
    beginCommit:()=>{if(job.state!=='running')throw Error('Job is no longer running');job.state='saving';job.updatedAt=now();clearTimeout(job.timer);emit(job,'state',{state:'saving'});}
   });
  }).then(result=>{if(job.state==='running'||job.state==='saving'){job.result=snapshotJobView({result},{maxBytes:maxJobViewBytes}).result;end(job,'succeeded');}}).catch(error=>{if(!terminal.has(job.state))end(job,'failed',error);else if(job.state==='cancelled'||job.state==='timed_out'){job.executionError=normalizeJobError({code:'JOB_EXECUTION_REJECTED_AFTER_TERMINAL',message:errorMessage(error),...(typeof errorValue(error,'code')==='string'?{sourceCode:errorValue(error,'code')}:{}),...failureMetadata(error)});job.updatedAt=now();emit(job,'execution-error',{executionError:job.executionError});}}).finally(()=>{job.executionSettled=true;job.updatedAt=now();emit(job,'resource-state',{state:job.state});});
  return view(job);
 }
 return Object.freeze({
  start,
  get:jobId=>view(find(jobId)),
  list(args={}){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['offset','limit'].includes(key)))throw Error('Invalid job list page');const {offset=0,limit=50}=args;if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid job list page');const values=[...jobs.values()].slice(offset,offset+limit).map(job=>{return view({...job,result:undefined});});return {jobs:values,total:jobs.size,nextOffset:offset+limit<jobs.size?offset+limit:null};},
  events(jobId,{afterSequence=0,limit=50}={}){
   const job=find(jobId);if(!Number.isSafeInteger(afterSequence)||afterSequence<0||afterSequence>job.sequence||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid job event cursor or limit');
   const candidates=job.events.filter(entry=>entry.event.sequence>afterSequence),base=view(job),events=[];
   const page=()=>({...base,events,truncated:afterSequence<(job.events[0]?.event.sequence??1)-1,nextSequence:events.at(-1)?.sequence??afterSequence,hasMore:events.length>0&&events.at(-1).sequence<job.sequence,eventPageBytes:0});
   for(const entry of candidates.slice(0,limit)){events.push(entry.event);if(jsonBytes(page())+8>maxEventPageBytes){events.pop();break;}}
   if(!events.length&&candidates.length)throw Error('Job event page budget cannot fit its bounded view and event');
   const result=page();for(let attempt=0;attempt<3;attempt++){const bytes=jsonBytes(result);if(result.eventPageBytes===bytes)break;result.eventPageBytes=bytes;}
   if(jsonBytes(result)>maxEventPageBytes)throw Error('Job event page byte limit exceeded');return copy(result);
  },
  cancel(jobId){const job=find(jobId);if(job.state!=='running')return {...view(job),cancelled:false};end(job,'cancelled',Error('Calculation cancelled'));job.controller.abort();return {...view(job),cancelled:true};},
  release(jobId){const job=find(jobId);if(!terminal.has(job.state))throw Error('Only terminal jobs can be released');if(!job.executionSettled)throw Error('Job execution has not settled; resources are pending');jobs.delete(jobId);if(job.requestId)requests.delete(job.requestId);return {jobId,released:true};},
  async drain(){const pending=[...jobs.values()].filter(job=>!job.executionSettled);await Promise.allSettled(pending.map(job=>job.executionPromise));return {drained:true,jobIds:pending.map(job=>job.id)};},
  close(){for(const job of jobs.values())if(job.state==='running'){end(job,'cancelled',Error('Job runtime closed'));job.controller.abort();}}
 });
}
