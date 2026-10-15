import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods} from '../src/browser-session.js';
import {createResultViewApi} from '../src/result-view-api.js';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';

const output={input:{version:1},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind:'thermal',temperature:[20,30,40,50],flux:[[1,2,3]]}};
function resultViewFixture(){
 let live={field:'temperature',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:null,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}},busy=false,writes=0;
 const adapter={getAnalysis:()=>output,get:()=>structuredClone(live),set:s=>{writes++;live=structuredClone(s);},isBusy:()=>busy};
 return {resultView:createResultViewApi(adapter),live:()=>structuredClone(live),writes:()=>writes,busy:v=>{busy=v;}};
}
function exportFixture(){
 const jobs=new Map(),calls=[];let next=0;
 const known=id=>{if(!jobs.has(id))throw Error('Unknown or released export job');return jobs.get(id);};
 return {calls,jobs,exports:{
  start:async()=>{const jobId='export-'+(++next);jobs.set(jobId,{state:'running'});return {jobId,state:'running'};},
  cancel:({jobId})=>{calls.push(['cancel',jobId]);const job=known(jobId);job.state='cancelled';return {jobId,state:'cancelled'};},
  release:({jobId})=>{calls.push(['release',jobId]);known(jobId);jobs.delete(jobId);return {jobId,released:true};}
 }};
}

test('setResultView changes only presentation through the session and refuses stale revisions, bad settings and a busy browser',async()=>{
 const h=resultViewFixture(),session=createBrowserSession({resultView:h.resultView}),before=await session.call('getResultView');
 const changed=await session.call('setResultView',{expectedResultRevision:before.resultRevision,settings:{deformScale:2}});
 assert.equal(changed.state.deformScale,2);assert.equal(changed.resultRevision,before.resultRevision);assert.equal(h.live().deformScale,2);assert.equal(h.writes(),1);
 const stable=h.live();
 await assert.rejects(session.call('setResultView',{expectedResultRevision:'sha256:'+'0'.repeat(64),settings:{deformScale:3}}),/revision conflict/);
 await assert.rejects(session.call('setResultView',{expectedResultRevision:before.resultRevision,settings:{unknownSetting:1}}));
 assert.deepEqual(h.live(),stable);assert.equal(h.writes(),1);
 const busy=createBrowserSession({resultView:h.resultView,isBusy:()=>true});
 await assert.rejects(busy.call('setResultView',{expectedResultRevision:before.resultRevision,settings:{deformScale:4}}),/busy/);
 await assert.rejects(createBrowserSession({}).call('setResultView',{}),/unavailable/);
 assert.deepEqual(h.live(),stable);assert.equal(h.writes(),1);
});

test('cancelExport and releaseExport act on live export jobs and refuse unknown, repeated or released ids',async()=>{
 const f=exportFixture(),session=createBrowserSession({exports:f.exports}),{jobId}=await session.call('startExport',{requestId:'a'});
 assert.deepEqual(await session.call('cancelExport',{jobId}),{jobId,state:'cancelled'});
 assert.equal(f.jobs.get(jobId).state,'cancelled');
 await assert.rejects(session.call('cancelExport',{jobId:'export-unknown'}),/Unknown or released/);
 assert.deepEqual(await session.call('releaseExport',{jobId}),{jobId,released:true});
 assert.equal(f.jobs.has(jobId),false);
 await assert.rejects(session.call('releaseExport',{jobId}),/Unknown or released/);
 await assert.rejects(session.call('cancelExport',{jobId}),/Unknown or released/);
 await assert.rejects(session.call('releaseExport',{jobId:'never-existed'}),/Unknown or released/);
 await assert.rejects(createBrowserSession({}).call('cancelExport',{jobId}));
});

test('released exports are no longer cancelled by session disconnect',async()=>{
 const f=exportFixture(),session=createBrowserSession({exports:f.exports}),{jobId}=await session.call('startExport',{requestId:'b'});
 await session.call('releaseExport',{jobId});f.calls.length=0;session.disconnect();
 assert.deepEqual(f.calls,[]);
});

test('setResultView, cancelExport and releaseExport are view-scope operations and an inspect-only grant is refused by the bridge',async()=>{
 for(const method of ['setResultView','cancelExport','releaseExport'])assert.equal(browserMethods[method],'view');
 assert.equal(browserMethods.getResultView,'inspect');
 const origin='https://coverage.example',bridge=await createBrowserBridge({origin,timeoutMs:2000});
 try{
  const paired=await(await fetch(bridge.endpoint+'/pair',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+bridge.pairingToken,'Content-Type':'application/json'},body:JSON.stringify({scopes:['inspect']})})).json();
  for(const method of ['setResultView','cancelExport','releaseExport'])await assert.rejects(bridge.call(paired.sessionId,method,{jobId:'x'},browserMethods[method]),/scope refused/i);
 }finally{await bridge.close();}
});
