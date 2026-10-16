import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserMethods,connectBrowserSession,createBrowserSession} from '../src/browser-session.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';
import {checkGpuEnvironment} from '../src/gpu-environment.js';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';

function gpu(info){let destroyed=0;return {gpu:{requestAdapter:async options=>{assert.deepEqual(options,{powerPreference:'high-performance'});return {info,requestDevice:async()=>({limits:{maxStorageBufferBindingSize:65536},destroy(){destroyed++;}})};}},destroyed:()=>destroyed};}

test('inspect GPU declaration is distinct from real browser observation and probing preserves input/result',async()=>{
 const input={version:1,study:{kind:'structural'},meshes:[{positions:[0,0,0]}]},display={result:{kind:'elastic',displacement:[1,2,3]}},beforeInput=structuredClone(input),beforeDisplay=structuredClone(display),device=gpu({description:'Test adapter',isFallbackAdapter:false});
 const session=createBrowserSession({studio:{exportProject:()=>input,loadProject:()=>{}},getResult:()=>display,analysis:{checkGpuEnvironment:()=>checkGpuEnvironment(device.gpu)}}),contract=getBrowserOperationContracts({method:'checkGpuEnvironment'}).operations[0];
 assert.equal(browserMethods.checkGpuEnvironment,'inspect');assert.equal(contract.scope,'inspect');assert.deepEqual(contract.inputSchema.required,[]);assert.equal(contract.inputSchema.additionalProperties,false);assert.deepEqual(contract.sideEffects,[]);
 const result=await session.call('checkGpuEnvironment',{});
 assert.deepEqual(result,{schemaVersion:1,target:'browser',declaredCapability:{operation:'checkGpuEnvironment',declarationOnly:true},observation:{available:true,description:'Test adapter',isFallbackAdapter:false,maxStorageBufferBindingSize:65536}});
 assert.deepEqual(input,beforeInput);assert.deepEqual(display,beforeDisplay);assert.equal(device.destroyed(),1);
});

test('GPU inspection reports missing WebGPU, missing adapter, software fallback and actual device while always destroying devices',async()=>{
 const unavailable=await checkGpuEnvironment(null);assert.deepEqual(unavailable,{available:false,reason:'WebGPU API unavailable'});
 assert.deepEqual(await checkGpuEnvironment({requestAdapter:async()=>null}),{available:false,reason:'No WebGPU adapter'});
 for(const isFallbackAdapter of [true,false]){const device=gpu({vendor:'mock',isFallbackAdapter});const session=createBrowserSession({analysis:{checkGpuEnvironment:()=>checkGpuEnvironment(device.gpu)}}),result=await session.call('checkGpuEnvironment');assert.equal(result.target,'browser');assert.equal(result.observation.available,true);assert.equal(result.observation.isFallbackAdapter,isFallbackAdapter);assert.equal(device.destroyed(),1);}
});

test('GPU inspection rejects arguments and unavailable adapter APIs without invoking anything',async()=>{
 let called=0;const session=createBrowserSession({analysis:{checkGpuEnvironment:async()=>{called++;return {available:false,reason:'unavailable'};}}});
 await assert.rejects(session.call('checkGpuEnvironment',{unknown:true}),/takes no arguments/);assert.equal(called,0);
 await assert.rejects(createBrowserSession({}).call('checkGpuEnvironment',{}),/unavailable/);
});

test('GPU inspection is granted to inspect scope and refused to view-only scope',async()=>{
 const origin='https://gpu-inspection.example',bridge=await createBrowserBridge({origin}),session=createBrowserSession({analysis:{checkGpuEnvironment:async()=>({available:false,reason:'WebGPU API unavailable'})}});let client;
 try{
  const connect=scopes=>connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes,session,intervalMs:2,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}})});
  client=connect(['view']);const view=await client.ready;await assert.rejects(bridge.call(view.sessionId,'checkGpuEnvironment',{},browserMethods.checkGpuEnvironment),error=>error.code==='BROWSER_SCOPE_REFUSED');client.stop();
  client=connect(['inspect']);const inspect=await client.ready,result=await bridge.call(inspect.sessionId,'checkGpuEnvironment',{},browserMethods.checkGpuEnvironment);assert.equal(result.target,'browser');assert.equal(result.observation.available,false);
 }finally{client?.stop();session.disconnect();await bridge.close();}
});

test('expired and revoked GPU inspection responses are rejected after the asynchronous device probe',async()=>{
 let resume,calls=0;const pendingProbe=new Promise(resolve=>{resume=resolve;}),session=createBrowserSession({analysis:{checkGpuEnvironment:()=>{calls++;return pendingProbe;}}});
 await assert.rejects(session.call('checkGpuEnvironment',{}, {expiresAt:Date.now()-1}),/expired/);assert.equal(calls,0);
 const pending=session.call('checkGpuEnvironment');await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);session.disconnect();resume({available:true,description:'late'});await assert.rejects(pending,/expired|changed/i);
});

test('the live page wires checkGpuEnvironment into the analysis object handed to the browser session',async()=>{
 // Found in real Chrome: the connector answered "Browser GPU environment inspection unavailable" because only window.analysisApi (a copy) had the function.
 const {readFile}=await import('node:fs/promises');const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/analysis.checkGpuEnvironment=checkGpuEnvironment/);
 assert.ok(main.indexOf('analysis.checkGpuEnvironment=checkGpuEnvironment')<main.indexOf('installBrowserSession({'),'wiring must precede the session installation');
});
