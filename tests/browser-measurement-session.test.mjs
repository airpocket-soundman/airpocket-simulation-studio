import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserMethods,createBrowserSession,connectBrowserSession} from '../src/browser-session.js';
test('measurement routes preserve arguments, read/edit scopes and private guards',async()=>{
 const calls=[],measurements=Object.fromEntries(['list','get','exportArchive','save','remove','importArchive'].map(method=>[method,async(args,options)=>{calls.push({method,args,guard:options?.guard});return {method};}])),session=createBrowserSession({measurements}),args={reference:'test'};
 for(const [method,operation,scope]of [['measurementList','list','inspect'],['measurementGet','get','inspect'],['measurementExport','exportArchive','inspect'],['measurementSave','save','edit'],['measurementRemove','remove','edit'],['measurementImport','importArchive','edit']]){
  assert.equal((await session.call(method,args)).method,operation);assert.equal(calls.at(-1).args,args);assert.equal(browserMethods[method],scope);if(scope==='edit')assert.equal(calls.at(-1).guard(),true);
 }
});
test('measurement mutations reject busy/concurrent operations and revoked or expired commits',async()=>{
 let busy=true,resume,committed=false;const session=createBrowserSession({isBusy:()=>busy,measurements:{save:async(args,{guard})=>{await new Promise(resolve=>{resume=resolve;});if(!guard())throw Error('expired');committed=true;},remove:()=>{},importArchive:()=>{}}});
 for(const method of ['measurementSave','measurementRemove','measurementImport'])await assert.rejects(session.call(method,{}),/busy/);busy=false;const saving=session.call('measurementSave',{});await assert.rejects(session.call('measurementRemove',{}),/busy/);session.disconnect();resume();await assert.rejects(saving,/expired/);assert.equal(committed,false);await assert.rejects(session.call('measurementSave',{}, {expiresAt:Date.now()-1}),/expired/);
 const missing=createBrowserSession({});for(const method of ['measurementList','measurementGet','measurementExport','measurementSave','measurementRemove','measurementImport'])await assert.rejects(missing.call(method,{}),/unavailable/);
});
test('measurement inspect-only polling refuses all three writes before invoking the host',async()=>{
 let called=0,finish;const done=new Promise(resolve=>{finish=resolve;}),session=createBrowserSession({measurements:{save:()=>called++,remove:()=>called++,importArchive:()=>called++}});
 const fetcher=async(url,options)=>{if(url.endsWith('/pair'))return {ok:true,json:async()=>({token:'token',sessionId:'session'})};if(url.endsWith('/poll'))return {ok:true,json:async()=>({commands:['measurementSave','measurementRemove','measurementImport'].map(method=>({id:method,method,args:{},expiresAt:Date.now()+5000}))})};if(url.endsWith('/reply')){const reply=JSON.parse(options.body);assert.match(reply.error.message,/scope refused/);if(reply.id==='measurementImport')finish();}return {ok:true,json:async()=>({})};};
 const connection=connectBrowserSession({endpoint:'http://127.0.0.1:60000',pairingToken:'pair',scopes:['inspect'],session,fetcher});try{await connection.ready;await done;assert.equal(called,0);}finally{connection.stop();}
});
test('measurement reads do not return a delayed response after connection revocation',async()=>{
 let resume;const session=createBrowserSession({measurements:{exportArchive:async()=>{await new Promise(resolve=>{resume=resolve;});return {archive:{version:1,measurements:[]}};}}});const pending=session.call('measurementExport');session.disconnect();resume();await assert.rejects(pending,/expired/);
});
