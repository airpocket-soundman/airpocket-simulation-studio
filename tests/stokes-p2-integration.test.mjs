import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {sampleResult} from '../src/probe.js';
import {tetrahedronSection} from '../src/result-slice.js';
import {stokesVelocityAt,tet10Edges,refineResultTriangles} from '../src/stokes-interpolation.js';
const input={version:1,name:'P2 finite-box reference',sourceModel:{kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:5},enclosure:[-20,-20,-20,40,40,40]},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],study:{kind:'creepingFlow',dynamicViscosity:1,fluidDensity:1000,freeStreamVelocity:[.001,0,0],referenceLengthMm:10,stokesVelocityElement:'P2'}};
let prepared;const solved=()=>prepared??=analyzeProject(input,{size:6});
test('P2 worker archives retain independent velocity and pressure spaces and reject altered midpoint physics',async()=>{
 const output=await solved(),r=output.result,mesh=output.mesh;assert.equal(r.stokes.velocityElement,'P2');assert.equal(r.stokes.pressureElement,'P1');assert.equal(r.stokes.stabilization,'none');assert.equal(r.method,'wasm-gmres');assert.ok(r.residual<1e-8);assert.ok(r.forceBalanceErrorN.every(v=>Math.abs(v)<1e-10));assert.ok(r.relativeFluxError<1e-8);assert.ok(r.reactionDragN[0]>0);assert.ok(r.edgeVelocity.length>r.velocity.length);assert.equal(r.pressure.length,mesh.nodes.length/3);
 const store=createCaseStore();store.add('P2 sphere',output);const archive=JSON.parse(JSON.stringify(store.export())),restored=createCaseStore();restored.import(archive);const view=prepareCaseView(restored.list()[0]);assert.deepEqual(view.result,r);assert.equal(view.input.study.stokesVelocityElement,'P2');
 const midpoint=r.edgeNodes.slice(0,3),probe=sampleResult(mesh,r,midpoint,{elementIndex:0});probe.velocityMs.forEach((v,k)=>assert.ok(Math.abs(v-r.edgeVelocity[k])<1e-12));
 for(const mutate of [o=>o.result.edgeNodes[0]+=.1,o=>o.result.edgeVelocity[0]+=.0001,o=>o.result.cellVelocityNodeIds[0][4]++,o=>o.result.reactionDragN[0]*=2,o=>o.result.stokes.maxReynoldsBoundNumber*=2,o=>o.input.study.stokesVelocityElement='P1']){
  const bad=structuredClone(archive);mutate(bad.cases[0].output);assert.throws(()=>restored.import(bad),/Taylor|Stokes|catalog/i);assert.deepEqual(restored.export(),archive);
 }
 console.log('P2 finite-box reference',JSON.stringify({baseNodes:mesh.nodes.length/3,virtualNodes:r.stokes.virtualVelocityNodes,dragN:r.reactionDragN,maxSpeedMs:r.maxSpeedMs,velocityBoundMs:r.velocityUpperBoundMs,divergence:r.rmsDivergencePerSecond,residual:r.residual}));
});
test('quadratic point and section samples recover x squared instead of corner-linear interpolation',()=>{
 const nodes=[0,0,0,1,0,0,0,1,0,0,0,1],mesh={nodes,tetrahedra:[[0,1,2,3]],surface:[]},points=tet10Edges.map(([a,b])=>[0,1,2].map(k=>(nodes[3*a+k]+nodes[3*b+k])/2)),r={kind:'stokes',stokes:{velocityElement:'P2'},velocity:[0,0,0,1,0,0,0,0,0,0,0,0],edgeNodes:points.flat(),edgeVelocity:points.flatMap(([x])=>[x*x,0,0]),cellVelocityNodeIds:[[0,1,2,3,4,5,6,7,8,9]],pressure:[0,1,0,0]};
 const sample=sampleResult(mesh,r,[.3,.2,.1]);assert.ok(Math.abs(sample.velocityMs[0]-.09)<1e-14);assert.ok(Math.abs(sample.pressurePa-.3)<1e-14);assert.notEqual(sample.velocityMs[0],sample.pressurePa);
 const section=refineResultTriangles(tetrahedronSection(mesh,{axis:2,position:.1}));assert.equal(section.elementIndices.length,4);for(let i=0;i<section.samples.length;i++){const s=section.samples[i],x=section.physicalPositions[3*i];assert.ok(Math.abs(stokesVelocityAt(r,s.element,s.weights)[0]-x*x)<1e-14);}assert.ok(section.samples.some(s=>s.weights.filter(v=>v>0).length>=3));
});
test('P2 selection roundtrips and rejects unsupported element names atomically',()=>{
 const api=createStudioApi();api.loadProject(input);const before=api.exportProject();assert.equal(before.study.stokesVelocityElement,'P2');assert.throws(()=>api.setStudy({...before.study,stokesVelocityElement:'P3'}),/P1 or P2/);assert.deepEqual(api.exportProject(),before);const old=structuredClone(input);delete old.study.stokesVelocityElement;api.loadProject(old);assert.equal(api.exportProject().study.stokesVelocityElement,undefined);
});
