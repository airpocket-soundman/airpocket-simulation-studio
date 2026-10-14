import {canonicalJson} from './project-revision.js';
// Runtime-independent lifecycle. Hosts must settle execute only after their cleanup.
// executionSettled/resourceState report promise settlement, not independent proof
// that an operating-system thread or native allocation has been released.
const terminal=new Set(['succeeded','failed','cancelled','timed_out']);
export function createAnalysisJobs({execute,id=()=>globalThis.crypto.randomUUID(),now=()=>Date.now(),maxJobs=32,maxEvents=256,timeoutMs=120000}={}){
 if(typeof execute!=='function'||!Number.isInteger(maxJobs)||maxJobs<1||!Number.isInteger(maxEvents)||maxEvents<2||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid job runtime');
 const jobs=new Map(),requests=new Map();
 const copy=value=>structuredClone(value);
 function find(jobId){const job=jobs.get(jobId);if(!job)throw Error('Unknown job: '+jobId);return job;}
 function emit(job,type,data={}){
  const event={...copy(data),schemaVersion:1,jobId:job.id,inputRevision:job.inputRevision,sequence:++job.sequence,elapsedMs:Math.max(0,now()-job.startedAt),type,executionSettled:job.executionSettled,resourceState:job.executionSettled?'settled':'pending',releaseAllowed:terminal.has(job.state)&&job.executionSettled};
  job.events.push(event);if(job.events.length>maxEvents)job.events.shift();return event;
 }
 function view(job){return {schemaVersion:1,jobId:job.id,inputRevision:job.inputRevision,state:job.state,executionSettled:job.executionSettled,resourceState:job.executionSettled?'settled':'pending',releaseAllowed:terminal.has(job.state)&&job.executionSettled,operation:job.operation,origin:job.origin,startedAt:job.startedAt,updatedAt:job.updatedAt,lastSequence:job.sequence,firstAvailableSequence:job.events[0]?.sequence??0,...(job.result!==undefined?{result:copy(job.result)}:{}),...(job.error?{error:copy(job.error)}:{}),...(job.executionError?{executionError:copy(job.executionError)}:{})};}
 function end(job,state,error){if(terminal.has(job.state))return;job.state=state;job.updatedAt=now();clearTimeout(job.timer);if(error)job.error={code:state==='timed_out'?'JOB_TIMEOUT':state==='cancelled'?'JOB_CANCELLED':'JOB_FAILED',message:error?.message??String(error)};emit(job,'state',{state,...(job.error?{error:job.error}:{})});}
 function start({project,options={},operation='elastic',inputRevision,requestId,context={}}={}){
  if(context.origin!==undefined&&!['gui','api'].includes(context.origin))throw Error('Invalid job origin');
  if(!project||typeof project!=='object'||!['mesh','elastic'].includes(operation)||typeof inputRevision!=='string'||!inputRevision||requestId!==undefined&&(typeof requestId!=='string'||!requestId||requestId.length>200))throw Error('Invalid job input');
  // Clone before touching registry state: unserializable options must not leak a job.
  const input=copy({project,options,operation,inputRevision,context});
  const fingerprint=canonicalJson(input);
  if(requestId&&requests.has(requestId)){
   const old=jobs.get(requests.get(requestId));if(old.fingerprint!==fingerprint)throw Error('Request ID already used with different input');return view(old);
  }
  // Keep request identities until explicitly released, instead of silently executing old retries.
  if(jobs.size>=maxJobs)throw Error('Job retention limit reached; release a terminal job before starting another');
  const jobId=id();if(typeof jobId!=='string'||!jobId||jobs.has(jobId))throw Error('Invalid or duplicate job ID');
  const job={id:jobId,inputRevision,state:'running',executionSettled:false,operation,origin:context.origin??'api',startedAt:now(),updatedAt:now(),events:[],sequence:0,controller:new AbortController(),fingerprint,requestId};
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
  }).then(result=>{if(job.state==='running'||job.state==='saving'){job.result=copy(result);end(job,'succeeded');}}).catch(error=>{if(!terminal.has(job.state))end(job,'failed',error);else if(job.state==='cancelled'||job.state==='timed_out'){job.executionError={code:'JOB_EXECUTION_REJECTED_AFTER_TERMINAL',message:error?.message??String(error),...(typeof error?.code==='string'?{sourceCode:error.code}:{})};job.updatedAt=now();emit(job,'execution-error',{executionError:job.executionError});}}).finally(()=>{job.executionSettled=true;job.updatedAt=now();emit(job,'resource-state',{state:job.state});});
  return view(job);
 }
 return Object.freeze({
  start,
  get:jobId=>view(find(jobId)),
  list(args={}){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['offset','limit'].includes(key)))throw Error('Invalid job list page');const {offset=0,limit=50}=args;if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid job list page');const values=[...jobs.values()].slice(offset,offset+limit).map(job=>{return view({...job,result:undefined});});return {jobs:values,total:jobs.size,nextOffset:offset+limit<jobs.size?offset+limit:null};},
  events(jobId,{afterSequence=0,limit=50}={}){
   const job=find(jobId);if(!Number.isSafeInteger(afterSequence)||afterSequence<0||afterSequence>job.sequence||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid job event cursor or limit');
   const events=job.events.filter(e=>e.sequence>afterSequence).slice(0,limit);
   return {...view(job),events:copy(events),truncated:afterSequence<(job.events[0]?.sequence??1)-1,nextSequence:events.at(-1)?.sequence??afterSequence,hasMore:events.length>0&&events.at(-1).sequence<job.sequence};
  },
  cancel(jobId){const job=find(jobId);if(job.state!=='running')return {...view(job),cancelled:false};end(job,'cancelled',Error('Calculation cancelled'));job.controller.abort();return {...view(job),cancelled:true};},
  release(jobId){const job=find(jobId);if(!terminal.has(job.state))throw Error('Only terminal jobs can be released');if(!job.executionSettled)throw Error('Job execution has not settled; resources are pending');jobs.delete(jobId);if(job.requestId)requests.delete(job.requestId);return {jobId,released:true};},
  async drain(){const pending=[...jobs.values()].filter(job=>!job.executionSettled);await Promise.allSettled(pending.map(job=>job.executionPromise));return {drained:true,jobIds:pending.map(job=>job.id)};},
  close(){for(const job of jobs.values())if(job.state==='running'){end(job,'cancelled',Error('Job runtime closed'));job.controller.abort();}}
 });
}
