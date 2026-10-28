// Transient incompressible Navier-Stokes in a 2D channel: periodic in x, no-slip walls at y=0 and y=H (CFD2 second step).
// Same scheme as unsteady-ns-periodic.js (MAC grid, conservative central advection, explicit viscous term, SSP-RK3 with
// stage-wise exact projection); walls enter through ghost u values and v=0 on the wall faces, and the pressure Poisson
// problem is solved exactly by FFT in x plus a Neumann tridiagonal solve in y. Optional moving top/bottom walls and a
// uniform body force drive startup Couette / Poiseuille flow. Laminar verification kernel only; no turbulence model.

const finitePositive=v=>Number.isFinite(v)&&v>0;
// Real-axis stability limit of SSP-RK3: |1+z+z^2/2+z^3/6|<=1 for z in [-2.5127, 0].
export const RK3_REAL_AXIS_LIMIT=2.512745327;

function fft(re,im,inverse){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let size=2;size<=n;size<<=1){const angle=(inverse?2:-2)*Math.PI/size,wr=Math.cos(angle),wi=Math.sin(angle);for(let start=0;start<n;start+=size){let cr=1,ci=0;for(let k=0;k<size/2;k++){const a=start+k,b=a+size/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=next;}}}
 if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}

const wrap=(k,n)=>(k%n+n)%n;

// u[j*nx+i] at (i hx,(j+1/2) hy), j<ny; v[j*nx+i] at ((i+1/2) hx, j hy), j<=ny with v=0 on j=0 and j=ny.
function divergence(g,u,v,out){const {nx,ny,hx,hy}=g;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)out[j*nx+i]=(u[j*nx+wrap(i+1,nx)]-u[j*nx+i])/hx+(v[(j+1)*nx+i]-v[j*nx+i])/hy;return out;}

function project(g,u,v,work){const {nx,ny,hx,hy}=g,{re,im,rowRe,rowIm,lambda,c,dRe,dIm}=work;divergence(g,u,v,re);im.fill(0);
 for(let j=0;j<ny;j++){rowRe.set(re.subarray(j*nx,(j+1)*nx));rowIm.fill(0);fft(rowRe,rowIm,false);re.set(rowRe,j*nx);im.set(rowIm,j*nx);}
 const a=1/(hy*hy);
 for(let k=0;k<nx;k++){
  // Thomas algorithm for lambda_k phi_j + (phi_{j+1}-2 phi_j+phi_{j-1})/hy^2 = b_j with Neumann ends; k=0 pins phi_0=0 (compatible singular system).
  for(let j=0;j<ny;j++){let diag=lambda[k]-(j===0||j===ny-1?1:2)*a,lower=j>0?a:0,upper=j<ny-1?a:0,bRe=re[j*nx+k],bIm=im[j*nx+k];
   if(k===0&&j===0){diag=1;upper=0;bRe=0;bIm=0;}
   if(j>0){const m=diag-lower*c[j-1];c[j]=upper/m;dRe[j]=(bRe-lower*dRe[j-1])/m;dIm[j]=(bIm-lower*dIm[j-1])/m;}else{c[0]=upper/diag;dRe[0]=bRe/diag;dIm[0]=bIm/diag;}}
  for(let j=ny-2;j>=0;j--){dRe[j]-=c[j]*dRe[j+1];dIm[j]-=c[j]*dIm[j+1];}
  for(let j=0;j<ny;j++){re[j*nx+k]=dRe[j];im[j*nx+k]=dIm[j];}}
 for(let j=0;j<ny;j++){rowRe.set(re.subarray(j*nx,(j+1)*nx));rowIm.set(im.subarray(j*nx,(j+1)*nx));fft(rowRe,rowIm,true);re.set(rowRe,j*nx);}
 const phi=re;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)u[j*nx+i]-=(phi[j*nx+i]-phi[j*nx+wrap(i-1,nx)])/hx;
 for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[j*nx+i]-=(phi[j*nx+i]-phi[(j-1)*nx+i])/hy;}

function rhs(g,u,v,du,dv){const {nx,ny,hx,hy,nu,bottomVelocity:ub,topVelocity:ut,bodyForce:f}=g,dx=nu/(hx*hx),dy=nu/(hy*hy);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const im=wrap(i-1,nx),ip=wrap(i+1,nx),k=j*nx+i;
  const uN=j<ny-1?u[k+nx]:2*ut-u[k],uS=j>0?u[k-nx]:2*ub-u[k];
  const ucE=(u[k]+u[j*nx+ip])/2,ucW=(u[j*nx+im]+u[k])/2;
  const uvN=(u[k]+uN)/2*(v[(j+1)*nx+im]+v[(j+1)*nx+i])/2,uvS=(uS+u[k])/2*(v[j*nx+im]+v[k])/2;
  du[k]=f-(ucE*ucE-ucW*ucW)/hx-(uvN-uvS)/hy+dx*(u[j*nx+ip]+u[j*nx+im]-2*u[k])+dy*(uN+uS-2*u[k]);}
 for(let i=0;i<nx;i++){dv[i]=0;dv[ny*nx+i]=0;}
 for(let j=1;j<ny;j++)for(let i=0;i<nx;i++){const im=wrap(i-1,nx),ip=wrap(i+1,nx),k=j*nx+i;
  const vcN=(v[k]+v[k+nx])/2,vcS=(v[k-nx]+v[k])/2;
  const uvE=(u[(j-1)*nx+ip]+u[j*nx+ip])/2*(v[k]+v[j*nx+ip])/2,uvW=(u[(j-1)*nx+i]+u[k])/2*(v[j*nx+im]+v[k])/2;
  dv[k]=-(uvE-uvW)/hx-(vcN*vcN-vcS*vcS)/hy+dx*(v[j*nx+ip]+v[j*nx+im]-2*v[k])+dy*(v[k+nx]+v[k-nx]-2*v[k]);}}

function diagnostics(g,u,v,work){const {nx,ny,hx,hy}=g,div=divergence(g,u,v,work.scratch);let energy=0,maxDiv=0,maxSpeed=0,minRate=Infinity,maxRate=-Infinity;
 for(let k=0;k<nx*ny;k++){energy+=u[k]*u[k];maxDiv=Math.max(maxDiv,Math.abs(div[k]));maxSpeed=Math.max(maxSpeed,Math.abs(u[k]));}
 for(let k=0;k<nx*(ny+1);k++){energy+=v[k]*v[k];maxSpeed=Math.max(maxSpeed,Math.abs(v[k]));}
 // Volume flow rate through every x-face column; incompressibility makes these equal.
 for(let i=0;i<nx;i++){let q=0;for(let j=0;j<ny;j++)q+=u[j*nx+i]*hy;minRate=Math.min(minRate,q);maxRate=Math.max(maxRate,q);}
 return {kineticEnergy:energy*hx*hy/2,flowRate:(minRate+maxRate)/2,flowRateSpread:maxRate-minRate,maxAbsDivergence:maxDiv,maxVelocityComponent:maxSpeed};}

// options: {cellsX (power of two 4..256), cellsY (integer 4..512), length=2pi, height=1, kinematicViscosity, initialVelocity:(x,y)=>[u,v],
//  endTime, bottomVelocity=0, topVelocity=0, bodyForce=0, cfl=0.4, stabilitySafety=0.5, fixedTimeStep, allowUnstableTimeStep=false,
//  maxSteps=200000, maxSeconds=60, onProgress, now}
export function solveChannelUnsteadyNS(options={}){
 const {cellsX:nx,cellsY:ny,length=2*Math.PI,height=1,kinematicViscosity:nu,initialVelocity,endTime,bottomVelocity=0,topVelocity=0,bodyForce=0,cfl=.4,stabilitySafety=.5,fixedTimeStep,allowUnstableTimeStep=false,maxSteps=200000,maxSeconds=60,onProgress=()=>{},now=()=>performance.now()}=options;
 if(!Number.isInteger(nx)||nx<4||nx>256||(nx&(nx-1)))throw Error('Channel NS requires cellsX to be a power of two between 4 and 256');
 if(!Number.isInteger(ny)||ny<4||ny>512)throw Error('Channel NS requires cellsY to be an integer between 4 and 512');
 if(!finitePositive(length)||!finitePositive(height)||!finitePositive(nu)||!finitePositive(endTime)||typeof initialVelocity!=='function')throw Error('Channel NS requires positive length, height, kinematic viscosity, end time and an initial velocity function');
 if(![bottomVelocity,topVelocity,bodyForce].every(Number.isFinite))throw Error('Channel NS wall velocities and body force must be finite');
 if(!finitePositive(cfl)||cfl>1||!finitePositive(stabilitySafety)||stabilitySafety>1||!Number.isInteger(maxSteps)||maxSteps<1||!finitePositive(maxSeconds))throw Error('Invalid channel NS stability or budget settings');
 const hx=length/nx,hy=height/ny,g={nx,ny,hx,hy,nu,bottomVelocity,topVelocity,bodyForce};
 // Explicit viscous bound: spectral radius of the 5-point Laplacian (ghost-wall rows included) is below 4nu(1/hx^2+1/hy^2).
 const viscousStableTimeStep=RK3_REAL_AXIS_LIMIT/(4*nu*(1/(hx*hx)+1/(hy*hy)));
 if(fixedTimeStep!==undefined){if(!finitePositive(fixedTimeStep))throw Error('Channel NS fixedTimeStep must be positive');
  if(fixedTimeStep>viscousStableTimeStep&&!allowUnstableTimeStep)throw Error('Channel NS fixedTimeStep '+fixedTimeStep+' exceeds the explicit viscous stability limit '+viscousStableTimeStep);}
 const u=new Float64Array(nx*ny),v=new Float64Array(nx*(ny+1));
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)u[j*nx+i]=initialVelocity(i*hx,(j+.5)*hy)[0];
 for(let j=1;j<ny;j++)for(let i=0;i<nx;i++)v[j*nx+i]=initialVelocity((i+.5)*hx,j*hy)[1];
 if(![...u,...v].every(Number.isFinite))throw Error('Channel NS initial velocity must be finite');
 const lambda=new Float64Array(nx);for(let k=0;k<nx;k++){const s=Math.sin(Math.PI*k/nx);lambda[k]=-4*s*s/(hx*hx);}
 const work={re:new Float64Array(nx*ny),im:new Float64Array(nx*ny),rowRe:new Float64Array(nx),rowIm:new Float64Array(nx),lambda,c:new Float64Array(ny),dRe:new Float64Array(ny),dIm:new Float64Array(ny),scratch:new Float64Array(nx*ny)};
 const initialDivergence=diagnostics(g,u,v,work).maxAbsDivergence;project(g,u,v,work);
 const du=new Float64Array(u.length),dv=new Float64Array(v.length),u0=new Float64Array(u.length),v0=new Float64Array(v.length),started=now(),history=[{time:0,...diagnostics(g,u,v,work)}];
 let time=0,steps=0,minDt=Infinity,maxDt=0;
 while(time<endTime*(1-1e-12)){
  if(steps>=maxSteps)throw Error('Channel NS step limit reached before endTime; no result returned');
  if(now()-started>maxSeconds*1000)throw Error('Channel NS time budget exceeded; no result returned');
  const speed=Math.max(history.at(-1).maxVelocityComponent,Math.abs(topVelocity),Math.abs(bottomVelocity));
  let dt=fixedTimeStep??Math.min(stabilitySafety*viscousStableTimeStep,speed>0?cfl*Math.min(hx,hy)/speed:Infinity);dt=Math.min(dt,endTime-time);
  u0.set(u);v0.set(v);
  for(const [a,b] of [[0,1],[.75,.25],[1/3,2/3]]){rhs(g,u,v,du,dv);for(let k=0;k<u.length;k++)u[k]=a*u0[k]+b*(u[k]+dt*du[k]);for(let k=0;k<v.length;k++)v[k]=a*v0[k]+b*(v[k]+dt*dv[k]);project(g,u,v,work);}
  time+=dt;steps++;minDt=Math.min(minDt,dt);maxDt=Math.max(maxDt,dt);
  const diag={time,...diagnostics(g,u,v,work)};
  if(!Number.isFinite(diag.kineticEnergy))throw Error('Channel NS produced a non-finite field; no result returned');
  history.push(diag);if(steps%50===0)onProgress('Channel NS step '+steps+' t='+time.toPrecision(4));}
 return {model:'incompressible-navier-stokes-2d-channel',turbulenceModel:'none',boundaries:{x:'periodic',y:'no-slip walls (ghost-cell u, v=0 on wall faces)'},
  discretization:{grid:'MAC-staggered',advection:'conservative-central-2nd',viscous:'explicit-5-point',time:'SSP-RK3-stagewise-projection',pressure:'FFT-x + Neumann-tridiagonal-y exact discrete poisson'},
  cellsX:nx,cellsY:ny,length,height,gridSpacing:[hx,hy],kinematicViscosity:nu,bottomVelocity,topVelocity,bodyForce,
  stability:{viscousStableTimeStep,rk3RealAxisLimit:RK3_REAL_AXIS_LIMIT,maxViscousNumberUsed:maxDt*4*nu*(1/(hx*hx)+1/(hy*hy))},
  time,steps,timeStep:{min:minDt,max:maxDt},initialMaxAbsDivergence:initialDivergence,u,v,history};}

// Exact startup solutions u(y,t), v=0, for a fluid initially at rest (Fourier series, H=height).
export function startupCouetteExact(nu,t,{height=1,topVelocity=1,terms=4000}={}){return y=>{let s=0;for(let n=1;n<=terms;n++)s+=(n%2?1:-1)/n*Math.sin(n*Math.PI*y/height)*Math.exp(-n*n*Math.PI*Math.PI*nu*t/(height*height));return topVelocity*(y/height-2/Math.PI*s);};}
export function startupPoiseuilleExact(nu,t,{height=1,bodyForce=1,terms=4000}={}){return y=>{let s=0;for(let n=1;n<=terms;n+=2)s+=4*height*height/(n**3*Math.PI**3)*Math.sin(n*Math.PI*y/height)*Math.exp(-n*n*Math.PI*Math.PI*nu*t/(height*height));return bodyForce/nu*(y*(height-y)/2-s);};}

// Relative discrete L2 error of u (and absolute max |v|) against an exact u(y) profile.
export function channelVelocityError(result,exactU){const {cellsX:nx,cellsY:ny,gridSpacing:[,hy],u,v}=result;let err=0,ref=0,maxV=0;
 for(let j=0;j<ny;j++){const e=exactU((j+.5)*hy);for(let i=0;i<nx;i++){err+=(u[j*nx+i]-e)**2;ref+=e*e;}}
 for(const value of v)maxV=Math.max(maxV,Math.abs(value));
 return {relativeL2:Math.sqrt(err/Math.max(ref,1e-300)),maxAbsV:maxV};}
