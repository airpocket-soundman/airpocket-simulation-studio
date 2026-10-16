import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/repro-v8-wasm-terminate.mjs',import.meta.url));
// Schema only: a crash is a valid observation of the diagnostic and is never asserted either way.
for(const shared of ['0','1'])test('V8 wasm terminate reproducer emits its output schema (shared='+shared+', tiny configuration)',()=>{
 let text;try{text=execFileSync(process.execPath,[script,'--children=1','--iterations=3','--shared='+shared],{encoding:'utf8',timeout:10000,windowsHide:true});}catch(error){text=error.stdout;}
 const report=JSON.parse(text);
 assert.equal(report.schemaVersion,1);assert.equal(report.node,process.version);
 assert.equal(report.cell.shared,shared==='1');assert.equal(report.cell.module,'tiny');assert.equal(report.childrenRun,1);
 for(const key of ['iterationsCompleted','crashes','harnessErrors','durationMs'])assert.equal(typeof report[key],'number',key);
 assert.ok(Array.isArray(report.signatures)&&Array.isArray(report.exitCodes));assert.equal(typeof report.verdict,'string');
});
