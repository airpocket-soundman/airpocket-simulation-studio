import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initFiniteViscoDamage as init,stepFiniteViscoDamage as step,runFiniteViscoDamageUniaxial as run} from '../src/finite-visco-damage.js';
const flags={synthetic:true,provisional:true,calibrated:false};
const parameters=(Y0=100,Yf=300)=>({bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branches:[{shearModulusPa:3e5,relaxationTimeSeconds:1}],plasticity:{yieldStressPa:3e4,hardeningModulusPa:1e5},damage:{thresholdEnergyDensity:Y0,softeningEnergyDensity:Yf}});
const hydro=a=>[[a,0,0],[0,a,0],[0,0,a]],near=(a,b,rtol=2e-11,atol=1e-12)=>assert.ok(Math.abs(a-b)<=atol+rtol*Math.abs(b),`${a} != ${b}`);

test('independent hydrostatic Hencky oracle resolves tiny damage and attenuated stress near full damage without cancellation',()=>{
 for(const [stretch,Y0,Yf]of [[1.0000005,1e-6,1e12],[1.01,100,(9e6*Math.log(1.01)**2-100)/35],[1.01,100,300]]){
  const p=parameters(Y0,Yf),saved=JSON.stringify(p),F=hydro(stretch),Fbefore=JSON.stringify(F),out=step({state:init({...flags,parameters:p}),F,dtSeconds:1});
  // Direct volumetric Hencky formulas; neither another production constitutive module nor its observations are used as oracle.
  const e=Math.log(stretch),Y=9e6*e*e,x=Math.max(0,(Y-Y0)/Yf),w=Math.exp(-x),d=-Math.expm1(-x),tau=6e6*e,J=stretch**3;
  near(out.observation.damageDriverEnergyDensity,Y);near(out.observation.damage,d,2e-8,0);if(d<1e-16)assert.ok(out.observation.damage>0);
  near(out.observation.storedEnergyDensity,w*Y,2e-10,1e-25);near(out.state.damageDissipationDensity,Y*d/2,2e-8,1e-25);assert.equal(out.state.plasticDissipationDensity,0);assert.ok(out.state.viscousDissipationDensity<1e-20);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){near(out.observation.kirchhoffPa[i][j],i===j?w*tau:0,2e-10,1e-25);near(out.observation.cauchyPa[i][j],i===j?w*tau/J:0,2e-10,1e-25);}assert.equal(JSON.stringify(p),saved);assert.equal(JSON.stringify(F),Fbefore);
 }
});

test('hydrostatic unload/hold/reload uses maximum driver and exact trapezoidal damage bookkeeping, refusing rounded d=1 without modifying issued state',()=>{
 const p=parameters(),path=[1.01,1.005,1.005,1.01,1.02];let s=init({...flags,parameters:p}),r=0,oldY=0,oldD=0,D=0;
 for(const a of path){const Y=9e6*Math.log(a)**2;r=Math.max(r,Y);const d=-Math.expm1(-Math.max(0,(r-100)/300));D+=(oldY+Y)/2*(d-oldD);const o=step({state:s,F:hydro(a),dtSeconds:1});near(o.state.d,d);near(o.state.r,r);near(o.state.damageDissipationDensity,D);near(o.observation.kirchhoffPa[0][0],Math.exp(-Math.max(0,(r-100)/300))*6e6*Math.log(a));s=o.state;oldY=Y;oldD=d;}
 const severe=init({...flags,parameters:parameters(1e-6,1e-6)}),before=JSON.stringify(severe);assert.throws(()=>step({state:severe,F:hydro(1.01),dtSeconds:1}),/representable d<1/);assert.equal(JSON.stringify(severe),before);assert.equal(step({state:severe,F:hydro(1),dtSeconds:1}).state.d,0);
});

test('traction-free uniaxial path matches an independent relaxed elastic Hencky stress/energy oracle with damage',()=>{
 const p=parameters(100,30);p.plasticity.yieldStressPa=1e12;p.branches[0]={shearModulusPa:1,relaxationTimeSeconds:1e-6};const o=run({...flags,parameters:p,segments:[{toAxialGreenStrain:.0202,durationSeconds:8,steps:8}]});let r=0;
 for(const row of o.rows){const e=Math.log(row.axialStretch),nu=2/7,E=18e6/7,Y=E*e*e/2;r=Math.max(r,Y);const x=Math.max(0,(r-100)/30),w=Math.exp(-x),tau=E*e;near(row.lateralStretch,Math.exp(-nu*e),1e-10);near(row.damageDriverEnergyDensity,Y,1e-9);near(row.P11Pa,w*tau/Math.exp(e),1e-9);near(row.sigma11Pa,w*tau/Math.exp((1-2*nu)*e),1e-9);near(row.storedEnergyDensity,w*Y,1e-9);assert.equal(row.equivalentPlasticStrain,0);assert.ok(Math.abs(row.sigma22Pa)<1e-6);}
});

test('only in-process issued states resume: frozen clones, negative bookkeeping, altered flags/parameters and state accessors are refused without execution',()=>{
 const original=init({...flags,parameters:parameters()}),before=JSON.stringify(original);for(const patch of [{},{damageDissipationDensity:-100},{Yf:1e12},{synthetic:false},{provisional:false},{d:.9},{effective:{...original.effective}}])assert.throws(()=>step({state:Object.freeze({...original,...patch}),F:hydro(1.01),dtSeconds:1}),/state from initFiniteViscoDamage/);
 assert.throws(()=>step({state:Object.freeze(structuredClone(original)),F:hydro(1.01),dtSeconds:1}),/state from initFiniteViscoDamage/);let reads=0;const hostile={};Object.defineProperty(hostile,'model',{get(){reads++;throw Error('getter');}});assert.throws(()=>step({state:Object.freeze(hostile),F:hydro(1),dtSeconds:1}),/state from initFiniteViscoDamage/);assert.equal(reads,0);assert.equal(JSON.stringify(original),before);const issued=step({state:original,F:hydro(1.01),dtSeconds:1}).state;assert.ok(step({state:issued,F:hydro(1.005),dtSeconds:1}).state.d>=0);
});

test('damage entry gates reject parameter/array/F hooks, sparse arrays and excess resource budgets before delegating',()=>{
 let calls=0;const bomb=()=>{calls++;throw Error('hook executed');};const p=parameters();for(const key of ['damage','branches','plasticity','bulkModulusPa']){const a={...p};Object.defineProperty(a,key,{enumerable:true,get:bomb});assert.throws(()=>init({...flags,parameters:a}),/data/);}
 for(const key of ['thresholdEnergyDensity','softeningEnergyDensity']){const a=parameters();Object.defineProperty(a.damage,key,{enumerable:true,get:bomb});assert.throws(()=>init({...flags,parameters:a}),/data/);}
 for(const hook of ['map',Symbol.iterator]){const a=parameters();a.branches[hook]=bomb;assert.throws(()=>init({...flags,parameters:a}),/count envelope/);}const sparse=parameters();sparse.branches=new Array(2);assert.throws(()=>init({...flags,parameters:sparse}),/count envelope/);const big=parameters();big.branches=Array(9).fill(p.branches[0]);assert.throws(()=>init({...flags,parameters:big}),/count envelope/);
 const state=init({...flags,parameters:p});for(const F of [new Array(3),[[1,0,0],new Array(3),[0,0,1]]])assert.throws(()=>step({state,F,dtSeconds:1}),/data|count envelope/);const F=hydro(1);Object.defineProperty(F[0],'0',{enumerable:true,get:bomb});assert.throws(()=>step({state,F,dtSeconds:1}),/data/);
 const seg={toAxialGreenStrain:.01,durationSeconds:1,steps:1};for(const input of [Array(65).fill(seg),[{...seg,steps:4097}]])assert.throws(()=>run({...flags,parameters:p,segments:input}),/count envelope|step capacity/);const segments=[seg];segments[Symbol.iterator]=bomb;assert.throws(()=>run({...flags,parameters:p,segments}),/count envelope/);const a=[{...seg}];Object.defineProperty(a[0],'steps',{enumerable:true,get:bomb});assert.throws(()=>run({...flags,parameters:p,segments:a}),/data/);assert.equal(calls,0);
});
