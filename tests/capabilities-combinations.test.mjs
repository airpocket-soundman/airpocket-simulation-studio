import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getCapabilities} from '../src/capabilities.js';
import {executionCombinationRules} from '../src/execution-combination-rules.js';
import {createStudioApi} from '../src/studio-api.js';
import {callStudioTool} from '../scripts/studio-mcp.mjs';
const bytes=v=>Buffer.byteLength(JSON.stringify(v));
test('capabilities.combinations lists every shared rule exactly once with its code and message',()=>{
 for(const target of ['browser','node']){
  const {combinations}=getCapabilities({target});
  assert.equal(combinations.length,executionCombinationRules.length);
  for(const rule of executionCombinationRules){
   const hits=combinations.filter(c=>c.id===rule.id);assert.equal(hits.length,1,rule.id);
   assert.equal(hits[0].code,rule.code);assert.equal(hits[0].phase,rule.phase);assert.equal(hits[0].summary,rule.message);assert.equal(hits[0].status,'unsupported');
   assert.ok(Array.isArray(hits[0].applies.physics)&&hits[0].applies.physics.length&&Array.isArray(hits[0].applies.features)&&hits[0].applies.features.length);
  }
  assert.equal(new Set(combinations.map(c=>c.id)).size,combinations.length);
 }
});
test('combinations stay bounded and do not alias the rule table',()=>{
 const caps=getCapabilities({target:'node'});
 assert.ok(caps.combinations.length<=16);assert.ok(bytes(caps.combinations)<=4096);assert.ok(bytes(caps.combinations)<=0.05*bytes(caps));
 caps.combinations[0].applies.physics.push('bad');caps.combinations[0].summary='bad';
 assert.ok(!getCapabilities({target:'node'}).combinations[0].applies.physics.includes('bad'));assert.equal(executionCombinationRules[0].scope.physics.includes('bad'),false);
 for(const key of ['engines','operations','preflight','units','candidates'])assert.ok(key in caps,key);
});
test('browser API and MCP entry points return the same combinations field',async()=>{
 const node=await callStudioTool('studio_capabilities');
 assert.deepEqual(node.combinations,getCapabilities({target:'node'}).combinations);
 assert.deepEqual(createStudioApi().getCapabilities().combinations,getCapabilities({target:'browser'}).combinations);
 assert.deepEqual(node.combinations,createStudioApi().getCapabilities().combinations);
});
