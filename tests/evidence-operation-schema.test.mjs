import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';
import {createStudioApi} from '../src/studio-api.js';
import {validateInputProvenance} from '../src/input-provenance.js';
import {structuralContractProject} from './fixtures/structural-contract-projects.mjs';

import {accepts} from './fixtures/evidence-schema-validation.mjs';
const entry=()=>({pointer:'/materialProperties/youngModulus',value:1e9,source:{kind:'measured-document',reference:'Synthetic test document',revision:'fixture-1'},rationale:'Synthetic test input only',applicability:'Not material design data',status:'confirmed',assumption:null});
test('both edit contracts discover exact evidence and intent payloads while preserving other methods and valid extensions',()=>{
 const schemas=['edit','previewEdit'].map(method=>getBrowserOperationContracts({method}).operations[0].inputSchema.properties.operations.items);assert.deepEqual(schemas[0].allOf,schemas[1].allOf);
 const document={schemaVersion:1,entries:[entry()]};
 for(const schema of schemas){assert.equal(accepts(schema,{method:'setInputProvenance',args:[document]}),true);assert.equal(accepts(schema,{method:'setAnalysisIntent',args:[{mode:'exploratory'}]}),true);assert.equal(accepts(schema,{method:'selectTriangles',args:[0,[0,1],{replace:true}]}),true);assert.equal(accepts(schema,{method:'addCondition',args:[{type:'force',value:100,direction:[0,0,1]}]}),true);assert.equal(accepts(schema,{method:'setInputProvenance',args:[document,'ignored by existing setter']}),true);}
 const extended=structuredClone(document);extended.extra=true;extended.entries[0].extra={note:'Allowed existing JSON extension'};extended.entries[0].source={kind:'user-input',reference:123};validateInputProvenance(extended);assert.equal(accepts(schemas[0],{method:'setInputProvenance',args:[extended]}),true);
 let offset=0;do{const page=getBrowserOperationContracts({offset,limit:10});assert.ok(new TextEncoder().encode(JSON.stringify(page)).length<=65536);offset=page.nextOffset;}while(offset!==null);
});
test('discovered schema rejects malformed provenance and intent accepted only as generic JSON before, matching adapter refusals',()=>{
 const schema=getBrowserOperationContracts({method:'edit'}).operations[0].inputSchema.properties.operations.items;
 for(const mutate of [x=>delete x.entries[0].applicability,x=>x.entries[0].pointer='root',x=>x.entries[0].pointer='/bad~2escape',x=>x.entries[0].assumption='',x=>x.entries[0].source.kind='confidence',x=>delete x.entries[0].source.reference,x=>x.entries[0].confirmation={by:'agent',note:'Not user confirmation'},x=>x.entries[0].status='certain']){
  const value={schemaVersion:1,entries:[entry()]};mutate(value);assert.equal(accepts(schema,{method:'setInputProvenance',args:[value]}),false);assert.throws(()=>validateInputProvenance(value));
 }
 const studio=createStudioApi();studio.loadProject(structuralContractProject());const before=studio.exportProject();for(const value of [{mode:'legacy'},{mode:'quantitative',confidence:1},{}]){assert.equal(accepts(schema,{method:'setAnalysisIntent',args:[value]}),false);assert.throws(()=>studio.setAnalysisIntent(value));assert.deepEqual(studio.exportProject(),before);}
});
