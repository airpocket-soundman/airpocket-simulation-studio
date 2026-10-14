import {test} from 'node:test';import assert from 'node:assert/strict';
import {solvePlasticity} from '../src/plasticity-core.js';
const properties={youngModulus:200e9,poissonRatio:.3,plasticity:{model:'j2-isotropic',yieldStress:250e6,hardeningModulus:1e9}};
const mesh={nodes:[0,0,0,10,0,0,10,10,0,0,10,0,0,0,40,10,0,40,10,10,40,0,10,40],tetrahedra:[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]]};
function boundary(strain=.003){const b={displacements:[],forces:[]};for(let node=0;node<8;node++){const [x,y,z]=mesh.nodes.slice(node*3,node*3+3);if(x===0)b.displacements.push({node,direction:[1,0,0],valueMm:0});if(y===0)b.displacements.push({node,direction:[0,1,0],valueMm:0});if(z===0||z===40)b.displacements.push({node,direction:[0,0,1],valueMm:z*strain});}return b;}
test('converged plastic load fields are detached global displacements in mm and preserve final numerics',()=>{
 const events=[],copies=[],options={method:'pcg',loadSteps:5},baseline=solvePlasticity(mesh,properties,boundary(),options),actual=solvePlasticity(mesh,properties,boundary(),{...options,observeFields:true,onObserve:event=>{events.push(event);copies.push(structuredClone(event));}});
 assert.deepEqual(actual,baseline);assert.equal(events.length,5);
 for(const [index,event]of events.entries()){
  assert.equal(event.stage,'load-step');assert.equal(event.converged,true);assert.deepEqual(event.field,{kind:'structuralDisplacement',solver:'plasticity',step:index+1,steps:5,loadFactor:(index+1)/5,displacement:event.field.displacement,units:{displacement:'mm'}});
  assert.equal(event.field.displacement.length,mesh.nodes.length);assert.ok(event.field.displacement.every(Number.isFinite));assert.equal(event.field.time,undefined);assert.equal(event.field.stresses,undefined);assert.deepEqual(event,copies[index]);if(index)assert.notEqual(event.field.displacement,events[index-1].field.displacement);
 }
 assert.deepEqual(events.at(-1).field.displacement,actual.displacement);events[0].field.displacement[0]=999;assert.notEqual(events[1].field.displacement[0],999);assert.notEqual(actual.displacement[0],999);
});
test('field gate is opt in, boolean strict, and requires an observer',()=>{
 for(const setting of [undefined,false]){const events=[];solvePlasticity(mesh,properties,boundary(),{method:'pcg',loadSteps:2,...(setting===undefined?{}:{observeFields:setting}),onObserve:event=>events.push(event)});assert.equal(events.length,2);assert.ok(events.every(event=>!Object.hasOwn(event,'field')));}
 for(const observeFields of [null,0,1,'true',{},[]])assert.throws(()=>solvePlasticity(mesh,properties,boundary(),{observeFields}),/observeFields/);
 assert.doesNotThrow(()=>solvePlasticity(mesh,properties,boundary(),{method:'pcg',loadSteps:2,observeFields:true}));
});
test('unloading fields retain actual nonmonotonic load fractions rather than physical time',()=>{
 const loadFractions=[.1,.2,.3,.4,.5,.6,.7,.8,.9,1,.9,.8,.7,.6],events=[],result=solvePlasticity(mesh,properties,boundary(),{method:'pcg',loadFractions,observeFields:true,onObserve:event=>events.push(event)});
 assert.deepEqual(events.map(event=>event.field.loadFactor),loadFractions);assert.deepEqual(events.map(event=>event.field.step),loadFractions.map((_,i)=>i+1));assert.ok(events.every(event=>event.field.steps===loadFractions.length&&!Object.hasOwn(event.field,'time')));
 assert.ok(Math.abs(events[9].field.displacement[20]-.12)<1e-12);assert.ok(Math.abs(events.at(-1).field.displacement[20]-.072)<1e-12);assert.deepEqual(events.at(-1).field.displacement,result.displacement);
});
test('failed Newton and rejected small strain steps never publish their displacement',()=>{
 const events=[];assert.throws(()=>solvePlasticity(mesh,properties,boundary(),{method:'pcg',maxNewtonIterations:1,observeFields:true,onObserve:event=>events.push(event)}),/iteration limit/);assert.equal(events.length,0);
 const accepted=[];assert.throws(()=>solvePlasticity(mesh,properties,boundary(.025),{method:'pcg',loadFractions:[.1,1,.1],observeFields:true,onObserve:event=>accepted.push(event)}),/small-strain limit/);assert.equal(accepted.length,1);assert.equal(accepted[0].field.step,1);assert.equal(accepted[0].field.loadFactor,.1);
});
