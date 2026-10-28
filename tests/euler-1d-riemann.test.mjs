import test from 'node:test';
import assert from 'node:assert/strict';
import {solveEuler1D,exactRiemannStar,exactRiemannSample,riemannL1Error,observedOrder,SOD} from '../src/euler-1d-riemann.js';

test('exact Riemann solver reproduces the published Sod star state (Toro table 4.2)',()=>{
 const s=exactRiemannStar(SOD.left,SOD.right);assert.ok(Math.abs(s.pressure-.30313)<1e-5&&Math.abs(s.velocity-.92745)<1e-5);
 const behindShock=exactRiemannSample(SOD.left,SOD.right,1.6),behindContact=exactRiemannSample(SOD.left,SOD.right,.5);
 assert.ok(Math.abs(behindShock.density-.26557)<1e-5&&Math.abs(behindContact.density-.42632)<1e-5);
});

test('HLLC and HLLE converge to the Sod solution with conservation to round-off',()=>{
 for(const flux of ['hllc','hlle']){const errors=[100,200,400,800].map(cells=>{const r=solveEuler1D({cells,...SOD,endTime:.2,flux});
   assert.equal(r.phases,1);assert.ok(r.minDensity>0&&r.minPressure>0);for(const v of r.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-13,flux+' imbalance '+v);
   return riemannL1Error(r,SOD.left,SOD.right).density;});
  for(let i=1;i<errors.length;i++){const p=observedOrder(errors[i-1],errors[i]);assert.ok(p>.5&&p<1.05,flux+' L1 density order '+p);}
  assert.ok(errors.at(-1)<5e-3,flux+' N=800 L1 '+errors.at(-1));}
 const c=riemannL1Error(solveEuler1D({cells:400,...SOD,endTime:.2}),SOD.left,SOD.right).density,e=riemannL1Error(solveEuler1D({cells:400,...SOD,endTime:.2,flux:'hlle'}),SOD.left,SOD.right).density;
 assert.ok(c<e,'HLLC resolves the contact better than HLLE');
});

test('reflective walls conserve mass and energy exactly; strong rarefaction stays positive',()=>{
 const w=solveEuler1D({cells:200,...SOD,endTime:.5,boundary:'reflective'});
 assert.equal(w.conservation.boundaryInflow[0],0);assert.equal(w.conservation.boundaryInflow[2],0);
 for(const v of w.conservation.relativeImbalance)assert.ok(Math.abs(v)<1e-13);
 const t2={left:{density:1,velocity:-2,pressure:.4},right:{density:1,velocity:2,pressure:.4}},r=solveEuler1D({cells:400,...t2,endTime:.15});
 assert.ok(r.minDensity>0&&r.minPressure>0);assert.ok(riemannL1Error(r,t2.left,t2.right).density<.02);
});

test('invalid inputs, vacuum data, step limit and budget throw instead of returning',()=>{
 assert.throws(()=>solveEuler1D({cells:3,...SOD,endTime:.2}));
 assert.throws(()=>solveEuler1D({cells:100,left:{density:-1,velocity:0,pressure:1},right:SOD.right,endTime:.2}));
 assert.throws(()=>solveEuler1D({cells:100,...SOD,endTime:.2,flux:'roe'}));
 assert.throws(()=>solveEuler1D({cells:100,...SOD,endTime:.2,maxSteps:5}),/step limit/);
 assert.throws(()=>solveEuler1D({cells:100,...SOD,endTime:.2,timeBudgetMs:-1}),/time budget/);
 assert.throws(()=>exactRiemannStar({density:1,velocity:-10,pressure:.1},{density:1,velocity:10,pressure:.1}),/vacuum/);
});
