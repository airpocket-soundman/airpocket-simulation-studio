import {test} from 'node:test';import assert from 'node:assert/strict';
import {runFiniteViscoPronyUniaxial as run,FINITE_VISCO_PRONY_LIMITS as limits} from '../src/finite-visco-prony-uniaxial.js';
import {initFiniteViscoReference,stepFiniteViscoReference} from '../src/finite-visco-reference.js';
// Synthetic, uncalibrated fixture reused from the one-branch reference design (not a measured material).
const K=2e6,mu=1e6,flags={synthetic:true,provisional:true,calibrated:false};
const params=branches=>({bulkModulusPa:K,equilibriumShearModulusPa:mu,branches});
const near=(a,b,abs=1e-8,rel=1e-10)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const cycle=steps=>[{toAxialGreenStrain:.03,durationSeconds:1,steps},{toAxialGreenStrain:.03,durationSeconds:2,steps},{toAxialGreenStrain:0,durationSeconds:1,steps},{toAxialGreenStrain:0,durationSeconds:2,steps},{toAxialGreenStrain:.03,durationSeconds:1,steps}];
// Independent closed-form StVK-like uniaxial oracle for a shear modulus G with no memory.
const elastic=(a,G)=>{const e=a*(2*G/3-K)/(2*K+2*G/3);return {e,S11:K*(a+2*e)+4*G*(a-e)/3};};

test('one-branch driver matches the independent one-branch reference step-by-step with traction-free lateral faces',()=>{
 const out=run({...flags,parameters:params([{shearModulusPa:5e5,relaxationTimeSeconds:2}]),segments:cycle(8)});let s=initFiniteViscoReference({...flags,parameters:{bulkModulusPa:K,equilibriumShearModulusPa:mu,branchShearModulusPa:5e5,relaxationTimeSeconds:2}}),t=0;
 for(const r of out.rows){const F=[[r.axialStretch,0,0],[0,r.lateralStretch,0],[0,0,r.lateralStretch]],next=stepFiniteViscoReference({state:s,F,dtSeconds:r.timeSeconds-t});t=r.timeSeconds;s=next.state;near(next.observation.S[0][0],r.S11Pa,1e-6);near(next.observation.S[1][1],0,1e-6);near(next.observation.S[2][2],0,1e-6);near(next.observation.sigma[0][0],r.sigma11Pa,1e-6);near(next.increment.dissipationDensity+0,r.cumulativeDissipationDensity-(out.rows[r.step-2]?.cumulativeDissipationDensity??0),1e-9);}
 near(s.cumulativeDissipationDensity,out.summary.dissipationDensity,1e-9);
});

test('two branches with equal relaxation time reproduce one branch of summed modulus; distinct times differ',()=>{
 const one=run({...flags,parameters:params([{shearModulusPa:6e5,relaxationTimeSeconds:2}]),segments:cycle(6)}),two=run({...flags,parameters:params([{shearModulusPa:2e5,relaxationTimeSeconds:2},{shearModulusPa:4e5,relaxationTimeSeconds:2}]),segments:cycle(6)}),spread=run({...flags,parameters:params([{shearModulusPa:2e5,relaxationTimeSeconds:.2},{shearModulusPa:4e5,relaxationTimeSeconds:20}]),segments:cycle(6)});
 one.rows.forEach((r,i)=>{near(two.rows[i].S11Pa,r.S11Pa,1e-6);near(two.rows[i].cumulativeDissipationDensity,r.cumulativeDissipationDensity,1e-9);});assert.ok(Math.abs(spread.rows[11].S11Pa-one.rows[11].S11Pa)>100);
});

test('load-hold-unload-recover-reload loop: energy balance, nondecreasing dissipation, relaxation and recovery without plastic residual',()=>{
 const out=run({...flags,parameters:params([{shearModulusPa:3e5,relaxationTimeSeconds:.5},{shearModulusPa:4e5,relaxationTimeSeconds:5}]),segments:cycle(20)}),[load,hold,unload,recover,reload]=out.segmentEnds.map(i=>out.rows[i]);
 out.rows.forEach((r,i)=>{near(r.S22Pa,0,1e-6);near(r.energyBalanceErrorDensity,0,1e-9);if(i)assert.ok(r.cumulativeDissipationDensity>=out.rows[i-1].cumulativeDissipationDensity);});
 near(out.summary.workDensity,out.summary.storedEnergyDensity+out.summary.dissipationDensity,1e-8);
 assert.ok(hold.S11Pa<load.S11Pa,'stress relaxes during hold');assert.ok(unload.S11Pa<0,'viscous memory gives compressive stress at E11=0');assert.ok(recover.S11Pa>unload.S11Pa&&recover.S11Pa<0,'stress recovers toward zero');assert.ok(reload.S11Pa>0);assert.ok(out.summary.dissipationDensity>0);assert.equal(out.summary.permanentPlasticStrain,null);
 assert.ok(load.areaRatio<1&&load.lateralStretch<1);near(load.J,load.axialStretch*load.lateralStretch**2,1e-14);near(load.P11Pa,load.axialStretch*load.S11Pa,1e-9);
});

test('glassy and fully relaxed limits match independent closed-form uniaxial oracles',()=>{
 const branches=[{shearModulusPa:3e5,relaxationTimeSeconds:2},{shearModulusPa:2e5,relaxationTimeSeconds:4}],a=.02;
 const fast=run({...flags,parameters:params(branches),segments:[{toAxialGreenStrain:a,durationSeconds:1e-5,steps:1}]});near(fast.rows[0].S11Pa,elastic(a,mu+5e5).S11,1e-2,2e-5);near(fast.rows[0].lateralGreenStrain,elastic(a,mu+5e5).e,1e-8);
 const slow=run({...flags,parameters:params(branches),segments:[{toAxialGreenStrain:a,durationSeconds:1,steps:4},{toAxialGreenStrain:a,durationSeconds:400,steps:40}]}),end=slow.rows.at(-1);near(end.S11Pa,elastic(a,mu).S11,1e-6);near(end.lateralGreenStrain,elastic(a,mu).e,1e-12);
});

test('faster loading gives higher peak nominal stress and time refinement converges',()=>{
 const branches=[{shearModulusPa:5e5,relaxationTimeSeconds:1}],peak=d=>run({...flags,parameters:params(branches),segments:[{toAxialGreenStrain:.03,durationSeconds:d,steps:16}]}).summary.maxP11Pa;assert.ok(peak(.1)>peak(1)&&peak(1)>peak(10));
 const at=n=>run({...flags,parameters:params(branches),segments:cycle(n).map(s=>({...s}))}).rows.at(-1).S11Pa,ref=at(256),e1=Math.abs(at(8)-ref),e2=Math.abs(at(16)-ref),e3=Math.abs(at(32)-ref);assert.ok(e2<e1&&e3<e2,`${e1} ${e2} ${e3}`);assert.ok(e1/e2>1.5);
});

test('refuses uncalibrated impersonation, envelope violations and oversized inputs without mutating input',()=>{
 const ok={...flags,parameters:params([{shearModulusPa:5e5,relaxationTimeSeconds:2}]),segments:cycle(2)},before=JSON.stringify(ok);run(ok);assert.equal(JSON.stringify(ok),before);
 const bad=[{...ok,calibrated:true},{...ok,synthetic:false},{...ok,extra:1},{...ok,parameters:params([])},{...ok,parameters:params(Array.from({length:9},()=>({shearModulusPa:1e4,relaxationTimeSeconds:1})))},{...ok,parameters:params([{shearModulusPa:6e5,relaxationTimeSeconds:1},{shearModulusPa:5e5,relaxationTimeSeconds:2}])},{...ok,parameters:{...params([{shearModulusPa:5e5,relaxationTimeSeconds:2}]),bulkModulusPa:4e6}},{...ok,parameters:params([{shearModulusPa:5e5,relaxationTimeSeconds:0}])},{...ok,segments:[{toAxialGreenStrain:.06,durationSeconds:1,steps:4}]},{...ok,segments:[{toAxialGreenStrain:.01,durationSeconds:1,steps:4097}]},{...ok,segments:[{toAxialGreenStrain:.01,durationSeconds:0,steps:1}]},{...ok,segments:[{toAxialGreenStrain:.01,durationSeconds:1,steps:1.5}]},{...ok,segments:[]}];
 for(const input of bad)assert.throws(()=>run(input),/FINITE_VISCO_PRONY/);assert.equal(limits.branches,8);
 const out=run(ok);assert.ok(Object.isFrozen(out.rows[0]));assert.equal(out.calibrated,false);assert.equal(out.synthetic,true);
});
