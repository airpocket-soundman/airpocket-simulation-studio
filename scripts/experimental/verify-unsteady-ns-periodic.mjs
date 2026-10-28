// Writes the CFD2 work-order 75 evidence (periodic transient NS against exact solutions) to stdout as JSON.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import os from 'node:os';
import {solvePeriodicUnsteadyNS as solve,taylorGreenExact,shearWaveExact,velocityError,observedOrder} from '../../src/unsteady-ns-periodic.js';

const sha=p=>createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
const timed=f=>{const t=performance.now(),r=f();return [r,performance.now()-t];};
function series(name,nu,exact,endTime,cellsList,extra={}){const rows=cellsList.map(cells=>{const [r,ms]=timed(()=>solve({cells,kinematicViscosity:nu,initialVelocity:exact(0),endTime}));const last=r.history.at(-1);
  return {cells,steps:r.steps,timeStep:r.timeStep,relativeL2VelocityError:velocityError(r,exact(endTime)),maxAbsDivergenceAllSteps:Math.max(...r.history.map(h=>h.maxAbsDivergence)),finalMeanVelocity:last.meanVelocity,finalKineticEnergy:last.kineticEnergy,...(extra.energy?{exactKineticEnergy:extra.energy(endTime),kineticEnergyRelativeError:last.kineticEnergy/extra.energy(endTime)-1}:{}),wallMilliseconds:+ms.toFixed(1)};});
 for(let i=1;i<rows.length;i++)rows[i].observedOrderVsPrevious=observedOrder(rows[i-1].relativeL2VelocityError,rows[i].relativeL2VelocityError);
 return {case:name,kinematicViscosity:nu,endTime,rows};}
const tg=nu=>series('taylor-green-2d nu='+nu,nu,t=>taylorGreenExact(nu,t),1,[16,32,64,128],{energy:t=>Math.PI**2*Math.exp(-4*nu*t)});
const run=dt=>solve({cells:32,kinematicViscosity:.01,initialVelocity:taylorGreenExact(.01,0),endTime:1,fixedTimeStep:dt}),ref=run(.0125);
const temporal=[.1,.05,.025].map(dt=>{const r=run(dt);let m=0;for(let k=0;k<r.u.length;k++)m=Math.max(m,Math.abs(r.u[k]-ref.u[k]));return {fixedTimeStep:dt,maxAbsUDifferenceVsDt0125:m};});
for(let i=1;i<temporal.length;i++)temporal[i].observedOrderVsPrevious=Math.log2(temporal[i-1].maxAbsUDifferenceVsDt0125/temporal[i].maxAbsUDifferenceVsDt0125);
console.log(JSON.stringify({workOrder:'75-CFD2',task:'CFD2',date:'2026-10-28',
 baseSha:execSync('git merge-base HEAD origin/main').toString().trim(),
 inputs:{solver:{path:'src/unsteady-ns-periodic.js',sha256:sha('src/unsteady-ns-periodic.js')},script:{path:'scripts/experimental/verify-unsteady-ns-periodic.mjs',sha256:sha('scripts/experimental/verify-unsteady-ns-periodic.mjs')},synthetic:true,domain:'[0,2pi)^2 doubly periodic, nondimensional'},
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},
 command:'node scripts/experimental/verify-unsteady-ns-periodic.mjs',
 spatial:[tg(.01),tg(.001),series('viscous-shear-wave k=2',.1,t=>shearWaveExact(.1,t,2),1,[16,32,64,128])],
 temporal:{case:'taylor-green-2d nu=0.01 cells=32 fixed dt self-convergence',rows:temporal},
 notVerified:['walls / no-slip boundaries and inflow-outflow','3D','unstructured or curved meshes','turbulence models (none implemented)','vortex shedding / Strouhal against reference','GUI, API, MCP, worker integration','browser runtime measurement'],
 claims:'Laminar periodic transient NS kernel verified against exact solutions only; does not complete CFD2.'},null,1));
