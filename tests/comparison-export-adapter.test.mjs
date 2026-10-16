import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonExportAdapter} from '../src/comparison-export-adapter.js';
const camera=()=>({position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40});
function fixture(){
 const state={valid:true,busy:false,current:true,reads:0,renders:0,encodes:0,checks:0},defaults={camera:camera(),deformScale:2},canvas={width:1280,height:640},references=[{caseId:'a',expectedRevision:'a-rev'},{caseId:'b',expectedRevision:'b-rev'}];
 const request={requestId:'pair',references,field:'temperature',timeSeconds:5};let rendered;
 const hooks={},adapter=createComparisonExportAdapter({cases:{async readSource(ref,{guard}){state.reads++;assert.equal(guard(),true);await hooks.read?.(ref);return {caseId:ref.caseId,revision:ref.expectedRevision,name:ref.caseId,output:{result:{kind:'thermal',temperature:[25]},marker:ref.caseId},assertCurrent(){state.checks++;if(!state.current)throw Error('source changed');}};}},getDefaults:()=>defaults,isBusy:()=>state.busy,renderComparison:args=>{state.renders++;rendered=args;hooks.render?.();return {canvas,panels:[{timeSeconds:5},{timeSeconds:5}],colorRange:{minimum:20,maximum:30},unit:'degC'};},encodePng:async c=>{assert.equal(c,canvas);state.encodes++;await hooks.encode?.();return new Blob(['comparison'],{type:'image/png'});}});
 return {adapter,state,defaults,request,hooks,guard:()=>state.valid,get rendered(){return rendered;}};
}
test('adapter freezes defaults, preserves source identities and encodes its retained canvas',async()=>{
 const f=fixture(),prepared=await f.adapter.prepare(f.request,{guard:f.guard});assert.equal(f.state.renders,1);assert.equal(prepared.comparison.cases.length,2);assert.match(prepared.comparison.cases[0].resultRevision,/^sha256:/);assert.equal(prepared.comparison.requestedTimeSeconds,5);assert.equal(f.rendered.field,'temperature');f.defaults.camera.position[0]=99;f.defaults.deformScale=99;assert.equal(prepared.view.camera.position[0],5);assert.equal(prepared.view.deformScale,2);
 const progress=[],blob=await f.adapter.render({...prepared,onProgress:p=>progress.push(p.fraction)});assert.equal(blob.type,'image/png');assert.equal(await blob.text(),'comparison');assert.deepEqual(progress,[0,1]);assert.ok(f.state.checks>=8);
});
test('invalid camera, scale, busy or expired guard refuses before leases and drawing',async()=>{
 for(const setup of [f=>{f.request.camera={...camera(),up:[0,0,0]};},f=>{f.request.deformScale=-1;},f=>{f.state.busy=true;},f=>{f.state.valid=false;}]){const f=fixture();setup(f);await assert.rejects(f.adapter.prepare(f.request,{guard:f.guard}));assert.equal(f.state.reads,0);assert.equal(f.state.renders,0);}
});
test('guard and source leases are checked after acquisition and synchronous rendering',async()=>{
 const a=fixture();a.hooks.read=()=>{a.state.valid=false;};await assert.rejects(a.adapter.prepare(a.request,{guard:a.guard}),/expired/);assert.equal(a.state.renders,0);
 for(const key of ['valid','current','busy']){const f=fixture();f.hooks.render=()=>{f.state[key]=key==='busy';};await assert.rejects(f.adapter.prepare(f.request,{guard:f.guard}),/expired|source changed|busy/);assert.equal(f.state.encodes,0);}
});
test('guard and source leases are checked after asynchronous hashing before rendering',async()=>{
 for(const key of ['valid','current','busy']){const f=fixture(),original=crypto.subtle.digest;crypto.subtle.digest=async function(...args){const out=await original.apply(this,args);f.state[key]=key==='busy';return out;};
 try{await assert.rejects(f.adapter.prepare(f.request,{guard:f.guard}),/source changed|expired|busy/);assert.equal(f.state.renders,0);}finally{crypto.subtle.digest=original;}}
});
test('encoding checks cancellation, expiry, busy state and changed source before exposing bytes',async()=>{
 for(const key of ['valid','current','busy','abort']){const f=fixture(),prepared=await f.adapter.prepare(f.request,{guard:f.guard}),controller=new AbortController();f.hooks.encode=async()=>{await Promise.resolve();if(key==='abort')controller.abort();else f.state[key]=key==='busy';};const progress=[];await assert.rejects(f.adapter.render({...prepared,signal:controller.signal,onProgress:p=>progress.push(p.fraction)}),/expired|changed|busy|cancelled/);assert.deepEqual(progress,[0]);}
 const f=fixture(),prepared=await f.adapter.prepare(f.request,{guard:f.guard}),controller=new AbortController();controller.abort();await assert.rejects(f.adapter.render({...prepared,signal:controller.signal}),/cancelled/);assert.equal(f.state.encodes,0);
});

test('thermal heat flux with shared time refuses after leases and before rendering',async()=>{
 const f=fixture();f.request.field='heatFlux';await assert.rejects(f.adapter.prepare(f.request,{guard:f.guard}),/final-step only/);assert.equal(f.state.reads,2);assert.equal(f.state.renders,0);assert.equal(f.state.encodes,0);
});
test('changed viewer defaults during source acquisition or hashing refuse before rendering',async()=>{
 const f=fixture();f.hooks.read=async()=>{await Promise.resolve();f.defaults.camera.position[0]=6;};await assert.rejects(f.adapter.prepare(f.request,{guard:f.guard}),/Viewer changed/);assert.equal(f.state.renders,0);
 const g=fixture(),original=crypto.subtle.digest;crypto.subtle.digest=async function(...args){const out=await original.apply(this,args);g.defaults.deformScale=3;return out;};
 try{await assert.rejects(g.adapter.prepare(g.request,{guard:g.guard}),/Viewer changed/);assert.equal(g.state.renders,0);}finally{crypto.subtle.digest=original;}
});
