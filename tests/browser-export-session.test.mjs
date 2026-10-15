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
