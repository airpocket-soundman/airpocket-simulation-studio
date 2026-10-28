import test from 'node:test';
import assert from 'node:assert/strict';
import {pistonColumnFluid,springMassStructure,coupledStep,runCoupled,dirichletNeumannFactor} from '../src/fsi-partitioned.js';

// Synthetic, non-material inputs chosen only so the analytic piston solution is easy to read.
const fluidOf=(density)=>pistonColumnFluid({area:1e-3,length:.2,density,kappa:2e6,p0:1e4});
const structure=springMassStructure({mass:.1,stiffness:4e3});
const exact=(fluid,d0,t)=>{const kTot=structure.stiffness+fluid.addedStiffness,mTot=structure.mass+fluid.addedMass,dEq=fluid.equilibrium/kTot;
  return dEq+(d0-dEq)*Math.cos(Math.sqrt(kTot/mTot)*t);};

test('converged partitioned march matches the analytic coupled piston with second-order time error',()=>{
  const fluid=fluidOf(100),d0=0,period=2*Math.PI/Math.sqrt((structure.stiffness+fluid.addedStiffness)/(structure.mass+fluid.addedMass));
  const errorAt=(steps)=>{const run=runCoupled({fluid,structure,initial:{d:d0,v:0},dt:period/steps,steps});assert.ok(run.converged);
    return Math.max(...run.history.map(h=>Math.abs(h.d-exact(fluid,d0,h.t))))/Math.abs(run.equilibrium);};
  const e1=errorAt(64),e2=errorAt(128),order=Math.log2(e1/e2);
  assert.ok(e2<2e-3,`relative error ${e2}`);
  assert.ok(Math.abs(order-2)<.05,`observed order ${order}`);
});

test('coupled energy is conserved and interface forces are equal and opposite',()=>{
  const fluid=fluidOf(100),run=runCoupled({fluid,structure,initial:{d:0,v:0},dt:1e-4,steps:2000});
  assert.ok(run.converged);
  const e0=run.history[0].energy,drift=Math.max(...run.history.map(h=>Math.abs(h.energy-e0)))/e0;
  assert.ok(drift<1e-9,`energy drift ${drift}`);
  assert.ok(Math.abs(run.interfaceWorkImbalance)<1e-15,`interface work imbalance ${run.interfaceWorkImbalance} J`);
  const step=coupledStep({fluid,structure,state:{d:0,v:0,a:fluid.equilibrium/(structure.mass+fluid.addedMass)},dt:1e-4});
  assert.equal(step.forceOnStructure+step.forceOnFluid,0);
});

test('added-mass instability: unrelaxed Dirichlet-Neumann diverges at the analytic factor, Aitken converges',()=>{
  const fluid=fluidOf(1000),dt=1e-4,factor=dirichletNeumannFactor({fluid,structure,dt});
  assert.ok(fluid.addedMass/structure.mass===2);assert.ok(factor<-1,`factor ${factor}`);
  const state={d:0,v:0,a:fluid.equilibrium/(structure.mass+fluid.addedMass)};
  const plain=coupledStep({fluid,structure,state,dt,relaxation:'none',maxIterations:20});
  assert.equal(plain.converged,false);
  const r=plain.residuals,measured=r[r.length-1]/r[r.length-2];
  assert.ok(Math.abs(measured-Math.abs(factor))<1e-6*Math.abs(factor),`measured ${measured} vs ${factor}`);
  const aitken=coupledStep({fluid,structure,state,dt,relaxation:'aitken'});
  assert.ok(aitken.converged&&aitken.iterations<=5,`aitken iterations ${aitken.iterations}`);
  const run=runCoupled({fluid,structure,initial:{d:0,v:0},dt,steps:500});
  assert.ok(run.converged);
});

test('contract rejects non-finite or unknown inputs instead of reporting success',()=>{
  assert.throws(()=>pistonColumnFluid({area:0,length:1,density:1,kappa:0,p0:0}),/positive area/);
  assert.throws(()=>springMassStructure({mass:NaN,stiffness:1}),/positive mass/);
  assert.throws(()=>coupledStep({fluid:fluidOf(1),structure,state:{d:0,v:0,a:0},dt:1e-4,relaxation:'iqn'}),/unknown relaxation/);
  assert.throws(()=>runCoupled({fluid:fluidOf(1),structure,initial:{d:0,v:0},dt:1e-4,steps:1.5}),/step count/);
});
