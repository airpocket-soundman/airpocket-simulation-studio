import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preflightProject} from '../src/analysis-preflight.js';
import {createInputProvenance} from '../src/input-provenance.js';
const project=()=>({version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:[0]}]}],study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:2e9,poissonRatio:.3}});
function documented(p,unconfirmed=false){
 p.analysisIntent={mode:unconfirmed?'exploratory':'quantitative'};
 const pointers=preflightProject(p).requiredPointers;
 p.inputProvenance=createInputProvenance(pointers.map(pointer=>({pointer,value:pointer.slice(1).split('/').reduce((value,key)=>value[key],p),source:{kind:'user-input'},rationale:'User supplied physical model',status:unconfirmed?'unconfirmed':'confirmed',assumption:unconfirmed?'Preliminary model assumption':null,applicability:'Static small strain reference case'})));return p;
}
test('explicit structure requires materials, boundaries and gravity intent evidence, without mutation',()=>{
 const p=documented(project()),before=structuredClone(p),report=preflightProject(p,{}, {target:'node'});
 assert.equal(report.allowed,true);assert.equal(report.completePreflight,false);assert.equal(report.provisional,false);assert.equal(report.units.youngModulus,'Pa');assert.equal(report.units.geometry,'mm');assert.deepEqual(p,before);
 assert.ok(report.requiredPointers.includes('/conditions/0/regions'));assert.ok(report.requiredPointers.includes('/conditions/0/type'));assert.ok(report.remainingChecks.length);
});
test('legacy metadata absence remains compatible without inventing missing physical values',()=>{
 const p=project();delete p.materialProperties;delete p.study;
 const report=preflightProject(p);assert.equal(report.mode,'legacy');assert.equal(report.allowed,false);assert.ok(report.diagnostics.some(d=>d.code==='MATERIAL_REQUIRED'&&d.severity==='error'));const valid=project();delete valid.study;assert.equal(preflightProject(valid).allowed,true);
});
test('quantitative missing provenance and stale values block with repair diagnostics',()=>{
 const p=project();p.analysisIntent={mode:'quantitative'};let result=preflightProject(p);assert.equal(result.allowed,false);assert.ok(result.diagnostics.some(d=>d.code==='PROVENANCE_REQUIRED'));
 const full=documented(project());full.materialProperties.youngModulus=3e9;result=preflightProject(full);const issue=result.diagnostics.find(d=>d.code==='PROVENANCE_STALE');assert.equal(issue.target,'/materialProperties/youngModulus');assert.equal(issue.evidence.value,3e9);assert.ok(issue.suggestions.length);
});
test('exploratory assumptions are provisional while quantitative unconfirmed inputs block',()=>{
 const p=documented(project(),true);assert.equal(preflightProject(p).allowed,true);assert.equal(preflightProject(p).provisional,true);p.analysisIntent.mode='quantitative';assert.equal(preflightProject(p).allowed,false);
});
test('obvious missing supports, invalid materials and units have stable diagnoses',()=>{
 const p=project();p.conditions=[];p.materialProperties.youngModulus=-1;p.units={geometry:'m'};
 const report=preflightProject(p);assert.equal(report.allowed,false);for(const code of ['STRUCTURAL_SUPPORT_MISSING','MATERIAL_INVALID','INPUT_UNIT_MISMATCH'])assert.ok(report.diagnostics.some(d=>d.code===code));
});
test('gravity requires density and acceleration; invalid intent and options are reports',()=>{
 const p=project();p.analysisIntent={mode:'quantitative'};p.study.gravityEnabled=true;
 let result=preflightProject(p);assert.ok(result.requiredPointers.includes('/study/gravity'));assert.ok(result.requiredPointers.includes('/materialProperties/density'));assert.equal(result.allowed,false);
 p.analysisIntent.mode='invalid';result=preflightProject(p,{size:-1,method:'unknown'});for(const code of ['ANALYSIS_INTENT_INVALID','MESH_SIZE_INVALID','EXECUTION_METHOD_UNSUPPORTED'])assert.ok(result.diagnostics.some(d=>d.code===code));
});
test('unresolved CAD and unsupported study contracts are honest about scope',()=>{
 const p=project();p.conditions[0].cadUpdateRequired={};assert.ok(preflightProject(p).diagnostics.some(d=>d.code==='CAD_REGIONS_UNRESOLVED'));
 const thermal=project();thermal.study={kind:'thermal'};thermal.analysisIntent={mode:'quantitative'};const result=preflightProject(thermal,{}, {target:'node'});assert.equal(result.allowed,false);assert.equal(result.requiredInputContract,'unsupported');assert.ok(result.diagnostics.some(d=>d.code==='PREFLIGHT_CONTRACT_LIMITED'));
});
test('mesh-only does not require solve materials or supports',()=>{
 const p=project();p.conditions=[];p.materialProperties={};p.analysisIntent={mode:'quantitative'};const result=preflightProject(p,{}, {operation:'mesh'});assert.equal(result.allowed,true);assert.deepEqual(result.requiredPointers,[]);assert.equal(result.requiredInputContract,'mesh-only');
});
test('malformed saved conditions and missing solid source return reports rather than throw',()=>{
 const p=project();p.conditions=[null];delete p.sourceModel;
 const report=preflightProject(p);assert.equal(report.allowed,false);assert.ok(report.diagnostics.some(d=>d.code==='PROJECT_INVALID'));assert.ok(report.diagnostics.some(d=>d.code==='SOURCE_MODEL_REQUIRED'));
});

test('mesh-only preparation does not apply solve-only engine and fluid-domain restrictions',()=>{
 const p=project();p.study.kind='fluidDomain';p.conditions=[];
 const report=preflightProject(p,{method:'mfem-wasm'},{operation:'mesh',target:'node'});assert.equal(report.allowed,true);assert.equal(report.requiredInputContract,'mesh-only');
});
