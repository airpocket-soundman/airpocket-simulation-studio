import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectUnitMagnitude,YOUNG_MODULUS_PA_RULE} from '../src/preflight-unit-magnitude.js';
import {preflightProject} from '../src/analysis-preflight.js';
import {structuralContractProject,documentStructuralContract} from './fixtures/structural-contract-projects.mjs';

const ortho=(youngModuliPa,extra={})=>({materialProperties:{orthotropic:{youngModuliPa,...extra}}});
const warnings=project=>inspectUnitMagnitude(project).filter(d=>d.code==='UNIT_MAGNITUDE_SUSPECT');

test('orthotropic Young moduli reuse the isotropic Pa rule per component without conversion',()=>{
 const project=ortho([210,210,210]),before=structuredClone(project),found=warnings(project);
 assert.equal(found.length,3);
 found.forEach((warning,index)=>{
  assert.equal(warning.code,'UNIT_MAGNITUDE_SUSPECT');
  assert.equal(warning.severity,'warning');
  assert.equal(warning.target,'/materialProperties/orthotropic/youngModuliPa/'+index);
  assert.equal(warning.evidence.value,210);
  assert.equal(warning.evidence.unit,'Pa');
  assert.deepEqual(warning.evidence.plausibleRange,[1e5,1e13]);
  assert.deepEqual(warning.evidence.plausibleRange,[YOUNG_MODULUS_PA_RULE.min,YOUNG_MODULUS_PA_RULE.max]);
  assert.equal(warning.evidence.hint,YOUNG_MODULUS_PA_RULE.hint);
 });
 // No value is converted to GPa and the input object is not modified.
 assert.deepEqual(project,before);
 assert.deepEqual(project.materialProperties.orthotropic.youngModuliPa,[210,210,210]);
});

test('in-range and boundary directional moduli warn once at most and other arrays stay out of scope',()=>{
 for(const values of [[210e9,200e9,190e9],[1e5,1e13,2e11]])assert.deepEqual(warnings(ortho(values)),[],String(values));
 assert.deepEqual(inspectUnitMagnitude(ortho([1e9,1e9,1e9],{shearModuliPa:[.001,.001,.001],poissonRatios:[.3,.3,.3]})),[]);
 assert.deepEqual(warnings(ortho([0,210,1e11])).map(d=>d.target),['/materialProperties/orthotropic/youngModuliPa/1']);
});

test('absent, null, non-array and non-finite directional moduli keep the existing check behavior',()=>{
 assert.deepEqual(inspectUnitMagnitude({materialProperties:{}}),[]);
 assert.deepEqual(inspectUnitMagnitude({materialProperties:{orthotropic:null}}),[]);
 assert.deepEqual(inspectUnitMagnitude({materialProperties:{orthotropic:{youngModuliPa:210}}}),[]);
 assert.deepEqual(inspectUnitMagnitude(null),[]);
 assert.deepEqual(warnings(ortho([0,NaN,Infinity])),[]);
});

test('a valid orthotropic project keeps allowed/provisional and only gains the warning diagnostics',()=>{
 const build=(youngModuliPa,shearModuliPa,poissonRatios)=>{const p=structuralContractProject('orthotropic');Object.assign(p.materialProperties.orthotropic,{youngModuliPa,shearModuliPa,poissonRatios});return documentStructuralContract(p);};
 const clean=build([1e9,2e9,3e9],[4e8,5e8,6e8],[0,0,0]);
 const warned=build([5000,6000,7000],[2000,2500,3000],[.3,.3,.3]),before=structuredClone(warned);
 const cleanReport=preflightProject(clean),warnedReport=preflightProject(warned);
 assert.equal(warnedReport.allowed,true,JSON.stringify(warnedReport.diagnostics));
 assert.equal(warnedReport.allowed,cleanReport.allowed);
 assert.equal(warnedReport.provisional,cleanReport.provisional);
 assert.equal(cleanReport.diagnostics.some(d=>d.code==='UNIT_MAGNITUDE_SUSPECT'),false);
 assert.deepEqual(warnedReport.diagnostics.filter(d=>d.code==='UNIT_MAGNITUDE_SUSPECT').map(d=>d.target),['/materialProperties/orthotropic/youngModuliPa/0','/materialProperties/orthotropic/youngModuliPa/1','/materialProperties/orthotropic/youngModuliPa/2']);
 assert.deepEqual(warnedReport.diagnostics.filter(d=>d.code!=='UNIT_MAGNITUDE_SUSPECT'),cleanReport.diagnostics);
 // Whole project including meshes, material arrays and provenance is unchanged.
 assert.deepEqual(warned,before);
});
