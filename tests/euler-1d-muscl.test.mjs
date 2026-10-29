import test from 'node:test';
import assert from 'node:assert/strict';
import {solveEuler1DMuscl,densityWaveAverages,densityWaveL1Error,riemannInitial,riemannL1DensityError} from '../src/euler-1d-muscl.js';
import {SOD,observedOrder} from '../src/euler-1d-riemann.js';

const wave={amplitude:.2,velocity:1,pressure:1};
const waveErrors=(order,limiter)=>[32,64,128,256].map(cells=>{const r=solveEuler1DMuscl({cells,initial:densityWaveAverages(wave),endTime:1,order,limiter});
 for(const v of r.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-13,'periodic imbalance '+v);
 assert.deepEqual(r.conservation.boundaryInflow,[0,0,0]);return densityWaveL1Error(r,wave);});

test('unlimited MUSCL + SSP-RK2 is second order on the smooth periodic density wave',()=>{
 const e=waveErrors(2,'none');for(let i=1;i<e.length;i++){const p=observedOrder(e[i-1],e[i]);assert.ok(p>1.95&&p<2.1,'order '+p);}
});

test('limited schemes stay above first order and beat order 1 on the smooth wave',()=>{
 const first=waveErrors(1,'none'),mm=waveErrors(2,'minmod'),vl=waveErrors(2,'vanleer');
 assert.ok(observedOrder(first[2],first[3])<1.05);
 assert.ok(observedOrder(mm[2],mm[3])>1.8,'minmod');assert.ok(observedOrder(vl[2],vl[3])>1.9,'van Leer');
 assert.ok(mm[3]<first[3]/10&&vl[3]<mm[3]);
});

test('second-order Sod is more accurate than first order, conservative and positive; Toro test 2 stays positive',()=>{
 const run=(order,limiter)=>solveEuler1DMuscl({cells:400,initial:riemannInitial(SOD.left,SOD.right),endTime:.2,order,limiter,boundary:'transmissive'});
 const e1=riemannL1DensityError(run(1,'minmod'),SOD.left,SOD.right),r2=run(2,'minmod'),e2=riemannL1DensityError(r2,SOD.left,SOD.right);
 assert.ok(e2<e1/2,'MUSCL '+e2+' vs first order '+e1);for(const v of r2.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-13);
 const t2={left:{density:1,velocity:-2,pressure:.4},right:{density:1,velocity:2,pressure:.4}};
 const r=solveEuler1DMuscl({cells:400,initial:riemannInitial(t2.left,t2.right),endTime:.15,boundary:'transmissive'});assert.ok(r.minDensity>0&&r.minPressure>0);
 const w=solveEuler1DMuscl({cells:200,initial:riemannInitial(SOD.left,SOD.right),endTime:.5,boundary:'reflective'});
 assert.equal(w.conservation.boundaryInflow[0],0);assert.equal(w.conservation.boundaryInflow[2],0);for(const v of w.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-13);
});

test('invalid inputs and runaway runs throw instead of returning results',()=>{
 const ok={cells:32,initial:densityWaveAverages(wave),endTime:.1};
 for(const bad of [{cells:4},{cfl:.8},{order:3},{limiter:'superbee'},{flux:'roe'},{boundary:'inflow'},{initial:null},{endTime:0},{initial:()=>({density:-1,velocity:0,pressure:1})},{maxSteps:2},{timeBudgetMs:-1}])
  assert.throws(()=>solveEuler1DMuscl({...ok,...bad}));
 assert.throws(()=>densityWaveAverages({amplitude:1}));
});
