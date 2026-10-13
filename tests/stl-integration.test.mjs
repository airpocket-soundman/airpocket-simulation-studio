import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BoxGeometry} from 'three';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {sampleResult} from '../src/probe.js';
let sequence=0;
async function run(project,options={}){
 const previousSelf=globalThis.self,previousFetch=globalThis.fetch,messages=[],base=new URL('./fixtures/worker/',import.meta.url).href;
 globalThis.self={postMessage:data=>messages.push(data)};
 globalThis.fetch=async url=>{
  if(url!==base+'fem-kernel.wasm')throw Error('Unexpected worker fetch '+url);
  const bytes=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 try{
  await import(new URL('../src/analysis.worker.js',import.meta.url).href+'?stl-integration='+sequence++);
  await globalThis.self.onmessage({data:{operation:'elastic',project:structuredClone(project),source:project.sourceModel,options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options},base}});
  const terminal=messages.findLast(m=>m.result||m.error);assert.ok(terminal);return terminal;
 }finally{
  if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;
  globalThis.fetch=previousFetch;
 }
}

function stlCube(){
 const geometry=new BoxGeometry(10,10,10).toNonIndexed();geometry.translate(5,5,5);const positions=Array.from(geometry.attributes.position.array);geometry.dispose();
 const mesh={kind:'stl',positions,faceIds:Array.from({length:positions.length/9},(_,i)=>i)},face=x=>mesh.faceIds.filter(t=>[0,3,6].every(k=>Math.abs(positions[t*9+k]-x)<1e-8));
 return {version:1,name:'Closed convex STL cube',sourceModel:{kind:'stl',positions:[...positions]},meshes:[mesh],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[1,0,0],regions:[{mesh:0,triangles:face(10)}]}],materialProperties:{youngModulus:1e9,poissonRatio:0},study:{kind:'structural',gravityEnabled:false}};
}
const close=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} vs ${expected}`);
test('closed convex STL solves a WASM axial cube and preserves project/archive/probe state',async()=>{
 const api=createStudioApi();api.loadProject(stlCube());const input=api.exportProject(),terminal=await run(input);assert.equal(terminal.error,undefined);const output=terminal.result,r=output.result;
 assert.equal(r.kind,'elastic');close(r.maxDisplacementMm,.01);close(r.reaction[0],-100,1e-5);close(output.mesh.summary.volumeMm3,1000,1e-5);assert.match(output.mesh.sourceHash,/^[a-f0-9]{64}$/);
 assert.ok(output.boundary.reports.every(report=>report.relativeAreaError<1e-7));
 const archive=createCaseStore();archive.add('STL axial cube',{...output,input,calculation:{operation:'elastic',options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3}}});const restored=createCaseStore();restored.import(JSON.parse(JSON.stringify(archive.export())));const view=prepareCaseView(restored.list()[0]);
 assert.deepEqual(view.input.sourceModel,input.sourceModel);api.loadProject(view.input);assert.deepEqual(api.exportProject().sourceModel,input.sourceModel);assert.deepEqual(api.exportProject().meshes,input.meshes);
 const probe=sampleResult(view.mesh,view.result,[5,5,5]);close(probe.displacementMm[0],.005);close(probe.vonMisesPa,1e6,1);assert.ok(probe.magnitudeMm>0);
 const bad=structuredClone(restored.export());bad.cases[0].output.input.meshes[0].positions[0]+=.1;const saved=restored.export();assert.throws(()=>restored.import(bad),/STL display triangles do not match/);assert.deepEqual(restored.export(),saved);
 const remeshed=structuredClone(saved),remeshedOutput=remeshed.cases[0].output;
 remeshedOutput.input.meshes[0]={kind:'gmsh-surface',sourceHash:remeshedOutput.mesh.sourceHash,positions:remeshedOutput.mesh.surface.flatMap(f=>f.nodes.flatMap(i=>remeshedOutput.mesh.nodes.slice(3*i,3*i+3))),faceIds:remeshedOutput.mesh.surface.map(f=>f.faceTag)};
 const remeshedStore=createCaseStore();remeshedStore.import(remeshed);assert.equal(prepareCaseView(remeshedStore.list()[0]).mesh.sourceHash,output.mesh.sourceHash);
 const refinedInput={...input,meshSettings:{refinements:[{center:[5,5,10],radius:6,size:1.5}]}},refined=await run(refinedInput);assert.equal(refined.error,undefined);
 const refinedStore=createCaseStore();refinedStore.add('Locally refined STL',{...refined.result,input:refinedInput,calculation:{operation:'elastic',options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3}}});
 const refinedRestored=createCaseStore();refinedRestored.import(JSON.parse(JSON.stringify(refinedStore.export())));close(prepareCaseView(refinedRestored.list()[0]).mesh.summary.volumeMm3,1000,1e-5);
 for(const corrupt of [
  o=>delete o.mesh.stl,
  o=>o.mesh.stl.extra='unknown',
  o=>o.mesh.stl.convexBoundaryChecked=false,
  o=>o.mesh.stl.boundaryTransfer='exact-cad',
  o=>o.mesh.stl.triangleCount++,
  o=>o.mesh.stl.sourceVolumeMm3*=2,
  o=>o.mesh.nodes=o.mesh.nodes.map(v=>v*.5),
  o=>o.mesh.nodes=o.mesh.nodes.map((v,i)=>v+(i%3===0?20:0)),
  o=>{const t=o.mesh.tetrahedra.find(t=>t.every(node=>o.mesh.nodes[node*3]>0&&o.mesh.nodes[node*3]<10));assert.ok(t);o.mesh.surface[0].nodes=t.slice(0,3);},
  o=>o.calculation.options.adaptive=true,
  o=>o.mesh.planarPatches=[{}],
  o=>{o.input.sourceModel={kind:'box',bounds:[0,0,0,10,10,10]};},
  o=>{o.input.meshes[0]={kind:'gmsh-surface',sourceHash:'0'.repeat(64),positions:o.mesh.surface.flatMap(f=>f.nodes.flatMap(i=>o.mesh.nodes.slice(3*i,3*i+3))),faceIds:o.mesh.surface.map(f=>f.faceTag)};}
 ]){
  const invalid=structuredClone(saved);corrupt(invalid.cases[0].output);
  assert.throws(()=>restored.import(invalid),/STL/);assert.deepEqual(restored.export(),saved);
  assert.throws(()=>prepareCaseView(invalid.cases[0]),/STL/);
 }
});
test('STL invalid imports stay atomic and worker refuses adaptive meshing or source mismatch',async()=>{
 const project=stlCube(),api=createStudioApi();api.loadProject(project);const saved=api.exportProject();
 for(const mutate of [p=>p.sourceModel.positions.splice(0,9),p=>p.meshes[0].positions[0]+=.1,p=>p.meshes[0].faceIds[0]=99,p=>p.meshes[0].kind='cad']){
  const bad=structuredClone(saved);mutate(bad);assert.throws(()=>api.loadProject(bad));assert.deepEqual(api.exportProject(),saved);
 }
 const failed=await run(project,{adaptive:true});assert.equal(failed.result,undefined);assert.match(failed.error,/STL.*adaptive/);
 const mismatched=structuredClone(project);mismatched.meshes[0].positions[0]+=.1;const invalid=await run(mismatched);assert.equal(invalid.result,undefined);assert.match(invalid.error,/STL display triangles do not match/);
 const exact=structuredClone(project);exact.conditions[1].planarRegion={mesh:0,axis:0,position:10,min:[0,0],max:[10,10]};const patched=await run(exact);assert.equal(patched.result,undefined);assert.match(patched.error,/STL.*CAD patches/);
});
