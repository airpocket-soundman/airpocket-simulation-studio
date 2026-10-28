import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initFiniteViscoReference as init,evaluateFiniteViscoReference as evaluate,stepFiniteViscoReference as step} from '../src/finite-visco-reference.js';
const p={bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branchShearModulusPa:5e5,relaxationTimeSeconds:2};
const start=()=>init({synthetic:true,provisional:true,calibrated:false,parameters:p});
const F1=[[1.01,.015,.002],[0,.99,.004],[0,0,1.005]],F2=[[.995,.001,.012],[.003,1.02,0],[0,.002,.99]];
const map=f=>Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>f(i,j))),dot=(a,b)=>a.flat().reduce((s,v,i)=>s+v*b.flat()[i],0),trace=a=>a[0][0]+a[1][1]+a[2][2],dev=a=>map((i,j)=>a[i][j]-(i===j?trace(a)/3:0));
const add=(a,b,c=1)=>map((i,j)=>a[i][j]+c*b[i][j]),mul=(a,b)=>map((i,j)=>a[i].reduce((s,v,k)=>s+v*b[k][j],0)),transpose=a=>map((i,j)=>a[j][i]);
const nodes=[-.9602898564975363,-.7966664774136267,-.5255324099163290,-.1834346424956498,.1834346424956498,.5255324099163290,.7966664774136267,.9602898564975363],weights=[.1012285362903763,.2223810344533745,.3137066458778873,.3626837833783620,.3626837833783620,.3137066458778873,.2223810344533745,.1012285362903763];
const quadrature=(fn,a,b)=>nodes.reduce((s,z,i)=>s+weights[i]*fn((a+b)/2+(b-a)/2*z),0)*(b-a)/2;
const near=(a,b,abs=1e-10,rel=1e-10)=>assert.ok(Math.abs(a-b)<=abs+rel*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('independent noncoaxial Gauss integration, energy gradient and reference basis audit',()=>{
let maximumRelativeDError=0,maximumRelativeWError=0;
for(const x of [1e-6,1e-5,.001,.05,.099999,.1,.100001,1,10,64,100,1e3,1e6]){
 const old=step({state:start(),F:F1,dtSeconds:.2}).state,next=step({state:old,F:F2,dtSeconds:2*x}),dE=add(next.state.E,old.E,-1),dH=dev(dE),r0=add(dev(old.E),old.Z,-1),r=s=>map((i,j)=>r0[i][j]*Math.exp(-s)+dH[i][j]/x*(-Math.expm1(-s)));
 let D=0,Wb=0;const cutoff=Math.min(64,x),segments=Math.max(1,Math.ceil(cutoff));for(let k=0;k<segments;k++){const lo=cutoff*k/segments,hi=cutoff*(k+1)/segments;D+=quadrature(s=>2*p.branchShearModulusPa*dot(r(s),r(s)),lo,hi);Wb+=quadrature(s=>2*p.branchShearModulusPa/x*dot(r(s),dH),lo,hi);}
 if(x>64){D+=2*p.branchShearModulusPa*(x-64)*dot(dH,dH)/x**2;Wb+=2*p.branchShearModulusPa*(x-64)*dot(dH,dH)/x**2;}
 const Weq=quadrature(u=>{const E=add(old.E,dE,u),H=dev(E);return p.bulkModulusPa*trace(E)*trace(dE)+2*p.equilibriumShearModulusPa*dot(H,dH);},0,1),W=Weq+Wb;
 near(next.increment.dissipationDensity,D);near(next.increment.workDensity,W);maximumRelativeDError=Math.max(maximumRelativeDError,Math.abs(next.increment.dissipationDensity-D)/Math.max(1,Math.abs(D)));maximumRelativeWError=Math.max(maximumRelativeWError,Math.abs(next.increment.workDensity-W)/Math.max(1,Math.abs(W)));
}
const state=step({state:start(),F:F1,dtSeconds:1}).state,observation=evaluate({state,F:F2});let maximumGradientErrorPa=0;
for(let i=0;i<3;i++)for(let j=0;j<3;j++){const derivative=h=>{const plus=F2.map(r=>r.slice()),minus=F2.map(r=>r.slice());plus[i][j]+=h;minus[i][j]-=h;return (evaluate({state,F:plus}).energyDensity-evaluate({state,F:minus}).energyDensity)/(2*h);};const numeric=(4*derivative(5e-5)-derivative(1e-4))/3;near(numeric,observation.P[i][j],1e-6,1e-10);maximumGradientErrorPa=Math.max(maximumGradientErrorPa,Math.abs(numeric-observation.P[i][j]));}
const R=[[0,0,1],[1,0,0],[0,1,0]];let a=start(),b=start();for(const F of [F1,F2,F1]){const first=step({state:a,F,dtSeconds:.7}),second=step({state:b,F:mul(F,transpose(R)),dtSeconds:.7});for(const [actual,expected]of [[second.state.Z,mul(mul(R,first.state.Z),transpose(R))],[second.observation.S,mul(mul(R,first.observation.S),transpose(R))],[second.observation.P,mul(first.observation.P,transpose(R))],[second.observation.sigma,first.observation.sigma]])actual.forEach((row,i)=>row.forEach((v,j)=>near(v,expected[i][j],1e-6)));near(first.increment.dissipationDensity,second.increment.dissipationDensity);a=first.state;b=second.state;}
console.log(JSON.stringify({independentGaussTimeRatios:13,noncoaxial:true,maximumRelativeDError,maximumRelativeWError,finiteEnergyGradientComponents:9,maximumGradientErrorPa,rightReferenceBasisPathSteps:3,passed:true},null,2));

});
test('custom array prototypes cannot borrow or freeze caller geometry',()=>{
 class Borrowed extends Array {map(){return this;}}
 for(const F of [new Borrowed([1,0,0],[0,1,0],[0,0,1]),[new Borrowed(1,0,0),[0,1,0],[0,0,1]]]) {
  const before=JSON.stringify(F);
  assert.throws(()=>evaluate({state:start(),F}),/finite 3 by 3 F required/);
  assert.throws(()=>step({state:start(),F,dtSeconds:1}),/finite 3 by 3 F required/);
  assert.equal(JSON.stringify(F),before);assert.equal(Object.isFrozen(F),false);
  assert.equal(Object.isFrozen(F[0]),false);
 }
});
