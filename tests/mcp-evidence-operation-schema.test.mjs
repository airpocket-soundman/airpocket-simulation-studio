import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createStudioApi} from '../src/studio-api.js';
import {createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {structuralContractProject} from './fixtures/structural-contract-projects.mjs';
import {accepts} from './fixtures/evidence-schema-validation.mjs';

test('real MCP discovers evidence setters, repairs exploratory preflight and refuses malformed edits without changing live input',async t=>{
 const origin='https://evidence-fixture.example',child=spawn(process.execPath,['scripts/studio-mcp.mjs','--browser-origin='+origin],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='',details;
 child.stderr.on('data',chunk=>{stderr+=chunk;const match=stderr.match(/Browser connector: (.+)\n/);if(match)details=JSON.parse(match[1]);});
 lines.on('line',line=>{const response=JSON.parse(line),item=pending.get(response.id);if(item){pending.delete(response.id);clearTimeout(item.timer);item.resolve(response);}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Evidence MCP timeout'));},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 child.on('exit',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('MCP exited'));}pending.clear();});
 let connection;t.after(async()=>{connection?.stop();const exit=child.exitCode===null?new Promise(resolve=>child.once('exit',resolve)):null;child.stdin.end();if(exit){const timer=setTimeout(()=>child.kill(),2000);await exit;clearTimeout(timer);}lines.close();});
 await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');const deadline=Date.now()+5000;while(!details){assert.ok(Date.now()<deadline);await new Promise(resolve=>setTimeout(resolve,5));}
 const raw=(name,args)=>rpc('tools/call',{name,arguments:args}),call=async(name,args)=>{const reply=await raw(name,args);assert.notEqual(reply.result.isError,true,reply.result.content[0].text);return reply.result.structuredContent.value;};
 const edit=(await call('studio_browser_contracts',{method:'edit'})).operations[0],preview=(await call('studio_browser_contracts',{method:'previewEdit'})).operations[0];assert.deepEqual(edit.inputSchema.properties.operations.items.allOf,preview.inputSchema.properties.operations.items.allOf);
 const operationSchema=edit.inputSchema.properties.operations.items,clauses=operationSchema.allOf,provenance=clauses.find(item=>item.if.properties.method.const==='setInputProvenance').then.properties.args.prefixItems[0],intent=clauses.find(item=>item.if.properties.method.const==='setAnalysisIntent').then.properties.args.prefixItems[0];
 assert.ok(provenance.properties.entries.items.required.includes('applicability'));assert.ok(intent.properties.mode.enum.includes('exploratory'));
 const studio=createStudioApi();studio.loadProject(structuralContractProject());connection=connectBrowserSession({...details,scopes:['inspect','edit'],session:createBrowserSession({studio}),fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}}),intervalMs:2});const {sessionId}=await connection.ready;
 const live=(method,args={})=>call('studio_browser_call',{sessionId,method,args}),rawLive=(method,args={})=>raw('studio_browser_call',{sessionId,method,args});
 const initial=await live('inspect'),choose={method:'setAnalysisIntent',args:[{mode:intent.properties.mode.enum.find(value=>value==='exploratory')}]};assert.equal(accepts(operationSchema,choose),true);
 await live('edit',{expectedRevision:initial.revision,operations:[choose]});const missing=await live('preflight'),issues=missing.diagnostics.filter(value=>value.code==='PROVENANCE_REQUIRED');assert.ok(issues.length);assert.equal(missing.allowed,false);
 const itemSchema=provenance.properties.entries.items,document={schemaVersion:provenance.properties.schemaVersion.const,entries:issues.map(issue=>({pointer:issue.target,value:issue.evidence.value,source:{kind:itemSchema.properties.source.properties.kind.enum.find(value=>value==='agent-proposal')},rationale:'Explicit synthetic test reference',applicability:'Only validates the evidence workflow, not material design data',status:itemSchema.properties.status.enum.find(value=>value==='unconfirmed'),assumption:'Explicit unverified synthetic test assumption'}))},repair={method:'setInputProvenance',args:[document]};assert.equal(accepts(operationSchema,repair),true);
 const revision=(await live('inspect')).revision,before=studio.exportProject(),candidate=await live('previewEdit',{expectedRevision:revision,operations:[repair]});assert.deepEqual(studio.exportProject(),before);await live('edit',{expectedRevision:revision,expectedResultingRevision:candidate.revision,operations:[repair]});
 const repaired=await live('preflight');assert.equal(repaired.allowed,true,JSON.stringify(repaired.diagnostics));assert.equal(repaired.provisional,true);assert.equal(repaired.completePreflight,false);
 const unchanged=studio.exportProject(),current=(await live('inspect')).revision;for(const bad of [{method:'setAnalysisIntent',args:[{mode:'legacy'}]},{method:'setInputProvenance',args:[{schemaVersion:1,entries:[{...document.entries[0],applicability:''}]}]}]){
  assert.equal(accepts(operationSchema,bad),false);for(const method of ['previewEdit','edit'])assert.equal((await rawLive(method,{expectedRevision:current,operations:[bad]})).result.isError,true);assert.deepEqual(studio.exportProject(),unchanged);assert.equal((await live('inspect')).revision,current);
 }
 const quantitative={method:'setAnalysisIntent',args:[{mode:'quantitative'}]};assert.equal(accepts(operationSchema,quantitative),true);await live('edit',{expectedRevision:current,operations:[quantitative]});const unconfirmed=await live('preflight');assert.equal(unconfirmed.allowed,false);assert.ok(unconfirmed.diagnostics.some(value=>value.code==='INPUT_UNCONFIRMED'));
 // A schema-valid status change alone cannot confer user confirmation on an
 // agent proposal. The fixture's explicit user confirmation is a separate edit.
 const confirmed=structuredClone(document);for(const record of confirmed.entries){record.status='confirmed';record.assumption=null;}
 await live('edit',{expectedRevision:(await live('inspect')).revision,operations:[{method:'setInputProvenance',args:[confirmed]}]});assert.ok((await live('preflight')).diagnostics.some(value=>value.code==='INPUT_UNCONFIRMED'));
 for(const record of confirmed.entries)record.confirmation={by:itemSchema.properties.confirmation.properties.by.const,note:'Explicit synthetic fixture user confirmation; not production material evidence'};
 const confirm={method:'setInputProvenance',args:[confirmed]};assert.equal(accepts(operationSchema,confirm),true);await live('edit',{expectedRevision:(await live('inspect')).revision,operations:[confirm]});const quantitativeReport=await live('preflight');assert.equal(quantitativeReport.allowed,true,JSON.stringify(quantitativeReport.diagnostics));assert.equal(quantitativeReport.provisional,false);assert.equal(quantitativeReport.completePreflight,false);
});
