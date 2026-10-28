import {test} from 'node:test';import assert from 'node:assert/strict';
import {runFiniteViscoHenckyUniaxial as run,initFiniteViscoHencky as init,stepFiniteViscoHencky as step,FINITE_VISCO_HENCKY_LIMITS as limits} from '../src/finite-visco-hencky-multiplicative.js';
import {runFiniteViscoPronyUniaxial as small} from '../src/finite-visco-prony-uniaxial.js';
// Synthetic, uncalibrated fixture reused from work order 72 (not a measured material).
const K=2e6,mu=1e6,flags={synthetic:true,provisional:true,calibrated:false},two=[{shearModulusPa:3e5,relaxationTimeSeconds:.5},{shearModulusPa:4e5,relaxationTimeSeconds:5}];
const params=branches=>({bulkModulusPa:K,equilibriumShearModulusPa:mu,branches});
const near=(a,b,abs=1e-8,rel=1e-10)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const cycle=(a,steps)=>[[a,1],[a,2],[0,1],[0,2],[a,1]].map(([t,d])=>({toAxialGreenStrain:t,durationSeconds:d,steps}));
const mul=(a,b)=>a.map(r=>[0,1,2].map(j=>r[0]*b[0][j]+r[1]*b[1][j]+r[2]*b[2][j])),T=a=>[0,1,2].map(i=>a.map(r=>r[i]));
const rot=(t,axis=[1,2,2].map(v=>v/3))=>{const [x,y,z]=axis,c=Math.cos(t),s=Math.sin(t),C=1-c;return [[c+x*x*C,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,c+y*y*C,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,c+z*z*C]];};
// Independent closed-form Hencky uniaxial oracle for shear modulus G with no memory (log strains are linear).
const hencky=(lambda,G)=>{const e1=Math.log(lambda),e2=-(K-2*G/3)*e1/(2*K+2*G/3),t=e1+2*e2;return {lateral:Math.exp(e2),sigma:((K-2*G/3)*t+2*G*e1)/Math.exp(t)};};

test('small-strain limit converges to the work-order-72 linear-E Prony driver',()=>{
 const err=(a,n)=>{const A=run({...flags,parameters:params(two),segments:cycle(a,n)}),B=small({...flags,parameters:params(two),segments:cycle(a,n)}),peak=Math.max(...B.rows.map(r=>Math.abs(r.S11Pa)));return {s:Math.max(...A.rows.map((r,i)=>Math.abs(r.S11Pa-B.rows[i].S11Pa)))/peak,d:Math.abs(A.summary.dissipationDensity/B.summary.dissipationDensity-1)};};
 const coarse=err(1e-5,20),fine=err(1e-5,200);assert.ok(fine.s<1e-3&&fine.s<coarse.s/5,`${coarse.s} ${fine.s}`);assert.ok(fine.d<3e-3,`${fine.d}`);
 // At 3% strain the two kinematic measures genuinely differ; record, do not hide it.
 assert.ok(err(.03,200).s>.01);
});

test('objectivity: a time-varying superposed rotation rotates Cauchy stress and leaves dissipation unchanged',()=>{
 const path=n=>{const a=1+.03*Math.sin(n/3),g=.02*Math.sin(n/5);return [[a,g,0],[0,1/Math.sqrt(a),.01*Math.cos(n/4)-.01],[0,0,1/Math.sqrt(a)]];};
 let s=init({...flags,parameters:params(two)}),q=s;for(let n=1;n<=40;n++){const F=path(n),Q=rot(.37*n),a=step({state:s,F,dtSeconds:.1}),b=step({state:q,F:mul(Q,F),dtSeconds:.1}),rotated=mul(mul(Q,a.observation.cauchyPa),T(Q));s=a.state;q=b.state;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)near(b.observation.cauchyPa[i][j],rotated[i][j],1e-5);near(b.increment.dissipationDensity,a.increment.dissipationDensity,1e-9,1e-8);near(b.observation.storedEnergyDensity,a.observation.storedEnergyDensity,1e-9,1e-9);}
 assert.ok(s.cumulativeDissipationDensity>0);near(q.cumulativeDissipationDensity,s.cumulativeDissipationDensity,1e-8,1e-8);
 // Pure rigid rotation from a relaxed virgin state produces no stress and no dissipation.
 const r=step({state:init({...flags,parameters:params(two)}),F:rot(1.1),dtSeconds:1});for(const row of r.observation.cauchyPa)for(const v of row)near(v,0,1e-6);near(r.increment.dissipationDensity,0,1e-12);
});

test('uniaxial loop: traction-free lateral faces, nondecreasing dissipation, relaxation and recovery without plastic residual',()=>{
 const out=run({...flags,parameters:params(two),segments:cycle(.03,20)}),[load,hold,unload,recover,reload]=out.segmentEnds.map(i=>out.rows[i]);
 out.rows.forEach((r,i)=>{near(r.sigma22Pa,0,1e-5);if(i)assert.ok(r.cumulativeDissipationDensity>=out.rows[i-1].cumulativeDissipationDensity);});
 assert.ok(hold.sigma11Pa<load.sigma11Pa);assert.ok(unload.sigma11Pa<0);assert.ok(recover.sigma11Pa>unload.sigma11Pa&&recover.sigma11Pa<0);assert.ok(reload.sigma11Pa>0);assert.equal(out.summary.permanentPlasticStrain,null);
 near(load.J,load.axialStretch*load.lateralStretch**2,1e-12);near(load.P11Pa,load.sigma11Pa*load.areaRatio,1e-9);near(load.S11Pa,load.P11Pa/load.axialStretch,1e-9);
});

test('glassy and fully relaxed limits match an independent closed-form Hencky uniaxial oracle',()=>{
 const a=.02,lambda=Math.sqrt(1+2*a);
 const fast=run({...flags,parameters:params(two),segments:[{toAxialGreenStrain:a,durationSeconds:1e-5,steps:1}]}).rows[0],g=hencky(lambda,mu+7e5);near(fast.sigma11Pa,g.sigma,1,2e-5);near(fast.lateralStretch,g.lateral,1e-7);
 const end=run({...flags,parameters:params(two),segments:[{toAxialGreenStrain:a,durationSeconds:1,steps:4},{toAxialGreenStrain:a,durationSeconds:400,steps:40}]}).rows.at(-1),r=hencky(lambda,mu);near(end.sigma11Pa,r.sigma,1e-4);near(end.lateralStretch,r.lateral,1e-12);
});

test('faster loading raises peak nominal stress and time refinement converges',()=>{
 const b=[{shearModulusPa:5e5,relaxationTimeSeconds:1}],peak=d=>run({...flags,parameters:params(b),segments:[{toAxialGreenStrain:.03,durationSeconds:d,steps:16}]}).summary.maxP11Pa;assert.ok(peak(.1)>peak(1)&&peak(1)>peak(10));
 const at=n=>run({...flags,parameters:params(b),segments:cycle(.03,n)}).rows.at(-1).sigma11Pa,ref=at(512),e=[8,16,32].map(n=>Math.abs(at(n)-ref));assert.ok(e[1]<e[0]&&e[2]<e[1],e.join(' '));
});

test('refuses uncalibrated impersonation, envelope violations, foreign states and oversized inputs without mutating input',()=>{
 const ok={...flags,parameters:params([{shearModulusPa:5e5,relaxationTimeSeconds:2}]),segments:cycle(.01,2)},before=JSON.stringify(ok);run(ok);assert.equal(JSON.stringify(ok),before);
 const bad=[{...ok,calibrated:true},{...ok,synthetic:false},{...ok,extra:1},{...ok,parameters:params([])},{...ok,parameters:params(Array.from({length:9},()=>({shearModulusPa:1e4,relaxationTimeSeconds:1})))},{...ok,parameters:params([{shearModulusPa:6e5,relaxationTimeSeconds:1},{shearModulusPa:5e5,relaxationTimeSeconds:2}])},{...ok,parameters:{...params([]),branches:[{shearModulusPa:5e5,relaxationTimeSeconds:2}],bulkModulusPa:4e6}},{...ok,segments:[{toAxialGreenStrain:.06,durationSeconds:1,steps:4}]},{...ok,segments:[{toAxialGreenStrain:.01,durationSeconds:1,steps:4097}]},{...ok,segments:[{toAxialGreenStrain:.01,durationSeconds:0,steps:1}]},{...ok,segments:[]}];
 for(const input of bad)assert.throws(()=>run(input),/FINITE_VISCO_HENCKY/);assert.equal(limits.branches,8);
 const s=init({...flags,parameters:params(two)});assert.throws(()=>step({state:s,F:[[1.06,0,0],[0,1,0],[0,0,1]],dtSeconds:1}),/FINITE_VISCO_HENCKY/);assert.throws(()=>step({state:{...s,model:'x'},F:rot(.1),dtSeconds:1}),/FINITE_VISCO_HENCKY/);assert.throws(()=>step({state:s,F:rot(.1),dtSeconds:0}),/FINITE_VISCO_HENCKY/);assert.throws(()=>init({...flags,calibrated:true,parameters:params(two)}),/FINITE_VISCO_HENCKY/);
 const out=run(ok);assert.ok(Object.isFrozen(out.rows[0]));assert.ok(Object.isFrozen(s.be[0]));assert.equal(out.calibrated,false);
});
