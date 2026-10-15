import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {BoxGeometry} from 'three';
import {solverAdapterKinds,legacyDefaultKind,getSolverAdapter,resolveSolverAdapter} from '../src/solver-adapters/index.js';
let sequence=0;
function box(bounds){const g=new BoxGeometry(...bounds.slice(3)).toNonIndexed();g.translate(...bounds.slice(0,3).map((v,k)=>v+bounds[k+3]/2));const positions=Array.from(g.attributes.position.array);g.dispose();return {positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))};}
const face=(mesh,z)=>mesh.positions.flatMap((_,i)=>i%9===0&&[2,5,8].every(k=>Math.abs(mesh.positions[i+k]-z)<1e-7)?[i/9]:[]),region=(mesh,triangles)=>({mesh,triangles});
async function run(project,options={},operation='elastic'){const previousSelf=globalThis.self,previousFetch=globalThis.fetch,messages=[],base=new URL('./fixtures/worker/',import.meta.url).href;globalThis.self={postMessage:data=>messages.push(data)};globalThis.fetch=async url=>{if(url===base+'fem-kernel.wasm'){const bytes=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}throw Error('Unexpected worker fetch '+url);};try{await import(new URL('../src/analysis.worker.js',import.meta.url).href+'?registry='+sequence++);await globalThis.self.onmessage({data:{operation,project:structuredClone(project),source:project.sourceModel,options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options},base}});return messages.findLast(m=>m.result||m.error);}finally{if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;globalThis.fetch=previousFetch;}}
const strip=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='performance'?undefined:x));
const m=box([0,0,0,10,10,40]),src={kind:'box',bounds:[0,0,0,10,10,40]};
const structural={version:1,sourceModel:src,study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0},meshes:[m],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'force',value:100,direction:[0,0,1],regions:[region(0,face(m,40))]}]};
const thermal={version:1,sourceModel:src,study:{kind:'thermal'},materialProperties:{conductivity:2},meshes:[m],conditions:[{type:'temperature',value:100,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'temperature',value:20,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const acoustic={version:1,sourceModel:src,study:{kind:'acoustic',frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0},meshes:[m],conditions:[{type:'acousticPressure',value:1,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'acousticPressure',value:0,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
test('registry serves exactly the migrated disciplines and falls back to structural',()=>{
 assert.deepEqual([...solverAdapterKinds].sort(),['acoustic','channelFlow','creepingFlow','structural','thermal']);
 assert.equal(legacyDefaultKind,'structural');
 for(const kind of solverAdapterKinds){const a=getSolverAdapter(kind);assert.equal(a.kind,kind);assert.equal(typeof a.execute,'function');assert.equal(typeof a.progressMessage,'string');assert.equal(resolveSolverAdapter({kind}),a);}
 assert.equal(getSolverAdapter('nonexistent'),undefined);
 for(const study of [undefined,null,{},{kind:'nonexistent'}])assert.equal(resolveSolverAdapter(study),getSolverAdapter('structural'));
 assert.equal(getSolverAdapter('thermal').progressMessage,'Solving heat conduction…');
});
test('worker results are produced through the registry adapters with unchanged payloads',async()=>{
 const s=await run(structural),t=await run(thermal),a=await run(acoustic,{size:3});
 for(const r of [s,t,a])assert.equal(r.error,undefined);
 assert.equal(s.result.result.kind,'elastic');assert.ok(Math.abs(s.result.result.maxDisplacementMm-.04)<1e-7);assert.ok(Math.abs(s.result.result.reaction[2]+100)<1e-5);
 assert.ok(Math.abs(t.result.result.minTemperature-20)<1e-5);assert.ok(Math.abs(t.result.result.maxTemperature-100)<1e-5);
 assert.equal(a.result.result.kind,'acoustic');
 assert.equal(typeof s.result.result.performance.solveMs,'number');
});
test('operation names are not rejected by the worker: only mesh is special, everything else solves (pre-change behavior)',async()=>{
 const elastic=await run(structural),bogus=await run(structural,{},'bogus-operation');
 assert.equal(bogus.error,undefined);assert.deepEqual(strip(bogus),strip(elastic));
 const mesh=await run(structural,{},'mesh');assert.equal(mesh.error,undefined);assert.ok(mesh.result.mesh&&!mesh.result.result);
});
test('rejections that precede dispatch keep their exact messages',async()=>{
 assert.equal((await run({...thermal,study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0}})).error,'Remove boundary conditions belonging to the other discipline or use the matching example');
 assert.equal((await run(thermal,{adaptive:true})).error,'Adaptive refinement currently supports structural analysis only');
 assert.equal((await run(structural,{fractureAssessment:{}})).error,'Fracture assessment requires registered toughness and surface data');
 assert.match((await run(thermal,{method:'mfem-wasm'})).error,/^WebGPU and MFEM currently support structural analysis only$/);
});
