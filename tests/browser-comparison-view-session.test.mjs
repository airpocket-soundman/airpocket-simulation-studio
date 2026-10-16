import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods,connectBrowserSession} from '../src/browser-session.js';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';
import {getCapabilities} from '../src/capabilities.js';
const revision='sha256:'+'a'.repeat(64),response=()=>({schemaVersion:1,revision,archive:null,reason:'Choose two saved cases'});
const command=()=>({expectedRevision:revision,archive:{version:1,kind:'comparison-view',sources:[{revision},{revision:'sha256:'+'b'.repeat(64)}],settings:{field:'temperature'}}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('comparison view routes expose read-only null preset and guarded exact-CAS panel updates',async()=>{
 const calls=[],comparisonViews={get:()=>{calls.push('get');return response();},set:(args,{guard})=>{assert.equal(guard(),true);calls.push(args);return {...response(),archive:args.archive};}},session=createBrowserSession({comparisonViews});
 assert.equal(browserMethods.getCompareView,'inspect');assert.equal(browserMethods.setCompareView,'view');assert.deepEqual(await session.call('getCompareView'),response());const args=command();assert.deepEqual(await session.call('setCompareView',args),{...response(),archive:args.archive});assert.deepEqual(calls[1],args);
 for(const args of [{unknown:true},{archive:{}},{...command(),expectedRevision:'stale'},{...command(),guard:true}])await assert.rejects(session.call(Object.hasOwn(args,'unknown')?'getCompareView':'setCompareView',args));assert.equal(calls.length,2);let invoked=false;const accessor={archive:{},get expectedRevision(){invoked=true;return revision;}};await assert.rejects(session.call('setCompareView',accessor));assert.equal(invoked,false);
 await assert.rejects(createBrowserSession({}).call('getCompareView'),/unavailable/);await assert.rejects(createBrowserSession({}).call('setCompareView',command()),/unavailable/);
});

test('comparison view private guards reject disconnect, lock concurrent mutation, and preserve inspect access',async()=>{
 const entered=deferred(),resume=deferred();let commits=0;const session=createBrowserSession({comparisonViews:{get:response,set:async(_args,{guard})=>{entered.resolve();await resume.promise;if(!guard())throw Error('Comparison command revoked');commits++;return response();}},view:{set:()=>{throw Error('Must not update main viewer');}}});
 const pending=session.call('setCompareView',command());await entered.promise;await assert.rejects(session.call('setCompareView',command()),/busy/);await assert.rejects(session.call('setView',{}),/busy/);assert.deepEqual(await session.call('getCompareView'),response());session.disconnect();resume.resolve();await assert.rejects(pending,/revoked/);assert.equal(commits,0);
 let busy=true;const unavailable=createBrowserSession({isBusy:()=>busy,comparisonViews:{get:response,set:()=>{throw Error('Host validation failed');}}});assert.deepEqual(await unavailable.call('getCompareView'),response());await assert.rejects(unavailable.call('setCompareView',command()),/busy/);busy=false;await assert.rejects(unavailable.call('setCompareView',command()),/Host validation/);await assert.rejects(unavailable.call('setCompareView',command()),/Host validation/);
});

test('comparison inspections reject delayed replies after connection revocation',async()=>{
 const resume=deferred(),session=createBrowserSession({comparisonViews:{get:()=>resume.promise}}),pending=session.call('getCompareView');session.disconnect();resume.resolve(response());await assert.rejects(pending,/expired/);
});

test('real inspect-only polling permits reading comparison settings and independently refuses writes',async t=>{
 const origin='https://comparison-presets.example',bridge=await createBrowserBridge({origin,timeoutMs:2000});t.after(()=>bridge.close());let writes=0;const session=createBrowserSession({comparisonViews:{get:response,set:()=>{writes++;return response();}}}),client=connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes:['inspect'],session,intervalMs:2,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}})});t.after(()=>client.stop());const {sessionId}=await client.ready;
 assert.deepEqual(await bridge.call(sessionId,'getCompareView',{},'inspect'),response());await assert.rejects(bridge.call(sessionId,'setCompareView',command(),'inspect'),/scope refused/);assert.equal(writes,0);
});

test('comparison preset discovery declares exact CAS, panel-only effects and runtime portable validation',()=>{
 const get=getBrowserOperationContracts({method:'getCompareView'}).operations[0],set=getBrowserOperationContracts({method:'setCompareView'}).operations[0];assert.equal(get.scope,'inspect');assert.equal(get.inputSchema.additionalProperties,false);assert.deepEqual(get.sideEffects,[]);assert.ok(get.limitations.some(x=>x.includes('archive:null')));assert.equal(set.scope,'view');assert.deepEqual(set.inputSchema.required,['archive','expectedRevision']);assert.equal(set.inputSchema.additionalProperties,false);assert.deepEqual(set.revisionFields,['expectedRevision']);assert.ok(set.sideEffects.some(x=>x.includes('main viewer')));assert.equal(getCapabilities().connector.comparisonViews,true);
});
