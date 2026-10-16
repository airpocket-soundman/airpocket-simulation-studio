import {test} from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {compareSavedCaseArchive} from '../scripts/studio-mcp.mjs';
const point=[.1,.1,.1],hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
function archive(){
 const input={version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],study:{kind:'thermal'}},mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},calculation={operation:'elastic',options:{size:1,method:'pcg',adaptive:false,maxRounds:1}};
 const thermal=offset=>({input:structuredClone(input),mesh:structuredClone(mesh),calculation:structuredClone(calculation),result:{kind:'thermal',engine:'Synthetic fixture CPU',temperature:[20,30,40,50].map(x=>x+offset),flux:[[1,2,3]],minTemperature:20+offset,maxTemperature:50+offset}});
 const elastic={input:{...structuredClone(input),study:{kind:'structural'}},mesh:structuredClone(mesh),calculation:structuredClone(calculation),result:{kind:'elastic',engine:'Synthetic fixture CPU',displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[2000000],maxDisplacementMm:0,maxVonMisesPa:2000000}};
 return {version:1,cases:[{name:'Synthetic thermal A',output:thermal(0)},{name:'Synthetic thermal B',output:thermal(10)},{name:'Synthetic stress',output:elastic}]};
}
function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='';child.stderr.on('data',data=>{stderr=(stderr+data).slice(-4000);});
 const fail=error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};child.on('error',fail);child.on('exit',code=>fail(Error('MCP exited '+code+': '+stderr)));
 lines.on('line',line=>{try{const message=JSON.parse(line),item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);item.resolve(message);}catch(error){fail(error);}});
 const request=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP timeout'));},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 return {request,notify:()=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n'),raw:args=>request('tools/call',{name:'studio_compare_cases',arguments:args}),async call(args){const response=(await this.raw(args)).result;assert.notEqual(response.isError,true,JSON.stringify(response));assert.deepEqual(JSON.parse(response.content[0].text),response.structuredContent.value);return response.structuredContent.value;},async close(){const done=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);await done;clearTimeout(timer);lines.close();}};
}
const reference=(catalog,index,field)=>({caseId:catalog.cases[index].caseId,expectedRevision:catalog.cases[index].revision,field});
test('real MCP lists stable snapshot-local saved cases then compares physical values without writes or analysis',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mcp-case-comparison-')),mcp=server();try{
  const path=join(directory,'archive.json'),raw=Buffer.from(JSON.stringify(archive(),null,2));await writeFile(path,raw);
  await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();const tools=(await mcp.request('tools/list',{})).result.tools;assert.equal(tools.length,31);const tool=tools.find(tool=>tool.name==='studio_compare_cases');assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.inputSchema.properties.references.maxItems,8);assert.deepEqual(tool.inputSchema.required,['path']);
  const catalog=await mcp.call({path});assert.deepEqual(catalog.cases.map(row=>row.caseId),['saved-case:0','saved-case:1','saved-case:2']);assert.equal(catalog.source.sha256,hash(raw));assert.equal(catalog.source.bytes,raw.length);
  const references=[reference(catalog,0,'temperature'),reference(catalog,1,'temperature')],request={path,references,point,expectedArchiveRevision:catalog.archiveRevision},comparison=await mcp.call(request);
  assert.ok(Buffer.byteLength(JSON.stringify(comparison))<=65536);assert.equal(comparison.bounds.maxResponseBytes,65536);assert.equal(comparison.source.sha256,catalog.source.sha256);assert.equal(comparison.references[0].measurement.values.temperature,26);assert.equal(comparison.references[1].measurement.values.temperature,36);assert.equal(comparison.comparison.comparable,true);assert.equal(comparison.comparison.deltas[0].values.temperature,10);
  const stress=await mcp.call({...request,references:[reference(catalog,2,'stress')]});assert.equal(stress.references[0].measurement.values.vonMisesPa,2000000);assert.equal(stress.references[0].measurement.units.vonMisesPa,'Pa');
  // A second request reloads the file into a fresh adapter but reproduces identity and revision.
  assert.deepEqual(await mcp.call({path}),catalog);assert.deepEqual(await mcp.call(request),comparison);
  for(const invalid of [{path,point},{path,expectedArchiveRevision:catalog.archiveRevision},{...request,expectedArchiveRevision:'sha256:'+'0'.repeat(64)},{path,references},{...request,references:[{...references[0],expectedRevision:'sha256:'+'0'.repeat(64)}]},{...request,references:[{...references[0],field:'missing'}]},{...request,references:[{...references[0],frameIndex:0}]},{...request,references:[{...references[0],elementIndex:99}]},{...request,references:[{...references[0],bodyIndex:99}]},{...request,references:Array(9).fill(references[0])},{...request,references:[{...references[0],caseId:'saved-case:99'}]}])assert.equal((await mcp.raw(invalid)).result.isError,true,JSON.stringify(invalid));
  assert.deepEqual(await readFile(path),raw);
  const corrupt=archive();corrupt.cases[2].output.result.displacement.pop();const corruptPath=join(directory,'corrupt-unselected.json');await writeFile(corruptPath,JSON.stringify(corrupt));assert.equal((await mcp.raw({...request,path:corruptPath})).result.isError,true);
  const changed=archive();changed.cases[2].name='Renamed unrelated case';const changedPath=join(directory,'changed.json');await writeFile(changedPath,JSON.stringify(changed));assert.equal((await mcp.raw({...request,path:changedPath})).result.isError,true);
 }finally{await mcp.close();await rm(directory,{recursive:true,force:true});}
});
test('saved comparison rejects source changes after inspection and never executes injected accessors',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'case-comparison-race-'));try{
  const path=join(directory,'archive.json'),raw=Buffer.from(JSON.stringify(archive()));await writeFile(path,raw);let reads=0;
  await assert.rejects(compareSavedCaseArchive({path},{readSource:async()=>++reads===1?raw:Buffer.concat([raw,Buffer.from('\n')])}),{code:'CASE_ARCHIVE_SOURCE_CHANGED'});assert.deepEqual(await readFile(path),raw);
  let invoked=false;await assert.rejects(compareSavedCaseArchive({path,get references(){invoked=true;return [];}}));assert.equal(invoked,false);
 }finally{await rm(directory,{recursive:true,force:true});}
});
