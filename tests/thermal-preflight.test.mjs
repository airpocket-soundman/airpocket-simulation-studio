import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {createStudioApi} from '../src/studio-api.js';
import {preflightProject} from '../src/analysis-preflight.js';
import {getCapabilities} from '../src/capabilities.js';
const valueAt=(p,pointer)=>pointer.slice(1).split('/').reduce((v,key)=>v[key],p);
function fixture(transient=false){
 const api=createStudioApi();api.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,10]}}));api.selectCadFace(0,0);api.addCondition({type:'temperature',value:60});
 api.setMaterialProperties({conductivity:1,...(transient?{density:1000,specificHeat:1000}:{})});api.setStudy({kind:'thermal',transient,volumetricSource:0,...(transient?{timeStep:1,steps:2,initialTemperature:20}:{})});return api.exportProject();
}
function document(p,mode='quantitative',assumption=false){
 p.analysisIntent={mode};const pointers=preflightProject(p).requiredPointers;
 p.inputProvenance={schemaVersion:1,entries:pointers.map(pointer=>({pointer,value:structuredClone(valueAt(p,pointer)),source:{kind:'user-input'},rationale:'Explicit reference fixture inputs',applicability:'Reference-only homogeneous thermal model',status:assumption?'unconfirmed':'confirmed',assumption:assumption?'Reference example values, not measured material data':null}))};return p;
}
test('explicit thermal provenance permits confirmed inputs and flags assumptions without accepting stale values',()=>{
 const p=document(fixture()),before=structuredClone(p),report=preflightProject(p);assert.equal(report.allowed,true);assert.equal(report.requiredInputContract,'thermal-conduction');assert.equal(report.provisional,false);assert.equal(report.completePreflight,false);assert.deepEqual(p,before);
 const exploratory=document(fixture(true),'exploratory',true);assert.equal(preflightProject(exploratory).allowed,true);assert.equal(preflightProject(exploratory).provisional,true);assert.equal(preflightProject(exploratory,{}, {mode:'quantitative'}).allowed,false);
 exploratory.materialProperties.specificHeat=2000;assert.ok(preflightProject(exploratory).diagnostics.some(d=>d.code==='PROVENANCE_STALE'&&d.target==='/materialProperties/specificHeat'));
});
test('physical runtime overrides and thermal units cannot bypass the provenance-bearing study',()=>{
 const p=document(fixture(true));assert.equal(preflightProject(p,{transient:true,timeStep:1,steps:2,initialTemperature:20,volumetricSource:0}).allowed,true);
 for(const options of [{transient:false},{timeStep:2},{steps:3},{initialTemperature:30},{volumetricSource:1}])assert.ok(preflightProject(p,options).diagnostics.some(d=>d.code==='THERMAL_RUNTIME_OVERRIDE'));
 p.units={conductivity:'kW/(m*K)'};assert.ok(preflightProject(p).diagnostics.some(d=>d.code==='INPUT_UNIT_MISMATCH'&&d.target==='/units/conductivity'));assert.equal(p.study.timeStep,1);
});
test('missing values remain missing even with assumptions, and mesh-only does not demand solve evidence',()=>{
 const p=fixture(true);p.analysisIntent={mode:'exploratory'};delete p.study.volumetricSource;const before=structuredClone(p),report=preflightProject(p);assert.equal(report.allowed,false);assert.ok(report.diagnostics.some(d=>d.code==='THERMAL_INPUT_REQUIRED'&&d.target==='/study/volumetricSource'));assert.deepEqual(p,before);
 const mesh=preflightProject(p,{}, {operation:'mesh'});assert.equal(mesh.allowed,true);assert.equal(mesh.requiredInputContract,'mesh-only');assert.deepEqual(mesh.requiredPointers,[]);
});
test('capabilities advertise the explicit thermal contract while legacy reports keep their compatibility path',()=>{
 assert.ok(getCapabilities().preflight.requiredInputContracts.some(c=>c.id==='thermal-conduction'&&c.modes.includes('exploratory')));
 const report=preflightProject(fixture());assert.equal(report.mode,'legacy');assert.equal(report.allowed,true);assert.equal(report.provisional,false);assert.equal(report.requiredInputContract,'unsupported');assert.deepEqual(report.requiredPointers,[]);assert.equal(report.diagnostics.find(d=>d.code==='PREFLIGHT_CONTRACT_LIMITED').severity,'warning');
});
