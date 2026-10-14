import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {evaluateFracture,validateFractureData,validateFractureOptions} from '../src/fracture-core.js';
import {validateMaterialProperties} from '../src/materials.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic analytical reference only',testConditions:'Uniform tensile stress; infinite centre crack, Y=1',surfaceCondition:'Synthetic crack; residual stress is specified separately'};
const properties={youngModulus:1e9,poissonRatio:0,fractureData};
const options={flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack; a is half crack length',stressAssumption:'Uncracked nominal stress is uniform across the assumed flaw'};
const result=s=>({kind:'elastic',stresses:[s],materialEvaluation:{temperatureMin:20,temperatureMax:20,interpolated:false}});
const close=(a,b,tolerance=1e-12)=>assert.ok(Math.abs(a/b-1)<tolerance,`${a} != ${b}`);
test('mode-I crack analytical reference and uncertainty bounds use SI length and toughness',()=>{
 const r=result([0,0,1e6,0,0,0]),f=evaluateFracture(r,properties,options);close(f.intensityRangePaSqrtM[0][0],1e6*Math.sqrt(Math.PI*1e-4));close(f.intensityRangePaSqrtM[0][1],1e6*Math.sqrt(Math.PI*4e-4));close(f.maxUtilizationRange[0],0.5908179503018387);close(f.maxUtilizationRange[1],1.772453850905516);
});
test('critical crack bounds and classifications distinguish compression, threshold and uncertainty',()=>{
 const f=evaluateFracture(result([0,0,1e6,0,0,0]),properties,options);close(f.criticalFlawRangeMm[0][0],1000/Math.PI*(20000/1e6)**2);close(f.criticalFlawRangeMm[0][1],1000/Math.PI*(30000/1e6)**2);assert.deepEqual(f.classification,['uncertain']);
 const compressed=evaluateFracture(result([0,0,-1e6,0,0,0]),properties,options);assert.deepEqual(compressed.intensityRangePaSqrtM,[[0,0]]);assert.deepEqual(compressed.criticalFlawRangeMm,[[null,null]]);assert.deepEqual(compressed.classification,['below-toughness']);
 const high=evaluateFracture(result([0,0,2e6,0,0,0]),properties,options);assert.deepEqual(high.classification,['reaches-toughness']);
 const exact=evaluateFracture(result([0,0,1e6,0,0,0]),{...properties,fractureData:{...fractureData,toughnessRangePaSqrtM:[Math.sqrt(Math.PI*1e-4)*1e6,Math.sqrt(Math.PI*1e-4)*1e6]}},{...options,flawSizeRangeMm:[.1,.1]});assert.deepEqual(exact.maxUtilizationRange,[1,1]);assert.deepEqual(exact.classification,['reaches-toughness']);
});
test('fracture traction is orientation invariant and rejects mixed mode shear',()=>{
 const n=[1/Math.sqrt(2),1/Math.sqrt(2),0],s=[5e5,5e5,0,5e5,0,0],f=evaluateFracture(result(s),properties,{...options,crackNormal:n});close(f.normalStressPa[0],1e6);close(f.maxUtilizationRange[1],evaluateFracture(result([0,0,1e6,0,0,0]),properties,options).maxUtilizationRange[1]);assert.throws(()=>evaluateFracture(result([0,0,1e6,0,1e4,0]),properties,options),/mixed-mode/);
});
test('residual stress and geometry uncertainty broaden bounds without inventing probability',()=>{
 const base=evaluateFracture(result([0,0,1e6,0,0,0]),properties,options),f=evaluateFracture(result([0,0,1e6,0,0,0]),properties,{...options,geometryFactorRange:[1,1.12],residualNormalStressRangePa:[-1e6,1e6]});assert.equal(f.maxUtilizationRange[0],0);close(f.maxUtilizationRange[1],base.maxUtilizationRange[1]*2*1.12);assert.equal(f.criticalFlawRangeMm[0][1],null);assert.equal(f.failureProbability,undefined);
});
test('fracture models require provenance, ordered positive ranges and compatible elastic temperature',()=>{
 for(const mutate of [d=>d.source='',d=>d.surfaceCondition='',d=>d.testConditions='',d=>d.toughnessRangePaSqrtM=[2,1],d=>d.temperatureRangeC=[20,10],d=>d.invented=1]){const d=structuredClone(fractureData);mutate(d);assert.throws(()=>validateFractureData(d));}
 for(const mutate of [o=>o.crackNormal=[0,0,2],o=>o.flawSizeRangeMm=[0,1],o=>o.geometryFactorRange=[1,-1],o=>o.geometrySource='',o=>o.stressAssumption='',o=>o.residualNormalStressRangePa=[NaN,0],o=>o.invented=true]){const o=structuredClone(options);mutate(o);assert.throws(()=>validateFractureOptions(o));}
 const r=result([0,0,1e6,0,0,0]);assert.throws(()=>evaluateFracture(r,{},options),/registered/);assert.throws(()=>evaluateFracture({...r,hyperelastic:{}},properties,options),/linear/);assert.throws(()=>evaluateFracture({...r,materialEvaluation:{temperatureMin:21,temperatureMax:21}},properties,options),/temperature/);assert.throws(()=>validateMaterialProperties({...properties,plasticity:{model:'j2-isotropic',yieldStress:1e6,hardeningModulus:1e7,testConditions:'reference'}}),/linear/);
});
function project(){const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();const face=z=>Array.from({length:12},(_,t)=>t).filter(t=>[2,5,8].every(k=>positions[t*9+k]===z));return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',materialTemperature:20},materialProperties:properties,conditions:[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}]};}
test('real WASM fracture reference, archives and independently tampered fields are checked atomically',async()=>{
 const output=await analyzeProject(project(),{size:5,fractureAssessment:options});close(output.result.maxDisplacementMm,.04,2e-8);close(output.result.fracture.maxUtilizationRange[1],1e6*Math.sqrt(Math.PI*4e-4)/20000,2e-8);
 const store=createCaseStore();store.add('Fracture reference',output);const archive=JSON.parse(JSON.stringify(store.export())),restored=createCaseStore();restored.import(archive);assert.deepEqual(prepareCaseView(restored.list()[0]).result.fracture,output.result.fracture);
 for(const mutate of [c=>c.output.result.fracture.maxUtilizationRange[1]*=2,c=>c.output.result.fracture.classification[0]='below-toughness',c=>c.output.result.stresses[0][2]*=2,c=>c.output.result.fracture.fractureData.surfaceCondition='Different',c=>c.output.calculation.options.fractureAssessment.flawSizeRangeMm[0]=.2,c=>c.output.result.fracture.criticalFlawRangeMm[0][0]=0,c=>delete c.output.result.fracture]){const bad=structuredClone(archive);mutate(bad.cases[0]);assert.throws(()=>restored.import(bad));assert.deepEqual(restored.export(),archive);assert.throws(()=>prepareCaseView(bad.cases[0]));}
});
