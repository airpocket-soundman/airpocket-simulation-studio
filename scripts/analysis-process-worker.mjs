import {fork} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createHash} from 'node:crypto';
const entry=new URL('./headless-process.mjs',import.meta.url);
const transportAck=data=>data&&typeof data==='object'&&data.type==='analysis-observation-ack-v1'&&Number.isSafeInteger(data.id);
const cleanupError=cause=>Object.assign(Error('Analysis child cleanup failed: '+String(cause?.message??cause)),{code:'WORKER_CLEANUP_FAILED'});
/** Same executable, one child per job. Output caps bound retained/logged bytes,
 * not the child's heap or the OS pipe. forkImpl is trusted test injection only. */
export function createAnalysisProcessWorker({forkImpl=fork,onRuntimeFailure=()=>{},maxOutputBytes=65536}={}){
 if(typeof forkImpl!=='function'||typeof onRuntimeFailure!=='function'||!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<0||maxOutputBytes>1048576)throw TypeError('Invalid process worker adapter');
 const child=forkImpl(entry,[],{execPath:process.execPath,execArgv:[],shell:false,windowsHide:true,serialization:'advanced',stdio:['ignore','pipe','pipe','ipc']}),worker=new EventEmitter();
 worker.stdout=new PassThrough();worker.stderr=new PassThrough();
 let closed=false,terminating=false,completed=false,closeFailure,sent=false,exitCode=null,exitSignal=null,stderrBytes=0,tail=Buffer.alloc(0),termination,resolveTermination,rejectTermination,spawnError;
 const hash=createHash('sha256'),counts={stdout:0,stderr:0};
 for(const name of ['stdout','stderr'])child[name]?.on('data',chunk=>{
  const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  if(name==='stderr'){stderrBytes+=bytes.length;hash.update(bytes);tail=bytes.length>=4096?Buffer.from(bytes.subarray(bytes.length-4096)):Buffer.concat([tail,bytes]).subarray(-4096);}
  const available=Math.max(0,maxOutputBytes-counts[name]);if(available){const kept=bytes.subarray(0,available);worker[name].write(Buffer.from(kept));counts[name]+=kept.length;}
 });
 child.on('message',message=>{if(closed||terminating||completed)return;if(message?.result||message?.error)completed=true;worker.emit('message',message);});
 child.on('error',error=>{spawnError=error;});
 child.on('exit',(code,signal)=>{exitCode=code;exitSignal=signal;});
 child.on('close',(code,signal)=>{
  if(closed)return;closed=true;exitCode=code??exitCode;exitSignal=signal??exitSignal;worker.stdout.end();worker.stderr.end();
  // A result is provisional until close: a native failure during cleanup must block publication.
  if((!terminating&&!completed)||(exitCode!==null&&exitCode!==0&&!exitSignal)||(exitSignal&&exitSignal!=='SIGTERM')||tail.includes(Buffer.from('jit_page_->allocations_.erase(addr) == 1'))){
   let stderrTail=tail.toString('utf8');while(Buffer.byteLength(stderrTail,'utf8')>4096)stderrTail=stderrTail.slice(1);
   const event={stage:'runtime-failure',solver:'node-process',code:'ANALYSIS_PROCESS_EXIT',exitCode,signal:exitSignal,stderrBytes,stderrSha256:hash.digest('hex'),stderrTail,provisional:true};
   const error=Object.assign(Error('Analysis process exited before completion: '+String(exitCode)+(exitSignal?' ('+exitSignal+')':'')),{code:'ANALYSIS_PROCESS_EXIT',exitCode,signal:exitSignal,...(spawnError?{cause:spawnError}:{})});
   closeFailure=error;try{onRuntimeFailure(event);}catch(cause){error.cause=cause;}
   worker.emit('error',error);
  }
  if(closeFailure)rejectTermination?.(closeFailure);else resolveTermination?.(exitCode);worker.emit('exit',exitCode);
 });
 worker.postMessage=data=>{if(terminating||closed)throw Error('Analysis process is terminating');if(transportAck(data)){if(!sent)throw Error('Analysis observation ACK has no active request');child.send(data,error=>{if(error&&!closed&&!terminating)worker.emit('error',error);});return;}if(sent)throw Error('Analysis process accepts only one active request');sent=true;child.send(data,error=>{if(error&&!closed&&!terminating)worker.emit('error',error);});};
 worker.terminate=()=>{
  if(termination)return termination;
  terminating=true;termination=new Promise((resolve,reject)=>{resolveTermination=resolve;rejectTermination=reject;});
  if(closed){if(closeFailure)rejectTermination(closeFailure);else resolveTermination(exitCode);return termination;}
  try{child.kill();}catch(error){rejectTermination(cleanupError(error));}
  return termination;
 };
 return worker;
}
