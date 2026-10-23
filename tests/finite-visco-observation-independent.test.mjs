import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {compareFiniteViscoFinalObservation as compare} from '../src/finite-visco-observation-comparison.js';
const sha=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
// Independent JSON sort, not production canonical/model/replay helpers.
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
function fixture(pretty=false){
 const e=.002,K=3e6,s=Math.sqrt(1+2*e),parameters={bulkModulusPa:K,equilibriumShearModulusPa:1e6,branchShearModulusPa:4e5,relaxationTimeSeconds:2};
 const F=[[s,0,0],[0,s,0],[0,0,s]],history={schemaVersion:1,kind:'finite-visco-input-history',model:'synthetic-green-lagrange-maxwell-reference-v1',synthetic:true,provisional:true,calibrated:false,units:{time:'s',deformationGradient:'dimensionless'},parameters,steps:[{dtSeconds:.5,F},{dtSeconds:1.5,F}]};
 const raw=JSON.stringify(history,null,pretty?2:0);
 // E=eI, dev(E)=0: Maxwell branch remains zero for any ramp/hold.
 // S=K tr(E) I; W=K tr(E)^2/2; cumulative dissipation=0.
 const S=3*K*e,W=K*(3*e)**2/2;
 const observed={schemaVersion:1,kind:'finite-visco-final-synthetic-observation',model:history.model,synthetic:true,provisional:true,calibrated:false,units:{time:'s',stress:'Pa',energyDensity:'J/m3-reference'},historyIdentity:{rawIdentity:sha(raw),canonicalIdentity:sha(JSON.stringify(sorted(history)))},parameterRevision:sha(JSON.stringify(sorted(parameters))),timeSeconds:2,origin:{kind:'synthetic-reference',description:'Independent hydrostatic Green strain closed form; no measured data'},values:{S:[[S,0,0],[0,S,0],[0,0,S]],energyDensity:W,cumulativeDissipationDensity:0}};
 return {raw,observed};
}

test('independent hydrostatic two-step oracle has bulk energy/stress and exactly no deviatoric dissipation',async()=>{
 for(const pretty of [false,true]){const {raw,observed}=fixture(pretty),r=await compare(raw,JSON.stringify(observed));assert.equal(r.completed,true);assert.ok(r.stress.maxAbsoluteDifference<2e-8);assert.ok(r.energy.energyDensity.absoluteDifference<2e-10);assert.equal(r.energy.cumulativeDissipationDensity.signedDifference,0);assert.equal(r.calibrated,false);assert.equal(r.pass,undefined);assert.equal(r.finalState,undefined);}
 const compact=fixture(),pretty=fixture(true);assert.notEqual(compact.observed.historyIdentity.rawIdentity,pretty.observed.historyIdentity.rawIdentity);assert.equal(compact.observed.historyIdentity.canonicalIdentity,pretty.observed.historyIdentity.canonicalIdentity);await assert.rejects(compare(pretty.raw,JSON.stringify(compact.observed)),{code:'FINITE_VISCO_COMPARISON_HISTORY_MISMATCH'});
});

test('hydrostatic oracle exposes independent asymmetric component and separate energy errors without fitting',async()=>{
 const {raw,observed:o}=fixture();o.values.S[0][1]=-11;o.values.S[2][0]=7;o.values.energyDensity-=3;o.values.cumulativeDissipationDensity=5;
 const r=await compare(raw,JSON.stringify(o));assert.equal(r.stress.signedDifference[0][1],-11);assert.equal(r.stress.signedDifference[2][0],7);assert.equal(r.stress.maxAbsoluteDifference,11);assert.ok(Math.abs(r.energy.energyDensity.signedDifference+3)<2e-10);assert.equal(r.energy.cumulativeDissipationDensity.signedDifference,5);assert.equal(r.energy.cumulativeDissipationDensity.absoluteDifference,5);assert.match(r.meaning,/no tolerance, fit, calibration/);
});

test('two offset views into one caller buffer are owned before await; intrinsic history getters never execute',async()=>{
 const {raw,observed}=fixture(),h=new TextEncoder().encode(raw),o=new TextEncoder().encode(JSON.stringify(observed)),backing=new Uint8Array(h.length+o.length+37).fill(255),history=backing.subarray(11,11+h.length),observation=backing.subarray(24+h.length,24+h.length+o.length);history.set(h);observation.set(o);
 let calls=0;for(const key of ['buffer','byteLength'])Object.defineProperty(history,key,{get(){calls++;throw Error('unexpected caller getter');}});
 const pending=compare(history,observation);backing.fill(0);const r=await pending;assert.equal(r.completed,true);assert.equal(calls,0);assert.equal(r.historyIdentity.rawIdentity,sha(h));assert.equal(r.observationRawIdentity,sha(o));assert.equal(r.timeSeconds,2);
});
