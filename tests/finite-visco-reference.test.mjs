import {test} from 'node:test';import assert from 'node:assert/strict';
import {initFiniteViscoReference as init,evaluateFiniteViscoReference as evaluate,stepFiniteViscoReference as step,FINITE_VISCO_REFERENCE_LIMITS as limits} from '../src/finite-visco-reference.js';
const parameters={bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branchShearModulusPa:5e5,relaxationTimeSeconds:2};
const start=(p={})=>init({synthetic:true,provisional:true,calibrated:false,parameters:{...parameters,...p}});
const I=[[1,0,0],[0,1,0],[0,0,1]],zero=()=>Array.from({length:3},()=>[0,0,0]);
const near=(a,b,abs=1e-8,rel=1e-10)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const dot=(a,b)=>a.flat().reduce((s,v,i)=>s+v*b.flat()[i],0);
const times=(a,b)=>a.map(r=>b[0].map((_,j)=>r.reduce((s,v,k)=>s+v*b[k][j],0)));
const T=a=>a[0].map((_,i)=>a.map(r=>r[i]));
const matrixNear=(a,b)=>a.forEach((r,i)=>r.forEach((v,j)=>near(v,b[i][j])));
// Independent square root of this specified pure Green shear C, not production eigen math.
const shearF=e=>{const plus=Math.sqrt(1+2*e),minus=Math.sqrt(1-2*e);return [[(plus+minus)/2,(plus-minus)/2,0],[(plus-minus)/2,(plus+minus)/2,0],[0,0,1]];};
// Independent Simpson quadrature of the analytic ODE solution, no production coefficients.
function integralOracle(E0,E1,Z0,dt,p=parameters){const n=2000,tau=p.relaxationTimeSeconds,mu=p.branchShearModulusPa,dH=E1.map((r,i)=>r.map((v,j)=>v-E0[i][j])),r0=E0.map((r,i)=>r.map((v,j)=>v-Z0[i][j]));let D=0,W=0;for(let k=0;k<=n;k++){const t=dt*k/n,exp=Math.exp(-t/tau),memory=r0.map((r,i)=>r.map((v,j)=>v*exp+tau*dH[i][j]/dt*(-Math.expm1(-t/tau)))),H=E0.map((r,i)=>r.map((v,j)=>v+dH[i][j]*t/dt)),S=H.map((r,i)=>r.map((v,j)=>2*p.equilibriumShearModulusPa*v+2*mu*memory[i][j])),w=k===0||k===n?1:k%2?4:2;D+=w*2*mu/tau*dot(memory,memory);W+=w*dot(S,dH)/dt;}return {D:D*dt/(3*n),W:W*dt/(3*n)};}

test('initial state is stress-free, immutable, explicit synthetic and cannot impersonate a calibrated material',()=>{
 const s=start(),before=JSON.stringify(s),o=evaluate({state:s,F:I});assert.equal(o.energyDensity,0);assert.equal(o.dissipationRateDensity,0);assert.deepEqual(o.S,zero());assert.equal(s.synthetic,true);assert.equal(s.provisional,true);assert.equal(s.calibrated,false);assert.ok(Object.isFrozen(s.Z[0]));assert.throws(()=>{s.Z[0][0]=1;},TypeError);assert.equal(JSON.stringify(s),before);
 for(const input of [{synthetic:false,provisional:true,calibrated:false,parameters},{synthetic:true,provisional:false,calibrated:false,parameters},{synthetic:true,provisional:true,calibrated:true,parameters}])assert.throws(()=>init(input));
});

test('independent ramp, hold, unload and reload quadrature matches work and dissipation without scaling prior solutions',()=>{
 let s=start();for(const [value,dt]of [[.005,1],[.005,2],[0,.5],[-.003,1],[.005,.7],[0,2]]){const old=s,before=JSON.stringify(old),F=shearF(value),next=step({state:old,F,dtSeconds:dt}),oracle=integralOracle(old.E,next.state.E,old.Z,dt);near(next.increment.dissipationDensity,oracle.D,1e-9);near(next.increment.workDensity,oracle.W,1e-9);near(next.increment.energyBalanceErrorDensity,0);assert.equal(JSON.stringify(old),before);assert.ok(next.increment.dissipationDensity>=0);assert.equal(next.state.step,old.step+1);s=next.state;}
 const first=step({state:start(),F:shearF(.005),dtSeconds:1});near(first.observation.S[0][1],13934.693402873665);const held=step({state:first.state,F:shearF(.005),dtSeconds:2});near(held.increment.workDensity,0);near(held.observation.energyDensity-first.observation.energyDensity,-held.increment.dissipationDensity);assert.ok(held.observation.S[0][1]>10000);assert.ok(held.observation.S[0][1]<first.observation.S[0][1]);
});

test('evaluate-only ideal step has exact PK2 relaxation oracle and PK2 is not silently called Cauchy',()=>{
 const o=evaluate({state:start(),F:shearF(.005)});near(o.S[0][1],15000);near(o.energyDensity,75);assert.equal(o.stressMeasure.S,'second-Piola');assert.equal(o.stressMeasure.sigma,'Cauchy');assert.notEqual(o.S[0][1],o.sigma[0][1]);
 // Build a real ramp, then exact hold relative to its actual committed branch memory.
 const a=step({state:start(),F:shearF(.005),dtSeconds:1}),b=step({state:a.state,F:a.state.F,dtSeconds:2});near(b.observation.S[0][1],10000+(a.observation.S[0][1]-10000)*Math.exp(-1));
});

test('superposed time-dependent proper rotations preserve energy, memory and dissipation and rotate both stresses',()=>{
 let a=start(),b=start();for(const [i,e]of [.003,.005,0,-.003,.005].entries()){const angle=(i+1)*Math.PI/2,Q=[[Math.cos(angle),-Math.sin(angle),0],[Math.sin(angle),Math.cos(angle),0],[0,0,1]],F=shearF(e),x=step({state:a,F,dtSeconds:.7}),y=step({state:b,F:times(Q,F),dtSeconds:.7});matrixNear(x.state.Z,y.state.Z);near(x.observation.energyDensity,y.observation.energyDensity);near(x.increment.dissipationDensity,y.increment.dissipationDensity);near(x.increment.workDensity,y.increment.workDensity);matrixNear(y.observation.P,times(Q,x.observation.P));matrixNear(y.observation.sigma,times(times(Q,x.observation.sigma),T(Q)));a=x.state;b=y.state;}
 const spin=step({state:start(),F:[[0,-1,0],[1,0,0],[0,0,1]],dtSeconds:2});near(spin.observation.energyDensity,0);near(spin.increment.dissipationDensity,0);
});

test('same linear-E path subdivision preserves state, energy, exact dissipation and work',()=>{
 const whole=step({state:start(),F:shearF(.005),dtSeconds:2});for(const n of [2,4,8,32]){let s=start();for(let k=1;k<=n;k++)s=step({state:s,F:shearF(.005*k/n),dtSeconds:2/n}).state;matrixNear(s.Z,whole.state.Z);near(s.cumulativeDissipationDensity,whole.state.cumulativeDissipationDensity);near(s.cumulativeWorkDensity,whole.state.cumulativeWorkDensity);}
});

test('small admitted dt/tau and reverse-ramp cancellation have independent positive integral evidence',()=>{
 for(const x of [1e-6,1e-5,.001,.099999,.1,1,10,1e6]){const p={...parameters,relaxationTimeSeconds:2},s=start(),dt=2*x,next=step({state:s,F:shearF(.005),dtSeconds:dt});if(x<=10){const oracle=integralOracle(s.E,next.state.E,s.Z,dt,p);near(next.increment.dissipationDensity,oracle.D,1e-8,1e-9);near(next.increment.workDensity,oracle.W,1e-8,1e-9);}assert.ok(next.increment.dissipationDensity>=0);assert.ok(Number.isFinite(next.increment.workDensity));}
 let s=step({state:start(),F:shearF(.005),dtSeconds:.1}).state;const next=step({state:s,F:shearF(-.005),dtSeconds:.1}),oracle=integralOracle(s.E,next.state.E,s.Z,.1);near(next.increment.dissipationDensity,oracle.D);near(next.increment.workDensity,oracle.W);
});

test('large-time hold relaxes viscous stress without permanent plasticity and stress-free recovery oracle decays',()=>{
 const loaded=step({state:start(),F:shearF(.005),dtSeconds:1}),zeroed=step({state:loaded.state,F:I,dtSeconds:1}),relaxed=step({state:zeroed.state,F:I,dtSeconds:100});assert.ok(Math.abs(zeroed.observation.S[0][1])>0);near(relaxed.observation.S[0][1],0);assert.ok(relaxed.state.cumulativeDissipationDensity>=zeroed.state.cumulativeDissipationDensity);
 // Stress-free reduced scalar limit: numerical sequence converges to z0 exp(-t/3).
 const z0=loaded.state.Z[0][1],target=z0*Math.exp(-1/3),errors=[];for(const n of [20,40,80]){let s=loaded.state;for(let k=0;k<n;k++){const e=parameters.branchShearModulusPa/(parameters.equilibriumShearModulusPa+parameters.branchShearModulusPa)*s.Z[0][1];s=step({state:s,F:shearF(e),dtSeconds:1/n}).state;}errors.push(Math.abs(s.Z[0][1]-target));}assert.ok(errors[2]<errors[1]&&errors[1]<errors[0]);
});

test('strict units/provenance, invalid time/F/parameters, accessor and sparse inputs refuse without mutating state',()=>{
 const s=start(),before=JSON.stringify(s);for(const bad of [JSON.parse(before),{...s,units:{time:'ms'}},{...s,model:'j2'},{...s,parameterRevision:'forged'},Object.create(s),null])assert.throws(()=>step({state:bad,F:I,dtSeconds:1}),/issued/);
 for(const dt of [0,-1,NaN,Infinity,1e-7,2e6+1])assert.throws(()=>step({state:s,F:I,dtSeconds:dt}));for(const F of [[[0,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,1]],[[.949,0,0],[0,1,0],[0,0,1]],[[1.051,0,0],[0,1,0],[0,0,1]],[[NaN,0,0],[0,1,0],[0,0,1]],new Array(3)])assert.throws(()=>evaluate({state:s,F}));let touched=false;const F=I.map(r=>r.slice());Object.defineProperty(F[0],'0',{get(){touched=true;throw Error('must not access');}});assert.throws(()=>evaluate({state:s,F}));assert.equal(touched,false);
 for(const p of [{bulkModulusPa:0},{equilibriumShearModulusPa:Infinity},{branchShearModulusPa:2e6},{relaxationTimeSeconds:0},{extra:1}])assert.throws(()=>start(p));assert.equal(JSON.stringify(s),before);
});

test('principal stretch boundary includes rotated/repeated eigenvalues and rejects beyond its explicit envelope',()=>{
 for(const v of [.95,1.05]){const o=evaluate({state:start(),F:[[0,-v,0],[v,0,0],[0,0,v]]});o.principalStretches.forEach(x=>near(x,v));}for(const v of [.95-1e-10,1.05+1e-10])assert.throws(()=>evaluate({state:start(),F:[[0,-v,0],[v,0,0],[0,0,v]]}),/stretch/);
});

test('step capacity is bounded, no chain retains prior payload, and failure preserves last committed state',()=>{
 let s=start();for(let k=0;k<limits.steps;k++)s=step({state:s,F:I,dtSeconds:1}).state;const before=JSON.stringify(s);assert.equal(s.step,4096);assert.throws(()=>step({state:s,F:I,dtSeconds:1}),/capacity/);assert.equal(JSON.stringify(s),before);assert.ok(Buffer.byteLength(before)<2000);
});

test('reference-basis covariance and general volumetric Green work agree with independent analytical quadratic energy',()=>{
 const R=[[0,0,1],[1,0,0],[0,1,0]],F=[[1.01,.004,0],[0,.99,.002],[0,0,1.005]],a=step({state:start(),F,dtSeconds:.8}),b=step({state:start(),F:times(F,T(R)),dtSeconds:.8});matrixNear(b.state.Z,times(times(R,a.state.Z),T(R)));matrixNear(b.observation.S,times(times(R,a.observation.S),T(R)));matrixNear(b.observation.sigma,a.observation.sigma);near(b.increment.workDensity,a.increment.workDensity);
 const trace=a.state.E[0][0]+a.state.E[1][1]+a.state.E[2][2],H=a.state.E.map((r,i)=>r.map((v,j)=>v-(i===j?trace/3:0))),x=.4,branchWork=2*parameters.branchShearModulusPa*dot(H,H)*(1/x+Math.expm1(-x)/(x*x)),expected=parameters.bulkModulusPa*trace*trace/2+parameters.equilibriumShearModulusPa*dot(H,H)+branchWork;near(a.increment.workDensity,expected);const expectedP=times(F,a.observation.S);matrixNear(a.observation.P,expectedP);
});

test('large admitted ramp has independent exponential primitive and outside time ratios refuse',()=>{
 const e=.005,x=1e6,r=step({state:start(),F:shearF(e),dtSeconds:2*x}),expected=4*parameters.branchShearModulusPa*e*e*(1/x-1.5/(x*x));near(r.increment.dissipationDensity,expected,1e-12);near(r.observation.S[0][1],10000+5000/x,1e-7);for(const dt of [2e-6*(1-1e-8),2e6*(1+1e-8)])assert.throws(()=>step({state:start(),F:I,dtSeconds:dt}),/time/);
});

test('smooth nonlinear Green path converges under independent time refinement',()=>{
 const total=2,finals=[];for(const n of [8,16,32,64]){let s=start();for(let k=1;k<=n;k++)s=step({state:s,F:shearF(.005*Math.sin(Math.PI*k/n)),dtSeconds:total/n}).state;finals.push(s.Z[0][1]);}const d=finals.slice(1).map((v,i)=>Math.abs(v-finals[i]));assert.ok(d[1]<d[0]/3&&d[2]<d[1]/3);
});

test('all nine P components independently equal a Richardson energy gradient',()=>{
 const loaded=step({state:start(),F:shearF(.005),dtSeconds:.7}).state,F=[[1.01,.004,.003],[.002,.99,.001],[0,.003,1.005]],o=evaluate({state:loaded,F});for(let i=0;i<3;i++)for(let j=0;j<3;j++){const derivative=h=>{const a=F.map(r=>r.slice()),b=F.map(r=>r.slice());a[i][j]+=h;b[i][j]-=h;return (evaluate({state:loaded,F:a}).energyDensity-evaluate({state:loaded,F:b}).energyDensity)/(2*h);};const richardson=(4*derivative(5e-5)-derivative(1e-4))/3;near(o.P[i][j],richardson,1e-6,1e-10);}
});

 test('noncoaxial material-reference path transforms Z/S/P covariantly and preserves Cauchy stress',()=>{
 const R=[[0,0,1],[1,0,0],[0,1,0]];let a=start(),b=start();for(const F of [shearF(.004),[[1,.003,0],[0,1,.004],[0,0,1]],[[1,0,.004],[0,.995,0],[.001,0,1.005]],I]){const x=step({state:a,F,dtSeconds:.6}),y=step({state:b,F:times(F,T(R)),dtSeconds:.6});matrixNear(y.state.Z,times(times(R,x.state.Z),T(R)));matrixNear(y.observation.S,times(times(R,x.observation.S),T(R)));matrixNear(y.observation.P,times(x.observation.P,T(R)));matrixNear(y.observation.sigma,x.observation.sigma);near(x.increment.dissipationDensity,y.increment.dissipationDensity);a=x.state;b=y.state;}
 });

 test('public runtime import type fixtures reject unissued states, calibration and wrong time units',async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','','tests/fixtures/finite-visco-reference-types.ts'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30000,maxBuffer:65536});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
 });
