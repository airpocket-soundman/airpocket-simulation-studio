import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createJobResultTransfer} from '../src/job-result-transfer.js';
import {getProjectRevision} from '../src/project-revision.js';
import {createAnalysisClient} from '../src/analysis-client.js';
import {BoxGeometry} from 'three';

async function fixture(options={}){
 const input={version:1,study:{kind:'thermal'},materialProperties:{conductivity:2},sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]}},inputRevision=await getProjectRevision(input);
 const output={input,calculation:{operation:'elastic',options:{method:'pcg'}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},boundary:{temperatures:[[0,20]]},result:{kind:'thermal',temperature:[20,21,22,23],history:[],notes:'日本語'.repeat(16000)},analysisAssessment:{provisional:true}};
 let job={jobId:'job-A',inputRevision,state:'succeeded',executionSettled:true,operation:'elastic'},sequence=0;
 const analysis={getJob:()=>{if(!job)throw Error('Unknown job');return structuredClone(job);},getJobResult:()=>output};
 return {api:createJobResultTransfer({analysis,id:()=>`transfer-${++sequence}`,...options}),analysis,output,inputRevision,command:{jobId:'job-A',inputRevision},setJob:value=>job=value,job};
}

test('complete successful output round-trips bounded raw UTF-8 chunks without displaying or requiring current inputs',async()=>{
 const {api,output,command}=await fixture(),original=structuredClone(output),entry=await api.beginExport(command),parts=[];
 assert.equal(entry.kind,'thermal');assert.equal(entry.jobId,'job-A');assert.equal(entry.hashBasis,'raw-utf8');assert.equal(entry.format,'analysis-output');assert.equal(entry.maxChunkBytes,65536);
 output.result.temperature[0]=999;output.input.study.kind='structural';
 let offset=0;do{const page=api.read({transferId:entry.transferId,offset});const bytes=Buffer.from(page.data,'base64');assert.ok(bytes.length<=65536);parts.push(bytes);offset=page.nextOffset;}while(offset!==null);
 const bytes=Buffer.concat(parts);assert.deepEqual(JSON.parse(bytes.toString('utf8')),original);assert.equal(entry.totalBytes,bytes.length);assert.equal(entry.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));assert.equal(JSON.parse(bytes.toString()).runtime,undefined);
 assert.equal(api.read({transferId:entry.transferId,offset:entry.totalBytes}).data,'');api.release({transferId:entry.transferId});assert.throws(()=>api.read({transferId:entry.transferId}),/released/);
});

test('job lifecycle, actual saved input identity, JSON and strict transfer queries reject without mutation',async()=>{
 const f=await fixture(),before=JSON.stringify(f.output);
 for(const change of [{state:'running'},{executionSettled:false},{state:'cancelled'},{inputRevision:'sha256:'+'0'.repeat(64)}]){f.setJob({...f.job,...change});await assert.rejects(f.api.beginExport(f.command));}f.setJob(f.job);
 for(const args of [{...f.command,extra:1},{...f.command,inputRevision:'bad'},{...f.command,jobId:''}])await assert.rejects(f.api.beginExport(args));
 f.output.input.study.kind='changed';await assert.rejects(f.api.beginExport(f.command),/revision mismatch/);f.output.input.study.kind='thermal';
 f.output.inputRevision='sha256:'+'0'.repeat(64);await assert.rejects(f.api.beginExport(f.command),/output revision mismatch/);delete f.output.inputRevision;
 const getter={};Object.defineProperty(getter,'jobId',{enumerable:true,get(){throw Error('getter must not run');}});await assert.rejects(f.api.beginExport(getter),/arguments/);
 const entry=await f.api.beginExport(f.command);
 for(const args of [{offset:-1},{offset:entry.totalBytes+1},{offset:1.5},{length:0},{length:65537},{extra:true}])assert.throws(()=>f.api.read({transferId:entry.transferId,...args}));
 assert.throws(()=>f.api.read({transferId:entry.transferId},{guard:()=>false}),/expired/);assert.throws(()=>f.api.release({transferId:entry.transferId},{guard:()=>false}),/expired/);assert.equal(JSON.stringify(f.output),before);
 f.output.result.temperature[0]=NaN;await assert.rejects(f.api.beginExport(f.command),/JSON/);
});

test('shared byte/count budgets reserve pending exports and release/disconnect restore all capacity',async()=>{
 const source=await fixture(),size=new TextEncoder().encode(JSON.stringify(JSON.parse((await import('../src/project-revision.js')).canonicalJson(source.output)))).length;
 const f=await fixture({maxBytes:size,maxTransfers:1});const entry=await f.api.beginExport(f.command);await assert.rejects(f.api.beginExport(f.command),/count/);f.api.release({transferId:entry.transferId});const again=await f.api.beginExport(f.command);f.api.disconnect();assert.throws(()=>f.api.read({transferId:again.transferId}),/released/);await f.api.beginExport(f.command);
 const tooSmall=await fixture({maxBytes:size-1});await assert.rejects(tooSmall.api.beginExport(tooSmall.command),/budget/);
});

test('optional undefined properties and finite typed arrays use JSON archive representation without silently normalizing invalid numbers',async()=>{
 const f=await fixture();f.output.result.optional=undefined;f.output.result.temperature=new Float64Array([20,21,22,23]);
 const entry=await f.api.beginExport(f.command),parts=[];let offset=0;do{const page=f.api.read({transferId:entry.transferId,offset});parts.push(Buffer.from(page.data,'base64'));offset=page.nextOffset;}while(offset!==null);
 const output=JSON.parse(Buffer.concat(parts).toString());assert.deepEqual(output.result.temperature,[20,21,22,23]);assert.equal(Object.hasOwn(output.result,'optional'),false);f.api.disconnect();
 for(const invalid of [new Float64Array([NaN]),new Float64Array([Infinity]),[undefined]]){f.output.result.temperature=invalid;await assert.rejects(f.api.beginExport(f.command),/JSON/);}
 f.output.result.temperature=[20,21,22,23];Object.defineProperty(f.output.result,'get',{enumerable:true,get(){throw Error('must not run');}});await assert.rejects(f.api.beginExport(f.command),/JSON/);
});

test('release, disconnect, invalid guards and released jobs during asynchronous hashing cannot publish a transfer',async()=>{
 for(const action of ['release','disconnect','guard','job']){
  const f=await fixture({maxTransfers:1});let resume,entered;const gate=new Promise(resolve=>resume=resolve),started=new Promise(resolve=>entered=resolve),original=crypto.subtle.digest;let paused=false,valid=true;
  crypto.subtle.digest=async function(...args){if(!paused){paused=true;entered();await gate;}return original.apply(this,args);};
  try{
   const pending=assert.rejects(f.api.beginExport(f.command,{guard:()=>valid}));await started;
   assert.throws(()=>f.api.read({transferId:'transfer-1'}),/not ready/);
   if(action==='release')f.api.release({transferId:'transfer-1'});if(action==='disconnect')f.api.disconnect();if(action==='guard')valid=false;if(action==='job')f.setJob(null);
   resume();await pending;assert.throws(()=>f.api.read({transferId:'transfer-1'}),/released/);
   valid=true;f.setJob(f.job);await f.api.beginExport(f.command);
  }finally{resume();crypto.subtle.digest=original;f.api.disconnect();}
 }
});

test('actual Worker output retained by analysis-client exports while the UI has moved to another input',async()=>{
 const geometry=new BoxGeometry(10,10,10).toNonIndexed();geometry.translate(5,5,5);const positions=Array.from(geometry.attributes.position.array);geometry.dispose();
 const faces=z=>positions.flatMap((_,i)=>i%9===0&&[2,5,8].every(k=>Math.abs(positions[i+k]-z)<1e-7)?[i/9]:[]);
 let current={version:1,sourceModel:{kind:'box',bounds:[0,0,0,10,10,10]},study:{kind:'thermal'},materialProperties:{conductivity:2},meshes:[{positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))}],conditions:[{type:'temperature',value:20,direction:[1,0,0],regions:[{mesh:0,triangles:faces(0)}]},{type:'temperature',value:100,direction:[1,0,0],regions:[{mesh:0,triangles:faces(10)}]}]};
 const inputRevision=await getProjectRevision(current),previousSelf=globalThis.self;let worker;
 const client=createAnalysisClient(()=>current,()=>{},{isIsolated:()=>true,baseUrl:()=>new URL('./fixtures/worker/',import.meta.url).href,createWorker:()=>worker={postMessage(data){void globalThis.self.onmessage({data});},terminate(){}}});
 globalThis.self={postMessage:data=>worker.onmessage({data})};
 try{
  await import('../src/analysis.worker.js?job-result-transfer-test');
  const job=client.startJob({inputRevision,options:{method:'pcg',size:5}});
  for(let i=0;i<1000&&!client.getJob(job.jobId).executionSettled;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(client.getJob(job.jobId).state,'succeeded',JSON.stringify(client.getJob(job.jobId).error));const original=client.getJobResult(job.jobId);current={version:1,name:'UI input B'};
  const api=createJobResultTransfer({analysis:client}),entry=await api.beginExport({jobId:job.jobId,inputRevision}),parts=[];let offset=0;
  do{const page=api.read({transferId:entry.transferId,offset});parts.push(Buffer.from(page.data,'base64'));offset=page.nextOffset;}while(offset!==null);
  assert.deepEqual(JSON.parse(Buffer.concat(parts).toString()),JSON.parse(JSON.stringify(original)));assert.deepEqual(current,{version:1,name:'UI input B'});api.disconnect();
 }finally{await client.closeJobsAsync();if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;}
});
