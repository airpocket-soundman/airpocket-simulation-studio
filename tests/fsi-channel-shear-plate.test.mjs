import test from 'node:test';
import assert from 'node:assert/strict';
import {channelShearFluid,runShearPlateCoupled,shearPlateMonolithicReference} from '../src/fsi-channel-shear-plate.js';

// Synthetic water-like layer (rho=1000 kg/m^3, nu=1e-6 m^2/s, H=1 mm) under a spring-mass plate; not material data.
const fluid=channelShearFluid({cellsY:16,height:1e-3,density:1000,kinematicViscosity:1e-6});
const plate={mass:.05,stiffness:50},d0=1e-3,T=.4;
const ref=shearPlateMonolithicReference({fluid,plate,initialDisplacement:d0,endTime:T,h:2e-6});
const refAt=t=>ref.samples[Math.round(t/ref.dt)];
const maxError=r=>Math.max(...r.history.map(h=>Math.abs(h.d-refAt(h.t).d)))/d0;

test('partitioned CFD2 channel + plate converges to the monolithic semi-discrete solution at second order in dt',()=>{
  const errors=[4e-3,2e-3,1e-3].map(dt=>{const r=runShearPlateCoupled({fluid,plate,initialDisplacement:d0,dt,steps:Math.round(T/dt)});
    assert.ok(r.converged);assert.equal(r.maxXSpread,0);return maxError(r);});
  assert.ok(errors[2]<2e-3,`error at dt=1e-3: ${errors[2]}`);
  for(let i=1;i<errors.length;i++)assert.ok(Math.log2(errors[i-1]/errors[i])>1.8,`order ${Math.log2(errors[i-1]/errors[i])}`);
});

test('interface forces are action-reaction and the energy budget closes at first order in dt',()=>{
  const defects=[2e-3,1e-3].map(dt=>{const r=runShearPlateCoupled({fluid,plate,initialDisplacement:d0,dt,steps:Math.round(T/dt)});
    for(const h of r.history.slice(1))assert.equal(h.forceOnPlate+h.forceOnFluid,0);
    // Physical dissipation: plate + fluid mechanical energy decays by >95% within T.
    assert.ok((r.history.at(-1).plateEnergy+r.history.at(-1).fluidEnergy)/r.initialEnergy<.05);
    return Math.max(...r.history.map(h=>Math.abs(h.energyDefect)));});
  assert.ok(defects[1]<.02,`energy defect ${defects[1]}`);
  assert.ok(Math.log2(defects[0]/defects[1])>.9,`energy-defect order ${Math.log2(defects[0]/defects[1])}`);
});

test('unrelaxed iteration factor matches -S^-1 dF/dd from the real fluid solve and is rejected early when > 1',()=>{
  const light={mass:.01,stiffness:50},dt=2e-3,S=light.stiffness+light.mass/(.25*dt*dt);
  // Fluid interface stiffness by finite difference of one real channel solve from rest (linear in d: Stokes layer, v=0).
  const rest=new Float64Array(fluid.cellsY),F=d=>{const V=d/dt,a=fluid.advance(rest,V,dt);return fluid.shearOnPlate(a.profile,2*V);};
  const factor=-(F(1e-6)-F(0))/1e-6/S;
  const plain=runShearPlateCoupled({fluid,plate:light,initialDisplacement:d0,dt,steps:1,relaxation:'none',maxIterations:200});
  assert.equal(plain.converged,false);assert.equal(plain.reason,'diverging');assert.ok(plain.residuals.length<=6);
  const r=plain.residuals,measured=-r.at(-1)/r.at(-2);
  assert.ok(Math.abs(Math.abs(measured)-Math.abs(factor))/Math.abs(factor)<1e-6,`measured ${measured} analytic ${factor}`);
  assert.ok(Math.abs(factor)>1);
});

test('vector Aitken converges in <=3 iterations for every plate mass while none/constant fail on light plates',()=>{
  for(const mass of [.05,.01,.002,.0005]){
    const run=relaxation=>runShearPlateCoupled({fluid,plate:{mass,stiffness:50},initialDisplacement:d0,dt:2e-3,steps:20,relaxation,maxIterations:200});
    const aitken=run('aitken');assert.ok(aitken.converged);assert.ok(Math.max(...aitken.iterations)<=3,`mass ${mass}`);
    if(mass<=.002)for(const relaxation of ['none','constant']){const r=run(relaxation);assert.equal(r.converged,false);assert.equal(r.reason,'diverging');}
  }
});

test('invalid inputs are rejected',()=>{
  assert.throws(()=>channelShearFluid({cellsY:2,height:1e-3,density:1000,kinematicViscosity:1e-6}));
  assert.throws(()=>channelShearFluid({cellsY:16,height:-1,density:1000,kinematicViscosity:1e-6}));
  assert.throws(()=>runShearPlateCoupled({fluid,plate:{mass:0,stiffness:50},dt:1e-3,steps:1}));
  assert.throws(()=>runShearPlateCoupled({fluid,plate,dt:0,steps:1}));
  assert.throws(()=>runShearPlateCoupled({fluid,plate,dt:1e-3,steps:1,initialProfile:[0,0]}));
  assert.throws(()=>runShearPlateCoupled({fluid,plate,dt:1e-3,steps:1,relaxation:'magic'}));
});
