import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonDeformationPlan} from '../src/comparison-deformation-plan.js';
const output=()=>({mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind:'elastic',displacement:[0,0,0,0,0,0,0,0,0,0,0,.01],magnitudes:[0,0,0,.01],vonMises:[1000000]}});

test('linear visual ramp is exactly zero-to-requested scale while physical arrays stay unchanged',()=>{
 const outputs=[output(),output()],before=structuredClone(outputs);
 for(const field of ['displacement','stress']){
  const plan=createComparisonDeformationPlan(outputs,{field,deformScale:20});
  assert.deepEqual([0,.25,.5,1].map(phase=>plan.atPhase(phase).deformScale),[0,5,10,20]);
  assert.equal(plan.summary.visualizationOnly,true);assert.equal(plan.summary.resultValues,'fixed-saved-result');assert.equal(plan.summary.loadHistory,false);assert.equal(plan.summary.camera,'fixed');assert.equal(plan.summary.scalePolicy,'linear');
 }
 assert.deepEqual(outputs,before);
});
test('unsupported result kinds, nonlinear flags and unavailable fields refuse before drawing',()=>{
 for(const mutate of [o=>o.result.kind='modal',o=>o.result.kind='thermal',o=>o.result.kind='acousticTransient',o=>o.result.plasticity={},o=>o.result.hyperelastic={}]){const sources=[output(),output()];mutate(sources[1]);assert.throws(()=>createComparisonDeformationPlan(sources,{field:'displacement',deformScale:1}),/linear elastic/);}
 for(const field of ['plasticStrain','temperature','instantPressure'])assert.throws(()=>createComparisonDeformationPlan([output(),output()],{field,deformScale:1}));
});
test('each case needs matching finite nonzero nodal displacement and a valid selected scalar field',()=>{
 for(const mutate of [o=>o.result.displacement.pop(),o=>o.result.displacement.fill(0),o=>o.result.displacement[0]=NaN,o=>o.mesh.nodes[0]=Infinity,o=>o.result.magnitudes.pop(),o=>o.result.magnitudes[0]=-1]){const sources=[output(),output()];mutate(sources[1]);assert.throws(()=>createComparisonDeformationPlan(sources,{field:'displacement',deformScale:1}));}
 const stress=output();stress.result.vonMises=[];assert.throws(()=>createComparisonDeformationPlan([output(),stress],{field:'stress',deformScale:1}),/field/);
});
test('positive finite scale and renderable endpoints are required; physical time options are never accepted',()=>{
 for(const deformScale of [0,-1,NaN,Infinity,1e308,1e42])assert.throws(()=>createComparisonDeformationPlan([output(),output()],{field:'displacement',deformScale}));
 for(const key of ['timeSeconds','startTimeSeconds','endTimeSeconds','toleranceSeconds'])assert.throws(()=>createComparisonDeformationPlan([output(),output()],{field:'displacement',deformScale:1,[key]:0}),/physical time/);
 const plan=createComparisonDeformationPlan([output(),output()],{field:'displacement',deformScale:1});for(const phase of [-1,NaN,1.1])assert.throws(()=>plan.atPhase(phase),/phase/);
});
