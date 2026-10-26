import {fixedCodecEnv} from './helpers/single-view-fixed-codec.mjs';
import {getSingleViewAcousticTimeVerification,getSingleViewThermalTimeVerification} from '../src/single-view-time-webm.js';
import {webmTestEnv} from './helpers/webm-test-env.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installVisualExport,hasVideoFrames} from '../src/visual-export.js';

class Vector {
 constructor(x=1,y=2,z=3){Object.assign(this,{x,y,z});}
 clone(){return new Vector(this.x,this.y,this.z);}
 copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 applyAxisAngle(){this.x+=10;return this;}
}
const CLUSTER=Uint8Array.of(0x1a,0x45,0xdf,0xa3,0x1f,0x43,0xb6,0x75,0x76,0x69,0x64,0x65,0x6f);
function fixture({failure=false,emptyRecording=false,noChunks=false,recordingEnv={},acoustic=false,thermal=false,locale='en',sourceWidth=320,sourceHeight=200}={}){
 const previous=Object.fromEntries(['document','requestAnimationFrame','MediaRecorder'].map(k=>[k,globalThis[k]]));
 const elements=new Map(),frames=[],tracks=[{stopped:false,stop(){this.stopped=true;}}];let clicks=0,renders=0,recorder;const order=[];
 function element(id){if(!elements.has(id))elements.set(id,{id,disabled:false,value:'',checked:false,textContent:'',after(){},click(){clicks++;},dispatchEvent(){}});return elements.get(id);}
 for(const id of ['result-legend','name','section-summary','visual-export-status','visual-export-download','result-surface','result-surface-wire','view-png','animation-kind','animation-seconds','animation-preview','animation-save','animation-stop','cancel-run','clip-axis','deform-scale','clip-enabled','clip-position','agent-disconnect','result-field'])element(id);
 Object.assign(element('cancel-run'),{disabled:true});element('animation-kind').value='orbit';element('animation-seconds').value='1';element('clip-axis').value='0';element('deform-scale').value='2';element('clip-position').value='4';element('result-legend').textContent='20 → 100 °C';
 const draws=[],canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);},fillText(){}}),toBlob(cb,type){cb(new Blob(['png'],{type}));},captureStream(){return {getTracks:()=>tracks};}};
 globalThis.document={getElementById:id=>elements.get(id)??null,createElement:tag=>tag==='canvas'?canvas:{innerHTML:''},querySelectorAll:()=>[element('deform-scale'),element('clip-position'),element('animation-save'),element('agent-disconnect')]};
 globalThis.requestAnimationFrame=callback=>frames.push(callback);
 class Recorder {
 static isTypeSupported(type){return type==='video/webm';}
 constructor(){this.state='inactive';recorder=this;}
 start(){this.state='recording';}
 requestData(){order.push('requestData');}
 stop(){order.push('stop');this.state='inactive';if(!noChunks)this.ondataavailable?.({data:new Blob([emptyRecording?Uint8Array.of(0x1a,0x45,0xdf,0xa3):CLUSTER],{type:'video/webm'})});this.onstop?.();}
 }
 globalThis.MediaRecorder=Recorder;
 const camera={position:new Vector(),lookAt(){}},controls={target:new Vector(0,0,0),enabled:true,enableDamping:true};
 element('result-field').value=thermal?'temperature':'instantPressure';
 const output={mesh:{nodes:[0,0,0,1,1,1]},result:thermal?{kind:'thermal',transient:true,snapshots:[0,.2,.9,1.2].map(time=>({time,temperature:[20+time,30+time]}))}:acoustic?{kind:'acousticTransient',snapshots:[0,.2,.9,1.2].map(time=>({time,pressure:[time,2*time]}))}:{kind:'elastic'}};
 let current=output;const physical={timeSeconds:.35,frameIndex:1};const selected=[];if(acoustic||thermal){element('acoustic-time-frame').value='1';element('acoustic-time-frame').dispatchEvent=()=>{selected.push(Number(element('acoustic-time-frame').value));physical.frameIndex=Number(element('acoustic-time-frame').value);physical.timeSeconds=output.result.snapshots[physical.frameIndex].time;};}
 const api=installVisualExport({renderer:{domElement:{width:sourceWidth,height:sourceHeight},render(){renders++;if(failure)throw Error('renderer failed');}},scene:{},camera,controls,getAnalysis:()=>current,redraw(){},language:()=>locale,translate(){},recordingEnv,...(acoustic||thermal?{getTimeView:()=>structuredClone(physical),restoreTimeView:value=>{Object.assign(physical,value);element('acoustic-time-frame').value=String(value.frameIndex);}}:{})});
 return {order,api,canvas,controls,camera,tracks,elements,frames,draws,output,physical,selected,replaceOutput:value=>{current=value;},get recorder(){return recorder;},get clicks(){return clicks;},get renders(){return renders;},restore(){for(const [k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}

test('PNG export returns a PNG Blob with caption space and never initiates a download',async()=>{
 const f=fixture();try{const progress=[];const blob=await f.api.render({format:'png',onProgress:p=>progress.push(p.fraction)});assert.equal(blob.type,'image/png');assert.equal(await blob.text(),'png');assert.equal(f.canvas.width,320);assert.equal(f.canvas.height,316);assert.equal(f.clicks,0);assert.equal(f.renders,1);assert.deepEqual(progress,[0,1]);assert.equal(f.api.isActive(),false);assert.equal(f.api.capabilities().webm,true);assert.equal(f.api.capabilities().mp4,false);}finally{f.restore();}
});

test('WebM cancellation stops tracks, restores camera and controls, and produces no download',async()=>{
 const f=fixture();try{const controller=new AbortController(),saved=f.camera.position.clone();const promise=f.api.render({format:'webm',animation:'orbit',seconds:1,signal:controller.signal});assert.equal(f.api.isActive(),true);assert.equal(f.controls.enabled,false);f.frames.shift()(performance.now()+500);assert.notDeepEqual(f.camera.position,saved);controller.abort();f.frames.shift()(performance.now()+600);await assert.rejects(promise,/cancelled/);assert.deepEqual(f.camera.position,saved);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.elements.get('deform-scale').disabled,false);assert.equal(f.elements.get('animation-stop').disabled,true);assert.equal(f.tracks[0].stopped,true);assert.equal(f.api.isActive(),false);assert.equal(f.clicks,0);}finally{f.restore();}
});

test('WebM capture errors restore every locked control and active flag',async()=>{
 const f=fixture({failure:true});try{f.elements.get('clip-position').disabled=true;await assert.rejects(f.api.render({format:'webm',animation:'orbit',seconds:1}),/renderer failed/);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.elements.get('deform-scale').disabled,false);assert.equal(f.elements.get('clip-position').disabled,true);assert.equal(f.api.isActive(),false);assert.equal(f.clicks,0);}finally{f.restore();}
});

test('PNG cancellation during asynchronous encoding discards the artifact and releases active state',async()=>{
 const f=fixture();try{let encoded;f.canvas.toBlob=callback=>{encoded=callback;};const controller=new AbortController(),promise=f.api.render({format:'png',signal:controller.signal});assert.equal(f.api.isActive(),true);controller.abort();encoded(new Blob(['png'],{type:'image/png'}));await assert.rejects(promise,/cancelled/);assert.equal(f.api.isActive(),false);assert.equal(f.clicks,0);}finally{f.restore();}
});

test('completed WebM returns encoded bytes, restores view, and never downloads',async()=>{
 const f=fixture();try{const saved=f.camera.position.clone(),promise=f.api.render({format:'webm',animation:'orbit',seconds:1});f.frames.shift()(performance.now()+2000);const blob=await promise;assert.equal(blob.type,'video/webm');assert.ok((await blob.text()).endsWith('video'));assert.deepEqual(f.camera.position,saved);assert.equal(f.tracks[0].stopped,true);assert.equal(f.controls.enabled,true);assert.equal(f.api.isActive(),false);assert.equal(f.clicks,0);}finally{f.restore();}
});


test('recorder failure during playback rejects without unhandled rejection and restores resources',async()=>{
 const f=fixture();try{const saved=f.camera.position.clone(),promise=f.api.render({format:'webm',animation:'orbit',seconds:1});const rejected=assert.rejects(promise,/encoder failed/);assert.equal(f.controls.enabled,false);f.recorder.onerror({error:Error('encoder failed')});await new Promise(resolve=>setImmediate(resolve));f.frames.shift()(performance.now()+500);await rejected;assert.deepEqual(f.camera.position,saved);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.tracks[0].stopped,true);assert.equal(f.elements.get('deform-scale').disabled,false);assert.equal(f.api.isActive(),false);assert.equal(f.clicks,0);}finally{f.restore();}
});

test('MCP disconnect remains available during WebM playback and PNG encoding',async()=>{
 const f=fixture();try{const disconnect=f.elements.get('agent-disconnect'),promise=f.api.render({format:'webm',animation:'orbit',seconds:1});assert.equal(disconnect.disabled,false);f.api.stop();f.frames.shift()(performance.now()+500);await assert.rejects(promise,/cancelled/);let encoded;f.canvas.toBlob=callback=>{encoded=callback;};const png=f.api.render({format:'png'});assert.equal(disconnect.disabled,false);encoded(new Blob(['png'],{type:'image/png'}));await png;assert.equal(disconnect.disabled,false);}finally{f.restore();}
});

test('short WebM requests data before stop and returns a clip containing a Cluster',async()=>{
 const f=fixture();try{const promise=f.api.render({format:'webm',animation:'orbit',seconds:1});const r0=f.renders;f.frames.shift()(performance.now()+2000);const blob=await promise;assert.ok(f.renders>r0+1,'extra final frame rendered');assert.deepEqual(f.order,['requestData','stop']);assert.ok(await hasVideoFrames(blob));}finally{f.restore();}
});

test('WebM with header but zero Clusters fails explicitly instead of reporting an empty success',async()=>{
 const f=fixture({emptyRecording:true});try{const promise=f.api.render({format:'webm',animation:'orbit',seconds:1});f.frames.shift()(performance.now()+2000);await assert.rejects(promise,/no video frames/);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(f.tracks[0].stopped,true);}finally{f.restore();}
});

test('WebM recorder that emits no chunks fails explicitly',async()=>{
 const f=fixture({noChunks:true});try{const promise=f.api.render({format:'webm',animation:'orbit',seconds:1});f.frames.shift()(performance.now()+2000);await assert.rejects(promise,/no data/);}finally{f.restore();}
});

test('hasVideoFrames rejects empty and clusterless blobs',async()=>{
 assert.equal(await hasVideoFrames(new Blob([])),false);assert.equal(await hasVideoFrames(new Blob([new Uint8Array(110)])),false);assert.equal(await hasVideoFrames(new Blob([CLUSTER])),true);
});

test('capabilities keep legacy flags and add structured mp4/gif entries for both injected probe outcomes',()=>{
 const f=fixture();try{
  const caps=f.api.capabilities({mediaRecorder:{isTypeSupported:t=>t.startsWith('video/mp4')}}),none=f.api.capabilities({mediaRecorder:{isTypeSupported:()=>false}});
  for(const c of [caps,none]){assert.equal(c.png,true);assert.equal(c.mp4,false);assert.equal(c.gif,false);assert.equal(c.schemaVersion,1);assert.equal(c.maxSeconds,15);assert.equal(c.formats.mp4.supported,false);assert.equal(c.formats.gif.supported,false);}
  assert.equal(caps.formats.mp4.browserRecorderSupport,true);assert.equal(none.formats.mp4.browserRecorderSupport,false);assert.equal(none.webm,false);
  assert.equal(f.api.capabilities().webm,true);
 }finally{f.restore();}
});

test('single-viewer WebM background/stall rejects without a new frame and restores locks, view and controls',async()=>{
 for(const mode of ['hidden','stalled']){const clock=webmTestEnv(),f=fixture({recordingEnv:clock.env});try{const saved=f.camera.position.clone(),recording=f.api.render({format:'webm',animation:'orbit',seconds:1}),failure=assert.rejects(recording,{code:mode==='hidden'?'WEBM_BACKGROUND_INTERRUPTED':'WEBM_PROGRESS_STALLED'});if(mode==='hidden'){f.frames.shift()(performance.now()+250);clock.hide();}else clock.advance(5000);await failure;assert.deepEqual(f.camera.position,saved);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.api.isActive(),false);assert.equal(f.elements.get('deform-scale').disabled,false);assert.equal(f.tracks[0].stopped,true);assert.equal(f.clicks,0);assert.equal(clock.timers,0);}finally{f.restore();}}
});
test('single-viewer WebM missing stop event is bounded; hidden page still allows fixed PNG',async()=>{
 const clock=webmTestEnv(),f=fixture({recordingEnv:clock.env});try{const recording=f.api.render({format:'webm',animation:'orbit',seconds:1}),failure=assert.rejects(recording,{code:'WEBM_BACKGROUND_INTERRUPTED'});f.recorder.stop=()=>{f.recorder.state='inactive';};clock.hide();await Promise.resolve();await Promise.resolve();clock.advance(2000);await failure;assert.equal(f.tracks[0].stopped,true);assert.equal(f.controls.enabled,true);assert.equal(f.api.isActive(),false);assert.equal(clock.timers,0);const png=await f.api.render({format:'png'});assert.equal(png.type,'image/png');}finally{f.restore();}
});


for(const locale of ['ja','en'])test('single acoustic fixed-time export selects physical endpoints and restores interpolated time and UI ('+locale+')',async()=>{
 const codec=fixedCodecEnv(),f=fixture({acoustic:true,locale,recordingEnv:codec.env,sourceWidth:3840,sourceHeight:2160});try{const saved={camera:f.camera.position.clone(),physical:structuredClone(f.physical),scale:f.elements.get('deform-scale').value,clip:f.elements.get('clip-position').value};f.elements.get('clip-position').disabled=true;
 const blob=await f.api.render({format:'webm',animation:'time',seconds:1,expectedResultRevision:'sha256:'+'a'.repeat(64)});const proof=getSingleViewAcousticTimeVerification(blob);assert.equal(proof.frames[0].actualTimeSeconds,0);assert.equal(proof.frames.at(-1).actualTimeSeconds,1.2);assert.equal(f.selected[0],0);assert.equal(f.selected.at(-1),3);assert.equal(f.selected.length,24);assert.equal(f.frames.length,0,'fixed export never schedules requestAnimationFrame');assert.equal(f.recorder,undefined);assert.equal(f.clicks,0);assert.ok(f.canvas.width<=1280&&f.canvas.height<=640);assert.deepEqual(f.camera.position,saved.camera);assert.deepEqual(f.physical,saved.physical);assert.equal(f.elements.get('deform-scale').value,saved.scale);assert.equal(f.elements.get('clip-position').value,saved.clip);assert.equal(f.elements.get('clip-position').disabled,true);assert.equal(f.elements.get('agent-disconnect').disabled,false);assert.equal(f.elements.get('animation-stop').disabled,true);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.equal(f.api.isActive(),false);assert.equal(f.api.capabilities().singleTimeWebmExport.supported,true);
 }finally{f.restore();}
});
test('single acoustic fixed export abort/result replacement/stop refuses and restores host controls without downloads',async()=>{
 for(const mode of ['abort','replace','stop']){const codec=fixedCodecEnv(),f=fixture({acoustic:true,recordingEnv:codec.env}),controller=new AbortController(),saved=structuredClone(f.physical);try{let fired=false;codec.stats.onEncode=()=>{if(fired)return;fired=true;if(mode==='abort')controller.abort();else if(mode==='replace')f.replaceOutput({result:{kind:'elastic'}});else f.api.stop();};await assert.rejects(f.api.render({format:'webm',animation:'time',seconds:1,signal:controller.signal}),/cancelled|changed/);assert.equal(f.clicks,0);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(f.elements.get('agent-disconnect').disabled,false);assert.equal(f.elements.get('deform-scale').disabled,false);assert.equal(codec.stats.codecClosed,1);if(mode!=='replace')assert.deepEqual(f.physical,saved);}finally{f.restore();}}
});
test('single fixed capability rejects before viewer changes and preview still uses the old rAF semantics',async()=>{
 const f=fixture({acoustic:true});try{const saved=structuredClone(f.physical);assert.equal(f.api.capabilities().singleTimeWebmExport.supported,false);await assert.rejects(f.api.render({format:'webm',animation:'time',seconds:1}),{code:'WEBM_FIXED_UNSUPPORTED'});assert.equal(f.api.isActive(),false);assert.deepEqual(f.physical,saved);assert.equal(f.clicks,0);
 f.elements.get('animation-kind').value='time';f.elements.get('animation-seconds').value='1';const preview=f.elements.get('animation-preview').onclick();assert.equal(f.api.isActive(),true);assert.equal(f.frames.length,1);f.frames.shift()(performance.now()+2000);await preview;assert.equal(f.selected.at(-1),3);assert.deepEqual(f.physical,saved);assert.equal(f.recorder,undefined);
 }finally{f.restore();}
});

for(const locale of ['ja','en'])test('thermal Save uses fixed codec, restores interpolated state and refuses final-only flux ('+locale+')',async()=>{
 const codec=fixedCodecEnv(),f=fixture({thermal:true,locale,recordingEnv:codec.env,sourceWidth:3840,sourceHeight:2160});try{const saved=structuredClone(f.physical);f.elements.get('animation-kind').value='time';f.elements.get('animation-seconds').value='1';await f.elements.get('animation-save').onclick();assert.equal(f.clicks,1);assert.equal(f.selected[0],0);assert.equal(f.selected.at(-1),3);assert.equal(f.selected.length,24);assert.deepEqual(f.physical,saved);assert.equal(f.controls.enabled,true);assert.equal(f.api.isActive(),false);assert.equal(f.recorder,undefined);assert.equal(f.api.capabilities().singleTimeWebmExport.field,'instantPressure');assert.equal(f.api.capabilities().singleThermalTimeWebmExport.field,'temperature');f.elements.get('result-field').value='heatFlux';await assert.rejects(f.api.render({format:'webm',animation:'time',seconds:1}),/temperature/);assert.equal(f.api.isActive(),false);assert.deepEqual(f.physical,saved);assert.equal(f.clicks,1);
 }finally{f.restore();}
});

test('thermal abort or mid-export field change restores UI and never downloads; preview remains refused',async()=>{
 for(const mode of ['abort','field']){const codec=fixedCodecEnv(),f=fixture({thermal:true,recordingEnv:codec.env}),controller=new AbortController(),saved=structuredClone(f.physical);try{codec.stats.onEncode=()=>{if(mode==='abort')controller.abort();else f.elements.get('result-field').value='heatFlux';};await assert.rejects(f.api.render({format:'webm',animation:'time',seconds:1,signal:controller.signal}),/cancelled|changed/);assert.deepEqual(f.physical,saved);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(f.clicks,0);f.elements.get('animation-kind').value='time';await f.elements.get('animation-preview').onclick();assert.equal(f.api.isActive(),false);assert.equal(f.frames.length,0);}finally{f.restore();}}
});

test('thermal codec absence refuses before changing the viewer or publishing a download',async()=>{const f=fixture({thermal:true});try{const saved=structuredClone(f.physical);assert.equal(f.api.capabilities().singleThermalTimeWebmExport.supported,false);await assert.rejects(f.api.render({format:'webm',animation:'time',seconds:1}),{code:'WEBM_FIXED_UNSUPPORTED'});assert.deepEqual(f.physical,saved);assert.equal(f.clicks,0);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);}finally{f.restore();}});
