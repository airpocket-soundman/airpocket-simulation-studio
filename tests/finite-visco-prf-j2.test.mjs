import test from 'node:test';
import assert from 'node:assert/strict';
import {initFiniteViscoPrfJ2 as init,stepFiniteViscoPrfJ2 as step,runFiniteViscoPrfJ2Uniaxial as run} from '../src/finite-visco-prf-j2.js';
import {j2Return} from '../src/plasticity-core.js';
// Synthetic, uncalibrated values: K, mu and branches are the same synthetic set as tests 72/88; sy and H are synthetic.
const K=2e6,mu=1e6,flags={synthetic:true,provisional:true,calibrated:false},two=[{shearModulusPa:3e5,relaxationTimeSeconds:.5},{shearModulusPa:4e5,relaxationTimeSeconds:5}],fast=[{shearModulusPa:3e5,relaxationTimeSeconds:1e-6}];
const params=(branches,sy=3e4,H=1e5)=>({bulkModulusPa:K,equilibriumShearModulusPa:mu,branches,plasticity:{yieldStressPa:sy,hardeningModulusPa:H}});
const near=(a,b,rel,abs=0)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
const mul=(a,b)=>a.map((r,i)=>[0,1,2].map(j=>r[0]*b[0][j]+r[1]*b[1][j]+r[2]*b[2][j])),T=a=>[0,1,2].map(i=>a.map(r=>r[i]));
const rot=t=>{const c=Math.cos(t),s=Math.sin(t),k=[1,2,2].map(v=>v/3),Kx=[[0,-k[2],k[1]],[k[2],0,-k[0]],[-k[1],k[0],0]],K2=mul(Kx,Kx);return [0,1,2].map(i=>[0,1,2].map(j=>(i===j?1:0)+s*Kx[i][j]+(1-c)*K2[i][j]));};
/** Small-strain uniaxial-stress reference driven through the existing j2Return (lateral strain by secant). */
function smallJ2(path,sy,H){const E=9*K*mu/(3*K+mu),nu=(3*K-2*mu)/(2*(3*K+mu)),props={youngModulus:E,poissonRatio:nu,plasticity:{model:'j2-isotropic',yieldStress:sy,hardeningModulus:H}};let st={},lat=0;return path.map(e=>{const at=l=>j2Return([e,l,l,0,0,0],props,st,{tangent:false});let a=-e,b=0,fa=at(a).stress[1],fb=at(b).stress[1];for(let n=0;n<100&&Math.abs(fb)>1e-12&&fb!==fa;n++){const c=b-fb*(b-a)/(fb-fa);a=b;fa=fb;b=c;fb=at(b).stress[1];}lat=b;const r=at(lat);st={plasticStrain:r.plasticStrain,equivalentPlasticStrain:r.equivalentPlasticStrain};return {sigma:r.stress[0],ep:r.plasticStrain[0],kappa:r.equivalentPlasticStrain};});}
const loop=(a,n)=>[{toAxialGreenStrain:a,durationSeconds:1,steps:n},{toAxialGreenStrain:a/4,durationSeconds:1,steps:n},{toAxialGreenStrain:-a/2,durationSeconds:1,steps:n},{toAxialGreenStrain:a,durationSeconds:1,steps:2*n}];

test('small-strain limit with relaxed viscous network matches j2Return (uniaxial stress, reversed loading); 3% shows a finite-strain gap',()=>{
 const cmp=(a,sy,n)=>{const out=run({...flags,parameters:params(fast,sy,1e5),segments:loop(a,n)}),ref=smallJ2(out.rows.map(r=>r.axialGreenStrain),sy,1e5),peak=Math.max(...ref.map(r=>Math.abs(r.sigma)));return {s:Math.max(...out.rows.map((r,i)=>Math.abs(r.sigma11Pa-ref[i].sigma)))/peak,k:Math.abs(out.summary.equivalentPlasticStrain/ref.at(-1).kappa-1),out,ref};};
 const small=cmp(1e-5,10,20);assert.ok(small.out.summary.equivalentPlasticStrain>0,'must yield');assert.ok(small.s<1e-4&&small.k<1e-3,JSON.stringify([small.s,small.k]));
 const big=cmp(.03,3e4,20);assert.ok(big.s>1e-3,'finite-strain gap recorded: '+big.s);
});

test('objectivity under superposed time-varying rotation; pure rotation is stress-free and plastic-free',()=>{
 const path=n=>{const a=1+.04*Math.sin(n/6),l=1/Math.sqrt(a)+.003*Math.cos(n/5);return [[a,.01*Math.sin(n/7),0],[0,l,0],[0,0,1/(a*l)*1.01]];};
 let s=init({...flags,parameters:params(two)}),q=s,yielded=false;for(let n=1;n<=40;n++){const F=path(n),Q=rot(.37*n),a=step({state:s,F,dtSeconds:.1}),b=step({state:q,F:mul(Q,F),dtSeconds:.1}),rotated=mul(mul(Q,a.observation.cauchyPa),T(Q));s=a.state;q=b.state;yielded||=a.increment.plasticIncrement>0;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)near(b.observation.cauchyPa[i][j],rotated[i][j],1e-5,1e-3);near(b.increment.plasticIncrement,a.increment.plasticIncrement,1e-6,1e-12);near(b.observation.storedEnergyDensity,a.observation.storedEnergyDensity,1e-8,1e-8);}
 assert.ok(yielded);near(q.plasticDissipationDensity,s.plasticDissipationDensity,1e-8);
 const r=step({state:init({...flags,parameters:params(two)}),F:rot(1.1),dtSeconds:1});for(const row of r.observation.cauchyPa)for(const v of row)near(v,0,1e-6,1e-6);assert.equal(r.increment.plasticIncrement,0);
});

test('load-hold-unload-reload: residual plastic strain, monotone dissipation, elastic unloading, energy balance',()=>{
 const segs=[{toAxialGreenStrain:.04,durationSeconds:2,steps:200},{toAxialGreenStrain:.04,durationSeconds:10,steps:100},{toAxialGreenStrain:.025,durationSeconds:1,steps:100},{toAxialGreenStrain:.025,durationSeconds:20,steps:100},{toAxialGreenStrain:.045,durationSeconds:1,steps:200}];
 const out=run({...flags,parameters:params(two),segments:segs}),rows=out.rows,[l,h,u,r]=out.segmentEnds;
 rows.forEach((x,i)=>{near(x.sigma22Pa,0,1e-6,1e-6);if(i){assert.ok(x.viscousDissipationDensity>=rows[i-1].viscousDissipationDensity);assert.ok(x.plasticDissipationDensity>=rows[i-1].plasticDissipationDensity);assert.ok(x.equivalentPlasticStrain>=rows[i-1].equivalentPlasticStrain);}});
 assert.ok(rows[l].plasticAxialLogStrain>.005,'plastic residual');assert.ok(rows[h].sigma11Pa<rows[l].sigma11Pa,'relaxation during hold');
 // Lateral contraction keeps evolving while branches relax, so the equilibrium network keeps flowing during the hold.
 assert.ok(rows[h].plasticAxialLogStrain>=rows[l].plasticAxialLogStrain);const ep=rows[h].plasticAxialLogStrain;
 for(let i=h+1;i<=u;i++)assert.equal(rows[i].equivalentPlasticStrain,rows[h].equivalentPlasticStrain,'elastic unloading');
 assert.ok(rows[r].sigma11Pa>rows[u].sigma11Pa,'recovery during hold at reduced strain');near(rows[r].plasticAxialLogStrain,ep,1e-3);
 const reloadStart=rows.findIndex((x,i)=>i>r&&x.equivalentPlasticStrain>rows[r].equivalentPlasticStrain);assert.ok(rows[reloadStart].axialGreenStrain>.035,'elastic reload until near previous flow '+rows[reloadStart].axialGreenStrain);
 // Work done = stored + dissipated (trapezoid in Kirchhoff * d ln stretch; implicit update so O(dt) tolerance).
 let W=0;for(let i=1;i<rows.length;i++)W+=(rows[i].sigma11Pa*rows[i].J+rows[i-1].sigma11Pa*rows[i-1].J)/2*Math.log(rows[i].axialStretch/rows[i-1].axialStretch);
 const last=rows.at(-1);near(W,last.storedEnergyDensity+last.viscousDissipationDensity+last.plasticDissipationDensity,.02);
 // Residual check: hold long at the plastic axial strain with free faces -> zero stress after viscous relaxation.
 const ramp={toAxialGreenStrain:.04,durationSeconds:2,steps:200},ep0=run({...flags,parameters:params(two),segments:[ramp]}).summary.permanentPlasticAxialLogStrain,E=(Math.exp(2*ep0)-1)/2;
 const res=run({...flags,parameters:params(two),segments:[ramp,{toAxialGreenStrain:E,durationSeconds:2,steps:200},{toAxialGreenStrain:E,durationSeconds:200,steps:200}]});
 near(res.summary.permanentPlasticAxialLogStrain,ep0,1e-10);
 assert.ok(Math.abs(res.rows.at(-1).sigma11Pa)<1e-3*rows[l].sigma11Pa,'residual stress '+res.rows.at(-1).sigma11Pa);
});

test('rejects calibrated claims, envelope violations, forged state; inputs unchanged',()=>{
 const p=params(two),snapshot=JSON.stringify(p),segs=[{toAxialGreenStrain:.01,durationSeconds:1,steps:4}];
 assert.throws(()=>run({...flags,calibrated:true,parameters:p,segments:segs}),/flags/);
 assert.throws(()=>run({...flags,parameters:{...p,plasticity:{yieldStressPa:3e4,hardeningModulusPa:0}},segments:segs}),/plasticity envelope/);
 assert.throws(()=>run({...flags,parameters:{...p,extra:1},segments:segs}),/exact data/);
 assert.throws(()=>run({...flags,parameters:p,segments:[{toAxialGreenStrain:.2,durationSeconds:1,steps:4}]}),/envelope/);
 assert.throws(()=>step({state:{...init({...flags,parameters:p})},F:[[1,0,0],[0,1,0],[0,0,1]],dtSeconds:1}),/initFiniteViscoPrfJ2/);
 const out=run({...flags,parameters:p,segments:segs});assert.ok(Object.isFrozen(out.rows[0])&&out.calibrated===false&&out.synthetic===true);assert.equal(JSON.stringify(p),snapshot);
});
