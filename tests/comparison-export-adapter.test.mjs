import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonExportAdapter} from '../src/comparison-export-adapter.js';
const camera=()=>({position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40});
function fixture({video=false}={}){
 const state={valid:true,busy:false,current:true,reads:0,renders:0,encodes:0,checks:0,locks:0,releases:0},defaults={camera:camera(),deformScale:2},canvas={width:1280,height:640},references=[{caseId:'a',expectedRevision:'a-rev'},{caseId:'b',expectedRevision:'b-rev'}];
 const request={requestId:'pair',references,field:'temperature',timeSeconds:5};let rendered;
 const hooks={},adapter=createComparisonExportAdapter({cases:{async readSource(ref,{guard}){state.reads++;assert.equal(guard(),true);await hooks.read?.(ref);return {caseId:ref.caseId,revision:ref.expectedRevision,name:ref.caseId,output:{result:{kind:'thermal',temperature:[25]},marker:ref.caseId},assertCurrent(){state.checks++;if(!state.current)throw Error('source changed');}};}},getDefaults:()=>defaults,isBusy:()=>state.busy,renderComparison:args=>{state.renders++;rendered=args;hooks.render?.();return {canvas,panels:[{timeSeconds:5},{timeSeconds:5}],colorRange:{minimum:20,maximum:30},unit:'degC'};},...(video?{acquireHostLock:()=>{state.locks++;state.busy=true;return {assertOwned(){if(state.lostLock)throw Error('lock lost');},release(){state.releases++;state.busy=false;}};},recordVideo:args=>hooks.video(args)}:{}),encodePng:async c=>{assert.equal(c,canvas);state.encodes++;await hooks.encode?.();return new Blob(['comparison'],{type:'image/png'});}});
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

test('WebM orbit holds owned lock while preserving fixed field time range and releases on success',async()=>{
 const f=fixture({video:true}),prepared=await f.adapter.prepare(f.request,{guard:f.guard}),frames=[];f.hooks.render=()=>frames.push(f.rendered);
 f.hooks.video=async({initialCanvas,renderFrame,camera,seconds})=>{assert.equal(f.state.busy,true);assert.equal(initialCanvas.width,1280);assert.equal(seconds,2);assert.equal(camera.fov,40);for(const position of [[6,5,4],[4,5,6]])renderFrame({...camera,position});return new Blob(['video'],{type:'video/webm'});};
 const blob=await f.adapter.render({...prepared,format:'webm',seconds:2});assert.equal(blob.type,'video/webm');assert.equal(frames.length,2);for(const frame of frames){assert.equal(frame.field,'temperature');assert.equal(frame.timeSeconds,5);assert.equal(frame.deformScale,2);assert.deepEqual(frame.colorRange,{minimum:20,maximum:30});}assert.equal(f.state.locks,1);assert.equal(f.state.releases,1);assert.equal(f.state.busy,false);assert.equal(f.state.encodes,0);
});
test('WebM releases host lock on recording error cancellation expiry source changes and lock loss',async()=>{
 for(const mode of ['failure','cancel','expired','source','lostLock']){const f=fixture({video:true}),prepared=await f.adapter.prepare(f.request,{guard:f.guard}),controller=new AbortController();f.hooks.video=async({renderFrame,camera})=>{await Promise.resolve();if(mode==='failure')throw Error('recorder failed');if(mode==='cancel')controller.abort();if(mode==='expired')f.state.valid=false;if(mode==='source')f.state.current=false;if(mode==='lostLock')f.state.lostLock=true;renderFrame(camera);return new Blob(['late'],{type:'video/webm'});};await assert.rejects(f.adapter.render({...prepared,format:'webm',seconds:1,signal:controller.signal}),/failed|cancelled|expired|changed|lost/);assert.equal(f.state.locks,1,mode);assert.equal(f.state.releases,1,mode);assert.equal(f.state.busy,false,mode);}
});
test('WebM checks leases after recorder resolves and PNG never acquires host video lock',async()=>{
 const f=fixture({video:true}),prepared=await f.adapter.prepare(f.request,{guard:f.guard});f.hooks.video=async()=>{f.state.current=false;return new Blob(['late'],{type:'video/webm'});};await assert.rejects(f.adapter.render({...prepared,format:'webm',seconds:1}),/changed/);assert.equal(f.state.releases,1);
 const g=fixture({video:true}),png=await g.adapter.prepare(g.request,{guard:g.guard});assert.equal((await g.adapter.render(png)).type,'image/png');assert.equal(g.state.locks,0);assert.equal(g.state.encodes,1);
});

test('time WebM preflights the whole interval, keeps the camera fixed and reuses global range on every tick',async()=>{
 const outputs=[[0,4,10],[0,6,10]].map((times,i)=>({mesh:{nodes:[0,0,0]},result:{kind:'thermal',transient:true,snapshots:times.map((time,k)=>({time,temperature:[[[-50,20,300],[-100,50,90]][i][k]]}))}}));
 const before=structuredClone(outputs),calls=[];let locks=0,releases=0;
 const adapter=createComparisonExportAdapter({cases:{readSource:async ref=>({caseId:ref.caseId,revision:'rev',name:ref.caseId,output:outputs[Number(ref.caseId)],assertCurrent(){}})},getDefaults:()=>({camera:camera(),deformScale:0}),renderComparison:args=>{calls.push(args);return {canvas:{width:1280,height:640},panels:[],colorRange:args.colorRange,unit:'degC'};},acquireHostLock:()=>{locks++;return {assertOwned(){},release(){releases++;}};},recordVideo:async({renderFrame,camera:shared,animation})=>{assert.equal(animation,'time');for(const phase of [0,.5,1])renderFrame({...shared,position:[99,99,99]},{phase});return new Blob(['video'],{type:'video/webm'});}});
 const request={format:'webm',animation:'time',references:[{caseId:'0'},{caseId:'1'}],field:'temperature',startTimeSeconds:2.1,endTimeSeconds:7.1,toleranceSeconds:3};
 const prepared=await adapter.prepare(request);assert.deepEqual(prepared.comparison.colorRange,{field:'temperature',minimum:-100,maximum:300});assert.equal(prepared.comparison.timeAnimation.camera,'fixed');assert.equal(prepared.comparison.timeAnimation.initial.timeSeconds,2.1);
 await adapter.render({...prepared,format:'webm',animation:'time',seconds:2});
 assert.deepEqual(calls.map(c=>c.timeSeconds),[2.1,2.1,4.6,7.1]);assert.ok(calls.every(c=>JSON.stringify(c.camera)===JSON.stringify(camera())));assert.ok(calls.every(c=>c.colorRange.minimum===-100&&c.colorRange.maximum===300));assert.equal(locks,1);assert.equal(releases,1);assert.deepEqual(outputs,before);
 const rendered=calls.length;await assert.rejects(adapter.prepare({...request,toleranceSeconds:0}),/tolerance/);await assert.rejects(adapter.prepare({...request,startTimeSeconds:-1}),/physical time range/);assert.equal(calls.length,rendered);
});

test('time recording releases the host lock after frame/source/cancellation failures and retains the displayed view',async()=>{
 for(const failure of ['recorder','source','cancel']){
  const output={mesh:{nodes:[0,0,0]},result:{kind:'thermal',transient:true,snapshots:[{time:0,temperature:[20]},{time:5,temperature:[25]},{time:10,temperature:[30]}]}},view={camera:camera(),frame:2,timeSeconds:2.01,field:'temperature'},before=structuredClone(view),controller=new AbortController();
  let sourceCurrent=true,locked=false,releases=0;
  const adapter=createComparisonExportAdapter({cases:{readSource:async ref=>({caseId:ref.caseId,revision:'rev',name:ref.caseId,output,assertCurrent(){if(!sourceCurrent)throw Error('Source changed');}})},getDefaults:()=>({camera:camera(),deformScale:0}),renderComparison:args=>{const keep=structuredClone(view);try{view.timeSeconds=args.timeSeconds;view.camera=args.camera;return {canvas:{width:1280,height:640},panels:[],colorRange:args.colorRange,unit:'degC'};}finally{Object.assign(view,keep);}},acquireHostLock:()=>{locked=true;return {assertOwned(){assert.equal(locked,true);},release(){locked=false;releases++;}};},recordVideo:async({renderFrame,camera:shared})=>{renderFrame(shared,{phase:.5});if(failure==='recorder')throw Error('Recorder failed');if(failure==='source')sourceCurrent=false;else controller.abort();renderFrame(shared,{phase:1});}});
  const prepared=await adapter.prepare({format:'webm',animation:'time',field:'temperature',references:[{caseId:'a'},{caseId:'b'}],startTimeSeconds:0,endTimeSeconds:10});
  await assert.rejects(adapter.render({...prepared,format:'webm',animation:'time',seconds:2,signal:controller.signal}),/failed|changed|cancelled/);
  assert.equal(locked,false);assert.equal(releases,1);assert.deepEqual(view,before);
 }
});
