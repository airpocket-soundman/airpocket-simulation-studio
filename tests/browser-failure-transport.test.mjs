import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';
import {connectBrowserSession} from '../src/browser-session.js';
import {analysisError,createAnalysisFailure,getAnalysisFailure} from '../src/analysis-failure.js';
const origin='http://127.0.0.1:5174';
test('HTTP bridge validates failure payloads independently of the polling client and preserves legacy codes',async t=>{
 const bridge=await createBrowserBridge({origin,timeoutMs:2000});t.after(()=>bridge.close());
 const request=async(path,token,body)=>{const response=await fetch(bridge.endpoint+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,200);return response.json();};
 const paired=await request('/pair',bridge.pairingToken,{scopes:['inspect']}),failure=createAnalysisFailure(analysisError('ANALYSIS_CONSTRAINT_CONFLICT','original message',{stage:'constraints',evidence:{nodeIndex:2},target:'/conditions'}));
 for(const [candidate,valid]of [[{...failure,stack:'not allowed'},false],[{...failure,diagnostics:[]},false],[failure,true]]){
  const pending=bridge.call(paired.sessionId,'inspect').catch(error=>error),command=(await request('/poll',paired.token)).commands[0];await request('/reply',paired.token,{id:command.id,error:{message:'legacy text',code:'JOB_CANCELLED',failure:candidate}});const error=await pending;assert.equal(error.message,'legacy text');assert.equal(error.code,'JOB_CANCELLED');assert.deepEqual(getAnalysisFailure(error),valid?failure:null);assert.ok(!Object.hasOwn(error,'cause'));
 }
 const pending=bridge.call(paired.sessionId,'inspect'),command=(await request('/poll',paired.token)).commands[0];await request('/reply',paired.token,{id:command.id,value:{stillConnected:true}});assert.deepEqual(await pending,{stillConnected:true});
});
test('polling client drops malformed metadata without invoking accessors or losing the next command',async t=>{
 const bridge=await createBrowserBridge({origin,timeoutMs:2000});t.after(()=>bridge.close());let called=0,read=false;
 const error=new Error('legacy rejection');error.code='CUSTOM_REJECTION';Object.defineProperty(error,'analysisFailure',{get(){read=true;throw Error('getter must not run');}});
 const connection=connectBrowserSession({...bridge,scopes:['inspect'],session:{call(){if(!called++)throw error;return {ok:true};},disconnect(){}},fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}}),intervalMs:2});t.after(()=>connection.stop());const {sessionId}=await connection.ready;
 await assert.rejects(bridge.call(sessionId,'inspect'),error=>{assert.equal(error.message,'legacy rejection');assert.equal(error.code,'CUSTOM_REJECTION');assert.equal(getAnalysisFailure(error),null);return true;});assert.equal(read,false);assert.deepEqual(await bridge.call(sessionId,'inspect'),{ok:true});
});
