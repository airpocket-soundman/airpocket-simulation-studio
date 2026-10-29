// 2D Euler second-order FV on a uniform Cartesian grid (work order 99-CFD3).
// Dimensionally unsplit: per-direction MUSCL reconstruction of primitives, the shared 1D HLLC/HLLE flux
// applied to the face-normal velocity, tangential momentum upwinded by the mass flux, SSP-RK2 in time.
// For HLLC the upwinded tangential terms reproduce the full 2D HLLC flux exactly (the tangential velocity is
// a passive scalar carried by the contact); for HLLE they are a consistent conservative approximation.
import {numericalFlux} from './euler-1d-riemann.js';

const finitePositive=v=>Number.isFinite(v)&&v>0;
const LIMITERS={none:(a,b)=>(a+b)/2,minmod:(a,b)=>a*b<=0?0:Math.abs(a)<Math.abs(b)?a:b,vanleer:(a,b)=>a*b<=0?0:2*a*b/(a+b)};
const NAMES=['mass','xMomentum','yMomentum','energy'];

export function solveEuler2DMuscl({nx,ny,lengthX=1,lengthY=1,initial,gamma=1.4,endTime,cfl=.45,flux='hllc',limiter='minmod',order=2,boundary='periodic',maxSteps=1e6,timeBudgetMs=6e4}){
 for(const [k,v] of [['nx',nx],['ny',ny]])if(!Number.isInteger(v)||v<4||v>4096)throw new Error(k+' must be an integer in [4, 4096]');
 if(!finitePositive(lengthX)||!finitePositive(lengthY)||!finitePositive(endTime)||!(gamma>1))throw new Error('lengths>0, endTime>0 and gamma>1 are required');
 if(order!==1&&order!==2)throw new Error('order must be 1 or 2');
 if(!(cfl>0&&cfl<=(order===2?.5:1)))throw new Error('cfl must be in (0, 0.5] for order 2 and (0, 1] for order 1');
 const F=numericalFlux(flux),lim=LIMITERS[limiter];if(!lim)throw new Error('limiter must be none, minmod or vanleer');
 if(!['periodic','transmissive','reflective'].includes(boundary))throw new Error('boundary must be periodic, transmissive or reflective');
 if(typeof initial!=='function')throw new Error('initial must be a function (i, j, hx, hy) -> cell state');
 const hx=lengthX/nx,hy=lengthY/ny,n=nx*ny,U=[0,1,2,3].map(()=>new Float64Array(n));
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const s=initial(i,j,hx,hy),c=i+nx*j;
  if(!s||!finitePositive(s.density)||!Number.isFinite(s.velocityX)||!Number.isFinite(s.velocityY)||!finitePositive(s.pressure))throw new Error('initial state at cell '+i+','+j+' is non-physical');
  U[0][c]=s.mass??s.density;U[1][c]=s.xMomentum??s.density*s.velocityX;U[2][c]=s.yMomentum??s.density*s.velocityY;
  U[3][c]=s.energy??s.pressure/(gamma-1)+s.density*(s.velocityX**2+s.velocityY**2)/2;}
 // Primitive (rho,u,v,p) with two ghost layers on every side; row stride mx.
 const mx=nx+4,my=ny+4,P=[0,1,2,3].map(()=>new Float64Array(mx*my)),id=(i,j)=>(i+2)+mx*(j+2);
 const GX=[0,1,2,3].map(()=>new Float64Array((nx+1)*ny)),GY=[0,1,2,3].map(()=>new Float64Array(nx*(ny+1)));
 let minDensity=Infinity,minPressure=Infinity,rate=0;
 const ghost=(src,dst,normal)=>{for(let k=0;k<4;k++)P[k][dst]=boundary==='reflective'&&k===normal?-P[k][src]:P[k][src];};
 const primitives=(V,steps)=>{let sx=0,sy=0;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=i+nx*j,r=V[0][c],u=V[1][c]/r,v=V[2][c]/r,p=(gamma-1)*(V[3][c]-r*(u*u+v*v)/2);
   if(!(r>0&&p>0)||!Number.isFinite(u)||!Number.isFinite(v))throw new Error('non-physical or non-finite state at cell '+i+','+j+' step '+steps);
   const q=id(i,j),a=Math.sqrt(gamma*p/r);P[0][q]=r;P[1][q]=u;P[2][q]=v;P[3][q]=p;
   minDensity=Math.min(minDensity,r);minPressure=Math.min(minPressure,p);sx=Math.max(sx,Math.abs(u)+a);sy=Math.max(sy,Math.abs(v)+a);}
  rate=sx/hx+sy/hy;
  for(let g=0;g<2;g++){const per=boundary==='periodic';
   for(let j=0;j<ny;j++){ghost(per?id(nx-2+g,j):id(1-g,j),id(g-2,j),1);ghost(per?id(g,j):id(nx-1-g,j),id(nx+g,j),1);}
   for(let i=0;i<nx;i++){ghost(per?id(i,ny-2+g):id(i,1-g),id(i,g-2),2);ghost(per?id(i,g):id(i,ny-1-g),id(i,ny+g),2);}}};
 const L=[0,0,0,0],R=[0,0,0,0];
 // Face between cells a (minus side) and b (plus side) separated by stride s; normal velocity index nk.
 const faceFlux=(a,b,s,nk,G,f)=>{for(let k=0;k<4;k++){const qa=P[k][a],qb=P[k][b];
   L[k]=order===1?qa:qa+lim(qa-P[k][a-s],qb-qa)/2;R[k]=order===1?qb:qb-lim(qb-qa,P[k][b+s]-qb)/2;}
  if(!(L[0]>0&&L[3]>0&&R[0]>0&&R[3]>0))throw new Error('reconstruction produced a non-positive face state');
  const tk=3-nk,g=F(L[0],L[nk],L[3],R[0],R[nk],R[3],gamma),vt=g[0]>=0?L[tk]:R[tk];
  G[0][f]=g[0];G[nk][f]=g[1];G[tk][f]=g[0]*vt;G[3][f]=g[2]+g[0]*vt*vt/2;};
 const residual=(V,steps,Rs)=>{primitives(V,steps);
  for(let j=0;j<ny;j++)for(let f=0;f<=nx;f++){const o=f+(nx+1)*j;if(boundary==='periodic'&&f===nx){for(let k=0;k<4;k++)GX[k][o]=GX[k][o-nx];continue;}faceFlux(id(f-1,j),id(f,j),1,1,GX,o);}
  for(let f=0;f<=ny;f++)for(let i=0;i<nx;i++){const o=i+nx*f;if(boundary==='periodic'&&f===ny){for(let k=0;k<4;k++)GY[k][o]=GY[k][i];continue;}faceFlux(id(i,f-1),id(i,f),mx,2,GY,o);}
  if(boundary==='reflective'){for(const k of [0,3]){for(let j=0;j<ny;j++)GX[k][(nx+1)*j]=GX[k][nx+(nx+1)*j]=0;for(let i=0;i<nx;i++)GY[k][i]=GY[k][i+nx*ny]=0;}}
  const inflow=[0,0,0,0];
  for(let k=0;k<4;k++){const gx=GX[k],gy=GY[k],r=Rs[k];
   for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)r[i+nx*j]=-(gx[i+1+(nx+1)*j]-gx[i+(nx+1)*j])/hx-(gy[i+nx*(j+1)]-gy[i+nx*j])/hy;
   let b=0;for(let j=0;j<ny;j++)b+=(gx[(nx+1)*j]-gx[nx+(nx+1)*j])*hy;for(let i=0;i<nx;i++)b+=(gy[i]-gy[i+nx*ny])*hx;inflow[k]=b;}
  return inflow;};
 const totals=V=>V.map(a=>{let t=0;for(let c=0;c<n;c++)t+=a[c];return t*hx*hy;}),initialTotals=totals(U),boundaryInflow=[0,0,0,0];
 const Rs=[0,1,2,3].map(()=>new Float64Array(n)),U1=[0,1,2,3].map(()=>new Float64Array(n));
 let time=0,steps=0;const start=performance.now();
 while(time<endTime*(1-1e-14)){if(steps>=maxSteps)throw new Error('step limit exceeded');if(performance.now()-start>timeBudgetMs)throw new Error('time budget exceeded');
  const b0=residual(U,steps,Rs),dt=Math.min(cfl/rate,endTime-time);
  if(order===1){for(let k=0;k<4;k++){boundaryInflow[k]+=dt*b0[k];for(let c=0;c<n;c++)U[k][c]+=dt*Rs[k][c];}}
  else{for(let k=0;k<4;k++)for(let c=0;c<n;c++)U1[k][c]=U[k][c]+dt*Rs[k][c];
   const b1=residual(U1,steps,Rs);// Shu-Osher SSP-RK2
   for(let k=0;k<4;k++){boundaryInflow[k]+=dt*(b0[k]+b1[k])/2;for(let c=0;c<n;c++)U[k][c]=(U[k][c]+U1[k][c]+dt*Rs[k][c])/2;}}
  time+=dt;steps++;}
 primitives(U,steps);const final=totals(U);
 const pick=k=>{const a=new Float64Array(n);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)a[i+nx*j]=P[k][id(i,j)];return a;};
 const scale=U.map((a,k)=>{let t=0;for(let c=0;c<n;c++)t+=Math.abs(a[c]);return Math.max(t*hx*hy,Math.abs(initialTotals[k]),1e-300);});
 return {model:'euler-2d-ideal-gas-muscl-unsplit',phases:1,order,limiter,flux,boundary,gamma,nx,ny,cellWidthX:hx,cellWidthY:hy,lengthX,lengthY,time,steps,
  density:pick(0),velocityX:pick(1),velocityY:pick(2),pressure:pick(3),conserved:U,minDensity,minPressure,
  conservation:{names:NAMES,initial:initialTotals,final,boundaryInflow,relativeImbalance:final.map((v,k)=>(v-initialTotals[k]-boundaryInflow[k])/scale[k])}};}

// Isentropic vortex (Shu 1998) advected by a uniform stream on a periodic box; exact solution is pure translation.
// Cell averages by 4x4 Gauss-Legendre quadrature with the minimum-image distance (tails ~exp(-r^2/2) at the box edge).
const GL=[[-.8611363115940526,.3478548451374538],[-.3399810435848563,.6521451548625461],[.3399810435848563,.6521451548625461],[.8611363115940526,.3478548451374538]];
export function isentropicVortexAverages({strength=5,flowX=1,flowY=1,centerX=5,centerY=5,lengthX=10,lengthY=10,gamma=1.4,time=0}={}){
 if(!(strength>=0&&strength<8))throw new Error('strength must be in [0, 8)');
 const wrap=(d,L)=>d-L*Math.round(d/L),cx=centerX+flowX*time,cy=centerY+flowY*time;
 const point=(x,y)=>{const dx=wrap(x-cx,lengthX),dy=wrap(y-cy,lengthY),e=Math.exp((1-dx*dx-dy*dy)/2),b=strength/(2*Math.PI);
  const T=1-(gamma-1)*b*b*e*e/(2*gamma),r=T**(1/(gamma-1)),u=flowX-b*e*dy,v=flowY+b*e*dx,p=r*T;return [r,r*u,r*v,p/(gamma-1)+r*(u*u+v*v)/2];};
 return (i,j,hx,hy)=>{const m=[0,0,0,0];
  for(const [a,wa] of GL)for(const [b,wb] of GL){const q=point((i+.5+a/2)*hx,(j+.5+b/2)*hy);for(let k=0;k<4;k++)m[k]+=wa*wb*q[k]/4;}
  const u=m[1]/m[0],v=m[2]/m[0];
  return {density:m[0],velocityX:u,velocityY:v,pressure:(gamma-1)*(m[3]-m[0]*(u*u+v*v)/2),mass:m[0],xMomentum:m[1],yMomentum:m[2],energy:m[3]};};}

export function vortexL1DensityError(result,vortex={}){const {nx,ny,cellWidthX:hx,cellWidthY:hy}=result;
 const exact=isentropicVortexAverages({...vortex,lengthX:result.lengthX,lengthY:result.lengthY,gamma:result.gamma,time:result.time});let e=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)e+=Math.abs(result.conserved[0][i+nx*j]-exact(i,j,hx,hy).mass);return e*hx*hy;}

// Four-quadrant 2D Riemann data (Lax & Liu 1998 numbering), quadrants counted counter-clockwise from upper right.
export const LAX_LIU_CONFIG3=[{density:1.5,velocityX:0,velocityY:0,pressure:1.5},{density:.5323,velocityX:1.206,velocityY:0,pressure:.3},
 {density:.138,velocityX:1.206,velocityY:1.206,pressure:.029},{density:.5323,velocityX:0,velocityY:1.206,pressure:.3}];
export const quadrantInitial=(states,x0=.5,y0=.5)=>(i,j,hx,hy)=>{const x=(i+.5)*hx>=x0,y=(j+.5)*hy>=y0;return states[y?(x?0:1):(x?3:2)];};
