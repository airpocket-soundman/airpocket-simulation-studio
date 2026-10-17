import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserPageLifecycle,browserVersionMetadata} from '../src/browser-page-lifecycle.js';
import {createBrowserSession} from '../src/browser-session.js';
import {createStudioApi} from '../src/studio-api.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';

test('existing inspect discovery describes the optional strict lifecycle identity without changing scopes',()=>{
 const c=getBrowserOperationContracts({method:'inspect'}).operations[0],previous=c.inputSchema.properties.previousLifecycle;
 assert.equal(c.scope,'inspect');assert.deepEqual(previous.required,['pageInstanceId','connectionEpoch']);assert.equal(previous.additionalProperties,false);assert.equal(previous.properties.pageInstanceId.maxLength,128);assert.equal(previous.properties.connectionEpoch.minimum,0);assert.ok(c.limitations.some(s=>s.includes('Never automatically replay')));
});

test('browser version is low-entropy self-report with explicit precision and never full-version proof',()=>{
 assert.deepEqual(browserVersionMetadata({userAgent:'Mozilla Chrome/155.0.0.0 Safari/537.36'}),{name:'Chrome',reportedVersion:'155.0.0.0',precision:'reduced',fullVersionVerified:false,source:'navigator.userAgent'});
 assert.equal(browserVersionMetadata({userAgent:'Chrome/155.0.8059.41'}).precision,'reported');assert.equal(browserVersionMetadata({userAgent:'Chrome/155.0.0.0 Edg/155.0.1.2'}).name,'Edge');assert.equal(browserVersionMetadata({}).precision,'unavailable');
 let requested=false;browserVersionMetadata({userAgent:'Chrome/155.0.0.0',userAgentData:{getHighEntropyValues(){requested=true;}}});assert.equal(requested,false);
});

test('same page reconnect differs from reset; event retention and output remain bounded and memory-only',()=>{
 const a=createBrowserPageLifecycle({id:()=> 'page-a'}),initial=a.snapshot();a.connected();const previous={pageInstanceId:a.snapshot().pageInstanceId,connectionEpoch:a.snapshot().connectionEpoch};assert.equal(a.snapshot(previous).relation,'same-connection');a.record('disconnected');a.connected();assert.equal(a.snapshot(previous).relation,'same-page-reconnected');
 const b=createBrowserPageLifecycle({id:()=> 'page-b'});assert.equal(b.snapshot(previous).relation,'page-reset');assert.equal(b.snapshot().relation,'unknown');assert.equal(b.snapshot().automaticReplay,false);assert.equal(initial.connectionEpoch,0);
 for(let i=0;i<100;i++)a.record('hidden');assert.equal(a.snapshot().events.length,12);assert.equal(a.snapshot().eventSequence,104);assert.ok(JSON.stringify(a.snapshot()).length<2500);const snapshot=a.snapshot();snapshot.events[0].kind='forged';assert.notEqual(a.snapshot().events[0].kind,'forged');
 for(const bad of [null,[],{pageInstanceId:'a',connectionEpoch:-1},{pageInstanceId:'a',connectionEpoch:0,token:'secret'},{pageInstanceId:'a',connectionEpoch:0,inputRevision:'bad'}])assert.throws(()=>a.snapshot(bad),/previous/);
});
test('semantic inspect detects page reset/input change without replaying jobs or mutating input',async()=>{
 const studio=createStudioApi();studio.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}));const before=JSON.stringify(studio.exportProject()),calls=[];
 const options={studio,analysis:{startJob:()=>calls.push('start'),cancelJob:()=>calls.push('cancel')},getResult:()=>null};
 const a=createBrowserSession({...options,lifecycle:createBrowserPageLifecycle({id:()=> 'a'})});a.connected();const original=await a.call('inspect');assert.equal(original.lifecycle.inputRevision,original.revision);assert.equal(original.lifecycle.ownedAnalysisJobs,0);
 const previousLifecycle={pageInstanceId:'a',connectionEpoch:1,inputRevision:original.revision};a.disconnect();a.connected();const same=await a.call('inspect',{previousLifecycle});assert.equal(same.lifecycle.relation,'same-page-reconnected');assert.equal(same.lifecycle.inputChanged,false);
 const b=createBrowserSession({...options,lifecycle:createBrowserPageLifecycle({id:()=> 'b'})});const reset=await b.call('inspect',{previousLifecycle});assert.equal(reset.lifecycle.relation,'page-reset');assert.equal(reset.lifecycle.automaticReplay,false);assert.deepEqual(calls,[]);assert.equal(JSON.stringify(studio.exportProject()),before);
 studio.setStudy({kind:'structural',gravityEnabled:true,gravity:[0,0,-9.8]});assert.equal((await b.call('inspect',{previousLifecycle})).lifecycle.inputChanged,true);
});
test('reset observation never recreates missing connection-owned jobs',async()=>{
 const studio=createStudioApi();studio.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}));let starts=0;
 const analysis={startJob:()=>{starts++;return {jobId:'old-job'};},getJob:()=>({state:'running'}),cancelJob:()=>{}};
 const a=createBrowserSession({studio,analysis,lifecycle:createBrowserPageLifecycle({id:()=> 'before'})}),first=await a.call('inspect');
 await a.call('startJob',{inputRevision:first.revision,requestId:'original-request'});assert.equal((await a.call('inspect')).lifecycle.ownedAnalysisJobs,1);
 const b=createBrowserSession({studio,analysis,lifecycle:createBrowserPageLifecycle({id:()=> 'after'})}),result=await b.call('inspect',{previousLifecycle:{pageInstanceId:'before',connectionEpoch:0,inputRevision:first.revision}});
 assert.equal(result.lifecycle.relation,'page-reset');assert.equal(result.lifecycle.ownedAnalysisJobs,0);assert.equal(result.lifecycle.automaticReplay,false);assert.equal(starts,1);
});

