import {test} from 'node:test';import assert from 'node:assert/strict';
import {createSingleViewAcousticTimePlan as plan,encodeSingleViewAcousticTimeWebm as encode,getSingleViewAcousticTimeVerification as proof,singleViewAcousticTimeManifest as manifest,singleViewTimeWebmCapabilities as capabilities} from '../src/single-view-time-webm.js';
import {demuxFixedWebm,muxFixedWebm} from '../src/fixed-webm.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';import {fixedCodecEnv} from './helpers/single-view-fixed-codec.mjs';
const revision='sha256:'+'a'.repeat(64),output=()=>({result:{kind:'acousticTransient',snapshots:[0,.2,.9,1.2].map(time=>({time,pressure:[time]}))}}),canvas={width:4,height:4};
const args=()=>({output:output(),seconds:1,resultRevision:revision,initialCanvas:canvas,renderFrame:()=>canvas});

test('nonuniform physical axis has exact first/last and independent nearest thresholds with signed offsets',()=>{
 const p=plan(output(),1);assert.equal(p.frames.length,24);assert.equal(p.frames[0].snapshotIndex,0);assert.equal(p.frames[0].actualTimeSeconds,0);assert.equal(p.frames.at(-1).snapshotIndex,3);assert.equal(p.frames.at(-1).actualTimeSeconds,1.2);
 for(let i=0;i<24;i++){const requested=i===23?1.2:1.2*i/23,expected=requested<=.1?0:requested<=.55?1:requested<=1.05?2:3;assert.equal(p.frames[i].snapshotIndex,expected);assert.ok(Math.abs(p.frames[i].requestedTimeSeconds-requested)<1e-15);assert.equal(p.frames[i].offsetSeconds,[0,.2,.9,1.2][expected]-p.frames[i].requestedTimeSeconds);}
 assert.equal(plan(output(),15).frames.length,120);const maximum=plan({result:{kind:'acousticTransient',snapshots:Array.from({length:2048},(_,time)=>({time}))}},15);assert.equal(maximum.frames.at(-1).snapshotIndex,2047);assert.ok(Object.isFrozen(p.frames[0]));
});
test('verified Blob proof binds result revision, exact bytes, physical ledger and decoded endpoints',async()=>{
 const h=fixedCodecEnv(),a=args(),seen=[],blob=await encode({...a,renderFrame:step=>{seen.push(step);return canvas;}},h.env),bytes=new Uint8Array(await blob.arrayBuffer()),m=await manifest(blob,bytes,{seconds:1,resultRevision:revision});assert.equal(seen.length,24);assert.equal(h.stats.inputClosed,24);assert.equal(h.stats.decodedClosed,24);assert.equal(h.stats.codecClosed,2);assert.equal(m.time.frameCountGuaranteed,true);assert.equal(m.time.frameTimings.at(-1).actualTimeSeconds,1.2);assert.equal(m.time.frameTimings.at(-1).offsetSeconds,0);assert.deepEqual(m.resolution,canvas);
 const detached=proof(blob);detached.frames[0].snapshotIndex=99;assert.equal(proof(blob).frames[0].snapshotIndex,0);await assert.rejects(manifest(blob,bytes,{seconds:2,resultRevision:revision}));await assert.rejects(manifest(blob,bytes,{seconds:1,resultRevision:'sha256:'+'b'.repeat(64)}));assert.equal(proof(new Blob([bytes],{type:blob.type})),null);
});
for(const mode of ['unsupported','missing-last','duplicate','future','decode-missing-last'])test(mode+' cannot issue a completed single-view artifact',async()=>{
 const h=fixedCodecEnv(mode);await assert.rejects(encode(args(),h.env));assert.ok(h.stats.codecClosed<=2);
});
test('abort during a nonresolving flush closes frames and refuses issuance',async()=>{
 const h=fixedCodecEnv('flush-hang'),controller=new AbortController(),p=encode({...args(),signal:controller.signal},h.env);for(let i=0;i<200&&!h.stats.flushStarted;i++)await Promise.resolve();assert.equal(h.stats.flushStarted,true);controller.abort();await assert.rejects(p,/cancelled/);assert.equal(h.stats.inputClosed,24);assert.equal(h.stats.codecClosed,1);
});
test('unsupported/static/thermal/nonfinite/duplicate/reversed/unbounded axes reject without mutation',async()=>{
 for(const value of [{result:{kind:'thermal',snapshots:[{time:0},{time:1}]}},{result:{kind:'acousticTransient',snapshots:[{time:0}]}},...[[0,NaN],[0,0],[1,0],[-1,0]].map(times=>({result:{kind:'acousticTransient',snapshots:times.map(time=>({time}))}})),{result:{kind:'acousticTransient',snapshots:Array.from({length:2049},(_,time)=>({time}))}}])assert.throws(()=>plan(value,1));
 const value=output(),before=structuredClone(value);plan(value,1);assert.deepEqual(value,before);assert.equal(capabilities({VideoEncoder:null,VideoDecoder:null,VideoFrame:null,EncodedVideoChunk:null}).supported,false);
});
test('job manifest requires private proof; no arbitrary/legacy Blob receives the new endpoint guarantee',async()=>{
 const a=args(),h=fixedCodecEnv(),api=createVisualExportJobs({render:()=>encode(a,h.env)}),job=await api.start({requestId:'verified',expectedResultRevision:revision,format:'webm',animation:'time',seconds:1,view:{result:{field:'instantPressure'}}});await api.waitForSettled(job);const state=api.status(job);assert.equal(state.state,'completed');assert.equal(state.artifact.manifest.time.recording,'fixed-frame');assert.equal(state.artifact.manifest.time.frameCount,24);assert.equal(state.artifact.manifest.time.frameTimings.at(-1).actualTimeSeconds,1.2);
 const bad=createVisualExportJobs({render:()=>new Blob(['legacy'],{type:'video/webm'})}),rejected=await bad.start({requestId:'unverified',expectedResultRevision:revision,format:'webm',animation:'time',seconds:1,view:{}});await bad.waitForSettled(rejected);assert.equal(bad.status(rejected).state,'failed');assert.equal(bad.status(rejected).errorCode,'WEBM_ENDPOINT_UNVERIFIED');assert.throws(()=>bad.artifact(rejected),/unavailable/);
});


test('structurally identical altered packet bytes cannot borrow an issued decoder proof or override the job Blob reader',async()=>{
 const h=fixedCodecEnv(),blob=await encode(args(),h.env),original=new Uint8Array(await blob.arrayBuffer()),parsed=demuxFixedWebm(original);parsed.packets.at(-1).data[0]^=1;const altered=muxFixedWebm(parsed);await assert.rejects(manifest(blob,altered,{seconds:1,resultRevision:revision}),/bytes differ/);
 Object.defineProperty(blob,'arrayBuffer',{value:async()=>altered.buffer});const api=createVisualExportJobs({render:()=>blob}),job=await api.start({requestId:'override',expectedResultRevision:revision,format:'webm',animation:'time',seconds:1,view:{}});await api.waitForSettled(job);assert.equal(api.status(job).state,'failed');assert.equal(api.status(job).errorCode,'WEBM_ENDPOINT_UNVERIFIED');assert.throws(()=>api.artifact(job),/unavailable/);
});
test('ledger and issued revision snapshot do not follow later input changes; manifest owns bytes before its SHA await',async()=>{
 const h=fixedCodecEnv(),a=args(),pending=encode(a,h.env);a.output.result.snapshots[3].time=99;a.resultRevision='sha256:'+'b'.repeat(64);const blob=await pending,owned=new Uint8Array(await Blob.prototype.arrayBuffer.call(blob)),checking=manifest(blob,owned,{seconds:1,resultRevision:revision});owned.fill(0);const m=await checking;assert.equal(m.time.frameTimings.at(-1).actualTimeSeconds,1.2);assert.equal(proof(blob).sourceResultRevision,revision);
});
