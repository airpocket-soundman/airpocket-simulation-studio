import {reference} from './helpers/fsi-average-force-oracle.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {runChannelAverageForce,AVERAGE_FORCE_LIMITS} from '../src/fsi-channel-average-force.js';
import {channelShearFluid,runShearPlateCoupled} from '../src/fsi-channel-shear-plate.js';

const input=(dt=.025,microsteps=4)=>({schemaVersion:1,method:'time-averaged-midpoint',fluid:{cellsX:4,cellsY:8,height:1,length:1,density:1,kinematicViscosity:.1},plate:{mass:.5,stiffness:2},initialDisplacement:.1,dt,steps:Math.round(.2/dt),microsteps});
const close=(a,b,abs=2e-13)=>assert.ok(Math.abs(a-b)<=abs,`${a} vs ${b}`);
// Independent ODE oracle: direct centered diffusion + ghost walls + a spring/mass,
// with Q integrated as an extra RK4 state. No production stepping/reference imports.

test('actual channel/midpoint displacements converge to independent monolithic RK4; dissipation and energy error are second order',()=>{
 const ref=reference(input()),errors=[],defects=[],dissipationErrors=[];
 for(const dt of [.025,.0125,.00625]){const p=input(dt),r=runChannelAverageForce(p),last=r.history.at(-1);assert.equal(r.maxXSpread,0);errors.push(Math.abs(last.d-ref[8]));defects.push(Math.max(...r.history.map(x=>Math.abs(x.energyDefect))));dissipationErrors.push(Math.abs(last.dissipated-ref[10]));}
 for(const series of [errors,defects,dissipationErrors])for(let i=1;i<series.length;i++)assert.ok(Math.log2(series[i-1]/series[i])>1.8,JSON.stringify(series));
 assert(errors.at(-1)<1e-6);assert(defects.at(-1)<1e-4);
});

test('same averaged impulse does opposite fluid/plate work; actual energy and momentum quadratures converge with microstep refinement',()=>{
 const defects=[],momenta=[];
 for(const m of [1,2,4,8]){const r=runChannelAverageForce(input(.0125,m));let fluidDefect=0,plateDefect=0;
  for(const h of r.history.slice(1)){assert.equal(h.forceOnPlate+h.forceOnFluid,0);close(h.stepInterfaceWork,h.wallVelocity*h.interfaceImpulse);assert(h.stepDissipated>=0);assert(Math.abs(h.scaledForceResidual)<1e-12);fluidDefect+=h.fluidEnergyDefectJPerM2;plateDefect+=h.plateEnergyDefectJPerM2;assert(Math.abs(h.plateEnergyDefectJPerM2)<1e-16);}
  close(fluidDefect+plateDefect,r.history.at(-1).energyDefectJPerM2);defects.push(Math.abs(fluidDefect));momenta.push(Math.max(...r.history.slice(1).map(h=>Math.abs(h.momentumDefectKgPerMS))));
 }
 for(const series of [defects,momenta])for(let i=1;i<series.length;i++)assert(Math.log2(series[i-1]/series[i])>1.8,JSON.stringify(series));
});

test('one-microstep force/state agrees with independent diffusion polynomial and midpoint scalar equation',()=>{
 const p=input(.01,1);p.steps=1;p.fluid.cellsY=4;const dy=.25,nu=.1,mu=.1,h=p.dt;
 const derivative=(u,V)=>u.map((x,j)=>nu/dy**2*((j?u[j-1]:-x)+(j<3?u[j+1]:2*V-x)-2*x));
 const polynomial=V=>{const u=[0,0,0,0],a=derivative(u,V),b=derivative(a,0),c=derivative(b,0);return u.map((x,j)=>x+h*a[j]+h*h*b[j]/2+h**3*c[j]/6);};
 const u1=polynomial(1),slope=-2*mu/dy*(1-u1[3]/2),V=(-p.plate.stiffness*p.initialDisplacement)/(2*p.plate.mass/h+p.plate.stiffness*h/2-slope),u=polynomial(V),force=-2*mu/dy*(V-u[3]/2);
 const r=runChannelAverageForce(p),s=r.history[1];close(s.wallVelocity,V);close(s.forceOnPlate,force);close(s.v,2*V);close(s.d,p.initialDisplacement+h*V);for(let j=0;j<4;j++)close(r.profile[j],u[j]);
});

test('bounded synthetic fixture improves energy defect over unchanged legacy method without changing legacy semantics',()=>{
 const p=input(.0125),old=runShearPlateCoupled({fluid:channelShearFluid(p.fluid),plate:p.plate,initialDisplacement:p.initialDisplacement,dt:p.dt,steps:p.steps}),next=runChannelAverageForce(p);
 assert.equal(old.converged,true);const max=r=>Math.max(...r.history.map(h=>Math.abs(h.energyDefect)));assert(max(next)<max(old)/10);
});

test('saved input reload recomputes exactly, ignores no claimed result, owns snapshots and preserves callers',()=>{
 const p=input(),before=JSON.stringify(p),r=runChannelAverageForce(p),saved=JSON.parse(JSON.stringify(r.input)),again=runChannelAverageForce(saved);assert.deepEqual(again,r);assert.equal(JSON.stringify(p),before);assert(Object.isFrozen(r.input.fluid));assert(Object.isFrozen(r.input.initialProfile));assert.equal(Object.isFrozen(p),false);
 assert.throws(()=>runChannelAverageForce({...saved,history:r.history}),/FSI_AVERAGE_INPUT/);assert.throws(()=>runChannelAverageForce({...saved,schemaVersion:2}),/FSI_AVERAGE_VERSION/);
});

test('zero-energy equilibrium stays finite; capacities and hostile inputs refuse before stepping',()=>{
 const p=input();p.initialDisplacement=0;const r=runChannelAverageForce(p);assert(r.history.every(h=>h.energyDefect===0&&h.energyDefectJPerM2===0&&Number.isFinite(h.plateEnergy)));
 for(const bad of [{...p,steps:AVERAGE_FORCE_LIMITS.steps+1},{...p,microsteps:4097},{...p,dt:Number.MIN_VALUE,microsteps:2},{...p,steps:4096,microsteps:4096},{...p,initialDisplacement:NaN},{...p,plate:{mass:0,stiffness:1}},{...p,initialProfile:[0,0]},{...p,fluid:{...p.fluid,unknown:1}}])assert.throws(()=>runChannelAverageForce(bad));
 let calls=0;const accessor={...p};Object.defineProperty(accessor,'dt',{enumerable:true,get(){calls++;return .1;}});assert.throws(()=>runChannelAverageForce(accessor));assert.equal(calls,0);
 const a=new Array(8).fill(0);a[Symbol.iterator]=function*(){calls++;throw Error('iterator');};assert.equal(runChannelAverageForce({...p,initialProfile:a}).history.at(-1).energyDefect,0);assert.equal(calls,0);
 Object.defineProperty(a,'0',{get(){calls++;return 0;}});assert.throws(()=>runChannelAverageForce({...p,initialProfile:a}),/FSI_AVERAGE_PROFILE/);assert.equal(calls,0);
});

test('free translated equilibrium, tiny resolved amplitudes and mixed initial fluid velocities retain finite diagnostics',()=>{
 const p=input(.0125,2);p.steps=2;p.plate.stiffness=0;const rest=runChannelAverageForce(p);assert(rest.history.every(h=>h.d===p.initialDisplacement&&h.v===0&&h.energyDefect===0));
 const tiny={...p,plate:{mass:.5,stiffness:2},initialDisplacement:1e-100};const t=runChannelAverageForce(tiny);assert(t.initialEnergy>0);assert(t.history.every(h=>Number.isFinite(h.energyDefect)));
 const mixed={...p,plate:{mass:.005,stiffness:2},initialProfile:[.01,-.02,.03,-.04,.05,-.06,.07,-.08]},before=JSON.stringify(mixed),r=runChannelAverageForce(mixed);assert.equal(JSON.stringify(mixed),before);assert(r.history.every(h=>Number.isFinite(h.energyDefect)&&h.dissipated>=0));
 assert.throws(()=>runChannelAverageForce({...p,dt:2e-300,plate:{mass:.5,stiffness:2}}));assert.throws(()=>runChannelAverageForce({...p,dt:Number.MAX_VALUE}));assert.throws(()=>runChannelAverageForce({...p,initialDisplacement:1e-200,plate:{mass:.5,stiffness:2}}),/ZERO_ENERGY/);
});
