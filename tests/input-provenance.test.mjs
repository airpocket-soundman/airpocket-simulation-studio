import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInputProvenance,validateInputProvenance,inspectInputProvenance} from '../src/input-provenance.js';
const project=()=>({materialProperties:{youngModulus:2e9},conditions:[{force:10}]});
const pointer='/materialProperties/youngModulus';
const entry=(extra={})=>({pointer,value:2e9,source:{kind:'measured-document',reference:'TDS example',revision:'2026-01'},rationale:'Elastic modulus at test conditions',applicability:'Dry, 23 degC, small strain',assumption:null,status:'confirmed',...extra});
const inspect=(data,options={})=>inspectInputProvenance(project(),data,{mode:'quantitative',requiredPointers:[pointer],...options});

test('provenance roundtrips JSON and preserves independent input snapshots',()=>{
 const entries=[entry()],document=createInputProvenance(entries);entries[0].value=1;
 assert.equal(document.entries[0].value,2e9);assert.equal(validateInputProvenance(JSON.parse(JSON.stringify(document))),true);
 assert.equal(inspect(document).allowed,true);assert.equal(inspect(document).provisional,false);
});
test('legacy missing metadata is backward compatible; new mode requires evidence',()=>{
 assert.equal(inspectInputProvenance(project(),undefined).allowed,true);
 const result=inspect(undefined);assert.equal(result.allowed,false);const issue=result.diagnostics[0];
 assert.equal(issue.code,'PROVENANCE_REQUIRED');assert.equal(issue.target,pointer);assert.equal(issue.evidence.value,2e9);assert.ok(issue.suggestions.length);assert.equal(issue.requiresUserIntent,true);
});
test('unconfirmed input blocks quantitative; explicit exploratory assumption stays provisional',()=>{
 const document=createInputProvenance([entry({status:'unconfirmed',assumption:'Approximate dry ambient modulus'})]);
 assert.equal(inspect(document).diagnostics[0].code,'INPUT_UNCONFIRMED');
 const result=inspect(document,{mode:'exploratory'});assert.equal(result.allowed,true);assert.equal(result.provisional,true);
 const noAssumption=createInputProvenance([entry({status:'unconfirmed'})]);assert.equal(inspect(noAssumption,{mode:'exploratory'}).allowed,false);
});
test('LLM confidence does not establish agent-proposal evidence',()=>{
 const document=createInputProvenance([entry({source:{kind:'agent-proposal',confidence:1}})]);
 assert.equal(inspect(document).allowed,false);
 document.entries[0].confirmation={by:'user',note:'User confirmed measured specimen value'};assert.equal(inspect(document).allowed,true);
});
test('changed values and deleted optional inputs invalidate old provenance',()=>{
 const document=createInputProvenance([entry(),entry({pointer:'/conditions/0/force',value:10,source:{kind:'user-input'}})]);
 const changed=project();changed.materialProperties.youngModulus=3e9;delete changed.conditions[0].force;
 const result=inspectInputProvenance(changed,document,{mode:'quantitative',requiredPointers:[pointer]});
 assert.equal(result.allowed,false);assert.equal(result.diagnostics.filter(d=>d.code==='PROVENANCE_STALE').length,2);
 assert.equal(result.diagnostics[0].evidence.recordedValue,2e9);assert.equal(result.diagnostics[0].evidence.value,3e9);
});
test('required absence cannot be replaced by a recorded assumption',()=>{
 const document=createInputProvenance([entry({pointer:'/missing',assumption:'Guess'})]);
 const result=inspect(document,{mode:'exploratory',requiredPointers:['/missing']});assert.equal(result.allowed,false);assert.ok(result.diagnostics.some(d=>d.code==='INPUT_REQUIRED'));
});
test('source revisions, pointer escaping and duplicate validation',()=>{
 assert.throws(()=>createInputProvenance([entry({source:{kind:'cad',reference:'model.step'}})]),/revision/);
 assert.throws(()=>createInputProvenance([entry(),entry()]),/Duplicate/);
 assert.throws(()=>createInputProvenance([entry({pointer:'/bad~2'})]),/pointer/);
 const document=createInputProvenance([entry({pointer:'/a~1b/~0value',value:4,source:{kind:'cad',reference:'model.step',revision:'sha256:abc'}})]);
 assert.equal(inspectInputProvenance({'a/b':{'~value':4}},document,{mode:'quantitative',requiredPointers:['/a~1b/~0value']}).allowed,true);
 assert.equal(inspectInputProvenance({}, {schemaVersion:2},{mode:'quantitative'}).diagnostics[0].code,'PROVENANCE_INVALID');
});
