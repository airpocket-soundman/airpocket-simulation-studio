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
function fixture({failure=false,emptyRecording=false,noChunks=false}={}){
 const previous=Object.fromEntries(['document','requestAnimationFrame','MediaRecorder'].map(k=>[k,globalThis[k]]));
 const elements=new Map(),frames=[],tracks=[{stopped:false,stop(){this.stopped=true;}}];let clicks=0,renders=0,recorder;const order=[];
 function element(id){if(!elements.has(id))elements.set(id,{id,disabled:false,value:'',checked:false,textContent:'',after(){},click(){clicks++;},dispatchEvent(){}});return elements.get(id);}
 for(const id of ['result-legend','name','section-summary','visual-export-status','visual-export-download','result-surface','result-surface-wire','view-png','animation-kind','animation-seconds','animation-preview','animation-save','animation-stop','cancel-run','clip-axis','deform-scale','clip-enabled','clip-position','agent-disconnect'])element(id);
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
 const output={mesh:{nodes:[0,0,0,1,1,1]},result:{kind:'elastic'}};
 const api=installVisualExport({renderer:{domElement:{width:320,height:200},render(){renders++;if(failure)throw Error('renderer failed');}},scene:{},camera,controls,getAnalysis:()=>output,redraw(){},language:()=> 'en',translate(){}});
 return {order,api,canvas,controls,camera,tracks,elements,frames,draws,get recorder(){return recorder;},get clicks(){return clicks;},get renders(){return renders;},restore(){for(const [k,v]of Object.entries(previous)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
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
