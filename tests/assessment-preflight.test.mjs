import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {preflightProject} from '../src/analysis-preflight.js';
import {createInputProvenance} from '../src/input-provenance.js';
import {createStudioApi} from '../src/studio-api.js';

const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic reference',testConditions:'Uniform tensile stress',surfaceCondition:'Specified crack surface'};
const fractureOptions={flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack',stressAssumption:'Uniform nominal stress'};
const fatigueData={model:'stress-life',stressRatio:-1,snCurve:[{stressAmplitudePa:2e8,cycles:1e4},{stressAmplitudePa:1e8,cycles:1e6}],ultimateStrengthPa:6e8,yieldStressPa:3e8,source:'Synthetic reference',testConditions:'Fully reversed uniaxial test'};

function project(){
 const value=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}),positions=value.meshes[0].positions;
 const face=z=>Array.from({length:positions.length/9},(_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(positions[i*9+k]-z)<1e-8));
 value.study={kind:'structural',gravityEnabled:false};
 value.materialProperties={youngModulus:1e9,poissonRatio:0};
 value.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}];
 return value;
}
const preflight=(value,options={},runtime={})=>preflightProject(value,options,{target:'node',...runtime});

test('legacy default structural kind points to the actual unsupported modal setting',()=>{
 const value=project();delete value.study.kind;value.study.modalAnalysis=true;
 const report=preflight(value,{fractureAssessment:{}});
 assert.ok(report.diagnostics.some(d=>d.code==='ASSESSMENT_MODEL_UNSUPPORTED'&&d.target==='/study/modalAnalysis'));
 assert.equal(report.diagnostics.some(d=>d.code==='ASSESSMENT_MODEL_UNSUPPORTED'&&d.target==='/study/kind'),false);
});

test('unrequested assessments preserve preflight and mesh-only does not inspect assessment requests',()=>{
 const value=project(),before=preflight(value);
 assert.deepEqual(preflight(value),before);
 const explicitUndefined=preflight(value,{fractureAssessment:undefined});
 assert.equal(explicitUndefined.diagnostics.some(d=>d.code.startsWith('ASSESSMENT_')),false);
 assert.equal(explicitUndefined.requiredPointers.includes('/materialProperties/fractureData'),false);
 const mesh=preflight(value,{fractureAssessment:null,fatigueAssessment:null},{operation:'mesh'});
 assert.equal(mesh.allowed,true);
 assert.equal(mesh.requiredInputContract,'mesh-only');
 assert.equal(mesh.diagnostics.some(d=>d.code.startsWith('ASSESSMENT_')),false);
});

test('assessment requests reject null, wrong-kind, and incomplete option objects',()=>{
 for(const request of [null,[], 'fracture']){
  const report=preflight(project(),{fractureAssessment:request});
  assert.ok(report.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/options/fractureAssessment'));
 }
 const missing=preflight(project(),{fractureAssessment:{}});
 assert.ok(missing.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_REQUIRED'&&d.target==='/materialProperties/fractureData'));
 assert.ok(missing.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/options/fractureAssessment'));
 const noFatigueData=preflight(project(),{fatigueAssessment:{}});
 assert.ok(noFatigueData.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_REQUIRED'&&d.target==='/materialProperties/fatigueData'));
 const nullData=project();nullData.materialProperties.fractureData=null;
 assert.ok(preflight(nullData,{fractureAssessment:fractureOptions}).diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_REQUIRED'&&d.target==='/materialProperties/fractureData'));
});

test('valid fracture and fatigue input contracts pass; invalid registered source data is rejected',()=>{
 const fracture=project();fracture.materialProperties.fractureData=fractureData;
 assert.equal(preflight(fracture,{fractureAssessment:fractureOptions}).allowed,true);
 const missingOptions=preflight(fracture,{fractureAssessment:{...fractureOptions,crackNormal:undefined}});
 assert.ok(missingOptions.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/options/fractureAssessment'));
 const badSource=project();badSource.materialProperties.fractureData={...fractureData,source:''};
 assert.ok(preflight(badSource,{fractureAssessment:fractureOptions}).diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/materialProperties/fractureData'));

 const fatigue=project();fatigue.materialProperties.fatigueData=fatigueData;
 assert.equal(preflight(fatigue,{fatigueAssessment:{}}).allowed,true);
 assert.ok(preflight(fatigue,{fatigueAssessment:{minLoadFactor:2,maxLoadFactor:1}}).diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/options/fatigueAssessment'));
 const badTestConditions=project();badTestConditions.materialProperties.fatigueData={...fatigueData,testConditions:' '};
 assert.ok(preflight(badTestConditions,{fatigueAssessment:{}}).diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/materialProperties/fatigueData'));
});

test('failure assessments reject non-structural, modal, thermal-stress and nonlinear models',()=>{
 for(const mutate of [
  value=>{value.study.kind='thermal';},
  value=>{value.study.modalAnalysis=true;},
  value=>{value.study.thermalStress=true;},
  value=>{value.materialProperties.plasticity={model:'j2-isotropic',yieldStress:1,hardeningModulus:1,testConditions:'test'};},
  value=>{value.materialProperties.hyperelastic={model:'neo-hookean-log',shearModulus:1,bulkModulus:1,testConditions:'test'};},
  value=>{value.materialProperties.orthotropic={};},
 ]){
  const value=project();mutate(value);value.materialProperties.fractureData=fractureData;
  const report=preflight(value,{fractureAssessment:fractureOptions});
  assert.ok(report.diagnostics.some(d=>d.code==='ASSESSMENT_MODEL_UNSUPPORTED'));
 }
});

test('strict mode requires provenance for assessment material data',()=>{
 const value=project();value.analysisIntent={mode:'quantitative'};value.materialProperties.fatigueData=fatigueData;
 const report=preflight(value,{fatigueAssessment:{}});
 assert.ok(report.requiredPointers.includes('/materialProperties/fatigueData'));
 assert.ok(report.diagnostics.some(d=>d.code==='PROVENANCE_REQUIRED'&&d.target==='/materialProperties/fatigueData'));
});

test('studio API forwards assessment settings and leaves source project payload unchanged',()=>{
 const source=project(),api=createStudioApi();
 api.loadProject(source);
 const before=JSON.stringify(api.exportProject());
 const report=api.preflight({fractureAssessment:{}},{target:'node'});
 assert.equal(report.allowed,false);
 assert.ok(report.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_REQUIRED'&&d.target==='/materialProperties/fractureData'));
 assert.ok(report.diagnostics.some(d=>d.code==='ASSESSMENT_INPUT_INVALID'&&d.target==='/options/fractureAssessment'));
 assert.equal(JSON.stringify(api.exportProject()),before);
 assert.equal(JSON.stringify(source),before);
});

test('fracture assessment checks toughness temperature applicability and permits covered temperature tables',()=>{
 const outOfRange=project();outOfRange.materialProperties.fractureData={...fractureData,temperatureRangeC:[21,30]};
 let report=preflight(outOfRange,{fractureAssessment:fractureOptions});
 assert.ok(report.diagnostics.some(d=>d.code==='ASSESSMENT_TEMPERATURE_OUT_OF_RANGE'&&d.target==='/study/materialTemperature'));

 const covered=project();
 covered.analysisIntent={mode:'quantitative'};
 covered.study.materialTemperature=25;
 covered.materialProperties.fractureData={...fractureData,temperatureRangeC:[20,30]};
 covered.materialProperties.dependence={elasticTemperatureTable:[
  {temperature:20,youngModulus:1e9,poissonRatio:0},
  {temperature:30,youngModulus:9e8,poissonRatio:.05},
 ],testConditions:'Synthetic elastic temperature reference'};
 const initial=preflight(covered,{fractureAssessment:fractureOptions});
 covered.inputProvenance=createInputProvenance(initial.requiredPointers.map(pointer=>({
  pointer,
  value:pointer.slice(1).split('/').reduce((value,key)=>value[key],covered),
  source:{kind:'user-input'},
  rationale:'Explicit synthetic reference input',
  status:'confirmed',
  assumption:null,
  applicability:'Synthetic reference only',
 })));
 report=preflight(covered,{fractureAssessment:fractureOptions});
 assert.equal(report.allowed,true,JSON.stringify(report.diagnostics));
 assert.equal(report.diagnostics.some(d=>d.code==='ASSESSMENT_MODEL_UNSUPPORTED'),false);
});
