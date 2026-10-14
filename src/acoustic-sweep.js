import {solveAcoustic} from './acoustic-core.js';
import {sampleResult} from './probe.js';
export function acousticSweep(mesh,boundary,study,{matvecFactory,onProgress=()=>{},onObserve}={}){
if(onObserve!==undefined&&typeof onObserve!=='function')throw Error('Acoustic sweep onObserve must be a function');
const {sweepStart:start,sweepEnd:end,sweepCount:count,receiverPoint}=study;
if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<start||!Number.isInteger(count)||count<1||count>20)throw Error('Invalid frequency sweep');
const samples=[];
for(let i=0;i<count;i++){const frequency=start+(end-start)*i/Math.max(1,count-1);onProgress(`Acoustic sweep ${i+1}/${count}: ${frequency.toFixed(1)} Hz`);onObserve?.({stage:'frequency-step',solver:'acoustic-sweep',kind:'acoustic',phase:'start',step:i+1,steps:count,frequencyHz:frequency,converged:null});const r=solveAcoustic(mesh,boundary,{...study,frequency,matvecFactory,onObserve:onObserve?event=>onObserve({...event,solvePhase:'sweep',step:i+1,steps:count}):undefined});samples.push({frequency,...sampleResult(mesh,r,receiverPoint),residual:r.residual});const sample=samples.at(-1);if(onObserve&&[r.residual,r.iterations,sample.peakPressurePa,sample.splDb].every(Number.isFinite))onObserve?.({stage:'frequency-step',solver:'acoustic-sweep',kind:'acoustic',phase:'complete',step:i+1,steps:count,frequencyHz:frequency,converged:true,metrics:{residual:r.residual,iterations:r.iterations,peakPressurePa:sample.peakPressurePa,splDb:sample.splDb}});}
return {samples,receiverPoint:[...receiverPoint]};
}
