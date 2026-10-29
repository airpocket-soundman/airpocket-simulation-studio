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

// Shear-plate channel fluid: profile u_j at y=(j+1/2)hy, bottom wall fixed, top wall = plate.
export function channelShearFluid({cellsY,height,density,kinematicViscosity,cellsX=4,length=height}){
  if(!Number.isInteger(cellsY)||cellsY<4)throw Error('Shear-plate FSI requires an integer cellsY >= 4');
  if(![height,density,kinematicViscosity,length].every(finitePositive))throw Error('Shear-plate FSI requires positive height, density, viscosity and length');
  const hy=height/cellsY,mu=density*kinematicViscosity,hx=length/cellsX,
    stableDt=2.512745327/(4*kinematicViscosity*(1/(hx*hx)+1/(hy*hy)));
  const shearOnPlate=(profile,V)=>-mu*(V-profile[cellsY-1])/(hy/2);
  const kineticEnergy=(profile)=>density*hy*profile.reduce((s,u)=>s+u*u,0)/2;
  // Discrete viscous dissipation per unit area: interior faces plus both half-cell wall gradients.
  const dissipation=(profile,V)=>{let s=2*profile[0]**2/hy+2*(V-profile[cellsY-1])**2/hy;
    for(let j=0;j+1<cellsY;j++)s+=(profile[j+1]-profile[j])**2/hy;return mu*s;};
  // One fluid step of length dt with the wall velocity V held constant; returns the new profile and x-uniformity.
  const advance=(profile,V,dt)=>{
    const substeps=Math.max(1,Math.ceil(dt/(.5*stableDt))),
      r=solveChannelUnsteadyNS({cellsX,cellsY,length,height,kinematicViscosity,endTime:dt,fixedTimeStep:dt/substeps,topVelocity:V,
        initialVelocity:(x,y)=>[profile[Math.min(cellsY-1,Math.max(0,Math.round(y/hy-.5)))]??0,0]});
    const next=new Float64Array(cellsY);let spread=0;
    for(let j=0;j<cellsY;j++){next[j]=r.u[j*cellsX];for(let i=1;i<cellsX;i++)spread=Math.max(spread,Math.abs(r.u[j*cellsX+i]-next[j]));}
    return {profile:next,xSpread:spread,substeps};};
  return {cellsY,hy,mu,density,kinematicViscosity,stableDt,shearOnPlate,kineticEnergy,dissipation,advance};
}

// Partitioned march. Returns time history (plate state, fluid KE, cumulative dissipation, energy defect) and iterations.
export function runShearPlateCoupled({fluid,plate,initialDisplacement=0,initialProfile,dt,steps,...options}){
  if(!finitePositive(dt)||!Number.isInteger(steps)||steps<1)throw Error('Shear-plate FSI requires a positive dt and an integer step count');
  if(!plate||!finitePositive(plate.mass)||!(Number.isFinite(plate.stiffness)&&plate.stiffness>=0))throw Error('Shear-plate FSI requires a positive plate mass and non-negative stiffness');
  const structure=diagonalStructure({mass:[plate.mass],stiffness:[plate.stiffness]});
  let profile=initialProfile?Float64Array.from(initialProfile):new Float64Array(fluid.cellsY);
  if(profile.length!==fluid.cellsY||!profile.every(Number.isFinite))throw Error('Shear-plate FSI requires a finite initial profile of length cellsY');
  let state={d:[initialDisplacement],v:[0],a:[(-plate.stiffness*initialDisplacement+fluid.shearOnPlate(profile,0))/plate.mass]};
  const plateEnergy=s=>plate.mass*s.v[0]**2/2+plate.stiffness*s.d[0]**2/2;
  const E0=plateEnergy(state)+fluid.kineticEnergy(profile);
  let dissipated=0,Dprev=fluid.dissipation(profile,0),maxXSpread=0;
  const history=[{t:0,d:state.d[0],v:state.v[0],fluidEnergy:fluid.kineticEnergy(profile),plateEnergy:plateEnergy(state),dissipated:0,energyDefect:0}],iterations=[];
  for(let n=0;n<steps;n++){
    const start=state,cache=new Map();
    const stepFluid={n:1,force:(kin)=>{const V=(kin.d[0]-start.d[0])/dt,key=kin.d[0];
      if(!cache.has(key))cache.set(key,{V,...fluid.advance(profile,V,dt)});
      const c=cache.get(key);return [fluid.shearOnPlate(c.profile,kin.v[0])];}};
    const step=coupledStepVector({fluid:stepFluid,structure,state:start,dt,...options});
    if(!step.converged)return {converged:false,failedStep:n,reason:step.reason,residuals:step.residuals,history,iterations};
    const c=cache.get(step.state.d[0]);profile=c.profile;maxXSpread=Math.max(maxXSpread,c.xSpread);
    // Trapezoidal dissipation over the step with the step's constant wall velocity on both ends.
    const D=fluid.dissipation(profile,c.V);dissipated+=dt*(Dprev+D)/2;Dprev=D;
    state=step.state;iterations.push(step.iterations);
    const fe=fluid.kineticEnergy(profile),pe=plateEnergy(state);
    history.push({t:(n+1)*dt,d:state.d[0],v:state.v[0],fluidEnergy:fe,plateEnergy:pe,dissipated,energyDefect:(fe+pe+dissipated-E0)/E0,
      forceOnPlate:step.forceOnStructure[0],forceOnFluid:step.forceOnFluid[0]});
  }
  return {converged:true,history,iterations,profile,maxXSpread,initialEnergy:E0};
}

// Monolithic reference: the same semi-discrete system (fluid u_j with ghost-cell walls + plate x, v) integrated by RK4.
export function shearPlateMonolithicReference({fluid,plate,initialDisplacement=0,endTime,h}){
  const ny=fluid.cellsY,nu=fluid.kinematicViscosity,hy=fluid.hy,c=nu/(hy*hy),N=ny+2;
  const f=(y,out)=>{const V=y[ny+1];
    for(let j=0;j<ny;j++){const s=j>0?y[j-1]:-y[0],t=j<ny-1?y[j+1]:2*V-y[ny-1];out[j]=c*(s+t-2*y[j]);}
    out[ny]=V;out[ny+1]=(-plate.stiffness*y[ny]+fluid.shearOnPlate(y,V))/plate.mass;};
  const steps=Math.ceil(endTime/h),dt=endTime/steps,y=new Float64Array(N);y[ny]=initialDisplacement;
  const k=[0,1,2,3].map(()=>new Float64Array(N)),tmp=new Float64Array(N),samples=[{t:0,d:y[ny],v:0}];
  for(let n=0;n<steps;n++){
    f(y,k[0]);for(let i=0;i<N;i++)tmp[i]=y[i]+dt/2*k[0][i];f(tmp,k[1]);
    for(let i=0;i<N;i++)tmp[i]=y[i]+dt/2*k[1][i];f(tmp,k[2]);for(let i=0;i<N;i++)tmp[i]=y[i]+dt*k[2][i];f(tmp,k[3]);
    for(let i=0;i<N;i++)y[i]+=dt/6*(k[0][i]+2*k[1][i]+2*k[2][i]+k[3][i]);
    samples.push({t:(n+1)*dt,d:y[ny],v:y[ny+1]});}
  return {samples,dt,profile:y.slice(0,ny)};
}
