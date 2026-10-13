import {principalStresses} from './fem-core.js';
import {validateFatigueData} from './fatigue-material.js';
export {validateFatigueData} from './fatigue-material.js';

// A measured fully reversed S-N curve supplies N(sigma_a). Interpolation is
// linear in log(stress amplitude) and log(cycles); there is no extrapolation.
function curveLife(amplitude,curve){
 const high=curve[0].stressAmplitudePa,low=curve.at(-1).stressAmplitudePa;
 if(amplitude<low*(1-1e-10)||amplitude>high*(1+1e-10))throw Error('Fatigue stress amplitude is outside the measured S-N curve range');
 const s=Math.min(high,Math.max(low,amplitude));
 for(let i=0;i<curve.length;i++)if(s===curve[i].stressAmplitudePa)return curve[i].cycles;
 for(let i=0;i<curve.length-1;i++){const a=curve[i],b=curve[i+1];if(s<=a.stressAmplitudePa&&s>=b.stressAmplitudePa){const t=(Math.log(s)-Math.log(a.stressAmplitudePa))/(Math.log(b.stressAmplitudePa)-Math.log(a.stressAmplitudePa)),life=Math.exp((1-t)*Math.log(a.cycles)+t*Math.log(b.cycles));if(!Number.isFinite(life)||!(life>0))throw Error('Fatigue calculation exceeded the numerical range');return life;}}
 throw Error('Fatigue stress amplitude is outside the measured S-N curve range');
}

export function evaluateFatigue(elasticResult,properties,options={}){
 const data=properties?.fatigueData;validateFatigueData(data);if(!data)throw Error('Fatigue evaluation requires measured S-N material data');
 const r=elasticResult;
 if(r?.kind!=='elastic'||r.plasticity||r.hyperelastic||properties.plasticity||properties.hyperelastic||r.thermalStress||r.temperature!==undefined||r.referenceTemperature!=null||r.thermalStrains?.some(row=>!Array.isArray(row)||row.some(v=>!Number.isFinite(v)||v!==0)))throw Error('Fatigue evaluation requires a linear elastic result without thermal stress, plasticity or hyperelasticity');
 if(!Array.isArray(r.stresses)||!r.stresses.length||r.stresses.length>30000||r.stresses.some(s=>!Array.isArray(s)||s.length!==6||!s.every(Number.isFinite)))throw Error('Fatigue evaluation requires finite six-component element stresses in Pa');
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('Invalid fatigue load settings');
 const {minLoadFactor=0,maxLoadFactor=1,meanStressCorrection='none',appliedCycles=1}=options;
 if(!Number.isFinite(minLoadFactor)||!Number.isFinite(maxLoadFactor)||minLoadFactor>maxLoadFactor||!['none','goodman'].includes(meanStressCorrection)||!Number.isFinite(appliedCycles)||appliedCycles<0)throw Error('Invalid fatigue load settings');
 const lifeCycles=[],damage=[],stressAmplitudePa=[],correctedAmplitudePa=[],meanStressPa=[],minimumStressPa=[],maximumStressPa=[],zeroAmplitude=[],referenceStressPa=[];
 for(const stress of r.stresses){
  // Normalize before the eigensolve so the uniaxial ratio test is independent
  // of the magnitude and orientation of the supplied stress tensor.
  const scale=Math.max(...stress.map(Math.abs)),principal=scale?principalStresses(stress.map(v=>v/scale)).map(v=>v*scale):[0,0,0];
  const index=principal.reduce((best,v,i)=>Math.abs(v)>Math.abs(principal[best])?i:best,0),reference=principal[index];
  if(!principal.every(Number.isFinite))throw Error('Fatigue calculation exceeded the numerical range');
  if(principal.some((v,i)=>i!==index&&Math.abs(v)>Math.abs(reference)*1e-5))throw Error('Fatigue evaluation currently supports proportional uniaxial stress states only');
  const ends=[reference*minLoadFactor,reference*maxLoadFactor],minimum=Math.min(...ends),maximum=Math.max(...ends);
  if(!ends.every(Number.isFinite))throw Error('Fatigue calculation exceeded the numerical range');
  const peak=Math.max(Math.abs(minimum),Math.abs(maximum));if(peak>data.yieldStressPa*(1+1e-10))throw Error('Fatigue peak stress exceeds the elastic yield limit');
  const amplitude=maximum/2-minimum/2,mean=maximum/2+minimum/2;
  const divisor=meanStressCorrection==='goodman'?1-Math.max(mean,0)/data.ultimateStrengthPa:1;
  if(!(divisor>0)||!Number.isFinite(divisor))throw Error('Fatigue Goodman correction requires mean stress below ultimate tensile strength');
  const corrected=amplitude/divisor;
  if(!Number.isFinite(corrected)||!Number.isFinite(mean))throw Error('Fatigue calculation exceeded the numerical range');
  const zero=amplitude===0,life=zero?null:curveLife(corrected,data.snCurve),usage=zero?0:appliedCycles/life;
  if(!Number.isFinite(usage))throw Error('Fatigue calculation exceeded the numerical range');
  referenceStressPa.push(reference);minimumStressPa.push(minimum);maximumStressPa.push(maximum);stressAmplitudePa.push(amplitude);meanStressPa.push(mean);correctedAmplitudePa.push(corrected);zeroAmplitude.push(zero);lifeCycles.push(life);damage.push(usage);
 }
 const activeLife=lifeCycles.filter(v=>v!==null);
 return {kind:'fatigue',model:'stress-life',minLoadFactor,maxLoadFactor,meanStressCorrection,appliedCycles,referenceStressPa,lifeCycles,damage,stressAmplitudePa,correctedAmplitudePa,meanStressPa,minimumStressPa,maximumStressPa,zeroAmplitude,minLifeCycles:activeLife.length?Math.min(...activeLife):null,maxDamage:Math.max(...damage),fatigueData:structuredClone(data)};
}
