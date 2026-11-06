// Synthetic, x-uniform tangential-wall verification only. The real channel solver is
// advanced through channelShearFluid, without changing its SSP-RK3 implementation.
import {channelShearFluid} from './fsi-channel-shear-plate.js';

export const AVERAGE_FORCE_LIMITS=Object.freeze({steps:4096,microsteps:4096,cellSteps:2000000});
const fail=code=>{throw Object.assign(Error(code),{code});};
const finite=(x)=>{if(!Number.isFinite(x))fail('FSI_AVERAGE_NONFINITE');return x;};
function record(value,allowed,required){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)fail('FSI_AVERAGE_INPUT');
 const keys=Reflect.ownKeys(value);
 if(keys.length>allowed.length||keys.some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))fail('FSI_AVERAGE_INPUT');
 const copy={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d.enumerable||!Object.hasOwn(d,'value'))fail('FSI_AVERAGE_INPUT');copy[k]=d.value;}return copy;
}
function snapshot(raw){
 const p=record(raw,['schemaVersion','method','fluid','plate','initialDisplacement','initialProfile','dt','steps','microsteps'],['schemaVersion','method','fluid','plate','initialDisplacement','dt','steps','microsteps']);
 if(p.schemaVersion!==1||p.method!=='time-averaged-midpoint')fail('FSI_AVERAGE_VERSION');
 p.fluid=record(p.fluid,['cellsY','height','density','kinematicViscosity','cellsX','length'],['cellsY','height','density','kinematicViscosity']);
 p.plate=record(p.plate,['mass','stiffness'],['mass','stiffness']);
 if(!Number.isFinite(p.plate.mass)||p.plate.mass<=0||!Number.isFinite(p.plate.stiffness)||p.plate.stiffness<0)fail('FSI_AVERAGE_INPUT');
 finite(p.initialDisplacement);
 if(!Number.isFinite(p.dt)||p.dt<=0||!Number.isInteger(p.steps)||p.steps<1||p.steps>AVERAGE_FORCE_LIMITS.steps||!Number.isInteger(p.microsteps)||p.microsteps<1||p.microsteps>AVERAGE_FORCE_LIMITS.microsteps)fail('FSI_AVERAGE_CAPACITY');
 if(!Number.isFinite(p.steps*p.dt)||p.steps*p.dt<=0||p.dt/p.microsteps===0)fail('FSI_AVERAGE_NONFINITE');
 // Validate the grid before allocating/copying the initial profile.
 const fluid=channelShearFluid(p.fluid);p.fluid={...fluid.parameters};
 const h=p.dt/p.microsteps,internal=Math.max(1,Math.ceil(h/(.5*fluid.stableDt)));
 // Three actual fluid responses per macrostep (zero/probe/final). No unbounded iterations.
 if(!Number.isSafeInteger(internal)||internal>20000||3*p.steps*p.microsteps*internal*p.fluid.cellsX*p.fluid.cellsY>AVERAGE_FORCE_LIMITS.cellSteps)fail('FSI_AVERAGE_CAPACITY');
 let profile=new Array(fluid.cellsY).fill(0);
 if(p.initialProfile!==undefined){
  if(!Array.isArray(p.initialProfile)||Object.getPrototypeOf(p.initialProfile)!==Array.prototype||Object.getOwnPropertyDescriptor(p.initialProfile,'length')?.value!==fluid.cellsY)fail('FSI_AVERAGE_PROFILE');
  for(let j=0;j<fluid.cellsY;j++){const d=Object.getOwnPropertyDescriptor(p.initialProfile,String(j));if(!d||!Object.hasOwn(d,'value')||!Number.isFinite(d.value))fail('FSI_AVERAGE_PROFILE');profile[j]=d.value;}
 }
 p.initialProfile=Object.freeze(profile);Object.freeze(p.fluid);Object.freeze(p.plate);return {input:Object.freeze(p),fluid,h};
}
const sum=profile=>{let value=0;for(let j=0;j<profile.length;j++)value+=profile[j];return finite(value);};
const relative=(value,scale)=>scale===0?(value===0?0:fail('FSI_AVERAGE_ZERO_ENERGY')):finite(value/scale);

/** Validate/snapshot a configuration and its work bound without advancing a solver. */
export function inspectChannelAverageForceInput(raw){
 const {input,fluid,h}=snapshot(raw);return {input,work:{responseSolves:3*input.steps*input.microsteps,cellStepsUpperBound:3*input.steps*input.microsteps*Math.max(1,Math.ceil(h/(.5*fluid.stableDt)))*fluid.parameters.cellsX*fluid.cellsY}};
}

/** Input-only JSON reload: always recomputes from the saved initial state. No result/state restore. */
export function runChannelAverageForce(raw){
 const {input,fluid,h}=snapshot(raw),{dt,steps,microsteps,plate}=input;
 const energy=(d,v)=>finite(.5*plate.mass*v*v+.5*plate.stiffness*d*d);
 let profile=Float64Array.from(input.initialProfile),d=input.initialDisplacement,v=0,dissipated=0,interfaceWork=0,maxXSpread=0;
 const initialEnergy=finite(energy(d,v)+fluid.kineticEnergy(profile));
 if(initialEnergy===0&&(plate.stiffness>0&&d!==0||profile.some(u=>u!==0)))fail('FSI_AVERAGE_ZERO_ENERGY');
 const history=[{t:0,d,v,fluidEnergy:fluid.kineticEnergy(profile),plateEnergy:energy(d,v),dissipated:0,interfaceWork:0,energyDefectJPerM2:0,energyDefect:0}];
 function march(start,V){
  let u=start,impulse=0,bottomImpulse=0,loss=0,spread=0;
  for(let i=0;i<microsteps;i++){
   const f0=fluid.shearOnPlate(u,V),b0=-2*fluid.mu*u[0]/fluid.hy,D0=fluid.dissipation(u,V);
   const next=fluid.advance(u,V,h);u=next.profile;spread=Math.max(spread,next.xSpread);
   impulse=finite(impulse+h*(f0+fluid.shearOnPlate(u,V))/2);
   bottomImpulse=finite(bottomImpulse+h*(b0-2*fluid.mu*u[0]/fluid.hy)/2);
   loss=finite(loss+h*(D0+fluid.dissipation(u,V))/2);
  }return {profile:u,force:finite(impulse/dt),impulse,bottomImpulse,loss,spread};
 }
 for(let n=0;n<steps;n++){
  // The laminar channel response is affine in its constant wall velocity. These
  // two probes use actual solver calls, not a replacement diffusion integrator.
  const probe=Math.max(1e-6,Math.abs(v),Math.abs(d/dt),...profile.map(Math.abs));finite(probe);
  const zero=march(profile,0),unit=march(profile,probe),slope=finite((unit.force-zero.force)/probe);
  const inertia=finite(2*plate.mass/dt),spring=finite(plate.stiffness*dt/2),denominator=finite(inertia+spring-slope);
  if(denominator<=0)fail('FSI_AVERAGE_RESPONSE');
  const V=finite((inertia*v-plate.stiffness*d+zero.force)/denominator),next=march(profile,V);
  const nextV=finite(2*V-v),nextD=finite(d+dt*V);
  const inertiaForce=finite(plate.mass*(nextV-v)/dt),springForce=finite(plate.stiffness*(d+nextD)/2);
  const residual=finite(inertiaForce+springForce-next.force),forceScale=Math.max(Math.abs(inertiaForce),Math.abs(springForce),Math.abs(next.force));
  const scaledResidual=relative(residual,forceScale);
  if(Math.abs(scaledResidual)>1e-9)fail('FSI_AVERAGE_RESPONSE');
  const work=finite(V*next.impulse),oldFE=fluid.kineticEnergy(profile),oldPE=energy(d,v),fe=fluid.kineticEnergy(next.profile),pe=energy(nextD,nextV);
  const fluidDefect=finite(fe-oldFE+next.loss+work),plateDefect=finite(pe-oldPE-work);
  const momentumDefect=finite(fluid.density*fluid.hy*(sum(next.profile)-sum(profile))+next.impulse-next.bottomImpulse);
  dissipated=finite(dissipated+next.loss);interfaceWork=finite(interfaceWork+work);maxXSpread=Math.max(maxXSpread,next.spread);
  const defect=finite(fe+pe+dissipated-initialEnergy);
  d=nextD;v=nextV;profile=next.profile;
  history.push({t:(n+1)*dt,d,v,fluidEnergy:fe,plateEnergy:pe,dissipated,interfaceWork,energyDefectJPerM2:defect,energyDefect:relative(defect,initialEnergy),
   wallVelocity:V,forceOnPlate:next.force,forceOnFluid:-next.force,interfaceImpulse:next.impulse,bottomImpulse:next.bottomImpulse,
   stepDissipated:next.loss,stepInterfaceWork:work,fluidEnergyDefectJPerM2:fluidDefect,plateEnergyDefectJPerM2:plateDefect,
   momentumDefectKgPerMS:momentumDefect,forceResidualPa:residual,scaledForceResidual:scaledResidual});
 }
 return {schemaVersion:1,method:input.method,synthetic:true,calibrated:false,input,history,profile,initialEnergy,maxXSpread,
  work:{responseSolves:3*steps*microsteps,cellStepsUpperBound:3*steps*microsteps*Math.max(1,Math.ceil(h/(.5*fluid.stableDt)))*fluid.parameters.cellsX*fluid.cellsY}};
}
