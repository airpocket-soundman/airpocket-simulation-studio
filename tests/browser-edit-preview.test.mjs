import {test} from 'node:test';import assert from 'node:assert/strict';
import {createStudioApi} from '../src/studio-api.js';
import {createBrowserSession} from '../src/browser-session.js';
import {createAnalysisClient} from '../src/analysis-client.js';
import {executionFailureProject} from './fixtures/execution-failure-projects.mjs';
const setup=()=>{const studio=createStudioApi();studio.loadProject(executionFailureProject('valid'));return studio;};
const operations=[{method:'setMaterialProperties',args:[{youngModulus:2e9,poissonRatio:0}]}];
test('shared preview leaves input untouched and a reviewed candidate revision binds the later atomic edit',async()=>{
 const studio=setup(),before=studio.exportProject(),expectedRevision=await studio.getRevision(),preview=await studio.previewOperations(operations,{expectedRevision});assert.deepEqual(studio.exportProject(),before);assert.equal(preview.previousRevision,expectedRevision);assert.equal(preview.preflight.allowed,false);assert.ok(preview.preflight.diagnostics.some(d=>d.code==='PROVENANCE_STALE'));
 await assert.rejects(studio.applyOperations([{method:'clearSelection',args:[]}],{expectedRevision,expectedResultingRevision:preview.revision}),{code:'EDIT_PREVIEW_REVISION_CONFLICT'});assert.deepEqual(studio.exportProject(),before);
 const result=await studio.applyOperations(operations,{expectedRevision,expectedResultingRevision:preview.revision});assert.equal(result.revision,preview.revision);assert.equal(await studio.getRevision(),preview.revision);
});
test('shared preview detects concurrent input changes without overwriting them',async()=>{
 const studio=setup(),expectedRevision=await studio.getRevision(),pending=studio.previewOperations(operations,{expectedRevision});studio.selectTriangles(0,[0]);const current=studio.exportProject();await assert.rejects(pending,{code:'EDIT_PREVIEW_STALE'});assert.deepEqual(studio.exportProject(),current);
 await assert.rejects(studio.previewOperations(operations,{expectedRevision,target:'node'}),/target/);assert.deepEqual(studio.exportProject(),current);
});
test('a live edit preview runs during a pending browser job while its frozen Worker request and input stay unchanged',async()=>{
 const studio=setup(),messages=[];let terminated=0;
 const analysis=createAnalysisClient(()=>studio.exportProject(),()=>{},{isIsolated:()=>true,baseUrl:()=>'/unused/',createWorker:()=>({postMessage:request=>messages.push(request),terminate:()=>{terminated++;}})}),session=createBrowserSession({studio,analysis});
 try{
  const before=studio.exportProject(),expectedRevision=(await session.call('inspect')).revision,started=await session.call('startJob',{inputRevision:expectedRevision,requestId:'preview-while-active'});while(!messages.length)await new Promise(setImmediate);const frozen=structuredClone(messages[0]);assert.equal(analysis.getJob(started.jobId).state,'running');
  const preview=await session.call('previewEdit',{expectedRevision,operations});assert.notEqual(preview.revision,expectedRevision);assert.equal(analysis.getJob(started.jobId).state,'running');assert.deepEqual(messages[0],frozen);assert.deepEqual(studio.exportProject(),before);assert.equal(terminated,0);
  await assert.rejects(session.call('edit',{expectedRevision,expectedResultingRevision:preview.revision,operations}),/busy/);assert.deepEqual(studio.exportProject(),before);
  analysis.cancelJob(started.jobId);await analysis.drainJobs();assert.equal(terminated,1);assert.equal(analysis.getJob(started.jobId).executionSettled,true);const applied=await session.call('edit',{expectedRevision,expectedResultingRevision:preview.revision,operations});assert.equal(applied.revision,preview.revision);analysis.releaseJob(started.jobId);
 }finally{session.disconnect();await analysis.closeJobsAsync();}
});
test('expired or revoked preview responses are refused without changing input',async()=>{
 const studio=setup(),session=createBrowserSession({studio}),expectedRevision=(await session.call('inspect')).revision,before=studio.exportProject();
 const pending=session.call('previewEdit',{expectedRevision,operations});session.disconnect();await assert.rejects(pending,{code:'EDIT_PREVIEW_STALE'});assert.deepEqual(studio.exportProject(),before);
 await assert.rejects(session.call('previewEdit',{expectedRevision,operations},{expiresAt:Date.now()-1}),/expired/);assert.deepEqual(studio.exportProject(),before);
 await assert.rejects(session.call('edit',{expectedRevision,expectedResultingRevision:'sha256:'+'0'.repeat(64),operations}),{code:'EDIT_PREVIEW_REVISION_CONFLICT'});assert.deepEqual(studio.exportProject(),before);
});
test('trusted host normalization is previewed and bound before the single visible commit',async()=>{
 let stored=setup().exportProject(),writes=0;const normalizeProject=project=>({...project,study:{modeCount:2,...project.study}}),studio=createStudioApi({get:()=>stored,set:project=>{writes++;stored=normalizeProject(project);},normalizeProject}),expectedRevision=await studio.getRevision(),before=structuredClone(stored),commands=[{method:'setStudy',args:[{kind:'structural',gravityEnabled:false}]}];
 const preview=await studio.previewOperations(commands,{expectedRevision});assert.equal(writes,0);assert.deepEqual(stored,before);assert.equal(preview.normalization.requiresReview,true);assert.ok(preview.normalization.changedPointers.pointers.includes('/study/modeCount'));assert.equal(preview.normalization.revision,preview.revision);
 await assert.rejects(studio.applyOperations(commands,{expectedRevision,expectedResultingRevision:preview.normalization.previousRevision}),{code:'EDIT_PREVIEW_REVISION_CONFLICT'});assert.equal(writes,0);assert.deepEqual(stored,before);
 const applied=await studio.applyOperations(commands,{expectedRevision,expectedResultingRevision:preview.revision});assert.equal(writes,1);assert.equal(applied.revision,preview.revision);assert.equal(await studio.getRevision(),preview.revision);assert.equal(stored.study.modeCount,2);
});
test('async or invalid trusted normalization cannot mutate the public input',async()=>{
 for(const normalizeProject of [async project=>project,()=>Promise.resolve({}),()=>({version:1})]){
  const before=setup().exportProject();let writes=0;const studio=createStudioApi({get:()=>before,set:()=>{writes++;},normalizeProject}),expectedRevision=await studio.getRevision();await assert.rejects(studio.previewOperations(operations,{expectedRevision}));await assert.rejects(studio.applyOperations(operations,{expectedRevision}));assert.equal(writes,0);
 }
});
test('non-idempotent host unit conversions are predicted once and never applied twice',async()=>{
 const initial=setup().exportProject();let stored=initial,writes=0;const convert=project=>({...structuredClone(project),study:{...project.study,acousticDuration:project.study.acousticDuration*1000*.001}}),studio=createStudioApi({get:()=>stored,set:project=>{writes++;stored=convert(project);},normalizeProject:convert}),x=.006986962513465328,commands=[{method:'setStudy',args:[{kind:'structural',gravityEnabled:false,acousticDuration:x}]}],expectedRevision=await studio.getRevision();
 const preview=await studio.previewOperations(commands,{expectedRevision});assert.equal(writes,0);assert.notEqual(x*1000*.001,(x*1000*.001)*1000*.001);
 await studio.applyOperations(commands,{expectedRevision,expectedResultingRevision:preview.revision});assert.equal(writes,1);assert.equal(stored.study.acousticDuration,x*1000*.001);assert.equal(await studio.getRevision(),preview.revision);
});
