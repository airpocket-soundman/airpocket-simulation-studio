import {test} from 'node:test';import assert from 'node:assert/strict';
import {printedEquivalentFixture} from './fixtures/printed-equivalent-material.mjs';
import {validatePrintedEquivalentMaterial,requirePrintedEquivalentEvaluation} from '../src/printed-equivalent-material.js';
import {createStudioApi} from '../src/studio-api.js';import {preflightProject} from '../src/analysis-preflight.js';import {resolveElasticMaterial} from '../src/material-dependence.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';import {createCaseStore} from '../src/cases.js';import {getProjectRevision} from '../src/project-revision.js';

test('record preserves explicit process/basis values through real saved-input loading without guessing wall thickness',async()=>{
 const p=printedEquivalentFixture(),before=structuredClone(p),api=createStudioApi();api.loadProject(p);const saved=api.exportProject(),round=JSON.parse(JSON.stringify(saved));api.loadProject(round);
 assert.deepEqual(api.exportProject(),saved);assert.equal(await getProjectRevision(api.exportProject()),await getProjectRevision(saved));assert.deepEqual(p,before);assert.equal(saved.materialProperties.printedEquivalent.print.wallThicknessMm,null);assert.equal(saved.materialProperties.printedEquivalent.basis.kind,'assumed');
 const legacy=structuredClone(p);delete legacy.materialProperties.printedEquivalent;delete legacy.study.materialTemperature;api.loadProject(legacy);assert.equal(api.exportProject().materialProperties.printedEquivalent,undefined);
});
test('normal saved validator and preflight reject units, axes, nonpositive stiffness, bounds and double representation',()=>{
 const modifications=[p=>p.materialProperties.printedEquivalent.units.length='m',p=>delete p.materialProperties.printedEquivalent.units.modulus,p=>p.materialProperties.printedEquivalent.constants.axes[0]=[2,0,0],p=>{p.materialProperties.orthotropic.youngModuliPa[0]=-1;p.materialProperties.printedEquivalent.constants.youngModuliPa[0]=-1;},p=>{p.materialProperties.orthotropic.poissonRatios=[.9,.9,.9];p.materialProperties.printedEquivalent.constants.poissonRatios=[.9,.9,.9];},p=>p.materialProperties.printedEquivalent.print.layerHeightMm=.3,p=>p.materialProperties.printedEquivalent.print.infillFraction=.8,p=>p.study.materialTemperature=30,p=>delete p.study.materialTemperature,p=>p.materialProperties.printedEquivalent.validity.strainRateRangePerSecond=[.01,1],p=>p.materialProperties.printedStructure={model:'explicit-walls-infill'},p=>p.materialProperties.printedEquivalent.print.wallThicknessMm='unknown'];
 for(const modify of modifications){const p=printedEquivalentFixture();modify(p);assert.throws(()=>createStudioApi().loadProject(p));const report=preflightProject(p,{method:'pcg'},{target:'node'});assert.equal(report.allowed,false);assert.ok(report.diagnostics.some(d=>['PRINTED_EQUIVALENT_INVALID','PROJECT_INVALID','MATERIAL_INVALID'].includes(d.code)));}
 const p=printedEquivalentFixture();p.materialProperties.printedStructure={model:'explicit-walls-infill'};delete p.materialProperties.printedEquivalent;assert.throws(()=>createStudioApi().loadProject(p),/not implemented/);
});
test('identification and independent measured validation remain separate declared datasets',()=>{
 const p=printedEquivalentFixture(),m=p.materialProperties,b=m.printedEquivalent.basis;b.kind='identified';b.identification={id:'synthetic-identification',revision:'synthetic-fit-1',specimenIds:['synthetic-specimen-1']};b.independentValidation={id:'synthetic-validation',revision:'synthetic-check-1',specimenIds:['synthetic-specimen-2']};validatePrintedEquivalentMaterial(m);
 b.independentValidation.revision=b.identification.revision;validatePrintedEquivalentMaterial(m); // revision labels are local to distinct dataset IDs
 for(const patch of [{id:'synthetic-identification'},{specimenIds:['synthetic-specimen-1']}]){const changed=structuredClone(m);Object.assign(changed.printedEquivalent.basis.independentValidation,patch);assert.throws(()=>validatePrintedEquivalentMaterial(changed),/separate dataset/);}
 b.kind='assumed';assert.throws(()=>validatePrintedEquivalentMaterial(m),/must not claim measured/);
});
test('direct material resolution refuses out-of-envelope or nonfinite evaluation before solver use',()=>{
 const p=printedEquivalentFixture();for(const t of [14,26,NaN,Infinity,[20,26]]){assert.throws(()=>requirePrintedEquivalentEvaluation(p.materialProperties,t));assert.throws(()=>resolveElasticMaterial(p.materialProperties,t));}
 for(const t of [15,20,25])assert.deepEqual(resolveElasticMaterial(p.materialProperties,t).properties.orthotropic,p.materialProperties.orthotropic);
});
test('actual Worker and saved archive reanalysis retain equivalent constants, axes, record ID and numerical response',async()=>{
 const input=printedEquivalentFixture(),api=createStudioApi();api.loadProject(input);const original=api.exportProject(),output=await analyzeProject(original,{method:'pcg',size:5});
 assert.ok(Math.abs(output.result.maxDisplacementMm-.04/3)<1e-8);assert.ok(Math.abs(output.result.reaction[2]+100)<1e-6);
 const store=createCaseStore();store.add('Synthetic equivalent material (not measured)',output);const archive=JSON.parse(JSON.stringify(store.export()));store.import(archive);const restored=archive.cases[0].output.input;api.loadProject(restored);const next=await analyzeProject(api.exportProject(),{method:'pcg',size:5});
 assert.deepEqual(next.input.materialProperties,original.materialProperties);assert.equal(next.input.materialProperties.printedEquivalent.id,'synthetic-assumption-v1');assert.deepEqual(next.result.displacement,output.result.displacement);assert.deepEqual(original,api.exportProject());
});
