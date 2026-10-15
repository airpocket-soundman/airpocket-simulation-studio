import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createAnalysisClient} from '../src/analysis-client.js';
import {createRuntimeIdentity} from '../src/runtime-identity.js';

const build={status:'available',version:'test',revision:'a'.repeat(40),dirty:false,sourceFingerprint:'sha256:'+'b'.repeat(64)};
const input=()=>({version:1,sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:0},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]});
test('worker hashes the same supplied kernel/Gmsh bytes it uses and ignores request identity claims',async()=>{
 const previous=globalThis.self,messages=[],reads=[];
 globalThis.self={postMessage:data=>messages.push(data)};
 try{
  const worker=await import('../src/analysis.worker.js?runtime-identity');
  worker.configureAnalysisWorkerRuntime({target:'browser',isolation:'web-worker',buildIdentity:build,readAssetBytes:async role=>{reads.push(role);return new Uint8Array(await readFile(role==='gmsh'?new URL(import.meta.resolve('@loumalouomega/gmsh-wasm/gmsh-core.wasm')):new URL('../public/fem-kernel.wasm',import.meta.url)));}});
  const project=input();await self.onmessage({data:{operation:'mesh',project,source:project.sourceModel,base:new URL('./fixtures/worker/',import.meta.url).href,options:{method:'wasm-pcg',size:1,runtimeIdentity:{build:{revision:'forged'}}},runtimeIdentity:{target:'node'}}});
  const terminal=messages.findLast(message=>message.result||message.error);assert.equal(terminal.error,undefined);const identity=terminal.result.runtimeIdentity;
  assert.equal(identity.target,'browser');assert.equal(identity.isolation,'web-worker');assert.deepEqual(identity.build,build);assert.equal(identity.engine.requestedMethod,'wasm-pcg');assert.equal(identity.engine.actualEngine,null);assert.deepEqual(reads,['kernel','gmsh']);
  for(const asset of identity.assets){const bytes=await readFile(asset.role==='gmsh'?new URL(import.meta.resolve('@loumalouomega/gmsh-wasm/gmsh-core.wasm')):new URL('../public/fem-kernel.wasm',import.meta.url));assert.equal(asset.bytes,bytes.length);assert.equal(asset.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));assert.equal(asset.status,'observed');}
  assert.throws(()=>worker.configureAnalysisWorkerRuntime({}),/late/);
 }finally{if(previous===undefined)delete globalThis.self;else globalThis.self=previous;}
});

test('browser host saves worker identity once in calculation and preserves actual fallback engine',async()=>{
 const workers=[],api=createAnalysisClient(input,()=>{},{isIsolated:()=>true,baseUrl:()=>'/fixture/',createWorker:()=>{const worker={postMessage(){},terminate(){}};workers.push(worker);return worker;}});
 const identity=createRuntimeIdentity({target:'browser',isolation:'web-worker',build,requestedMethod:'webgpu-pcg',actualEngine:'Airpocket Tet4 / WASM CPU fallback'});
 const promise=api.generateMesh({runtimeIdentity:{forged:true}});workers[0].onmessage({data:{result:{mesh:{},runtimeIdentity:identity}}});const result=await promise;
 assert.deepEqual(result.calculation.runtimeIdentity,identity);assert.equal(result.runtimeIdentity,undefined);identity.build.revision='c'.repeat(40);assert.equal(result.calculation.runtimeIdentity.build.revision,build.revision);
 const bad=api.generateMesh();workers[1].onmessage({data:{result:{runtimeIdentity:{schemaVersion:999}}}});await assert.rejects(bad);assert.equal(api.isBusy(),false);
 const wrong=api.generateMesh();workers[2].onmessage({data:{result:{runtimeIdentity:createRuntimeIdentity({target:'node',isolation:'process'})}}});await assert.rejects(wrong,/host mismatch/);
 const legacy=api.generateMesh();workers[3].onmessage({data:{result:{mesh:{}}}});assert.equal((await legacy).calculation.runtimeIdentity,undefined);
});

test('host-private identity configuration accepts actual Node metadata and cannot be overridden by input or solver options',async()=>{
 const workers=[],host={target:'node',isolation:'worker-thread'},project={...input(),identityHost:{target:'browser',isolation:'web-worker'}};
 const api=createAnalysisClient(()=>project,()=>{},{identityHost:host,isIsolated:()=>true,baseUrl:()=>'/fixture/',createWorker:()=>{const worker={postMessage(){},terminate(){}};workers.push(worker);return worker;}});
 host.target='browser';host.isolation='web-worker';
 const nodeIdentity=createRuntimeIdentity({target:'node',isolation:'worker-thread',build});
 const accepted=api.generateMesh({identityHost:{target:'browser',isolation:'web-worker'},runtimeIdentity:{target:'browser'}});
 workers[0].onmessage({data:{result:{mesh:{},runtimeIdentity:nodeIdentity}}});
 assert.deepEqual((await accepted).calculation.runtimeIdentity,nodeIdentity);
 const forged=api.generateMesh({identityHost:{target:'browser',isolation:'web-worker'}});
 workers[1].onmessage({data:{result:{runtimeIdentity:createRuntimeIdentity({target:'browser',isolation:'web-worker'})}}});
 await assert.rejects(forged,/host mismatch/);
 await assert.rejects(api.generateMesh({method:'webgpu-pcg',identityHost:{target:'browser',isolation:'web-worker'}}),error=>error.code==='ANALYSIS_PREFLIGHT_FAILED');assert.equal(workers.length,2);
 for(const identityHost of [null,undefined,[],{}, {target:'node',isolation:'web-worker'},{target:'browser',isolation:'process'},{target:'node',isolation:'worker-thread',extra:true}])assert.throws(()=>createAnalysisClient(input,()=>{},{identityHost}));
 let read=false;const accessor={get target(){read=true;return 'node';},isolation:'worker-thread'};assert.throws(()=>createAnalysisClient(input,()=>{},{identityHost:accessor}));assert.equal(read,false);
 assert.throws(()=>createAnalysisClient(input,()=>{},{get identityHost(){read=true;return {target:'node',isolation:'process'};}}));assert.equal(read,false);
});
