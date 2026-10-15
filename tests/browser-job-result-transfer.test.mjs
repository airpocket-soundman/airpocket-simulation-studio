import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBrowserSession,browserMethods} from '../src/browser-session.js';
import {createJobResultTransfer} from '../src/job-result-transfer.js';
import {getProjectRevision} from '../src/project-revision.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';

test('inspect-scoped job output transfer preserves current input B while exporting complete immutable job A',async()=>{
 const input={sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},study:{kind:'structural'}},revision=await getProjectRevision(input);
 const current={name:'B'},output={input,calculation:{operation:'elastic'},mesh:{nodes:[0,0,0],tetrahedra:[]},boundary:{fixed:[]},result:{kind:'structural',displacements:[1,2,3]}};
 const analysis={getJob:jobId=>({jobId,state:'succeeded',executionSettled:true,inputRevision:revision}),getJobResult:()=>structuredClone(output)};
 const transfer=createJobResultTransfer({analysis}),session=createBrowserSession({analysis,jobResults:transfer,builtinProjects:{},studio:{exportProject:()=>current},isBusy:()=>true});
 for(const method of ['jobResultExport','jobResultRead','jobResultRelease']){assert.equal(browserMethods[method],'inspect');assert.equal(getBrowserOperationContracts({method}).operations[0].scope,'inspect');}
 const meta=await session.call('jobResultExport',{jobId:'A',inputRevision:revision});
 output.result.displacements[0]=99;
 const chunks=[];let offset=0;do{const page=await session.call('jobResultRead',{transferId:meta.transferId,offset,length:31});chunks.push(Buffer.from(page.data,'base64'));offset=page.nextOffset;}while(offset!==null);
 const bytes=Buffer.concat(chunks),saved=JSON.parse(bytes.toString('utf8'));
 assert.equal(bytes.length,meta.totalBytes);assert.equal('sha256:'+createHash('sha256').update(bytes).digest('hex'),meta.sha256);
 assert.equal(saved.result.displacements[0],1);assert.deepEqual(saved.input,input);assert.deepEqual(current,{name:'B'});
 const other=createBrowserSession({analysis,jobResults:transfer});await assert.rejects(other.call('jobResultRead',{transferId:meta.transferId}),/session job result/);
 assert.deepEqual(await session.call('jobResultRelease',{transferId:meta.transferId}),{released:true});
 await assert.rejects(session.call('jobResultRead',{transferId:meta.transferId}),/session job result/);
 const retained=await session.call('jobResultExport',{jobId:'A',inputRevision:revision});session.disconnect();
 assert.throws(()=>transfer.read({transferId:retained.transferId}),/Unknown or released/);
 await assert.rejects(session.call('jobResultRead',{transferId:retained.transferId}),/session job result/);
});

test('session epoch prevents delayed export or read replies after disconnect and cleans late exports',async()=>{
 let resolve,guard,released=[],disconnected=0;
 const pending=()=>new Promise(done=>{resolve=done;});
 const module={beginExport:(_args,options)=>{guard=options.guard;return pending();},read:()=>pending(),release:({transferId})=>{released.push(transferId);return {released:true};},disconnect:()=>{disconnected++;}};
 const session=createBrowserSession({jobResults:module});
 const first=session.call('jobResultExport',{jobId:'A',inputRevision:'revision'});assert.equal(guard(),true);session.disconnect();assert.equal(guard(),false);resolve({transferId:'late'});
 await assert.rejects(first,/expired or connection revoked/);assert.ok(released.includes('late'));assert.equal(disconnected,1);
 const next=session.call('jobResultExport',{});resolve({transferId:'read'});await next;
 const reading=session.call('jobResultRead',{transferId:'read'});session.disconnect();resolve({data:'AA=='});await assert.rejects(reading,/expired or connection revoked/);assert.ok(released.includes('read'));
 let calls=0;const expired=createBrowserSession({jobResults:{beginExport(){calls++;}}});await assert.rejects(expired.call('jobResultExport',{}, {expiresAt:0}),/expired/);assert.equal(calls,0);
});
