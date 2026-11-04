import test from 'node:test';
import assert from 'node:assert/strict';
import {solveEuler2DMuscl,EULER_2D_LIMITS} from '../src/euler-2d-muscl.js';

const state={density:1.7,velocityX:.35,velocityY:-.2,pressure:2.3};
const base={nx:8,ny:8,endTime:.001,initial:()=>state};

test('Euler admission rejects unbounded inputs before initial-data callbacks or grid allocation',()=>{
 let calls=0;const initial=()=>{calls++;return state;};
 for(const bad of [{nx:4096,ny:4096},{gamma:Infinity},{maxSteps:NaN},{maxSteps:Infinity},
  {maxSteps:1.5},{maxSteps:0},{maxSteps:EULER_2D_LIMITS.maxSteps+1},
  {timeBudgetMs:NaN},{timeBudgetMs:Infinity},{timeBudgetMs:0},{timeBudgetMs:600001},
  {limiter:'constructor'},{limiter:'toString'},{flux:'constructor'},
  {lengthX:Number.MIN_VALUE},{lengthX:1e308,lengthY:1e308}]){
  assert.throws(()=>solveEuler2DMuscl({...base,initial,...bad}),undefined,JSON.stringify(bad));
  assert.equal(calls,0,'invalid admission must not execute user initial data');
 }
});

test('Euler rejects nonfinite conserved overrides instead of allowing infinite output or stalled time',()=>{
 for(const bad of [{mass:Infinity},{mass:0},{energy:Infinity},{xMomentum:NaN},{yMomentum:Infinity}]){
  assert.throws(()=>solveEuler2DMuscl({...base,initial:()=>({...state,...bad})}),/initial conserved/);
 }
 // Finite primitive data can overflow during conversion or acoustic-speed evaluation.
 assert.throws(()=>solveEuler2DMuscl({...base,initial:()=>({...state,velocityX:1e308})}),/initial conserved/);
 assert.throws(()=>solveEuler2DMuscl({...base,initial:()=>({...state,density:1e-300,pressure:1e300})}),/CFL wave rate/);
 assert.throws(()=>solveEuler2DMuscl({...base,initial:()=>({...state,density:1e308,velocityX:0,velocityY:0})}),/conserved integral/);
});

test('Euler initialization consumes the same cooperative time budget as integration',()=>{
 let calls=0;
 assert.throws(()=>solveEuler2DMuscl({...base,timeBudgetMs:1,initial:()=>{
  if(calls++===0){const until=performance.now()+5;while(performance.now()<until){}}
  return state;
 }}),/time budget exceeded/);
 assert.ok(calls<=base.nx,'stops at the next initialization row boundary');
});

test('both Euler fluxes preserve an anisotropic uniform moving state and its four analytic totals',()=>{
 for(const flux of ['hllc','hlle'])for(const order of [1,2])for(const boundary of ['periodic','transmissive']){
  const r=solveEuler2DMuscl({...base,nx:7,ny:11,lengthX:2,lengthY:3,flux,order,boundary});
  const {density:rho,velocityX:u,velocityY:v,pressure:p}=state;
  const exact=[rho,rho*u,rho*v,p/.4+rho*(u*u+v*v)/2].map(x=>x*6);
  for(let k=0;k<4;k++)assert.ok(Math.abs(r.conservation.final[k]-exact[k])<1e-12);
  for(let i=0;i<77;i++)for(const [key,value] of Object.entries(state))assert.ok(Math.abs(r[key][i]-value)<1e-14);
  assert.equal(r.time,base.endTime);
 }
});
