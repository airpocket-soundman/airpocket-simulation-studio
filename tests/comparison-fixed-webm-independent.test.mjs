import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeComparisonTimeWebm as encode} from '../src/ui/comparison-fixed-webm.js';
import {createComparisonExportAdapter} from '../src/comparison-export-adapter.js';

// Synthetic owned codec doubles only: no browser, real codec, solver or export.
function harness(mode='success'){
 const stats={inputClosed:0,decodedClosed:0,checks:0,proof:0,codecClose:[],frames:0},controller=new AbortController(),doc=new EventTarget(),timers=new Map();
 let encoder,decoder,timerId=0,clock=0;doc.hidden=false;doc.documentElement={lang:'en'};
 class Frame{constructor(canvas,options){Object.assign(this,options);}close(){stats.inputClosed++;}}
 class Chunk{constructor(packet){Object.assign(this,packet);}}
 class Encoder{
  static isConfigSupported(){return mode==='support-hang'?new Promise(()=>{}):Promise.resolve({supported:true});}
  constructor(callbacks){this.callbacks=callbacks;this.state='configured';this.encodeQueueSize=0;encoder=this;}
  configure(){}
  encode(frame){stats.frames++;this.last=frame;if(mode==='no-output')return;this.callbacks.output({timestamp:frame.timestamp,duration:frame.duration,type:'key',byteLength:1,copyTo:bytes=>{bytes[0]=0;}});}
  flush(){stats.flushStarted=true;if(mode==='flush-abort')controller.abort();if(mode==='flush-hidden'){doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));}return mode.startsWith('flush-')?new Promise(()=>{}):Promise.resolve();}
  close(){stats.beforeClose?.('encoder');stats.codecClose.push('encoder');this.state='closed';}
 }
 class Decoder{
  static isConfigSupported(){return Promise.resolve({supported:true});}
  constructor(callbacks){this.callbacks=callbacks;this.state='configured';this.decodeQueueSize=0;decoder=this;}
  configure(){}
  decode(packet){this.callbacks.output({timestamp:packet.timestamp,codedWidth:4,codedHeight:4,close(){stats.decodedClosed++;}});}
  flush(){return Promise.resolve();}
  close(){stats.beforeClose?.('decoder');stats.codecClose.push('decoder');this.state='closed';}
 }
 const env={VideoEncoder:Encoder,VideoDecoder:Decoder,VideoFrame:Frame,EncodedVideoChunk:Chunk,document:doc,now:()=>clock,setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms,due:clock+ms});return id;},clearTimeout:id=>timers.delete(id),yieldControl:()=>Promise.resolve()};
 const camera={position:[2,2,2],target:[0,0,0],up:[0,1,0],fov:40},request={initialCanvas:{width:4,height:4},renderFrame:()=>({width:4,height:4}),camera,seconds:1,signal:controller.signal,assertCurrent(){stats.checks++;},onVerified(){stats.proof++;}};
 return {env,request,stats,controller,timers,late(){encoder.callbacks.output({timestamp:777,type:'key',byteLength:1,copyTo(){throw Error('Late packet must not be copied');}});encoder.callbacks.error(Error('late'));decoder?.callbacks.output({timestamp:777,codedWidth:4,codedHeight:4,close(){stats.decodedClosed++;}});decoder?.callbacks.error(Error('late'));},advance(ms){clock+=ms;for(const {fn,due}of [...timers.values()])if(due<=clock)fn();}};
}
for(const [mode,code]of [['support-hang','WEBM_FIXED_CANCELLED'],['flush-abort','WEBM_FIXED_CANCELLED'],['flush-hidden','WEBM_BACKGROUND_INTERRUPTED']])test('independent lifecycle '+mode+' refuses without proof and releases owned resources',async()=>{
 const h=harness(mode),pending=encode(h.request,h.env);if(mode==='support-hang')h.controller.abort();await assert.rejects(pending,{code});assert.equal(h.stats.proof,0);assert.equal(h.timers.size,0);assert.deepEqual(h.stats.codecClose,mode==='support-hang'?[]:['encoder']);assert.equal(h.stats.inputClosed,mode==='support-hang'?0:24);
});
test('independent successful full set closes all frames/codecs and terminal callbacks cannot reenter leases',async()=>{
 const h=harness(),blob=await encode(h.request,h.env);assert.ok(blob.size>0);assert.equal(h.stats.frames,24);assert.equal(h.stats.inputClosed,24);assert.equal(h.stats.decodedClosed,24);assert.deepEqual(h.stats.codecClose,['encoder','decoder']);assert.equal(h.stats.proof,1);assert.equal(h.timers.size,0);const checks=h.stats.checks;h.late();assert.equal(h.stats.checks,checks);assert.equal(h.stats.decodedClosed,25);assert.equal(h.stats.proof,1);
});
test('independent pending output gate stalls with only two submitted frames and closes on watchdog',async()=>{
 const h=harness('no-output');let atTwo=0;h.env.yieldControl=()=>{assert.ok(h.stats.frames<=2);if(h.stats.frames===2&&++atTwo===2)h.advance(5000);return Promise.resolve();};await assert.rejects(encode(h.request,h.env),{code:'WEBM_PROGRESS_STALLED'});assert.ok(h.stats.frames<=2);assert.equal(h.stats.inputClosed,h.stats.frames);assert.equal(h.stats.proof,0);assert.deepEqual(h.stats.codecClose,['encoder']);assert.equal(h.timers.size,0);
});
test('independent adapter owns its host lease until pending codec abort cleanup completes',async()=>{
 const h=harness('flush-hang');let locked=false,releases=0,sourceCurrent=true;
 const output={mesh:{nodes:[0,0,0]},result:{kind:'thermal',transient:true,snapshots:[{time:0,temperature:[20]},{time:1,temperature:[30]}]}};
 h.stats.beforeClose=()=>assert.equal(locked,true,'Codec resources close before host restoration');
 const adapter=createComparisonExportAdapter({cases:{readSource:async ref=>({caseId:ref.caseId,revision:'rev',name:ref.caseId,output,assertCurrent(){if(!sourceCurrent)throw Error('source changed');}})},getDefaults:()=>({camera:h.request.camera,deformScale:0}),renderComparison:args=>({canvas:{width:4,height:4},panels:[],colorRange:args.colorRange,unit:'degC'}),acquireHostLock(){assert.equal(locked,false);locked=true;return {assertOwned(){assert.equal(locked,true);},release(){assert.equal(locked,true);locked=false;releases++;}};},encodeFixedVideo:args=>encode(args,h.env)});
 const prepared=await adapter.prepare({format:'webm',animation:'time',field:'temperature',references:[{caseId:'a'},{caseId:'b'}],startTimeSeconds:0,endTimeSeconds:1});
 const pending=adapter.render({...prepared,format:'webm',animation:'time',seconds:1,signal:h.controller.signal});
 for(let turn=0;turn<200&&!h.stats.flushStarted;turn++)await Promise.resolve();assert.equal(h.stats.flushStarted,true);assert.equal(locked,true);assert.equal(releases,0);h.controller.abort();await assert.rejects(pending,/cancelled/);assert.equal(locked,false);assert.equal(releases,1);assert.deepEqual(h.stats.codecClose,['encoder']);assert.equal(h.stats.inputClosed,24);assert.equal(h.timers.size,0);sourceCurrent=false;
});

