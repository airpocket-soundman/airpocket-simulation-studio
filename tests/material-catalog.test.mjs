import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {catalogEntries,catalogEntry,createCatalogMaterial,validateMaterialCatalog} from '../src/material-catalog.js';
import {reconcileCatalogEdits} from '../src/catalog-provenance.js';
import {validateMaterialProperties,materialReadiness} from '../src/materials.js';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {callStudioTool} from '../scripts/studio-mcp.mjs';
const choice={poissonRatio:.35,isotropicApproximation:true};
function bar(){const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();const face=z=>Array.from({length:12},(_,i)=>i).filter(i=>[2,5,8].every(k=>positions[9*i+k]===z));return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},material:'樹脂',study:{kind:'structural',gravityEnabled:false},conditions:[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}]};}
test('installed primary-source grades preserve known SI references and filler distinctions',async()=>{
 assert.equal(catalogEntries().length,57);assert.equal(catalogEntries({includeExperimental:true}).length,61);
 const pp=catalogEntry('rtp-105-cc'),pe=catalogEntry('rtp-703');assert.equal(pp.properties.tensileModulus.value,5999e6);assert.equal(pe.properties.tensileModulus.value,3448e6);assert.equal(pe.properties.flexuralModulus.value,2551e6);assert.equal(pe.properties.density.value,1080);assert.equal(catalogEntry('rtp-600').properties.density.value,1040);assert.equal(catalogEntry('rtp-600').properties.tensileModulus.method,'ISO 527');
 for(const family of ['PP','PE']){assert.deepEqual(catalogEntries({family,filler:'talc'}).map(m=>m.filler.contentPercent).sort((a,b)=>a-b),[10,20,30,40]);for(const percent of [10,20,30,40])assert.ok(catalogEntries({family,filler:'glassFiber',contentPercent:percent}).length);}
 for(const percent of [10,15,20,30,40])assert.ok(catalogEntries({family:'ABS',filler:'glassFiber',contentPercent:percent}).length);
 assert.ok(catalogEntries({family:'ABS',filler:'talc'}).some(m=>m.manufacturer==='AKAY PLASTIK'));
 const result=await callStudioTool('studio_material_catalog',{family:'PE',filler:'talc',contentPercent:20});assert.equal(result.count,1);assert.equal(result.materials[0].id,'rtp-728');
});
test('catalog material mapping requires declared assumptions and never invents unpublished properties',()=>{
 assert.throws(()=>createCatalogMaterial('rtp-105-cc'),/approximation/);assert.throws(()=>createCatalogMaterial('rtp-105-cc',{isotropicApproximation:true}),/Poisson/);assert.throws(()=>createCatalogMaterial('rtp-105-cc',{...choice,poissonRatio:.5}),/Poisson/);
 const p=createCatalogMaterial('rtp-105-cc',choice);assert.equal(p.poissonRatio,.35);assert.equal(p.catalogSelection.poissonRatioOrigin,'user-assumption');assert.equal(p.youngModulus,5999e6);assert.equal(p.conductivity,undefined);assert.equal(p.specificHeat,undefined);assert.equal(p.temperatureMax,undefined);assert.equal(p.plasticity,undefined);assert.equal(p.fatigueData,undefined);
 const incomplete=createCatalogMaterial('akay-a-20tan01',choice);assert.equal(incomplete.youngModulus,null);assert.deepEqual(materialReadiness('樹脂',incomplete).linearElasticMissing,['youngModulus']);
 assert.throws(()=>createCatalogMaterial('sabic-patent-e10',choice),/Experimental/);const experiment=createCatalogMaterial('sabic-patent-e10',{...choice,allowExperimental:true});assert.equal(experiment.youngModulus,5.7e9);assert.equal(experiment.density,null);assert.equal(experiment.expansion,undefined);
});
test('catalog copies are independent and unit/provenance corruption is refused',()=>{
 const copies=catalogEntries({includeExperimental:true}),version={schemaVersion:1,version:'test',materials:copies};validateMaterialCatalog(version);copies[0].properties.tensileModulus.value=1;assert.notEqual(catalogEntry(copies[0].id).properties.tensileModulus.value,1);assert.throws(()=>validateMaterialCatalog(version),/property/);
 const bad=catalogEntries();bad[0].properties.density.value=1.08;assert.throws(()=>validateMaterialCatalog({schemaVersion:1,version:'test',materials:bad}),/property/);
 const p=createCatalogMaterial('rtp-703',choice);p.catalogSelection.filler.basis='invented';assert.throws(()=>validateMaterialProperties(p),/filler/);
});
test('catalog provenance and explicit numerical edits survive project roundtrips atomically',()=>{
 const api=createStudioApi();api.loadProject(bar());api.setMaterialProperties(createCatalogMaterial('rtp-105-cc',choice));const original=api.exportProject();const changed=structuredClone(original.materialProperties);changed.youngModulus=4e9;assert.throws(()=>api.setMaterialProperties(changed),/overrides/);assert.deepEqual(api.exportProject(),original);
 changed.catalogSelection=reconcileCatalogEdits(changed.catalogSelection,changed);api.setMaterialProperties(changed);assert.equal(api.exportProject().materialProperties.catalogSelection.overrides.youngModulus,4e9);const restored=createStudioApi();restored.loadProject(JSON.parse(JSON.stringify(api.exportProject())));assert.deepEqual(restored.exportProject(),api.exportProject());
 changed.youngModulus=5999e6;changed.catalogSelection=reconcileCatalogEdits(changed.catalogSelection,changed);assert.deepEqual(changed.catalogSelection.overrides,{});validateMaterialProperties(changed);
 const plastic=bar();plastic.materialProperties={youngModulus:1e9,poissonRatio:0,plasticity:{model:'j2-isotropic',yieldStress:1e6,hardeningModulus:1e7}};plastic.study.plasticLoadFractions=[.5,1];api.loadProject(plastic);const before=api.exportProject();assert.throws(()=>api.setMaterialPreset('樹脂',{...changed,poissonRatio:.5}));assert.deepEqual(api.exportProject(),before);api.setMaterialPreset('樹脂',changed);assert.equal(api.exportProject().study.plasticLoadFractions,undefined);assert.equal(api.exportProject().materialProperties.plasticity,undefined);
});
test('real WASM analysis and case archives retain published modulus and assumed Poisson ratio',async()=>{
 const p=bar();p.materialProperties=createCatalogMaterial('rtp-105-cc',{poissonRatio:0,isotropicApproximation:true});const output=await analyzeProject(p,{size:5});const expected=100*.04/(100e-6*5999e6)*1000;assert.ok(Math.abs(output.result.maxDisplacementMm/expected-1)<1e-7);assert.ok(Math.abs(output.result.reaction[2]+100)<1e-5);
 const store=createCaseStore();store.add('PP glass fiber 30%',output);const archive=JSON.parse(JSON.stringify(store.export())),restored=createCaseStore();restored.import(archive);assert.deepEqual(prepareCaseView(restored.list()[0]).input.materialProperties.catalogSelection,p.materialProperties.catalogSelection);
 const corrupt=structuredClone(archive);corrupt.cases[0].output.input.materialProperties.youngModulus*=2;assert.throws(()=>restored.import(corrupt),/overrides/);assert.deepEqual(restored.export(),archive);
});
