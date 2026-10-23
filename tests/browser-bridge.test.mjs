import {assertMcpTools} from './fixtures/mcp-tool-contract.mjs';
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
 assertMcpTools((await rpc('tools/list',{})).result.tools,{browser:true});
 const connected=connectBrowserSession({...details,scopes:['inspect'],session:{call:async()=>({revision:'observed'}),disconnect(){}},fetcher,intervalMs:2});t.after(()=>connected.stop());
 const paired=await connected.ready;
 const reply=await rpc('tools/call',{name:'studio_browser_call',arguments:{sessionId:paired.sessionId,method:'inspect'}});
 assert.deepEqual(reply.result.structuredContent.value,{revision:'observed'});
 const refusal=await rpc('tools/call',{name:'studio_browser_call',arguments:{sessionId:paired.sessionId,method:'edit',args:{}}});assert.equal(refusal.result.isError,true);
 connected.stop();
});

test('connector re-polls immediately after handled commands, waits only after empty polls, backs off on failure and stops on disconnect',async()=>{
 const run=async({batches,intervalMs,failAt})=>{
  const calls=[],stamps=[];let polls=0,disconnects=0;const started=Date.now();
  const fetcher=async(url,options)=>{const path=new URL(url).pathname;calls.push(path);
   if(path==='/pair')return {ok:true,json:async()=>({token:'t',sessionId:'s'})};
   if(path==='/poll'){stamps.push(Date.now()-started);polls++;if(failAt===polls)return {ok:false,status:500,json:async()=>({})};const commands=batches[polls-1]??[];return {ok:true,json:async()=>({commands:commands.map(id=>({id,method:'getState',args:{},expiresAt:Date.now()+15000}))})};}
   return {ok:true,json:async()=>({})};};
  const states=[];const client=connectBrowserSession({endpoint:'http://127.0.0.1:12345',pairingToken:'p',scopes:['inspect'],session:{async call(){return {ok:true};},disconnect(){disconnects++;}},fetcher,intervalMs,onState:s=>states.push(s.state)});
  await client.ready;return {client,calls,stamps,states,disconnects:()=>disconnects};};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 // 20 back-to-back commands with a 5 s idle interval finish well within it
 const busy=await run({batches:[['a'],['b'],['c'],['d'],['e'],['f'],['g'],['h'],['i'],['j']],intervalMs:5000});
 await wait(200);assert.equal(busy.calls.filter(p=>p==='/reply').length,10);assert.ok(busy.stamps.length>=11&&busy.stamps[10]<1000,'handled commands must not wait for the idle interval');
 const before=busy.stamps.length;await wait(150);assert.equal(busy.stamps.length,before,'after an empty poll the idle interval applies');busy.client.stop();
 // idle polling keeps the interval
 const idle=await run({batches:[],intervalMs:60});await wait(250);idle.client.stop();assert.ok(idle.stamps.length>=3&&idle.stamps.length<=6);assert.ok(idle.stamps[2]-idle.stamps[1]>=50);
 // failure disconnects and stops polling
 const failing=await run({batches:[['a']],intervalMs:5,failAt:2});await wait(100);assert.equal(failing.states[0],'connected');assert.ok(failing.states.includes('disconnected'));assert.equal(failing.stamps.length,2);assert.equal(failing.disconnects(),1);
 // disconnect during a command burst stops further polls
 const stopping=await run({batches:Array(50).fill(['a']),intervalMs:5000});stopping.client.stop();const count=stopping.stamps.length;await wait(100);assert.equal(stopping.stamps.length,count);assert.equal(stopping.disconnects(),1);
});

const lpHeaders=(origin,token)=>({Origin:origin,Authorization:'Bearer '+token});
async function lpBridge(t,options={}){const origin='https://studio.example';const bridge=await createBrowserBridge({origin,...options});t.after(()=>bridge.close());const f=(url,o={})=>fetch(url,{...o,headers:{...o.headers,Origin:origin}});return {bridge,origin,fetcher:f};}
test('bridge long-poll delivers a command sent while a poll is parked in well under 100 ms and releases empty polls after the wait',async t=>{
 const {bridge,origin,fetcher}=await lpBridge(t,{pollWaitMs:400});
 const paired=await (await fetcher(bridge.endpoint+'/pair',{method:'POST',headers:{Authorization:'Bearer '+bridge.pairingToken,'Content-Type':'application/json'},body:JSON.stringify({scopes:['inspect']})})).json();
 const H=lpHeaders(origin,paired.token);
 let t0=Date.now();const empty=await (await fetch(bridge.endpoint+'/poll',{headers:H})).json();const idleMs=Date.now()-t0;assert.deepEqual(empty.commands,[]);assert.ok(idleMs>=350&&idleMs<1500,'empty poll parks for about pollWaitMs: '+idleMs);
 const parked=fetch(bridge.endpoint+'/poll',{headers:H}).then(r=>r.json());await new Promise(r=>setTimeout(r,50));
 t0=Date.now();const result=bridge.call(paired.sessionId,'getState',{});const got=await parked;const deliverMs=Date.now()-t0;assert.equal(got.commands.length,1);assert.ok(deliverMs<100,'delivered in '+deliverMs);
 await fetch(bridge.endpoint+'/reply',{method:'POST',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({id:got.commands[0].id,value:{ok:1}})});assert.deepEqual(await result,{ok:1});
 // a command queued before the poll is returned immediately
 const q=bridge.call(paired.sessionId,'getState',{});t0=Date.now();const now1=await (await fetch(bridge.endpoint+'/poll',{headers:H})).json();assert.ok(Date.now()-t0<100&&now1.commands.length===1);
 await fetch(bridge.endpoint+'/reply',{method:'POST',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({id:now1.commands[0].id,value:1})});await q;
});
test('bridge long-poll keeps refusals unchanged and shutdown/disconnect/abort release parked polls without leaks',async t=>{
 const origin='https://studio.example';const bridge=await createBrowserBridge({origin,pollWaitMs:5000});
 // Assertion failures must release the server too; otherwise this test process never exits.
 t.after(()=>bridge.close());
 const f=(url,o={})=>fetch(url,{...o,headers:{...o.headers,Origin:origin}});
 const pair=async()=>(await (await f(bridge.endpoint+'/pair',{method:'POST',headers:{Authorization:'Bearer '+bridge.pairingToken,'Content-Type':'application/json'},body:JSON.stringify({scopes:['inspect']})})).json());
 let t0=Date.now();assert.equal((await fetch(bridge.endpoint+'/poll',{headers:{Origin:'https://evil.example',Authorization:'Bearer x'}})).status,403);assert.equal((await f(bridge.endpoint+'/poll',{headers:{Authorization:'Bearer wrong'}})).status,401);assert.ok(Date.now()-t0<500,'refusals never park');
 const a=await pair(),b=await pair(),c=await pair();
 const pa=f(bridge.endpoint+'/poll',{headers:{Authorization:'Bearer '+a.token}}).then(r=>r.json());
 await new Promise(r=>setTimeout(r,30));t0=Date.now();await f(bridge.endpoint+'/disconnect',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:'{}'});assert.deepEqual((await pa).commands,[]);assert.ok(Date.now()-t0<300,'disconnect releases parked poll');
 const ctl=new AbortController();const pb=f(bridge.endpoint+'/poll',{headers:{Authorization:'Bearer '+b.token},signal:ctl.signal}).catch(e=>e.name);await new Promise(r=>setTimeout(r,30));ctl.abort();assert.equal(await pb,'AbortError');
 const pc=f(bridge.endpoint+'/poll',{headers:{Authorization:'Bearer '+c.token}}).then(r=>r.json()).catch(()=>'closed');await new Promise(r=>setTimeout(r,30));
 t0=Date.now();await bridge.close();assert.ok(Date.now()-t0<1000,'close does not wait for the poll wait');await pc;
});
test('20 sequential commands round-trip fast through the real bridge with long-poll, and idle request rate stays low',async t=>{
 const {bridge,origin,fetcher}=await lpBridge(t,{pollWaitMs:1000});
 const requests=[];const counting=(url,o)=>{requests.push(new URL(url).pathname);return fetcher(url,o);};
 const client=connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes:['inspect'],session:{async call(){return {ok:true};},disconnect(){}},fetcher:counting});t.after(()=>client.stop());
 const {sessionId}=await client.ready;
 await new Promise(r=>setTimeout(r,150));
 const t0=Date.now();for(let i=0;i<20;i++)assert.deepEqual(await bridge.call(sessionId,'inspect',{}),{ok:true});const ms=Date.now()-t0;assert.ok(ms<1000,'20 sequential commands took '+ms+' ms (was ~15 s with the 750 ms idle wait)');
 const before=requests.length;await new Promise(r=>setTimeout(r,2200));assert.ok(requests.length-before<=6,'idle polls: '+(requests.length-before));
});
