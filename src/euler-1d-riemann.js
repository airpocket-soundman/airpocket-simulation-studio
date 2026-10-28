// One-dimensional compressible Euler equations, ideal gas (CFD3 first step).
// First-order Godunov finite volume with HLLC (Toro, Spruce & Speares 1994) or HLLE (Einfeldt 1988) fluxes,
// forward Euler in time with a CFL-limited step, and Toro's exact Riemann solver as the reference.
// Verification kernel only: single-phase, inviscid, 1D, nondimensional; not connected to the GUI/API.

const finitePositive=v=>Number.isFinite(v)&&v>0;
const checkState=(s,name)=>{if(!s||!finitePositive(s.density)||!Number.isFinite(s.velocity)||!finitePositive(s.pressure))throw new Error(name+' needs finite density>0, velocity, pressure>0');};

function primitiveOf(rho,mom,ene,gamma){const u=mom/rho;return [rho,u,(gamma-1)*(ene-rho*u*u/2)];}
function fluxOf(rho,u,p,gamma){const e=p/(gamma-1)+rho*u*u/2;return [rho*u,rho*u*u+p,u*(e+p)];}

// Toro, Riemann Solvers and Numerical Methods for Fluid Dynamics, 3rd ed., chapter 4.
function pressureFunction(p,s,gamma){const a=Math.sqrt(gamma*s.pressure/s.density);
 if(p>s.pressure){const A=2/((gamma+1)*s.density),B=(gamma-1)/(gamma+1)*s.pressure,q=Math.sqrt(A/(p+B));return [(p-s.pressure)*q,q*(1-(p-s.pressure)/(2*(B+p)))];}
 const r=p/s.pressure;return [2*a/(gamma-1)*(r**((gamma-1)/(2*gamma))-1),1/(s.density*a)*r**(-(gamma+1)/(2*gamma))];}

export function exactRiemannStar(left,right,gamma=1.4){checkState(left,'left');checkState(right,'right');if(!(gamma>1))throw new Error('gamma must exceed 1');
 const aL=Math.sqrt(gamma*left.pressure/left.density),aR=Math.sqrt(gamma*right.pressure/right.density),du=right.velocity-left.velocity;
 if(2*(aL+aR)/(gamma-1)<=du)throw new Error('initial data generate vacuum; not supported');
 let p=Math.max(1e-12,(left.pressure+right.pressure)/2-du*(left.pressure+right.pressure)*(left.density+right.density)*(aL+aR)/32);
 for(let it=0;it<100;it++){const [fL,dL]=pressureFunction(p,left,gamma),[fR,dR]=pressureFunction(p,right,gamma),next=Math.max(1e-14,p-(fL+fR+du)/(dL+dR));
  const change=2*Math.abs(next-p)/(next+p);p=next;if(change<1e-15){const [gL]=pressureFunction(p,left,gamma),[gR]=pressureFunction(p,right,gamma);return {pressure:p,velocity:(left.velocity+right.velocity+gR-gL)/2,iterations:it+1};}}
 throw new Error('exact Riemann pressure iteration did not converge');}

// Samples the self-similar exact solution at speed xi=x/t.
export function exactRiemannSample(left,right,xi,gamma=1.4,star=exactRiemannStar(left,right,gamma)){const {pressure:ps,velocity:us}=star,g1=(gamma-1)/(gamma+1);
 const side=xi<=us?{s:left,sign:-1}:{s:right,sign:1},{s,sign}=side,a=Math.sqrt(gamma*s.pressure/s.density),pr=ps/s.pressure;
 const prim=(d,u,p)=>({density:d,velocity:u,pressure:p});
 if(ps>s.pressure){const shock=s.velocity+sign*a*Math.sqrt((gamma+1)/(2*gamma)*pr+(gamma-1)/(2*gamma));
  return sign*(xi-shock)>=0?prim(s.density,s.velocity,s.pressure):prim(s.density*(pr+g1)/(g1*pr+1),us,ps);}
 const head=s.velocity+sign*a,as=a*pr**((gamma-1)/(2*gamma)),tail=us+sign*as;
 if(sign*(xi-head)>=0)return prim(s.density,s.velocity,s.pressure);
 if(sign*(xi-tail)<=0)return prim(s.density*pr**(1/gamma),us,ps);
 const c=2/(gamma+1)-sign*(gamma-1)/((gamma+1)*a)*(s.velocity-xi),d=s.density*c**(2/(gamma-1));
 return prim(d,2/(gamma+1)*(-sign*a+(gamma-1)/2*s.velocity+xi),s.pressure*c**(2*gamma/(gamma-1)));}

function waveSpeeds(rL,uL,pL,rR,uR,pR,gamma){const aL=Math.sqrt(gamma*pL/rL),aR=Math.sqrt(gamma*pR/rR);
 // Einfeldt/Roe-average bounds; robust for both fluxes.
 const sl=Math.sqrt(rL),sr=Math.sqrt(rR),hL=(gamma*pL/(gamma-1)+rL*uL*uL/2)/rL,hR=(gamma*pR/(gamma-1)+rR*uR*uR/2)/rR;
 const u=(sl*uL+sr*uR)/(sl+sr),h=(sl*hL+sr*hR)/(sl+sr),a=Math.sqrt(Math.max((gamma-1)*(h-u*u/2),0));
 return [Math.min(uL-aL,u-a),Math.max(uR+aR,u+a)];}

function hlle(rL,uL,pL,rR,uR,pR,gamma){const [SL,SR]=waveSpeeds(rL,uL,pL,rR,uR,pR,gamma),FL=fluxOf(rL,uL,pL,gamma),FR=fluxOf(rR,uR,pR,gamma);
 if(SL>=0)return FL;if(SR<=0)return FR;const UL=[rL,rL*uL,pL/(gamma-1)+rL*uL*uL/2],UR=[rR,rR*uR,pR/(gamma-1)+rR*uR*uR/2];
 return FL.map((f,k)=>(SR*f-SL*FR[k]+SL*SR*(UR[k]-UL[k]))/(SR-SL));}

function hllc(rL,uL,pL,rR,uR,pR,gamma){const [SL,SR]=waveSpeeds(rL,uL,pL,rR,uR,pR,gamma);
 if(SL>=0)return fluxOf(rL,uL,pL,gamma);if(SR<=0)return fluxOf(rR,uR,pR,gamma);
 const SM=(pR-pL+rL*uL*(SL-uL)-rR*uR*(SR-uR))/(rL*(SL-uL)-rR*(SR-uR));
 const [r,u,p,S]=SM>=0?[rL,uL,pL,SL]:[rR,uR,pR,SR],F=fluxOf(r,u,p,gamma),E=p/(gamma-1)+r*u*u/2,c=r*(S-u)/(S-SM);
 const Us=[c,c*SM,c*(E/r+(SM-u)*(SM+p/(r*(S-u))))],U=[r,r*u,E];return F.map((f,k)=>f+S*(Us[k]-U[k]));}

const FLUXES={hllc,hlle};

export function solveEuler1D({cells,length=1,interface:x0=length/2,left,right,gamma=1.4,endTime,cfl=.9,flux='hllc',boundary='transmissive',maxSteps=1e6,timeBudgetMs=6e4}){
 if(!Number.isInteger(cells)||cells<4||cells>1<<20)throw new Error('cells must be an integer in [4, 2^20]');
 if(!finitePositive(length)||!(x0>0&&x0<length))throw new Error('interface must lie inside (0, length)');
 if(!finitePositive(endTime)||!(cfl>0&&cfl<=1)||!(gamma>1))throw new Error('endTime>0, 0<cfl<=1 and gamma>1 are required');
 checkState(left,'left');checkState(right,'right');const F=FLUXES[flux];if(!F)throw new Error('flux must be hllc or hlle');
 if(boundary!=='transmissive'&&boundary!=='reflective')throw new Error('boundary must be transmissive or reflective');
 const n=cells,h=length/n,U=[new Float64Array(n),new Float64Array(n),new Float64Array(n)],G=[new Float64Array(n+1),new Float64Array(n+1),new Float64Array(n+1)];
 for(let i=0;i<n;i++){const s=(i+.5)*h<x0?left:right;U[0][i]=s.density;U[1][i]=s.density*s.velocity;U[2][i]=s.pressure/(gamma-1)+s.density*s.velocity**2/2;}
 const totals=()=>U.map(a=>{let t=0;for(let i=0;i<n;i++)t+=a[i];return t*h;}),initial=totals(),boundaryInflow=[0,0,0];
 let time=0,steps=0,minDensity=Infinity,minPressure=Infinity;const start=performance.now(),P=[new Float64Array(n),new Float64Array(n),new Float64Array(n)];
 while(time<endTime*(1-1e-14)){if(steps>=maxSteps)throw new Error('step limit exceeded');if(performance.now()-start>timeBudgetMs)throw new Error('time budget exceeded');
  let smax=0;for(let i=0;i<n;i++){const [r,u,p]=primitiveOf(U[0][i],U[1][i],U[2][i],gamma);
   if(!(r>0&&p>0)||!Number.isFinite(u))throw new Error('non-physical or non-finite state at cell '+i+' step '+steps);
   P[0][i]=r;P[1][i]=u;P[2][i]=p;minDensity=Math.min(minDensity,r);minPressure=Math.min(minPressure,p);smax=Math.max(smax,Math.abs(u)+Math.sqrt(gamma*p/r));}
  const dt=Math.min(cfl*h/smax,endTime-time),wall=boundary==='reflective'?-1:1;
  for(let f=0;f<=n;f++){const a=f===0?0:f-1,b=f===n?n-1:f,sa=f===0?wall:1,sb=f===n?wall:1;
   const g=F(P[0][a],sa*P[1][a],P[2][a],P[0][b],sb*P[1][b],P[2][b],gamma);for(let k=0;k<3;k++)G[k][f]=g[k];}
  if(boundary==='reflective'){G[0][0]=G[0][n]=0;G[2][0]=G[2][n]=0;}
  for(let k=0;k<3;k++){boundaryInflow[k]+=dt*(G[k][0]-G[k][n]);const c=dt/h;for(let i=0;i<n;i++)U[k][i]-=c*(G[k][i+1]-G[k][i]);}
  time+=dt;steps++;}
 const final=totals(),density=new Float64Array(n),velocity=new Float64Array(n),pressure=new Float64Array(n);
 for(let i=0;i<n;i++){const [r,u,p]=primitiveOf(U[0][i],U[1][i],U[2][i],gamma);if(!(r>0&&p>0)||!Number.isFinite(u))throw new Error('non-physical final state at cell '+i);density[i]=r;velocity[i]=u;pressure[i]=p;}
 // Normalise by the L1 norm of each conserved field so zero net momentum still gives a meaningful ratio.
 const scale=U.map((a,k)=>{let t=0;for(let i=0;i<n;i++)t+=Math.abs(a[i]);return Math.max(t*h,Math.abs(initial[k]),1e-300);});
 return {model:'euler-1d-ideal-gas',phases:1,flux,boundary,gamma,cells:n,cellWidth:h,length,interface:x0,time,steps,density,velocity,pressure,minDensity:Math.min(minDensity,...density),minPressure:Math.min(minPressure,...pressure),
  conservation:{names:['mass','momentum','energy'],initial,final,boundaryInflow,relativeImbalance:final.map((v,k)=>(v-initial[k]-boundaryInflow[k])/scale[k])}};}

// Cell-average L1 errors against the exact solution sampled at cell centres (density, velocity, pressure).
export function riemannL1Error(result,left,right){const {cells:n,cellWidth:h,interface:x0,time:t,gamma}=result,star=exactRiemannStar(left,right,gamma),e=[0,0,0];
 for(let i=0;i<n;i++){const s=exactRiemannSample(left,right,((i+.5)*h-x0)/t,gamma,star);e[0]+=Math.abs(result.density[i]-s.density)*h;e[1]+=Math.abs(result.velocity[i]-s.velocity)*h;e[2]+=Math.abs(result.pressure[i]-s.pressure)*h;}
 return {density:e[0],velocity:e[1],pressure:e[2]};}

export const SOD={left:{density:1,velocity:0,pressure:1},right:{density:.125,velocity:0,pressure:.1}};
export const observedOrder=(coarse,fine)=>Math.log2(coarse/fine);
