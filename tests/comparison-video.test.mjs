import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordComparisonVideo,comparisonVideoCapabilities} from '../src/ui/comparison-video.js';

const camera=()=>({position:[10,5,3],target:[0,1,3],up:[0,1,0],fov:40});
const validBytes=new Uint8Array([0x1a,0x45,0xdf,0xa3,0x1f,0x43,0xb6,0x75,1]);
function harness({empty=false,headerOnly=false,maxBytes,constructorFails=false,copyFails=false,renderFails=false}={}){
 let now=0,sequence=0,recorder,trackStops=0,requestedFrames=0,streamRate,recorderStarts=0;
 const pending=new Map(),cameras=[],progress=[],copied=[];
 const track={stop(){trackStops++;},requestFrame(){requestedFrames++;}},stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const canvas={width:1280,height:640,captureStream(rate){streamRate=rate;return stream;},getContext:()=>({clearRect(){},drawImage(frame){if(copyFails)throw Error('Copy failed');copied.push(frame);}})};
 class Recorder{
  static isTypeSupported(type){return type==='video/webm;codecs=vp8';}
  constructor(){if(constructorFails)throw Error('Recorder initialization failed');this.state='inactive';recorder=this;}
  start(timeslice){this.state='recording';recorderStarts++;assert.equal(timeslice,250);}
  requestData(){}
  stop(){this.state='inactive';if(!empty)this.ondataavailable({data:new Blob([headerOnly?validBytes.slice(0,4):validBytes])});this.onstop();}
 }
 const env={MediaRecorder:Recorder,now:()=>now,flushWait:async milliseconds=>assert.equal(milliseconds,150),requestAnimationFrame:callback=>{const id=++sequence;pending.set(id,callback);return id;},cancelAnimationFrame:id=>pending.delete(id),...(maxBytes?{maxBytes}:{})};
 const request={initialCanvas:canvas,camera:camera(),seconds:1,renderFrame(value){cameras.push(value);if(renderFails)throw Error('Render failed');return {width:1280,height:640};},onProgress:value=>progress.push(value)};
 return {request,env,cameras,progress,copied,get recorder(){return recorder;},get trackStops(){return trackStops;},get streamRate(){return streamRate;},get recorderStarts(){return recorderStarts;},get requestedFrames(){return requestedFrames;},get pending(){return pending.size;},advance(time){now=time;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(time));}};
}

test('real-time orbit uses one shared Y camera with unchanged target/up/fov and a 24 fps WebM stream',async()=>{
 const h=harness(),original=structuredClone(h.request.camera),recorded=recordComparisonVideo(h.request,h.env);
 h.advance(250);h.advance(1000);const blob=await recorded;
 assert.match(blob.type,/video\/webm/);assert.equal(h.streamRate,24);assert.equal(h.trackStops,1);assert.equal(h.pending,0);
 assert.equal(h.requestedFrames,5);assert.equal(h.copied.length,2);assert.equal(h.recorderStarts,1);
 const quarter=h.cameras[0];assert.ok(Math.abs(quarter.position[0])<1e-12);assert.ok(Math.abs(quarter.position[2]+7)<1e-12);assert.equal(quarter.position[1],5);
 for(const rendered of h.cameras){assert.deepEqual(rendered.target,original.target);assert.deepEqual(rendered.up,original.up);assert.equal(rendered.fov,original.fov);}
 assert.deepEqual(h.request.camera,original);assert.equal(h.progress.at(-1).fraction,1);
});

test('cancellation and rendering/copy/recorder failures stop tracks and pending frames',async()=>{
 const h=harness(),abort=new AbortController(),recorded=recordComparisonVideo({...h.request,signal:abort.signal},h.env);abort.abort();
 await assert.rejects(recorded,/cancelled/);assert.equal(h.trackStops,1);assert.equal(h.pending,0);
 for(const options of [{renderFails:true},{copyFails:true},{constructorFails:true}]){
  const h=harness(options),recorded=recordComparisonVideo(h.request,h.env);h.advance(500);await assert.rejects(recorded,/failed/i);assert.equal(h.trackStops,1);assert.equal(h.pending,0);
 }
 const error=harness(),recording=recordComparisonVideo(error.request,error.env);error.recorder.onerror({error:Error('Encoder failed')});
 await assert.rejects(recording,/Encoder failed/);assert.equal(error.trackStops,1);assert.equal(error.pending,0);
});

test('no data, header-only streams and oversized chunks never become successful artifacts',async()=>{
 for(const [options,message] of [[{empty:true},/no data/],[{headerOnly:true},/no video frames/],[{maxBytes:4},/byte limit/]]){
  const h=harness(options),recording=recordComparisonVideo(h.request,h.env);h.advance(250);h.advance(1000);await assert.rejects(recording,message);assert.equal(h.trackStops,1);
 }
 const h=harness({maxBytes:4}),recording=recordComparisonVideo(h.request,h.env);
 h.recorder.ondataavailable({data:new Blob([validBytes])});await assert.rejects(recording,/byte limit/);assert.equal(h.pending,0);assert.equal(h.trackStops,1);
});

test('invalid requests and unavailable recorders refuse before starting capture',async()=>{
 for(const seconds of [0,16,1.5,NaN]){const h=harness();await assert.rejects(recordComparisonVideo({...h.request,seconds},h.env),/duration/);assert.equal(h.recorderStarts,0);assert.equal(h.trackStops,0);}
 const h=harness();await assert.rejects(recordComparisonVideo(h.request,{...h.env,MediaRecorder:{isTypeSupported:()=>false}}),/unavailable/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(recordComparisonVideo({...h.request,signal:aborted.signal},h.env),/cancelled/);
 await assert.rejects(recordComparisonVideo({...h.request,camera:{...camera(),up:[0,0,0]}},h.env),/camera/);
});

test('changing frame resolution and an unexpected recorder stop are explicit failures',async()=>{
 const h=harness(),recording=recordComparisonVideo({...h.request,renderFrame:()=>({width:1,height:1})},h.env);h.advance(1000);await assert.rejects(recording,/resolution changed/);assert.equal(h.trackStops,1);
 const stopped=harness(),premature=recordComparisonVideo(stopped.request,stopped.env);stopped.recorder.stop();await assert.rejects(premature,/stopped before playback completed/);assert.equal(stopped.trackStops,1);assert.equal(stopped.pending,0);
});

test('comparison video capabilities reflect native stream and codec support without recording',()=>{
 const canvas={captureStream(){assert.fail('Capability discovery must not capture a stream');}};
 assert.deepEqual(comparisonVideoCapabilities({canvas,MediaRecorder:{isTypeSupported:type=>type==='video/webm;codecs=vp8'}}),{supported:true,mimeType:'video/webm;codecs=vp8'});
 assert.equal(comparisonVideoCapabilities({canvas:{},MediaRecorder:{isTypeSupported:()=>true}}).supported,false);
 for(const Recorder of [null,{}, {isTypeSupported:()=>false},{isTypeSupported(){throw Error('Unavailable codec probe');}}]){
  const cap=comparisonVideoCapabilities({canvas,MediaRecorder:Recorder});assert.equal(cap.supported,false);assert.match(cap.reason,/WebM/);
 }
 assert.equal(comparisonVideoCapabilities({canvas,MediaRecorder:{isTypeSupported:()=>true}}).mimeType,'video/webm;codecs=vp9');
});

test('encoder receives a bounded final-frame flush before stop; cancellation during flush discards output',async()=>{
 for(const abortDuringFlush of [false,true]){
  const h=harness(),abort=new AbortController();let finishFlush,flushes=0;
  h.env.flushWait=milliseconds=>{assert.equal(milliseconds,150);flushes++;return new Promise(resolve=>{finishFlush=resolve;});};
  const recorded=recordComparisonVideo({...h.request,signal:abort.signal},h.env);
  h.advance(250);h.advance(1000);await Promise.resolve();
  assert.equal(flushes,1);assert.equal(h.recorder.state,'recording');assert.equal(h.trackStops,0);
  if(abortDuringFlush){abort.abort();await assert.rejects(recorded,/cancelled/);finishFlush();}
  else{finishFlush();assert.ok((await recorded).size>0);}
  assert.equal(h.recorder.state,'inactive');assert.equal(h.trackStops,1);assert.equal(h.pending,0);
 }
});

test('a throttled first callback at the final phase refuses an orbit with no actual motion',async()=>{
 const h=harness(),recorded=recordComparisonVideo(h.request,h.env);h.advance(1000);
 await assert.rejects(recorded,/too few animation frames/);assert.equal(h.trackStops,1);assert.equal(h.pending,0);
});
