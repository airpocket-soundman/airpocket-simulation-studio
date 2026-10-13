import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFatigueData} from '../src/fatigue-material.js';
import {createStudioApi} from '../src/studio-api.js';
const data=()=>({model:'stress-life',stressRatio:-1,snCurve:[{stressAmplitudePa:200e6,cycles:1e4},{stressAmplitudePa:100e6,cycles:1e6}],ultimateStrengthPa:600e6,yieldStressPa:300e6,testConditions:'Synthetic fully reversed R=-1 stress-amplitude data; tensile-mean Goodman permitted for this reference only',source:'Synthetic verification fixture; not a material grade'});
test('fatigue material accepts optional absence and preserves valid SI curve and provenance',()=>{
 assert.equal(validateFatigueData(undefined),undefined);const p=data(),before=structuredClone(p);validateFatigueData(p);assert.deepEqual(p,before);
});
test('fatigue material rejects unknown fields, invalid strengths, absent provenance and reversed curves atomically',()=>{
 const invalid=[p=>delete p.stressRatio,p=>p.stressRatio=0,p=>p.extra=true,p=>p.snCurve.reverse(),p=>p.snCurve[1].cycles=1e4,p=>p.snCurve[1].stressAmplitudePa=200e6,p=>p.snCurve[0].rangePa=400e6,p=>p.snCurve[0].cycles=NaN,p=>p.snCurve[0].stressAmplitudePa=0,p=>p.snCurve=[p.snCurve[0]],p=>p.snCurve=Array(101).fill(p.snCurve[0]),p=>p.ultimateStrengthPa=p.yieldStressPa,p=>p.yieldStressPa=-1,p=>p.source=' ',p=>delete p.testConditions,p=>p.source='x'.repeat(10001),p=>p.testConditions='x'.repeat(10001)];
 const api=createStudioApi();api.loadProject({version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]});api.setMaterialProperties({youngModulus:200e9,poissonRatio:.3,fatigueData:data()});const saved=api.exportProject();
 for(const corrupt of invalid){const p=data();corrupt(p);const before=structuredClone(p);assert.throws(()=>validateFatigueData(p),/Fatigue|fatigue/);assert.deepEqual(p,before);assert.throws(()=>api.setMaterialProperties({youngModulus:200e9,poissonRatio:.3,fatigueData:p}));assert.deepEqual(api.exportProject(),saved);}
 const restored=createStudioApi();restored.loadProject(JSON.parse(JSON.stringify(saved)));assert.deepEqual(restored.exportProject(),saved);
});
