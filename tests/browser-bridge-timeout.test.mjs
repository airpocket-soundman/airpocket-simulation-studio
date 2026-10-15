import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';

const origin='https://published.example';
test('command timeout reports delivered:false when never polled and delivered:true when polled without reply; retry succeeds',async()=>{
 const bridge=await createBrowserBridge({origin,timeoutMs:50});
 const post=(path,token,body)=>fetch(bridge.endpoint+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const paired=await(await post('/pair',bridge.pairingToken,{scopes:['inspect']})).json();
  const poll=()=>fetch(bridge.endpoint+'/poll',{headers:{Origin:origin,Authorization:'Bearer '+paired.token}}).then(r=>r.json());
  const notDelivered=await bridge.call(paired.sessionId,'inspect').then(()=>null,e=>e);
  assert.equal(notDelivered.code,'BROWSER_COMMAND_TIMEOUT');assert.equal(notDelivered.message,'Browser command timed out; inspect state before retrying');assert.equal(notDelivered.delivered,false);
  const pending=bridge.call(paired.sessionId,'inspect').then(()=>null,e=>e);
  const {commands}=await poll();assert.equal(commands.length,1);
  const delivered=await pending;
  assert.equal(delivered.code,'BROWSER_COMMAND_TIMEOUT');assert.equal(delivered.message,notDelivered.message);assert.equal(delivered.delivered,true);
  assert.equal(bridge.diagnostics().counters.commandTimeouts,2);
  const retry=bridge.call(paired.sessionId,'inspect');
  const next=(await poll()).commands[0];assert.equal(next.method,'inspect');
  assert.equal((await post('/reply',paired.token,{id:next.id,value:{ok:true}})).status,200);
  assert.deepEqual(await retry,{ok:true});assert.equal(bridge.diagnostics().counters.commandTimeouts,2);
 }finally{await bridge.close();}
});
