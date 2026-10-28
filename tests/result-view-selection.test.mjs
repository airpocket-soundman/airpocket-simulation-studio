import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResultSelectionState} from '../src/result-selection-state.js';
import {createResultViewApi} from '../src/result-view-api.js';

const output=temperature=>({input:{version:1},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind:'thermal',temperature:[temperature,30,40,50],flux:[[1,2,3]]}});
function fixture(){
 const selection=createResultSelectionState(),a=output(20),b=output(25);let displayed=a,sets=0;
 let view={field:'temperature',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:null,camera:{position:[50,40,60],target:[0,0,0],up:[0,1,0],fov:40}};
 const api=createResultViewApi({captureSelection:selection.capture,getAnalysis:()=>displayed,get:()=>view,set:next=>{sets++;view=structuredClone(next);}});
 return {selection,api,a,b,get sets(){return sets;},get view(){return view;},select(next){selection.invalidate();displayed=next;}};
}

test('selection lifetimes detect A to B to A independently of payload identity and isolate owners',()=>{
 const state=createResultSelectionState(),other=createResultSelectionState(),first=state.capture(),foreign=other.capture();assert.equal(first(),true);state.invalidate();const second=state.capture();state.invalidate();const third=state.capture();assert.equal(first(),false);assert.equal(second(),false);assert.equal(third(),true);assert.equal(foreign(),true);
 state.dispose();state.dispose();state.invalidate();assert.equal(third(),false);assert.equal(state.capture()(),false);
});

test('A to B to the identical A while result inspection is pending cannot publish an old response',async()=>{
 const h=fixture(),original=structuredClone(h.a),pending=h.api.get();h.select(h.b);h.select(h.a);
 await assert.rejects(pending,/Displayed result changed/);assert.equal(h.sets,0);assert.deepEqual(h.a,original);
 const fresh=await h.api.get();assert.equal(fresh.kind,'thermal');assert.equal(fresh.state.field,'temperature');
});

test('late edits from an old selection cannot mutate the newly reselected identical result',async()=>{
 const h=fixture(),current=await h.api.get(),before=structuredClone(h.view),pending=h.api.set({expectedResultRevision:current.resultRevision,settings:{surface:false}});
 h.select(h.b);h.select(h.a);await assert.rejects(pending,/Displayed result changed/);assert.equal(h.sets,0);assert.deepEqual(h.view,before);
 const next=await h.api.set({expectedResultRevision:current.resultRevision,settings:{surface:false}});assert.equal(next.state.surface,false);assert.equal(h.sets,1);
});

test('cancellation invalidates old probes and immediate reselection accepts only fresh requests',async()=>{
 const h=fixture(),current=await h.api.get(),pending=h.api.probe({expectedResultRevision:current.resultRevision,point:[.25,.25,.25]});h.selection.invalidate();
 await assert.rejects(pending,/Displayed result changed/);h.select(h.b);
 const fresh=await h.api.probe({point:[.25,.25,.25]});assert.equal(fresh.temperature,36.25);assert.equal(h.sets,0);
});

test('disposed selection rejects in-flight inspection and edits without recreating presentation state',async()=>{
 const h=fixture(),current=await h.api.get(),pending=h.api.set({expectedResultRevision:current.resultRevision,settings:{surface:false}});h.selection.dispose();
 await assert.rejects(pending,/Displayed result changed/);assert.equal(h.sets,0);await assert.rejects(h.api.get(),/Displayed result changed/);
});

test('normal selection values, revisions and saved input stay identical with and without the optional lifetime provider',async()=>{
 const h=fixture(),before=structuredClone(h.a),legacy=createResultViewApi({getAnalysis:()=>h.a,get:()=>h.view,set:()=>{}});
 assert.deepEqual(await h.api.get(),await legacy.get());assert.deepEqual(h.a,before);
});

test('a chained inspection/edit keeps its original selection guard across the caller await boundary',async()=>{
 const h=fixture(),selected=h.selection.capture(),current=await h.api.get(),before=structuredClone(h.view);h.select(h.b);h.select(h.a);
 await assert.rejects(h.api.set({expectedResultRevision:current.resultRevision,settings:{colorRange:{field:'temperature',minimum:0,maximum:100}}},{guard:selected}),/changed|expired/);
 assert.equal(h.sets,0);assert.deepEqual(h.view,before);
});
