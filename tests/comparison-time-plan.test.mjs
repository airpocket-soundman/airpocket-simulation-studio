import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonTimePlan} from '../src/comparison-time-plan.js';
import {solveAcousticTransient} from '../src/acoustic-transient.js';
function result(times,values,kind='thermal'){
 const key=kind==='thermal'?'temperature':'pressure';
 return {mesh:{nodes:[0,0,0]},result:{kind,transient:true,snapshots:times.map((time,i)=>({time,[key]:[values[i]]}))}};
}
const outputs=()=>[result([0,4,10],[-50,20,300]),result([0,6,10],[-100,50,90])];
const options=()=>({field:'temperature',startTimeSeconds:2.1,endTimeSeconds:7.1});

test('nearest stored states include both out-of-interval endpoint frames in the fixed global range',()=>{
 const source=outputs(),before=structuredClone(source),plan=createComparisonTimePlan(source,options());
 assert.deepEqual(plan.colorRange,{field:'temperature',minimum:-100,maximum:300});
 assert.deepEqual(plan.summary.selectedFrameCounts,[2,2]);
 const first=plan.atPhase(0),last=plan.atPhase(1);
 assert.equal(first.timeSeconds,2.1);assert.deepEqual(first.panels.map(p=>p.frameIndex),[1,0]);
 assert.equal(last.timeSeconds,7.1);assert.deepEqual(last.panels.map(p=>p.frameIndex),[2,1]);
 assert.ok(Math.abs(first.panels[1].offsetSeconds+2.1)<1e-12);
 assert.equal(plan.summary.camera,'fixed');assert.equal(plan.summary.interpolated,false);assert.deepEqual(source,before);
});
test('tolerance guarantees the entire interval, including worst interior half-gaps and endpoint offsets',()=>{
 const source=outputs();
 assert.throws(()=>createComparisonTimePlan(source,{...options(),toleranceSeconds:2.9}),/tolerance/);
 const plan=createComparisonTimePlan(source,{...options(),toleranceSeconds:3});assert.deepEqual(plan.summary.maxAbsOffsetSeconds,[3,3]);
 for(let i=0;i<=100;i++)assert.ok(plan.atPhase(i/100).panels.every(p=>Math.abs(p.offsetSeconds)<=3));
 assert.throws(()=>createComparisonTimePlan(source,{field:'temperature',startTimeSeconds:7.2,endTimeSeconds:8,toleranceSeconds:2}),/tolerance/);
});
test('equal-distance ties select the earlier saved frame and acoustic pressure uses the same time rules',()=>{
 const plan=createComparisonTimePlan(outputs(),{field:'temperature',startTimeSeconds:2,endTimeSeconds:7});
 assert.deepEqual(plan.atPhase(0).panels.map(p=>p.frameIndex),[0,0]);assert.equal(plan.atPhase(1).panels[0].frameIndex,1);
 const acoustic=outputs().map(o=>({mesh:o.mesh,result:{kind:'acousticTransient',snapshots:o.result.snapshots.map(f=>({time:f.time/1000,pressure:f.temperature}))}}));
 const pressure=createComparisonTimePlan(acoustic,{field:'instantPressure',startTimeSeconds:.0021,endTimeSeconds:.0071});
 assert.equal(pressure.unit,'Pa');assert.deepEqual(pressure.colorRange,{field:'instantPressure',minimum:-100,maximum:300});assert.equal(pressure.atPhase(1).timeSeconds,.0071);
});
test('unsupported fields/types, corrupt frames and physical range beyond overlap refuse before rendering',()=>{
 for(const mutate of [o=>o[1].result.kind='acousticTransient',o=>o[0].result.transient=false,o=>o[0].result.snapshots[1].time=-1,o=>o[0].result.snapshots[1].time=10,o=>o[0].result.snapshots[1].temperature=[NaN],o=>o[0].result.snapshots[1].temperature=[1,2]]){
  const source=outputs();mutate(source);assert.throws(()=>createComparisonTimePlan(source,options()));
 }
 for(const option of [{field:'heatFlux',startTimeSeconds:0,endTimeSeconds:10},{...options(),startTimeSeconds:8},{...options(),endTimeSeconds:11},{...options(),startTimeSeconds:-1},{...options(),toleranceSeconds:NaN}])assert.throws(()=>createComparisonTimePlan(outputs(),option));
 const source=outputs();source[1].result.snapshots[0].time=3;assert.throws(()=>createComparisonTimePlan(source,options()),/both saved time axes/);
 const plan=createComparisonTimePlan(outputs(),options());for(const phase of [-1,NaN,1.1])assert.throws(()=>plan.atPhase(phase),/phase/);
});

test('actual transient acoustic solver output retains signed pressure extrema and stored physical seconds',()=>{
 const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[]},study={kind:'acoustic',acousticTransient:true,frequency:4000,soundSpeed:343,airDensity:1.2,lossFactor:0,pulseWidth:.0001,acousticDuration:.0012,receiverPoint:[.1,.1,.1]};
 const source=[1,2].map(scale=>({mesh,result:solveAcousticTransient(mesh,{},study,{initialPressure:[1,-1,0,.5].map(v=>v*scale)})})),before=structuredClone(source);
 const plan=createComparisonTimePlan(source,{field:'instantPressure',startTimeSeconds:0,endTimeSeconds:study.acousticDuration});
 const values=source.flatMap(o=>o.result.snapshots.flatMap(f=>f.pressure));
 assert.equal(plan.colorRange.minimum,Math.min(...values));assert.equal(plan.colorRange.maximum,Math.max(...values));assert.ok(plan.colorRange.minimum<0&&plan.colorRange.maximum>0);
 assert.equal(plan.atPhase(1).panels[0].timeSeconds,study.acousticDuration);assert.equal(plan.unit,'Pa');assert.deepEqual(source,before);
});
