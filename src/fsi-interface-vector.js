// Multi-DOF interface extension of the partitioned Dirichlet-Neumann contract (coupling layer only).
// The interface carries n displacement DOFs. The reference fluid is a linear operator
// F_fluid(d,a) = f0 - Ka d - Ma a (symmetric added stiffness Ka and added mass Ma, N/m and kg);
// the structure is a diagonal mass/spring set. Both fields share Newmark (beta=1/4, gamma=1/2)
// kinematics at t^{n+1}; the structure receives exactly the negative of the force returned to the fluid.
// Relaxation: none, constant omega, or vector Aitken. A residual that grows for `divergenceWindow`
// consecutive iterations is rejected as `diverging` instead of running to max-iterations.
// Contract: SI units. Synthetic operators only; NOT wired into any CFD solver, worker, MCP or UI path.

const BETA=.25,GAMMA=.5;

const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=(a)=>Math.sqrt(dot(a,a));
const matVec=(M,x)=>M.map(row=>dot(row,x));

function finiteVector(v,n,what){
  if(!(Array.isArray(v)&&v.length===n&&v.every(Number.isFinite)))throw Error(`FSI interface requires a finite ${what} of length ${n}`);
  return v;
}
function symmetricMatrix(M,n,what){
  if(!(Array.isArray(M)&&M.length===n&&M.every(row=>Array.isArray(row)&&row.length===n&&row.every(Number.isFinite))))
    throw Error(`FSI interface requires a finite ${n}x${n} ${what}`);
  for(let i=0;i<n;i++)for(let j=0;j<i;j++)if(Math.abs(M[i][j]-M[j][i])>1e-12*Math.max(Math.abs(M[i][j]),Math.abs(M[j][i]),1e-300))
    throw Error(`FSI interface requires a symmetric ${what}`);
  return M;
}

export function newmarkKinematicsVector(state,d,dt){
  const a=d.map((di,i)=>(di-state.d[i]-dt*state.v[i])/(BETA*dt*dt)-(1/(2*BETA)-1)*state.a[i]),
    v=state.v.map((vi,i)=>vi+dt*((1-GAMMA)*state.a[i]+GAMMA*a[i]));
  return {d,v,a};
}

export function linearInterfaceFluid({addedMass,addedStiffness,ambientForce}){
  const n=Array.isArray(ambientForce)?ambientForce.length:0;
  if(n<1)throw Error('FSI interface requires at least one DOF');
  symmetricMatrix(addedMass,n,'added mass');symmetricMatrix(addedStiffness,n,'added stiffness');finiteVector(ambientForce,n,'ambient force');
  return {n,addedMass,addedStiffness,ambientForce,
    force:(kin)=>{const kd=matVec(addedStiffness,kin.d),ma=matVec(addedMass,kin.a);return ambientForce.map((f,i)=>f-kd[i]-ma[i]);}};
}

export function diagonalStructure({mass,stiffness}){
  const n=Array.isArray(mass)?mass.length:0;
  if(n<1)throw Error('FSI interface requires at least one DOF');
  if(!mass.every(m=>Number.isFinite(m)&&m>0))throw Error('FSI interface requires finite positive masses');
  finiteVector(stiffness,n,'stiffness');if(!stiffness.every(k=>k>=0))throw Error('FSI interface requires non-negative stiffness');
  return {n,mass,stiffness,
    solve:(state,force,dt)=>force.map((f,i)=>{
      const rhs=f+mass[i]*((state.d[i]+dt*state.v[i])/(BETA*dt*dt)+(1/(2*BETA)-1)*state.a[i]);
      return rhs/(stiffness[i]+mass[i]/(BETA*dt*dt));
    })};
}

// One coupled step with vector relaxation. Returns converged state, residual norms, both interface forces.
export function coupledStepVector({fluid,structure,state,dt,tolerance=1e-12,maxIterations=50,relaxation='aitken',omega0=.5,divergenceWindow=4}){
  if(!(Number.isFinite(dt)&&dt>0))throw Error('FSI interface requires a finite positive time step');
  if(!(Number.isFinite(tolerance)&&tolerance>0))throw Error('FSI interface requires a finite positive tolerance');
  if(!['none','constant','aitken'].includes(relaxation))throw Error('FSI interface rejects an unknown relaxation');
  if(!(Number.isFinite(omega0)&&omega0>0&&omega0<=1))throw Error('FSI interface requires 0 < omega0 <= 1');
  if(!(Number.isInteger(divergenceWindow)&&divergenceWindow>=2))throw Error('FSI interface requires an integer divergence window >= 2');
  if(fluid.n!==structure.n)throw Error('FSI interface requires matching fluid and structure DOF counts');
  const n=fluid.n;['d','v','a'].forEach(k=>finiteVector(state[k],n,`state.${k}`));
  let d=state.d.map((di,i)=>di+dt*state.v[i]),omega=relaxation==='none'?1:omega0,previous=null,growing=0;
  const residuals=[],omegas=[];
  for(let k=0;k<maxIterations;k++){
    const kin=newmarkKinematicsVector(state,d,dt),forceOnStructure=fluid.force(kin),
      dTilde=structure.solve(state,forceOnStructure,dt),r=dTilde.map((x,i)=>x-d[i]),rn=norm(r),
      scale=Math.max(norm(dTilde),norm(state.d),1e-300);
    if(!Number.isFinite(rn))return {converged:false,iterations:k+1,residuals,omegas,reason:'non-finite'};
    residuals.push(rn);
    if(rn<=tolerance*scale){
      const next=newmarkKinematicsVector(state,dTilde,dt),f=fluid.force(next);
      return {converged:true,iterations:k+1,residuals,omegas,state:next,forceOnStructure:f,forceOnFluid:f.map(x=>-x)};
    }
    growing=k>0&&rn>residuals[k-1]?growing+1:0;
    if(growing>=divergenceWindow)return {converged:false,iterations:k+1,residuals,omegas,reason:'diverging'};
    if(relaxation==='aitken'&&previous!==null){
      const dr=r.map((x,i)=>x-previous[i]),dd=dot(dr,dr);
      if(dd>0)omega=-omega*dot(previous,dr)/dd;
    }
    omegas.push(omega);previous=r;d=d.map((di,i)=>di+omega*r[i]);
  }
  return {converged:false,iterations:maxIterations,residuals,omegas,reason:'max-iterations'};
}

// Monolithic Newmark step of the same coupled system (dense Gaussian elimination), used as the
// reference the partitioned fixed point must reproduce.
export function monolithicStepVector({fluid,structure,state,dt}){
  const n=fluid.n,c=1/(BETA*dt*dt),A=[],b=[];
  for(let i=0;i<n;i++){
    A.push(Array.from({length:n},(_,j)=>fluid.addedStiffness[i][j]+c*fluid.addedMass[i][j]+(i===j?structure.stiffness[i]+c*structure.mass[i]:0)));
    let rhs=fluid.ambientForce[i];
    for(let j=0;j<n;j++){const m=fluid.addedMass[i][j]+(i===j?structure.mass[i]:0);
      rhs+=m*(c*(state.d[j]+dt*state.v[j])+(1/(2*BETA)-1)*state.a[j]);}
    b.push(rhs);
  }
  for(let p=0;p<n;p++){
    let piv=p;for(let r=p+1;r<n;r++)if(Math.abs(A[r][p])>Math.abs(A[piv][p]))piv=r;
    [A[p],A[piv]]=[A[piv],A[p]];[b[p],b[piv]]=[b[piv],b[p]];
    for(let r=p+1;r<n;r++){const f=A[r][p]/A[p][p];for(let j=p;j<n;j++)A[r][j]-=f*A[p][j];b[r]-=f*b[p];}
  }
  const d=new Array(n);
  for(let i=n-1;i>=0;i--){let s=b[i];for(let j=i+1;j<n;j++)s-=A[i][j]*d[j];d[i]=s/A[i][i];}
  return newmarkKinematicsVector(state,d,dt);
}

// Unrelaxed Dirichlet-Neumann iteration matrix J = -S^{-1}(Ka + Ma/(beta dt^2)), S = diag(k + m/(beta dt^2)).
export function dirichletNeumannMatrix({fluid,structure,dt}){
  const c=1/(BETA*dt*dt);
  return fluid.addedStiffness.map((row,i)=>row.map((kij,j)=>-(kij+c*fluid.addedMass[i][j])/(structure.stiffness[i]+c*structure.mass[i])));
}
