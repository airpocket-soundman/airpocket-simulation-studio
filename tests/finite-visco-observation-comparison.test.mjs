import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareFiniteViscoFinalObservation as compare} from '../src/finite-visco-observation-comparison.js';
const sha=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const model='synthetic-green-lagrange-maxwell-reference-v1',e=.005,x=.5,mu=1e6,m=5e5;
function fixture(){
 const a=Math.sqrt(1+2*e),b=Math.sqrt(1-2*e),F=[[(a+b)/2,(a-b)/2,0],[(a-b)/2,(a+b)/2,0],[0,0,1]];
 // Sorted keys written explicitly, independently of production canonicalJson.
 const history={calibrated:false,kind:'finite-visco-input-history',model,parameters:{branchShearModulusPa:m,bulkModulusPa:2e6,equilibriumShearModulusPa:mu,relaxationTimeSeconds:2},provisional:true,schemaVersion:1,steps:[{F,dtSeconds:1}],synthetic:true,units:{deformationGradient:'dimensionless',time:'s'}};
 const raw=JSON.stringify(history),r=e*(1-Math.exp(-x))/x,S12=2*mu*e+2*m*r;
 const observation={schemaVersion:1,kind:'finite-visco-final-synthetic-observation',model,synthetic:true,provisional:true,calibrated:false,units:{time:'s',stress:'Pa',energyDensity:'J/m3-reference'},historyIdentity:{rawIdentity:sha(raw),canonicalIdentity:sha(raw)},parameterRevision:sha(JSON.stringify(history.parameters)),timeSeconds:1,origin:{kind:'synthetic-reference',description:'Independent exact scalar ramp; not measured data'},values:{S:[[0,S12,0],[S12,0,0],[0,0,0]],energyDensity:2*mu*e*e+2*m*r*r,cumulativeDissipationDensity:4*m*e*e/(x*x)*(x-2*(1-Math.exp(-x))+(1-Math.exp(-2*x))/2)}};
 return {raw,observation,history};
}
test('independent exact ramp stress/energy/dissipation agree without a calibrated or threshold pass result',async()=>{
 const {raw,observation}=fixture(),before=JSON.stringify(observation),r=await compare(raw,before);
 assert.equal(r.completed,true);assert.ok(r.stress.maxAbsoluteDifference<1e-7);assert.ok(r.energy.energyDensity.absoluteDifference<1e-10);assert.ok(r.energy.cumulativeDissipationDensity.absoluteDifference<1e-10);
 assert.equal(r.stress.unit,'Pa');assert.equal(r.energy.unit,'J/m3-reference');assert.equal(r.calibrated,false);assert.equal(r.pass,undefined);assert.equal(r.finalState,undefined);assert.equal(r.observations,undefined);assert.equal(JSON.stringify(observation),before);assert.ok(Object.isFrozen(r.stress.signedDifference[0]));
});
test('known perturbations keep signed stress and independent energy quantities separate',async()=>{
 const {raw,observation:o}=fixture();o.values.S[0][1]+=7;o.values.S[1][0]-=3;o.values.energyDensity+=2;o.values.cumulativeDissipationDensity+=5;
 const r=await compare(raw,JSON.stringify(o));assert.ok(Math.abs(r.stress.signedDifference[0][1]-7)<1e-7);assert.ok(Math.abs(r.stress.signedDifference[1][0]+3)<1e-7);assert.ok(Math.abs(r.stress.maxAbsoluteDifference-7)<1e-7);assert.ok(Math.abs(r.energy.energyDensity.signedDifference-2)<1e-10);assert.ok(Math.abs(r.energy.cumulativeDissipationDensity.signedDifference-5)<1e-10);
});
test('exact identities and time refuse representational, parameter and arbitrarily small timestamp mismatches',async()=>{
 for(const [change,code] of [[o=>o.historyIdentity.rawIdentity=sha('other'),'HISTORY'],[o=>o.historyIdentity.canonicalIdentity=sha('other'),'HISTORY'],[o=>o.parameterRevision=sha('other'),'PARAMETERS'],[o=>o.timeSeconds=1+Number.EPSILON,'TIME']]){const {raw,observation:o}=fixture();change(o);await assert.rejects(compare(raw,JSON.stringify(o)),e=>e.code==='FINITE_VISCO_COMPARISON_'+code+'_MISMATCH');}
 const {raw,observation:o}=fixture();await assert.rejects(compare(raw+' ',JSON.stringify(o)),e=>e.code==='FINITE_VISCO_COMPARISON_HISTORY_MISMATCH');
});
test('unknown fields, false provenance/units, nonfinite JSON, duplicates and deep structures refuse',async()=>{
 const {raw,observation:o}=fixture(),s=JSON.stringify(o);
 for(const patch of [o=>o.calibrated=true,o=>o.synthetic=false,o=>o.units.stress='MPa',o=>o.origin.kind='measured',o=>o.origin.description=' ',o=>o.extra=1,o=>o.values.P=o.values.S,o=>o.schemaVersion=2,o=>o.values.energyDensity=-1]){const v=structuredClone(o);patch(v);await assert.rejects(compare(raw,JSON.stringify(v)));}
 for(const bad of [s.replace('"timeSeconds":1','"timeSeconds":1e999'),s.replace('"timeSeconds":1','"timeSeconds":9007199254740992'),s.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'),'['.repeat(18)+'0'+']'.repeat(18),s+'x','\ufeff'+s])await assert.rejects(compare(raw,bad));
 await assert.rejects(compare(raw,new Uint8Array([0xff])));
});
test('both byte inputs snapshot before awaits and getters/subclasses/shared aliases are rejected safely',async()=>{
 const {raw,observation:o}=fixture(),h=new TextEncoder().encode(raw),v=new TextEncoder().encode(JSON.stringify(o)),h0=h.slice(),v0=v.slice(),pending=compare(h,v);h.fill(32);v.fill(32);const r=await pending;assert.equal(r.completed,true);assert.equal(r.historyIdentity.rawIdentity,sha(h0));assert.equal(r.observationRawIdentity,sha(v0));
 let getters=0;const bytes=new TextEncoder().encode(JSON.stringify(o));Object.defineProperty(bytes,'buffer',{get(){getters++;throw Error('accessor');}});Object.defineProperty(bytes,'byteLength',{get(){getters++;throw Error('accessor');}});assert.equal((await compare(raw,bytes)).completed,true);assert.equal(getters,0);
 class Sub extends Uint8Array{}await assert.rejects(compare(raw,new Sub(v0)));await assert.rejects(compare(raw,o));
 if(typeof SharedArrayBuffer!=='undefined'){const sab=new SharedArrayBuffer(v0.length),view=new Uint8Array(sab);view.set(v0);Object.defineProperty(view,'buffer',{value:new ArrayBuffer(1)});Object.setPrototypeOf(sab,ArrayBuffer.prototype);await assert.rejects(compare(raw,view));}
});
test('one MiB byte boundary succeeds and overflow refuses before parse; failed histories expose only original failure index',async()=>{
 const {raw,observation:o,history}=fixture(),s=JSON.stringify(o),padded=s+' '.repeat(1048576-Buffer.byteLength(s));assert.equal((await compare(raw,padded)).completed,true);await assert.rejects(compare(raw,padded+' '),e=>e.code==='FINITE_VISCO_COMPARISON_BYTE_LIMIT');
 history.steps.push({F:[[1,0,0],[0,1,0],[0,0,1]],dtSeconds:0});const bad=JSON.stringify(history),r=await compare(bad,s);assert.equal(r.completed,false);assert.equal(r.status,'history-rejected');assert.equal(r.failure.stepIndex,1);assert.equal(r.failure.completedSteps,1);assert.equal(r.stress,undefined);assert.equal(r.energy,undefined);assert.equal(r.finalState,undefined);
});
