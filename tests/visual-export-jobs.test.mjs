import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
const revision='sha256:'+'a'.repeat(64);
const args=(requestId='one')=>({requestId,expectedResultRevision:revision,format:'png',view:{field:'temperature',camera:{position:[1,2,3]}}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
// Digest completion uses the worker pool; event-loop turn counts are not timeouts under load.
async function terminal(api,job){const deadline=performance.now()+5000;for(;;){const state=api.status(job);if(state.state!=='running')return state;if(performance.now()>=deadline)throw Error('Export did not terminate within 5 seconds');await new Promise(resolve=>setTimeout(resolve,5));}}

test('PNG artifact has real bytes, digest, bounded pages and detached view',async()=>{
 const bytes=new Uint8Array(70000).map((_,i)=>i%251);let received;
 const api=createVisualExportJobs({render:value=>{received=value;value.onProgress(.4);return new Blob([bytes],{type:'image/png'});}}),input=args(),job=await api.start(input);
 input.view.camera.position[0]=99;received.view.camera.position[1]=99;
 const done=await terminal(api,job);assert.equal(done.state,'completed');assert.deepEqual(done.view.camera.position,[1,2,3]);assert.equal(done.artifact.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
 const first=api.artifact(job),last=api.artifact({...job,offset:first.nextOffset});assert.equal(first.nextOffset,65536);assert.equal(last.nextOffset,null);assert.deepEqual(Buffer.concat([Buffer.from(first.data,'base64'),Buffer.from(last.data,'base64')]),Buffer.from(bytes));
 assert.throws(()=>api.artifact({...job,length:65537}),/page/);assert.throws(()=>api.artifact({...job,offset:-1}),/page/);assert.equal(api.artifact({...job,offset:70000}).data,'');
});
test('same request is idempotent while running and rejects conflicts and competing jobs',async()=>{
 let finish,calls=0;const api=createVisualExportJobs({render:()=>{calls++;return new Promise(r=>finish=r);}}),job=await api.start(args());assert.equal((await api.start(args())).jobId,job.jobId);assert.equal(calls,1);
 await assert.rejects(api.start({...args(),seconds:2}),/conflict/);await assert.rejects(api.start(args('two')),/active/);assert.throws(()=>api.artifact(job),/unavailable/);
 finish(new Blob(['ok'],{type:'image/png'}));assert.equal((await terminal(api,job)).state,'completed');assert.equal((await api.start(args())).state,'completed');
});
test('cancel and release abort renderer and never expose late output',async()=>{
 let finish,signal;const api=createVisualExportJobs({render:value=>{signal=value.signal;return new Promise(r=>finish=r);}}),job=await api.start(args());assert.equal(api.cancel(job).state,'cancelled');assert.equal(signal.aborted,true);finish(new Blob(['late'],{type:'image/png'}));await tick();assert.throws(()=>api.artifact(job),/unavailable/);api.release(job);assert.throws(()=>api.status(job),/Unknown/);
 const next=await api.start(args('two'));api.release(next);assert.equal(signal.aborted,true);finish(new Blob(['late'],{type:'image/png'}));await tick();assert.throws(()=>api.status(next),/Unknown/);
});
test('retained byte and count budgets recover after release',async()=>{
 const api=createVisualExportJobs({maxBytes:5,maxJobs:2,render:()=>new Blob(['1234'],{type:'image/png'})}),one=await api.start(args());assert.equal((await terminal(api,one)).state,'completed');const two=await api.start(args('two'));assert.equal((await terminal(api,two)).state,'failed');assert.match(api.status(two).error,/budget/);await assert.rejects(api.start(args('three')),/limit/);api.release(one);const three=await api.start(args('three'));assert.equal((await terminal(api,three)).state,'completed');
});
test('prepare freezes revision/view and rechecks expiry before rendering',async()=>{
 let finishPrepare,renders=0,valid=true;const api=createVisualExportJobs({prepare:()=>new Promise(r=>finishPrepare=r),render:()=>{renders++;return new Blob(['ok'],{type:'image/png'});}});const pending=api.start(args(),{guard:()=>valid});await assert.rejects(api.start(args('other')),/active/);valid=false;finishPrepare({resultRevision:revision,view:{field:'temperature'}});await assert.rejects(pending,/expired/);assert.equal(renders,0);
 const wrong=createVisualExportJobs({prepare:async()=>({resultRevision:'other',view:{}}),render:()=>{renders++;}});await assert.rejects(wrong.start(args()),/revision conflict/);assert.equal(renders,0);
});
test('WebM metadata, renderer errors and invalid requests are explicit',async()=>{
 const api=createVisualExportJobs({render:()=>new Blob(['webm'],{type:'video/webm;codecs=vp9'})}),job=await api.start({...args(),format:'webm',animation:'time',seconds:15});assert.equal((await terminal(api,job)).artifact.mimeType,'video/webm;codecs=vp9');
 for(const patch of [{requestId:''},{expectedResultRevision:'bad'},{format:'jpeg'},{animation:'random'},{seconds:16}])await assert.rejects(api.start({...args('bad'),...patch}));
 const broken=createVisualExportJobs({render:()=>{throw Error('encoder failed');}}),failed=await broken.start(args());assert.equal((await terminal(broken,failed)).error,'encoder failed');
 const mime=createVisualExportJobs({render:()=>new Blob(['x'],{type:'text/plain'})}),invalid=await mime.start(args());assert.equal((await terminal(mime,invalid)).state,'failed');
});

test('release keeps renderer exclusive until aborted renderer actually settles',async()=>{
 let finish;const api=createVisualExportJobs({render:()=>new Promise(resolve=>finish=resolve)}),job=await api.start(args());api.release(job);await assert.rejects(api.start(args('next')),/active/);finish(new Blob(['late'],{type:'image/png'}));await tick();const next=await api.start(args('next'));assert.equal(next.state,'running');api.cancelAll();finish(new Blob(['late'],{type:'image/png'}));await tick();assert.equal(api.status(next).state,'cancelled');
});
test('disconnect during preparation prevents renderer start and concurrent retries share admission',async()=>{
 let complete,calls=0;const api=createVisualExportJobs({prepare:()=>new Promise(resolve=>complete=resolve),render:()=>{calls++;return new Blob(['x'],{type:'image/png'});}}),one=api.start(args()),retry=api.start(args());api.cancelAll();complete({resultRevision:revision,view:{field:'temperature'}});await assert.rejects(one,/expired/);await assert.rejects(retry,/expired/);assert.equal(calls,0);
});

function pngBytes(width,height){const b=new Uint8Array(40);b.set([137,80,78,71,13,10,26,10],0);const dv=new DataView(b.buffer);dv.setUint32(8,13);b.set([73,72,68,82],12);dv.setUint32(16,width);dv.setUint32(20,height);return b;}
test('PNG artifact manifest carries only known fields, is bounded and leaves existing metadata unchanged',async()=>{
 const bytes=pngBytes(320,240),view={result:{field:'temperature',frameIndex:3,timeSeconds:.25,deformScale:2,camera:{position:[1,2,3],target:[0,0,0],up:[0,1,0],fov:45},huge:'x'.repeat(10000)},setup:{x:1}};
 const api=createVisualExportJobs({render:()=>new Blob([bytes],{type:'image/png'})}),job=await api.start({...args(),view}),done=await terminal(api,job),a=done.artifact,m=a.manifest;
 assert.deepEqual(Object.keys(a).filter(k=>k!=='manifest').sort(),['maxChunkBytes','mimeType','name','sha256','totalBytes']);
 assert.equal(m.resultRevision,revision);assert.equal(m.sha256,a.sha256);assert.equal(m.totalBytes,bytes.length);assert.equal(m.container,'png');assert.deepEqual(m.resolution,{width:320,height:240});
 assert.equal(m.view.field,'temperature');assert.deepEqual(m.view.camera.position,[1,2,3]);assert.equal(m.view.huge,undefined);assert.equal(m.time.timeBasis,'single frame');assert.equal(m.time.physicalTimeSeconds,.25);assert.equal(m.scale.deformScale,2);
 assert.ok(JSON.stringify(m).length<=4096);assert.equal(api.artifact(job).manifest.sha256,a.sha256);
 const bad=createVisualExportJobs({render:()=>new Blob(['png'],{type:'image/png'})}),plain=await terminal(bad,await bad.start(args()));assert.equal(plain.artifact.manifest.resolution,undefined);
});
test('WebM manifest separates display duration from stored physical frames and does not invent resolution',async()=>{
 const api=createVisualExportJobs({render:()=>new Blob(['webm'],{type:'video/webm;codecs=vp9'})}),job=await api.start({...args(),format:'webm',animation:'time',seconds:7}),m=(await terminal(api,job)).artifact.manifest;
 assert.equal(m.container,'webm');assert.equal(m.codec,'vp9');assert.equal(m.time.durationSeconds,7);assert.equal(m.time.timeBasis,'display time');assert.equal(m.time.frameSelection,'stored-acoustic-frames-only');assert.match(m.time.physicalTime,/physical time/);assert.equal(m.time.fps.target,24);assert.equal(m.time.fps.frameCountGuaranteed,false);assert.equal(m.resolution,undefined);
 const orbit=createVisualExportJobs({render:()=>new Blob(['webm'],{type:'video/webm'})}),o=(await terminal(orbit,await orbit.start({...args(),format:'webm'}))).artifact.manifest;assert.equal(o.codec,undefined);assert.equal(o.time.physicalTime,undefined);
});


const compareArgs=(requestId='compare')=>({requestId,references:[{caseId:'a',expectedRevision:revision},{caseId:'b',expectedRevision:'sha256:'+'b'.repeat(64)}],field:'temperature',timeSeconds:2,toleranceSeconds:.1,deformScale:1});
function comparePng(size=64){const bytes=new Uint8Array(size);bytes.set([137,80,78,71,13,10,26,10]);const v=new DataView(bytes.buffer);v.setUint32(16,640);v.setUint32(20,360);return bytes;}
const compareSnapshot=()=>({comparison:{cases:[{caseId:'a',revision,resultRevision:revision,label:'A'},{caseId:'b',revision:'sha256:'+'b'.repeat(64),resultRevision:revision,label:'B'}],field:'temperature',requestedTimeSeconds:2,panels:[{caseId:'a',time:{timeSeconds:2,offsetSeconds:0,frameIndex:1,timeApplies:true}},{caseId:'b',time:{timeSeconds:2.05,offsetSeconds:.05,frameIndex:2,timeApplies:true}}],colorRange:{minimum:10,maximum:40},unit:'degC'},view:{deformScale:1,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}},context:{privateLease:'never serialized'}});

test('comparison PNG jobs freeze truthful metadata, keep sources private, and share artifact paging',async()=>{
 const snapshot=compareSnapshot(),bytes=comparePng(70000);let received;const api=createVisualExportJobs({render:()=>{},prepareCompare:async()=>snapshot,renderCompare:value=>{received=value;value.onProgress(.5);return new Blob([bytes],{type:'image/png'});}}),input=compareArgs(),job=await api.startCompare(input);input.references[0].caseId='changed';snapshot.comparison.cases[0].label='changed';received.comparison.panels[0].time.timeSeconds=99;
 const done=await terminal(api,job);assert.equal(done.state,'completed');assert.equal(done.target,'comparison');assert.equal(done.resultRevision,undefined);assert.equal(done.comparison.cases[0].label,'A');assert.equal(done.comparison.panels[0].time.timeSeconds,2);assert.equal(done.artifact.manifest.comparison.panels[1].time.timeSeconds,2.05);assert.deepEqual(done.artifact.manifest.resolution,{width:640,height:360});assert.equal(JSON.stringify(done).includes('never serialized'),false);assert.equal(done.artifact.sha256,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
 const first=api.artifact(job),last=api.artifact({...job,offset:first.nextOffset});assert.deepEqual(Buffer.concat([Buffer.from(first.data,'base64'),Buffer.from(last.data,'base64')]),Buffer.from(bytes));assert.equal(last.nextOffset,null);api.release(job);assert.throws(()=>api.status(job),/Unknown/);
});

test('comparison and result exports share idempotency, admission, cancellation and preparation revocation',async()=>{
 let finish,calls=0;const api=createVisualExportJobs({render:()=>new Blob(['x'],{type:'image/png'}),prepareCompare:()=>compareSnapshot(),renderCompare:()=>{calls++;return new Promise(resolve=>finish=resolve);}}),job=await api.startCompare(compareArgs());assert.equal((await api.startCompare(compareArgs())).jobId,job.jobId);assert.equal(calls,1);await assert.rejects(api.start({...args('compare')}),/conflict/);await assert.rejects(api.start(args('result')),/active/);api.cancel(job);assert.throws(()=>api.artifact(job),/unavailable/);await assert.rejects(api.start(args('result')),/active/);finish(new Blob([comparePng()],{type:'image/png'}));await tick();assert.equal(api.status(job).state,'cancelled');
 let ready,renders=0,prepareGuard;const waiting=createVisualExportJobs({render:()=>{},prepareCompare:(_request,{guard})=>{prepareGuard=guard;return new Promise(resolve=>ready=resolve);},renderCompare:()=>{renders++;}}),pending=waiting.startCompare(compareArgs());await assert.rejects(waiting.start(args()),/active/);assert.equal(prepareGuard(),true);waiting.cancelAll();assert.equal(prepareGuard(),false);ready(compareSnapshot());await assert.rejects(pending,/expired/);assert.equal(renders,0);
});

test('comparison validation rejects unsupported or lossy requests before preparation',async()=>{
 let calls=0;const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>{calls++;return compareSnapshot();},renderCompare:()=>new Blob([comparePng()],{type:'image/png'})});
 for(const patch of [{references:[]},{references:[compareArgs().references[0],compareArgs().references[0]]},{field:''},{timeSeconds:NaN},{toleranceSeconds:-1},{deformScale:Infinity},{format:'mp4'},{expectedResultRevision:revision},{camera:{position:[1,2,3]}},{references:[{...compareArgs().references[0],unknown:true},compareArgs().references[1]]}])await assert.rejects(api.startCompare({...compareArgs(),...patch}));assert.equal(calls,0);
 const input=compareArgs();delete input.timeSeconds;await assert.rejects(api.startCompare(input),/requires timeSeconds/);let invoked=false;const getter={...compareArgs()};Object.defineProperty(getter,'field',{enumerable:true,get(){invoked=true;return 'temperature';}});await assert.rejects(api.startCompare(getter));assert.equal(invoked,false);
});

test('comparison artifact failures respect shared byte budget and refuse malformed PNG or metadata',async()=>{
 const api=createVisualExportJobs({maxBytes:70,render:()=>{},prepareCompare:()=>compareSnapshot(),renderCompare:()=>new Blob([comparePng()],{type:'image/png'})}),one=await api.startCompare(compareArgs());assert.equal((await terminal(api,one)).state,'completed');const two=await api.startCompare(compareArgs('two'));assert.equal((await terminal(api,two)).state,'failed');assert.match(api.status(two).error,/budget/);api.release(one);const three=await api.startCompare(compareArgs('three'));assert.equal((await terminal(api,three)).state,'completed');
 const bad=createVisualExportJobs({render:()=>{},prepareCompare:()=>compareSnapshot(),renderCompare:()=>new Blob(['not PNG'],{type:'image/png'})}),invalid=await bad.startCompare(compareArgs());assert.equal((await terminal(bad,invalid)).state,'failed');assert.match(bad.status(invalid).error,/PNG/);
 const huge=createVisualExportJobs({render:()=>{},prepareCompare:()=>({...compareSnapshot(),comparison:{huge:'x'.repeat(3100)}}),renderCompare:()=>{throw Error('must not render');}});await assert.rejects(huge.startCompare(compareArgs()),/metadata/);
});


test('comparison WebM normalizes orbit defaults and records known canvas resolution and fixed physical contexts',async()=>{
 let received;const snapshot=compareSnapshot();snapshot.view.resolution={width:1280,height:640};const bytes=Uint8Array.of(26,69,223,163,31,67,182,117),api=createVisualExportJobs({render:()=>{},prepareCompare:()=>snapshot,renderCompare:value=>{received=value;return new Blob([bytes],{type:'video/webm;codecs=vp9'});}}),request={...compareArgs(),format:'webm'},job=await api.startCompare(request),done=await terminal(api,job);assert.equal(done.state,'completed');assert.equal(received.animation,'orbit');assert.equal(received.seconds,5);assert.equal(done.format,'webm');assert.match(done.artifact.name,/comparison-.*\.webm$/);const m=done.artifact.manifest;assert.equal(m.target,'comparison');assert.equal(m.container,'webm');assert.equal(m.codec,'vp9');assert.deepEqual(m.resolution,{width:1280,height:640});assert.equal(m.time.animation,'orbit');assert.equal(m.time.durationSeconds,5);assert.equal(m.time.timeBasis,'display time');assert.equal(m.time.fps.target,24);assert.equal(m.time.fps.recording,'realtime');assert.equal(m.time.fps.frameCountGuaranteed,false);assert.deepEqual(m.comparison.panels.map(p=>p.time.timeSeconds),[2,2.05]);assert.equal(Object.hasOwn(m,'resultRevision'),false);assert.equal((await api.startCompare({...request,animation:'orbit',seconds:5})).jobId,job.jobId);assert.equal(Buffer.from(api.artifact(job).data,'base64').length,bytes.length);
});

test('comparison PNG omitted/default format share identity and video-only options are rejected before prepare',async()=>{
 let calls=0;const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>{calls++;return compareSnapshot();},renderCompare:()=>new Blob([comparePng()],{type:'image/png'})}),job=await api.startCompare(compareArgs());await terminal(api,job);assert.equal((await api.startCompare({...compareArgs(),format:'png'})).jobId,job.jobId);assert.equal(calls,1);
 for(const patch of [{format:'png',seconds:5},{format:'png',animation:'orbit'},{format:null},{format:'webm',seconds:0},{format:'webm',seconds:16},{format:'webm',seconds:1.5},{format:'webm',seconds:null},{format:'webm',animation:'time'},{format:'webm',animation:null}])await assert.rejects(api.startCompare({...compareArgs('invalid'),...patch}));assert.equal(calls,1);await assert.rejects(api.startCompare({...compareArgs(),format:'webm'}),/conflict/);
});

test('comparison WebM cancellation retains renderer exclusion and missing canvas metadata never invents dimensions',async()=>{
 let finish,signal;const snapshot=compareSnapshot();snapshot.view.resolution={width:1280,height:640};const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>snapshot,renderCompare:args=>{signal=args.signal;return new Promise(resolve=>finish=resolve);}}),job=await api.startCompare({...compareArgs(),format:'webm',seconds:1});api.cancel(job);assert.equal(signal.aborted,true);await assert.rejects(api.startCompare(compareArgs('other')),/active/);finish(new Blob(['late'],{type:'video/webm'}));await tick();assert.equal(api.status(job).state,'cancelled');assert.throws(()=>api.artifact(job),/unavailable/);api.release(job);
 const bad=createVisualExportJobs({render:()=>{},prepareCompare:()=>compareSnapshot(),renderCompare:()=>new Blob(['video'],{type:'video/webm'})}),invalid=await bad.startCompare({...compareArgs(),format:'webm'});assert.equal((await terminal(bad,invalid)).state,'failed');assert.match(bad.status(invalid).error,/recorded canvas resolution/);
});


test('host-only waitForSettled waits through cancellation cleanup before releasing renderer exclusion',async()=>{
 let finish;const api=createVisualExportJobs({render:()=>new Promise(resolve=>finish=resolve)}),job=await api.start(args());api.cancel(job);let settled=false;const waiting=api.waitForSettled(job).then(()=>settled=true);await tick();assert.equal(settled,false);await assert.rejects(api.start(args('other')),/active/);finish(new Blob(['late'],{type:'image/png'}));await waiting;assert.equal(settled,true);const next=await api.start(args('other'));api.cancel(next);finish(new Blob(['late'],{type:'image/png'}));await api.waitForSettled(next);
});


test('comparison time WebM has explicit physical range, fixed camera and nearest-stored metadata without orbit claims',async()=>{
 let received;const snapshot=compareSnapshot();snapshot.view.resolution={width:1280,height:640};snapshot.comparison.timeAnimation={startTimeSeconds:0,endTimeSeconds:10,camera:'fixed',timeSelection:'nearest-stored-frames-only',interpolated:false};const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>snapshot,renderCompare:value=>{received=value;return new Blob(['webm'],{type:'video/webm'});}}),request={...compareArgs(),format:'webm',animation:'time',startTimeSeconds:0,endTimeSeconds:10,seconds:2};delete request.timeSeconds;const done=await terminal(api,await api.startCompare(request));assert.equal(done.state,'completed');assert.equal(received.timeSeconds,undefined);assert.equal(received.animation,'time');assert.equal(received.startTimeSeconds,0);assert.equal(done.artifact.manifest.time.camera,'fixed');assert.equal(done.artifact.manifest.time.frameSelection,'nearest-stored-frames-only');assert.deepEqual(done.artifact.manifest.time.requestedRangeSeconds,{start:0,end:10});assert.equal(done.artifact.manifest.time.durationSeconds,2);assert.equal(done.artifact.manifest.comparison.timeAnimation.interpolated,false);assert.ok(!done.artifact.manifest.time.physicalTime.includes('throughout the display orbit'));
});

test('comparison time range validation preserves PNG and orbit parameter boundaries before admission',async()=>{
 let prepared=0;const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>{prepared++;return compareSnapshot();},renderCompare:()=>{}}),base={...compareArgs(),format:'webm',animation:'time',startTimeSeconds:0,endTimeSeconds:10};delete base.timeSeconds;
 for(const patch of [{timeSeconds:5},{startTimeSeconds:10},{startTimeSeconds:-1},{endTimeSeconds:Infinity},{endTimeSeconds:null},{animation:'orbit'},{format:'png'}])await assert.rejects(api.startCompare({...base,...patch}));const missing={...base};delete missing.startTimeSeconds;await assert.rejects(api.startCompare(missing));assert.equal(prepared,0);
});

test('comparison deformation validates explicit positive scale and no time args before admission; manifest is visualization only',async()=>{let count=0;const snapshot=compareSnapshot();snapshot.view.resolution={width:1280,height:640};snapshot.comparison.deformationAnimation={startScale:0,endScale:4,scalePolicy:'linear',loadHistory:false};const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>{count++;return snapshot;},renderCompare:()=>new Blob(['webm'],{type:'video/webm'})}),base={...compareArgs(),format:'webm',animation:'deformation',field:'displacement',deformScale:4};delete base.timeSeconds;delete base.toleranceSeconds;for(const patch of [{deformScale:0},{deformScale:undefined},{field:'temperature'},{timeSeconds:0},{toleranceSeconds:0},{startTimeSeconds:0},{endTimeSeconds:1}])await assert.rejects(api.startCompare({...base,...patch}));assert.equal(count,0);const done=await terminal(api,await api.startCompare(base));assert.equal(done.state,'completed');assert.equal(done.artifact.manifest.time.camera,'fixed');assert.match(done.artifact.manifest.time.physicalTime,/not a physical load history/);assert.equal(done.artifact.manifest.comparison.deformationAnimation.scalePolicy,'linear');});

// A real source lease must observe the admission-to-lifetime transition too.
test('accepted 15-second comparison outlives admission deadline while real leases stay guarded',async()=>{
 const output={input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]}};
 for(const interruption of ['none','source','lifetime','cancel']){
  const store=createCaseStore();store.add('A',output);store.add('B',output);const cases=createCaseOperations({store}),rows=(await cases.list()).cases;
  let now=0,live=true,resume,lease;
  const api=createVisualExportJobs({render:()=>{},prepareCompare:async(request,{guard})=>{lease=await cases.readSource(request.references[0],{guard});return {...compareSnapshot(),view:{resolution:{width:1280,height:640}},context:lease};},renderCompare:async({context,signal})=>{await new Promise(resolve=>resume=resolve);if(signal.aborted)throw Error('cancelled');context.assertCurrent();return new Blob(['webm'],{type:'video/webm'});}});
  const request={...compareArgs(),references:rows.map(row=>({caseId:row.caseId,expectedRevision:row.revision})),format:'webm',seconds:15};
  const job=await api.startCompare(request,{guard:()=>now<15000,jobGuard:()=>live});now=15150;
  assert.doesNotThrow(()=>lease.assertCurrent());
  if(interruption==='source')store.rename(0,'changed');
  if(interruption==='lifetime')live=false;
  if(interruption==='cancel')api.cancel(job);
  resume();await api.waitForSettled(job);const done=api.status(job);
  assert.equal(done.state,interruption==='none'?'completed':interruption==='cancel'?'cancelled':'failed');
  if(interruption!=='none')assert.throws(()=>api.artifact(job),/unavailable/);
  api.release(job);
 }
});

test('comparison admission expiration refuses before acceptance and default guard remains live',async()=>{
 let valid=true,resume,leaseGuard;
 const api=createVisualExportJobs({render:()=>{},prepareCompare:async(_,{guard})=>{leaseGuard=guard;await new Promise(resolve=>resume=resolve);return compareSnapshot();},renderCompare:()=>{throw Error('must not render');}});
 const pending=api.startCompare(compareArgs(),{guard:()=>valid,jobGuard:()=>true});valid=false;resume();await assert.rejects(pending,/expired/);assert.equal(leaseGuard(),false);
 let finish;valid=true;
 const legacy=createVisualExportJobs({render:()=>{},prepareCompare:(_,{guard})=>{leaseGuard=guard;return compareSnapshot();},renderCompare:()=>new Promise(resolve=>finish=resolve)});
 const job=await legacy.startCompare(compareArgs(),{guard:()=>valid});valid=false;assert.equal(leaseGuard(),false);finish(new Blob([comparePng()],{type:'image/png'}));await legacy.waitForSettled(job);assert.equal(legacy.status(job).state,'failed');
});

test('comparison GIF uses bounded orbit format with deterministic delays and actual GIF dimensions',async()=>{let got;const b=new Uint8Array(14);b.set(new TextEncoder().encode('GIF89a'));b[6]=128;b[7]=2;b[8]=64;b[9]=1;b[13]=59;const snapshot=compareSnapshot();snapshot.view.resolution={width:640,height:320};snapshot.view.sourceResolution={width:1280,height:640};const api=createVisualExportJobs({render:()=>{},prepareCompare:()=>snapshot,renderCompare:r=>{got=r;return new Blob([b],{type:'image/gif'});}});for(const animation of ['time','deformation'])await assert.rejects(api.startCompare({...compareArgs('bad'),format:'gif',animation}));const done=await terminal(api,await api.startCompare({...compareArgs(),format:'gif',seconds:2}));assert.equal(done.state,'completed');assert.equal(got.animation,'orbit');const m=done.artifact.manifest;assert.deepEqual(m.resolution,{width:640,height:320});assert.deepEqual(m.sourceResolution,{width:1280,height:640});assert.equal(m.time.delayCentiseconds.length,24);assert.equal(m.time.delayCentiseconds.reduce((a,b)=>a+b),200);assert.equal(m.time.realtime,false);assert.equal(m.time.frameCount,24);assert.equal(m.gif.palette,'RGB332');});
