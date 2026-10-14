import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveHyperelastic} from '../src/hyperelastic-core.js';
const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},properties={hyperelastic:{model:'neo-hookean-log',shearModulus:5e5,bulkModulus:2e6}},boundary={displacements:Array.from({length:4},(_,node)=>[0,1,2].map(axis=>({node,direction:[0,1,2].map(k=>k===axis?1:0),valueMm:axis===2?mesh.nodes[node*3+2]*.2:0}))).flat(),forces:[]},options={method:'pcg',loadSteps:2};
test('only requested converged load steps expose detached global displacement in mm',()=>{
 const events=[],baseline=solveHyperelastic(mesh,properties,boundary,options),observed=solveHyperelastic(mesh,properties,boundary,{...options,observeFields:true,onObserve:event=>events.push(event)});assert.deepEqual(observed,baseline);assert.equal(events.length,2);
 for(const [index,event]of events.entries()){assert.equal(event.stage,'load-step');assert.equal(event.converged,true);assert.deepEqual(Object.keys(event.field).sort(),['displacement','kind','loadFactor','solver','step','steps','units']);assert.equal(event.field.kind,'structuralDisplacement');assert.equal(event.field.solver,'hyperelastic');assert.equal(event.field.step,index+1);assert.equal(event.field.steps,2);assert.equal(event.field.loadFactor,(index+1)/2);assert.deepEqual(event.field.units,{displacement:'mm'});assert.equal(event.field.displacement.length,12);assert.ok(Math.abs(event.field.displacement[11]-.1*(index+1))<1e-12);assert.equal(event.field.time,undefined);assert.equal(event.field.stresses,undefined);}
 assert.deepEqual(events[1].field.displacement,observed.displacement);events[0].field.displacement[11]=99;assert.equal(events[1].field.displacement[11],.2);assert.equal(observed.displacement[11],.2);
});
test('field observation is opt-in, requires a consumer and cannot alter solver state',()=>{
 for(const observeFields of [undefined,false]){const events=[];solveHyperelastic(mesh,properties,boundary,{...options,...(observeFields===undefined?{}:{observeFields}),onObserve:event=>events.push(event)});assert.equal(events.length,2);assert.ok(events.every(event=>!Object.hasOwn(event,'field')));}
 const baseline=solveHyperelastic(mesh,properties,boundary,options);assert.deepEqual(solveHyperelastic(mesh,properties,boundary,{...options,observeFields:true}),baseline);assert.deepEqual(solveHyperelastic(mesh,properties,boundary,{...options,observeFields:true,onObserve:event=>event.field.displacement.fill(100)}),baseline);
 for(const observeFields of [null,0,1,'true',{},[]])assert.throws(()=>solveHyperelastic(mesh,properties,boundary,{...options,observeFields}),/boolean/);
});
test('failed Newton iterations do not publish an unconverged displacement field',()=>{
 const events=[],loaded={fixed:[0,1,2],displacements:[{node:3,direction:[1,0,0],valueMm:0},{node:3,direction:[0,1,0],valueMm:0}],forces:[{node:3,value:[0,0,.01]}]};assert.throws(()=>solveHyperelastic(mesh,properties,loaded,{...options,maxNewtonIterations:1,observeFields:true,onObserve:event=>events.push(event)}),/iteration limit/);assert.deepEqual(events,[]);
});
