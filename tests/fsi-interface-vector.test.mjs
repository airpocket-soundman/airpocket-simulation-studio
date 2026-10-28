import test from 'node:test';
import assert from 'node:assert/strict';
import {linearInterfaceFluid,diagonalStructure,coupledStepVector,monolithicStepVector,dirichletNeumannMatrix} from '../src/fsi-interface-vector.js';

// Synthetic, non-material 2-DOF interface: two pistons sharing one fluid (off-diagonal added mass couples them).
const structure=diagonalStructure({mass:[.1,.1],stiffness:[4e3,4e3]});
const fluidOf=(s)=>linearInterfaceFluid({addedMass:[[.2*s,.1*s],[.1*s,.2*s]],addedStiffness:[[2e3,-5e2],[-5e2,2e3]],ambientForce:[10,10]});
const dt=1e-4,rest={d:[0,0],v:[0,0],a:[0,0]};
const eigen2=(J)=>{const tr=J[0][0]+J[1][1],det=J[0][0]*J[1][1]-J[0][1]*J[1][0],disc=Math.sqrt(tr*tr/4-det);return [tr/2+disc,tr/2-disc];};
const spectralRadius2=(J)=>Math.max(...eigen2(J).map(Math.abs));
const march=(fluid,steps,options)=>{let s=rest,maxIt=0,maxDiff=0,maxForceSum=0;
  for(let n=0;n<steps;n++){const step=coupledStepVector({fluid,structure,state:s,dt,...options});assert.ok(step.converged,`step ${n}: ${step.reason}`);
    const mono=monolithicStepVector({fluid,structure,state:s,dt});
    maxDiff=Math.max(maxDiff,...step.state.d.map((x,i)=>Math.abs(x-mono.d[i])/Math.max(...mono.d.map(Math.abs))));
    maxForceSum=Math.max(maxForceSum,...step.forceOnStructure.map((f,i)=>Math.abs(f+step.forceOnFluid[i])));
    maxIt=Math.max(maxIt,step.iterations);s=step.state;}
  return {maxIt,maxDiff,maxForceSum};};

test('converged vector partitioned march reproduces the monolithic Newmark solution with action-reaction forces',()=>{
  const r=march(fluidOf(1),300,{});
  assert.ok(r.maxDiff<1e-9,`relative difference ${r.maxDiff}`);
  assert.equal(r.maxForceSum,0);
});

test('unrelaxed iteration is rejected as diverging early, at the analytic spectral radius',()=>{
  const fluid=fluidOf(1),rho=spectralRadius2(dirichletNeumannMatrix({fluid,structure,dt}));
  assert.ok(rho>1,`spectral radius ${rho}`);
  const plain=coupledStepVector({fluid,structure,state:rest,dt,relaxation:'none',maxIterations:200,divergenceWindow:30});
  assert.equal(plain.converged,false);assert.equal(plain.reason,'diverging');assert.ok(plain.iterations<200);
  const r=plain.residuals,measured=r[r.length-1]/r[r.length-2];
  assert.ok(Math.abs(measured-rho)<1e-6*rho,`measured ${measured} vs ${rho}`);
  const quick=coupledStepVector({fluid,structure,state:rest,dt,relaxation:'none'});
  assert.equal(quick.reason,'diverging');assert.ok(quick.iterations<=6,`detected after ${quick.iterations}`);
});

test('Aitken needs fewer iterations than the optimal constant relaxation across added-mass ratios',()=>{
  for(const s of [.5,1,2]){
    const fluid=fluidOf(s),[l1,l2]=eigen2(dirichletNeumannMatrix({fluid,structure,dt}));
    // Optimal constant omega for a real negative spectrum balances the two extreme modes.
    const constant=march(fluid,20,{relaxation:'constant',omega0:2/(2-l1-l2),maxIterations:500}),aitken=march(fluid,20,{});
    assert.ok(aitken.maxIt<=6,`ratio ${s*3}: aitken ${aitken.maxIt}`);
    assert.ok(aitken.maxIt<constant.maxIt,`ratio ${s*3}: aitken ${aitken.maxIt} vs constant ${constant.maxIt}`);
  }
});

test('vector contract rejects malformed or inconsistent inputs',()=>{
  assert.throws(()=>linearInterfaceFluid({addedMass:[[1,2],[0,1]],addedStiffness:[[0,0],[0,0]],ambientForce:[0,0]}),/symmetric added mass/);
  assert.throws(()=>linearInterfaceFluid({addedMass:[[1]],addedStiffness:[[0]],ambientForce:[NaN]}),/ambient force/);
  assert.throws(()=>diagonalStructure({mass:[1,0],stiffness:[1,1]}),/positive masses/);
  const one=linearInterfaceFluid({addedMass:[[1]],addedStiffness:[[0]],ambientForce:[0]});
  assert.throws(()=>coupledStepVector({fluid:one,structure,state:rest,dt}),/matching/);
  assert.throws(()=>coupledStepVector({fluid:fluidOf(1),structure,state:rest,dt,relaxation:'iqn'}),/unknown relaxation/);
  assert.throws(()=>coupledStepVector({fluid:fluidOf(1),structure,state:rest,dt,omega0:1.5}),/omega0/);
  assert.throws(()=>coupledStepVector({fluid:fluidOf(1),structure,state:{d:[0],v:[0,0],a:[0,0]},dt}),/state\.d/);
});
