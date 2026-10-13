import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleResult} from '../src/probe.js';
const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]};
test('result probe interpolates fields and rejects points outside the solid',()=>{
const p=[.25,.25,.25],thermal=sampleResult(mesh,{kind:'thermal',temperature:[0,10,20,30],flux:[[1,2,3]]},p);assert.equal(thermal.temperature,15);assert.deepEqual(thermal.flux,[1,2,3]);
const elastic=sampleResult(mesh,{kind:'elastic',displacement:[0,0,0,1,0,0,0,2,0,0,0,3],vonMises:[42]},p);assert.deepEqual(elastic.displacementMm,[.25,.5,.75]);
const acoustic=sampleResult(mesh,{kind:'acoustic',real:[1,1,1,1],imag:[1,1,1,1],referencePressurePa:20e-6},p);assert.ok(Math.abs(acoustic.rmsPressurePa-1)<1e-12);assert.ok(Math.abs(acoustic.phase-Math.PI/4)<1e-12);assert.throws(()=>sampleResult(mesh,{},[2,2,2]),/outside/);assert.throws(()=>sampleResult(mesh,{},[NaN,0,0]),/Invalid/);
});
