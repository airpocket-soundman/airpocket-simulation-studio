import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {structuralAdapter} from '../src/solver-adapters/structural-adapter.js';
import {validateAssessmentDiscipline} from '../src/solver-adapters/validation.js';

const fractureAssessment={flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack; a is half crack length',stressAssumption:'Uncracked nominal stress is uniform across the assumed flaw'};
const fatigueAssessment={minLoadFactor:-1,maxLoadFactor:1,meanStressCorrection:'none',appliedCycles:1e5};
const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic analytical reference only',testConditions:'Uniform tensile stress; infinite centre crack, Y=1',surfaceCondition:'Synthetic crack; residual stress is specified separately'};
const fatigueData={model:'stress-life',stressRatio:-1,snCurve:[{stressAmplitudePa:1e7,cycles:1e4},{stressAmplitudePa:1e6,cycles:1e6},{stressAmplitudePa:1e5,cycles:1e8}],ultimateStrengthPa:4e8,yieldStressPa:2.5e8,source:'Synthetic reference only',testConditions:'Synthetic fully reversed axial reference; not a real material'};
function project(){
 const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
 const face=z=>Array.from({length:12},(_,t)=>t).filter(t=>[2,5,8].every(k=>positions[t*9+k]===z));
 return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',materialTemperature:20},materialProperties:{youngModulus:1e9,poissonRatio:0,fractureData,fatigueData},conditions:[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}]};
}
test('structural postprocess assesses a generated linear result with both evaluations and preserves no-request results',async()=>{
 const input=project(),output=await analyzeProject(input,{size:5}),result=structuredClone(output.result),before=structuredClone(result);
 structuralAdapter.postprocess({data:{operation:'elastic',project:input,options:{}},result});
 assert.deepEqual(result,before);
 structuralAdapter.postprocess({data:{operation:'elastic',project:input,options:{fractureAssessment,fatigueAssessment}},result});
 assert.ok(result.fracture.maxUtilizationRange[1]>0);
 assert.ok(result.fatigue.minLifeCycles>0);
});

test('structural assessments reject thermal, modal and nonlinear results, while non-structural requests stay rejected',()=>{
 const input=project(),result={kind:'elastic',stresses:[[0,0,1e6,0,0,0]],materialEvaluation:{temperatureMin:20,temperatureMax:20,interpolated:false}};
 for(const study of [{kind:'structural',thermalStress:true},{kind:'structural',modalAnalysis:true}])assert.throws(()=>structuralAdapter.postprocess({data:{operation:'elastic',project:{...input,study},options:{fractureAssessment}},result:{...result}}),/Fracture assessment requires linear structural analysis/);
 for(const nonlinear of [{plasticity:{}},{hyperelastic:{}}])assert.throws(()=>structuralAdapter.postprocess({data:{operation:'elastic',project:input,options:{fatigueAssessment}},result:{...result,...nonlinear}}),/linear elastic/);
 for(const [kind,options,message] of [['thermal',{fractureAssessment},'Fracture assessment requires linear structural analysis'],['modal',{fatigueAssessment},'Fatigue assessment requires uniaxial elastic structure without thermal stress']])assert.throws(()=>validateAssessmentDiscipline({operation:'elastic',project:{study:{kind}},options}),e=>e.message===message&&e.analysisDiagnostic?.stage==='postprocess');
 validateAssessmentDiscipline({operation:'mesh',project:{study:{kind:'thermal'}},options:{fractureAssessment}});
});
