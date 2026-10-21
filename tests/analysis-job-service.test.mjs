import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {BoxGeometry} from 'three';
import {createHeadlessJobService,startupConditionDigest} from '../scripts/analysis-job-service.mjs';

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
  for(const event of fields){const retrieved=await service.artifact(job.jobId,event.artifact.artifactId,{point:[5,5,20],limit:2});assert.equal(retrieved.field.unit,'degC');assert.equal(retrieved.page.count,2);assert.ok(Number.isFinite(retrieved.measurement.value));const snapshot=JSON.parse(await readFile(event.artifact.path,'utf8'));assert.equal(snapshot.jobId,job.jobId);assert.equal(snapshot.inputRevision,job.inputRevision);assert.equal(snapshot.time,event.step);assert.equal(snapshot.field.units.temperature,'degC');assert.ok(snapshot.meshArtifact.path);const mesh=JSON.parse(await readFile(snapshot.meshArtifact.path,'utf8'));assert.equal(snapshot.field.temperature.length,mesh.mesh.nodes.length/3);assert.equal(event.metrics.maxTemperature,saved.result.history[event.step-1].maxTemperature);}
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

// Synthetic fixture: the digest identifies recorded startup conditions, never file contents.
test('restart startup-condition digest separates identical from changed conditions before any input read or worker start',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-digest-')),store=join(dir,'store');let workerStarts=0;
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'result.json'),request={path,outputPath,requestId:'recovery-01',operation:'mesh',size:5,method:'wasm-pcg'};
  await writeFile(path,JSON.stringify(project()));
  const first=createHeadlessJobService({jobStore:store}),job=await first.start(request);
  const done=await terminal(first,job.jobId);assert.equal(done.state,'succeeded',JSON.stringify(done.error));await first.closeAsync();
  const raw=await readFile(join(store,job.jobId+'.json'),'utf8'),persisted=JSON.parse(raw);
  assert.equal(persisted.requestId,'recovery-01');assert.ok(persisted.resultDigest);
  assert.match(persisted.startupDigest,/^[0-9a-f]{64}$/);
  assert.equal(persisted.startupDigest,startupConditionDigest(request));
  assert.ok(Buffer.byteLength(raw)<=8192);
  assert.ok(!raw.includes(path)&&!raw.includes(outputPath),'the digest never stores the raw paths');
  // A restart service that would report any worker start, and an input file that no longer exists:
  // the refusal must precede both the read and the execution. The path string is unchanged, so the
  // digest is identical while the underlying file is deliberately gone.
  const restart=createHeadlessJobService({jobStore:store,isolation:'process',createProcessWorker:()=>{workerStarts+=1;throw Error('worker must not start for a refused replay');}});
  await rm(path);await assert.rejects(stat(path),{code:'ENOENT'});
  await assert.rejects(restart.start(request),error=>error.code==='ANALYSIS_JOB_REQUEST_RESTORED'&&error.message.includes(job.jobId));
  const restored=restart.get(job.jobId);assert.equal(restored.restored,true);assert.equal(restored.resultAvailable,false);assert.equal(restored.result,undefined);
  assert.equal(workerStarts,0);
  // One changed field at a time is an explicit conflict, also before any read or worker start.
  for(const change of [{method:'pcg'},{outputPath:join(dir,'other.json')},{includeFields:true}]){
   await assert.rejects(restart.start({...request,...change}),error=>error.code==='ANALYSIS_JOB_REQUEST_CONFLICT'&&error.message.includes(job.jobId));
  }
  assert.equal(workerStarts,0);
  assert.deepEqual((await readdir(dir)).sort(),['result.json','store']);
  await restart.closeAsync();
 }finally{await rm(dir,{recursive:true,force:true});}
});

// Regression: two concurrent starts share one request ID while the second one is still
// before its async input read. Neither the accepted job's persisted digest nor its jobId may
// be taken over by the competing startup conditions, in either dispatch order.
test('concurrent starts never persist the competing startup digest for the accepted job',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-race-digest-'));
 try{
  const validPath=join(dir,'valid.json'),missingPath=join(dir,'missing.json'),missingOutput=join(dir,'result-b.json');
  await writeFile(validPath,JSON.stringify(project()));
  const a={path:validPath,outputPath:join(dir,'result-a.json'),requestId:'race-01',operation:'mesh',size:5,method:'wasm-pcg'};
  const b={path:missingPath,outputPath:missingOutput,requestId:'race-01',operation:'mesh',size:5,method:'wasm-pcg'};
  const digestA=startupConditionDigest(a),digestB=startupConditionDigest(b);
  assert.notEqual(digestA,digestB);
  for(const [order,tag] of [[['A','B'],'a-first'],[['B','A'],'b-first']]){
   const store=join(dir,'store-'+tag);let workerStarts=0;
   const service=createHeadlessJobService({jobStore:store,isolation:'process',createProcessWorker:()=>{workerStarts+=1;throw Error('synthetic worker startup failure');}});
   try{
    const results=await Promise.allSettled(order.map(name=>service.start(name==='A'?a:b)));
    const byName=Object.fromEntries(order.map((name,index)=>[name,results[index]]));
    assert.equal(byName.A.status,'fulfilled',JSON.stringify(byName.A.reason));
    assert.equal(byName.B.status,'rejected');
    const accepted=byName.A.value;
    const done=await terminal(service,accepted.jobId);assert.equal(done.state,'failed');
    assert.equal(workerStarts,1);
    const names=await readdir(store),raw=await readFile(join(store,accepted.jobId+'.json'),'utf8'),persisted=JSON.parse(raw);
    assert.equal(persisted.requestId,'race-01');
    assert.equal(persisted.startupDigest,digestA);
    assert.ok(Buffer.byteLength(raw)<=8192);
    assert.deepEqual(names,[accepted.jobId+'.json']);
    const records=await Promise.all(names.map(name=>readFile(join(store,name),'utf8').then(JSON.parse)));
    assert.equal(records.filter(record=>record.startupDigest===digestB).length,0);
    assert.equal(records.filter(record=>record.startupDigest===digestA).length,1);
    const restart=createHeadlessJobService({jobStore:store,isolation:'process',createProcessWorker:()=>{workerStarts+=1;throw Error('worker must not start for a refused replay');}});
    try{
     await assert.rejects(restart.start(a),error=>error.code==='ANALYSIS_JOB_REQUEST_RESTORED'&&error.message.includes(accepted.jobId));
     await assert.rejects(restart.start(b),error=>error.code==='ANALYSIS_JOB_REQUEST_CONFLICT'&&error.message.includes(accepted.jobId));
     const restored=restart.get(accepted.jobId);assert.equal(restored.restored,true);assert.equal(restored.resultAvailable,false);
     assert.equal(workerStarts,1);
    }finally{await restart.closeAsync();}
   }finally{await service.closeAsync();}
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('same-condition concurrent retries share one job while changed conditions are refused before any read',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-concurrent-retry-')),store=join(dir,'store');let workerStarts=0;
 const service=createHeadlessJobService({jobStore:store,isolation:'process',createProcessWorker:()=>{workerStarts+=1;throw Error('synthetic worker startup failure');}});
 try{
  const path=join(dir,'input.json');await writeFile(path,JSON.stringify(project()));
  const args={path,outputPath:join(dir,'result.json'),requestId:'retry-01',operation:'mesh',size:5};
  const [first,second]=await Promise.all([service.start(args),service.start({...args})]);
  assert.equal(first.jobId,second.jobId);
  assert.equal((await terminal(service,first.jobId)).state,'failed');
  assert.equal(workerStarts,1);
  const digest=startupConditionDigest(args),persisted=JSON.parse(await readFile(join(store,first.jobId+'.json'),'utf8'));
  assert.equal(persisted.startupDigest,digest);
  // A changed condition on the same request ID is an explicit refusal, not an accepted replay.
  const changed={...args,size:6},foreignDigest=startupConditionDigest(changed);
  await assert.rejects(service.start(changed),error=>error.code==='ANALYSIS_JOB_REQUEST_CONFLICT');
  assert.equal((await readdir(store)).length,1);
  assert.notEqual(foreignDigest,digest);
  assert.equal(service.release(first.jobId).released,true);
  assert.deepEqual(await readdir(store),[]);
  const again=await service.start(args);assert.notEqual(again.jobId,first.jobId);
  assert.equal((await terminal(service,again.jobId)).state,'failed');
  assert.equal(workerStarts,2);
 }finally{await service.closeAsync();await rm(dir,{recursive:true,force:true});}
});

test('starts that fail before owning a job release their reservation; 32 failures do not block the same request ID',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-failed-starts-')),store=join(dir,'store'),missingPath=join(dir,'missing.json');let workerStarts=0;
 const service=createHeadlessJobService({jobStore:store,isolation:'process',createProcessWorker:()=>{workerStarts+=1;throw Error('synthetic worker startup failure');}});
 try{
  for(let i=0;i<32;i++)await assert.rejects(service.start({path:missingPath,outputPath:join(dir,'absent-'+i+'.json'),requestId:'fail-'+i,operation:'mesh'}),{code:'ENOENT'});
  assert.equal(workerStarts,0);assert.deepEqual(await readdir(store),[]);
  const path=join(dir,'input.json');await writeFile(path,JSON.stringify(project()));
  const args={path,outputPath:join(dir,'result.json'),requestId:'fail-31',operation:'mesh',size:5};
  const job=await service.start(args);assert.equal((await terminal(service,job.jobId)).state,'failed');
  assert.equal(workerStarts,1);assert.equal(JSON.parse(await readFile(join(store,job.jobId+'.json'),'utf8')).startupDigest,startupConditionDigest(args));
  assert.equal(service.release(job.jobId).released,true);
  const reused=await service.start({...args,outputPath:join(dir,'result-2.json')});assert.notEqual(reused.jobId,job.jobId);
  await terminal(service,reused.jobId);assert.equal(workerStarts,2);
 }finally{await service.closeAsync();await rm(dir,{recursive:true,force:true});}
});

test('a legacy record without a startup digest stays restored-only and never starts a worker',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-legacy-digest-')),store=join(dir,'store'),path=join(dir,'input.json');let workerStarts=0;
 try{
  await mkdir(store,{recursive:true});await writeFile(path,JSON.stringify(project()));
  await writeFile(join(store,'legacy-01.json'),JSON.stringify({schemaVersion:1,kind:'analysis-job-record',jobId:'legacy-01',inputRevision:'old',operation:'mesh',origin:'api',state:'succeeded',requestId:'legacy-01',startedAt:1,updatedAt:2,executionSettled:true}));
  const service=createHeadlessJobService({jobStore:store,isolation:'process',createProcessWorker:()=>{workerStarts+=1;throw Error('worker must not start for a legacy replay');}});
  try{
   await assert.rejects(service.start({path,outputPath:join(dir,'result.json'),requestId:'legacy-01',operation:'mesh',size:5}),error=>error.code==='ANALYSIS_JOB_REQUEST_RESTORED'&&error.message.includes('legacy-01'));
   const restored=service.get('legacy-01');assert.equal(restored.restored,true);assert.equal(restored.resultAvailable,false);assert.equal(restored.result,undefined);
   assert.equal(workerStarts,0);
  }finally{await service.closeAsync();}
 }finally{await rm(dir,{recursive:true,force:true});}
});
