import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gifFrameDelays} from '../src/gif-encoder.js';
import {ACOUSTIC_STUDY,COMPARISON_CAMERA,SOURCE_AMPLITUDES_PA,createAcousticComparisonHarness} from './fixtures/comparison-acoustic-time-gif.mjs';
const TIMES=ACOUSTIC_STUDY.acousticDuration;
const nearest=(times,time)=>times.reduce((best,t,i)=>Math.abs(t-time)<Math.abs(times[best]-time)?i:best,0);

// Independent structural GIF walk: header, global colour table, extension blocks and image descriptors.
// It does not trust the encoder's own bookkeeping; it reads the emitted bytes.
function parseGif(bytes){
 assert.equal(new TextDecoder().decode(bytes.subarray(0,6)),'GIF89a');
 const word=p=>bytes[p]|bytes[p+1]<<8,width=word(6),height=word(8),packed=bytes[10];
 assert.equal(packed>>7,1);const colourCount=2<<(packed&7),palette=bytes.subarray(13,13+3*colourCount);
 let p=13+3*colourCount,loop=null;const delays=[];
 while(bytes[p]!==59){
  const marker=bytes[p++];
  if(marker===0x21){
   const label=bytes[p++];
   if(label===0xF9){assert.equal(bytes[p++],4);p++;delays.push(word(p));p+=4;}
   else if(label===0xFF){const n=bytes[p++],id=new TextDecoder().decode(bytes.subarray(p,p+n));p+=n;if(id==='NETSCAPE2.0'){assert.equal(bytes[p++],3);assert.equal(bytes[p],1);loop=bytes[p+1]|bytes[p+2]<<8;p+=3;}while(bytes[p]){const k=bytes[p++];p+=k;}p++;}
   else{while(bytes[p]){const k=bytes[p++];p+=k;}p++;}
   continue;
  }
  assert.equal(marker,0x2C);const left=word(p),top=word(p+2),w=word(p+4),h=word(p+6),flags=bytes[p+8];p+=9;
  assert.equal(flags,0);assert.equal(left+top,0);assert.equal(w,width);assert.equal(h,height);
  p++;while(bytes[p]){const k=bytes[p++];p+=k;}p++;
 }
 assert.equal(p,bytes.length-1);
 return {width,height,colourCount,palette,loop,delays};
}

test('real transient-acoustic pair encodes the 2 s fixed-frame time GIF with stored-frame selection',async()=>{
 const h=createAcousticComparisonHarness(),prepared=await h.prepare(),plan=h.plan(),comparison=prepared.comparison;
 assert.equal(comparison.unit,'Pa');
 assert.deepEqual(comparison.gifAnimation,{frames:24,width:640,height:320,palette:'RGB332',colors:256,phasePolicy:'i/23',lossy:true,loop:0});
 assert.equal(comparison.timeAnimation.interpolated,false);assert.equal(comparison.timeAnimation.camera,'fixed');
 assert.equal(comparison.timeAnimation.timeSelection,'nearest-stored-frames-only');
 assert.deepEqual(comparison.timeAnimation.startTimeSeconds,0);assert.equal(comparison.timeAnimation.endTimeSeconds,TIMES);
 assert.deepEqual(comparison.colorRange,plan.colorRange);
 // Common colour range is the range of the saved fields actually used, in Pa, across both cases.
 const stored=h.cases.map(c=>c.output.result.snapshots.filter(f=>f.time>=0&&f.time<=TIMES).flatMap(f=>f.pressure));
 assert.equal(plan.unit,'Pa');assert.equal(plan.colorRange.field,'instantPressure');
 assert.equal(plan.colorRange.minimum,Math.min(...stored.flat()));assert.equal(plan.colorRange.maximum,Math.max(...stored.flat()));
 // Two cases differ only by the explicit source amplitude.
 const [a,b]=h.cases.map(c=>c.output.result);
 assert.ok(Math.abs(a.maxPressurePa)>0);assert.ok(Math.abs(b.maxPressurePa/a.maxPressurePa-SOURCE_AMPLITUDES_PA[1]/SOURCE_AMPLITUDES_PA[0])<1e-9);
 assert.notDeepEqual(a.snapshots[1].pressure,b.snapshots[1].pressure);
 const blobs=await h.render(prepared);
 assert.equal(blobs.type,'image/gif');
 const gif=parseGif(new Uint8Array(await blobs.arrayBuffer()));
 assert.equal(gif.width,640);assert.equal(gif.height,320);assert.equal(gif.colourCount,256);
 assert.equal(gif.delays.length,24);assert.deepEqual(gif.delays,gifFrameDelays(2));
 assert.equal(gif.delays.reduce((s,v)=>s+v,0),200);assert.equal(gif.loop,0);
 // RGB332 palette: 7 levels red, 8 green, 4 blue, opaque white at the last index.
 assert.deepEqual([...gif.palette.slice(-3)],[255,255,255]);assert.deepEqual([...gif.palette.slice(0,3)],[0,0,0]);
 // i/23 phases: both display endpoints, 24 frames; the adapter's GIF path uses the time plan for each.
 assert.equal(h.phases.length,24);assert.equal(h.phases[0],0);assert.equal(h.phases[23],1);assert.equal(h.phases[1],1/23);
 const frames=h.renders.slice(1);assert.equal(frames.length,24);assert.equal(h.renders.length,25);
 for(let i=0;i<24;i++){
  const expected=plan.atPhase(i/23),rendered=frames[i];
  assert.equal(rendered.timeSeconds,expected.timeSeconds);
  assert.deepEqual(rendered.camera,COMPARISON_CAMERA);assert.deepEqual(rendered.colorRange,plan.colorRange);
  h.cases.forEach((c,k)=>{
   const times=c.output.result.snapshots.map(f=>f.time),index=nearest(times,expected.timeSeconds),panel=expected.panels[k];
   assert.equal(panel.frameIndex,index);assert.equal(panel.timeSeconds,times[index]);
   assert.equal(panel.offsetSeconds,times[index]-expected.timeSeconds);
   assert.ok(times.includes(panel.timeSeconds));
  });
 }
});

test('time GIF refuses tolerance, single time, bad ranges, stale revisions and static acoustics before encoding',async()=>{
 // toleranceSeconds=0 cannot cover the unsaved interior times of a stored axis.
 const tight=createAcousticComparisonHarness({toleranceSeconds:0});
 await assert.rejects(tight.prepare(),/tolerance/);assert.equal(tight.renders.length,0);
 await assert.rejects(createAcousticComparisonHarness({startTimeSeconds:TIMES,endTimeSeconds:TIMES}).prepare(),/increasing physical time range/);
 await assert.rejects(createAcousticComparisonHarness({startTimeSeconds:.001,endTimeSeconds:.0005}).prepare(),/increasing physical time range/);
 const fixed=createAcousticComparisonHarness();await assert.rejects(fixed.prepare({timeSeconds:.0005}),/not a fixed timeSeconds/);assert.equal(fixed.renders.length,0);
 await assert.rejects(createAcousticComparisonHarness().prepare({field:'temperature'}),/two thermal temperature results or two transient acoustic pressure results/);
 // A static (non-transient) acoustic result has no stored time axis to select frames from.
 const stat=createAcousticComparisonHarness({mutateCases:cases=>{cases[1].output={...cases[1].output,result:{kind:'acoustic',pressure:[0,0,0,0]}};}});
 await assert.rejects(stat.prepare(),/two transient acoustic pressure results|increasing stored frame times/);assert.equal(stat.renders.length,0);
 // Stale case revision is refused during source acquisition, before any render.
 const stale=createAcousticComparisonHarness();
 await assert.rejects(stale.prepare({references:stale.request.references.map(r=>({...r,expectedRevision:'stale-revision'}))}),/Case content changed/);assert.equal(stale.renders.length,0);
});

test('cancel returns no artifact and success/cancel keep input, cases, result and comparison settings identical',async()=>{
 const h=createAcousticComparisonHarness();
 const snapshot={input:structuredClone(ACOUSTIC_STUDY),cases:h.cases.map(c=>({caseId:c.caseId,revision:c.revision})),result:structuredClone(h.cases.map(c=>c.output.result)),compare:structuredClone(h.request)};
 const prepared=await h.prepare(),controller=new AbortController();let yields=0;
 h.env.yieldControl=async()=>{if(++yields===5)controller.abort();};
 await assert.rejects(h.render(prepared,{signal:controller.signal}),/cancelled/);
 assert.equal(yields,5);assert.equal(h.state.locks,1);assert.equal(h.state.releases,1);assert.equal(h.state.busy,false);
 assert.deepEqual(structuredClone(ACOUSTIC_STUDY),snapshot.input);
 assert.deepEqual(h.cases.map(c=>({caseId:c.caseId,revision:c.revision})),snapshot.cases);
 assert.deepEqual(structuredClone(h.cases.map(c=>c.output.result)),snapshot.result);
 assert.deepEqual(structuredClone(h.request),snapshot.compare);
 const ok=createAcousticComparisonHarness(),before=structuredClone(ok.cases.map(c=>c.output.result));
 const blob=await ok.render(await ok.prepare());assert.equal(blob.type,'image/gif');
 assert.deepEqual(structuredClone(ok.cases.map(c=>c.output.result)),before);
});
