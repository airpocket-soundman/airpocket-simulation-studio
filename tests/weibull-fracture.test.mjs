import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWeibullFailure,validateWeibullData,principalStresses} from '../src/weibull-fracture.js';
// Synthetic analytical parameters only; they describe no real material.
const data={model:'weibull-2p-volume-pia',weibullModulus:10,characteristicStrengthPa:1e8,referenceVolumeMm3:1000,source:'Synthetic analytical reference only',testConditions:'Synthetic uniform-tension specimens of reference volume',surfaceCondition:'Synthetic; volume flaws only'};
const result=stresses=>({kind:'elastic',stresses});
const close=(a,b,tolerance=1e-12)=>assert.ok(Math.abs(a/b-1)<tolerance,`${a} != ${b}`);
test('uniform uniaxial tension matches the closed-form two-parameter Weibull probability',()=>{
 for(const [stress,volume] of [[1e8,1000],[8e7,250],[1.2e8,4000]]){const f=evaluateWeibullFailure(result([[0,0,stress,0,0,0]]),[volume],data);close(f.failureProbability,1-Math.exp(-(volume/1000)*(stress/1e8)**10));close(f.effectiveVolumeMm3,volume);}
 close(evaluateWeibullFailure(result([[0,0,1e8,0,0,0]]),[1000],data).failureProbability,1-Math.exp(-1));
});
test('splitting a uniform volume into elements leaves the probability unchanged and reproduces the size effect',()=>{
 const one=evaluateWeibullFailure(result([[9e7,0,0,0,0,0]]),[800],data),split=evaluateWeibullFailure(result(Array(8).fill([9e7,0,0,0,0,0])),Array(8).fill(100),data);close(split.failureProbability,one.failureProbability);
 const large=evaluateWeibullFailure(result([[9e7*(800/6400)**(1/10),0,0,0,0,0]]),[6400],data);close(large.failureProbability,one.failureProbability);
});
test('linear stress gradient converges to the analytical effective volume V/(m+1)',()=>{
 const errors=[];for(const n of [50,100,200]){const stresses=Array.from({length:n},(_,i)=>[1e8*(i+.5)/n,0,0,0,0,0]),f=evaluateWeibullFailure(result(stresses),Array(n).fill(1000/n),data),expected=1000/11*((n-.5)/n)**-10;errors.push(Math.abs(f.effectiveVolumeMm3/expected-1));}
 assert.ok(errors[2]<1e-3,`${errors}`);const order=Math.log2(errors[1]/errors[2]);assert.ok(Math.abs(order-2)<.05,`order ${order}`);
});
test('PIA sums tensile principal stresses, ignores compression and is rotation invariant',()=>{
 const uni=evaluateWeibullFailure(result([[1e8,0,0,0,0,0]]),[1000],data);close(evaluateWeibullFailure(result([[1e8,1e8,0,0,0,0]]),[1000],data).riskOfRupture,2*uni.riskOfRupture);close(evaluateWeibullFailure(result([[1e8,-3e8,-1e8,0,0,0]]),[1000],data).riskOfRupture,uni.riskOfRupture);
 assert.equal(evaluateWeibullFailure(result([[-1e8,-1e8,-1e8,0,0,0]]),[1000],data).failureProbability,0);
 // Uniaxial 1e8 Pa along (1,1,0)/sqrt(2) and pure shear 5e7 Pa.
 const rotated=principalStresses([5e7,5e7,0,5e7,0,0]);close(rotated[0],1e8);// Repeated roots lose ~sqrt(eps) relative accuracy in the trigonometric solution.
 assert.ok(Math.abs(rotated[1])<1e-7*1e8&&Math.abs(rotated[2])<1e-7*1e8);close(evaluateWeibullFailure(result([[5e7,5e7,0,5e7,0,0]]),[1000],data).riskOfRupture,uni.riskOfRupture,1e-10);
 const shear=principalStresses([0,0,0,0,0,5e7]);close(shear[0],5e7);close(-shear[2],5e7);
 const general=[3e7,-2e7,1e7,4e6,-6e6,9e6],p=principalStresses(general);close(p.reduce((a,b)=>a+b),3e7-2e7+1e7,1e-12);
});
test('Weibull assessment requires registered provenance and refuses unsupported results',()=>{
 for(const mutate of [d=>d.source='',d=>d.testConditions='',d=>d.surfaceCondition='',d=>d.weibullModulus=0,d=>d.weibullModulus=Infinity,d=>d.characteristicStrengthPa=-1,d=>d.referenceVolumeMm3=0,d=>d.model='weibull-3p',d=>d.thresholdPa=0,d=>delete d.referenceVolumeMm3]){const d=structuredClone(data);mutate(d);assert.throws(()=>validateWeibullData(d));}
 const r=result([[1e8,0,0,0,0,0]]);assert.throws(()=>evaluateWeibullFailure(r,[1000],undefined));assert.throws(()=>evaluateWeibullFailure({...r,plasticity:{}},[1000],data),/linear/);assert.throws(()=>evaluateWeibullFailure({...r,kind:'modal'},[1000],data),/linear/);assert.throws(()=>evaluateWeibullFailure(r,[0],data),/volume/);assert.throws(()=>evaluateWeibullFailure(r,[1,1],data),/volume/);assert.throws(()=>evaluateWeibullFailure(result([[NaN,0,0,0,0,0]]),[1],data),/finite/);
});
