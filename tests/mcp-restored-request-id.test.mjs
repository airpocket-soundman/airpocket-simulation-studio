import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,readdir,rm,mkdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BoxGeometry} from 'three';
import {createHeadlessJobService} from '../scripts/analysis-job-service.mjs';
function project(){
 const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
 const face=z=>Array.from({length:12},(_,i)=>i).filter(i=>[2,5,8].every(k=>positions[9*i+k]===z));
 const condition=(type,value,z)=>({type,value,direction:[0,0,1],regions:[{mesh:0,triangles:face(z)}]});
 return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:0},conditions:[condition('fixed',0,0),condition('force',100,40)]};
}

function server(store){
 const entry=process.env.AIRPOCKET_TEST_MCP_ENTRY??new URL('../scripts/studio-mcp.mjs',import.meta.url);
 const child=spawn(process.execPath,[entry instanceof URL?fileURLToPath(entry):entry,'--job-store='+store],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let sequence=0,stderr='';
 child.stderr.on('data',data=>stderr+=data);const failed=error=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();};
 lines.on('line',line=>{try{const reply=JSON.parse(line),p=pending.get(reply.id);if(!p)return;pending.delete(reply.id);clearTimeout(p.timer);p.resolve(reply);}catch(error){failed(error);}});child.on('error',failed);child.on('exit',code=>failed(Error('MCP exited '+code+': '+stderr)));
 const request=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP request timeout: '+stderr));},20000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const raw=(name,args)=>request('tools/call',{name,arguments:args});
 return {raw,async init(){await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'restart-test',version:'1'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');},async call(name,args){const reply=await raw(name,args);assert.equal(reply.error,undefined);assert.notEqual(reply.result.isError,true,JSON.stringify(reply.result));return reply.result.structuredContent.value;},async close(){
  let forceTimer,deadlineTimer,onExit;
  try{
   if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;
   const exited=new Promise((resolve,reject)=>{onExit=resolve;child.once('exit',onExit);forceTimer=setTimeout(()=>{try{child.kill('SIGKILL');}catch(error){reject(error);}},2000);deadlineTimer=setTimeout(()=>reject(Error('MCP process did not exit after forced termination')),5000);});
   child.stdin.end();await exited;
  }finally{
   clearTimeout(forceTimer);clearTimeout(deadlineTimer);if(onExit)child.removeListener('exit',onExit);failed(Error('MCP test server closed'));lines.close();child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();if(child.exitCode===null&&child.signalCode===null)child.unref();
  }
 }};
}
async function settled(mcp,job){const deadline=Date.now()+20000;for(;;){const status=await mcp.call('studio_job_status',{jobId:job.jobId});if(status.executionSettled){assert.equal(status.state,'succeeded',JSON.stringify(status.error));return status;}assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,10));}}

test('restored request IDs reject before input reads for every state; invalid arguments retain validation priority',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'restart-request-')),store=join(dir,'store');await mkdir(store);
 try{for(const [i,state] of ['running','saving','succeeded','failed','cancelled','timed_out','interrupted'].entries())await writeFile(join(store,'job-'+i+'.json'),JSON.stringify({schemaVersion:1,kind:'analysis-job-record',jobId:'job-'+i,inputRevision:'old',operation:'mesh',origin:'api',state,requestId:'old-'+i,startedAt:1,updatedAt:2,executionSettled:false}));
  const service=createHeadlessJobService({jobStore:store});try{for(let i=0;i<7;i++)await assert.rejects(service.start({path:join(dir,'missing.json'),outputPath:join(dir,'absent-'+i+'.json'),requestId:'old-'+i,operation:'mesh'}),error=>error.code==='ANALYSIS_JOB_REQUEST_RESTORED'&&error.message.includes('job-'+i));
   await assert.rejects(service.start({path:'relative',outputPath:join(dir,'absent.json'),requestId:'old-0'}),/absolute/);await assert.rejects(service.start({path:join(dir,'missing.json'),outputPath:join(dir,'absent.json'),requestId:'old-0',size:-1}),/Invalid analysis job arguments/);assert.deepEqual((await readdir(dir)).sort(),['store']);
  }finally{await service.closeAsync();}
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('real stdio MCP restart refuses same or changed replay, permits explicit new request and re-use only after release',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mcp-restart-request-')),store=join(dir,'store'),path=join(dir,'input.json'),outputPath=join(dir,'first.json'),request={path,outputPath,requestId:'retained',operation:'mesh',size:10};let mcp;
 try{await writeFile(path,JSON.stringify(project()));mcp=server(store);await mcp.init();const first=await mcp.call('studio_start_analysis',request);await settled(mcp,first);const original=await readFile(outputPath);await mcp.close();mcp=server(store);await mcp.init();
  const discovered=await mcp.call('studio_restored_jobs',{limit:1});assert.equal(discovered.total,1);assert.equal(discovered.nextOffset,null);assert.equal(discovered.jobs[0].jobId,first.jobId);
  const restored=await mcp.call('studio_job_status',{jobId:discovered.jobs[0].jobId});assert.deepEqual(discovered.jobs[0],restored);assert.equal(restored.restored,true);assert.equal(restored.resultAvailable,false);
  assert.deepEqual(restored.recovery,{mode:'metadata-only',executionResumed:false,eventsAvailable:false,artifactsAvailable:false,nextSteps:[{tool:'studio_start_analysis',requiresNewRequestId:true,requiresExplicitPaths:true},{tool:'studio_release_job',arguments:{jobId:first.jobId},requestIdReusableAfterRelease:true}]});
  assert.deepEqual((await mcp.call('studio_job_events',{jobId:first.jobId})).recovery,restored.recovery);
  const artifacts=await mcp.call('studio_job_artifacts',{jobId:first.jobId});assert.equal(artifacts.total,0);assert.deepEqual(artifacts.recovery,restored.recovery);
  const unavailable=await mcp.raw('studio_job_artifact',{jobId:first.jobId,artifactId:'0001'});assert.equal(unavailable.result.isError,true);assert.equal(unavailable.result.structuredContent.error.code,'ANALYSIS_JOB_ARTIFACT_NOT_RESTORED');assert.match(unavailable.result.structuredContent.error.message,/new requestId/);
  assert.deepEqual((await mcp.call('studio_cancel_job',{jobId:first.jobId})).recovery,restored.recovery);
  const nextOutput=join(dir,'next.json');const denials=[{},{outputPath:nextOutput,size:5},{path:join(dir,'missing.json'),outputPath:nextOutput}];for(const [index,patch] of denials.entries()){const denied=await mcp.raw('studio_start_analysis',{...request,...patch});assert.equal(denied.result.isError,true);assert.equal(denied.result.structuredContent.error.code,index===0?'ANALYSIS_JOB_REQUEST_RESTORED':'ANALYSIS_JOB_REQUEST_CONFLICT');assert.ok(denied.result.structuredContent.error.message.includes(first.jobId));}
  assert.deepEqual(await readFile(outputPath),original);await assert.rejects(stat(nextOutput),{code:'ENOENT'});assert.deepEqual(await readdir(store),[first.jobId+'.json']);
  const explicit=await mcp.call('studio_start_analysis',{...request,requestId:'explicit-new',outputPath:nextOutput});assert.notEqual(explicit.jobId,first.jobId);assert.equal((await mcp.call('studio_start_analysis',{...request,requestId:'explicit-new',outputPath:nextOutput})).jobId,explicit.jobId);await settled(mcp,explicit);
  const release=restored.recovery.nextSteps.find(step=>step.tool==='studio_release_job');await mcp.call(release.tool,release.arguments);const reused=await mcp.call('studio_start_analysis',{...request,outputPath:join(dir,'reused.json')});assert.notEqual(reused.jobId,first.jobId);await settled(mcp,reused);
  assert.deepEqual(await mcp.call('studio_restored_jobs',{}),{schemaVersion:1,jobs:[],total:0,nextOffset:null});assert.equal((await mcp.raw('studio_restored_jobs',{limit:21})).result.isError,true);assert.equal((await mcp.raw('studio_job_status',{jobId:first.jobId})).result.isError,true);assert.deepEqual(await readFile(outputPath),original);
 }finally{await mcp?.close();await rm(dir,{recursive:true,force:true});}
});
