import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {createBrowserMcp} from '../scripts/studio-browser-mcp.mjs';

test('browser-only API declares exactly three tools, rejects unknown arguments and enforces bridge pairing/scopes/expiry',async()=>{
 let now=1000;const service=await createBrowserMcp({origin:'https://example.com',ttlMs:100,now:()=>now,timeoutMs:1000});
 try{
  assert.deepEqual(service.toolList.map(t=>t.name),['studio_browser_contracts','studio_browser_sessions','studio_browser_call']);
  assert.deepEqual((await service.callTool('studio_browser_sessions')).sessions,[]);
  for(const [name,args]of [['studio_capabilities',{}],['studio_browser_sessions',{path:'secret'}],['studio_browser_call',{sessionId:'x',method:'inspect',extra:1}],['studio_browser_call',{sessionId:'x',method:'inspect',args:null}]])await assert.rejects(service.callTool(name,args));
  const contracts=await service.callTool('studio_browser_contracts',{method:'inspectInput'});assert.equal(contracts.operations[0].scope,'inspect');
  const {bridge}=service,headers={Origin:bridge.origin,Authorization:'Bearer '+bridge.pairingToken,'Content-Type':'application/json'};
  const refused=await fetch(bridge.endpoint+'/pair',{method:'POST',headers:{...headers,Origin:'https://wrong.example'},body:JSON.stringify({scopes:['inspect']})});assert.equal(refused.status,403);
  const pair=await(await fetch(bridge.endpoint+'/pair',{method:'POST',headers,body:JSON.stringify({scopes:['inspect']})})).json();
  assert.equal((await service.callTool('studio_browser_sessions')).sessions[0].sessionId,pair.sessionId);
  await assert.rejects(service.callTool('studio_browser_call',{sessionId:pair.sessionId,method:'edit'}),e=>e.code==='BROWSER_SCOPE_REFUSED');
  const pending=service.callTool('studio_browser_call',{sessionId:pair.sessionId,method:'inspect'}),sessionHeaders={Origin:bridge.origin,Authorization:'Bearer '+pair.token,'Content-Type':'application/json'};
  const {commands}=await(await fetch(bridge.endpoint+'/poll',{headers:sessionHeaders})).json();assert.equal(commands[0].method,'inspect');
  await fetch(bridge.endpoint+'/reply',{method:'POST',headers:sessionHeaders,body:JSON.stringify({id:commands[0].id,value:{revision:'observed'}})});assert.deepEqual(await pending,{revision:'observed'});
  const failed=assert.rejects(service.callTool('studio_browser_call',{sessionId:pair.sessionId,method:'inspect'}),e=>e.code==='INPUT_INSPECTION_STALE');const next=await(await fetch(bridge.endpoint+'/poll',{headers:sessionHeaders})).json();
  await fetch(bridge.endpoint+'/reply',{method:'POST',headers:sessionHeaders,body:JSON.stringify({id:next.commands[0].id,error:{message:'stale',code:'INPUT_INSPECTION_STALE'}})});await failed;
  now+=101;assert.deepEqual((await service.callTool('studio_browser_sessions')).sessions,[]);
 }finally{await service.close();}
});

test('dependency-free browser entry uses shared stdio protocol, emits pairing only on stderr and closes bridge on EOF',async()=>{
 const child=spawn(process.execPath,['scripts/studio-browser-mcp.mjs','--browser-origin=https://example.com'],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0,stderr='',endpoint;
 lines.on('line',line=>{const message=JSON.parse(line);pending.get(message.id)?.(message);});
 const rpc=(method,params)=>new Promise(resolve=>{const key=++id;pending.set(key,resolve);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),5000);child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Browser connector: (.+)\n/);if(match){endpoint=JSON.parse(match[1]).endpoint;clearTimeout(timer);resolve();}});});
  assert.equal((await rpc('tools/list')).error.code,-32000);
  assert.equal((await rpc('initialize',{protocolVersion:'2025-11-25'})).result.serverInfo.name,'airpocket-studio-browser');
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  assert.equal((await rpc('tools/list')).result.tools.length,3);
  const contracts=await rpc('tools/call',{name:'studio_browser_contracts',arguments:{method:'inspect'}});assert.equal(contracts.result.structuredContent.value.operations[0].method,'inspect');
  assert.equal((await rpc('tools/call',{name:'studio_browser_sessions',arguments:{unknown:true}})).result.isError,true);
  const exit=once(child,'exit');child.stdin.end();assert.equal((await exit)[0],0);await assert.rejects(fetch(endpoint));
 }finally{child.kill();lines.close();}
});

test('browser entry requires one explicit exact origin and refuses extra CLI arguments',async()=>{
 for(const args of [[],['--browser-origin=https://example.com/path'],['--browser-origin=https://example.com','--other']]){
  const child=spawn(process.execPath,['scripts/studio-browser-mcp.mjs',...args],{stdio:['ignore','pipe','pipe']});let stdout='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.resume();assert.notEqual((await once(child,'exit'))[0],0);assert.equal(stdout,'');
 }
});
