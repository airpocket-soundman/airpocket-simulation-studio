import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResultViewApi,resultFields,displayRange,colorFraction} from '../src/result-view-api.js';
import {sampleDisplayedResult} from '../src/probe.js';

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
