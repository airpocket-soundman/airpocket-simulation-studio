import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {BoxGeometry} from 'three';
import {createHeadlessJobService} from '../scripts/analysis-job-service.mjs';

function project(kind='structural'){
 const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
 const face=z=>Array.from({length:12},(_,i)=>i).filter(i=>[2,5,8].every(k=>positions[9*i+k]===z));
 const condition=(type,value,z)=>({type,value,direction:[0,0,1],regions:[{mesh:0,triangles:face(z)}]});
 return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind,gravityEnabled:false,...(kind==='thermal'?{transient:true,timeStep:1,steps:4,initialTemperature:20}:{})},materialProperties:kind==='thermal'?{conductivity:1,density:1000,specificHeat:1000}:{youngModulus:1e9,poissonRatio:0},conditions:kind==='thermal'?[condition('temperature',100,0)]:[condition('fixed',0,0),condition('force',100,40)]};
}
async function terminal(service,id){const deadline=Date.now()+20_000;while(Date.now()<deadline){const value=service.get(id);if(['succeeded','failed','cancelled','timed_out'].includes(value.state))return value;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('Job did not finish');}

test('real CPU job exposes mesh and numerical events, freezes input and publishes only complete output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-job-')),service=createHeadlessJobService();
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'result.json'),p=project();await writeFile(path,JSON.stringify(p));
  const args={path,outputPath,requestId:'bar-1',includeFields:true},a=await service.start(args);
  assert.equal(a.state,'running');assert.equal((await service.start(args)).jobId,a.jobId);
  p.materialProperties.youngModulus=2e9;await writeFile(path,JSON.stringify(p));
  await assert.rejects(service.start(args),/different input/);
  const done=await terminal(service,a.jobId);assert.equal(done.state,'succeeded',JSON.stringify(done.error));assert.ok(Math.abs(done.result.maxDisplacementMm-.04)<1e-8);
  const saved=JSON.parse(await readFile(outputPath,'utf8'));assert.equal(saved.input.materialProperties.youngModulus,1e9);assert.equal(saved.job.inputRevision,a.inputRevision);assert.equal(saved.job.provisional,false);
  const page=service.events(a.jobId,{limit:100});const mesh=page.events.find(e=>e.stage==='mesh'),iteration=page.events.find(e=>e.stage==='iteration');assert.ok(mesh);assert.ok(iteration);assert.ok(iteration.residual>=0);assert.equal(iteration.provisional,true);assert.equal(iteration.inputRevision,a.inputRevision);
  const bytes=await readFile(mesh.artifact.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),mesh.artifact.sha256);assert.equal(JSON.parse(bytes).provisional,true);
  const refused=await service.start({...args,requestId:'bar-2',includeFields:false});assert.equal((await terminal(service,refused.jobId)).state,'failed');assert.equal(await readFile(outputPath,'utf8'),JSON.stringify(saved)+'\n');
 }finally{service.close();await rm(dir,{recursive:true,force:true});}
});

test('real transient fields reference the correct mesh and agree with saved final temperature/history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-time-job-')),service=createHeadlessJobService();
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'thermal.json');await writeFile(path,JSON.stringify(project('thermal')));
  const job=await service.start({path,outputPath,requestId:'heat-1',includeFields:true});const done=await terminal(service,job.jobId);assert.equal(done.state,'succeeded',JSON.stringify(done.error));
  const fields=service.events(job.jobId,{limit:100}).events.filter(e=>e.stage==='time-step');assert.equal(fields.length,4);
  const saved=JSON.parse(await readFile(outputPath,'utf8'));
  for(const event of fields){const snapshot=JSON.parse(await readFile(event.artifact.path,'utf8'));assert.equal(snapshot.jobId,job.jobId);assert.equal(snapshot.inputRevision,job.inputRevision);assert.equal(snapshot.time,event.step);assert.equal(snapshot.field.units.temperature,'degC');assert.ok(snapshot.meshArtifact.path);const mesh=JSON.parse(await readFile(snapshot.meshArtifact.path,'utf8'));assert.equal(snapshot.field.temperature.length,mesh.mesh.nodes.length/3);assert.equal(event.metrics.maxTemperature,saved.result.history[event.step-1].maxTemperature);}
  const last=JSON.parse(await readFile(fields.at(-1).artifact.path,'utf8'));assert.deepEqual(last.field.temperature,saved.result.temperature);assert.equal(last.provisional,true);
 }finally{service.close();await rm(dir,{recursive:true,force:true});}
});

test('job cancellation, timeout, artifact limits and invalid options preserve input and existing files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-cancel-job-')),service=createHeadlessJobService({maxArtifactBytes:1}),fast=createHeadlessJobService({timeoutMs:1});
 try{
  const path=join(dir,'input.json');await writeFile(path,JSON.stringify(project()));const original=await readFile(path,'utf8');
  const outputPath=join(dir,'cancelled.json'),job=await service.start({path,outputPath,requestId:'cancel'});assert.equal(service.cancel(job.jobId).cancelled,true);assert.equal((await terminal(service,job.jobId)).state,'cancelled');await assert.rejects(stat(outputPath),{code:'ENOENT'});
  const timed=await fast.start({path,outputPath:join(dir,'timeout.json'),requestId:'timeout'});assert.equal((await terminal(fast,timed.jobId)).state,'timed_out');await assert.rejects(stat(join(dir,'timeout.json')),{code:'ENOENT'});
  const limited=await service.start({path,outputPath:join(dir,'limited.json'),requestId:'limited',includeFields:true});const done=await terminal(service,limited.jobId);assert.equal(done.state,'succeeded');assert.equal(done.result.intermediateStorageLimited,true);assert.ok(service.events(limited.jobId,{limit:100}).events.some(e=>e.stage==='observation-limit'));
  await assert.rejects(service.start({path,outputPath,requestId:'bad',includeFields:'yes'}),/arguments/);assert.equal(await readFile(path,'utf8'),original);
 }finally{service.close();fast.close();await rm(dir,{recursive:true,force:true});}
});
