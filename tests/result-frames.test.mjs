import {test} from 'node:test';import assert from 'node:assert/strict';
import {framesOf,defaultFrameIndex} from '../src/result-frames.js';
import {interpolateFrames,fixedFieldRange} from '../src/time-interpolation.js';
import {solveThermal} from '../src/thermal-core.js';
const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},props={conductivity:1,density:1000,specificHeat:1000};
test('acoustic frames map pressure and keep the first frame as default',()=>{
 const r={kind:'acousticTransient',snapshots:[{time:0,pressure:[0,1]},{time:.001,pressure:[2,3]}]},f=framesOf(r);
 assert.deepEqual(f.times,[0,.001]);assert.deepEqual(f.fields,[[0,1],[2,3]]);assert.equal(f.unit,'Pa');assert.equal(f.fieldId,'instantPressure');assert.equal(defaultFrameIndex(r),0);
});
test('thermal frames map temperature, default to the final frame, and interpolate through time-interpolation',()=>{
 const r=solveThermal(mesh,props,{},{transient:true,timeStep:1,steps:10,volumetricSource:1e6,thermalSnapshotCount:3}),f=framesOf(r);
 assert.deepEqual(f.times,[0,5,10]);assert.equal(f.unit,'degC');assert.equal(f.fieldId,'temperature');assert.equal(defaultFrameIndex(r),2);
 assert.deepEqual(f.fields.at(-1),r.temperature);
 const mid=interpolateFrames(f.times,f.fields,2.5);assert.ok(mid.interpolated&&mid.values.every(v=>Math.abs(v-22.5)<1e-6));
 const range=fixedFieldRange(f.fields);assert.equal(range.min,20);assert.ok(Math.abs(range.max-r.maxTemperature)<1e-9);
});
test('results without frames return null',()=>{
 assert.equal(framesOf(null),null);assert.equal(framesOf({kind:'thermal',transient:true,temperature:[1]}),null);
 assert.equal(framesOf({kind:'thermal',transient:false,snapshots:[{time:0,temperature:[1]},{time:1,temperature:[2]}]}),null);
 assert.equal(framesOf({kind:'elastic',snapshots:[]}),null);assert.equal(defaultFrameIndex({kind:'elastic'}),0);
});
