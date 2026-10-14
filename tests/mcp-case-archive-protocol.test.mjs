import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';

const origin='http://127.0.0.1:5174';
const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]},note:'日本語'.repeat(30000)});

// This exercises the real MCP child and HTTP bridge with a Node-hosted semantic
// adapter. It is protocol integration evidence, not a real-browser/UI test.
test('MCP and loopback transport round-trip a multi-chunk real case archive and reject unsafe replacement',async t=>{
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs','--browser-origin='+origin],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']});
 const lines=createInterface({input:child.stdout}),pending=new Map(),clients=[];let serial=0,stderr='';
 const rejectPending=error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};
 lines.on('line',line=>{try{const message=JSON.parse(line),item=pending.get(message.id);if(item){clearTimeout(item.timer);pending.delete(message.id);item.resolve(message);}}catch(error){rejectPending(error);}});
 child.on('error',rejectPending);child.on('exit',()=>rejectPending(Error('MCP child exited')));
 t.after(async()=>{for(const client of clients)client.stop();rejectPending(Error('Test cleanup'));child.stdin.end();if(child.exitCode===null&&child.signalCode===null){const timer=setTimeout(()=>child.kill(),2000);await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timer);}lines.close();});
 const details=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Connector did not start: '+stderr)),5000);child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Browser connector: (.+)\n/);if(match){clearTimeout(timer);resolve(JSON.parse(match[1]));}});child.once('error',error=>{clearTimeout(timer);reject(error);});});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP response timed out: '+method));},5000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const tools=await rpc('tools/list',{});assert.ok(tools.result.tools.some(tool=>tool.name==='studio_browser_call'));
 const store=createCaseStore();store.add('大きいケース',output());const original=store.export(),cases=createCaseOperations({store}),caseArchives=createCaseArchiveTransfer({cases});
 const pair=async scopes=>{const session=createBrowserSession({cases,caseArchives});const client=connectBrowserSession({...details,scopes,session,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}}),intervalMs:2});clients.push(client);return (await client.ready).sessionId;};
 const sessionId=await pair(['inspect','edit']);
 const raw=(method,args={},id=sessionId)=>rpc('tools/call',{name:'studio_browser_call',arguments:{sessionId:id,method,args}});
 const call=async(method,args={})=>{const reply=await raw(method,args);assert.equal(reply.result?.isError,undefined,JSON.stringify(reply));return reply.result.structuredContent.value;};
 const refuses=async(method,args,pattern,id=sessionId)=>{const reply=await raw(method,args,id);assert.equal(reply.result.isError,true);assert.match(reply.result.content[0].text,pattern);};
 const before=await call('caseList'),exported=await call('caseArchiveExport');assert.ok(exported.totalBytes>65536);assert.equal(exported.maxChunkBytes,65536);
 const chunks=[];let offset=0;do{const chunk=await call('caseArchiveRead',{transferId:exported.transferId,offset});assert.equal(chunk.offset,offset);const bytes=Buffer.from(chunk.data,'base64');assert.ok(bytes.length<=65536);chunks.push(bytes);offset=chunk.nextOffset;}while(offset!==null);
 assert.ok(chunks.length>1);const bytes=Buffer.concat(chunks);assert.equal(bytes.length,exported.totalBytes);assert.equal(hash(bytes),exported.sha256);assert.deepEqual(JSON.parse(bytes.toString('utf8')),original);
 const upload=async(value,expectedArchiveRevision)=>{const data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));const entry=await call('caseArchiveImport',{expectedArchiveRevision,totalBytes:data.length,sha256:hash(data)});for(let offset=0;offset<data.length;offset+=65536)await call('caseArchiveWrite',{transferId:entry.transferId,offset,data:data.subarray(offset,offset+65536).toString('base64')});return entry;};
 await call('caseRemove',{caseId:before.cases[0].caseId,expectedRevision:before.cases[0].revision});const empty=await call('caseList');assert.equal(empty.cases.length,0);
 const incoming=await upload(bytes,empty.archiveRevision),imported=await call('caseArchiveCommit',{transferId:incoming.transferId});assert.equal(imported.imported,true);assert.equal(imported.cases.length,1);assert.notEqual(imported.cases[0].caseId,before.cases[0].caseId);assert.deepEqual(store.export(),original);assert.deepEqual(store.export().cases[0].output.result.displacement,original.cases[0].output.result.displacement);
 await refuses('caseRemove',{caseId:before.cases[0].caseId,expectedRevision:before.cases[0].revision},/Unknown|unknown/);
 await call('caseArchiveRelease',{transferId:incoming.transferId});
 const stale=await upload(bytes,empty.archiveRevision);await refuses('caseArchiveCommit',{transferId:stale.transferId},/collection changed/i);assert.deepEqual(store.export(),original);await call('caseArchiveRelease',{transferId:stale.transferId});
 const corrupt=structuredClone(original);corrupt.cases[0].output.result.displacement.pop();const invalid=await upload(corrupt,imported.archiveRevision);await refuses('caseArchiveCommit',{transferId:invalid.transferId},/fields/);assert.deepEqual(store.export(),original);await call('caseArchiveRelease',{transferId:invalid.transferId});
 const readonly=await pair(['inspect']);await refuses('caseArchiveImport',{expectedArchiveRevision:imported.archiveRevision,totalBytes:bytes.length,sha256:hash(bytes)},/scope refused/i,readonly);assert.deepEqual(store.export(),original);
 await call('caseArchiveRelease',{transferId:exported.transferId});await refuses('caseArchiveRead',{transferId:exported.transferId},/released/);
});
