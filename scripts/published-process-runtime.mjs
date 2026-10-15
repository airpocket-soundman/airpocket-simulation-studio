import {fork} from 'node:child_process';
import {createHash} from 'node:crypto';

const defaultEntry=new URL('./published-process.mjs',import.meta.url);
const tasks=new Set(['analysis','cad','step-reference','step-changed']);
/** One deployed-runtime request per OS child. A terminal message is provisional
 * until close; no retry or solver/runtime substitution is performed. stdout is
 * counted and discarded; stderr retains at most min(maxOutputBytes,4096) bytes
 * plus a separate 128-byte signature lookbehind, not the child's heap/OS pipes. */
export async function runPublishedProcess(command,{timeoutMs=120000,onPhase=()=>{},forkImpl=fork,entry=defaultEntry,maxOutputBytes=65536}={}){
 if(!command||!tasks.has(command.task)||typeof command.base!=='string'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000||typeof onPhase!=='function'||typeof forkImpl!=='function'||!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<0||maxOutputBytes>1048576)throw TypeError('Invalid published process request');
 const child=forkImpl(entry,[],{execPath:process.execPath,execArgv:[],shell:false,windowsHide:true,serialization:'advanced',stdio:['ignore','pipe','pipe','ipc']});
 return new Promise((resolve,reject)=>{
  let terminal,problem,sent=false,closed=false,stderrBytes=0,stdoutBytes=0,tail=Buffer.alloc(0),scanTail=Buffer.alloc(0),fatal=false,killTimer;
  const hash=createHash('sha256');
  const phase=name=>{try{onPhase({phase:name,task:command.task,...(Number.isSafeInteger(child.pid)?{childPid:child.pid}:{})});}catch(error){stop(error);}};
  const stop=error=>{problem??=error;if(closed)return;try{child.kill();}catch(cause){problem??=cause;}if(!killTimer)killTimer=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}},1000);};
  const timer=setTimeout(()=>{phase('timeout');stop(Object.assign(Error('Published process exceeded '+timeoutMs+' ms'),{code:'PUBLISHED_PROCESS_TIMEOUT'}));},timeoutMs);
  child.stdout?.on('data',chunk=>{stdoutBytes+=Buffer.byteLength(chunk);});
  child.stderr?.on('data',chunk=>{const bytes=Buffer.from(chunk);stderrBytes+=bytes.length;hash.update(bytes);const scan=Buffer.concat([scanTail,bytes]);if(/jit_page_->allocations_\.erase\(addr\) == 1|Fatal error/i.test(scan.toString('utf8')))fatal=true;scanTail=Buffer.from(scan.subarray(-128));const joined=Buffer.concat([tail,bytes]);tail=maxOutputBytes?Buffer.from(joined.subarray(-Math.min(4096,maxOutputBytes))):Buffer.alloc(0);});
  child.on('error',error=>stop(error));
  child.on('message',message=>{
   if(closed||problem)return;
   if(message?.ready===true){if(sent){stop(Error('Published child sent duplicate ready'));return;}sent=true;try{child.send(command,error=>{if(error)stop(error);});}catch(error){stop(error);}return;}
   if(!sent){stop(Error('Published child responded before receiving a request'));return;}
   if(message?.phase!==undefined){if(['initialize','import','native','finalize','result'].includes(message.phase))phase(message.phase);else stop(Error('Unknown published child phase'));return;}
   if(message&&typeof message==='object'&&(Object.hasOwn(message,'result')||Object.hasOwn(message,'error'))){if(terminal){stop(Error('Published child sent multiple terminal results'));return;}terminal=message;return;}
   stop(Error('Invalid published child response'));
  });
  child.on('close',(code,signal)=>{
   if(closed)return;
   closed=true;clearTimeout(timer);clearTimeout(killTimer);phase('close');
   if(problem||code!==0||signal||fatal||!terminal){
    const error=problem??Object.assign(Error('Published process failed: '+String(code)+(signal?' ('+signal+')':'')+(fatal?' (native fatal diagnostic)':'')),{code:'PUBLISHED_PROCESS_EXIT'});
    let stderrTail=tail.toString('utf8');while(Buffer.byteLength(stderrTail)>Math.min(4096,maxOutputBytes))stderrTail=stderrTail.slice(1);
    Object.assign(error,{exitCode:code,signal:signal??null,stderrBytes,stdoutBytes,stderrSha256:hash.digest('hex'),stderrTail});reject(error);
   }else resolve(terminal);
  });
  phase('spawn');
 });
}
