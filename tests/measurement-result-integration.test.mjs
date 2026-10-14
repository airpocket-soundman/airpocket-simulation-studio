import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResultViewApi} from '../src/result-view-api.js';
import {createMeasurementHistory} from '../src/measurement-history.js';

const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]};
const assessment={schemaVersion:1,mode:'exploratory',provisional:true,completePreflight:false,remainingChecks:['material confirmation']};
function fixture(result,field){
 let output={mesh:structuredClone(mesh),result:{...result,analysisAssessment:structuredClone(assessment)}},state={field,modeIndex:result.kind==='modal'?1:null,frameIndex:result.kind==='acousticTransient'?1:null,deformScale:100,surface:true,surfaceWire:false,volumeWire:false,section:true,colorRange:null,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}};
 const resultView=createResultViewApi({getAnalysis:()=>output,get:()=>state,set:value=>state=value});
 return {resultView,clear:()=>output=null,history:createMeasurementHistory({resultView})};
}
const cases=[
 ['thermal',{kind:'thermal',temperature:[20,30,40,50],flux:[[1,2,3]]},'temperature',v=>assert.equal(v.temperature,35)],
 ['modal',{kind:'modal',modes:[{frequencyHz:10,displacement:Array(12).fill(1)},{frequencyHz:20,displacement:Array(12).fill(2)}]},'displacement',v=>{assert.equal(v.frequencyHz,20);assert.equal(v.modeInterpretation,'normalized-shape-not-dynamic-response');assert.equal(v.magnitudeMm,Math.sqrt(12));assert.equal(v.display.modeIndex,1);}],
 ['acousticTransient',{kind:'acousticTransient',time:9,pressure:Array(4).fill(999),snapshots:[{time:0,pressure:Array(4).fill(0)},{time:.002,pressure:Array(4).fill(4)}]},'instantPressure',v=>{assert.equal(v.pressurePa,4);assert.equal(v.time,.002);assert.equal(v.display.physicalTimeSeconds,.002);assert.equal(v.display.frameIndex,1);}],
 ['channelFlow',{kind:'channelFlow',velocity:Array(12).fill(2),pressure:[0,4,8,12]},'speed',v=>{assert.equal(v.speedMs,Math.sqrt(12));assert.equal(v.pressurePa,6);}],
 ['acoustic',{kind:'acoustic',real:Array(4).fill(3),imag:Array(4).fill(4),referencePressurePa:2e-5},'spl',v=>{assert.equal(v.peakPressurePa,5);assert.equal(v.rmsPressurePa,5/Math.SQRT2);}],
];
for(const [name,result,field,check] of cases)test(`measurement history persists actual ${name} probe context without a displayed result`,async()=>{
 const h=fixture(result,field),before=await h.resultView.get(),saved=await h.history.save({name,expectedResultRevision:before.resultRevision,expectedArchiveRevision:(await h.history.list()).archiveRevision,point:[.25,.25,.25]}),record=await h.history.get({measurementId:saved.measurementId});
 check(record.evidence);assert.deepEqual(record.evidence.analysisAssessment,assessment);assert.equal(record.resultRevision,before.resultRevision);
 const exported=await h.history.exportArchive();h.clear();const restored=createMeasurementHistory({resultView:h.resultView});await restored.importArchive({archive:exported.archive,expectedArchiveRevision:(await restored.list()).archiveRevision});
 const copy=await restored.get({measurementId:saved.measurementId});assert.deepEqual(copy,record);assert.equal(copy.independentlyVerified,false);assert.equal(copy.recordedEvidence,true);check(copy.evidence);
});
