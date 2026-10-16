import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {createProjectFromBuiltin} from '../src/project-import.js';

test('real Node thread and process record their executing build and actual package Gmsh bytes',async()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,1,1,2]}}),gmsh=await readFile(new URL(import.meta.resolve('@loumalouomega/gmsh-wasm/gmsh-core.wasm'))),kernel=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));
 const expected=bytes=>({bytes:bytes.length,sha256:'sha256:'+createHash('sha256').update(bytes).digest('hex')});
 for(const isolation of ['worker','process']){
  const output=await analyzeProject(project,{size:2,runtimeIdentity:{target:'browser',build:{revision:'forged'}}},'mesh',{isolation}),identity=output.calculation.runtimeIdentity;
  assert.equal(identity.target,'node');assert.equal(identity.isolation,isolation==='worker'?'worker-thread':'process');assert.equal(identity.build.status,'available');assert.match(identity.build.revision,/^[a-f0-9]{40}$/);assert.match(identity.build.sourceFingerprint,/^sha256:[a-f0-9]{64}$/);
  for(const [role,bytes]of [['gmsh',gmsh],['kernel',kernel]]){const asset=identity.assets.find(value=>value.role===role);assert.ok(asset);assert.deepEqual({bytes:asset.bytes,sha256:asset.sha256},expected(bytes));assert.equal(asset.status,'observed');}
  assert.equal(identity.assets.some(value=>value.role==='mfem'),false);assert.equal(output.runtimeIdentity,undefined);
 }
});

test('real MFEM calculation records the exact supplied public binary without inventing a native target',async()=>{
 const project=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,1,1,2]}});project.study={kind:'structural',gravityEnabled:false};project.materialProperties={youngModulus:1e9,poissonRatio:0};
 project.conditions=[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:project.meshes[0].faceIds.map((_,index)=>index)}]}];
 const output=await analyzeProject(project,{size:2,method:'mfem-wasm'}),identity=output.calculation.runtimeIdentity,bytes=await readFile(new URL('../public/mfem/mfem.wasm',import.meta.url)),mfem=identity.assets.find(value=>value.role==='mfem');
 assert.equal(identity.target,'node');assert.equal(identity.isolation,'worker-thread');assert.equal(identity.engine.requestedMethod,'mfem-wasm');assert.match(identity.engine.actualEngine,/MFEM.*WASM/);assert.ok(mfem);assert.equal(mfem.status,'observed');assert.equal(mfem.bytes,bytes.length);assert.equal(mfem.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));assert.equal(output.result.native.version,41000);
});
