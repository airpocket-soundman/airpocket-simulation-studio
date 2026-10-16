import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {runPublishedProcess} from '../scripts/published-process-runtime.mjs';

const command={task:'analysis',base:'file:///verified/',module:'file:///verified/assets/analysis.worker-abc.js',request:{payload:new Uint8Array([0,1,255]).buffer}};
function harness(options={}){
 const child=new EventEmitter();child.pid=123;child.stdout=new PassThrough();child.stderr=new PassThrough();let sent,killed=0,configuration;
 child.send=(value,callback)=>{sent=value;callback?.();};child.kill=()=>{killed++;queueMicrotask(()=>child.emit('close',null,'SIGTERM'));};
 const phases=[],promise=runPublishedProcess(command,{forkImpl:(_entry,_args,config)=>{configuration=config;return child;},onPhase:value=>phases.push(value),...options});
 return {child,promise,phases,get sent(){return sent;},get killed(){return killed;},get configuration(){return configuration;}};
}
test('published process uses one OS child, advanced IPC and only resolves a provisional result after clean close',async()=>{
 const h=harness();assert.equal(h.configuration.serialization,'advanced');assert.equal(h.configuration.shell,false);assert.deepEqual(h.configuration.execArgv,[]);assert.equal(h.configuration.windowsHide,true);
 h.child.emit('message',{ready:true});assert.equal(h.sent,command);assert.deepEqual(Array.from(new Uint8Array(h.sent.request.payload)),[0,1,255]);
 let settled=false;h.promise.then(()=>settled=true);const terminal={result:{pressure:[1,2,3]}};h.child.emit('message',{phase:'initialize'});h.child.emit('message',terminal);await Promise.resolve();assert.equal(settled,false);h.child.emit('close',0,null);assert.deepEqual(await h.promise,terminal);assert.deepEqual(h.phases.map(v=>v.phase),['spawn','initialize','close']);assert.equal(h.killed,0);
});
test('nonzero exit, signal, missing result and native fatal stderr reject even after a terminal response',async()=>{
 for(const mode of ['nonzero','signal','missing','fatal']){
  const h=harness();const rejection=assert.rejects(h.promise,error=>error.code==='PUBLISHED_PROCESS_EXIT'&&typeof error.stderrSha256==='string');h.child.emit('message',{ready:true});
  if(mode!=='missing')h.child.emit('message',{result:{ok:true}});if(mode==='fatal'){h.child.stderr.write('x'.repeat(70000));h.child.stderr.write('Check failed: jit_page_->allocations_.erase(addr) == 1.');}
  h.child.emit('close',mode==='nonzero'?133:0,mode==='signal'?'SIGTRAP':null);await rejection;
 }
});
test('timeouts and callback failures kill the owned child and wait for close without retrying',async()=>{
 const timed=harness({timeoutMs:5});await assert.rejects(timed.promise,error=>error.code==='PUBLISHED_PROCESS_TIMEOUT');assert.equal(timed.killed,1);assert.ok(timed.phases.some(v=>v.phase==='timeout'));
 const callbacks=harness({onPhase:()=>{throw Error('checkpoint failed');}});await assert.rejects(callbacks.promise,/checkpoint failed/);assert.equal(callbacks.killed,1);
 const bad=harness();const rejected=assert.rejects(bad.promise,/duplicate ready/);bad.child.emit('message',{ready:true});bad.child.emit('message',{ready:true});await rejected;assert.equal(bad.killed,1);
});
test('stderr retained on failure is bounded and can be entirely disabled',async()=>{
 for(const cap of [0,20,65536]){const h=harness({maxOutputBytes:cap});const rejected=assert.rejects(h.promise,error=>{assert.equal(error.stderrBytes,90000);assert.ok(Buffer.byteLength(error.stderrTail)<=Math.min(cap,4096));return true;});h.child.stderr.write('x'.repeat(90000));h.child.emit('close',1,null);await rejected;}
});
test('native fatal signatures split across stderr chunks still fail with retention disabled after a result',async()=>{
 for(const pieces of [['Fatal ','error'],['jit_page_->allocations_.','erase(addr) == 1']]){
  const h=harness({maxOutputBytes:0}),rejected=assert.rejects(h.promise,error=>error.code==='PUBLISHED_PROCESS_EXIT'&&error.stderrTail==='');
  h.child.emit('message',{ready:true});h.child.emit('message',{result:{ok:true}});for(const piece of pieces)h.child.stderr.write(piece);h.child.emit('close',0,null);await rejected;
 }
});
test('unsolicited terminal results and phases cannot pass before ready and request dispatch even with clean close',async()=>{
 for(const message of [{result:{ok:true}},{error:'unsolicited'},{phase:'initialize'}]){
  const h=harness(),rejected=assert.rejects(h.promise,/before receiving a request/);h.child.emit('message',message);h.child.emit('close',0,null);await rejected;assert.equal(h.sent,undefined);assert.equal(h.killed,1);
 }
});
