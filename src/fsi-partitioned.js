// Partitioned two-way fluid/structure coupling contract (coupling layer only).
// Each time step runs a Dirichlet-Neumann fixed point: interface displacement -> fluid
// pressure -> structural displacement, with optional Aitken relaxation. Both fields are
// evaluated at the same t^{n+1} with the same Newmark (beta=1/4, gamma=1/2) kinematics, and the
// structure receives exactly the negative of the interface force the fluid exerts.
// Contract: SI units (m, s, kg, Pa, N, J). Single-DOF interface (piston) only.
// NOT wired into any CFD solver, worker, MCP or UI path; NOT a general FSI accuracy claim.

const BETA=.25,GAMMA=.5;

function positive(value,what){if(!(Number.isFinite(value)&&value>0))throw Error(`FSI coupling requires a finite positive ${what}`);return value;}
function finite(value,what){if(!Number.isFinite(value))throw Error(`FSI coupling requires a finite ${what}`);return value;}

// Newmark acceleration/velocity implied by a candidate displacement at t^{n+1}. Shared by both fields
// so that the fluid sees the same interface kinematics the structure will report (time synchronization).
export function newmarkKinematics(state,d,dt){
  const a=(d-state.d-dt*state.v)/(BETA*dt*dt)-(1/(2*BETA)-1)*state.a,
    v=state.v+dt*((1-GAMMA)*state.a+GAMMA*a);
  return {d,v,a};
}

// Reference fluid: piston face of area A closing a column of length L (density rho) whose linearized
// compressibility gives a pressure stiffness kappa (Pa/m) about ambient p0. Interface pressure is
// p = p0 - kappa*d - rho*L*a, i.e. added mass rho*L*A and added stiffness kappa*A on the piston.
export function pistonColumnFluid({area,length,density,kappa,p0}){
  positive(area,'area');positive(length,'length');positive(density,'density');
  if(!(Number.isFinite(kappa)&&kappa>=0))throw Error('FSI coupling requires a finite non-negative kappa');finite(p0,'ambient pressure');
  return {area,addedMass:density*length*area,addedStiffness:kappa*area,
    pressure:(kin)=>p0-kappa*kin.d-density*length*kin.a,
    storedEnergy:(d)=>.5*kappa*area*d*d,
    equilibrium:p0*area};
}

// Reference structure: piston mass m on a spring k. Given the interface force F^{n+1} it returns the
// Newmark displacement solving m a + k d = F at t^{n+1}.
export function springMassStructure({mass,stiffness}){
  positive(mass,'mass');if(!(Number.isFinite(stiffness)&&stiffness>=0))throw Error('FSI coupling requires a finite non-negative stiffness');
  return {mass,stiffness,
    solve:(state,force,dt)=>{
      const rhs=force+mass*((state.d+dt*state.v)/(BETA*dt*dt)+(1/(2*BETA)-1)*state.a);
      return rhs/(stiffness+mass/(BETA*dt*dt));
    }};
}

// One coupled step. Returns the converged state, the per-iteration interface residuals and the
// force each field applied to the other at convergence.
export function coupledStep({fluid,structure,state,dt,tolerance=1e-12,maxIterations=50,relaxation='aitken',omega0=.5}){
  positive(dt,'time step');positive(tolerance,'tolerance');
  if(!['none','aitken'].includes(relaxation))throw Error('FSI coupling rejects an unknown relaxation');
  let d=state.d+dt*state.v,omega=relaxation==='none'?1:omega0,previous=null;
  const residuals=[];
  for(let k=0;k<maxIterations;k++){
    const kin=newmarkKinematics(state,d,dt),pressure=fluid.pressure(kin),forceOnStructure=pressure*fluid.area,
      dTilde=structure.solve(state,forceOnStructure,dt),r=dTilde-d,scale=Math.max(Math.abs(dTilde),Math.abs(state.d),1e-300);
    if(!Number.isFinite(r))return {converged:false,iterations:k+1,residuals,reason:'non-finite'};
    residuals.push(Math.abs(r));
    if(Math.abs(r)<=tolerance*scale){
      const next=newmarkKinematics(state,dTilde,dt),pNext=fluid.pressure(next);
      return {converged:true,iterations:k+1,residuals,state:next,pressure:pNext,
        forceOnStructure:pNext*fluid.area,forceOnFluid:-pNext*fluid.area};
    }
    if(relaxation==='aitken'&&previous!==null){const dr=r-previous;if(dr!==0)omega=-omega*previous/dr;}
    previous=r;d+=omega*r;
  }
  return {converged:false,iterations:maxIterations,residuals,reason:'max-iterations'};
}

// Time march. Energy = structural kinetic + spring + fluid kinetic (added mass) + fluid compression,
// measured about the coupled equilibrium so the constant ambient load does no net work over a cycle.
export function runCoupled({fluid,structure,initial,dt,steps,...options}){
  if(!(Number.isInteger(steps)&&steps>0))throw Error('FSI coupling requires a positive integer step count');
  const kTot=structure.stiffness+fluid.addedStiffness,mTot=structure.mass+fluid.addedMass,dEq=fluid.equilibrium/kTot,
    energy=(s)=>.5*mTot*s.v*s.v+.5*kTot*(s.d-dEq)**2;
  const a0=(fluid.equilibrium-kTot*initial.d)/mTot;
  let state={d:initial.d,v:initial.v,a:a0},interfaceWork=0,maxIterations=0;
  const history=[{t:0,...state,energy:energy(state)}];
  for(let n=0;n<steps;n++){
    const step=coupledStep({fluid,structure,state,dt,...options});
    if(!step.converged)return {converged:false,failedStep:n,reason:step.reason,residuals:step.residuals,history};
    // Interface work done on the structure plus work done on the fluid by the same trapezoidal force/displacement pair.
    const fPrev=fluid.pressure(state)*fluid.area,du=step.state.d-state.d;
    interfaceWork+=.5*(fPrev+step.forceOnStructure)*du+.5*(-fPrev+step.forceOnFluid)*du;
    maxIterations=Math.max(maxIterations,step.iterations);
    state=step.state;history.push({t:(n+1)*dt,...state,energy:energy(state)});
  }
  return {converged:true,history,interfaceWorkImbalance:interfaceWork,maxIterations,equilibrium:dEq,omega:Math.sqrt(kTot/mTot)};
}

// Contraction factor of the unrelaxed Dirichlet-Neumann map for the piston problem (analytic).
export function dirichletNeumannFactor({fluid,structure,dt}){
  return -(fluid.addedStiffness+fluid.addedMass/(BETA*dt*dt))/(structure.stiffness+structure.mass/(BETA*dt*dt));
}
