import {prepareCaseView} from '../src/case-view.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
import {createCaseStore} from '../src/cases.js';
import {createCaseViewBundle} from '../src/case-view-bundle.js';
import {createNamedResultViews} from '../src/named-result-views.js';
import {createResultViewApi} from '../src/result-view-api.js';
import {getProjectRevision} from '../src/project-revision.js';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';

const origin='http://127.0.0.1:5174';
const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]},note:'日本語'.repeat(30000)});

// This exercises the real MCP child and HTTP bridge with a Node-hosted semantic
// adapter. It is protocol integration evidence, not a real-browser/UI test.
test('MCP and HTTP round-trip linked case/view archives with bounded chunks, CAS and atomic validation',async t=>{
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
 const store=createCaseStore();store.add('大きいケース',output());let analysis=prepareCaseView(store.list()[0]);
 let resultSettings={field:'stress',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:{field:'stress',minimum:0,maximum:1},camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}},setup={clipEnabled:false,flip:false,axis:0,position:0,opacity:1,meshCount:1,hiddenParts:[]};
 const resultView=createResultViewApi({getAnalysis:()=>analysis,get:()=>resultSettings,set:value=>{resultSettings=structuredClone(value);},isBusy:()=>false}),namedViews=createNamedResultViews({resultView,setupView:{get:()=>setup,set:value=>{setup=structuredClone(value);}}});
 const resultRevision=await getProjectRevision(analysis);await namedViews.save({name:'日本語の表示',expectedResultRevision:resultRevision,expectedArchiveRevision:(await namedViews.list()).archiveRevision});
 const originalCases=store.export(),originalViews=await namedViews.export(),original={version:1,kind:'case-view-bundle',caseArchive:originalCases,namedViewArchive:originalViews},caseBundles=createCaseViewBundle({store,namedViews}),caseBundleTransfers=createCaseArchiveTransfer({cases:caseBundles});
 const pair=async scopes=>{const session=createBrowserSession({caseBundles,caseBundleTransfers});const client=connectBrowserSession({...details,scopes,session,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}}),intervalMs:2});clients.push(client);return (await client.ready).sessionId;};
 const sessionId=await pair(['inspect','edit']);
 const raw=(method,args={},id=sessionId)=>rpc('tools/call',{name:'studio_browser_call',arguments:{sessionId:id,method,args}});
 const call=async(method,args={})=>{const reply=await raw(method,args);assert.equal(reply.result?.isError,undefined,JSON.stringify(reply));return reply.result.structuredContent.value;};
 const refuses=async(method,args,pattern,id=sessionId)=>{const reply=await raw(method,args,id);assert.equal(reply.result.isError,true);assert.match(reply.result.content[0].text,pattern);};
 const before=await call('caseBundleList');assert.equal(before.archiveRevision,await getProjectRevision(original));assert.equal(before.caseCount,1);assert.equal(before.viewCount,1);
 const exported=await call('caseBundleExport');assert.ok(exported.totalBytes>65536);assert.equal(exported.maxChunkBytes,65536);const chunks=[];let offset=0;
 do{const page=await call('caseBundleRead',{transferId:exported.transferId,offset});const bytes=Buffer.from(page.data,'base64');assert.ok(bytes.length<=65536);chunks.push(bytes);offset=page.nextOffset;}while(offset!==null);
 assert.ok(chunks.length>1);const bytes=Buffer.concat(chunks);assert.equal(hash(bytes),exported.sha256);assert.equal(bytes.length,exported.totalBytes);assert.deepEqual(JSON.parse(bytes.toString('utf8')),original);
 const upload=async(value,expectedArchiveRevision)=>{const data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)),entry=await call('caseBundleImport',{expectedArchiveRevision,totalBytes:data.length,sha256:hash(data)});for(let offset=0;offset<data.length;offset+=65536)await call('caseBundleWrite',{transferId:entry.transferId,offset,data:data.subarray(offset,offset+65536).toString('base64')});return entry;};
 store.import({version:1,cases:[]});await namedViews.import({archive:{version:1,views:[]},expectedArchiveRevision:(await namedViews.list()).archiveRevision});const empty=await call('caseBundleList');assert.equal(empty.caseCount,0);assert.equal(empty.viewCount,0);
 const entry=await upload(bytes,empty.archiveRevision),restored=await call('caseBundleCommit',{transferId:entry.transferId});assert.equal(restored.imported,true);assert.equal(restored.archiveRevision,before.archiveRevision);assert.deepEqual(store.export(),originalCases);assert.deepEqual(await namedViews.export(),originalViews);assert.deepEqual(store.export().cases[0].output.result.displacement,originalCases.cases[0].output.result.displacement);await call('caseBundleRelease',{transferId:entry.transferId});
 analysis=prepareCaseView(store.list()[0]);assert.equal((await resultView.get()).resultRevision,resultRevision);assert.equal((await namedViews.export()).views[0].resultRevision,(await resultView.get()).resultRevision);resultSettings.camera.fov=70;setup.opacity=.5;const selected=(await namedViews.list()).views[0];await namedViews.apply({viewId:selected.viewId,expectedRevision:selected.revision,expectedResultRevision:resultRevision});assert.equal(resultSettings.camera.fov,40);assert.equal(setup.opacity,1);
 const stale=await upload(bytes,empty.archiveRevision);await refuses('caseBundleCommit',{transferId:stale.transferId},/revision conflict/);assert.deepEqual(store.export(),originalCases);assert.deepEqual(await namedViews.export(),originalViews);await call('caseBundleRelease',{transferId:stale.transferId});
 const bad=structuredClone(original);bad.namedViewArchive.views[0].resultRevision='sha256:'+'0'.repeat(64);const invalid=await upload(bad,before.archiveRevision);await refuses('caseBundleCommit',{transferId:invalid.transferId},/matching saved result/);assert.deepEqual(store.export(),originalCases);assert.deepEqual(await namedViews.export(),originalViews);await call('caseBundleRelease',{transferId:invalid.transferId});
 const readonly=await pair(['inspect']);await refuses('caseBundleImport',{expectedArchiveRevision:before.archiveRevision,totalBytes:bytes.length,sha256:hash(bytes)},/scope refused/i,readonly);
 const abandoned=await upload(bytes,before.archiveRevision);clients[0].stop();await refuses('caseBundleCommit',{transferId:abandoned.transferId},/unavailable|revoked|disconnected/);await assert.rejects(caseBundleTransfers.commit({transferId:abandoned.transferId}),/released|Unknown/);assert.deepEqual(store.export(),originalCases);assert.deepEqual(await namedViews.export(),originalViews);
});
