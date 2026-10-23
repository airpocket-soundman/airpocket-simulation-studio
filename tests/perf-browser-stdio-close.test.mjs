import test from 'node:test';import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';import {PassThrough,Writable} from 'node:stream';
import {createStdioClient} from '../scripts/perf-browser.mjs';
const origin='http://127.0.0.1:5174';
function owned({eof=true,onKill,announce=true}={}){
 const child=new EventEmitter();Object.assign(child,{exitCode:null,signalCode:null,stdout:new PassThrough(),stderr:new PassThrough()});const kills=[];let options;
 const exit=(signal=null)=>{child.exitCode=signal?null:0;child.signalCode=signal;child.emit('exit',child.exitCode,signal);};
 child.stdin=new Writable({write(chunk,encoding,callback){const message=JSON.parse(String(chunk));if(message.method==='initialize')queueMicrotask(()=>child.stdout.write(JSON.stringify({id:message.id,result:{}})+'\n'));callback();},final(callback){callback();if(eof)queueMicrotask(()=>exit());}});
 child.kill=signal=>{kills.push(signal);onKill?.(signal,exit,child);return true;};
 const spawnImpl=(command,args,opts)=>{options=opts;if(announce)queueMicrotask(()=>child.stderr.write('Browser connector: '+JSON.stringify({endpoint:origin,pairingToken:'private-token',origin})+'\n'));return child;};
 return {child,kills,exit,spawnImpl,get options(){return options;}};
}
const make=(f,budgets={})=>createStdioClient({origin,spawnImpl:f.spawnImpl,startupTimeoutMs:50,rpcTimeoutMs:1000,closeGraceMs:3,terminateGraceMs:25,killGraceMs:10,...budgets});
function cleaned(f){assert.equal(f.child.stdout.destroyed,true);assert.equal(f.child.stdin.destroyed,true);assert.equal(f.child.stderr.destroyed,true);assert.equal(f.child.stdout.listenerCount('data'),0);for(const event of ['exit','close','error'])assert.equal(f.child.listenerCount(event),0);}
test('EOF close confirms exit, is idempotent, hides Windows spawn and rejects pending RPCs',async()=>{
 const f=owned(),client=await make(f),pending=assert.rejects(client.call('unanswered'),e=>e.code==='STDIO_CLIENT_CLOSED'),a=client.close();assert.equal(a,client.close());assert.deepEqual(await a,{exited:true,terminated:false,escalated:false});await pending;assert.deepEqual(f.kills,[]);assert.equal(f.options.windowsHide,true);assert.equal(f.options.shell,false);cleaned(f);await assert.rejects(client.call('after-close'),e=>e.code==='STDIO_CLIENT_CLOSED');
});
test('terminate waits for delayed actual exit instead of resolving at the kill request',async()=>{
 let exited=false;const f=owned({eof:false,onKill:(signal,exit)=>{assert.equal(signal,'SIGTERM');setTimeout(()=>{exited=true;exit(signal);},8);}}),client=await make(f),closing=client.close();assert.equal(exited,false);assert.deepEqual(await closing,{exited:true,terminated:true,escalated:false});assert.equal(exited,true);assert.deepEqual(f.kills,['SIGTERM']);cleaned(f);
});
test('SIGKILL escalation also waits for confirmation',async()=>{
 const f=owned({eof:false,onKill:(signal,exit)=>{if(signal==='SIGKILL')setTimeout(()=>exit(signal),3);}}),client=await make(f,{terminateGraceMs:3});assert.deepEqual(await client.close(),{exited:true,terminated:true,escalated:true});assert.deepEqual(f.kills,['SIGTERM','SIGKILL']);cleaned(f);
});
test('no exit cannot become close success, even when both kill calls return true',async()=>{
 const f=owned({eof:false}),client=await make(f,{terminateGraceMs:3,killGraceMs:3});await assert.rejects(client.close(),e=>e.code==='STDIO_CHILD_EXIT_UNCONFIRMED');await assert.rejects(client.close(),e=>e.code==='STDIO_CHILD_EXIT_UNCONFIRMED');assert.deepEqual(f.kills,['SIGTERM','SIGKILL']);cleaned(f);
});
test('already exited child requires no signals and pending calls fail immediately',async()=>{
 const f=owned({eof:false}),client=await make(f);f.exit();assert.deepEqual(await client.close(),{exited:true,terminated:false,escalated:false});assert.deepEqual(f.kills,[]);cleaned(f);
});
test('bounded RPC expiry and later close remove readers and timers',async()=>{
 const f=owned(),client=await make(f,{rpcTimeoutMs:5});await assert.rejects(client.call('unanswered'),e=>e.code==='STDIO_RPC_TIMEOUT');assert.equal((await client.close()).exited,true);cleaned(f);
});
test('startup timeout still closes its owned child and never announces credentials',async()=>{
 const f=owned({announce:false});await assert.rejects(make(f,{startupTimeoutMs:5}),e=>e.code==='STDIO_STARTUP_TIMEOUT');assert.equal(f.child.exitCode,0);cleaned(f);
});
