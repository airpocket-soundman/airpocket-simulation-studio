import {test} from 'node:test';import assert from 'node:assert/strict';
import {solveThermal,thermalSnapshotPlan,THERMAL_SNAPSHOT_MAX} from '../src/thermal-core.js';
import {locateFrame,interpolateFrames} from '../src/time-interpolation.js';
const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},props={conductivity:1,density:1000,specificHeat:1000};
const base={transient:true,timeStep:1,steps:10,volumetricSource:1e6};
test('snapshots equal the observed per-step fields and the final field; initial state is frame 0',()=>{
 const events=[],r=solveThermal(mesh,props,{},{...base,onObserve:e=>events.push(e)});
 assert.equal(r.snapshots.length,11);assert.deepEqual(r.snapshotInfo.steps,[...Array(11).keys()]);
 assert.deepEqual(r.snapshots[0],{step:0,time:0,temperature:[20,20,20,20]});
 for(const s of r.snapshots.slice(1)){const e=events[s.step-1];assert.equal(e.time,s.time);assert.deepEqual(e.field.temperature,s.temperature);}
 assert.deepEqual(r.snapshots.at(-1).temperature,r.temperature);
 // uniform heating of a closed body: analytic T(t)=20+q t/(rho cp)
 for(const s of r.snapshots)for(const v of s.temperature)assert.ok(Math.abs(v-(20+s.time))<1e-6);
});
test('snapshots do not change existing result fields or scalar history',()=>{
 const a=solveThermal(mesh,props,{},base),b=solveThermal(mesh,props,{},{...base,thermalSnapshotCount:3}),{snapshots,snapshotInfo,...rest}=b,{snapshots:s2,snapshotInfo:i2,...restA}=a;
 assert.deepEqual(rest,restA);assert.equal(b.snapshots.length,3);assert.deepEqual(b.snapshotInfo.steps,[0,5,10]);
 assert.deepEqual(b.history,a.history);assert.equal(b.history.length,10);
 const f=interpolateFrames(b.snapshots.map(x=>x.time),b.snapshots.map(x=>x.temperature),2.5);assert.ok(f.values.every(v=>Math.abs(v-22.5)<1e-6));
 assert.equal(locateFrame(b.snapshots.map(x=>x.time),5).exact,true);
});
test('steady results carry no snapshots',()=>{const r=solveThermal(mesh,props,{temperatures:[[0,20],[1,30]]},{});assert.equal(r.snapshots,undefined);assert.equal(r.snapshotInfo,undefined);});
test('count validation, cap, step-limited reduction and memory budget',()=>{
 for(const bad of [1,62,2.5,'3'])assert.throws(()=>solveThermal(mesh,props,{},{...base,thermalSnapshotCount:bad}),/thermalSnapshotCount/);
 const few=solveThermal(mesh,props,{},{...base,steps:3,thermalSnapshotCount:10});assert.deepEqual(few.snapshotInfo.steps,[0,1,2,3]);assert.match(few.snapshotInfo.warnings[0],/only 4 states/);
 const plan=thermalSnapshotPlan(100,1000,undefined,8*1000*5);assert.equal(plan.count,5);assert.equal(plan.indices[0],0);assert.equal(plan.indices.at(-1),100);assert.match(plan.warnings[0],/reduced from 61 to 5/);
 const r=solveThermal(mesh,props,{},{...base,thermalSnapshotBudgetBytes:8*4*2});assert.equal(r.snapshots.length,2);assert.deepEqual(r.snapshotInfo.steps,[0,10]);assert.equal(r.snapshotInfo.warnings.length,1);
 assert.throws(()=>solveThermal(mesh,props,{},{...base,thermalSnapshotBudgetBytes:8*4*2-1}),/cannot hold two frames/);
 assert.equal(solveThermal(mesh,props,{},{...base,steps:100}).snapshots.length,THERMAL_SNAPSHOT_MAX);
});
test('snapshots survive a JSON/structured-clone round trip unchanged',()=>{const r=solveThermal(mesh,props,{},base);assert.deepEqual(JSON.parse(JSON.stringify(r.snapshots)),r.snapshots);assert.deepEqual(structuredClone(r.snapshotInfo),r.snapshotInfo);});
