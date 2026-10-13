import {evaluateFatigue} from './fatigue-core.js';

// Recompute the assessment from the archived stresses and registered S-N data.
// This checks assessment consistency, not the physical accuracy of the FE mesh.
export function validateFatigueResult(mesh,result,input,calculation){
 const f=result?.fatigue,requested=calculation?.options?.fatigueAssessment;
 if(f===undefined){if(requested!==undefined)throw Error('Saved fatigue request has no assessment result');return;}
 if(result.kind!=='elastic'||input?.study?.kind!=='structural'||input.study?.thermalStress||input.study?.modalAnalysis||!Array.isArray(mesh?.tetrahedra)||!Array.isArray(result.stresses)||result.stresses.length!==mesh.tetrahedra.length)throw Error('Invalid saved fatigue assessment scope');
 const expected=evaluateFatigue(result,input.materialProperties,requested===undefined?{minLoadFactor:f.minLoadFactor,maxLoadFactor:f.maxLoadFactor,meanStressCorrection:f.meanStressCorrection,appliedCycles:f.appliedCycles}:requested);
 const nonnegative=v=>Number.isFinite(v)&&v>=0;
 if(!Array.isArray(f.lifeCycles)||f.lifeCycles.some(v=>v!==null&&(!Number.isFinite(v)||v<=0))||!['damage','stressAmplitudePa','correctedAmplitudePa'].every(key=>Array.isArray(f[key])&&f[key].every(nonnegative))||!nonnegative(f.maxDamage)||f.minLifeCycles!==null&&(!Number.isFinite(f.minLifeCycles)||f.minLifeCycles<=0))throw Error('Invalid saved fatigue life or damage fields');
 function matches(a,b,exact=false){
  if(typeof b==='number')return Number.isFinite(a)&&(exact||b===0?a===b:Math.abs(a-b)<=1e-10+1e-8*Math.abs(b));
  if(Array.isArray(b))return Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>matches(a[i],v,exact));
  if(b&&typeof b==='object')return a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>Object.hasOwn(a,k)&&matches(a[k],b[k],exact||['fatigueData','minLoadFactor','maxLoadFactor','appliedCycles'].includes(k)));
  return a===b;
 }
 if(!matches(f,expected))throw Error('Saved fatigue assessment does not match its stresses or S-N data');
}
