import test from 'node:test';
import assert from 'node:assert/strict';
import {solveChannelUnsteadyNS,startupCouetteExact,startupPoiseuilleExact,channelVelocityError} from '../src/unsteady-ns-channel.js';
import {observedOrder} from '../src/unsteady-ns-periodic.js';

const nu=.1,endTime=1,rest=()=>[0,0];
const run=(cellsY,drive)=>solveChannelUnsteadyNS({cellsX:8,cellsY,kinematicViscosity:nu,initialVelocity:rest,endTime,...drive});

for(const [name,drive,exact] of [['startup Couette',{topVelocity:1},startupCouetteExact(nu,endTime)],['startup Poiseuille',{bodyForce:1},startupPoiseuilleExact(nu,endTime)]])
 test(name+' from rest converges at second order with no-slip walls and divergence at round-off',()=>{
  const runs=[16,32,64].map(cellsY=>run(cellsY,drive)),errors=runs.map(r=>channelVelocityError(r,exact));
  assert.ok(errors[2].relativeL2<5e-4,'N=64 error '+errors[2].relativeL2);
  for(let i=1;i<errors.length;i++){const p=observedOrder(errors[i-1].relativeL2,errors[i].relativeL2);assert.ok(p>1.9&&p<2.1,'observed order '+p);}
  for(const [i,r] of runs.entries()){assert.equal(r.turbulenceModel,'none');assert.ok(Math.abs(r.time-endTime)<1e-12);assert.ok(errors[i].maxAbsV<1e-12);
   for(const h of r.history){assert.ok(h.maxAbsDivergence<1e-12);assert.ok(h.flowRateSpread<1e-12);}}
 });

test('nonlinear 2D disturbance between resting walls: projected, solenoidal, uniform flow rate, monotonic energy decay',()=>{
 const r=solveChannelUnsteadyNS({cellsX:32,cellsY:32,kinematicViscosity:.01,endTime:2,initialVelocity:(x,y)=>[Math.sin(x)*Math.sin(Math.PI*y)+.5*Math.cos(2*x)*y*(1-y),Math.cos(x)*Math.sin(2*Math.PI*y)]});
 assert.ok(r.initialMaxAbsDivergence>.1);
 for(const h of r.history){assert.ok(h.maxAbsDivergence<1e-12,'div '+h.maxAbsDivergence);assert.ok(h.flowRateSpread<1e-12);}
 for(let i=1;i<r.history.length;i++)assert.ok(r.history[i].kineticEnergy<r.history[i-1].kineticEnergy,'energy must decay monotonically at step '+i);
});

test('fixed time-step refinement shows at least second-order temporal self-convergence in startup Poiseuille',()=>{
 const at=dt=>solveChannelUnsteadyNS({cellsX:4,cellsY:16,kinematicViscosity:nu,initialVelocity:rest,endTime,bodyForce:1,fixedTimeStep:dt});
 const ref=at(.00125),diff=[.01,.005,.0025].map(dt=>{const r=at(dt);let m=0;for(let k=0;k<r.u.length;k++)m=Math.max(m,Math.abs(r.u[k]-ref.u[k]));return m;});
 assert.ok(Math.log2(diff[0]/diff[1])>2.5&&Math.log2(diff[1]/diff[2])>2.5,JSON.stringify(diff));
});

test('explicit viscous stability limit is enforced and is sharp',()=>{
 const base={cellsX:32,cellsY:32,kinematicViscosity:nu,bodyForce:1,initialVelocity:(x,y)=>[.1*Math.sin(x)*Math.sin(Math.PI*y)+1e-3*Math.sin(37*x+50*y),0]};
 const limit=solveChannelUnsteadyNS({...base,initialVelocity:rest,endTime:.01}).stability.viscousStableTimeStep;
 assert.throws(()=>solveChannelUnsteadyNS({...base,endTime:1,fixedTimeStep:limit*1.05}),/stability limit/);
 const stable=solveChannelUnsteadyNS({...base,endTime:limit*.98*600,fixedTimeStep:limit*.98});
 assert.ok(stable.history.at(-1).maxVelocityComponent<2);
 assert.throws(()=>solveChannelUnsteadyNS({...base,endTime:limit*1.05*600,fixedTimeStep:limit*1.05,allowUnstableTimeStep:true}),/non-finite/);
});

test('invalid inputs and exhausted budgets fail without returning a result',()=>{
 const base={cellsX:8,cellsY:8,kinematicViscosity:nu,initialVelocity:rest,endTime,topVelocity:1};
 for(const patch of [{cellsX:12},{cellsX:512},{cellsY:3},{cellsY:8.5},{height:0},{kinematicViscosity:0},{endTime:NaN},{initialVelocity:null},{topVelocity:Infinity},{bodyForce:NaN},{cfl:2},{stabilitySafety:1.5},{fixedTimeStep:-1}])assert.throws(()=>solveChannelUnsteadyNS({...base,...patch}));
 assert.throws(()=>solveChannelUnsteadyNS({...base,initialVelocity:()=>[NaN,0]}),/finite/);
 assert.throws(()=>solveChannelUnsteadyNS({...base,maxSteps:2}),/step limit/);
 let clock=0;assert.throws(()=>solveChannelUnsteadyNS({...base,maxSeconds:1,now:()=>(clock+=600)}),/time budget/);
});
