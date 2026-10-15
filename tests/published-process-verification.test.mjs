import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runPublishedProcess} from '../scripts/published-process-runtime.mjs';

const base=new URL('./fixtures/',import.meta.url).href,module=new URL('./fixtures/published-verification-runtime.mjs',import.meta.url).href;
test('real verification child uses the same executable and exact selected module with advanced binary IPC',async()=>{
 const phases=[],request={operation:'mesh',buffer:Uint8Array.from([0,1,127,128,255]),options:{method:'wasm-pcg',size:6}},before=structuredClone(request);
 const terminal=await runPublishedProcess({task:'analysis',base,module,request},{onPhase:event=>phases.push(event)});
 assert.equal(terminal.error,undefined);assert.equal(terminal.result.synthetic,true);assert.notEqual(terminal.result.pid,process.pid);assert.equal(terminal.result.executable,process.execPath);assert.deepEqual(terminal.result.buffer,request.buffer);assert.deepEqual(terminal.result.options,request.options);assert.deepEqual(request,before);
 assert.equal(phases[0].phase,'spawn');assert.equal(phases.at(-1).phase,'close');assert.ok(phases.some(event=>event.phase==='import'));assert.ok(phases.some(event=>event.phase==='finalize'));assert.equal(new Set(phases.map(event=>event.childPid)).size,1);
});
test('real verification child refuses outside-cache modules and preserves module failures without fallback or retry',async()=>{
 const outside=await runPublishedProcess({task:'analysis',base:new URL('./fixtures/published-process/',import.meta.url).href,module,request:{}});assert.match(outside.error,/outside the verified cache/);
 const phases=[],failure=await runPublishedProcess({task:'analysis',base,module,request:{scenario:'throw'}},{onPhase:event=>phases.push(event)});assert.equal(failure.error,'Synthetic deployed module refusal');assert.equal(failure.result,undefined);assert.equal(phases.filter(event=>event.phase==='spawn').length,1);assert.equal(phases.at(-1).phase,'close');
});
test('real verification child timeout closes before rejection and a later explicit request is distinct',async()=>{
 const phases=[];await assert.rejects(runPublishedProcess({task:'analysis',base,module,request:{scenario:'stall'}},{timeoutMs:1000,onPhase:event=>phases.push(event)}),error=>error.code==='PUBLISHED_PROCESS_TIMEOUT');assert.ok(phases.some(event=>event.phase==='timeout'));assert.equal(phases.at(-1).phase,'close');assert.equal(phases.filter(event=>event.phase==='spawn').length,1);
 const nextPhases=[],next=await runPublishedProcess({task:'analysis',base,module,request:{operation:'mesh'}},{onPhase:event=>nextPhases.push(event)});assert.equal(next.result.synthetic,true);assert.equal(next.result.operation,'mesh');assert.equal(nextPhases.filter(event=>event.phase==='spawn').length,1);assert.equal(nextPhases.at(-1).phase,'close');
});
test('a real child result followed by nonzero close is a verification failure, not a published pass',async()=>{
 const phases=[];await assert.rejects(runPublishedProcess({task:'analysis',base,module,request:{}},{entry:new URL('./fixtures/published-verification-late-exit.mjs',import.meta.url),onPhase:event=>phases.push(event)}),error=>{assert.equal(error.code,'PUBLISHED_PROCESS_EXIT');assert.equal(error.exitCode,86);assert.match(error.stderrTail,/Synthetic late verification failure/);assert.ok(error.stderrBytes>0);assert.match(error.stderrSha256,/^[a-f0-9]{64}$/);return true;});assert.ok(phases.some(event=>event.phase==='result'));assert.equal(phases.at(-1).phase,'close');assert.equal(phases.filter(event=>event.phase==='spawn').length,1);
});
test('published verifier retains all 26 original checks plus progress history, confines WASM work to children and records checkpoints before completion',async()=>{
 const source=await readFile(new URL('../scripts/check-published.mjs',import.meta.url),'utf8'),expected=[
 'structural-airpocket-and-mfem','closed-convex-stl-volume-structure-and-archive','preinstalled-polymer-catalog-axial-reference-and-provenance','engineering-polymer-five-family-axial-references','mode-i-brittle-fracture-bounds-real-worker-and-archive','uniaxial-sn-fatigue-life-goodman-and-archive','thermal-radiation','rubber-finite-strain','laminar-channel-flow','three-dimensional-creeping-stokes-flow-and-archive','taylor-hood-p2-worker-physical-archive-and-midpoint-probe','exterior-radiation-and-far-field','transient-acoustic-wave-and-archive','modal-frequencies-and-archive','modal-to-exterior-acoustic-power','internal-cad-channel-and-port-archive','exact-planar-cad-patch-and-archive','exact-cylindrical-cad-patch-and-reaction','j2-plasticity-free-contraction-and-archive','j2-plasticity-elastic-unloading-and-archive','failure-and-restart','project-and-case-roundtrips','published-cad-reader-and-step-mesher','cad-update-reconciliation-pending-repair-and-step-worker-reference','oblique-planar-cad-area-and-reaction','progress-history-candidate'];
 assert.deepEqual([...source.matchAll(/await check\('([^']+)'/g)].map(match=>match[1]),expected);assert.equal([...source.matchAll(/checks\.push\(\{name:'deployed-asset-integrity'/g)].length,1);assert.ok([...source.matchAll(/assert\./g)].length>=158);
 assert.doesNotMatch(source,/from ['"]node:worker_threads['"]|new Worker\(/);assert.doesNotMatch(source,/import\(new URL\('gmsh\/gmsh\.mjs'/);assert.match(source,/childTask\('step-reference'\)/);assert.match(source,/childTask\('step-changed'\)/);assert.match(source,/runPublishedProcess\(/);
 for(const event of ['run-start','check-start','check-passed','check-failed','child-start','child-phase','child-closed','child-failed','run-passed','run-failed'])assert.ok(source.includes("'"+event+"'"),event);assert.match(source,/flag:'wx'/);assert.match(source,/appendFileSync/);assert.match(source,/checks:runState\.checks/);assert.match(source,/automaticFallback:false,automaticRetry:false/);
});
