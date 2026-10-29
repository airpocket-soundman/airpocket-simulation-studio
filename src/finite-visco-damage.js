// Synthetic isotropic scalar damage on top of the finite-visco-prf-j2.js material point (strain equivalence):
// tau = (1 - d) tau_eff, with the effective Prony-viscous + J2 response unchanged. Driver Y = effective stored
// energy density, history r = max Y, exponential law d = 1 - exp(-<r - Y0>/Yf), so d stays in [0,1) and never decreases.
// Local material point only: no mesh regularization (characteristic length / fracture energy), no
// tension-compression split, no element deletion, no calibration.
import {initFiniteViscoPrfJ2,stepFiniteViscoPrfJ2,runFiniteViscoPrfJ2Uniaxial} from './finite-visco-prf-j2.js';
export const FINITE_VISCO_DAMAGE_LIMITS=Object.freeze({minEnergyDensity:1e-6,maxEnergyDensity:1e12});
const MODEL='synthetic-hencky-prony-j2-scalar-damage-v1';
const fail=message=>{throw Error('FINITE_VISCO_DAMAGE: '+message);};
const finite=Number.isFinite,plain=x=>x!==null&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const UNSUPPORTED=['characteristicLengthM','fractureEnergyJPerM2','regularization','tensionCompressionSplit','elementDeletion','damageRateSeconds'];
function record(x,keys){if(!plain(x)||Reflect.ownKeys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k))||Reflect.ownKeys(x).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value')))fail('exact data fields required');}
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
const checkFlags=input=>{if(input.synthetic!==true||input.provisional!==true||input.calibrated!==false)fail('synthetic provisional uncalibrated flags required');};
/** Splits the damage block off the PRF-J2 parameters; unsupported combinations are rejected by name. */
function split(p){if(!plain(p))fail('exact data fields required');const {damage,...base}=p;if(!plain(damage))fail('damage block required');
 const bad=UNSUPPORTED.find(k=>Object.hasOwn(damage,k)||Object.hasOwn(base,k));if(bad)fail('unsupported combination: '+bad+' (mesh regularization, split, deletion and rate damage not implemented)');
 record(damage,['thresholdEnergyDensity','softeningEnergyDensity']);const {thresholdEnergyDensity:Y0,softeningEnergyDensity:Yf}=damage;
 if(![Y0,Yf].every(v=>finite(v)&&v>=1e-6&&v<=1e12))fail('damage envelope exceeded');return {base,Y0,Yf};}
const law=(r,Y0,Yf)=>r<=Y0?0:1-Math.exp(-(r-Y0)/Yf);
/**
 * Damage update from the effective step. Bookkeeping keeps W = (1-d) psi_eff + D: viscous and plastic
 * increments scale by (1-d_{n+1}); damage dissipation increment is Y_mid * (d_{n+1} - d_n) (trapezoid).
 */
function advance(s,Y,dVisc,dPlast){const r=Math.max(s.r,Y),d=law(r,s.Y0,s.Yf),w=1-d;if(!(d>=s.d&&d<1))fail('damage monotonicity failed');
 return {r,d,Y,damageDissipationDensity:s.damageDissipationDensity+(s.Y+Y)/2*(d-s.d),viscousDissipationDensity:s.viscousDissipationDensity+w*dVisc,plasticDissipationDensity:s.plasticDissipationDensity+w*dPlast};}
/** Initial (virgin, d = 0) state for the general-F stepping API. */
export function initFiniteViscoDamage(input){record(input,['synthetic','provisional','calibrated','parameters']);checkFlags(input);const {base,Y0,Yf}=split(input.parameters);
 const effective=initFiniteViscoPrfJ2({synthetic:true,provisional:true,calibrated:false,parameters:base});
 return freeze({model:MODEL,synthetic:true,provisional:true,calibrated:false,Y0,Yf,effective,r:0,d:0,Y:0,damageDissipationDensity:0,viscousDissipationDensity:0,plasticDissipationDensity:0});}
/** Advance a frozen state to a new full deformation gradient F. */
export function stepFiniteViscoDamage(input){record(input,['state','F','dtSeconds']);const s=input.state;if(!plain(s)||s.model!==MODEL||s.calibrated!==false||!Object.isFrozen(s))fail('state from initFiniteViscoDamage required');
 const e=stepFiniteViscoPrfJ2({state:s.effective,F:input.F,dtSeconds:input.dtSeconds}),o=e.observation;
 const n=advance(s,o.storedEnergyDensity,e.state.viscousDissipationDensity-s.effective.viscousDissipationDensity,e.state.plasticDissipationDensity-s.effective.plasticDissipationDensity),w=1-n.d;
 return freeze({state:{...s,...n,effective:e.state},observation:{cauchyPa:o.cauchyPa.map(r=>r.map(x=>w*x)),kirchhoffPa:o.kirchhoffPa.map(r=>r.map(x=>w*x)),J:o.J,damage:n.d,damageDriverEnergyDensity:o.storedEnergyDensity,storedEnergyDensity:w*o.storedEnergyDensity,plasticLogStrain:o.plasticLogStrain,equivalentPlasticStrain:o.equivalentPlasticStrain},increment:{plasticIncrement:e.increment.plasticIncrement,damageIncrement:n.d-s.d}});}
/**
 * Strain-controlled traction-free uniaxial protocol. With strain equivalence sigma22 = 0 iff the effective sigma22 = 0,
 * so the effective PRF-J2 path is solved once and damage is applied row by row.
 */
export function runFiniteViscoDamageUniaxial(input){record(input,['synthetic','provisional','calibrated','parameters','segments']);checkFlags(input);const {base,Y0,Yf}=split(input.parameters);
 const eff=runFiniteViscoPrfJ2Uniaxial({synthetic:true,provisional:true,calibrated:false,parameters:base,segments:input.segments});
 let s={Y0,Yf,r:0,d:0,Y:0,damageDissipationDensity:0,viscousDissipationDensity:0,plasticDissipationDensity:0},prev={viscousDissipationDensity:0,plasticDissipationDensity:0};
 const rows=eff.rows.map(x=>{s={...s,...advance(s,x.storedEnergyDensity,x.viscousDissipationDensity-prev.viscousDissipationDensity,x.plasticDissipationDensity-prev.plasticDissipationDensity)};prev=x;const w=1-s.d;
  return {step:x.step,segment:x.segment,timeSeconds:x.timeSeconds,axialGreenStrain:x.axialGreenStrain,axialStretch:x.axialStretch,lateralStretch:x.lateralStretch,J:x.J,sigma11Pa:w*x.sigma11Pa,sigma22Pa:w*x.sigma22Pa,P11Pa:w*x.P11Pa,effectiveSigma11Pa:x.sigma11Pa,damage:s.d,damageDriverEnergyDensity:x.storedEnergyDensity,plasticAxialLogStrain:x.plasticAxialLogStrain,equivalentPlasticStrain:x.equivalentPlasticStrain,storedEnergyDensity:w*x.storedEnergyDensity,viscousDissipationDensity:s.viscousDissipationDensity,plasticDissipationDensity:s.plasticDissipationDensity,damageDissipationDensity:s.damageDissipationDensity};});
 const last=rows.at(-1),peak=rows.reduce((a,x)=>x.P11Pa>a.P11Pa?x:a,rows[0]);
 return freeze({model:MODEL,synthetic:true,provisional:true,calibrated:false,meaning:'strain-controlled-uniaxial-stress-material-point',kinematics:eff.kinematics,damageModel:'isotropic-scalar-strain-equivalence-energy-driven-exponential',regularization:'none-local-material-point-mesh-dependent',stressMeasure:eff.stressMeasure,units:eff.units,rows,segmentEnds:eff.segmentEnds,
  summary:{steps:rows.length,finalTimeSeconds:last.timeSeconds,finalDamage:last.damage,peakP11Pa:peak.P11Pa,peakAxialGreenStrain:peak.axialGreenStrain,storedEnergyDensity:last.storedEnergyDensity,viscousDissipationDensity:last.viscousDissipationDensity,plasticDissipationDensity:last.plasticDissipationDensity,damageDissipationDensity:last.damageDissipationDensity,note:'synthetic local scalar damage; softening is mesh dependent in a structure because no characteristic-length or fracture-energy regularization exists; no tension-compression split, deletion or calibration'}});}
