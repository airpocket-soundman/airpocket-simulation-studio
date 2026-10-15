import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

async function start(t,entry,connector=true){
 const origin='https://configured.example',child=spawn(process.execPath,[entry,...(connector?['--browser-origin='+origin]:[])],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='',details,ready;
 const startup=new Promise(resolve=>{ready=resolve;});
 child.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/Browser connector: (.+)\n/);if(match){details=JSON.parse(match[1]);ready();}});
 lines.on('line',line=>{const message=JSON.parse(line),item=pending.get(message.id);if(item){pending.delete(message.id);clearTimeout(item.timer);item.resolve(message);}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP diagnostic response timeout'));},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 child.on('exit',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('MCP exited'));}pending.clear();});
 t.after(async()=>{const stopped=child.exitCode!==null?null:once(child,'exit');child.stdin.end();if(stopped){const timer=setTimeout(()=>child.kill(),2000);await stopped;clearTimeout(timer);}lines.close();});
 await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');if(connector)await startup;
 const raw=(name,args={})=>rpc('tools/call',{name,arguments:args}),call=async(name,args={})=>{const reply=await raw(name,args);assert.notEqual(reply.result.isError,true,reply.result.content[0].text);assert.deepEqual(JSON.parse(reply.result.content[0].text),reply.result.structuredContent.value);return reply.result.structuredContent.value;};
 return {rpc,raw,call,details,origin};
}

for(const [entry,count]of [['scripts/studio-mcp.mjs',33],['scripts/studio-browser-mcp.mjs',3]])test(entry+' exposes opt-in redacted diagnostics through actual stdio after refusals and browser errors',async t=>{
 const mcp=await start(t,entry),tools=(await mcp.rpc('tools/list')).result.tools;assert.equal(tools.length,count);const declaration=tools.find(value=>value.name==='studio_browser_sessions');assert.deepEqual(declaration.inputSchema.properties.diagnostics,{type:'boolean'});assert.deepEqual(declaration.inputSchema.required,[]);
 assert.deepEqual(await mcp.call('studio_browser_sessions'),{sessions:[]});assert.deepEqual(await mcp.call('studio_browser_sessions',{diagnostics:false}),{sessions:[]});
 const baseline=(await mcp.call('studio_browser_sessions',{diagnostics:true})).diagnostics;
 const secrets=['received-secret-authorization','received-secret-token','received-secret-body','received-secret-url','received-secret-origin','received-secret-browser-code'],{endpoint,pairingToken}=mcp.details,headers={Origin:mcp.origin,Authorization:'Bearer '+pairingToken,'Content-Type':'application/json'};
 assert.equal((await fetch(endpoint+'/received-secret-url',{headers:{...headers,Origin:'https://received-secret-origin.example',Authorization:'Bearer '+secrets[0]}})).status,403);
 assert.equal((await fetch(endpoint+'/pair',{method:'POST',headers:{...headers,Authorization:'Bearer '+secrets[1]},body:JSON.stringify({scopes:['inspect'],payload:secrets[2]})})).status,401);
 assert.equal((await fetch(endpoint+'/pair',{method:'POST',headers,body:'{"received-secret-body"'})).status,400);
 const pair=await(await fetch(endpoint+'/pair',{method:'POST',headers,body:JSON.stringify({scopes:['inspect']})})).json(),sessionHeaders={...headers,Authorization:'Bearer '+pair.token};
 const denied=await mcp.raw('studio_browser_call',{sessionId:pair.sessionId,method:'edit',args:{private:secrets[2]}});assert.equal(denied.result.isError,true);
 const failing=mcp.raw('studio_browser_call',{sessionId:pair.sessionId,method:'inspect'});let commands=[];const deadline=Date.now()+5000;
 while(!commands.length){assert.ok(Date.now()<deadline);commands=(await(await fetch(endpoint+'/poll',{headers:sessionHeaders})).json()).commands;if(!commands.length)await new Promise(resolve=>setTimeout(resolve,5));}
 await fetch(endpoint+'/reply',{method:'POST',headers:sessionHeaders,body:JSON.stringify({id:commands[0].id,error:{code:secrets[5],message:'Synthetic browser rejection'}})});assert.equal((await failing).result.isError,true);
 const snapshot=await mcp.call('studio_browser_sessions',{diagnostics:true}),diagnostics=snapshot.diagnostics;assert.equal(snapshot.sessions.length,1);assert.equal(diagnostics.schemaVersion,1);assert.equal(diagnostics.kind,'airpocket-browser-bridge-diagnostics');assert.equal(diagnostics.origin,mcp.origin);assert.equal(diagnostics.endpoint,endpoint);
 for(const name of ['originHostRefused','pairRefused','requestErrors','pairSuccess','scopeRefused'])assert.ok(diagnostics.counters[name]>baseline.counters[name],name);
 assert.ok(Object.values(diagnostics.counters).every(value=>Number.isSafeInteger(value)&&value>=0));const serialized=JSON.stringify(diagnostics);for(const value of [...secrets,pairingToken,pair.token,pair.sessionId])assert.equal(serialized.includes(value),false,value);for(const key of ['authorization','headers','body','code','token'])assert.equal(Object.hasOwn(diagnostics,key),false);
 assert.deepEqual(Object.keys(await mcp.call('studio_browser_sessions')).sort(),['sessions']);
 for(const value of ['received-secret-token',1,null,{}]){const error=await mcp.raw('studio_browser_sessions',{diagnostics:value});assert.equal(error.result.isError,true);assert.equal(JSON.stringify(error).includes('received-secret-token'),false);}
});

test('default full MCP keeps 31 tools and does not enable browser diagnostics',async t=>{const mcp=await start(t,'scripts/studio-mcp.mjs',false),tools=(await mcp.rpc('tools/list')).result.tools;assert.equal(tools.length,31);assert.equal(tools.some(value=>value.name==='studio_browser_sessions'),false);assert.equal((await mcp.raw('studio_browser_sessions',{diagnostics:true})).result.isError,true);});
