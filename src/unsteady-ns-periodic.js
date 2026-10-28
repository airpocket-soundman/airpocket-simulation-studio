// Transient incompressible Navier-Stokes on a doubly periodic 2D square (CFD2 first step).
// Staggered MAC grid, conservative second-order central advection, explicit viscous term,
// SSP-RK3 (Shu & Osher 1988) with an exact FFT pressure projection after every stage.
// Laminar verification kernel only: no walls, no turbulence model, not connected to the GUI/API.

const finitePositive=v=>Number.isFinite(v)&&v>0;

function fft(re,im,inverse){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let size=2;size<=n;size<<=1){const angle=(inverse?2:-2)*Math.PI/size,wr=Math.cos(angle),wi=Math.sin(angle);for(let start=0;start<n;start+=size){let cr=1,ci=0;for(let k=0;k<size/2;k++){const a=start+k,b=a+size/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=next;}}}
 if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}

function fft2(re,im,n,inverse){const rr=new Float64Array(n),ri=new Float64Array(n);
 for(let j=0;j<n;j++){for(let i=0;i<n;i++){rr[i]=re[j*n+i];ri[i]=im[j*n+i];}fft(rr,ri,inverse);for(let i=0;i<n;i++){re[j*n+i]=rr[i];im[j*n+i]=ri[i];}}
 for(let i=0;i<n;i++){for(let j=0;j<n;j++){rr[j]=re[j*n+i];ri[j]=im[j*n+i];}fft(rr,ri,inverse);for(let j=0;j<n;j++){re[j*n+i]=rr[j];im[j*n+i]=ri[j];}}}

// Index helpers: field[j*n+i], periodic wrap.
const wrap=(k,n)=>(k%n+n)%n;

function divergence(u,v,n,h,out){for(let j=0;j<n;j++)for(let i=0;i<n;i++)out[j*n+i]=(u[j*n+wrap(i+1,n)]-u[j*n+i]+v[wrap(j+1,n)*n+i]-v[j*n+i])/h;return out;}

// Removes the discrete-divergence part of (u,v) in place; the discrete Laplacian D*G is diagonal in Fourier space.
function project(u,v,n,h,work){const {re,im,eigen}=work;divergence(u,v,n,h,re);im.fill(0);fft2(re,im,n,false);
 for(let k=0;k<n*n;k++){if(eigen[k]===0){re[k]=0;im[k]=0;}else{re[k]/=eigen[k];im[k]/=eigen[k];}}
 fft2(re,im,n,true);const phi=re;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){u[j*n+i]-=(phi[j*n+i]-phi[j*n+wrap(i-1,n)])/h;v[j*n+i]-=(phi[j*n+i]-phi[wrap(j-1,n)*n+i])/h;}
 return phi;}

function rhs(u,v,n,h,nu,du,dv){const c=1/h,d=nu/(h*h);
 for(let j=0;j<n;j++){const jm=wrap(j-1,n),jp=wrap(j+1,n);for(let i=0;i<n;i++){const im=wrap(i-1,n),ip=wrap(i+1,n),k=j*n+i;
  // u-momentum at face (i h,(j+1/2) h)
  const ucE=(u[k]+u[j*n+ip])/2,ucW=(u[j*n+im]+u[k])/2;
  const uvN=(u[k]+u[jp*n+i])/2*(v[jp*n+im]+v[jp*n+i])/2,uvS=(u[jm*n+i]+u[k])/2*(v[j*n+im]+v[k])/2;
  du[k]=-(ucE*ucE-ucW*ucW)*c-(uvN-uvS)*c+d*(u[j*n+ip]+u[j*n+im]+u[jp*n+i]+u[jm*n+i]-4*u[k]);
  // v-momentum at face ((i+1/2) h,j h)
  const vcN=(v[k]+v[jp*n+i])/2,vcS=(v[jm*n+i]+v[k])/2;
  const uvE=(u[jm*n+ip]+u[j*n+ip])/2*(v[k]+v[j*n+ip])/2,uvW=(u[jm*n+i]+u[k])/2*(v[j*n+im]+v[k])/2;
  dv[k]=-(uvE-uvW)*c-(vcN*vcN-vcS*vcS)*c+d*(v[j*n+ip]+v[j*n+im]+v[jp*n+i]+v[jm*n+i]-4*v[k]);}}}

function diagnostics(u,v,n,h,work){let energy=0,meanU=0,meanV=0,maxDiv=0,maxSpeed=0;const div=divergence(u,v,n,h,work.scratch);
 for(let k=0;k<n*n;k++){energy+=u[k]*u[k]+v[k]*v[k];meanU+=u[k];meanV+=v[k];maxDiv=Math.max(maxDiv,Math.abs(div[k]));maxSpeed=Math.max(maxSpeed,Math.abs(u[k]),Math.abs(v[k]));}
 return {kineticEnergy:energy*h*h/2,meanVelocity:[meanU/(n*n),meanV/(n*n)],maxAbsDivergence:maxDiv,maxVelocityComponent:maxSpeed};}

// options: {cells (power of two 8..256), length, kinematicViscosity, initialVelocity:(x,y)=>[u,v], endTime,
//  cfl=0.4, diffusionNumber=0.2, maxSteps=200000, maxSeconds=60, historyEvery, onProgress, now}
export function solvePeriodicUnsteadyNS(options={}){
 const {cells:n,length=2*Math.PI,kinematicViscosity:nu,initialVelocity,endTime,cfl=.4,diffusionNumber=.2,maxSteps=200000,maxSeconds=60,onProgress=()=>{},now=()=>performance.now(),fixedTimeStep}=options;
 if(!Number.isInteger(n)||n<8||n>256||(n&(n-1)))throw Error('Periodic NS requires cells to be a power of two between 8 and 256');
 if(!finitePositive(length)||!finitePositive(nu)||!finitePositive(endTime)||typeof initialVelocity!=='function')throw Error('Periodic NS requires positive length, kinematic viscosity, end time and an initial velocity function');
 if(!finitePositive(cfl)||cfl>1||!finitePositive(diffusionNumber)||diffusionNumber>.25||!Number.isInteger(maxSteps)||maxSteps<1||!finitePositive(maxSeconds))throw Error('Invalid periodic NS stability or budget settings');
 if(fixedTimeStep!==undefined&&!finitePositive(fixedTimeStep))throw Error('Periodic NS fixedTimeStep must be positive');
 const h=length/n,size=n*n,u=new Float64Array(size),v=new Float64Array(size);
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){u[j*n+i]=initialVelocity(i*h,(j+.5)*h)[0];v[j*n+i]=initialVelocity((i+.5)*h,j*h)[1];}
 if(![...u,...v].every(Number.isFinite))throw Error('Periodic NS initial velocity must be finite');
 const eigen=new Float64Array(size);for(let l=0;l<n;l++)for(let k=0;k<n;k++){const sx=Math.sin(Math.PI*k/n),sy=Math.sin(Math.PI*l/n);eigen[l*n+k]=-4*(sx*sx+sy*sy)/(h*h);}
 const work={re:new Float64Array(size),im:new Float64Array(size),eigen,scratch:new Float64Array(size)};
 const initialDivergence=diagnostics(u,v,n,h,work).maxAbsDivergence;project(u,v,n,h,work);
 const du=new Float64Array(size),dv=new Float64Array(size),u0=new Float64Array(size),v0=new Float64Array(size),started=now(),history=[{time:0,...diagnostics(u,v,n,h,work)}];
 const diffusionLimit=diffusionNumber*h*h/nu;let time=0,steps=0,minDt=Infinity,maxDt=0;
 while(time<endTime*(1-1e-12)){
  if(steps>=maxSteps)throw Error('Periodic NS step limit reached before endTime; no result returned');
  if(now()-started>maxSeconds*1000)throw Error('Periodic NS time budget exceeded; no result returned');
  const speed=history.at(-1).maxVelocityComponent;let dt=fixedTimeStep??Math.min(diffusionLimit,speed>0?cfl*h/speed:Infinity);dt=Math.min(dt,endTime-time);
  u0.set(u);v0.set(v);
  // SSP-RK3 stages: a*q0 + b*(q + dt*L(q)), each followed by projection.
  for(const [a,b] of [[0,1],[.75,.25],[1/3,2/3]]){rhs(u,v,n,h,nu,du,dv);for(let k=0;k<size;k++){u[k]=a*u0[k]+b*(u[k]+dt*du[k]);v[k]=a*v0[k]+b*(v[k]+dt*dv[k]);}project(u,v,n,h,work);}
  time+=dt;steps++;minDt=Math.min(minDt,dt);maxDt=Math.max(maxDt,dt);
  const diag={time,...diagnostics(u,v,n,h,work)};
  if(!Number.isFinite(diag.kineticEnergy))throw Error('Periodic NS produced a non-finite field; no result returned');
  history.push(diag);if(steps%50===0)onProgress('Periodic NS step '+steps+' t='+time.toPrecision(4));}
 return {model:'incompressible-navier-stokes-2d-periodic',turbulenceModel:'none',discretization:{grid:'MAC-staggered',advection:'conservative-central-2nd',viscous:'explicit-5-point',time:'SSP-RK3-stagewise-projection',pressure:'FFT-exact-discrete-poisson'},
  cells:n,length,gridSpacing:h,kinematicViscosity:nu,time,steps,timeStep:{min:minDt,max:maxDt},initialMaxAbsDivergence:initialDivergence,u,v,history,
  sample:(field,x,y)=>field==='u'?u[wrap(Math.round(y/h-.5),n)*n+wrap(Math.round(x/h),n)]:v[wrap(Math.round(y/h),n)*n+wrap(Math.round(x/h-.5),n)]};}

// Exact references on [0,2pi)^2.
export const taylorGreenExact=(nu,t)=>(x,y)=>{const f=Math.exp(-2*nu*t);return [Math.sin(x)*Math.cos(y)*f,-Math.cos(x)*Math.sin(y)*f];};
export const shearWaveExact=(nu,t,k=1,amplitude=1)=>(x,y)=>[amplitude*Math.sin(k*y)*Math.exp(-nu*k*k*t),0];

// Relative discrete L2 error of the staggered velocity against an exact field.
export function velocityError(result,exact){const {cells:n,gridSpacing:h,u,v}=result;let err=0,ref=0;
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const eu=exact(i*h,(j+.5)*h)[0],ev=exact((i+.5)*h,j*h)[1];err+=(u[j*n+i]-eu)**2+(v[j*n+i]-ev)**2;ref+=eu*eu+ev*ev;}
 return Math.sqrt(err/Math.max(ref,1e-300));}

export const observedOrder=(coarseError,fineError,ratio=2)=>Math.log(coarseError/fineError)/Math.log(ratio);
