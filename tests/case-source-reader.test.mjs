import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {getProjectRevision} from '../src/project-revision.js';
const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]}});
function setup(options={}){const store=createCaseStore();store.add('A',output());store.add('B',output());let sequence=0;return {store,api:createCaseOperations({store,id:()=>String(++sequence),...options})};}
const reference=row=>({caseId:row.caseId,expectedRevision:row.revision});
test('host source is prepared, detached and guarded by a synchronous collection lease',async()=>{
 let valid=true;const {api,store}=setup(),row=(await api.list()).cases[0],before=store.export(),source=await api.readSource(reference(row),{guard:()=>valid});assert.equal(source.caseId,row.caseId);assert.equal(source.revision,row.revision);assert.equal(source.name,'A');assert.equal(typeof source.assertCurrent,'function');assert.ok(source.output.mesh.summary.nodeCount);assert.equal(before.cases[0].output.mesh.summary,undefined);source.output.result.displacement[0]=99;assert.deepEqual(store.export(),before);assert.equal(source.assertCurrent(),undefined);valid=false;assert.throws(source.assertCurrent,{code:'CASE_COMMAND_EXPIRED'});valid=true;store.remove(1);assert.throws(source.assertCurrent,{code:'CASE_REVISION_CONFLICT'});
});
test('source references are strict snapshots and reject stale, corrupt and expired cases',async()=>{
 const {api,store}=setup(),row=(await api.list()).cases[0],ref=reference(row);await assert.rejects(api.readSource({...ref,extra:true}),/only/);await assert.rejects(api.readSource({...ref,expectedRevision:'sha256:'+'0'.repeat(64)}),{code:'CASE_REVISION_CONFLICT'});await assert.rejects(api.readSource(ref,{guard:()=>false}),{code:'CASE_COMMAND_EXPIRED'});
 const mutable={...ref},pending=api.readSource(mutable);mutable.caseId='changed';assert.equal((await pending).caseId,row.caseId);
 let valid=true;const expired=api.readSource(ref,{guard:()=>valid});valid=false;await assert.rejects(expired,{code:'CASE_COMMAND_EXPIRED'});
 const corrupt=store.export();corrupt.cases[0].output.result.displacement.pop();store.import(corrupt);const invalid=(await api.list()).cases[0];await assert.rejects(api.readSource(reference(invalid)),/fields/);
});
test('source lease invalidates after rename even though its case ID survives',async()=>{const {api}=setup(),row=(await api.list()).cases[0],source=await api.readSource(reference(row));await api.rename({...reference(row),name:'New name'});assert.throws(source.assertCurrent,{code:'CASE_REVISION_CONFLICT'});});
test('collection edits during source hashing are rejected before returning a lease',async()=>{const {api,store}=setup(),row=(await api.list()).cases[0],pending=api.readSource(reference(row));store.remove(1);await assert.rejects(pending,{code:'CASE_REVISION_CONFLICT'});assert.equal(store.list().length,1);});
