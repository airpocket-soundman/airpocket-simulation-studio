import {test} from 'node:test';import assert from 'node:assert/strict';
import {locateFrame,interpolateFrames,playbackTimes,fixedFieldRange} from '../src/time-interpolation.js';
const times=[0,1,3],fields=[[0,10],[10,20],[30,0]];
test('exact stored time returns a copy and is not marked interpolated',()=>{
 const r=interpolateFrames(times,fields,1);assert.equal(r.interpolated,false);assert.deepEqual(Array.from(r.values),[10,20]);r.values[0]=99;assert.equal(fields[1][0],10);
});
test('linear interpolation between unevenly spaced snapshots',()=>{
 const r=interpolateFrames(times,fields,2);assert.equal(r.interpolated,true);assert.equal(r.lower,1);assert.equal(r.upper,2);assert.equal(r.weight,.5);assert.deepEqual(Array.from(r.values),[20,10]);
 assert.deepEqual(Array.from(interpolateFrames(times,fields,.25).values),[2.5,12.5]);
});
test('affine-in-time data is reproduced exactly; no extrapolation',()=>{
 const t=[0,2,5],f=t.map(x=>[3*x+1,-x]);for(const x of [0,.7,2,4.1,5])assert.ok(Math.abs(interpolateFrames(t,f,x).values[0]-(3*x+1))<1e-12);
 assert.throws(()=>interpolateFrames(t,f,-1e-9),/extrapolation/);assert.throws(()=>interpolateFrames(t,f,5.0001),/extrapolation/);
});
test('invalid input is rejected',()=>{
 assert.throws(()=>locateFrame([0,1,1],.5),/strictly/);assert.throws(()=>locateFrame([0,NaN],0),/finite/);assert.throws(()=>locateFrame(times,NaN),/finite/);
 assert.throws(()=>interpolateFrames(times,fields.slice(1),1),/One field/);assert.throws(()=>interpolateFrames([0,1],[[1],[1,2]],.5),/equal length/);
});
test('playback schedule is deterministic, hits both ends and is wall-clock independent',()=>{
 const a=playbackTimes(times,7),b=playbackTimes(times,7);assert.deepEqual(a,b);assert.equal(a[0],0);assert.equal(a.at(-1),3);assert.ok(a.every((v,i)=>i===0||v>a[i-1]));
 assert.throws(()=>playbackTimes(times,1),/at least 2/);assert.throws(()=>playbackTimes([0],2),/two stored/);
});
test('interpolated values stay inside the fixed range over all snapshots',()=>{
 const range=fixedFieldRange(fields);assert.deepEqual(range,{min:0,max:30});
 for(const t of playbackTimes(times,40))for(const v of interpolateFrames(times,fields,t).values)assert.ok(v>=range.min&&v<=range.max);
 assert.throws(()=>fixedFieldRange([[1,Infinity]]),/finite/);
});
