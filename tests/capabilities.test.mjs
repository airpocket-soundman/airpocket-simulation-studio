import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getCapabilities,diagnoseExecution} from '../src/capabilities.js';
import {createStudioApi} from '../src/studio-api.js';
import {callStudioTool} from '../scripts/studio-mcp.mjs';
test('discovery separates host support, candidates and unavailable live MCP',async()=>{
 const node=await callStudioTool('studio_capabilities');
 const {runtime,...staticCapabilities}=node;assert.deepEqual(staticCapabilities,getCapabilities({target:'node'}));assert.equal(runtime.node,process.version);assert.equal(runtime.v8,process.versions.v8);assert.equal(runtime.platform,process.platform);assert.equal(runtime.arch,process.arch);
 assert.ok(!node.engines[0].methods.includes('webgpu-pcg'));
 assert.ok(createStudioApi().getCapabilities().engines[0].methods.includes('webgpu-pcg'));
 assert.equal(node.nativeMachineCode,false);assert.equal(node.operations.liveBrowserMcp,false);
 assert.equal(node.experimentalNativeFlow.fixedApprovedCaseOnly,true);assert.equal(node.experimentalNativeFlow.mcpIntegrated,false);assert.equal(node.experimentalNativeFlow.physicalAccuracyVerified,false);
 assert.ok(node.candidates.every(c=>!c.executable));
 node.engines[0].methods.push('bad');assert.ok(!getCapabilities().engines[0].methods.includes('bad'));
 assert.throws(()=>getCapabilities({target:'remote'}),/target/);
});
test('diagnostics distinguish valid engine choice from unsupported study and material combinations without mutating input',()=>{
 const p={study:{kind:'structural'},materialProperties:{orthotropic:{}}},before=structuredClone(p);
 assert.deepEqual(diagnoseExecution(p).diagnostics,[]);
 const result=diagnoseExecution(p,{method:'mfem-wasm'});
 assert.equal(result.completePreflight,false);assert.equal(result.diagnostics[0].code,'MATERIAL_COMBINATION_UNSUPPORTED');
 assert.equal(result.diagnostics[0].target,'materialProperties.orthotropic');assert.ok(result.diagnostics[0].suggestions.length);
 assert.deepEqual(p,before);
 assert.equal(diagnoseExecution({study:{kind:'thermal'}},{method:'mfem-wasm'}).diagnostics[0].code,'ENGINE_STUDY_UNSUPPORTED');
 assert.equal(diagnoseExecution(p,{method:'webgpu-pcg'},'node').diagnostics[0].code,'EXECUTION_METHOD_UNSUPPORTED');
 assert.equal(diagnoseExecution({study:{kind:'fluidDomain'}}).diagnostics[0].code,'DOMAIN_MESH_ONLY');
});
