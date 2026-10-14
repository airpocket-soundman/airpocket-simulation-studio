import {test} from 'node:test';import assert from 'node:assert/strict';
import {bicgstab} from '../src/bicgstab.js';import {solveAcoustic} from '../src/acoustic-core.js';import {acousticSweep} from '../src/acoustic-sweep.js';
const matrix=(rows)=>[{ids:rows.map((_,i)=>i),k:Float64Array.from(rows.flat())}];
const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],size:1},boundary={acousticPressures:[[0,1]]},study={frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:.01,referencePressurePa:20e-6};
test('BiCGStab reports recurrence residuals for zero, early s and full r paths without changing output',()=>{
 for(const [rows,rhs]of [[[[2,0],[0,3]],[1,2]],[[[4,1],[2,3]],[1,2]],[[[2,0],[0,3]],[0,0]]]){const events=[],entries=matrix(rows),baseline=bicgstab(2,entries,rhs,new Map()),result=bicgstab(2,entries,rhs,new Map(),{onObserve:event=>events.push(event)});assert.deepEqual(result,baseline);assert.equal(events.at(-1).residual,result.residual);assert.equal(events.at(-1).iteration,result.iterations);assert.equal(events.at(-1).converged,true);for(const event of events){assert.equal(event.stage,'iteration');assert.equal(event.solver,'bicgstab');assert.equal(event.residualKind,'recurrence-relative');assert.ok(Number.isFinite(event.residual));assert.equal(event.field,undefined);assert.equal(event.time,undefined);}}
 const early=[];bicgstab(2,matrix([[2,0],[0,3]]),[1,2],new Map(),{onObserve:e=>early.push(e)});assert.equal(early.at(-1).phase,'s-check');
 const full=[];bicgstab(2,matrix([[4,1],[2,3]]),[1,2],new Map(),{onObserve:e=>full.push(e)});assert.ok(full.some(e=>e.phase==='r-check'));
});
test('BiCGStab cadence, limit, breakdown, strict optout and observer exceptions preserve failure semantics',()=>{
 const n=80,rows=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?2:Math.abs(i-j)===1?-1:0)),events=[];
 assert.throws(()=>bicgstab(n,matrix(rows),Array(n).fill(1),new Map(),{maxIterations:26,tolerance:1e-15,onObserve:e=>events.push(e)}),/did not converge/);assert.deepEqual(events.map(e=>e.iteration),[1,25,26]);assert.ok(events.every(e=>!e.converged));
 let calls=0;const matvecFactory=(entries,n)=>x=>{calls++;const y=new Float64Array(n);for(const {ids,k}of entries)for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++)y[ids[i]]+=k[i*ids.length+j]*x[ids[j]];return y;};
 const input=matrix([[4,1],[2,3]]);const baseline=bicgstab(2,input,[1,2],new Map(),{matvecFactory}),baselineCalls=calls;calls=0;assert.deepEqual(bicgstab(2,input,[1,2],new Map(),{matvecFactory,onObserve:()=>{}}),baseline);assert.equal(calls,baselineCalls);
 assert.throws(()=>bicgstab(2,matrix([[0,0],[0,0]]),[1,2],new Map(),{onObserve:()=>{}}),/breakdown/);
 assert.throws(()=>bicgstab(2,matrix([[2,0],[0,3]]),[1,2],new Map(),{onObserve:()=>{throw Error('Observation failed');}}),/Observation failed/);
 for(const onObserve of [null,1,true])assert.throws(()=>bicgstab(2,matrix([[2,0],[0,3]]),[1,2],new Map(),{onObserve}),/onObserve/);
});
test('single frequency acoustics adds frequency context only and preserves every physical result',()=>{
 const events=[],baseline=solveAcoustic(mesh,boundary,study),result=solveAcoustic(mesh,boundary,{...study,onObserve:e=>events.push(e)});assert.deepEqual(result,baseline);assert.ok(events.length);for(const event of events){assert.equal(event.kind,'acoustic');assert.equal(event.frequencyHz,1000);assert.equal(event.solvePhase,'single');assert.equal(event.field,undefined);}assert.equal(events.at(-1).residual,result.residual);
 assert.throws(()=>solveAcoustic(mesh,boundary,{...study,onObserve:0}),/onObserve/);
});
test('sweep events bracket every sampled frequency and carry detached scalar summaries and iteration context',()=>{
 const settings={...study,sweepStart:500,sweepEnd:1000,sweepCount:3,receiverPoint:[.2,.2,.2]},events=[],baseline=acousticSweep(mesh,boundary,settings),result=acousticSweep(mesh,boundary,settings,{onObserve:e=>events.push(e)});assert.deepEqual(result,baseline);
 for(let i=0;i<3;i++){const selected=events.filter(e=>e.step===i+1);assert.equal(selected[0].stage,'frequency-step');assert.equal(selected[0].phase,'start');assert.equal(selected.at(-1).phase,'complete');assert.equal(selected.at(-1).metrics.residual,result.samples[i].residual);assert.equal(selected.at(-1).metrics.peakPressurePa,result.samples[i].peakPressurePa);assert.equal(selected.at(-1).metrics.splDb,result.samples[i].splDb);assert.ok(Object.values(selected.at(-1).metrics).every(Number.isFinite));for(const e of selected){assert.equal(e.steps,3);assert.equal(e.frequencyHz,result.samples[i].frequency);assert.equal(e.field,undefined);assert.equal(e.time,undefined);if(e.stage==='iteration')assert.equal(e.solvePhase,'sweep');}}
 events.at(-1).metrics.residual=999;assert.notEqual(result.samples.at(-1).residual,999);
 const failed=[];assert.throws(()=>acousticSweep(mesh,boundary,{...settings,receiverPoint:[99,99,99]},{onObserve:e=>failed.push(e)}));assert.equal(failed.filter(e=>e.stage==='frequency-step'&&e.phase==='complete').length,0);
 assert.throws(()=>acousticSweep(mesh,boundary,settings,{onObserve:()=>{throw Error('Sweep observer failed');}}),/Sweep observer failed/);assert.throws(()=>acousticSweep(mesh,boundary,settings,{onObserve:1}),/onObserve/);
});

test('nonfinite recurrence telemetry is omitted while original solver failures remain unchanged',()=>{
 for(const value of [NaN,Infinity]){
  const entries=matrix([[value,0],[0,1]]),events=[];let original;
  try{bicgstab(2,entries,[1,1],new Map(),{maxIterations:2});}catch(error){original=error;}
  assert.ok(original);assert.throws(()=>bicgstab(2,entries,[1,1],new Map(),{maxIterations:2,onObserve:e=>events.push(e)}),error=>error.message===original.message);assert.ok(events.every(e=>Number.isFinite(e.residual)&&Number.isFinite(e.tolerance)));
 }
 const fixed={acousticPressures:[0,1,2,3].map(i=>[i,1e308])},overflowSettings={...study,referencePressurePa:1e-300,sweepStart:500,sweepEnd:1000,sweepCount:2,receiverPoint:[.2,.2,.2]},overflowEvents=[],baseline=acousticSweep(mesh,fixed,overflowSettings),observed=acousticSweep(mesh,fixed,overflowSettings,{onObserve:e=>overflowEvents.push(e)});assert.deepEqual(observed,baseline);assert.ok(!Number.isFinite(observed.samples[0].splDb));assert.ok(!overflowEvents.some(e=>e.stage==='frequency-step'&&e.phase==='complete'));
 const events=[],settings={...study,sweepStart:500,sweepEnd:1000,sweepCount:2,receiverPoint:[.2,.2,.2]},matvecFactory=(_entries,n)=>()=>new Float64Array(n).fill(NaN);
 assert.throws(()=>acousticSweep(mesh,boundary,settings,{matvecFactory,onObserve:e=>events.push(e)}),/did not converge/);assert.ok(events.every(e=>e.stage!=='iteration'||Number.isFinite(e.residual)&&Number.isFinite(e.tolerance)));assert.ok(!events.some(e=>e.stage==='frequency-step'&&e.phase==='complete'));
});
