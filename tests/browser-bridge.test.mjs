import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';
import {createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {createStudioApi} from '../src/studio-api.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

const origin='http://127.0.0.1:5174';
test('loopback bridge authenticates, scopes, expires, times out and revokes in-flight commands',async t=>{
 let time=1000;const bridge=await createBrowserBridge({origin,now:()=>time,ttlMs:1000,timeoutMs:2000});t.after(()=>bridge.close());
 const req=async(path,token,body,from=origin)=>{const r=await fetch(bridge.endpoint+path,{method:body===undefined?'GET':'POST',headers:{Origin:from,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,value:await r.json()};};
 assert.equal((await req('/pair',bridge.pairingToken,{scopes:['inspect']},'http://evil.example')).status,403);
 assert.equal((await req('/pair','wrong',{scopes:['inspect']})).status,401);
 const {value:paired}=await req('/pair',bridge.pairingToken,{scopes:['inspect']});
 assert.equal(bridge.list().length,1);assert.equal(bridge.list()[0].token,undefined);
 await assert.rejects(bridge.call(paired.sessionId,'edit',{},'edit'),{code:'BROWSER_SCOPE_REFUSED'});
 const pending=bridge.call(paired.sessionId,'inspect');const poll=await req('/poll',paired.token);assert.equal(poll.value.commands.length,1);
 assert.equal((await req('/poll',paired.token)).value.commands.length,0);
 await req('/reply',paired.token,{id:poll.value.commands[0].id,value:{revision:'r1'}});assert.deepEqual(await pending,{revision:'r1'});
 await assert.rejects(bridge.call(paired.sessionId,'inspect'),{code:'BROWSER_COMMAND_TIMEOUT'});
 const disconnecting=assert.rejects(bridge.call(paired.sessionId,'inspect'),/disconnected/);await req('/disconnect',paired.token,{});await disconnecting;
 assert.equal((await req('/poll',paired.token)).status,401);
 await req('/pair',bridge.pairingToken,{scopes:['inspect']});time+=1001;assert.equal(bridge.list().length,0);
});

test('browser session applies semantic revision-checked edits and refuses a revoked asynchronous edit',async()=>{
 const studio=createStudioApi();studio.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}));
 const calls=[],analysis={getJob:()=>({state:'running'}),cancelJob:id=>calls.push(id),startJob:()=>({jobId:'j1'})};
 const session=createBrowserSession({studio,analysis,view:{get:()=>({opacity:1}),set:()=>{}},getResult:()=>null});
 const inspection=await session.call('inspect');assert.equal(inspection.project.meshCount,1);
 await session.call('edit',{expectedRevision:inspection.revision,operations:[{method:'setStudy',args:[{kind:'structural',gravityEnabled:true,gravity:[0,0,-9.8]}]}]});
 const revision=(await session.call('inspect')).revision;
 await assert.rejects(session.call('edit',{expectedRevision:inspection.revision,operations:[{method:'clearSelection',args:[]}]}),/revision conflict/);
 const editing=session.call('edit',{expectedRevision:revision,operations:[{method:'setMaterial',args:['樹脂']}]});session.disconnect();await assert.rejects(editing,/revoked/);
 assert.equal(studio.exportProject().material,'金属');
 await assert.rejects(session.call('startJob',{inputRevision:'stale',requestId:'stale'}),/revision conflict/);await session.call('startJob',{inputRevision:revision,requestId:'r1'});assert.equal((await session.call('startJob',{requestId:'r1',inputRevision:revision})).jobId,'j1');await assert.rejects(session.call('startJob',{inputRevision:revision,requestId:'r1',options:{size:1}}),/conflicts/);await assert.rejects(session.call('edit',{expectedRevision:revision,operations:[]}),/busy/);session.disconnect();assert.deepEqual(calls,['j1']);
 await assert.rejects(session.call('eval',{code:'arbitrary'}),/Unknown browser method/);
 await assert.rejects(session.call('setView',{opacity:.5},{expiresAt:Date.now()-1}),/expired/);
});

test('late browser replies do not disconnect the client or prevent subsequent observations',async t=>{
 const bridge=await createBrowserBridge({origin,timeoutMs:1500});t.after(()=>bridge.close());let finish,entered;
 const gate=new Promise(resolve=>finish=resolve),started=new Promise(resolve=>entered=resolve);let first=true,disconnects=0;
 const fetcher=(url,opts)=>fetch(url,{...opts,headers:{...opts.headers,Origin:origin}});
 const client=connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes:['inspect'],session:{async call(){if(first){first=false;entered();await gate;}return {ok:true};},disconnect(){disconnects++;}},fetcher,intervalMs:2});t.after(()=>client.stop());const {sessionId}=await client.ready;
 const expired=assert.rejects(bridge.call(sessionId,'inspect'),{code:'BROWSER_COMMAND_TIMEOUT'});await started;await expired;finish();
 assert.deepEqual(await bridge.call(sessionId,'inspect'),{ok:true});assert.equal(disconnects,0);client.stop();
});

test('showJob rechecks busy state after asynchronous input verification before publishing a case',async()=>{
 const studio=createStudioApi();studio.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}));let busy=false,shown=0;
 const session=createBrowserSession({studio,analysis:{getJobResult:()=>({input:studio.exportProject()})},isBusy:()=>busy,showResult:()=>{shown++;return {shown:true};}});
 const displaying=session.call('showJob',{jobId:'done'});busy=true;await assert.rejects(displaying,/busy/);assert.equal(shown,0);busy=false;assert.deepEqual(await session.call('showJob',{jobId:'done'}),{shown:true});
});

test('real HTTP polling client enforces browser scopes and stops connection-owned jobs',async t=>{
 const bridge=await createBrowserBridge({origin,timeoutMs:1000});t.after(()=>bridge.close());
 let disconnected=0;const calls=[];
 const fetcher=(url,opts)=>fetch(url,{...opts,headers:{...opts.headers,Origin:origin}});
 const client=connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes:['inspect'],session:{async call(method){calls.push(method);return {ok:true};},disconnect(){disconnected++;}},fetcher,intervalMs:2});t.after(()=>client.stop());
 const {sessionId}=await client.ready;
 assert.deepEqual(await bridge.call(sessionId,'inspect'),{ok:true});
 await assert.rejects(bridge.call(sessionId,'edit',{},'inspect'),/scope refused/);assert.deepEqual(calls,['inspect']);
 client.stop();assert.equal(disconnected,1);
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs','--browser-origin='+origin],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']});
 const lines=createInterface({input:child.stdout}),pending=new Map();let serial=0,stderr='';
 lines.on('line',line=>{const message=JSON.parse(line);pending.get(message.id)?.(message);pending.delete(message.id);});
 t.after(async()=>{child.stdin.end();if(child.exitCode===null){const timer=setTimeout(()=>child.kill(),2000);await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);}lines.close();});
 const details=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Connector did not start')),5000);child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Browser connector: (.+)\n/);if(match){clearTimeout(timer);resolve(JSON.parse(match[1]));}});});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error('MCP response timed out')),5000);pending.set(id,message=>{clearTimeout(timer);resolve(message);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 assert.equal((await rpc('tools/list',{})).result.tools.length,31);
 const connected=connectBrowserSession({...details,scopes:['inspect'],session:{call:async()=>({revision:'observed'}),disconnect(){}},fetcher,intervalMs:2});t.after(()=>connected.stop());
 const paired=await connected.ready;
 const reply=await rpc('tools/call',{name:'studio_browser_call',arguments:{sessionId:paired.sessionId,method:'inspect'}});
 assert.deepEqual(reply.result.structuredContent.value,{revision:'observed'});
 const refusal=await rpc('tools/call',{name:'studio_browser_call',arguments:{sessionId:paired.sessionId,method:'edit',args:{}}});assert.equal(refusal.result.isError,true);
 connected.stop();
});
