// Writes the CFD3 work-order 99 evidence (unsplit 2D MUSCL + SSP-RK2 Euler) to stdout as JSON.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import os from 'node:os';
import {solveEuler2DMuscl,isentropicVortexAverages,vortexL1DensityError,LAX_LIU_CONFIG3,quadrantInitial} from '../../src/euler-2d-muscl.js';
import {observedOrder} from '../../src/euler-1d-riemann.js';

const sha=p=>createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
const timed=f=>{const t=performance.now(),r=f();return [r,performance.now()-t];};
const transposeAsymmetry=r=>{let a=0;for(let j=0;j<r.ny;j++)for(let i=0;i<r.nx;i++)a=Math.max(a,Math.abs(r.density[i+r.nx*j]-r.density[j+r.nx*i]));return a;};
function vortex(endTime,order,limiter,sizes){const rows=sizes.map(n=>{const [r,ms]=timed(()=>solveEuler2DMuscl({nx:n,ny:n,lengthX:10,lengthY:10,initial:isentropicVortexAverages(),endTime,order,limiter,timeBudgetMs:6e5}));
  return {cells:n+'x'+n,steps:r.steps,l1DensityError:vortexL1DensityError(r),minDensity:r.minDensity,minPressure:r.minPressure,conservation:r.conservation,wallMilliseconds:+ms.toFixed(1)};});
 for(let i=1;i<rows.length;i++)rows[i].observedL1DensityOrderVsPrevious=observedOrder(rows[i-1].l1DensityError,rows[i].l1DensityError);
 return {case:'isentropic vortex, strength 5, stream (1,1), periodic [0,10]^2, t='+endTime,order,limiter,flux:'hllc',cfl:.45,rows};}
function riemann(boundary,n){const [r,ms]=timed(()=>solveEuler2DMuscl({nx:n,ny:n,initial:quadrantInitial(LAX_LIU_CONFIG3),endTime:.3,boundary,timeBudgetMs:6e5}));
 return {case:'Lax-Liu configuration 3, [0,1]^2, t=0.3',boundary,cells:n+'x'+n,limiter:'minmod',flux:'hllc',steps:r.steps,minDensity:r.minDensity,minPressure:r.minPressure,diagonalTransposeAsymmetry:transposeAsymmetry(r),conservation:r.conservation,wallMilliseconds:+ms.toFixed(1)};}
const S=[16,32,64,128];
console.log(JSON.stringify({workOrder:'99-CFD3',task:'CFD3',date:'2026-10-29',
 baseSha:execSync('git merge-base HEAD origin/main').toString().trim(),
 inputs:{solver:{path:'src/euler-2d-muscl.js',sha256:sha('src/euler-2d-muscl.js')},sharedFluxes:{path:'src/euler-1d-riemann.js',sha256:sha('src/euler-1d-riemann.js')},script:{path:'scripts/experimental/verify-euler-2d-muscl.mjs',sha256:sha('scripts/experimental/verify-euler-2d-muscl.mjs')},
  synthetic:true,domain:'ideal gas gamma=1.4, nondimensional; vortex cell averages by 4x4 Gauss quadrature, minimum-image periodic distance'},
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},
 command:'node scripts/experimental/verify-euler-2d-muscl.mjs',
 smoothConvergence:[vortex(2,1,'none',S),vortex(2,2,'none',S),vortex(2,2,'minmod',S),vortex(2,2,'vanleer',S),vortex(10,2,'none',[16,32,64])],
 riemann2d:[riemann('transmissive',100),riemann('transmissive',200),riemann('reflective',200)],
 notVerified:['oblique / wedge shock angle (no immersed or body-fitted walls yet)','3D compressible flow','multiphase / interface capturing (not implemented)','characteristic limiting, WENO, order >2','viscous terms, real-gas EOS','SU2 or other OSS comparison runs','GUI, API, MCP, worker integration','browser runtime measurement'],
 claims:'2D single-phase inviscid ideal-gas second-order unsplit FV kernel on a uniform Cartesian grid; second order verified on the isentropic vortex only; does not complete CFD3.'},null,1));
