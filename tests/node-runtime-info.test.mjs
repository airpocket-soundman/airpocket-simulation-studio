import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectNodeRuntime} from '../scripts/node-runtime-info.mjs';
const identity=()=>({version:'v24.11.1',versions:{v8:'13.6.233.10-node.28'},platform:'win32',arch:'x64'});
test('only the exact recorded runtime receives an unresolved observed-risk warning',()=>{
 const result=inspectNodeRuntime(identity());assert.equal(result.knownIssueAssessment,'observed-risk');
 assert.equal(result.diagnostics[0].code,'NODE_WASM_ALLOCATION_FATAL_OBSERVED');assert.equal(result.diagnostics[0].severity,'warning');assert.equal(result.diagnostics[0].status,'unresolved');
 assert.deepEqual(result.diagnostics[0].evidence,['docs/evidence/2026-10-14-observation-profiles-v8-failure.json','docs/evidence/2026-10-15-wave-channel-node24-v8-failure.json']);
 assert.equal(result.compatibilityVerified,false);assert.equal(result.rootFixProven,false);
 for(const mutate of [p=>p.version='v24.11.2',p=>p.versions.v8='13.6.233.10-node.29',p=>p.platform='linux',p=>p.arch='arm64',p=>p.version='v26.10.0']){
  const p=identity();mutate(p);const other=inspectNodeRuntime(p);assert.equal(other.knownIssueAssessment,'not-assessed');assert.deepEqual(other.diagnostics,[]);assert.equal(other.compatibilityVerified,false);assert.equal(other.rootFixProven,false);
 }
});
test('runtime metadata reads only four identity fields and returns independent plain JSON',()=>{
 const p=identity();for(const key of ['env','execPath','pid','hostname','cwd'])Object.defineProperty(p,key,{get(){throw Error('Private identity accessed');}});
 const result=inspectNodeRuntime(p);assert.deepEqual(Object.keys(result),['schemaVersion','kind','node','v8','platform','arch','knownIssueAssessment','diagnostics','compatibilityVerified','rootFixProven']);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);result.diagnostics[0].evidence.push('corrupted');result.diagnostics[0].suggestions[0]='corrupted';assert.equal(inspectNodeRuntime(p).diagnostics[0].evidence.length,2);assert.notEqual(inspectNodeRuntime(p).diagnostics[0].suggestions[0],'corrupted');
 const actual=inspectNodeRuntime();assert.equal(actual.node,process.version);assert.equal(actual.v8,process.versions.v8);assert.equal(actual.platform,process.platform);assert.equal(actual.arch,process.arch);
});
test('missing or invalid identity values are null and never infer compatibility',async()=>{
 for(const p of [null,undefined,4,[],{}, {version:42,versions:{v8:false},platform:{},arch:[]}]){
  // Explicit undefined uses the normal process default.
  if(p===undefined)continue;
  const result=inspectNodeRuntime(p);assert.equal(result.knownIssueAssessment,'not-assessed');assert.deepEqual([result.node,result.v8,result.platform,result.arch],[null,null,null,null]);
 }
 const source=await readFile(new URL('../scripts/node-runtime-info.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/^import\s/m);assert.doesNotMatch(source,/WebAssembly\.|process\.(?:env|execPath|pid)|fetch\(/);
});

test('recorded Linux Node version warning states its weaker match without inventing a recorded V8 build',()=>{
 const p={version:'v24.21.0',versions:{v8:'13.6.233.17-example'},platform:'linux',arch:'x64'},r=inspectNodeRuntime(p);
 assert.equal(r.knownIssueAssessment,'observed-risk');assert.equal(r.v8,p.versions.v8);assert.equal(r.diagnostics[0].recordedV8Version,null);assert.equal(r.diagnostics[0].matchBasis,'node-version-platform-architecture');
 assert.deepEqual(r.diagnostics[0].evidence,['docs/evidence/2026-10-15-publication-badce2c-v8-failure.json']);assert.equal(r.rootFixProven,false);assert.equal(r.compatibilityVerified,false);
 for(const change of [{version:'v24.22.0'},{platform:'win32'},{arch:'arm64'}])assert.equal(inspectNodeRuntime({...p,...change}).knownIssueAssessment,'not-assessed');
});
