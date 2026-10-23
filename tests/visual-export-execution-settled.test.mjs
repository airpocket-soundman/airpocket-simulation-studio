import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {createBrowserSession} from '../src/browser-session.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';
const revision='sha256:'+'a'.repeat(64);
const request=(requestId='one')=>({requestId,expectedResultRevision:revision,format:'png',view:{field:'temperature'}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('cancel changes state but waits through renderer finally before executionSettled and queue reuse',async()=>{
 const output=deferred(),cleanup=deferred(),cleanupEntered=deferred();let aborted=false;
 const api=createVisualExportJobs({render:async({signal})=>{signal.addEventListener('abort',()=>{aborted=true;});try{return await output.promise;}finally{cleanupEntered.resolve();await cleanup.promise;}}});
 const job=await api.start(request());assert.equal(job.executionSettled,false);job.executionSettled=true;assert.equal(api.status(job).executionSettled,false);
 const cancelled=api.cancel(job);assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.executionSettled,false);assert.equal(aborted,true);
 output.resolve(new Blob(['late'],{type:'image/png'}));await cleanupEntered.promise;assert.equal(api.status(job).executionSettled,false);await assert.rejects(api.start(request('next')),/active/);assert.throws(()=>api.artifact(job),/unavailable/);
 cleanup.resolve();await api.waitForSettled(job);assert.equal(api.status(job).executionSettled,true);assert.equal(api.status(job).state,'cancelled');
 const next=await api.start(request('next'));await api.waitForSettled(next);assert.equal(api.status(next).executionSettled,true);
});

test('successful and failed artifact completion return strict boolean and detached idempotent summaries',async()=>{
 for(const failed of [false,true]){const output=deferred(),api=createVisualExportJobs({render:()=>output.promise}),job=await api.start(request());assert.equal(api.status(job).executionSettled,false);
 if(failed)output.reject(Error('synthetic failure'));else output.resolve(new Blob(['ok'],{type:'image/png'}));await api.waitForSettled(job);
 const done=api.status(job);assert.equal(done.executionSettled,true);assert.equal(done.state,failed?'failed':'completed');assert.equal((await api.start(request())).executionSettled,true);assert.equal(api.cancel(job).executionSettled,true);done.executionSettled=false;assert.equal(api.status(job).executionSettled,true);}
});

test('cancelAll preserves unsettled execution and release keeps its existing unknown-job rule',async()=>{
 const output=deferred(),api=createVisualExportJobs({render:()=>output.promise}),job=await api.start(request());api.cancelAll();assert.equal(api.status(job).state,'cancelled');assert.equal(api.status(job).executionSettled,false);const settled=api.waitForSettled(job);api.release(job);assert.throws(()=>api.status(job),/Unknown/);await assert.rejects(api.start(request('next')),/active/);output.reject(Error('late renderer'));await settled;assert.throws(()=>api.status(job),/Unknown/);
});

test('new browser session can distinguish disconnected owned export cancellation from actual deferred cleanup',async()=>{
 const output=deferred(),cleanup=deferred(),cleanupEntered=deferred(),api=createVisualExportJobs({render:()=>{},prepareCompare:async()=>({view:{},comparison:{cases:[]}}),renderCompare:async()=>{try{return await output.promise;}finally{cleanupEntered.resolve();await cleanup.promise;}}});
 const first=createBrowserSession({exports:api}),job=await first.call('startCompareExport',{requestId:'owned',format:'png',references:[{caseId:'a',expectedRevision:revision},{caseId:'b',expectedRevision:revision}],field:'temperature'});assert.equal(job.executionSettled,false);first.disconnect();
 const second=createBrowserSession({exports:api}),status=await second.call('exportStatus',{jobId:job.jobId});assert.equal(status.state,'cancelled');assert.equal(status.executionSettled,false);await assert.rejects(second.call('exportArtifact',{jobId:job.jobId}),/unavailable/);
 output.resolve(new Blob(['late'],{type:'image/png'}));await cleanupEntered.promise;assert.equal((await second.call('exportStatus',{jobId:job.jobId})).executionSettled,false);cleanup.resolve();await api.waitForSettled(job);assert.equal((await second.call('exportStatus',{jobId:job.jobId})).executionSettled,true);
 await second.call('releaseExport',{jobId:job.jobId});await assert.rejects(second.call('exportStatus',{jobId:job.jobId}),/Unknown/);
});

test('export status discovery documents settlement without new methods or scopes',()=>{
 const contract=getBrowserOperationContracts({method:'exportStatus'}).operations[0];assert.equal(contract.scope,'inspect');assert.match(contract.description,/executionSettled/);assert.ok(contract.limitations.some(text=>text.includes('cancelled does not imply')));
});

test('cancel during deferred artifact bytes remains unsettled until the byte promise returns',async()=>{
 const bytes=deferred(),entered=deferred();class PendingBlob extends Blob{arrayBuffer(){entered.resolve();return bytes.promise;}}
 const api=createVisualExportJobs({render:()=>new PendingBlob(['ok'],{type:'image/png'})}),job=await api.start(request());await entered.promise;assert.equal(api.status(job).executionSettled,false);assert.equal(api.cancel(job).executionSettled,false);bytes.resolve(Uint8Array.of(1,2).buffer);await api.waitForSettled(job);assert.equal(api.status(job).executionSettled,true);assert.equal(api.status(job).state,'cancelled');assert.throws(()=>api.artifact(job),/unavailable/);
});
