// 1D Euler second-order FV: slope-limited primitive (MUSCL) reconstruction + SSP-RK2 (Shu-Osher, CFL<=0.5).
// Smooth-solution convergence is checked by an exact periodic density-wave translation (work order 94-CFD3).
import {numericalFlux,exactRiemannSample,exactRiemannStar} from './euler-1d-riemann.js';

const finitePositive=v=>Number.isFinite(v)&&v>0;
const LIMITERS={none:(a,b)=>(a+b)/2,minmod:(a,b)=>a*b<=0?0:Math.abs(a)<Math.abs(b)?a:b,vanleer:(a,b)=>a*b<=0?0:2*a*b/(a+b)};

export function solveEuler1DMuscl({cells,length=1,initial,gamma=1.4,endTime,cfl=.45,flux='hllc',limiter='minmod',order=2,boundary='periodic',maxSteps=1e6,timeBudgetMs=6e4}){
 if(!Number.isInteger(cells)||cells<8||cells>1<<20)throw new Error('cells must be an integer in [8, 2^20]');
 if(!finitePositive(length)||!finitePositive(endTime)||!(gamma>1))throw new Error('length>0, endTime>0 and gamma>1 are required');
 if(order!==1&&order!==2)throw new Error('order must be 1 or 2');
 if(!(cfl>0&&cfl<=(order===2?.5:1)))throw new Error('cfl must be in (0, 0.5] for order 2 and (0, 1] for order 1');
 const F=numericalFlux(flux),lim=LIMITERS[limiter];if(!lim)throw new Error('limiter must be none, minmod or vanleer');
 if(!['periodic','transmissive','reflective'].includes(boundary))throw new Error('boundary must be periodic, transmissive or reflective');
 if(typeof initial!=='function')throw new Error('initial must be a function (cellIndex, cellWidth) -> cell state');
 const n=cells,h=length/n,U=[0,1,2].map(()=>new Float64Array(n));
 for(let i=0;i<n;i++){const s=initial(i,h);if(!s||!finitePositive(s.density)||!Number.isFinite(s.velocity)||!finitePositive(s.pressure))throw new Error('initial state at cell '+i+' is non-physical');
  // Exact conserved cell averages are used when supplied; otherwise they are built from the primitives.
  U[0][i]=s.mass??s.density;U[1][i]=s.momentum??s.density*s.velocity;U[2][i]=s.energy??s.pressure/(gamma-1)+s.density*s.velocity**2/2;}
 const P=[0,1,2].map(()=>new Float64Array(n+4)),G=[0,1,2].map(()=>new Float64Array(n+1)),wall=boundary==='reflective'?-1:1;
 let minDensity=Infinity,minPressure=Infinity,smax=0;
 const primitives=(V,steps)=>{smax=0;for(let i=0;i<n;i++){const r=V[0][i],u=V[1][i]/r,p=(gamma-1)*(V[2][i]-r*u*u/2);
   if(!(r>0&&p>0)||!Number.isFinite(u))throw new Error('non-physical or non-finite state at cell '+i+' step '+steps);
   P[0][i+2]=r;P[1][i+2]=u;P[2][i+2]=p;minDensity=Math.min(minDensity,r);minPressure=Math.min(minPressure,p);smax=Math.max(smax,Math.abs(u)+Math.sqrt(gamma*p/r));}
  // Two ghost cells per side.
  for(let g=0;g<2;g++)for(let k=0;k<3;k++){if(boundary==='periodic'){P[k][g]=P[k][n+g];P[k][n+2+g]=P[k][2+g];}
   else{const s=k===1?wall:1;P[k][1-g]=s*P[k][2+g];P[k][n+2+g]=s*P[k][n+1-g];}}};
 const face=(k,j,side)=>{const q=P[k][j];return order===1?q:q+side*lim(q-P[k][j-1],P[k][j+1]-q)/2;};
 const L=[0,0,0],Rt=[0,0,0];
 const residual=(V,steps,R)=>{primitives(V,steps);
  for(let f=0;f<=n;f++){if(boundary==='periodic'&&f===n){for(let k=0;k<3;k++)G[k][n]=G[k][0];continue;}
   for(let k=0;k<3;k++){L[k]=face(k,f+1,1);Rt[k]=face(k,f+2,-1);}
   if(!(L[0]>0&&L[2]>0&&Rt[0]>0&&Rt[2]>0))throw new Error('reconstruction produced a non-positive face state at face '+f);
   const g=F(L[0],L[1],L[2],Rt[0],Rt[1],Rt[2],gamma);for(let k=0;k<3;k++)G[k][f]=g[k];}
  if(boundary==='reflective'){G[0][0]=G[0][n]=0;G[2][0]=G[2][n]=0;}
  for(let k=0;k<3;k++)for(let i=0;i<n;i++)R[k][i]=-(G[k][i+1]-G[k][i])/h;
  return [0,1,2].map(k=>G[k][0]-G[k][n]);};
 const totals=V=>V.map(a=>{let t=0;for(let i=0;i<n;i++)t+=a[i];return t*h;}),initialTotals=totals(U),boundaryInflow=[0,0,0];
 const R=[0,1,2].map(()=>new Float64Array(n)),U1=[0,1,2].map(()=>new Float64Array(n));
 let time=0,steps=0;const start=performance.now();
 while(time<endTime*(1-1e-14)){if(steps>=maxSteps)throw new Error('step limit exceeded');if(performance.now()-start>timeBudgetMs)throw new Error('time budget exceeded');
  const b0=residual(U,steps,R),dt=Math.min(cfl*h/smax,endTime-time);
  if(order===1){for(let k=0;k<3;k++){boundaryInflow[k]+=dt*b0[k];for(let i=0;i<n;i++)U[k][i]+=dt*R[k][i];}}
  else{for(let k=0;k<3;k++)for(let i=0;i<n;i++)U1[k][i]=U[k][i]+dt*R[k][i];
   const b1=residual(U1,steps,R);// Shu-Osher SSP-RK2: U^{n+1} = (U^n + U1 + dt L(U1)) / 2
   for(let k=0;k<3;k++){boundaryInflow[k]+=dt*(b0[k]+b1[k])/2;for(let i=0;i<n;i++)U[k][i]=(U[k][i]+U1[k][i]+dt*R[k][i])/2;}}
  time+=dt;steps++;}
 primitives(U,steps);const density=P[0].slice(2,n+2),velocity=P[1].slice(2,n+2),pressure=P[2].slice(2,n+2),final=totals(U);
 const scale=U.map((a,k)=>{let t=0;for(let i=0;i<n;i++)t+=Math.abs(a[i]);return Math.max(t*h,Math.abs(initialTotals[k]),1e-300);});
 return {model:'euler-1d-ideal-gas-muscl',phases:1,order,limiter,flux,boundary,gamma,cells:n,cellWidth:h,length,time,steps,density,velocity,pressure,conserved:U,minDensity,minPressure,
  conservation:{names:['mass','momentum','energy'],initial:initialTotals,final,boundaryInflow,relativeImbalance:final.map((v,k)=>(v-initialTotals[k]-boundaryInflow[k])/scale[k])}};}

// Smooth periodic test: rho = 1 + A sin(2 pi x / L) with uniform u, p is translated exactly at speed u.
// Returns exact conserved cell averages at the given time.
export function densityWaveAverages({amplitude=.2,velocity=1,pressure=1,length=1,gamma=1.4,time=0}={}){
 if(!(amplitude>=0&&amplitude<1))throw new Error('amplitude must be in [0, 1)');const k=2*Math.PI/length;
 return (i,h)=>{const a=i*h-velocity*time,m=1+amplitude*(Math.cos(k*a)-Math.cos(k*(a+h)))/(k*h);
  return {density:m,velocity,pressure,mass:m,momentum:m*velocity,energy:pressure/(gamma-1)+m*velocity*velocity/2};};}

export function densityWaveL1Error(result,wave){const exact=densityWaveAverages({...wave,length:result.length,gamma:result.gamma,time:result.time});let e=0;
 for(let i=0;i<result.cells;i++)e+=Math.abs(result.conserved[0][i]-exact(i,result.cellWidth).mass)*result.cellWidth;return e;}

// Piecewise-constant Riemann data for the shock-tube comparison with the first-order kernel.
export const riemannInitial=(left,right,x0=.5)=>(i,h)=>(i+.5)*h<x0?left:right;
export function riemannL1DensityError(result,left,right,x0=.5){const star=exactRiemannStar(left,right,result.gamma);let e=0;
 for(let i=0;i<result.cells;i++)e+=Math.abs(result.density[i]-exactRiemannSample(left,right,((i+.5)*result.cellWidth-x0)/result.time,result.gamma,star).density)*result.cellWidth;return e;}
