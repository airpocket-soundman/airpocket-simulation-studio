import {fixedWebmFixture} from './fixtures/fixed-webm.mjs';
import {fixedWebmSchedule} from '../src/fixed-webm.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonExportAdapter} from '../src/comparison-export-adapter.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {createComparisonFrameTiming,COMPARISON_TIMING_LIMITS} from '../src/comparison-frame-timing.js';
import {renderComparisonGif} from '../src/ui/comparison-gif.js';
import {createGifCanvasEnv} from './fixtures/comparison-acoustic-time-gif.mjs';
import {getProjectRevision} from '../src/project-revision.js';

const camera={position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40};
const axes=[[0,1,6,10],[0,3,4,10]],sha=i=>'sha256:'+String(i).repeat(64);
function fixture(format,{overflow=false,cancel=false}={}){
 const outputs=axes.map(times=>({mesh:{nodes:[0,0,0]},result:{kind:'thermal',transient:true,snapshots:times.map((time,i)=>({time,temperature:[20+i]}))}}));
 const renders=[];let releases=0;
 const adapter=createComparisonExportAdapter({cases:{readSource:async ref=>({caseId:ref.caseId,revision:ref.expectedRevision,name:ref.caseId,output:outputs[Number(ref.caseId)],assertCurrent(){}})},getDefaults:()=>({camera,deformScale:1}),renderComparison:args=>{renders.push(args);return {canvas:{width:1280,height:640},panels:[],colorRange:args.colorRange??{field:'temperature',minimum:20,maximum:23},unit:'degC'};},acquireHostLock:()=>({assertOwned(){},release(){releases++;}}),encodeGif:args=>{
  if(overflow){for(let i=0;i<=COMPARISON_TIMING_LIMITS.frames;i++)args.renderFrame(camera,{phase:0});}
  if(cancel)throw Error('Comparison GIF cancelled');
  return renderComparisonGif(args,createGifCanvasEnv());
 },encodeFixedVideo:async args=>{const f=fixedWebmFixture(args.seconds);for(const frame of fixedWebmSchedule(args.seconds))args.renderFrame(camera,{phase:frame.phase});args.onVerified(f.context.getFixedVerification());return f.blob;},recordVideo:async args=>{for(let i=0;i<3000;i++)args.renderFrame(camera,{phase:i/2999});return new Blob([Uint8Array.of(26,69,223,163)],{type:'video/webm'});}});
 const queue=createVisualExportJobs({render:()=>{},prepareCompare:(...args)=>adapter.prepare(...args),renderCompare:args=>adapter.render(args)});
 const request={requestId:'trace-'+format,references:outputs.map((_,i)=>({caseId:String(i),expectedRevision:sha(i+1)})),field:'temperature',format,animation:'time',seconds:2,startTimeSeconds:0,endTimeSeconds:10};
 return {outputs,renders,queue,request,get releases(){return releases;}};
}
async function complete(h){const job=await h.queue.startCompare(h.request);await h.queue.waitForSettled(job);return h.queue.status(job);}

for(const format of ['gif','webm'])test(format+' actual adapter/queue manifest binds each intermediate request to both nonuniform stored time axes',async()=>{
 const h=fixture(format),before=structuredClone(h.outputs),done=await complete(h);assert.equal(done.state,'completed',done.error);
 const manifest=done.artifact.manifest,trace=manifest.time.frameTimings;
 assert.equal(trace.interpolated,false);assert.equal(trace.timeSelection,'nearest-stored-frames-only');
 assert.equal(trace.entries.length,format==='gif'?24:48);assert.match(trace.mapping,format==='gif'?/per encoded GIF/:/verified encoded/);
 const requests=h.renders.slice(1);assert.equal(requests.length,trace.entries.length);
 for(let i=0;i<trace.entries.length;i++){
  const entry=trace.entries[i];assert.equal(entry.renderIndex,i);assert.equal(entry.requestedTimeSeconds,requests[i].timeSeconds);
  assert.equal(entry.requestedTimeSeconds,entry.phase*10);
  for(const panel of entry.panels){
   const axis=axes[panel.caseIndex];let nearest=0;for(let j=1;j<axis.length;j++)if(Math.abs(axis[j]-entry.requestedTimeSeconds)<Math.abs(axis[nearest]-entry.requestedTimeSeconds))nearest=j;
   assert.equal(panel.frameIndex,nearest);assert.equal(panel.timeSeconds,axis[nearest]);assert.equal(panel.offsetSeconds,axis[nearest]-entry.requestedTimeSeconds);
   const identity=manifest.comparison.cases[panel.caseIndex];assert.equal(identity.caseId,String(panel.caseIndex));assert.equal(identity.revision,sha(panel.caseIndex+1));assert.equal(identity.resultRevision,await getProjectRevision(h.outputs[panel.caseIndex]));
  }
 }
 assert.ok(trace.entries.some(e=>e.panels[0].timeSeconds!==e.panels[1].timeSeconds),'two panels actually select different stored times');
 assert.deepEqual(h.outputs,before);assert.equal(h.releases,1);
 const exposed=h.queue.artifact({jobId:done.jobId,length:1});exposed.manifest.time.frameTimings.entries[0].panels[0].timeSeconds=999;
 assert.equal(h.queue.status(done).artifact.manifest.time.frameTimings.entries[0].panels[0].timeSeconds,0,'returned manifests cannot mutate retained trace');
 assert.ok(new TextEncoder().encode(JSON.stringify(manifest)).length<=4096+COMPARISON_TIMING_LIMITS.bytes);
});

test('Orbit WebM with many render callbacks preserves existing success and policy summary without a per-render ledger',async()=>{
 const h=fixture('webm');h.request.animation='orbit';delete h.request.startTimeSeconds;delete h.request.endTimeSeconds;h.request.timeSeconds=0;const done=await complete(h);assert.equal(done.state,'completed',done.error);
 assert.equal(h.renders.length,3001);assert.equal(done.artifact.manifest.time.frameTimings,undefined);
 assert.equal(done.artifact.manifest.comparison.timeAnimation,undefined);
 assert.equal(done.artifact.manifest.time.fps.frameCountGuaranteed,false);assert.equal(h.releases,1);
 assert.ok(new TextEncoder().encode(JSON.stringify(done.artifact.manifest)).length<=4096);
});

test('timing overflow refuses the artifact and releases the host lock rather than truncating evidence',async()=>{
 const h=fixture('gif',{overflow:true}),done=await complete(h);assert.equal(done.state,'failed');assert.match(done.error,/timing exceeds/);assert.equal(done.artifact,undefined);assert.equal(h.releases,1);assert.throws(()=>h.queue.artifact(done),/unavailable/);
});

test('timing snapshots are detached and reset; byte bound refuses oversized records',()=>{
 const plan={atPhase:phase=>({timeSeconds:phase,panels:[{frameIndex:0,timeSeconds:0,offsetSeconds:-phase},{frameIndex:1,timeSeconds:1,offsetSeconds:1-phase}]})},ledger=createComparisonFrameTiming(plan,{format:'gif'});
 ledger.record(.5);const snapshot=ledger.snapshot();snapshot.entries[0].panels[0].timeSeconds=999;assert.equal(ledger.snapshot().entries[0].panels[0].timeSeconds,0);ledger.reset();assert.equal(ledger.snapshot().entries.length,0);
 const big=createComparisonFrameTiming({atPhase:()=>({timeSeconds:0,panels:[{frameIndex:0,timeSeconds:0,offsetSeconds:0,unexpected:'x'.repeat(COMPARISON_TIMING_LIMITS.bytes)}]})},{format:'gif'});
 assert.throws(()=>big.record(0),/byte bound/);assert.equal(big.snapshot().entries.length,0);
});
