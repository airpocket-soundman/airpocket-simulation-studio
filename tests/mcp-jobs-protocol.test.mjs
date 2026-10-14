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
test('real MCP process supports incremental job polling, retry identities, cancellation and release',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-mcp-jobs-')),mcp=server();
 try{
  const path=join(dir,'project.json'),outputPath=join(dir,'result.json');await writeFile(path,JSON.stringify(project()));
  const initialized=await mcp.request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'job-protocol-test',version:'1'}});assert.equal(initialized.result.protocolVersion,'2025-11-25');mcp.notify();
  const args={path,outputPath,requestId:'solve-retry',includeFields:true},started=await mcp.call('studio_start_analysis',args);assert.equal(started.state,'running');
  assert.equal((await mcp.call('studio_start_analysis',args)).jobId,started.jobId);
  const changed=await mcp.raw('studio_start_analysis',{...args,size:4});assert.equal(changed.result.isError,true);assert.match(changed.result.content[0].text,/different input/);
  const premature=await mcp.raw('studio_release_job',{jobId:started.jobId});assert.equal(premature.result.isError,true);
  let cursor=0,state=started.state;const events=[],deadline=Date.now()+20000;
  while(Date.now()<deadline){
   const page=await mcp.call('studio_job_events',{jobId:started.jobId,afterSequence:cursor,limit:2});
   for(const event of page.events){assert.ok(event.sequence>cursor);assert.equal(event.jobId,started.jobId);assert.equal(event.inputRevision,started.inputRevision);cursor=event.sequence;events.push(event);}
   assert.equal(page.nextSequence,cursor);state=page.state;
   if(['succeeded','failed','cancelled','timed_out'].includes(state)&&!page.hasMore)break;
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(state,'succeeded');assert.ok(events.some(e=>e.stage==='mesh'&&e.provisional));assert.ok(events.some(e=>e.stage==='iteration'&&e.provisional));assert.equal(events.at(-1).state,'succeeded');
  const status=await mcp.call('studio_job_status',{jobId:started.jobId}),saved=JSON.parse(await readFile(outputPath,'utf8'));assert.equal(saved.job.jobId,started.jobId);assert.equal(saved.job.inputRevision,started.inputRevision);assert.equal(saved.job.provisional,false);assert.ok(Math.abs(status.result.maxDisplacementMm-.04)<1e-8);assert.equal(status.result.maxDisplacementMm,saved.result.maxDisplacementMm);
  const empty=await mcp.call('studio_job_events',{jobId:started.jobId,afterSequence:cursor});assert.deepEqual(empty.events,[]);assert.equal(empty.nextSequence,cursor);
  assert.equal((await mcp.call('studio_start_analysis',args)).jobId,started.jobId);assert.equal((await mcp.call('studio_cancel_job',{jobId:started.jobId})).cancelled,false);
  assert.equal((await mcp.call('studio_release_job',{jobId:started.jobId})).released,true);assert.equal((await mcp.raw('studio_job_status',{jobId:started.jobId})).result.isError,true);assert.ok(await stat(outputPath));
  const cancelledPath=join(dir,'cancelled.json'),cancelled=await mcp.call('studio_start_analysis',{path,outputPath:cancelledPath,requestId:'cancel-job',size:.1});
  assert.equal((await mcp.call('studio_cancel_job',{jobId:cancelled.jobId})).cancelled,true);assert.equal((await mcp.call('studio_job_status',{jobId:cancelled.jobId})).state,'cancelled');assert.equal((await mcp.call('studio_cancel_job',{jobId:cancelled.jobId})).cancelled,false);
  await mcp.call('studio_release_job',{jobId:cancelled.jobId});await assert.rejects(stat(cancelledPath),{code:'ENOENT'});
  const replacement=await mcp.call('studio_start_analysis',{path,outputPath:join(dir,'replacement.json'),requestId:'solve-retry',size:.1});assert.notEqual(replacement.jobId,started.jobId);await mcp.call('studio_cancel_job',{jobId:replacement.jobId});await mcp.call('studio_release_job',{jobId:replacement.jobId});
 }finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
