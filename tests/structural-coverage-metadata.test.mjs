import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preflightProject} from '../src/analysis-preflight.js';
import {createInputProvenance} from '../src/input-provenance.js';
import {physicsCoverage} from '../src/preflight-physics-coverage.js';
import {structuralContractProject,documentStructuralContract} from './fixtures/structural-contract-projects.mjs';
import {advancedStructuralProject,documentAdvancedStructural,contractByKind} from './fixtures/advanced-structural-projects.mjs';

function isotropic(mode){
 const p=structuralContractProject();delete p.study.modalAnalysis;delete p.study.modeCount;delete p.study.modalIterations;
 if(mode!=='legacy'){
  p.analysisIntent={mode};
  p.inputProvenance=createInputProvenance(preflightProject(p).requiredPointers.map(pointer=>({pointer,value:pointer.slice(1).split('/').reduce((v,k)=>v[k],p),source:{kind:'user-input'},rationale:'Synthetic explicit reference',applicability:'Static linear structure',status:mode==='exploratory'?'unconfirmed':'confirmed',assumption:mode==='exploratory'?'Synthetic preliminary assumption':null})));
 }
 return p;
}

for(const mode of ['legacy','quantitative','exploratory'])test('isotropic '+mode+' exposes matching contract and honest staged coverage without changing execution',()=>{
 const p=isotropic(mode),before=structuredClone(p),r=preflightProject(p);
 assert.equal(r.requiredInputContract,'static-isotropic-linear-structure');assert.equal(r.physicsCoverage.contract,r.requiredInputContract);
 assert.equal(r.allowed,true);assert.equal(r.provisional,mode==='exploratory');assert.equal(r.completePreflight,false);assert.deepEqual(p,before);
 assert.equal(r.diagnostics.filter(d=>d.severity==='error').length,0);
 assert.match(r.physicsCoverage.implemented.join(' '),/legacy does not require provenance/);
 assert.match(r.physicsCoverage.postMeshImplemented.join(' '),/Finite Tet4/);assert.match(r.physicsCoverage.postMeshImplemented.join(' '),/rank.*diagnostic only/);
 assert.match(r.physicsCoverage.remaining.join(' '),/convergence.*mesh dependence.*physical accuracy/);assert.match(r.physicsCoverage.remaining.join(' '),/orthotropic/);
 const missing=structuredClone(p);missing.conditions=[];
 const blocked=preflightProject(missing);assert.equal(blocked.allowed,false);assert.ok(blocked.diagnostics.some(d=>d.code==='STRUCTURAL_SUPPORT_MISSING'&&d.severity==='error'));
});

test('mesh-only retains null coverage rather than implying solve checks were performed',()=>{
 const r=preflightProject(isotropic('legacy'),{}, {operation:'mesh'});
 assert.equal(r.requiredInputContract,'mesh-only');assert.equal(r.physicsCoverage.contract,null);assert.deepEqual(r.physicsCoverage.implemented,[]);assert.equal(r.allowed,true);
});

test('advanced contracts retain exact identity but do not borrow static-isotropic coverage',()=>{
 const fixtures=[...['modal','orthotropic'].map(kind=>documentStructuralContract(structuralContractProject(kind))),...Object.keys(contractByKind).map(kind=>documentAdvancedStructural(advancedStructuralProject(kind)))];
 for(const p of fixtures){const r=preflightProject(p);assert.equal(r.allowed,true,JSON.stringify(r.diagnostics));assert.equal(r.physicsCoverage.contract,r.requiredInputContract);assert.notEqual(r.physicsCoverage.contract,'static-isotropic-linear-structure');assert.deepEqual(r.physicsCoverage.implemented,[]);assert.equal(r.physicsCoverage.completePreflight,false);assert.match(r.physicsCoverage.remaining.join(' '),/physical accuracy/);}
 const legacy=preflightProject(structuralContractProject('orthotropic'));assert.equal(legacy.requiredInputContract,'unsupported');assert.equal(legacy.physicsCoverage.contract,'unsupported');assert.deepEqual(legacy.physicsCoverage.implemented,[]);assert.equal(legacy.allowed,true);assert.ok(legacy.diagnostics.some(d=>d.code==='PREFLIGHT_CONTRACT_LIMITED'&&d.severity==='warning'));
});

test('unsupported quantitative study is still rejected and existing thermal anchors remain separately advertised',()=>{
 const p=isotropic('legacy');p.study.kind='fluidDomain';p.analysisIntent={mode:'quantitative'};
 const r=preflightProject(p);assert.equal(r.requiredInputContract,'unsupported');assert.equal(r.physicsCoverage.contract,'unsupported');assert.equal(r.allowed,false);assert.ok(r.diagnostics.some(d=>d.code==='PREFLIGHT_CONTRACT_LIMITED'&&d.severity==='error'));
 const thermal=physicsCoverage('thermal-conduction');assert.match(thermal.postMeshImplemented.join(' '),/Connected-component anchoring.*thermal contact/);assert.equal(thermal.completePreflight,false);
 const first=physicsCoverage('static-isotropic-linear-structure');first.implemented.length=0;assert.ok(physicsCoverage('static-isotropic-linear-structure').implemented.length>0);
});
