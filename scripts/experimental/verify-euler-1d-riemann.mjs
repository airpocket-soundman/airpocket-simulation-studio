// Writes the CFD3 work-order 87 evidence (1D Euler FV against the exact Riemann solution) to stdout as JSON.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import os from 'node:os';
import {solveEuler1D,exactRiemannStar,riemannL1Error,observedOrder,SOD} from '../../src/euler-1d-riemann.js';

const sha=p=>createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
const timed=f=>{const t=performance.now(),r=f();return [r,performance.now()-t];};
function series(name,states,endTime,flux,cellsList,boundary='transmissive'){const rows=cellsList.map(cells=>{const [r,ms]=timed(()=>solveEuler1D({cells,...states,endTime,flux,boundary}));
  return {cells,steps:r.steps,l1Error:riemannL1Error(r,states.left,states.right),minDensity:r.minDensity,minPressure:r.minPressure,conservation:r.conservation,wallMilliseconds:+ms.toFixed(1)};});
 for(let i=1;i<rows.length;i++)rows[i].observedL1DensityOrderVsPrevious=observedOrder(rows[i-1].l1Error.density,rows[i].l1Error.density);
 return {case:name,flux,boundary,endTime,cfl:.9,rows};}
const toro2={left:{density:1,velocity:-2,pressure:.4},right:{density:1,velocity:2,pressure:.4}};
const N=[100,200,400,800,1600];
console.log(JSON.stringify({workOrder:'87-CFD3',task:'CFD3',date:'2026-10-28',
 baseSha:execSync('git merge-base HEAD origin/main').toString().trim(),
 inputs:{solver:{path:'src/euler-1d-riemann.js',sha256:sha('src/euler-1d-riemann.js')},script:{path:'scripts/experimental/verify-euler-1d-riemann.mjs',sha256:sha('scripts/experimental/verify-euler-1d-riemann.mjs')},synthetic:true,domain:'[0,1], interface x=0.5, ideal gas gamma=1.4, nondimensional'},
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},
 command:'node scripts/experimental/verify-euler-1d-riemann.mjs',
 exactStar:{sod:exactRiemannStar(SOD.left,SOD.right),toroTest2:exactRiemannStar(toro2.left,toro2.right),referenceSodToroTable4_2:{pressure:.30313,velocity:.92745}},
 convergence:[series('sod t=0.2',SOD,.2,'hllc',N),series('sod t=0.2',SOD,.2,'hlle',N),series('toro test 2 (123 rarefaction) t=0.15',toro2,.15,'hllc',N)],
 walls:series('sod reflective walls t=0.5 (after wall reflection; L1 vs unbounded exact is not meaningful)',SOD,.5,'hllc',[200],'reflective'),
 notVerified:['multiphase / interface capturing (not implemented)','2D/3D compressible flow','higher-order reconstruction, limiters, multi-stage time integration','viscous Navier-Stokes terms, real-gas EOS','wedge / blunt-body / Mach 2 references','SU2 or other OSS comparison runs','GUI, API, MCP, worker integration','browser runtime measurement'],
 claims:'1D single-phase inviscid ideal-gas first-order FV kernel verified against exact Riemann solutions only; does not complete CFD3.'},null,1));
