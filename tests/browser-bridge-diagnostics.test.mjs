import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';

const origin='https://published.example';
test('health probe requires exact allowed origin and loopback Host but no credentials and reveals only fixed marker',async()=>{
 const bridge=await createBrowserBridge({origin});
 try{
  const health=await fetch(bridge.endpoint+'/health',{headers:{Origin:origin}});assert.equal(health.status,200);assert.deepEqual(await health.json(),{schemaVersion:1,kind:'airpocket-browser-bridge'});assert.equal(health.headers.get('access-control-allow-origin'),origin);assert.equal(health.headers.get('access-control-allow-private-network'),null);
  for(const headers of [{},{Origin:origin+'/'},{Origin:'https://unknown-origin.example'}])assert.equal((await fetch(bridge.endpoint+'/health',{headers})).status,403);
  const wrongHost=await new Promise((resolve,reject)=>{const req=request(bridge.endpoint+'/health',{headers:{Origin:origin,Host:'localhost'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});assert.equal(wrongHost,403);
  const preflight=await fetch(bridge.endpoint+'/health',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Private-Network':'true'}});assert.equal(preflight.status,200);assert.equal(preflight.headers.get('access-control-allow-private-network'),null);
  const diagnostics=bridge.diagnostics();assert.equal(diagnostics.counters.healthChecks,1);assert.equal(diagnostics.counters.originHostRefused,4);assert.equal(diagnostics.counters.preflights,1);assert.equal(diagnostics.counters.authRefused,0);assert.equal(diagnostics.sessionCount,0);
 }finally{await bridge.close();}
});

test('Origin/Host refusal is 403 without data; CORS only for the exact allowed Origin',async()=>{
 const bridge=await createBrowserBridge({origin});
 const raw=(headers)=>new Promise((resolve,reject)=>{const req=request(bridge.endpoint+'/health',{headers},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:b}));});req.on('error',reject);req.end();});
 try{
  const wrongOrigin=await fetch(bridge.endpoint+'/health',{headers:{Origin:'https://unknown-origin.example'}});assert.equal(wrongOrigin.status,403);assert.equal(wrongOrigin.headers.get('access-control-allow-origin'),null);
  const wrongHost=await raw({Origin:origin,Host:'localhost'});assert.equal(wrongHost.status,403);assert.equal(wrongHost.headers['access-control-allow-origin'],origin);assert.match(wrongHost.headers.vary,/Origin/);assert.equal(wrongHost.headers['access-control-allow-private-network'],undefined);assert.deepEqual(JSON.parse(wrongHost.body),{error:'Origin or host refused'});assert.equal(wrongHost.body.includes('airpocket-browser-bridge'),false);
  const ok=await fetch(bridge.endpoint+'/health',{headers:{Origin:origin}});assert.equal(ok.status,200);assert.equal(ok.headers.get('access-control-allow-origin'),origin);assert.deepEqual(await ok.json(),{schemaVersion:1,kind:'airpocket-browser-bridge'});
  assert.equal(bridge.diagnostics().counters.originHostRefused,2);
 }finally{await bridge.close();}
});

test('bounded bridge diagnostics contain detached counters and configured endpoints without incoming secrets or payloads',async()=>{
 let now=100;const bridge=await createBrowserBridge({origin,now:()=>now,ttlMs:1000,timeoutMs:10});
 const send=async(path,token,body)=>fetch(bridge.endpoint+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json','X-Incoming-Secret':'header-secret-value'},body:JSON.stringify(body)});
 try{
  assert.equal((await send('/pair','wrong-secret-value',{scopes:['inspect'],model:'model-secret-value'})).status,401);
  assert.equal((await send('/pair',bridge.pairingToken,{scopes:['bad-secret-value']})).status,400);
  const paired=await(await send('/pair',bridge.pairingToken,{scopes:['inspect']})).json();
  assert.equal((await send('/unknown-secret-route',paired.token,{model:'model-secret-value'})).status,404);
  await assert.rejects(bridge.call(paired.sessionId,'edit',{model:'model-secret-value'},'edit'),e=>e.code==='BROWSER_SCOPE_REFUSED');
  await assert.rejects(bridge.call(paired.sessionId,'inspect'),e=>e.code==='BROWSER_COMMAND_TIMEOUT');
  assert.equal((await send('/disconnect',paired.token,{})).status,200);assert.equal((await send('/poll',paired.token,{})).status,401);
  await send('/pair',bridge.pairingToken,{scopes:['inspect']});now+=1001;
  const diagnostics=bridge.diagnostics();assert.equal(diagnostics.origin,origin);assert.equal(diagnostics.endpoint,bridge.endpoint);assert.equal(diagnostics.sessionCount,0);
  assert.deepEqual(diagnostics.counters,{requests:7,preflights:0,healthChecks:0,pairSuccess:2,pairRefused:2,originHostRefused:0,authRefused:1,disconnects:1,expiredSessions:1,requestErrors:1,scopeRefused:1,commandTimeouts:1});
  const serialized=JSON.stringify(diagnostics);for(const value of [bridge.pairingToken,paired.token,paired.sessionId,'wrong-secret-value','model-secret-value','header-secret-value','bad-secret-value','unknown-secret-route'])assert.equal(serialized.includes(value),false,value);
  assert.ok(Buffer.byteLength(serialized)<4096);assert.ok(Object.values(diagnostics.counters).every(Number.isSafeInteger));diagnostics.counters.requests=-99;assert.equal(bridge.diagnostics().counters.requests,7);
 }finally{await bridge.close();}
});
