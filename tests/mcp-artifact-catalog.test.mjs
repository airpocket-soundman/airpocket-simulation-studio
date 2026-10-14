import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BoxGeometry} from 'three';

function project(){
 const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
 const face=z=>Array.from({length:12},(_,i)=>i).filter(i=>[2,5,8].every(k=>positions[9*i+k]===z));
 return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:0},conditions:[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}]};
}
function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='';
 child.stderr.on('data',data=>{stderr+=data;});
 const fail=error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};
 lines.on('line',line=>{try{const message=JSON.parse(line);assert.equal(message.jsonrpc,'2.0');const item=pending.get(message.id);assert.ok(item,'Unexpected protocol response');pending.delete(message.id);clearTimeout(item.timer);item.resolve(message);}catch(error){fail(error);}});
 child.on('error',fail);child.on('exit',code=>fail(Error(`MCP exited ${code}: ${stderr}`)));
 const request=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(`MCP timeout for ${method}: ${stderr}`));},20000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const raw=(name,args)=>request('tools/call',{name,arguments:args});
 return {request,raw,async call(name,args){const response=await raw(name,args);assert.equal(response.error,undefined);assert.notEqual(response.result.isError,true,JSON.stringify(response.result));const value=response.result.structuredContent.value;assert.deepEqual(JSON.parse(response.result.content[0].text),value);return value;},async close(){if(child.exitCode!==null||child.signalCode!==null){lines.close();return;}const exited=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);await exited;clearTimeout(timer);lines.close();},notify(){child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');}};
}
test('real MCP artifact catalog discovers bounded registered fields independently of event pages',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-artifact-catalog-')),mcp=server();
 try{
  await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();const tools=(await mcp.request('tools/list',{})).result.tools;assert.equal(tools.length,29);assert.equal(tools.find(tool=>tool.name==='studio_job_artifacts').annotations.readOnlyHint,true);
  const p=project();p.study={kind:'thermal',transient:true,timeStep:1,steps:4,initialTemperature:20};p.materialProperties={conductivity:1,density:1000,specificHeat:1000};p.conditions=[{...p.conditions[0],type:'temperature',value:100}];
  const path=join(dir,'input.json'),outputPath=join(dir,'thermal.json'),original=JSON.stringify(p);await writeFile(path,original);
  const job=await mcp.call('studio_start_analysis',{path,outputPath,requestId:'catalog',includeFields:true});
  const wait=async jobId=>{const deadline=Date.now()+20000;for(;;){const status=await mcp.call('studio_job_status',{jobId});if(status.executionSettled){assert.equal(status.state,'succeeded',JSON.stringify(status.error));assert.equal(status.releaseAllowed,true);return status;}assert.ok(Date.now()<deadline);await new Promise(resolve=>setTimeout(resolve,5));}};await wait(job.jobId);
  const all=[];let offset=0,total;do{const page=await mcp.call('studio_job_artifacts',{jobId:job.jobId,offset,limit:1});assert.equal(page.schemaVersion,1);assert.equal(page.inputRevision,job.inputRevision);assert.equal(page.jobState,'succeeded');assert.equal(page.provisional,true);assert.ok(page.artifacts.length<=1);total=page.total;all.push(...page.artifacts);offset=page.nextOffset;}while(offset!==null);assert.equal(all.length,total);assert.ok(all.length>=5);assert.equal(new Set(all.map(a=>a.artifactId)).size,all.length);assert.ok(all.every(a=>a.provisional&&Number.isInteger(a.bytes)&&/^[a-f0-9]{64}$/.test(a.sha256)));
  const field=all.find(a=>a.kind==='thermal');assert.ok(field);const sample=await mcp.call('studio_job_artifact',{jobId:job.jobId,artifactId:field.artifactId,point:[5,5,20],limit:2});assert.equal(sample.field.unit,'degC');assert.ok(Number.isFinite(sample.measurement.value));assert.equal(sample.page.count,2);assert.equal(sample.inputRevision,job.inputRevision);
  const end=await mcp.call('studio_job_artifacts',{jobId:job.jobId,offset:total});assert.deepEqual(end.artifacts,[]);assert.equal(end.nextOffset,null);for(const args of [{offset:-1},{offset:total+1},{offset:.5},{limit:0},{limit:101},{limit:1.5},{extra:true}])assert.equal((await mcp.raw('studio_job_artifacts',{jobId:job.jobId,...args})).result.isError,true);
  // Catalog metadata survives missing/damaged files; contents are verified only on retrieval.
  await writeFile(field.path,'tampered');const after=await mcp.call('studio_job_artifacts',{jobId:job.jobId});assert.deepEqual(after.artifacts,all);const corrupt=await mcp.raw('studio_job_artifact',{jobId:job.jobId,artifactId:field.artifactId});assert.equal(corrupt.result.isError,true);assert.equal(corrupt.result.structuredContent.error.code,'INTERMEDIATE_INTEGRITY_FAILED');
  assert.equal((await mcp.raw('studio_job_artifacts',{jobId:'unknown'})).result.isError,true);await mcp.call('studio_release_job',{jobId:job.jobId});assert.equal((await mcp.raw('studio_job_artifacts',{jobId:job.jobId})).result.isError,true);assert.equal(await readFile(path,'utf8'),original);
  const empty=await mcp.call('studio_start_analysis',{path,outputPath:join(dir,'mesh.json'),requestId:'no-fields',operation:'mesh'});await wait(empty.jobId);const emptyCatalog=await mcp.call('studio_job_artifacts',{jobId:empty.jobId});assert.equal(emptyCatalog.total,0);assert.deepEqual(emptyCatalog.artifacts,[]);assert.equal(emptyCatalog.nextOffset,null);await mcp.call('studio_release_job',{jobId:empty.jobId});
 }finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
