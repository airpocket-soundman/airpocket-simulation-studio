import test from 'node:test';
import assert from 'node:assert/strict';
import {solvePeriodicUnsteadyNS,taylorGreenExact,shearWaveExact,velocityError,observedOrder} from '../src/unsteady-ns-periodic.js';

const nu=.01,endTime=1;
const tgv=cells=>solvePeriodicUnsteadyNS({cells,kinematicViscosity:nu,initialVelocity:taylorGreenExact(nu,0),endTime});

test('decaying Taylor-Green vortex converges at second order with divergence and mean momentum at round-off',()=>{
 const runs=[16,32,64].map(tgv),errors=runs.map(r=>velocityError(r,taylorGreenExact(nu,endTime)));
 assert.ok(errors[2]<2e-5,'N=64 relative L2 error '+errors[2]);
 for(let i=1;i<errors.length;i++){const p=observedOrder(errors[i-1],errors[i]);assert.ok(p>1.9&&p<2.1,'observed order '+p);}
 for(const r of runs){assert.equal(r.turbulenceModel,'none');assert.ok(Math.abs(r.time-endTime)<1e-12);
  for(const h of r.history){assert.ok(h.maxAbsDivergence<1e-12);assert.ok(Math.abs(h.meanVelocity[0])<1e-14&&Math.abs(h.meanVelocity[1])<1e-14);}
  const energy=r.history.at(-1).kineticEnergy,exact=Math.PI**2*Math.exp(-4*nu*endTime);assert.ok(Math.abs(energy/exact-1)<1e-3);
  for(let i=1;i<r.history.length;i++)assert.ok(r.history[i].kineticEnergy<r.history[i-1].kineticEnergy,'energy must decay monotonically');}
});

test('viscous shear wave (unsteady Stokes, advection identically zero) converges at second order',()=>{
 const errors=[16,32,64].map(cells=>velocityError(solvePeriodicUnsteadyNS({cells,kinematicViscosity:.1,initialVelocity:shearWaveExact(.1,0,2),endTime:1}),shearWaveExact(.1,1,2)));
 for(let i=1;i<errors.length;i++){const p=observedOrder(errors[i-1],errors[i]);assert.ok(p>1.9&&p<2.1,'observed order '+p);}
});

test('fixed time-step refinement shows at least second-order temporal self-convergence',()=>{
 const run=dt=>solvePeriodicUnsteadyNS({cells:32,kinematicViscosity:nu,initialVelocity:taylorGreenExact(nu,0),endTime,fixedTimeStep:dt});
 const ref=run(.0125),diff=[.1,.05,.025].map(dt=>{const r=run(dt);let m=0;for(let k=0;k<r.u.length;k++)m=Math.max(m,Math.abs(r.u[k]-ref.u[k]));return m;});
 assert.ok(Math.log2(diff[0]/diff[1])>2.5&&Math.log2(diff[1]/diff[2])>2.5,JSON.stringify(diff));
});

test('non-solenoidal initial data is projected before stepping',()=>{
 const r=solvePeriodicUnsteadyNS({cells:16,kinematicViscosity:nu,initialVelocity:(x,y)=>[Math.sin(x),Math.cos(y)],endTime:.1});
 assert.ok(r.initialMaxAbsDivergence>.5);assert.ok(r.history[0].maxAbsDivergence<1e-12);
});

test('invalid inputs and exhausted budgets fail without returning a result',()=>{
 const base={cells:16,kinematicViscosity:nu,initialVelocity:taylorGreenExact(nu,0),endTime};
 for(const patch of [{cells:12},{cells:512},{kinematicViscosity:0},{endTime:NaN},{initialVelocity:null},{cfl:2},{diffusionNumber:.3},{fixedTimeStep:-1}])assert.throws(()=>solvePeriodicUnsteadyNS({...base,...patch}));
 assert.throws(()=>solvePeriodicUnsteadyNS({...base,initialVelocity:()=>[NaN,0]}),/finite/);
 assert.throws(()=>solvePeriodicUnsteadyNS({...base,maxSteps:2}),/step limit/);
 let clock=0;assert.throws(()=>solvePeriodicUnsteadyNS({...base,maxSeconds:1,now:()=>(clock+=600)}),/time budget/);
 assert.throws(()=>solvePeriodicUnsteadyNS({...base,kinematicViscosity:1e-6,endTime:1e5,fixedTimeStep:1e3}),/non-finite/);
});
