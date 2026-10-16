import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {solveHyperelastic} from '../src/hyperelastic-core.js';
import {captureOptions} from './helpers/newton-capture.mjs';
const h={model:'neo-hookean-log',shearModulus:5e5,bulkModulus:2e6};
// One tetrahedron: base nodes fixed, apex pulled along z.
const mesh={nodes:Float64Array.from([0,0,0,.01,0,0,0,.01,0,0,0,.01]),tetrahedra:[[0,1,2,3]]};
const problem=(fz)=>({boundary:{displacements:[0,1,2].flatMap(node=>[0,1,2].map(k=>({node,direction:[k===0?1:0,k===1?1:0,k===2?1:0],valueMm:0}))),forces:[{node:3,value:[0,0,fz]}]}});
const {boundary}=problem(1e-3);
test('capture hook: iteration-limit failure writes parseable inputs and trace; error unchanged',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cap-'));try{
  assert.throws(()=>solveHyperelastic(mesh,{hyperelastic:h},boundary,{method:'pcg',loadSteps:2,maxNewtonIterations:1,...captureOptions('unit',dir)}),/iteration limit/);
  const files=readdirSync(dir);assert.equal(files.length,1);
  const rec=JSON.parse(readFileSync(join(dir,files[0]),'utf8'));
  assert.equal(rec.kind,'hyperelastic-newton-failure');assert.equal(rec.at,'iteration-limit');
  assert.deepEqual(rec.inputs.mesh.tetrahedra,[[0,1,2,3]]);assert.equal(rec.inputs.mesh.nodes.length,12);
  assert.deepEqual(rec.inputs.options,{method:'pcg',gravity:[0,0,0],loadSteps:2,maxNewtonIterations:1});
  assert.equal(rec.inputs.properties.hyperelastic.shearModulus,5e5);assert.equal(rec.inputs.boundary.forces[0].node,3);
  assert.ok(rec.trace.length>=1&&Number.isFinite(rec.trace[0].residualNorm)&&rec.trace[0].loadFactor===.5);
  assert.ok(rec.trace[0].attempts.length>=1);
  // The capture is a frozen input: replaying it reproduces the same failure.
  assert.throws(()=>solveHyperelastic({nodes:Float64Array.from(rec.inputs.mesh.nodes),tetrahedra:rec.inputs.mesh.tetrahedra},rec.inputs.properties,rec.inputs.boundary,rec.inputs.options),/iteration limit/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('capture hook: line-search failure from an excessive load is captured with step lengths',()=>{
 const records=[];
 assert.throws(()=>solveHyperelastic(mesh,{hyperelastic:h},problem(-1e6).boundary,{method:'pcg',loadSteps:1,onFailure:r=>records.push(r)}),/line search failed|iteration limit/);
 assert.equal(records.length,1);assert.ok(['line-search','iteration-limit'].includes(records[0].at));
 if(records[0].at==='line-search')assert.equal(records[0].trace.at(-1).attempts.length,20);
});
test('capture hook is off by default: identical results with and without it, and no hook means no options',()=>{
 assert.deepEqual(captureOptions('x',undefined),{});
 const a=solveHyperelastic(mesh,{hyperelastic:h},boundary,{method:'pcg',loadSteps:2}),b=solveHyperelastic(mesh,{hyperelastic:h},boundary,{method:'pcg',loadSteps:2,onFailure(){throw Error('must not run');}});
 assert.deepEqual(a.displacement,b.displacement);assert.deepEqual(a.hyperelastic,b.hyperelastic);assert.equal(a.residual,b.residual);
 assert.throws(()=>solveHyperelastic(mesh,{hyperelastic:h},boundary,{method:'pcg',onFailure:'x'}),/onFailure/);
});
test('frozen captured input of the intermittent line-search failure converges with the full Newton step and independent stretch',async()=>{
 const {readFileSync}=await import('node:fs');
 const rec=JSON.parse(readFileSync(new URL('./fixtures/hyperelastic-line-search-capture.json',import.meta.url),'utf8')),{inputs,trace}=rec;
 assert.equal(trace[0].attempts[0].alpha,1);assert.ok(trace[0].attempts[0].norm<1e-2*trace[0].residualNorm,'the captured full step was an excellent descent step');
 const records=[],r=solveHyperelastic({nodes:Float64Array.from(inputs.mesh.nodes),tetrahedra:inputs.mesh.tetrahedra},inputs.properties,inputs.boundary,{...inputs.options,onFailure:x=>records.push(x)});
 assert.equal(records.length,0);assert.ok(r.residual<1e-8);assert.ok(Math.abs(r.reaction[2]+10)<1e-6);
 const hh=inputs.properties.hyperelastic,lambda=hh.bulkModulus-2*hh.shearModulus/3;let lo=1,hi=2;for(let i=0;i<80;i++){const x=(lo+hi)/2,P=hh.shearModulus*x+(lambda*Math.log(x)-hh.shearModulus)/x;if(P<1e5)lo=x;else hi=x;}
 assert.ok(Math.abs(r.maxDisplacementMm-40*((lo+hi)/2-1))<1e-7);
 assert.throws(()=>solveHyperelastic({nodes:Float64Array.from(inputs.mesh.nodes),tetrahedra:inputs.mesh.tetrahedra},inputs.properties,inputs.boundary,{...inputs.options,loadSteps:0}),/Invalid nonlinear/);
});
