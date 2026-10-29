import test from 'node:test';
import assert from 'node:assert/strict';
import {initFiniteViscoDamage as init,stepFiniteViscoDamage as step,runFiniteViscoDamageUniaxial as run} from '../src/finite-visco-damage.js';
import {runFiniteViscoPrfJ2Uniaxial as runJ2} from '../src/finite-visco-prf-j2.js';
// Synthetic, uncalibrated values: K, mu, branches, sy, H are the synthetic set of tests 72/88/95; Y0 and Yf are synthetic.
const flags={synthetic:true,provisional:true,calibrated:false},two=[{shearModulusPa:3e5,relaxationTimeSeconds:.5},{shearModulusPa:4e5,relaxationTimeSeconds:5}];
const base=branches=>({bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branches,plasticity:{yieldStressPa:3e4,hardeningModulusPa:1e5}});
const params=(branches=two,Y0=100,Yf=300)=>({...base(branches),damage:{thresholdEnergyDensity:Y0,softeningEnergyDensity:Yf}});
const near=(a,b,rel,abs=0)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
const mul=(a,b)=>a.map((r,i)=>[0,1,2].map(j=>r[0]*b[0][j]+r[1]*b[1][j]+r[2]*b[2][j])),T=a=>[0,1,2].map(i=>a.map(r=>r[i]));
const rot=t=>{const c=Math.cos(t),s=Math.sin(t);return [[c,-s,0],[s,c,0],[0,0,1]];};
const work=rows=>{let W=0;for(let i=1;i<rows.length;i++)W+=(rows[i].sigma11Pa*rows[i].J+rows[i-1].sigma11Pa*rows[i-1].J)/2*Math.log(rows[i].axialStretch/rows[i-1].axialStretch);return W;};
const ramp=[{toAxialGreenStrain:.045,durationSeconds:2,steps:300}];

test('monotonic tension: undamaged below threshold, load peak then drop, d monotone in [0,1), energy balance',()=>{
 const out=run({...flags,parameters:params(),segments:ramp}),ref=runJ2({...flags,parameters:base(two),segments:ramp}),rows=out.rows;
 rows.forEach((x,i)=>{assert.ok(x.damage>=0&&x.damage<1);if(i)assert.ok(x.damage>=rows[i-1].damage);near(x.sigma22Pa,0,1e-6,1e-6);
  if(x.damageDriverEnergyDensity<=100&&x.damage===0)assert.equal(x.sigma11Pa,ref.rows[i].sigma11Pa);near(x.sigma11Pa,(1-x.damage)*ref.rows[i].sigma11Pa,1e-12);});
 const peak=out.summary.peakP11Pa,last=rows.at(-1);assert.ok(rows[0].damage===0&&last.damage>.9);assert.ok(last.P11Pa<.2*peak,'load drop '+last.P11Pa/peak);assert.ok(ref.rows.at(-1).P11Pa>peak,'effective path keeps hardening');
 near(work(rows),last.storedEnergyDensity+last.viscousDissipationDensity+last.plasticDissipationDensity+last.damageDissipationDensity,.02);assert.ok(last.damageDissipationDensity>0);
});

test('unloading stiffness drops by (1-d), damage frozen while unloading and on reload below the previous driver',()=>{
 const fast=[{shearModulusPa:3e5,relaxationTimeSeconds:1e-6}],segs=[{toAxialGreenStrain:.012,durationSeconds:1,steps:120},{toAxialGreenStrain:.006,durationSeconds:1,steps:60},{toAxialGreenStrain:.012,durationSeconds:1,steps:60},{toAxialGreenStrain:.02,durationSeconds:1,steps:80}];
 const out=run({...flags,parameters:params(fast),segments:segs}),ref=runJ2({...flags,parameters:base(fast),segments:segs}),[l,u,r]=out.segmentEnds,rows=out.rows,d=rows[l].damage;assert.ok(d>.1&&d<.9,'partial damage '+d);
 for(let i=l+1;i<r;i++)assert.equal(rows[i].damage,d,'no damage growth before exceeding history');near(rows[r].damage,d,1e-12);
 const slope=(R,a,b)=>(R[a].P11Pa-R[b].P11Pa)/(R[a].axialGreenStrain-R[b].axialGreenStrain),k=slope(rows,l+1,u),k0=slope(ref.rows,l+1,u);near(k/k0,1-d,1e-9);
 assert.ok(rows.at(-1).damage>d,'damage resumes after the previous driver is exceeded');
});

test('general-F stepping: objective damage under superposed rotation; pure rotation leaves d = 0',()=>{
 let s=init({...flags,parameters:params()}),q=s;for(let n=1;n<=30;n++){const a=1+.0015*n,F=[[a,0,0],[0,1/Math.sqrt(a),0],[0,0,1/Math.sqrt(a)]],Q=rot(.2*n),x=step({state:s,F,dtSeconds:.05}),y=step({state:q,F:mul(Q,F),dtSeconds:.05}),R=mul(mul(Q,x.observation.cauchyPa),T(Q));s=x.state;q=y.state;
  near(y.observation.damage,x.observation.damage,1e-9,1e-12);for(let i=0;i<3;i++)for(let j=0;j<3;j++)near(y.observation.cauchyPa[i][j],R[i][j],1e-5,1e-3);}
 assert.ok(s.d>0);const z=step({state:init({...flags,parameters:params()}),F:rot(1.1),dtSeconds:1});assert.equal(z.observation.damage,0);
});

test('rejects unsupported combinations, calibrated claims, envelope violations, forged state; inputs unchanged',()=>{
 const p=params(),snapshot=JSON.stringify(p),segs=[{toAxialGreenStrain:.01,durationSeconds:1,steps:4}];
 for(const k of ['characteristicLengthM','fractureEnergyJPerM2','tensionCompressionSplit','elementDeletion'])assert.throws(()=>run({...flags,parameters:{...p,damage:{...p.damage,[k]:1}},segments:segs}),/unsupported combination/);
 assert.throws(()=>run({...flags,parameters:{...p,regularization:'crack-band'},segments:segs}),/unsupported combination/);
 assert.throws(()=>run({...flags,calibrated:true,parameters:p,segments:segs}),/flags/);
 assert.throws(()=>run({...flags,parameters:base(two),segments:segs}),/damage block/);
 assert.throws(()=>run({...flags,parameters:params(two,100,0),segments:segs}),/damage envelope/);
 assert.throws(()=>run({...flags,parameters:{...p,damage:{...p.damage,extra:1}},segments:segs}),/exact data/);
 assert.throws(()=>run({...flags,parameters:p,segments:[{toAxialGreenStrain:.2,durationSeconds:1,steps:4}]}),/envelope/);
 assert.throws(()=>step({state:{...init({...flags,parameters:p})},F:[[1,0,0],[0,1,0],[0,0,1]],dtSeconds:1}),/initFiniteViscoDamage/);
 const out=run({...flags,parameters:p,segments:segs});assert.ok(Object.isFrozen(out.rows[0])&&out.calibrated===false&&out.regularization.startsWith('none'));assert.equal(JSON.stringify(p),snapshot);
});
