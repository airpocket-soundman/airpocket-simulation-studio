import test from 'node:test';
import assert from 'node:assert/strict';
import {channelShearFluid,runShearPlateCoupled,shearPlateMonolithicReference,SHEAR_PLATE_LIMITS} from '../src/fsi-channel-shear-plate.js';
const parameters={cellsY:4,cellsX:4,height:1,length:1,density:2,kinematicViscosity:.1};
const plate={mass:1,stiffness:2},fluid=channelShearFluid(parameters);
const near=(a,b,tol=2e-13)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
// Independent face-jump quadrature in SI: viscosity0.2 Pa.s, spacing0.25m.
function loss(u,V){return .2/.25*(2*u[0]**2+2*(V-u[3])**2+(u[1]-u[0])**2+(u[2]-u[1])**2+(u[3]-u[2])**2);}
test('each dissipation trapezoid uses its own held wall velocity on both sides of the step',()=>{
 const cfg={fluid,plate,initialDisplacement:.1,dt:.01},first=runShearPlateCoupled({...cfg,steps:1}),two=runShearPlateCoupled({...cfg,steps:2}),zero=[0,0,0,0];
 assert(first.converged&&two.converged);const [a,b,c]=two.history,V1=(b.d-a.d)/cfg.dt,V2=(c.d-b.d)/cfg.dt;
 const expected1=cfg.dt/2*(loss(zero,V1)+loss(first.profile,V1)),expected2=cfg.dt/2*(loss(first.profile,V2)+loss(two.profile,V2));
 near(first.history[1].dissipated,expected1,1e-20);near(two.history[2].dissipated,expected1+expected2,1e-20);
 // Newmark average-velocity work uses the average old/new plate force; it matches the same held-wall shear.
 near(V1,(a.v+b.v)/2,1e-15);near(b.plateEnergy-a.plateEnergy,b.forceOnPlate/2*(b.d-a.d),1e-17);
 assert.ok(expected1>0);assert.notEqual(V1,V2);
});
test('independent cell-force momentum and energy balances use Pa, kg/m2 and J/m2 consistently',()=>{
 const u=[.2,-.1,.4,.3],V=.4,d=.1,hy=.25,mu=.2,c=.1/hy**2;
 const du=[c*(u[1]-3*u[0]),c*(u[0]-2*u[1]+u[2]),c*(u[1]-2*u[2]+u[3]),c*(u[2]-3*u[3]+2*V)];
 const F=-2*mu*(V-u[3])/hy,a=(-plate.stiffness*d+F)/plate.mass;
 near(2*hy*du.reduce((s,x)=>s+x,0)+plate.mass*a,-2*mu*u[0]/hy-plate.stiffness*d);
 near(2*hy*u.reduce((s,x,i)=>s+x*du[i],0)+plate.mass*V*a+plate.stiffness*d*V,-loss(u,V));
 near(fluid.shearOnPlate(u,V),F);near(fluid.dissipation(u,V),loss(u,V));near(fluid.kineticEnergy(u),2*hy*u.reduce((s,x)=>s+x*x,0)/2);
});
// Independent matrix exponential by scaled Taylor multiplication, not the implementation's RK4 stages.
function expAction(A,initial,T){const n=A.length,norm=Math.max(...A.map(r=>r.reduce((s,x)=>s+Math.abs(x),0)))*T,m=Math.max(1,Math.ceil(norm/.1));let y=initial.slice();for(let s=0;s<m;s++){let term=y.slice(),sum=y.slice();for(let k=1;k<60;k++){term=A.map(r=>r.reduce((v,x,i)=>v+x*term[i],0)*(T/m)/k);sum=sum.map((v,i)=>v+term[i]);if(Math.max(...term.map(Math.abs))<1e-17)break;}y=sum;}return y;}
test('nonzero initial fluid replay agrees with an independent six-state exponential and reference step halving',()=>{
 const p={mass:.5,stiffness:3},u=[.2,-.1,.4,.3],d=.1,T=.3;
 // ny4,nu.1,hy.25: c1.6; top wall enters fluid as3.2*v, plate acceleration3.2*u_top-6*d-3.2*v.
 const A=[[-4.8,1.6,0,0,0,0],[1.6,-3.2,1.6,0,0,0],[0,1.6,-3.2,1.6,0,0],[0,0,1.6,-4.8,0,3.2],[0,0,0,0,0,1],[0,0,0,3.2,-6,-3.2]],expected=expAction(A,[...u,d,0],T);
 for(const h of [.0002,.0001]){const r=shearPlateMonolithicReference({fluid,plate:p,initialDisplacement:d,initialProfile:u,endTime:T,h});const actual=[...r.profile,r.samples.at(-1).d,r.samples.at(-1).v];actual.forEach((x,i)=>near(x,expected[i],3e-13));assert.deepEqual(u,[.2,-.1,.4,.3]);}
 const errors=[.004,.002].map(dt=>{const r=runShearPlateCoupled({fluid,plate:p,initialDisplacement:d,initialProfile:u,dt,steps:Math.round(T/dt)});assert(r.converged);return Math.abs(r.history.at(-1).d-expected[4]);});assert(errors[1]<errors[0]);
});
test('zero-energy equilibrium has finite zero absolute and relative diagnostics, including JSON output',()=>{
 const r=runShearPlateCoupled({fluid,plate,dt:.01,steps:2});assert(r.converged);assert.equal(r.initialEnergy,0);
 for(const h of r.history){assert.equal(h.energyDefect,0);assert.equal(h.energyDefectJPerM2,0);for(const x of Object.values(h))assert(Number.isFinite(x));}
 assert.equal(JSON.stringify(r).includes('null'),false);
 assert.throws(()=>runShearPlateCoupled({fluid,plate,initialDisplacement:1e-200,dt:.01,steps:1}),/underflows/);
});
test('parameter JSON reload reconstructs the same issued fluid and nonzero initial case; no saved methods/state accepted',()=>{
 const saved={fluid:fluid.parameters,plate,initialDisplacement:.1,initialProfile:[.1,.2,.1,0],dt:.01,steps:4},before=JSON.stringify(saved),again=JSON.parse(before);
 const a=runShearPlateCoupled({...saved,fluid}),b=runShearPlateCoupled({...again,fluid:channelShearFluid(again.fluid)});assert.deepEqual(a,b);assert.equal(JSON.stringify(saved),before);assert(Object.isFrozen(fluid)&&Object.isFrozen(fluid.parameters));
 assert.throws(()=>runShearPlateCoupled({...saved,fluid:JSON.parse(JSON.stringify(fluid))}),/issued/);
 assert.throws(()=>runShearPlateCoupled({...saved,fluid,state:{d:[99],v:[0],a:[0]}}),/unknown/);
 assert.throws(()=>runShearPlateCoupled({...saved,fluid,structure:{}}),/unknown/);
});
test('bad dimensions, nonfinite/range/work and reference stability requests refuse before producing completed states',()=>{
 for(const patch of [{cellsX:3},{cellsX:6},{cellsX:512},{cellsY:513},{density:1e300,kinematicViscosity:1e300},{height:1e-300},{extra:true}])assert.throws(()=>channelShearFluid({...parameters,...patch}));
 for(const patch of [{steps:SHEAR_PLATE_LIMITS.coupledSteps+1},{maxIterations:Infinity},{maxIterations:0},{maxIterations:201},{steps:20000,maxIterations:200},{dt:1e6},{dt:1e-300},{initialDisplacement:NaN},{initialProfile:[0,0,0,Infinity]}])assert.throws(()=>runShearPlateCoupled({fluid,plate,dt:.01,steps:1,...patch}));
 for(const patch of [{h:0},{h:-1},{h:Infinity},{endTime:NaN},{endTime:-1},{h:1e-20},{h:1},{initialDisplacement:Infinity},{initialProfile:[0,0]},{state:{}}])assert.throws(()=>shearPlateMonolithicReference({fluid,plate,endTime:1,h:.001,...patch}));
 assert.throws(()=>fluid.advance([0,0],0,.01));assert.throws(()=>fluid.advance([0,0,0,0],NaN,.01));assert.throws(()=>fluid.advance([0,0,0,0],0,1e10));
});

test('profile snapshot reads bounded own data and never invokes custom iterators/getters',()=>{
 let iterations=0,getters=0;
 const a=[.1,.2,.1,0];a[Symbol.iterator]=function*(){iterations++;for(let i=0;i<100;i++)yield 99;};
 const typed=new Float64Array([.1,.2,.1,0]);typed[Symbol.iterator]=()=>{iterations++;throw Error('must not iterate');};
 Object.defineProperty(typed,'length',{get(){getters++;throw Error('must use intrinsic length');}});
 Object.defineProperty(typed,'buffer',{get(){getters++;throw Error('must use intrinsic buffer');}});
 const cfg={fluid,plate,initialDisplacement:.1,dt:.01,steps:2};
 const ordinary=runShearPlateCoupled({...cfg,initialProfile:[.1,.2,.1,0]});
 assert.deepEqual(runShearPlateCoupled({...cfg,initialProfile:a}),ordinary);
 assert.deepEqual(runShearPlateCoupled({...cfg,initialProfile:typed}),ordinary);
 assert.equal(shearPlateMonolithicReference({fluid,plate,initialProfile:a,endTime:.001,h:.001}).profile.length,4);
 assert.equal(iterations,0);assert.equal(getters,0);
 const accessor=[0,0,0,0];Object.defineProperty(accessor,'0',{get(){getters++;return 0;}});
 for(const profile of [accessor,[0,,0,0],Object.create(Float64Array.prototype),new(class extends Array{})(0,0,0,0)])assert.throws(()=>runShearPlateCoupled({...cfg,initialProfile:profile}));
 assert.equal(getters,0);
 const storage=new SharedArrayBuffer(32),shared=new Float64Array(storage);Object.defineProperty(shared,'buffer',{value:new ArrayBuffer(32)});
 Object.setPrototypeOf(storage,ArrayBuffer.prototype);assert.throws(()=>runShearPlateCoupled({...cfg,initialProfile:shared}),/non-shared/);
 const long=new Float64Array(100);Object.defineProperty(long,'length',{value:4});assert.throws(()=>runShearPlateCoupled({...cfg,initialProfile:long}));
});
