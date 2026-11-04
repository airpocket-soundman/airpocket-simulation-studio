// Partitioned coupling of the CFD2 transient channel solver (unsteady-ns-channel.js, unchanged) with a spring-mass plate
// that forms the moving top wall (COUPLE5 third step, coupling layer only). The plate slides tangentially, so the fluid
// mesh never moves (no ALE): the plate displacement guess d^{n+1} fixes the wall velocity V=(d^{n+1}-d^n)/dt held over
// the fluid step, the fluid returns the wall shear on the plate, and the plate is solved with the same Newmark
// (beta=1/4, gamma=1/2) kinematics through fsi-interface-vector.js (vector Aitken, early divergence rejection).
// Per unit wall area: plate mass m [kg/m^2], spring k [N/m^3], shear on plate F=-mu (V-u_top)/(hy/2) [Pa] — the same
// ghost-cell wall gradient the solver uses, so the semi-discrete energy identity dKE/dt = -D + V tau holds exactly.
// The reference is the monolithic semi-discrete ODE of the same grid (fluid columns + plate) integrated by fine RK4.
// Laminar u(y) states only (x-uniform, v=0); verification kernel, not wired into worker, MCP or UI.

import {solveChannelUnsteadyNS} from './unsteady-ns-channel.js';
import {diagonalStructure,coupledStepVector} from './fsi-interface-vector.js';

const finitePositive=v=>Number.isFinite(v)&&v>0;
export const SHEAR_PLATE_LIMITS=Object.freeze({cellsX:256,cellsY:512,coupledSteps:20000,iterations:200,fluidSubsteps:20000,fluidWork:20000000,referenceSteps:500000,referenceWork:10000000});
const configurations=new WeakMap();
const reject=message=>{throw Error('Shear-plate FSI '+message);};
const finite=(value,name)=>{if(!Number.isFinite(value))reject('requires finite '+name);return value;};
function requireFluid(fluid){if(!configurations.has(fluid))reject('requires a fluid issued by channelShearFluid; reload its parameters, not serialized methods');return configurations.get(fluid);}
function requirePlate(plate){if(!plate||!finitePositive(plate.mass)||!Number.isFinite(plate.stiffness)||plate.stiffness<0)reject('requires a positive plate mass and non-negative stiffness');}
function profileSnapshot(input,n){
  if(input===undefined)return new Float64Array(n);
  if(!(Array.isArray(input)||input instanceof Float64Array)||input.length!==n)reject('requires a finite initial profile of length cellsY');
  const copy=Float64Array.from(input);if(!copy.every(Number.isFinite))reject('requires a finite initial profile of length cellsY');return copy;
}
const substepCount=(fluid,dt)=>{const n=Math.max(1,Math.ceil(dt/(.5*fluid.stableDt)));if(!Number.isSafeInteger(n)||n>SHEAR_PLATE_LIMITS.fluidSubsteps)reject('fluid substep capacity exceeded');return n;};

// Shear-plate channel fluid: profile u_j at y=(j+1/2)hy, bottom wall fixed, top wall = plate.
export function channelShearFluid({cellsY,height,density,kinematicViscosity,cellsX=4,length=height,...unknown}){
  if(Object.keys(unknown).length)reject('rejects unknown fluid parameters');
  if(!Number.isInteger(cellsY)||cellsY<4||cellsY>SHEAR_PLATE_LIMITS.cellsY)throw Error('Shear-plate FSI requires an integer cellsY between 4 and 512');
  if(!Number.isInteger(cellsX)||cellsX<4||cellsX>SHEAR_PLATE_LIMITS.cellsX||(cellsX&(cellsX-1)))reject('requires cellsX to be a power of two between 4 and 256');
  if(![height,density,kinematicViscosity,length].every(finitePositive))throw Error('Shear-plate FSI requires positive height, density, viscosity and length');
  const hy=height/cellsY,mu=density*kinematicViscosity,hx=length/cellsX,
    stableDt=2.512745327/(4*kinematicViscosity*(1/(hx*hx)+1/(hy*hy)));
  if(![hy,hx,mu,stableDt].every(finitePositive))reject('derived spacing, dynamic viscosity or stable step is outside finite range');
  const shearOnPlate=(profile,V)=>finite(-mu*(V-profile[cellsY-1])/(hy/2),'wall shear');
  const kineticEnergy=(profile)=>finite(density*hy*profile.reduce((s,u)=>s+u*u,0)/2,'fluid kinetic energy');
  // Discrete viscous dissipation per unit area: interior faces plus both half-cell wall gradients.
  const dissipation=(profile,V)=>{let s=2*profile[0]**2/hy+2*(V-profile[cellsY-1])**2/hy;
    for(let j=0;j+1<cellsY;j++)s+=(profile[j+1]-profile[j])**2/hy;return finite(mu*s,'dissipation rate');};
  // One fluid step of length dt with the wall velocity V held constant; returns the new profile and x-uniformity.
  const advance=(profile,V,dt)=>{
    if(!finitePositive(dt)||!Number.isFinite(V))reject('requires finite wall velocity and positive dt');
    if(profile===undefined)reject('requires an explicit fluid profile');
    const owned=profileSnapshot(profile,cellsY),substeps=substepCount({stableDt},dt);
    if(substeps*cellsX*cellsY>SHEAR_PLATE_LIMITS.fluidWork)reject('fluid work capacity exceeded');
    const
      r=solveChannelUnsteadyNS({cellsX,cellsY,length,height,kinematicViscosity,endTime:dt,fixedTimeStep:dt/substeps,topVelocity:V,
        initialVelocity:(x,y)=>[owned[Math.min(cellsY-1,Math.max(0,Math.round(y/hy-.5)))],0]});
    const next=new Float64Array(cellsY);let spread=0;
    for(let j=0;j<cellsY;j++){next[j]=r.u[j*cellsX];for(let i=1;i<cellsX;i++)spread=Math.max(spread,Math.abs(r.u[j*cellsX+i]-next[j]));}
    if(!next.every(Number.isFinite)||!Number.isFinite(spread))reject('fluid produced non-finite state');
    return {profile:next,xSpread:spread,substeps};};
  const parameters=Object.freeze({cellsY,height,density,kinematicViscosity,cellsX,length});
  const fluid=Object.freeze({cellsY,hy,mu,density,kinematicViscosity,stableDt,parameters,shearOnPlate,kineticEnergy,dissipation,advance});
  configurations.set(fluid,parameters);return fluid;
}

// Partitioned march. Returns time history (plate state, fluid KE, cumulative dissipation, energy defect) and iterations.
export function runShearPlateCoupled({fluid,plate,initialDisplacement=0,initialProfile,dt,steps,tolerance=1e-12,maxIterations=50,relaxation='aitken',omega0=.5,divergenceWindow=4,...unknown}){
  if(Object.keys(unknown).length)reject('rejects unknown coupling options');
  const config=requireFluid(fluid);requirePlate(plate);finite(initialDisplacement,'initial displacement');
  if(!finitePositive(dt)||!finitePositive(.25*dt*dt)||!finitePositive(1/(.25*dt*dt))||!Number.isInteger(steps)||steps<1||steps>SHEAR_PLATE_LIMITS.coupledSteps||!Number.isFinite(dt*steps))reject('requires bounded positive dt and step count');
  if(!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>SHEAR_PLATE_LIMITS.iterations)reject('iteration capacity exceeded');
  if(!finitePositive(tolerance)||!['none','constant','aitken'].includes(relaxation)||!finitePositive(omega0)||omega0>1||!Number.isInteger(divergenceWindow)||divergenceWindow<2||divergenceWindow>SHEAR_PLATE_LIMITS.iterations)reject('invalid coupling options');
  if(steps*(maxIterations+1)*substepCount(fluid,dt)*config.cellsX*config.cellsY>SHEAR_PLATE_LIMITS.fluidWork)reject('coupled fluid work capacity exceeded');
  const structure=diagonalStructure({mass:[plate.mass],stiffness:[plate.stiffness]});
  let profile=profileSnapshot(initialProfile,fluid.cellsY);
  let state={d:[initialDisplacement],v:[0],a:[(-plate.stiffness*initialDisplacement+fluid.shearOnPlate(profile,0))/plate.mass]};
  const plateEnergy=s=>plate.mass*s.v[0]**2/2+plate.stiffness*s.d[0]**2/2;
  finite(state.a[0],'initial acceleration');
  const E0=finite(plateEnergy(state)+fluid.kineticEnergy(profile),'initial energy');
  if(E0===0&&(plate.stiffness>0&&initialDisplacement!==0||profile.some(u=>u!==0)))reject('initial energy underflows; zero diagnostic is reserved for equilibrium');
  let dissipated=0,maxXSpread=0;
  const history=[{t:0,d:state.d[0],v:state.v[0],fluidEnergy:fluid.kineticEnergy(profile),plateEnergy:plateEnergy(state),dissipated:0,energyDefect:0,energyDefectJPerM2:0}],iterations=[];
  for(let n=0;n<steps;n++){
    const start=state,cache=new Map();
    const stepFluid={n:1,force:(kin)=>{const V=(kin.d[0]-start.d[0])/dt,key=kin.d[0];
      if(!cache.has(key))cache.set(key,{V,...fluid.advance(profile,V,dt)});
      const c=cache.get(key);return [fluid.shearOnPlate(c.profile,kin.v[0])];}};
    const step=coupledStepVector({fluid:stepFluid,structure,state:start,dt,tolerance,maxIterations,relaxation,omega0,divergenceWindow});
    if(!step.converged)return {converged:false,failedStep:n,reason:step.reason,residuals:step.residuals,history,iterations};
    const c=cache.get(step.state.d[0]),Dstart=fluid.dissipation(profile,c.V);profile=c.profile;maxXSpread=Math.max(maxXSpread,c.xSpread);
    // Trapezoidal dissipation over the step with the step's constant wall velocity on both ends.
    const D=fluid.dissipation(profile,c.V);dissipated=finite(dissipated+dt*(Dstart+D)/2,'cumulative dissipation');
    state=step.state;iterations.push(step.iterations);
    const fe=finite(fluid.kineticEnergy(profile),'fluid energy'),pe=finite(plateEnergy(state),'plate energy'),defect=finite(fe+pe+dissipated-E0,'energy defect');
    const relative=E0===0?(defect===0?0:reject('nonzero energy generated from zero-energy equilibrium')):finite(defect/E0,'relative energy defect');
    history.push({t:(n+1)*dt,d:state.d[0],v:state.v[0],fluidEnergy:fe,plateEnergy:pe,dissipated,energyDefect:relative,energyDefectJPerM2:defect,
      forceOnPlate:step.forceOnStructure[0],forceOnFluid:step.forceOnFluid[0]});
  }
  return {converged:true,history,iterations,profile,maxXSpread,initialEnergy:E0};
}

// Monolithic reference: the same semi-discrete system (fluid u_j with ghost-cell walls + plate x, v) integrated by RK4.
export function shearPlateMonolithicReference({fluid,plate,initialDisplacement=0,initialProfile,endTime,h,...unknown}){
  if(Object.keys(unknown).length)reject('rejects unknown reference options');
  requireFluid(fluid);requirePlate(plate);finite(initialDisplacement,'initial displacement');
  if(!finitePositive(endTime)||!finitePositive(h))reject('reference requires finite positive endTime and h');
  const ny=fluid.cellsY,nu=fluid.kinematicViscosity,hy=fluid.hy,c=nu/(hy*hy),N=ny+2;
  const count=Math.ceil(endTime/h);
  if(!Number.isSafeInteger(count)||count>SHEAR_PLATE_LIMITS.referenceSteps||count*N>SHEAR_PLATE_LIMITS.referenceWork)reject('reference work capacity exceeded');
  // A deliberately conservative small-step precondition, not a general RK4/FSI stability certificate.
  const rate=4*c+4*fluid.mu/(plate.mass*hy)+Math.sqrt(plate.stiffness/plate.mass);
  if(!Number.isFinite(rate)||(endTime/count)*rate>.1)reject('reference step exceeds the conservative rate bound');
  const f=(y,out)=>{const V=y[ny+1];
    for(let j=0;j<ny;j++){const s=j>0?y[j-1]:-y[0],t=j<ny-1?y[j+1]:2*V-y[ny-1];out[j]=c*(s+t-2*y[j]);}
    out[ny]=V;out[ny+1]=(-plate.stiffness*y[ny]+fluid.shearOnPlate(y,V))/plate.mass;};
  const steps=count,dt=endTime/steps,y=new Float64Array(N);y.set(profileSnapshot(initialProfile,ny));y[ny]=initialDisplacement;
  const k=[0,1,2,3].map(()=>new Float64Array(N)),tmp=new Float64Array(N),samples=[{t:0,d:y[ny],v:0}];
  for(let n=0;n<steps;n++){
    f(y,k[0]);for(let i=0;i<N;i++)tmp[i]=y[i]+dt/2*k[0][i];f(tmp,k[1]);
    for(let i=0;i<N;i++)tmp[i]=y[i]+dt/2*k[1][i];f(tmp,k[2]);for(let i=0;i<N;i++)tmp[i]=y[i]+dt*k[2][i];f(tmp,k[3]);
    for(let i=0;i<N;i++)y[i]+=dt/6*(k[0][i]+2*k[1][i]+2*k[2][i]+k[3][i]);
    if(!y.every(Number.isFinite))reject('reference produced non-finite state');
    samples.push({t:(n+1)*dt,d:y[ny],v:y[ny+1]});}
  return {samples,dt,profile:y.slice(0,ny)};
}
