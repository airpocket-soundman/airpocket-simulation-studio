import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,browserMethods,connectBrowserSession} from '../src/browser-session.js';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';

const routes={namedViewList:'list',namedViewExport:'export',namedViewSave:'save',namedViewApply:'apply',namedViewRemove:'remove',namedViewImport:'import'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('named view methods expose inspect and view scopes and route only explicit semantic services',async()=>{
 const calls=[];const namedViews=Object.fromEntries(Object.values(routes).map(name=>[name,(...args)=>{calls.push({name,args});return {method:name};}]));
 const session=createBrowserSession({namedViews});
 for(const [method,name]of Object.entries(routes)){
  const args={marker:method};assert.deepEqual(await session.call(method,args),{method:name});const call=calls.at(-1);assert.equal(call.name,name);
  assert.equal(browserMethods[method],['list','export'].includes(name)?'inspect':'view');
  if(['list','export'].includes(name))assert.equal(call.args.length,0);
  else{assert.equal(call.args[0],args);assert.equal(call.args[1].guard(),true);}
 }
 for(const method of ['namedViewConstructor','namedView__proto__','constructor','__proto__','toString'])await assert.rejects(session.call(method),/Unknown browser method/);
 assert.equal(calls.length,6);
});

for(const method of ['namedViewApply','namedViewImport'])test(`${method} passes a private guard that rejects revocation and serializes mutations`,async()=>{
 const entered=deferred(),resume=deferred();let committed=0;const operation=routes[method];
 const service={[operation]:async(args,{guard})=>{entered.resolve();await resume.promise;if(!guard())throw Error('Command revoked');committed++;return {ok:true};},list:()=>({views:[]})};
 const session=createBrowserSession({namedViews:service,view:{get:()=>({}),set:()=>{}}});
 const pending=session.call(method,{value:1,guard:true});await entered.promise;
 await assert.rejects(session.call(method,{}),/busy/);await assert.rejects(session.call('setView',{}),/busy/);
 assert.deepEqual(await session.call('namedViewList'),{views:[]});session.disconnect();resume.resolve();await assert.rejects(pending,/revoked/);assert.equal(committed,0);
 service[operation]=async(_args,{guard})=>{assert.equal(guard(),true);committed++;return {ok:true};};
 assert.deepEqual(await session.call(method,{}),{ok:true});assert.equal(committed,1);
});

test('named view expiration and busy checks prevent commits and release the mutation lock on failure',async()=>{
 let busy=true,calls=0;const session=createBrowserSession({isBusy:()=>busy,namedViews:{apply:async()=>{calls++;throw Error('Service rejected');},list:()=>({views:[]})}});
 await assert.rejects(session.call('namedViewApply'),/busy/);assert.equal(calls,0);assert.deepEqual(await session.call('namedViewList'),{views:[]});busy=false;
 await assert.rejects(session.call('namedViewApply',{}, {expiresAt:Date.now()-1}),/expired/);assert.equal(calls,0);
 await assert.rejects(session.call('namedViewApply'),/Service rejected/);await assert.rejects(session.call('namedViewApply'),/Service rejected/);assert.equal(calls,2);
});

test('real polling connection allows inspect-only named view observations and rejects view mutations',async t=>{
 const origin='http://127.0.0.1:5174';const bridge=await createBrowserBridge({origin,timeoutMs:2000});t.after(()=>bridge.close());const calls=[];
 const session=createBrowserSession({namedViews:{list:()=>{calls.push('list');return {views:[]};},export:()=>({version:1,views:[]}),save:()=>{calls.push('save');return {};}}});
 const client=connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes:['inspect'],session,intervalMs:2,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}})});t.after(()=>client.stop());const {sessionId}=await client.ready;
 assert.deepEqual(await bridge.call(sessionId,'namedViewList',{},'inspect'),{views:[]});assert.deepEqual(await bridge.call(sessionId,'namedViewExport',{},'inspect'),{version:1,views:[]});
 // Deliberately understate the bridge scope to prove the browser independently checks its actual method map.
 await assert.rejects(bridge.call(sessionId,'namedViewSave',{},'inspect'),/scope refused/);assert.deepEqual(calls,['list']);
});


test('pending named view import receives a guard that becomes false after its deadline',async t=>{
 let now=100; t.mock.method(Date,'now',()=>now);const entered=deferred(),resume=deferred();let committed=false;
 const session=createBrowserSession({namedViews:{import:async(_args,{guard})=>{entered.resolve();await resume.promise;if(!guard())throw Error('Command expired');committed=true;}}});
 const pending=session.call('namedViewImport',{}, {expiresAt:200});await entered.promise;now=200;resume.resolve();await assert.rejects(pending,/expired/);assert.equal(committed,false);
});
