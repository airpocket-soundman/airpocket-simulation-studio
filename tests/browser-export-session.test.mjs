import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods} from '../src/browser-session.js';

test('browser export lifecycle routes bounded artifact requests and cancels connection-owned work',async()=>{
 const calls=[],exports={capabilities:()=>({png:true}),start:async(args,{guard})=>{assert.equal(guard(),true);calls.push(args);return {jobId:'image-1',state:'running'};},status:args=>({jobId:args.jobId,state:'completed'}),artifact:args=>{calls.push(args);return {data:'AA==',nextOffset:null};},cancel:args=>{calls.push(['cancel',args.jobId]);return {state:'cancelled'};},release:args=>({released:args.jobId})};
 const session=createBrowserSession({exports});
 assert.deepEqual(await session.call('exportCapabilities'),{png:true});
 assert.equal((await session.call('startExport',{requestId:'image'})).jobId,'image-1');
 assert.equal((await session.call('exportStatus',{jobId:'image-1'})).state,'completed');
 assert.deepEqual(await session.call('exportArtifact',{jobId:'image-1',offset:65536,length:32}),{data:'AA==',nextOffset:null});
 assert.deepEqual(calls[1],{jobId:'image-1',offset:65536,length:32});
 session.disconnect();assert.deepEqual(calls[2],['cancel','image-1']);
 assert.equal(browserMethods.startExport,'view');assert.equal(browserMethods.exportArtifact,'inspect');
});

test('disconnect invalidates an export that is still preparing before renderer admission',async()=>{
 let resume,rendered=false;
 const session=createBrowserSession({exports:{start:async(args,{guard})=>{await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('expired export');rendered=true;return {jobId:'late'};}}});
 const pending=session.call('startExport',{requestId:'late'});session.disconnect();resume();
 await assert.rejects(pending,/expired export/);assert.equal(rendered,false);
});

test('exportCapabilities passes through structured mp4/gif entries without changing operation routing',async()=>{
 const caps={png:true,mp4:false,gif:false,formats:{mp4:{supported:false,reason:'r',alternatives:['webm','png']},gif:{supported:false,reason:'g',alternatives:['webm','png']}}};
 const session=createBrowserSession({exports:{capabilities:()=>caps}});assert.deepEqual(await session.call('exportCapabilities'),caps);assert.equal(browserMethods.exportCapabilities,'inspect');
});

test('comparison exports share artifact lifecycle and disconnect ownership with ordinary exports',async()=>{
 const calls=[],request={requestId:'pair',references:[{caseId:'a',expectedRevision:'sha256:'+'a'.repeat(64)},{caseId:'b',expectedRevision:'sha256:'+'b'.repeat(64)}],field:'temperature',timeSeconds:5};
 const exports={startCompare:async(args,{guard})=>{assert.deepEqual(args,request);assert.equal(guard(),true);return {jobId:'pair-1',target:'comparison'};},status:args=>({jobId:args.jobId,state:'completed'}),artifact:args=>{calls.push(args);return {data:'AA=='};},cancel:args=>calls.push(['cancel',args.jobId]),release:args=>({released:args.jobId})},session=createBrowserSession({exports});
 assert.equal(browserMethods.startCompareExport,'view');assert.equal((await session.call('startCompareExport',request)).target,'comparison');
 assert.equal((await session.call('exportStatus',{jobId:'pair-1'})).state,'completed');assert.deepEqual(await session.call('exportArtifact',{jobId:'pair-1',offset:0,length:32}),{data:'AA=='});
 session.disconnect();assert.deepEqual(calls[1],['cancel','pair-1']);
});
test('comparison preparation rejects competing starts and expires on disconnect',async()=>{
 let resume;const session=createBrowserSession({exports:{startCompare:async(args,{guard})=>{await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('comparison expired');return {jobId:'late'};},start:async()=>({jobId:'other'})}});
 const pending=session.call('startCompareExport',{});await assert.rejects(session.call('startExport',{}),/busy/);await assert.rejects(session.call('startCompareExport',{}),/busy/);session.disconnect();resume();await assert.rejects(pending,/expired/);
 await assert.rejects(createBrowserSession({exports:{}}).call('startCompareExport',{}),/unavailable/);
});

test('comparison admission deadline and accepted-job session lifetime are separate',async(t)=>{
 let now=100,admission,lifetime; t.mock.method(Date,'now',()=>now);
 const cancelled=[],session=createBrowserSession({exports:{startCompare:async(_,{guard,jobGuard})=>{admission=guard;lifetime=jobGuard;assert.equal(guard(),true);assert.equal(jobGuard(),true);return {jobId:'long'};},cancel:({jobId})=>cancelled.push(jobId)}});
 await session.call('startCompareExport',{}, {expiresAt:15100});now=15100;
 assert.equal(admission(),false);assert.equal(lifetime(),true);
 await assert.rejects(session.call('startCompareExport',{}, {expiresAt:15100}),/expired/);
 session.disconnect();assert.equal(lifetime(),false);assert.deepEqual(cancelled,['long']);
});
