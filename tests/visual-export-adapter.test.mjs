import {getSingleStoredTimeGifVerification} from '../src/ui/single-stored-time-gif.js';
import {PerspectiveCamera,Vector3} from 'three';
import {getSingleOrbitGifVerification} from '../src/ui/single-orbit-gif.js';
import {orbitGifEnv} from './helpers/orbit-gif-env.mjs';
import {decodeGif} from './helpers/gif-decode.mjs';
import {fixedCodecEnv} from './helpers/single-view-fixed-codec.mjs';
import {getSingleViewAcousticTimeVerification,getSingleViewThermalTimeVerification} from '../src/single-view-time-webm.js';
import {webmTestEnv} from './helpers/webm-test-env.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installVisualExport,hasVideoFrames} from '../src/visual-export.js';

class Vector {
 constructor(x=1,y=2,z=3){Object.assign(this,{x,y,z});}
 clone(){return new Vector(this.x,this.y,this.z);}
 toArray(){return [this.x,this.y,this.z];}
 copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
 applyAxisAngle(){this.x+=10;return this;}
}
const CLUSTER=Uint8Array.of(0x1a,0x45,0xdf,0xa3,0x1f,0x43,0xb6,0x75,0x76,0x69,0x64,0x65,0x6f);
function fixture({failure=false,emptyRecording=false,noChunks=false,recordingEnv={},acoustic=false,thermal=false,realTimeView=false,locale='en',sourceWidth=320,sourceHeight=200,cameraOverride,targetOverride,onRender=()=>{}}={}){
 const previous=Object.fromEntries(['document','requestAnimationFrame','MediaRecorder'].map(k=>[k,globalThis[k]]));
 const elements=new Map(),frames=[],tracks=[{stopped:false,stop(){this.stopped=true;}}];let clicks=0,renders=0,recorder;const order=[];
 function element(id){if(!elements.has(id))elements.set(id,{id,disabled:false,value:'',checked:false,textContent:'',after(){},click(){clicks++;},dispatchEvent(){}});return elements.get(id);}
 for(const id of ['result-legend','name','section-summary','visual-export-status','visual-export-download','result-surface','result-surface-wire','view-png','animation-kind','animation-seconds','animation-preview','animation-save','animation-gif-save','animation-stop','cancel-run','clip-axis','deform-scale','clip-enabled','clip-position','agent-disconnect','result-field','color-fixed','color-min','color-max','result-mode'])element(id);
 Object.assign(element('cancel-run'),{disabled:true});element('animation-kind').value='orbit';element('animation-seconds').value='1';element('clip-axis').value='0';element('deform-scale').value='2';element('clip-position').value='4';element('result-legend').textContent='20 → 100 °C';
 const draws=[],texts=[],canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);},fillText(...args){texts.push(args);}}),toBlob(cb,type){cb(new Blob(['png'],{type}));},captureStream(){return {getTracks:()=>tracks};}};
 globalThis.document={getElementById:id=>elements.get(id)??null,createElement:tag=>tag==='canvas'?canvas:{innerHTML:''},querySelectorAll:()=>[element('deform-scale'),element('clip-position'),element('animation-save'),element('animation-gif-save'),element('agent-disconnect')]};
 globalThis.requestAnimationFrame=callback=>frames.push(callback);
 class Recorder {
 static isTypeSupported(type){return type==='video/webm';}
 constructor(){this.state='inactive';recorder=this;}
 start(){this.state='recording';}
 requestData(){order.push('requestData');}
 stop(){order.push('stop');this.state='inactive';if(!noChunks)this.ondataavailable?.({data:new Blob([emptyRecording?Uint8Array.of(0x1a,0x45,0xdf,0xa3):CLUSTER],{type:'video/webm'})});this.onstop?.();}
 }
 globalThis.MediaRecorder=Recorder;
 const camera=cameraOverride??{position:new Vector(),up:new Vector(0,1,0),fov:40,orientationUp:[0,1,0],updateProjectionMatrix(){},lookAt(x,y,z){assert.ok(x instanceof Vector||Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z),'lookAt requires a vector or three numeric coordinates');this.orientationUp=this.up.toArray();}},controls={target:targetOverride??new Vector(0,0,0),enabled:true,enableDamping:true};
 element('result-field').value=thermal?'temperature':'instantPressure';
 const output={mesh:{nodes:[0,0,0,1,1,1]},result:thermal?{kind:'thermal',transient:true,snapshots:[0,.2,.9,1.2].map(time=>({time,temperature:[20+time,30+time]}))}:acoustic?{kind:'acousticTransient',snapshots:[0,.2,.9,1.2].map(time=>({time,pressure:[time,2*time]}))}:{kind:'elastic'}};
 let current=output;const physical={timeSeconds:.35,frameIndex:1};const selected=[];if(acoustic||thermal){element('acoustic-time-frame').value='1';element('acoustic-time-frame').dispatchEvent=()=>{selected.push(Number(element('acoustic-time-frame').value));physical.frameIndex=Number(element('acoustic-time-frame').value);physical.timeSeconds=output.result.snapshots[physical.frameIndex].time;};}
 const sourceElement={width:sourceWidth,height:sourceHeight};
 const api=installVisualExport({renderer:{domElement:sourceElement,render(){renders++;onRender(camera);if(failure)throw Error('renderer failed');}},scene:{},camera,controls,getAnalysis:()=>current,redraw(){},language:()=>locale,translate(){},recordingEnv,...(acoustic||thermal?{getTimeView:()=>realTimeView?{state:structuredClone(physical),controls:[{id:'acoustic-time-frame',key:'value',value:element('acoustic-time-frame').value}]}:structuredClone(physical),restoreTimeView:value=>{Object.assign(physical,realTimeView?value.state:value);element('acoustic-time-frame').value=realTimeView?value.controls[0].value:String(value.frameIndex);}}:{})});
 return {order,api,canvas,controls,camera,tracks,elements,frames,draws,texts,resizeSource(){sourceElement.width++;},output,physical,selected,replaceOutput:value=>{current=value;},get recorder(){return recorder;},get clicks(){return clicks;},get renders(){return renders;},restore(){for(const [k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
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

for(const locale of ['ja','en'])test('orbit GIF GUI Save uses caption-wide640 layout, freezes thermal2s and matches API bytes ('+locale+')',async()=>{
 const gif=orbitGifEnv(),f=fixture({thermal:true,realTimeView:true,locale,recordingEnv:gif.env,sourceWidth:440,sourceHeight:521});try{f.output.result.snapshots=[0,5,10].map(time=>({time,temperature:[20+time,20+time]}));f.physical.timeSeconds=2;f.physical.frameIndex=0;f.elements.get('acoustic-time-frame').value='0';const saved={camera:f.camera.position.clone(),physical:structuredClone(f.physical)};f.elements.get('animation-kind').value='orbit';f.elements.get('animation-seconds').value='2';const blob=await f.api.render({format:'gif',animation:'orbit',seconds:2}),bytes=new Uint8Array(await blob.arrayBuffer()),decoded=decodeGif(bytes),verification=getSingleOrbitGifVerification(blob);assert.equal(f.elements.get('visual-export-status').textContent,locale==='en'?'GIF frames created.':'GIF\u306e\u30d5\u30ec\u30fc\u30e0\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f\u3002');assert.equal(verification.interpolated,true);assert.equal(verification.viewerFrameIndex,0);assert.equal(verification.viewTimeSeconds,2);assert.equal(decoded.frames.length,24);assert.equal(decoded.frames.reduce((n,f)=>n+f.delay,0),200);assert.equal(f.canvas.width,640);assert.equal(f.canvas.height,320);assert.ok(f.draws.every(d=>d[3]/d[4]>0.84&&d[3]/d[4]<0.85));assert.ok(f.texts.some(t=>String(t[0]).includes('°C')&&t[3]===608));assert.ok(f.texts.some(t=>String(t[0]).includes('2.0000')&&t[3]===608));assert.deepEqual(f.camera.position,saved.camera);assert.deepEqual(f.physical,saved.physical);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(f.elements.get('animation-gif-save').disabled,false);assert.equal(f.elements.get('agent-disconnect').disabled,false);
 let download;const create=URL.createObjectURL;URL.createObjectURL=value=>{download=value;return 'blob:test-gif';};try{await f.elements.get('animation-gif-save').onclick();}finally{URL.createObjectURL=create;}assert.equal(f.clicks,1);assert.equal(f.elements.get('visual-export-download').download,'simulation-orbit.gif');assert.deepEqual(new Uint8Array(await download.arrayBuffer()),bytes);assert.deepEqual(f.physical,saved.physical);assert.equal(f.api.capabilities().singleOrbitGifExport.supported,true);assert.equal(f.api.capabilities().gif,true);
 }finally{f.restore();}
});

test('same-revision GIF field/time/range/viewport changes, result replacement and abort refuse output and restore host ownership',async()=>{
 for(const mode of ['field','time','range','resize','replace','abort']){const gif=orbitGifEnv(),f=fixture({thermal:true,recordingEnv:gif.env}),controller=new AbortController(),saved={camera:f.camera.position.clone(),physical:structuredClone(f.physical),field:f.elements.get('result-field').value,color:f.elements.get('color-max').value};let turns=0;
  gif.env.yieldControl=async()=>{if(++turns!==2)return;if(mode==='field')f.elements.get('result-field').value='heatFlux';if(mode==='time')f.physical.timeSeconds=.7;if(mode==='range')f.elements.get('color-max').value='999';if(mode==='resize')f.resizeSource();if(mode==='replace')f.replaceOutput({result:{kind:'elastic'}});if(mode==='abort')controller.abort();};
  try{await assert.rejects(f.api.render({format:'gif',animation:'orbit',seconds:1,signal:controller.signal}),/changed|cancelled/);assert.equal(f.clicks,0);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(f.controls.enableDamping,true);assert.deepEqual(f.camera.position,saved.camera);assert.equal(f.elements.get('animation-gif-save').disabled,false);if(mode!=='replace'){assert.deepEqual(f.physical,saved.physical);assert.equal(f.elements.get('result-field').value,saved.field);assert.equal(f.elements.get('color-max').value,saved.color);}}finally{f.restore();}
 }
});

test('orbit-only GIF action refuses other panel animation kinds without modifying viewer',async()=>{const gif=orbitGifEnv(),f=fixture({thermal:true,recordingEnv:gif.env});try{const saved=structuredClone(f.physical);for(const kind of ['deformation','slice']){f.elements.get('animation-kind').value=kind;await f.elements.get('animation-gif-save').onclick();assert.equal(f.clicks,0);assert.equal(f.api.isActive(),false);assert.deepEqual(f.physical,saved);assert.match(f.elements.get('visual-export-status').textContent,/orbit only/);}}finally{f.restore();}});


test('modal onchange closure and camera up/fov changes are refused and restored with the same result revision',async()=>{
 for(const kind of ['mode','up','fov']){const gif=orbitGifEnv(),f=fixture({recordingEnv:gif.env});f.output.result={kind:'modal',modes:[{},{}]};f.elements.get('result-field').value='displacement';const select=f.elements.get('result-mode');select.value='0';let modeIndex=0;select.onchange=()=>modeIndex=Number(select.value);select.dispatchEvent=e=>{if(e.type==='change')select.onchange();};let turns=0;
  gif.env.yieldControl=async()=>{if(++turns!==2)return;if(kind==='mode'){select.value='1';select.dispatchEvent(new Event('change'));}if(kind==='up')f.camera.up.x=.5;if(kind==='fov')f.camera.fov=50;};
  try{await assert.rejects(f.api.render({format:'gif',animation:'orbit',seconds:1}),/changed/);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(select.value,'0');assert.equal(modeIndex,0);assert.deepEqual(f.camera.up.toArray(),[0,1,0]);assert.equal(f.camera.fov,40);assert.deepEqual(f.camera.orientationUp,[0,1,0]);assert.equal(f.clicks,0);}finally{f.restore();}
 }
});


test('real Three camera keeps all 24 orbit captures finite, aimed at target and model bounds inside view',async()=>{
 const invalid=new PerspectiveCamera(40,440/521,.1,1000);invalid.position.set(61,41,84);invalid.lookAt({x:5,y:5,z:20});assert.ok(invalid.quaternion.toArray().some(v=>!Number.isFinite(v)),'plain xyz object reproduces the unsupported Three lookAt overload');
 const camera=new PerspectiveCamera(40,440/521,.1,1000),target=new Vector3(5,5,20);camera.position.set(61,41,84);camera.lookAt(target);camera.updateMatrixWorld(true);
 const saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov},captures=[];
 const gif=orbitGifEnv(),f=fixture({thermal:true,realTimeView:true,recordingEnv:gif.env,sourceWidth:440,sourceHeight:521,cameraOverride:camera,targetOverride:target,onRender:c=>{
  c.updateMatrixWorld(true);assert.ok([...c.quaternion.toArray(),...c.matrixWorld.elements,...c.projectionMatrix.elements].every(Number.isFinite));
  const direction=c.getWorldDirection(new Vector3()),expected=target.clone().sub(c.position).normalize();assert.ok(direction.distanceTo(expected)<1e-12);assert.ok(direction.toArray().every(Number.isFinite));
  for(const x of [0,10])for(const y of [0,10])for(const z of [0,40]){const projected=new Vector3(x,y,z).project(c);assert.ok(projected.toArray().every(Number.isFinite));assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&projected.z>-1&&projected.z<1,'model bounds remain inside the capture frustum');}
  captures.push(c.position.toArray());
 }});
 try{f.output.result.snapshots=[0,5,10].map(time=>({time,temperature:[20+time,20+time]}));f.physical.timeSeconds=2;f.physical.frameIndex=0;await f.api.render({format:'gif',animation:'orbit',seconds:2});assert.equal(captures.length,24);assert.equal(new Set(captures.map(JSON.stringify)).size,24);assert.deepEqual(camera.position,saved.position);assert.ok(camera.quaternion.angleTo(saved.quaternion)<1e-7);assert.deepEqual(camera.up,saved.up);assert.equal(camera.fov,saved.fov);assert.equal(f.clicks,0);}finally{f.restore();}
});

for(const thermal of [true,false])test('stored-time GIF adapter uses both endpoints with requested/actual captions and exact interpolated viewer restore '+(thermal?'thermal':'acoustic'),async()=>{const gif=orbitGifEnv(),f=fixture({thermal,acoustic:!thermal,realTimeView:true,recordingEnv:gif.env,sourceWidth:440,sourceHeight:521});try{const saved={camera:f.camera.position.clone(),target:f.controls.target.clone(),physical:structuredClone(f.physical)},revision='sha256:'+'d'.repeat(64);assert.equal(f.api.capabilities().singleStoredTimeGifExport.supported,true);f.api.preflight({format:'gif',animation:'time',seconds:2});const blob=await f.api.render({format:'gif',animation:'time',seconds:2,expectedResultRevision:revision}),proof=getSingleStoredTimeGifVerification(blob);assert.equal(proof.frames.length,24);assert.equal(proof.frames[0].snapshotIndex,0);assert.equal(proof.frames.at(-1).snapshotIndex,3);assert.equal(proof.frames.at(-1).actualTimeSeconds,1.2);assert.equal(proof.frames.at(-1).offsetSeconds,0);assert.equal(proof.sourceResultRevision,revision);assert.ok(f.texts.some(t=>String(t[0]).includes('Stored time')&&String(t[0]).includes('requested')&&String(t[0]).includes('offset')));assert.deepEqual(f.physical,saved.physical);assert.deepEqual(f.camera.position,saved.camera);assert.deepEqual(f.controls.target,saved.target);assert.equal(f.controls.enabled,true);assert.equal(f.api.isActive(),false);assert.equal(f.elements.get('animation-gif-save').disabled,false);assert.equal(f.elements.get('agent-disconnect').disabled,false);assert.equal(f.recorder,undefined);assert.equal(f.clicks,0);}finally{f.restore();}});

test('stored-time GIF field/camera/history replacement/result change and pending cancellation reject with exact restore',async()=>{for(const mode of ['field','camera','history','replace','abort']){const gif=orbitGifEnv(),controller=new AbortController(),f=fixture({thermal:true,realTimeView:true,recordingEnv:gif.env});const saved=structuredClone(f.physical),camera=f.camera.position.clone();let first=true;gif.env.yieldControl=async()=>{if(first){first=false;if(mode==='field')f.elements.get('result-field').value='heatFlux';if(mode==='camera')f.camera.position.x++;if(mode==='history')f.output.result.snapshots[1]={...f.output.result.snapshots[1]};if(mode==='replace')f.replaceOutput({...f.output});if(mode==='abort')controller.abort();}};try{await assert.rejects(f.api.render({format:'gif',animation:'time',seconds:2,signal:controller.signal}),e=>['GIF_TIME_INVALID','GIF_TIME_CANCELLED'].includes(e.code));assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.equal(f.elements.get('animation-gif-save').disabled,false);assert.deepEqual(f.camera.position,camera);if(mode!=='replace')assert.deepEqual(f.physical,saved);assert.equal(f.clicks,0);}finally{f.restore();}}});

test('stored-time GIF pending-yield cancellation keeps renderer and controls locked until cooperative yield finishes',async()=>{const gif=orbitGifEnv();let wake;gif.env.yieldControl=()=>new Promise(resolve=>wake=resolve);const f=fixture({thermal:true,realTimeView:true,recordingEnv:gif.env}),controller=new AbortController(),before=structuredClone(f.physical);try{const p=f.api.render({format:'gif',animation:'time',seconds:2,signal:controller.signal});controller.abort();let settled=false;p.finally(()=>{settled=true;}).catch(()=>{});await new Promise(r=>setImmediate(r));assert.equal(settled,false);assert.equal(f.api.isActive(),true);assert.equal(f.controls.enabled,false);assert.equal(f.elements.get('animation-gif-save').disabled,true);wake();await assert.rejects(p,{code:'GIF_TIME_CANCELLED'});assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);assert.deepEqual(f.physical,before);}finally{f.restore();}});

test('stored-time GIF metadata capture ignores user-supplied map hook and cancellation still restores',async()=>{const gif=orbitGifEnv(),f=fixture({thermal:true,realTimeView:true,recordingEnv:gif.env}),controller=new AbortController();let calls=0;f.output.result.snapshots.map=()=>{calls++;throw Error('Snapshot map hook invoked');};try{const p=f.api.render({format:'gif',animation:'time',seconds:2,signal:controller.signal});controller.abort();await assert.rejects(p,{code:'GIF_TIME_CANCELLED'});assert.equal(calls,0);assert.equal(f.api.isActive(),false);assert.equal(f.controls.enabled,true);}finally{f.restore();}});
