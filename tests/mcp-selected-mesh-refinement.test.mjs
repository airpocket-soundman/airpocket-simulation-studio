import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createStudioApi} from '../src/studio-api.js';
import {createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {structuralContractProject} from './fixtures/structural-contract-projects.mjs';
import {mkdtemp,writeFile,readFile,rm,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {accepts} from './fixtures/evidence-schema-validation.mjs';

test('real stdio and paired MCP discover and execute selected mesh refinement without source overwrite',async t=>{
 const origin='https://evidence-fixture.example',child=spawn(process.execPath,['scripts/studio-mcp.mjs','--browser-origin='+origin],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='',details;
 child.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/Browser connector: (.+)\n/);if(match)details=JSON.parse(match[1]);});
 lines.on('line',line=>{const response=JSON.parse(line),item=pending.get(response.id);if(item){pending.delete(response.id);clearTimeout(item.timer);item.resolve(response);}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Evidence MCP timeout'));},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 child.on('exit',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('MCP exited'));}pending.clear();});
 let connection;t.after(async()=>{connection?.stop();const exit=child.exitCode===null?new Promise(resolve=>child.once('exit',resolve)):null;child.stdin.end();if(exit){const timer=setTimeout(()=>child.kill(),2000);await exit;clearTimeout(timer);}lines.close();});
 await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');const deadline=Date.now()+5000;while(!details){assert.ok(Date.now()<deadline);await new Promise(resolve=>setTimeout(resolve,5));}
 const raw=(name,args)=>rpc('tools/call',{name,arguments:args}),call=async(name,args)=>{const reply=await raw(name,args);assert.notEqual(reply.result.isError,true,reply.result.content[0].text);return reply.result.structuredContent.value;};
 const dir=await mkdtemp(join(tmpdir(),'selected-refinement-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const tools=(await rpc('tools/list')).result.tools,liveSchema=(await call('studio_browser_contracts',{method:'edit'})).operations[0].inputSchema.properties.operations.items;
 const operation={method:'addSelectedMeshRefinements',args:[{size:2,radius:10,baseSize:5}]};
 for(const name of ['studio_preview_edit','studio_edit_project']){const schema=tools.find(t=>t.name===name).inputSchema.properties.operations.items;assert.equal(accepts(schema,operation),true);assert.equal(accepts(schema,{...operation,args:[{size:2,radius:10}]}),false);assert.equal(accepts(schema,{...operation,args:[{...operation.args[0],extra:true}]}),false);}
 assert.equal(accepts(liveSchema,operation),true);assert.ok(Buffer.byteLength(JSON.stringify(await call('studio_browser_contracts',{method:'edit'})))<=65536);
 const studio=createStudioApi();studio.loadProject(structuralContractProject());studio.selectTriangles(0,[0]);const before=studio.exportProject(),path=join(dir,'input.json'),outputPath=join(dir,'edited.json');await writeFile(path,JSON.stringify(before));const source=await readFile(path,'utf8'),expectedRevision=await studio.getRevision(),operations=[operation];
 const savedPreview=await call('studio_preview_edit',{path,expectedRevision,operations}),savedEdit=await call('studio_edit_project',{path,outputPath,expectedRevision,expectedResultingRevision:savedPreview.revision,operations});assert.equal(savedEdit.revision,savedPreview.revision);assert.equal(await readFile(path,'utf8'),source);const saved=JSON.parse(await readFile(outputPath,'utf8'));
 connection=connectBrowserSession({...details,scopes:['inspect','edit'],session:createBrowserSession({studio}),fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}}),intervalMs:2});const {sessionId}=await connection.ready;
 const live=(method,args={})=>call('studio_browser_call',{sessionId,method,args}),preview=await live('previewEdit',{expectedRevision,operations});assert.deepEqual(studio.exportProject(),before);assert.equal(preview.revision,savedPreview.revision);await live('edit',{expectedRevision,expectedResultingRevision:preview.revision,operations});assert.deepEqual(studio.exportProject().meshSettings,saved.meshSettings);const current=studio.exportProject();
 const stale=await raw('studio_browser_call',{sessionId,method:'edit',args:{expectedRevision,operations}});assert.equal(stale.result.isError,true);assert.deepEqual(studio.exportProject(),current);
 const badPath=join(dir,'bad.json'),bad=await raw('studio_edit_project',{path,outputPath:badPath,expectedRevision,operations:[{...operation,args:[{size:2,radius:0,baseSize:5}]}]});assert.equal(bad.result.isError,true);assert.equal(await readFile(path,'utf8'),source);assert.deepEqual((await readdir(dir)).sort(),['edited.json','input.json']);
});
