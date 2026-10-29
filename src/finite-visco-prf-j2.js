// Synthetic PRF-like finite-strain material point: the Hencky Prony viscous network of
// finite-visco-hencky-multiplicative.js in parallel with an equilibrium network whose deviatoric part is
// J2 elastoplastic with linear isotropic hardening (F = Fe Fp, exponential-map radial return in principal
// log space on Kirchhoff stress). Same stretch/J/dt-tau envelope; no element, damage, necking or calibration.
import {initFiniteViscoHencky,stepFiniteViscoHencky} from './finite-visco-hencky-multiplicative.js';
export const FINITE_VISCO_PRF_J2_LIMITS=Object.freeze({branches:8,segments:64,steps:4096,minStretch:.95,maxStretch:1.05,minJ:.85,maxJ:1.16,minYieldStressPa:1,maxYieldStressPa:1e12,maxHardeningRatio:10});
const MODEL='synthetic-hencky-prony-parallel-j2-v1';
const fail=message=>{throw Error('FINITE_VISCO_PRF_J2: '+message);};
const finite=Number.isFinite,plain=x=>x!==null&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function record(x,keys){if(!plain(x)||Reflect.ownKeys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k))||Reflect.ownKeys(x).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value')))fail('exact data fields required');}
const list=(x,max,label)=>{if(!Array.isArray(x)||Object.getPrototypeOf(x)!==Array.prototype||x.length<1||x.length>max||Reflect.ownKeys(x).length!==x.length+1)fail(label+' count envelope exceeded');return x;};
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
const I=()=>[[1,0,0],[0,1,0],[0,0,1]];
const mul=(a,b)=>a.map((r,i)=>[0,1,2].map(j=>r[0]*b[0][j]+r[1]*b[1][j]+r[2]*b[2][j]));
const transpose=a=>[0,1,2].map(i=>a.map(r=>r[i]));
const det=a=>a[0][0]*(a[1][1]*a[2][2]-a[1][2]*a[2][1])-a[0][1]*(a[1][0]*a[2][2]-a[1][2]*a[2][0])+a[0][2]*(a[1][0]*a[2][1]-a[1][1]*a[2][0]);
function inv(a){const d=det(a);if(!finite(d)||Math.abs(d)<1e-300)fail('singular deformation gradient');const c=(i,j)=>{const r=[0,1,2].filter(k=>k!==i),s=[0,1,2].filter(k=>k!==j);return (-1)**(i+j)*(a[r[0]][s[0]]*a[r[1]][s[1]]-a[r[0]][s[1]]*a[r[1]][s[0]]);};return [0,1,2].map(i=>[0,1,2].map(j=>c(j,i)/d));}
/** Cyclic Jacobi eigen-decomposition of a symmetric 3x3 matrix; columns of V are eigenvectors. */
function eig(a){const A=a.map(r=>[...r]),V=I();for(let sweep=0;sweep<50;sweep++){const off=A[0][1]**2+A[0][2]**2+A[1][2]**2;if(off<=1e-30*(A[0][0]**2+A[1][1]**2+A[2][2]**2)+1e-300)break;for(const [p,q]of[[0,1],[0,2],[1,2]]){if(A[p][q]===0)continue;const th=(A[q][q]-A[p][p])/(2*A[p][q]),t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)),c=1/Math.sqrt(t*t+1),s=t*c;for(let k=0;k<3;k++){const akp=A[k][p],akq=A[k][q];A[k][p]=c*akp-s*akq;A[k][q]=s*akp+c*akq;}for(let k=0;k<3;k++){const apk=A[p][k],aqk=A[q][k];A[p][k]=c*apk-s*aqk;A[q][k]=s*apk+c*aqk;}for(let k=0;k<3;k++){const vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq;}}}return {values:[A[0][0],A[1][1],A[2][2]],V};}
const spectral=(values,V)=>[0,1,2].map(i=>[0,1,2].map(j=>values.reduce((s,v,k)=>s+v*V[i][k]*V[j][k],0)));
const sym=a=>[0,1,2].map(i=>[0,1,2].map(j=>(a[i][j]+a[j][i])/2));
function logStrain(b){const {values,V}=eig(sym(b));if(values.some(v=>!(v>0)))fail('left Cauchy-Green not positive definite');return {eps:values.map(v=>Math.log(v)/2),V};}
const devPart=e=>{const m=(e[0]+e[1]+e[2])/3;return e.map(v=>v-m);};
const norm2=e=>e.reduce((s,v)=>s+v*v,0);
const add=(a,b,f=1)=>a.map((r,i)=>r.map((v,j)=>v+f*b[i][j]));
const checkFlags=input=>{if(input.synthetic!==true||input.provisional!==true||input.calibrated!==false)fail('synthetic provisional uncalibrated flags required');};
function parameters(p){record(p,['bulkModulusPa','equilibriumShearModulusPa','branches','plasticity']);const {plasticity:j2,...visco}=p;record(j2,['yieldStressPa','hardeningModulusPa']);const {yieldStressPa:sy,hardeningModulusPa:H}=j2;
 if(!finite(sy)||sy<1||sy>1e12||!finite(H)||H<=0||!finite(visco.equilibriumShearModulusPa)||H>10*visco.equilibriumShearModulusPa)fail('plasticity envelope exceeded');
 // Validates K, mu, branches with the inherited Hencky Prony envelope (throws FINITE_VISCO_HENCKY on violation).
 const viscoState=initFiniteViscoHencky({synthetic:true,provisional:true,calibrated:false,parameters:{bulkModulusPa:visco.bulkModulusPa,equilibriumShearModulusPa:visco.equilibriumShearModulusPa,branches:visco.branches.map(b=>({...b}))}});
 return {viscoState,mu:visco.equilibriumShearModulusPa,sy,H};}
/**
 * One step. Viscous network: stepFiniteViscoHencky (its equilibrium term K tr(eps) I + 2 mu dev(eps_total) is
 * replaced below by the plastic network's 2 mu dev(eps_e,p)). Plastic network: be_tr = f be_p f^T,
 * q_tr = sqrt(3/2)|2 mu dev eps_tr|, dgamma = <q_tr - (sy + H kappa)>/(3 mu + H), dev eps_e = dev eps_tr (1 - 3 mu dgamma/q_tr).
 * Plastic dissipation increment sy*dgamma (H kappa^2/2 is stored hardening energy), matching j2Return.
 */
function step(p,state,F1,dt){if(!Array.isArray(F1)||F1.length!==3||F1.some(r=>!Array.isArray(r)||r.length!==3||r.some(v=>!finite(v))))fail('F must be a finite 3x3 matrix');const F=F1.map(r=>[...r]),f=mul(F,inv(state.F));
 const v=stepFiniteViscoHencky({state:state.visco,F,dtSeconds:dt}),total=logStrain(mul(F,transpose(F))),dTotal=devPart(total.eps);
 const tr=logStrain(mul(mul(f,state.bp),transpose(f))),dTr=devPart(tr.eps),qTr=Math.sqrt(1.5)*2*p.mu*Math.sqrt(norm2(dTr)),yieldNow=p.sy+p.H*state.kappa,dgamma=Math.max(0,(qTr-yieldNow)/(3*p.mu+p.H)),scale=dgamma?1-3*p.mu*dgamma/qTr:1,dE=dTr.map(x=>x*scale),mE=(tr.eps[0]+tr.eps[1]+tr.eps[2])/3;
 const bp=spectral(dE.map(x=>Math.exp(2*(x+mE))),tr.V),kappa=state.kappa+dgamma,plasticDissipation=p.sy*dgamma;
 const tau=add(add(v.observation.kirchhoffPa,spectral(dTotal.map(x=>2*p.mu*x),total.V),-1),spectral(dE.map(x=>2*p.mu*x),tr.V)),J=v.observation.J;
 const stored=v.observation.storedEnergyDensity-p.mu*norm2(dTotal)+p.mu*norm2(dE)+p.H*kappa*kappa/2;if(![stored,plasticDissipation].every(finite)||plasticDissipation<0)fail('nonnegative dissipation failed');
 return {state:{F,visco:v.state,bp,kappa,timeSeconds:v.state.timeSeconds,viscousDissipationDensity:v.state.cumulativeDissipationDensity,plasticDissipationDensity:state.plasticDissipationDensity+plasticDissipation},kirchhoffPa:tau,cauchyPa:tau.map(r=>r.map(x=>x/J)),J,storedEnergyDensity:stored,plasticIncrement:dgamma,
  // Plastic log strain of the plastic network: total log strain minus its elastic log strain (both in the spatial frame).
  plasticLogStrain:add(spectral(total.eps,total.V),spectral(dE.map(x=>x+mE),tr.V),-1)};}
/** Initial (virgin) state for the general-F stepping API. */
export function initFiniteViscoPrfJ2(input){record(input,['synthetic','provisional','calibrated','parameters']);checkFlags(input);const p=parameters(input.parameters);
 return freeze({model:MODEL,synthetic:true,provisional:true,calibrated:false,parameters:{sy:p.sy,H:p.H,mu:p.mu},F:I(),visco:p.viscoState,bp:I(),kappa:0,timeSeconds:0,viscousDissipationDensity:0,plasticDissipationDensity:0});}
/** Advance a frozen state to a new full deformation gradient F (any rotation allowed; principal stretches within envelope). */
export function stepFiniteViscoPrfJ2(input){record(input,['state','F','dtSeconds']);const s=input.state;if(!plain(s)||s.model!==MODEL||s.calibrated!==false||!Object.isFrozen(s))fail('state from initFiniteViscoPrfJ2 required');
 const r=step(s.parameters,s,input.F,input.dtSeconds);
 return freeze({state:{...s,...r.state},observation:{cauchyPa:r.cauchyPa,kirchhoffPa:r.kirchhoffPa,J:r.J,storedEnergyDensity:r.storedEnergyDensity,plasticLogStrain:r.plasticLogStrain,equivalentPlasticStrain:r.state.kappa},increment:{plasticIncrement:r.plasticIncrement}});}
function lateralSolve(p,state,axial,dt){const at=l=>step(p,state,[[axial,0,0],[0,l,0],[0,0,l]],dt),g=l=>{try{return at(l).cauchyPa[1][1];}catch{return NaN;}};let lo=Math.max(.95,Math.sqrt(.85/axial)),hi=Math.min(1.05,Math.sqrt(1.16/axial)),glo=g(lo),ghi=g(hi);if(!(glo<0&&ghi>0))fail('lateral traction-free stretch outside envelope');let l=(lo+hi)/2;for(let n=0;n<200;n++){l=lo-glo*(hi-lo)/(ghi-glo);if(!(l>lo&&l<hi))l=(lo+hi)/2;const gl=g(l);if(Math.abs(gl)<=1e-12*Math.max(1,Math.abs(glo),Math.abs(ghi))||hi-lo<1e-15)break;if(gl<0){lo=l;glo=gl;ghi/=2;}else{hi=l;ghi=gl;glo/=2;}}return {lateral:l,...at(l)};}
/**
 * Strain-controlled axial protocol (ramps/holds in axial Green strain E11), traction-free lateral faces.
 * Rows carry the plastic axial log strain; it equals the residual axial log strain at zero stress once viscous branches relax.
 */
export function runFiniteViscoPrfJ2Uniaxial(input){record(input,['synthetic','provisional','calibrated','parameters','segments']);checkFlags(input);const p=parameters(input.parameters),segments=list(input.segments,64,'segment').map(s=>{record(s,['toAxialGreenStrain','durationSeconds','steps']);if(!finite(s.toAxialGreenStrain)||!finite(s.durationSeconds)||s.durationSeconds<=0||!Number.isInteger(s.steps)||s.steps<1)fail('segment fields invalid');return {...s};});if(segments.reduce((n,s)=>n+s.steps,0)>4096)fail('step capacity exceeded');
 let state={F:I(),visco:p.viscoState,bp:I(),kappa:0,timeSeconds:0,viscousDissipationDensity:0,plasticDissipationDensity:0},E=0,n_=0;const rows=[],segmentEnds=[];
 for(const [index,s]of segments.entries()){const from=E,dt=s.durationSeconds/s.steps;for(let n=1;n<=s.steps;n++){E=from+(s.toAxialGreenStrain-from)*n/s.steps;if(!(1+2*E>0))fail('stretch or J envelope exceeded');const axial=Math.sqrt(1+2*E),r=lateralSolve(p,state,axial,dt);state=r.state;n_++;const sigma=r.cauchyPa[0][0];
  rows.push({step:n_,segment:index,timeSeconds:state.timeSeconds,axialGreenStrain:E,axialStretch:axial,lateralStretch:r.lateral,J:r.J,sigma11Pa:sigma,sigma22Pa:r.cauchyPa[1][1],P11Pa:sigma*r.lateral**2,plasticAxialLogStrain:r.plasticLogStrain[0][0],equivalentPlasticStrain:state.kappa,storedEnergyDensity:r.storedEnergyDensity,viscousDissipationDensity:state.viscousDissipationDensity,plasticDissipationDensity:state.plasticDissipationDensity});}segmentEnds.push(rows.length-1);}
 const last=rows.at(-1);
 return freeze({model:MODEL,synthetic:true,provisional:true,calibrated:false,meaning:'strain-controlled-uniaxial-stress-material-point',kinematics:'viscous-F=FeFv-parallel-plastic-F=FeFp-hencky-exponential-return',stressMeasure:{sigma11Pa:'Cauchy',P11Pa:'first-Piola-nominal'},units:{time:'s',stress:'Pa',energyDensity:'J/m3-reference'},rows,segmentEnds,
  summary:{steps:rows.length,finalTimeSeconds:state.timeSeconds,viscousDissipationDensity:state.viscousDissipationDensity,plasticDissipationDensity:state.plasticDissipationDensity,storedEnergyDensity:last.storedEnergyDensity,equivalentPlasticStrain:state.kappa,permanentPlasticAxialLogStrain:last.plasticAxialLogStrain,note:'synthetic J2 isotropic hardening equilibrium network in parallel with Prony viscous branches; no damage, softening, necking or calibration'}});}
