// Writes the CFD2 work-order 84 evidence (wall-bounded transient NS against exact startup solutions) to stdout as JSON.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import os from 'node:os';
import {solveChannelUnsteadyNS as solve,startupCouetteExact,startupPoiseuilleExact,channelVelocityError} from '../../src/unsteady-ns-channel.js';
import {observedOrder} from '../../src/unsteady-ns-periodic.js';

const sha=p=>createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex');
const timed=f=>{const t=performance.now(),r=f();return [r,performance.now()-t];};
const nu=.1,endTime=1,rest=()=>[0,0];
function series(name,drive,exact){const rows=[8,16,32,64,128].map(cellsY=>{const [r,ms]=timed(()=>solve({cellsX:8,cellsY,kinematicViscosity:nu,initialVelocity:rest,endTime,...drive}));const e=channelVelocityError(r,exact),last=r.history.at(-1);
  return {cellsX:8,cellsY,steps:r.steps,timeStep:r.timeStep,maxViscousNumberUsed:r.stability.maxViscousNumberUsed,relativeL2UError:e.relativeL2,maxAbsV:e.maxAbsV,maxAbsDivergenceAllSteps:Math.max(...r.history.map(h=>h.maxAbsDivergence)),maxFlowRateSpreadAllSteps:Math.max(...r.history.map(h=>h.flowRateSpread)),finalFlowRate:last.flowRate,wallMilliseconds:+ms.toFixed(1)};});
 for(let i=1;i<rows.length;i++)rows[i].observedOrderVsPrevious=observedOrder(rows[i-1].relativeL2UError,rows[i].relativeL2UError);
 return {case:name,kinematicViscosity:nu,height:1,endTime,drive,rows};}
const disturbed=solve({cellsX:32,cellsY:32,kinematicViscosity:.01,endTime:2,initialVelocity:(x,y)=>[Math.sin(x)*Math.sin(Math.PI*y)+.5*Math.cos(2*x)*y*(1-y),Math.cos(x)*Math.sin(2*Math.PI*y)]});
const at=dt=>solve({cellsX:4,cellsY:16,kinematicViscosity:nu,initialVelocity:rest,endTime,bodyForce:1,fixedTimeStep:dt}),ref=at(.00125);
const temporal=[.01,.005,.0025].map(dt=>{const r=at(dt);let m=0;for(let k=0;k<r.u.length;k++)m=Math.max(m,Math.abs(r.u[k]-ref.u[k]));return {fixedTimeStep:dt,maxAbsUDifferenceVsDt000125:m};});
for(let i=1;i<temporal.length;i++)temporal[i].observedOrderVsPrevious=Math.log2(temporal[i-1].maxAbsUDifferenceVsDt000125/temporal[i].maxAbsUDifferenceVsDt000125);
const stabBase={cellsX:32,cellsY:32,kinematicViscosity:nu,bodyForce:1,initialVelocity:(x,y)=>[.1*Math.sin(x)*Math.sin(Math.PI*y)+1e-3*Math.sin(37*x+50*y),0]};
const limit=solve({...stabBase,initialVelocity:rest,endTime:.01}).stability.viscousStableTimeStep;
const stability=[.98,1.05].map(factor=>{try{const r=solve({...stabBase,endTime:limit*factor*600,fixedTimeStep:limit*factor,allowUnstableTimeStep:true});return {factor,steps:r.steps,finalMaxVelocityComponent:r.history.at(-1).maxVelocityComponent,outcome:'bounded'};}catch(e){return {factor,outcome:'diverged',message:e.message};}});
let guard;try{solve({...stabBase,endTime:1,fixedTimeStep:limit*1.05});guard='accepted';}catch(e){guard=e.message;}
console.log(JSON.stringify({workOrder:'84-CFD2',task:'CFD2',date:'2026-10-28',
 baseSha:execSync('git merge-base HEAD origin/main').toString().trim(),
 inputs:{solver:{path:'src/unsteady-ns-channel.js',sha256:sha('src/unsteady-ns-channel.js')},script:{path:'scripts/experimental/verify-unsteady-ns-channel.mjs',sha256:sha('scripts/experimental/verify-unsteady-ns-channel.mjs')},synthetic:true,domain:'[0,2pi) x [0,1], periodic x, no-slip walls y=0,1, nondimensional'},
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},
 command:'node scripts/experimental/verify-unsteady-ns-channel.mjs',
 spatial:[series('startup Couette (top wall U=1)',{topVelocity:1},startupCouetteExact(nu,endTime)),series('startup Poiseuille (body force G=1)',{bodyForce:1},startupPoiseuilleExact(nu,endTime))],
 nonlinearDisturbance:{case:'2D disturbance between resting walls nu=0.01 32x32 t=2',initialMaxAbsDivergence:disturbed.initialMaxAbsDivergence,steps:disturbed.steps,maxAbsDivergenceAllSteps:Math.max(...disturbed.history.map(h=>h.maxAbsDivergence)),maxFlowRateSpreadAllSteps:Math.max(...disturbed.history.map(h=>h.flowRateSpread)),kineticEnergyMonotonicDecay:disturbed.history.every((h,i)=>i===0||h.kineticEnergy<disturbed.history[i-1].kineticEnergy),initialKineticEnergy:disturbed.history[0].kineticEnergy,finalKineticEnergy:disturbed.history.at(-1).kineticEnergy,referenceSolution:'none (conservation checks only)'},
 temporal:{case:'startup Poiseuille 4x16 fixed dt self-convergence',rows:temporal},
 stability:{viscousStableTimeStep:limit,formula:'2.5127/(4 nu (1/hx^2+1/hy^2))',guardAt1p05:guard,runsWithGuardDisabled600Steps:stability},
 notVerified:['inflow-outflow boundaries','nonlinear wall-bounded flow against a reference solution (only conservation checks)','advective CFL limit sharpness','3D','unstructured or curved meshes','turbulence models (none implemented)','vortex shedding / Strouhal against reference','GUI, API, MCP, worker integration','browser runtime measurement'],
 claims:'Laminar wall-bounded transient NS kernel verified against exact startup Couette/Poiseuille solutions only; does not complete CFD2.'},null,1));
