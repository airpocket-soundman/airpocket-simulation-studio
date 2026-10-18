import {assertMcpTools} from './fixtures/mcp-tool-contract.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createStudioApi} from '../src/studio-api.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';

async function server(t,connected=false){
 const origin='http://127.0.0.1:5174',child=spawn(process.execPath,['scripts/studio-mcp.mjs',...(connected?['--browser-origin='+origin]:[])],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='',details;
 child.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/Browser connector: (.+)\n/);if(match)details=JSON.parse(match[1]);});
 lines.on('line',line=>{const message=JSON.parse(line),p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);p.resolve(message);}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP response timeout'));},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 child.on('exit',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('MCP exited'));}pending.clear();});
 t.after(async()=>{child.stdin.end();if(child.exitCode===null&&child.signalCode===null){const timer=setTimeout(()=>child.kill(),2000);await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);}lines.close();});
 await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 if(connected){const deadline=Date.now()+5000;while(!details){assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,5));}}
 const raw=(name,args={})=>rpc('tools/call',{name,arguments:args}),call=async(name,args={})=>{const r=await raw(name,args);assert.notEqual(r.result.isError,true,r.result.content?.[0]?.text);assert.deepEqual(JSON.parse(r.result.content[0].text),r.result.structuredContent.value);return r.result.structuredContent.value;};
 return {rpc,raw,call,origin,details};
}
test('real stdio MCP discovers bounded contracts without enabling a browser connector',async t=>{
 const mcp=await server(t),tools=(await mcp.rpc('tools/list')).result.tools;assertMcpTools(tools);assert.ok(!tools.some(tool=>tool.name==='studio_browser_call'));const tool=tools.find(tool=>tool.name==='studio_browser_contracts');assert.equal(tool.annotations.readOnlyHint,true);
 const page=await mcp.call('studio_browser_contracts',{method:'startJob'});assert.deepEqual(page,getBrowserOperationContracts({method:'startJob'}));assert.ok(page.operations[0].inputSchema.required.includes('requestId'));
 const gpuPage=await mcp.call('studio_browser_contracts',{method:'checkGpuEnvironment'});assert.deepEqual(gpuPage,getBrowserOperationContracts({method:'checkGpuEnvironment'}));assert.equal(gpuPage.operations[0].scope,'inspect');assert.deepEqual(gpuPage.operations[0].inputSchema.required,[]);assert.deepEqual(gpuPage.operations[0].sideEffects,[]);
 const bad=await mcp.raw('studio_browser_contracts',{limit:11});assert.equal(bad.result.isError,true);assert.equal(bad.result.structuredContent.error.code,'BROWSER_CONTRACT_QUERY_INVALID');assert.equal((await mcp.call('studio_capabilities')).connector.publicHttpsVerified,false);
});
test('real MCP uses discovered edit contracts and preserves a tagged core rejection across live HTTP without changing input',async t=>{
 const mcp=await server(t,true),studio=createStudioApi();studio.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}));
 const session=createBrowserSession({studio}),connection=connectBrowserSession({...mcp.details,scopes:['inspect','edit'],session,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:mcp.origin}}),intervalMs:2});t.after(()=>connection.stop());const {sessionId}=await connection.ready;
 const raw=(method,args={})=>mcp.raw('studio_browser_call',{sessionId,method,args}),live=async(method,args={})=>{const r=await raw(method,args);assert.notEqual(r.result.isError,true,r.result.content?.[0]?.text);return r.result.structuredContent.value;};
 const contract=(await mcp.call('studio_browser_contracts',{method:'edit'})).operations[0];assert.equal(contract.scope,'edit');assert.ok(contract.inputSchema.required.includes('operations'));assert.ok(contract.inputSchema.required.includes('expectedRevision'));
 const inspected=await live('inspect'),before=studio.exportProject();assert.equal(inspected.operationContracts.mcp,'studio_browser_contracts');
 const operations=[{method:'selectTriangles',args:[0,[0]]},{method:'addCondition',args:[{type:'displacement',value:0,frame:{axis:0,axes:[[2,0,0],[0,1,0],[0,0,1]]}}]}];
 const rejected=await raw('edit',{expectedRevision:inspected.revision,operations}),error=rejected.result.structuredContent.error;assert.equal(rejected.result.isError,true);assert.equal(error.code,'ANALYSIS_CONSTRAINT_FRAME_ORTHONORMALITY');assert.equal(error.message,'Local axes must be orthonormal');assert.equal(error.failure.stage,'constraints');assert.equal(error.failure.diagnostics[0].evidence.axisIndex,0);assert.ok(!JSON.stringify(error).includes('stack'));assert.deepEqual(studio.exportProject(),before);assert.equal((await live('inspect')).revision,inspected.revision);
 const fixed=structuredClone(operations);fixed[1].args[0].frame.axes[0]=[1,0,0];const edited=await live('edit',{expectedRevision:inspected.revision,operations:fixed});assert.notEqual(edited.revision,inspected.revision);assert.equal(studio.exportProject().conditions.length,1);
 const readonly=connectBrowserSession({...mcp.details,scopes:['inspect'],session:createBrowserSession({studio}),fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:mcp.origin}}),intervalMs:2});t.after(()=>readonly.stop());const id=(await readonly.ready).sessionId,denied=await mcp.raw('studio_browser_call',{sessionId:id,method:'edit',args:{expectedRevision:edited.revision,operations:[]}});assert.equal(denied.result.isError,true);assert.equal(denied.result.structuredContent.error.code,'BROWSER_SCOPE_REFUSED');assert.equal((await live('inspect')).revision,edited.revision);
});
