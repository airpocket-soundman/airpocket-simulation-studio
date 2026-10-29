// Writes the CFD3 work-order 94 evidence (second-order MUSCL + SSP-RK2 1D Euler) to stdout as JSON.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import os from 'node:os';
import {solveEuler1DMuscl,densityWaveAverages,densityWaveL1Error,riemannInitial,riemannL1DensityError} from '../../src/euler-1d-muscl.js';
import {SOD,observedOrder} from '../../src/euler-1d-riemann.js';

const sha=p=>createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
const timed=f=>{const t=performance.now(),r=f();return [r,performance.now()-t];};
function series(name,make,error,cellsList,opts){const rows=cellsList.map(cells=>{const [r,ms]=timed(()=>solveEuler1DMuscl({cells,initial:make(),...opts}));
  return {cells,steps:r.steps,l1DensityError:error(r),minDensity:r.minDensity,minPressure:r.minPressure,conservation:r.conservation,wallMilliseconds:+ms.toFixed(1)};});
 for(let i=1;i<rows.length;i++)rows[i].observedL1DensityOrderVsPrevious=observedOrder(rows[i-1].l1DensityError,rows[i].l1DensityError);
 return {case:name,order:opts.order??2,limiter:opts.limiter??'minmod',flux:opts.flux??'hllc',boundary:opts.boundary,endTime:opts.endTime,cfl:opts.cfl??.45,rows};}
const wave={amplitude:.2,velocity:1,pressure:1},toro2={left:{density:1,velocity:-2,pressure:.4},right:{density:1,velocity:2,pressure:.4}};
const W=[32,64,128,256,512],N=[100,200,400,800,1600];
const waveCase=(order,limiter)=>series('periodic density wave, one period t=1',()=>densityWaveAverages(wave),r=>densityWaveL1Error(r,wave),W,{endTime:1,order,limiter,boundary:'periodic'});
const tube=(name,s,t,order,limiter)=>series(name,()=>riemannInitial(s.left,s.right),r=>riemannL1DensityError(r,s.left,s.right),N,{endTime:t,order,limiter,boundary:'transmissive'});
console.log(JSON.stringify({workOrder:'94-CFD3',task:'CFD3',date:'2026-10-29',
 baseSha:execSync('git merge-base HEAD origin/main').toString().trim(),
 inputs:{solver:{path:'src/euler-1d-muscl.js',sha256:sha('src/euler-1d-muscl.js')},sharedFluxes:{path:'src/euler-1d-riemann.js',sha256:sha('src/euler-1d-riemann.js')},script:{path:'scripts/experimental/verify-euler-1d-muscl.mjs',sha256:sha('scripts/experimental/verify-euler-1d-muscl.mjs')},
  synthetic:true,domain:'[0,1], ideal gas gamma=1.4, nondimensional; density wave rho=1+0.2 sin(2 pi x), u=1, p=1 (exact cell averages)'},
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},
 command:'node scripts/experimental/verify-euler-1d-muscl.mjs',
 smoothConvergence:[waveCase(1,'none'),waveCase(2,'none'),waveCase(2,'minmod'),waveCase(2,'vanleer')],
 shockTubes:[tube('sod t=0.2',SOD,.2,1,'minmod'),tube('sod t=0.2',SOD,.2,2,'minmod'),tube('sod t=0.2',SOD,.2,2,'vanleer'),tube('toro test 2 (123 rarefaction) t=0.15',toro2,.15,2,'minmod')],
 walls:series('sod reflective walls t=0.5 (after reflection; L1 vs unbounded exact not meaningful)',()=>riemannInitial(SOD.left,SOD.right),r=>riemannL1DensityError(r,SOD.left,SOD.right),[200],{endTime:.5,boundary:'reflective'}),
 notVerified:['multiphase / interface capturing (not implemented)','2D/3D compressible flow (incl. isentropic vortex, wedge shock angle)','characteristic-variable limiting, WENO, order >2','viscous terms, real-gas EOS','SU2 or other OSS comparison runs','GUI, API, MCP, worker integration','browser runtime measurement'],
 claims:'1D single-phase inviscid ideal-gas second-order (MUSCL + SSP-RK2) FV kernel; second order verified on a smooth exact solution only; does not complete CFD3.'},null,1));
