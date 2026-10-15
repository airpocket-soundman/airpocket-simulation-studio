import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseBrowserConnection,createBrowserConnectionDiagnostics,parseBrowserConnectorEndpoint} from '../src/browser-connection-diagnostics.js';
import {browserConnectionDiagnosticMessage} from '../src/browser-connection-errors.js';
import {connectBrowserSession} from '../src/browser-session.js';

const health=()=>new Response(JSON.stringify({schemaVersion:1,kind:'airpocket-browser-bridge'}));
test('health diagnosis sends no credentials and marks only reachability with read-only permission status',async()=>{
 const queries=[],requests=[];
 const result=await diagnoseBrowserConnection('http://127.0.0.1:12345',{fetcher:async(url,options)=>{requests.push({url,options});return health();},permissions:{query:async query=>{queries.push(query.name);if(query.name==='loopback-network')throw TypeError('Unsupported');return {state:'denied'};}}});
 assert.deepEqual(queries,['loopback-network','local-network-access']);assert.equal(result.health,'reachable');assert.equal(result.permission.status,'denied');assert.equal(result.authenticated,false);
 assert.equal(requests[0].url,'http://127.0.0.1:12345/health');assert.equal(requests[0].options.targetAddressSpace,'loopback');assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.headers,undefined);assert.equal(requests[0].options.body,undefined);
 assert.match(browserConnectionDiagnosticMessage(result,'en'),/does not identify who denied/);assert.match(browserConnectionDiagnosticMessage(result),/認証やセッション接続の成功を示すものではありません/);
});
test('diagnostic endpoints are strict, bounded and do not expose arbitrary network errors',async()=>{
 for(const endpoint of ['https://127.0.0.1:1','http://localhost:1','http://127.1:1','http://2130706433:1','http://user:secret@127.0.0.1:1','http://127.0.0.1:1/path','http://127.0.0.1:1/?token=secret','http://127.0.0.1:0','http://127.0.0.1:65536']){assert.throws(()=>parseBrowserConnectorEndpoint(endpoint));const result=await diagnoseBrowserConnection(endpoint,{fetcher:()=>{throw Error('should not fetch');}});assert.equal(result.health,'invalid-endpoint');}
 const unavailable=await diagnoseBrowserConnection('http://127.0.0.1:1',{fetcher:async()=>{throw Error('secret arbitrary URL');},permissions:{query:async()=>{throw TypeError('unsupported');}}});assert.equal(unavailable.health,'unreachable');assert.equal(unavailable.permission.status,'unsupported');assert.ok(!JSON.stringify(unavailable).includes('secret'));
 for(const response of [new Response('x'.repeat(1025)),new Response('{"schemaVersion":1,"kind":"other"}'),new Response('{"schemaVersion":1,"kind":"airpocket-browser-bridge","token":"secret"}'),new Response('no',{status:403})])assert.equal((await diagnoseBrowserConnection('http://127.0.0.1:1',{fetcher:async()=>response})).health,'invalid-response');
});
test('network or permission hangs time out and superseded diagnoses cannot publish stale responses',async()=>{
 const timeout=await diagnoseBrowserConnection('http://127.0.0.1:1',{fetcher:()=>new Promise(()=>{}),timeoutMs:5});assert.equal(timeout.health,'timeout');
 const permissionTimeout=await diagnoseBrowserConnection('http://127.0.0.1:1',{fetcher:async()=>health(),permissions:{query:()=>new Promise(()=>{})},timeoutMs:5});assert.equal(permissionTimeout.health,'timeout');
 const controller=new AbortController();controller.abort();let calls=0;assert.equal((await diagnoseBrowserConnection('http://127.0.0.1:1',{signal:controller.signal,fetcher:()=>{calls++;}})).health,'expired');assert.equal(calls,0);
 const pending=[];const diagnostics=createBrowserConnectionDiagnostics({diagnose:(endpoint,{signal})=>new Promise(resolve=>pending.push({endpoint,signal,resolve}))});
 const first=diagnostics.run('old'),second=diagnostics.run('new');assert.equal(pending[0].signal.aborted,true);pending[1].resolve({health:'reachable'});assert.deepEqual(await second,{health:'reachable'});pending[0].resolve({health:'unreachable'});assert.equal(await first,null);
 const connecting=diagnostics.run('current');diagnostics.invalidate();pending[2].resolve({health:'reachable'});assert.equal(await connecting,null);
});
test('authenticated connector requests explicitly target loopback while preserving normal authorization',async()=>{
 const requests=[],session={disconnect(){},call(){}};
 const connection=connectBrowserSession({endpoint:'http://127.0.0.1:12345',pairingToken:'private-code',scopes:['inspect'],session,intervalMs:10000,fetcher:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.endsWith('/pair')?{token:'session-token',sessionId:'id'}:{commands:[]}};}});
 await connection.ready;connection.stop();await new Promise(resolve=>setImmediate(resolve));assert.ok(requests.length>=2);assert.ok(requests.every(({options})=>options.targetAddressSpace==='loopback'&&options.credentials==='omit'));assert.equal(requests[0].options.headers.Authorization,'Bearer private-code');
});
