import test from 'node:test';
import assert from 'node:assert/strict';
import {solveEuler2DMuscl,isentropicVortexAverages,vortexL1DensityError,LAX_LIU_CONFIG3,quadrantInitial} from '../src/euler-2d-muscl.js';
import {observedOrder} from '../src/euler-1d-riemann.js';

const vortexErrors=limiter=>[16,32,64].map(n=>{const r=solveEuler2DMuscl({nx:n,ny:n,lengthX:10,lengthY:10,initial:isentropicVortexAverages(),endTime:2,limiter});
 for(const v of r.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-13,'periodic imbalance '+v);
 assert.deepEqual(r.conservation.boundaryInflow,[0,0,0,0]);return vortexL1DensityError(r);});

test('unsplit 2D MUSCL + SSP-RK2 is second order on the advected isentropic vortex',()=>{
 for(const lim of ['none','vanleer']){const e=vortexErrors(lim),p=observedOrder(e[1],e[2]);assert.ok(p>1.9&&p<2.4,lim+' order '+p);}
});

test('2D Riemann problem (Lax-Liu 3): conservative, positive, diagonal-symmetric; reflective box has zero mass/energy inflow',()=>{
 for(const boundary of ['transmissive','reflective']){const n=64,r=solveEuler2DMuscl({nx:n,ny:n,initial:quadrantInitial(LAX_LIU_CONFIG3),endTime:.3,boundary});
  for(const v of r.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-12,boundary+' imbalance '+v);
  assert.ok(r.minDensity>0&&r.minPressure>0);
  let asym=0;for(let j=0;j<n;j++)for(let i=0;i<n;i++)asym=Math.max(asym,Math.abs(r.density[i+n*j]-r.density[j+n*i]));assert.ok(asym<1e-10,'transpose asymmetry '+asym);
  if(boundary==='reflective'){assert.equal(r.conservation.boundaryInflow[0],0);assert.equal(r.conservation.boundaryInflow[3],0);}}
});

test('invalid inputs and limits throw',()=>{
 const ok={nx:8,ny:8,initial:()=>({density:1,velocityX:0,velocityY:0,pressure:1}),endTime:.1};
 for(const bad of [{nx:3},{ny:1.5},{cfl:.6},{order:3},{limiter:'superbee'},{flux:'roe'},{boundary:'inflow'},{initial:null},{endTime:0},{gamma:1},
  {initial:()=>({density:-1,velocityX:0,velocityY:0,pressure:1})},{maxSteps:1},{timeBudgetMs:-1}])assert.throws(()=>solveEuler2DMuscl({...ok,...bad}));
 assert.throws(()=>isentropicVortexAverages({strength:9}));
});
