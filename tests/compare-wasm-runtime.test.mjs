import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparisonPlan} from '../scripts/compare-wasm-runtime.mjs';
test('comparison has two fixed modes,exclusive evidence paths and bounded iterations',()=>{const p=comparisonPlan(['1','report.json']);assert.deepEqual(p.modes.map(m=>m.mode),['default','disabled']);assert.ok(p.modes[1].args.includes('--wasm-code-gc=disabled'));assert.notEqual(p.modes[0].output,p.modes[1].output);assert.throws(()=>comparisonPlan(['4','report.json']));assert.throws(()=>comparisonPlan(['2','report.json','--target=full']));assert.throws(()=>comparisonPlan(['1','report.json','--wasm-code-gc=disabled']));});

test('timeout escalates owned child termination and does not claim cleanup without close',async()=>{const {EventEmitter}=await import('node:events'),{runDiagnosticChild}=await import('../scripts/compare-wasm-runtime.mjs');const child=new EventEmitter(),kills=[];child.kill=s=>kills.push(s);const result=await runDiagnosticChild([],{timeoutMs:5,graceMs:5,closeGraceMs:5,spawnChild:()=>child});assert.deepEqual(kills,['SIGTERM','SIGKILL']);assert.equal(result.timedOut,true);assert.equal(result.cleanupConfirmed,false);});
test('cancellation waits for close and records confirmed cleanup',async()=>{const {EventEmitter}=await import('node:events'),{runDiagnosticChild}=await import('../scripts/compare-wasm-runtime.mjs');const child=new EventEmitter(),controller=new AbortController(),kills=[];child.kill=s=>{kills.push(s);setImmediate(()=>child.emit('close',null,s));};const pending=runDiagnosticChild([],{timeoutMs:1000,signal:controller.signal,spawnChild:()=>child});controller.abort();const result=await pending;assert.deepEqual(kills,['SIGTERM']);assert.equal(result.cancelled,true);assert.equal(result.cleanupConfirmed,true);});


test('job-store comparison forwards the fixed target into both existing explicit diagnostic modes',()=>{
 const plan=comparisonPlan(['1','job-store-compare.json','--target=analysis-job-store']);assert.equal(plan.config.target,'analysis-job-store');assert.deepEqual(plan.modes.map(mode=>mode.mode),['default','disabled']);
 for(const mode of plan.modes){assert.ok(mode.args.includes('--target=analysis-job-store'));assert.equal(mode.args[1],'1');assert.equal(mode.args.some(arg=>arg.startsWith('--concurrency=')),false);assert.ok(mode.args.includes('--wasm-code-gc='+mode.mode));}
});
