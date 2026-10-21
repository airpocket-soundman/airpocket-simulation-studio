import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResultViewApi,resultFields,displayRange,colorFraction} from '../src/result-view-api.js';
import {sampleDisplayedResult} from '../src/probe.js';
import {createHistoryPlan} from '../src/time-history-plan.js';

const camera=()=>({position:[50,40,60],target:[0,0,0],up:[0,1,0],fov:40});
function harness(kind='thermal'){
 let output={input:{version:1},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind,temperature:[20,30,40,50],flux:[[1,2,3]],analysisAssessment:{mode:'exploratory',provisional:true,completePreflight:false}}};
 if(kind==='acousticTransient')Object.assign(output.result,{pressure:[1,2,3,4],snapshots:[{time:0,pressure:[0,0,0,0]},{time:.001,pressure:[1,2,3,4]},{time:.002,pressure:[2,3,4,5]}]});
 if(kind==='modal')Object.assign(output.result,{modes:[{frequencyHz:10,residual:1e-9,displacement:[1,2,3]},{frequencyHz:20,residual:1e-9,displacement:[3,2,1]}]});
 let state={field:resultFields(output.result)[0].id,modeIndex:0,frameIndex:0,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:true,colorRange:null,camera:camera()},busy=false,sets=0,fail=false;
 const api=createResultViewApi({getAnalysis:()=>output,get:()=>state,isBusy:()=>busy,set:next=>{state=structuredClone(next);sets++;if(fail){fail=false;throw Error('Renderer failed');}}});
 return {api,get output(){return output;},get state(){return structuredClone(state);},get sets(){return sets;},setOutput:value=>output=value,setBusy:value=>busy=value,failNext:()=>fail=true};
}
test('result inspection returns versioned units and compact paged metadata, not physical arrays',async()=>{
 const h=harness('acousticTransient'),s=await h.api.get({frameOffset:1,frameLimit:1});assert.match(s.resultRevision,/^sha256:/);assert.deepEqual(s.frames,[{index:1,timeSeconds:.001}]);assert.equal(s.frameCount,3);assert.equal(s.fields[0].unit,'Pa');assert.equal(s.result,undefined);assert.equal(s.mesh,undefined);assert.equal(s.analysisAssessment.provisional,true);
 s.state.camera.position[0]=999;assert.equal(h.state.camera.position[0],50);await assert.rejects(h.api.get({frameLimit:51}),/page/);
});
test('physical time selects only stored frames and fixed colors use field display units',async()=>{
 const h=harness('acousticTransient'),before=structuredClone(h.output),s=await h.api.get();const next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{timeSeconds:.002,colorRange:{field:'instantPressure',minimum:-2,maximum:2},surfaceWire:true,camera:{position:[80,50,70]}}});
 assert.equal(next.state.frameIndex,2);assert.equal(next.physicalTimeSeconds,.002);assert.equal(next.state.surfaceWire,true);assert.deepEqual(next.state.camera.target,[0,0,0]);assert.deepEqual(h.output,before);
 await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{timeSeconds:.0015}}),/No stored/);
 assert.equal(h.state.frameIndex,2);
});
test('modal selection reports normalized shape, not an actual dynamic response',async()=>{
 const h=harness('modal'),s=await h.api.get({modeOffset:1,modeLimit:1});assert.equal(s.modes[0].frequencyHz,20);assert.equal(s.modes[0].displacement,undefined);assert.equal(s.modeInterpretation,'normalized-shape-not-dynamic-response');
 const next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{modeIndex:1,deformScale:10}});assert.equal(next.state.modeIndex,1);assert.equal(next.state.frameIndex,null);assert.equal(h.output.result.modes[0].displacement[0],1);
});

test('versioned result probes measure selected frames and reject a stale displayed-result revision',async()=>{
 const h=harness('acousticTransient'),s=await h.api.get();await h.api.set({expectedResultRevision:s.resultRevision,settings:{frameIndex:1}});const point=await h.api.probe({expectedResultRevision:s.resultRevision,point:[.25,.25,.25]});assert.equal(point.pressurePa,2.5);assert.equal(point.time,.001);assert.equal(point.display.frameIndex,1);assert.equal(point.resultRevision,s.resultRevision);assert.equal(point.analysisAssessment.provisional,true);
 h.output.result.pressure[0]=99;await assert.rejects(h.api.probe({expectedResultRevision:s.resultRevision,point:[.25,.25,.25]}),/revision conflict/);
});
test('invalid field, camera, range, index and layer batches preserve previous settings',async()=>{
 const h=harness(),s=await h.api.get(),before=h.state;
 for(const settings of [{field:'pressure'},{frameIndex:1},{modeIndex:0},{deformScale:NaN},{surface:'yes'},{unknown:true},{camera:{position:[0,0,0]}},{camera:{up:[0,0,0]}},{camera:{fov:180}},{colorRange:{field:'temperature',minimum:30,maximum:20}},{colorRange:{field:'pressure',minimum:0,maximum:1}}]){
  await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings}));assert.deepEqual(h.state,before);
 }
 assert.equal(h.sets,0);
});
test('field changes reset fixed color units unless an explicit valid new range is supplied',async()=>{
 const h=harness(),s=await h.api.get();await h.api.set({expectedResultRevision:s.resultRevision,settings:{colorRange:{field:'temperature',minimum:20,maximum:100}}});
 const next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{field:'heatFlux'}});assert.equal(next.state.colorRange,null);assert.equal(next.fields.find(f=>f.id==='heatFlux').unit,'W/m2');
});
test('stale results, concurrent replacement, busy renderer and revoked commands cannot mutate settings',async()=>{
 const h=harness(),s=await h.api.get();h.output.result.temperature[0]=99;await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{surface:false}}),/revision conflict/);
 const fresh=await h.api.get();const editing=h.api.set({expectedResultRevision:fresh.resultRevision,settings:{surface:false}});h.setOutput(structuredClone(h.output));await assert.rejects(editing,/changed/);
 h.setBusy(true);await assert.rejects(h.api.set({expectedResultRevision:fresh.resultRevision,settings:{surface:false}}),/busy/);h.setBusy(false);
 await assert.rejects(h.api.set({expectedResultRevision:(await h.api.get()).resultRevision,settings:{surface:false}},{guard:()=>false}),/expired/);assert.equal(h.sets,0);
});
test('host rendering failures restore previous viewer settings',async()=>{
 const h=harness(),s=await h.api.get(),before=h.state;h.failNext();await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{surface:false}}),/Renderer failed/);assert.deepEqual(h.state,{...before,modeIndex:null,frameIndex:null});
});
test('fixed display ranges clamp endpoint colors and never alter physical values',()=>{
 assert.deepEqual(displayRange(0,10,{field:'temperature',minimum:20,maximum:100},'temperature'),{min:20,max:100,mode:'fixed'});assert.equal(displayRange(0,10,{field:'temperature',minimum:20,maximum:100},'heatFlux').mode,'auto');assert.equal(colorFraction(-50,0,10),0);assert.equal(colorFraction(50,0,10),1);assert.equal(colorFraction(5,0,10),.5);assert.equal(colorFraction(5,1,1),0);
});

test('display probes use selected stored acoustic frames and modal shapes with explicit override',()=>{
 const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},point=[.25,.25,.25];
 const sound={kind:'acousticTransient',time:1,pressure:[9,9,9,9],snapshots:[{time:0,pressure:[0,0,0,0]},{time:.5,pressure:[2,2,2,2]}]};
 assert.equal(sampleDisplayedResult(mesh,sound,point,{}, {frameIndex:0}).pressurePa,0);const selected=sampleDisplayedResult(mesh,sound,point,{}, {frameIndex:1});assert.equal(selected.pressurePa,2);assert.equal(selected.time,.5);assert.equal(sound.time,1);
 const modal={kind:'modal',modes:[{frequencyHz:10,displacement:Array(12).fill(1)},{frequencyHz:20,displacement:Array(12).fill(2)}]};assert.equal(sampleDisplayedResult(mesh,modal,point,{}, {modeIndex:1}).frequencyHz,20);assert.equal(sampleDisplayedResult(mesh,modal,point,{modeIndex:0},{modeIndex:1}).frequencyHz,10);
 assert.throws(()=>sampleDisplayedResult(mesh,sound,point,{}, {frameIndex:99}),/frame/);
});

 test('finite camera coordinates with overflowing derived geometry are refused atomically',async()=>{const h=harness(),s=await h.api.get(),before=h.state;await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{camera:{position:[1e308,1e308,1e308],target:[-1e308,-1e308,-1e308],up:[0,1,0],fov:40}}}),/degenerate/);assert.deepEqual(h.state,before);});

test('camera float drift and colorRange key order are canonicalized on read',async()=>{
 const h=harness();
 const drift={field:'temperature',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:true,colorRange:{maximum:10,field:'temperature',minimum:0},camera:{position:[70.00000000000001,50,89.99999999999999],target:[5,5,20.000000000000004],up:[0,1,0],fov:30}};
 const api=createResultViewApi({getAnalysis:()=>h.output,get:()=>structuredClone(drift),set:()=>{}});
 const s=(await api.get()).state;
 assert.equal(JSON.stringify(s.camera),'{"position":[70,50,90],"target":[5,5,20],"up":[0,1,0],"fov":30}');
 assert.equal(JSON.stringify(s.colorRange),'{"field":"temperature","minimum":0,"maximum":10}');
});
test('thermal probe at a non-final displayed time samples the displayed frame, never the final step',async()=>{
 const output={input:{version:1},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind:'thermal',transient:true,temperature:[40,40,40,40],flux:[[1,2,3]],snapshots:[{step:0,time:0,temperature:[20,20,20,20]},{step:1,time:10,temperature:[40,40,40,40]}]}};
 let display={frameTime:10,interpolated:false};
 const state={field:'temperature',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:true,colorRange:null,camera:camera()};
 const api=createResultViewApi({getAnalysis:()=>output,get:()=>state,isBusy:()=>false,set(){},frameDisplay:()=>display});
 let s=await api.get();assert.equal(s.physicalTimeSeconds,10);assert.equal(s.timeSelection,'stored-frames-only');assert.equal(s.storedFrameIndex,1);assert.equal(s.state.frameIndex,null);
 let p=await api.probe({expectedResultRevision:s.resultRevision,point:[.25,.25,.25]});assert.equal(p.temperature,40);assert.deepEqual(p.flux,[1,2,3]);assert.equal(p.display.physicalTimeSeconds,10);
 display={frameTime:2.5,interpolated:true,frameValues:[25,25,25,25]};
 p=await api.probe({expectedResultRevision:s.resultRevision,point:[.25,.25,.25]});assert.ok(Math.abs(p.temperature-25)<1e-9);assert.equal(p.flux,undefined);assert.equal(p.frameTimeSeconds,2.5);assert.equal(p.interpolated,true);assert.equal(p.display.physicalTimeSeconds,2.5);
});


function thermalHarness(){
 const base=harness(),output=structuredClone(base.output);Object.assign(output.result,{transient:true,snapshots:[{time:0,temperature:[0,10,20,30]},{time:2,temperature:[10,20,30,40]},{time:7,temperature:[20,30,40,50]}]});
 let state={...base.state,modeIndex:null,frameIndex:null},time={frameIndex:2,timeSeconds:null},busy=false,fail=false,sets=0;
 const display=()=>time.timeSeconds!==null?{frameTime:time.timeSeconds,interpolated:true,frameValues:[5,15,25,35]}:time.frameIndex===2?{frameTime:7,interpolated:false}:{frameTime:output.result.snapshots[time.frameIndex].time,interpolated:false,frameValues:output.result.snapshots[time.frameIndex].temperature};
 const api=createResultViewApi({getAnalysis:()=>output,get:()=>state,isBusy:()=>busy,frameDisplay:display,getTimeView:()=>structuredClone(time),restoreTimeView:value=>{time=structuredClone(value);},set:(next,{timeChanged=false}={})=>{sets++;state=structuredClone(next);if(timeChanged){time={frameIndex:next.frameIndex,timeSeconds:null};}if(fail){fail=false;throw Error('Thermal renderer failed');}}});
 return {api,output,get state(){return structuredClone(state);},get time(){return structuredClone(time);},get sets(){return sets;},interpolate:()=>{time={frameIndex:1,timeSeconds:.123456789123456};},setBusy:value=>busy=value,failNext:()=>fail=true};
}

test('thermal API selects only exact stored times, samples selected temperature and leaves revisions immutable',async()=>{
 const h=thermalHarness(),before=structuredClone(h.output),s=await h.api.get();assert.deepEqual(s.frames,[{index:0,timeSeconds:0},{index:1,timeSeconds:2},{index:2,timeSeconds:7}]);
 let next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{frameIndex:0}});assert.equal(next.state.frameIndex,null);assert.equal(next.storedFrameIndex,0);assert.equal(next.physicalTimeSeconds,0);assert.equal(next.timeSelection,'stored-frames-only');
 let p=await h.api.probe({expectedResultRevision:s.resultRevision,point:[.25,.25,.25]});assert.equal(p.temperature,15);assert.equal(p.flux,undefined);assert.equal(p.display.storedFrameIndex,0);
 next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{timeSeconds:2}});assert.equal(next.storedFrameIndex,1);assert.equal(next.resultRevision,s.resultRevision);assert.equal(next.physicalRevision,s.physicalRevision);
 next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{timeSeconds:7,field:'heatFlux'}});p=await h.api.probe({point:[.25,.25,.25]});assert.deepEqual(p.flux,[1,2,3]);assert.deepEqual(h.output,before);
});

test('thermal invalid times and unavailable flux fail atomically, including from interpolated UI time',async()=>{
 const h=thermalHarness(),s=await h.api.get(),before=h.time;
 for(const settings of [{frameIndex:-1},{frameIndex:3},{frameIndex:.5},{timeSeconds:1},{timeSeconds:2+1e-12},{timeSeconds:2,frameIndex:1},{frameIndex:0,field:'heatFlux'}]){await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings}));assert.deepEqual(h.time,before);}
 assert.equal(h.sets,0);h.interpolate();const exact=h.time;
 await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{field:'heatFlux'}}),/final/);assert.deepEqual(h.time,exact);
 const next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{surfaceWire:true,frameIndex:null}});assert.deepEqual(h.time,exact);assert.equal(next.physicalTimeSeconds,exact.timeSeconds);assert.equal(next.interpolated,true);assert.equal(next.timeSelection,'viewer-slider-only');assert.equal(next.storedFrameIndex,undefined);
 const p=await h.api.probe({point:[.25,.25,.25]});assert.equal(p.temperature,20);assert.equal(p.flux,undefined);
});

test('thermal setters reject stale or busy commands and restore exact interpolation after renderer failure',async()=>{
 const h=thermalHarness(),s=await h.api.get();h.interpolate();const before=h.time,state=h.state;
 await assert.rejects(h.api.set({expectedResultRevision:'stale',settings:{frameIndex:0}}),/revision conflict/);h.setBusy(true);await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{frameIndex:0}}),/busy/);h.setBusy(false);
 await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{frameIndex:0}},{guard:()=>false}),/expired/);assert.equal(h.sets,0);
 h.failNext();await assert.rejects(h.api.set({expectedResultRevision:s.resultRevision,settings:{frameIndex:0,surface:false}}),/Thermal renderer failed/);assert.deepEqual(h.time,before);assert.deepEqual(h.state,state);
});

// VIEWTIME: bounded snapshotStorage metadata. Geometry here is synthetic; only the stored-scalar arithmetic is
// reproduced from the 2026-10-18 evidence tuples (94 nodes x 3 frames x 8 = 2256 bytes, requested 11, budget 2400;
// 741 nodes x 7 frames x 8 = 41496 bytes, budget 65536) through the existing createHistoryPlan.
const maxArrayLength=value=>{let max=0;const walk=v=>{if(Array.isArray(v)){max=Math.max(max,v.length);v.forEach(walk);}else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(value);return max;};
function storageHarness(result){
 let state={field:resultFields(result)[0].id,modeIndex:null,frameIndex:result.kind==='acousticTransient'?0:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:true,colorRange:null,camera:camera()};
 let output={input:{version:1},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result};
 const api=createResultViewApi({getAnalysis:()=>output,get:()=>state,isBusy:()=>false,set:next=>{state=structuredClone(next);}});
 return {api,get output(){return output;}};
}
function thermalStorageFixture(){
 const plan=createHistoryPlan(10,94,{requested:11,budgetBytes:2400});
 const result={kind:'thermal',transient:true,history:Array.from({length:10},(_,i)=>({time:i+1})),snapshots:plan.indices.map(step=>({step,time:step===0?0:step,temperature:Array(94).fill(20+step)})),temperature:Array(94).fill(30)};
 result.snapshotInfo={requested:plan.requested,count:plan.count,steps:plan.indices,bytes:plan.bytes,budgetBytes:plan.budgetBytes,warnings:plan.warnings};
 return result;
}
function acousticStorageFixture(){
 const steps=2138,timeStep=.004/steps,plan=createHistoryPlan(steps,741,{requested:7,budgetBytes:65536,prefix:'acoustic'});
 return {kind:'acousticTransient',steps,timeStep,duration:steps*timeStep,time:steps*timeStep,pressure:Array(741).fill(5),snapshots:plan.indices.map(step=>({time:step*timeStep,pressure:Array(741).fill(step===steps?5:step)})),snapshotInfo:{requested:plan.requested,count:plan.count,steps:plan.indices,bytes:plan.bytes,budgetBytes:plan.budgetBytes,warnings:plan.warnings}};
}
test('getResultView reports a bounded thermal scalar-storage summary and no physical arrays or step lists',async()=>{
 const h=storageHarness(thermalStorageFixture()),before=structuredClone(h.output),s=await h.api.get({frameLimit:0});
 assert.deepEqual(s.snapshotStorage,{requested:11,count:3,bytes:2256,budgetBytes:2400,unit:'byte',bytesPerScalar:8,meaning:'stored-scalar-values-only',excludes:['objects','rendering','observations','receiver-traces','peak-memory'],warningCount:1});
 assert.equal(s.frameCount,3);assert.deepEqual(s.frames,[]);assert.equal(s.snapshotStorage.steps,undefined);assert.equal(s.snapshotStorage.warnings,undefined);assert.ok(maxArrayLength(s)<=8);
 assert.deepEqual(h.output,before);
});
test('getResultView reports the acoustic scalar-storage summary without leaking pressure frames',async()=>{
 const h=storageHarness(acousticStorageFixture()),s=await h.api.get({frameLimit:0});
 assert.deepEqual(s.snapshotStorage,{requested:7,count:7,bytes:41496,budgetBytes:65536,unit:'byte',bytesPerScalar:8,meaning:'stored-scalar-values-only',excludes:['objects','rendering','observations','receiver-traces','peak-memory'],warningCount:0});
 assert.ok(maxArrayLength(s)<=8);
});
test('legacy results without snapshotInfo keep the previous get/set shape and behaviour',async()=>{
 const h=harness('thermal'),s=await h.api.get();
 assert.equal(Object.hasOwn(s,'snapshotStorage'),false);
 const next=await h.api.set({expectedResultRevision:s.resultRevision,settings:{frameIndex:null,surface:false}});
 assert.equal(Object.hasOwn(next,'snapshotStorage'),false);assert.equal(next.state.surface,false);
});
test('tampered time-history metadata is refused explicitly and snapshotStorage stays detached from the result',async()=>{
 for(const patch of [{bytes:2264},{count:2},{requested:1},{budgetBytes:2248},{steps:[0,5,9]}]){
  const r=thermalStorageFixture();Object.assign(r.snapshotInfo,patch);
  await assert.rejects(storageHarness(r).api.get(),/saved time history storage metadata|saved time history endpoint/);
 }
 const bad=thermalStorageFixture();bad.snapshots.at(-1).temperature=Array(94).fill(1e9);
 await assert.rejects(storageHarness(bad).api.get(),/Invalid saved time history/);
 const h=storageHarness(thermalStorageFixture()),before=JSON.stringify(h.output),rev=(await h.api.get()).resultRevision,phys=(await h.api.get()).physicalRevision;
 const first=await h.api.get();first.snapshotStorage.bytes=0;first.snapshotStorage.count=99;first.snapshotStorage.excludes.push('mutated');
 const again=await h.api.get();
 assert.equal(again.snapshotStorage.bytes,2256);assert.equal(again.snapshotStorage.count,3);assert.deepEqual(again.snapshotStorage.excludes,['objects','rendering','observations','receiver-traces','peak-memory']);
 assert.equal(again.resultRevision,rev);assert.equal(again.physicalRevision,phys);assert.equal(JSON.stringify(h.output),before);
});
