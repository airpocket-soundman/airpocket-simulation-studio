import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {BoxGeometry} from 'three';
import {createHeadlessJobService} from '../scripts/analysis-job-service.mjs';
import {createJobStore,jobStoreLimits,validateJobStoreDirectory,INTERRUPTED_CODE} from '../scripts/analysis-job-store.mjs';

function project(){
 const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
 const face=z=>Array.from({length:12},(_,i)=>i).filter(i=>[2,5,8].every(k=>positions[9*i+k]===z));
 const condition=(type,value,z)=>({type,value,direction:[0,0,1],regions:[{mesh:0,triangles:face(z)}]});
 return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:0},conditions:[condition('fixed',0,0),condition('force',100,40)]};
}
async function settle(service,id){const deadline=Date.now()+20_000;while(Date.now()<deadline){const v=service.get(id);if(['succeeded','failed','cancelled','timed_out'].includes(v.state)&&v.executionSettled)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Job did not finish');}
const temp=()=>mkdtemp(join(tmpdir(),'studio-store-'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const record=(n,over={})=>({schemaVersion:1,kind:'analysis-job-record',jobId:id(n),inputRevision:'rev-'+n,operation:'elastic',origin:'api',state:'running',requestId:'req-'+n,startedAt:1000,updatedAt:2000,executionSettled:false,...over});
const quiet=()=>{const original=process.stderr.write.bind(process.stderr);process.stderr.write=()=>true;return()=>{process.stderr.write=original;};};

test('record round trip: atomic metadata-only record, restored as metadata after restart',async()=>{
 const dir=await temp(),store=join(dir,'store');
 try{
  const path=join(dir,'in.json'),outputPath=join(dir,'out.json');await writeFile(path,JSON.stringify(project()));
  const first=createHeadlessJobService({jobStore:store});
  const started=await first.start({path,outputPath,requestId:'rt-1'});
  const done=await settle(first,started.jobId);assert.equal(done.state,'succeeded');
  const files=await readdir(store);assert.deepEqual(files,[started.jobId+'.json'],'only the record, no temp files');
  const raw=await readFile(join(store,files[0]),'utf8'),rec=JSON.parse(raw);
  assert.ok(Buffer.byteLength(raw)<=jobStoreLimits.maxRecordBytes);
  assert.equal(rec.state,'succeeded');assert.equal(rec.requestId,'rt-1');assert.equal(rec.inputRevision,started.inputRevision);
  assert.match(rec.resultDigest.outputSha256,/^[0-9a-f]{64}$/);assert.ok(rec.resultDigest.outputBytes>0);
  assert.ok(!('result' in rec)&&!raw.includes('positions')&&!raw.includes(outputPath)&&!raw.includes(path),'no result body, project data or paths');
  await first.closeAsync();
  const second=createHeadlessJobService({jobStore:store}),view=second.get(started.jobId);
  assert.equal(view.state,'succeeded');assert.equal(view.restored,true);assert.equal(view.resultAvailable,false);assert.equal(view.result,undefined);
  assert.equal(view.executionSettled,true);assert.equal(view.releaseAllowed,true);assert.deepEqual(view.recordedResultDigest,rec.resultDigest);
  assert.equal(second.events(started.jobId).events.length,0);assert.equal(second.listArtifacts(started.jobId).total,0);
  await assert.rejects(second.artifact(started.jobId,'0001'),/not restored/);await assert.rejects(second.meshOutput(started.jobId),/retained mesh-only job/);
  assert.equal(second.cancel(started.jobId).cancelled,false);
  assert.deepEqual(second.release(started.jobId),{jobId:started.jobId,released:true});
  assert.deepEqual(await readdir(store),[]);assert.throws(()=>second.get(started.jobId),/Unknown job/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a job running when the process died is reported interrupted and never resumed',async()=>{
 const dir=await temp(),store=join(dir,'store');await mkdir(store);
 try{
  await writeFile(join(store,id(1)+'.json'),JSON.stringify(record(1)));
  await writeFile(join(store,id(2)+'.json'),JSON.stringify(record(2,{state:'saving'})));
  await writeFile(join(store,id(3)+'.json'),JSON.stringify(record(3,{state:'failed',executionSettled:true,error:{code:'JOB_FAILED',message:'boom'}})));
  const service=createHeadlessJobService({jobStore:store});
  for(const n of [1,2]){
   const v=service.get(id(n));
   assert.equal(v.state,'interrupted');assert.equal(v.error.code,INTERRUPTED_CODE);assert.equal(v.executionSettled,true);assert.equal(v.releaseAllowed,true);assert.equal(v.resourceState,'settled');assert.equal(v.restored,true);assert.equal(v.resultAvailable,false);
   assert.equal(service.cancel(id(n)).state,'interrupted');
  }
  assert.equal(service.get(id(1)).recordedState,'running');
  const failed=service.get(id(3));assert.equal(failed.state,'failed');assert.equal(failed.error.code,'JOB_FAILED');
  assert.equal(JSON.parse(await readFile(join(store,id(1)+'.json'),'utf8')).state,'interrupted','classification persisted');
  const third=createHeadlessJobService({jobStore:store});assert.equal(third.get(id(1)).state,'interrupted');
  assert.deepEqual(await readdir(dir),['store'],'nothing was re-run');
  assert.equal(third.release(id(1)).released,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('corrupt, oversized, mismatched and foreign files are ignored with diagnostics and never crash',async()=>{
 const dir=await temp(),store=join(dir,'store');await mkdir(store);const restore=quiet();
 try{
  await writeFile(join(store,id(1)+'.json'),'{not json');
  await writeFile(join(store,id(2)+'.json'),JSON.stringify(record(2,{state:'hacked'})));
  await writeFile(join(store,id(3)+'.json'),JSON.stringify(record(9)));
  await writeFile(join(store,id(4)+'.json'),JSON.stringify(record(4,{extra:1})));
  await writeFile(join(store,id(5)+'.json'),JSON.stringify(record(5,{error:{code:'X',message:'y'.repeat(jobStoreLimits.maxRecordBytes)}})));
  await writeFile(join(store,'notes.txt'),'hello');
  await writeFile(join(store,'.tmp-stale.json'),'partial');
  await writeFile(join(store,id(6)+'.json'),JSON.stringify(record(6)));
  const service=createHeadlessJobService({jobStore:store}),codes=service.jobStoreDiagnostics().map(d=>d.code);
  assert.equal(codes.filter(c=>c==='ANALYSIS_JOB_STORE_CORRUPT_RECORD').length,5);assert.ok(codes.includes('ANALYSIS_JOB_STORE_FOREIGN_FILE_IGNORED'));
  for(const n of [1,2,3,4,5])assert.throws(()=>service.get(id(n)),/Unknown job/);
  assert.equal(service.get(id(6)).state,'interrupted');
  assert.ok(!(await readdir(store)).includes('.tmp-stale.json'),'stale temp removed');
  const big=join(dir,'big');await mkdir(big);
  for(let n=1;n<=jobStoreLimits.maxRecords+3;n++)await writeFile(join(big,id(n)+'.json'),JSON.stringify(record(n,{state:'succeeded',executionSettled:true})));
  const capped=createHeadlessJobService({jobStore:big});
  assert.equal(capped.jobStoreDiagnostics().filter(d=>d.code==='ANALYSIS_JOB_STORE_RECORD_CAP').length,3);
  let restoredCount=0;for(let n=1;n<=jobStoreLimits.maxRecords+3;n++){try{capped.get(id(n));restoredCount++;}catch{/* ignored record */}}
  assert.equal(restoredCount,jobStoreLimits.maxRecords);
 }finally{restore();await rm(dir,{recursive:true,force:true});}
});

test('a symlinked record is not followed',async t=>{
 const dir=await temp(),store=join(dir,'store');await mkdir(store);const restore=quiet();
 try{
  const secret=join(dir,'secret.json');await writeFile(secret,JSON.stringify(record(1)));
  try{await symlink(secret,join(store,id(1)+'.json'));}catch{t.skip('symlinks unavailable');return;}
  const service=createHeadlessJobService({jobStore:store});
  assert.throws(()=>service.get(id(1)),/Unknown job/);assert.ok(service.jobStoreDiagnostics().some(d=>d.code==='ANALYSIS_JOB_STORE_CORRUPT_RECORD'));
 }finally{restore();await rm(dir,{recursive:true,force:true});}
});

test('directory must be explicit and absolute without traversal; job IDs cannot escape it',async()=>{
 for(const bad of ['relative/dir','.','',undefined,'/',tmpdir()+sep+'a'+sep+'..'+sep+'b'])assert.throws(()=>validateJobStoreDirectory(bad),/--job-store/);
 assert.throws(()=>createHeadlessJobService({jobStore:'relative'}),/absolute/);
 assert.throws(()=>createHeadlessJobService({jobStore:''}),/Invalid job store/);
 const dir=await temp(),restore=quiet();
 try{
  const file=join(dir,'afile');await writeFile(file,'x');assert.throws(()=>createJobStore(file),/real directory/);
  const store=createJobStore(join(dir,'s')),base={inputRevision:'r',operation:'elastic',origin:'api',state:'running',startedAt:1,updatedAt:1,executionSettled:false};
  store.persist({...base,jobId:'../escape'},{});store.persist({...base,jobId:'a'+sep+'b'},{});
  assert.deepEqual((await readdir(dir)).sort(),['afile','s']);assert.deepEqual(await readdir(join(dir,'s')),[]);
  assert.equal(store.diagnostics.filter(d=>d.code==='ANALYSIS_JOB_STORE_WRITE_FAILED').length,2);
  const cli=spawnSync(process.execPath,['scripts/studio-mcp.mjs','--job-store=relative/dir'],{encoding:'utf8',timeout:20000});
  assert.notEqual(cli.status,0);assert.match(cli.stderr,/--job-store requires an explicit absolute directory/);
  const twice=spawnSync(process.execPath,['scripts/studio-mcp.mjs','--job-store='+join(dir,'x'),'--job-store='+join(dir,'y')],{encoding:'utf8',timeout:20000});
  assert.notEqual(twice.status,0);assert.match(twice.stderr,/Use one --job-store/);
 }finally{restore();await rm(dir,{recursive:true,force:true});}
});

test('record size and count caps stop persistence without affecting jobs',async()=>{
 const dir=await temp(),restore=quiet();
 try{
  const store=createJobStore(join(dir,'s')),base={inputRevision:'r',operation:'elastic',origin:'api',state:'running',startedAt:1,updatedAt:1,executionSettled:false};
  store.persist({...base,jobId:'ok',error:{code:'C',message:'m'.repeat(5000)}},{requestId:'q'});
  const written=JSON.parse(await readFile(join(dir,'s','ok.json'),'utf8'));assert.equal(written.error.message.length,jobStoreLimits.maxMessageChars);
  store.persist({...base,jobId:'big',requestId:undefined,inputRevision:'r'.repeat(20000)},{});assert.ok(!(await readdir(join(dir,'s'))).includes('big.json'));
  for(let n=0;n<jobStoreLimits.maxRecords+2;n++)store.persist({...base,jobId:'j'+n},{});
  assert.equal((await readdir(join(dir,'s'))).length,jobStoreLimits.maxRecords);
  assert.ok(store.diagnostics.length<=jobStoreLimits.maxDiagnostics);
 }finally{restore();await rm(dir,{recursive:true,force:true});}
});

test('without the option nothing is persisted and the service shape is unchanged',async()=>{
 const dir=await temp();
 try{
  const path=join(dir,'in.json'),outputPath=join(dir,'out.json');await writeFile(path,JSON.stringify(project()));
  const service=createHeadlessJobService();assert.equal(service.jobStoreDiagnostics,undefined);
  const job=await service.start({path,outputPath,requestId:'plain'});assert.equal(job.restored,undefined);
  const done=await settle(service,job.jobId);assert.equal(done.state,'succeeded');assert.equal(done.restored,undefined);assert.equal(done.resultAvailable,undefined);
  assert.deepEqual((await readdir(dir)).sort(),['in.json','out.json']);
  service.release(job.jobId);assert.throws(()=>service.get(job.jobId),/Unknown job/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
