import {solveAcoustic} from './acoustic-core.js';
import {sampleResult} from './probe.js';
export function acousticSweep(mesh,boundary,study,{matvecFactory,onProgress=()=>{}}={}){
const {sweepStart:start,sweepEnd:end,sweepCount:count,receiverPoint}=study;
if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<start||!Number.isInteger(count)||count<1||count>20)throw Error('Invalid frequency sweep');
const samples=[];
for(let i=0;i<count;i++){const frequency=start+(end-start)*i/Math.max(1,count-1);onProgress(`Acoustic sweep ${i+1}/${count}: ${frequency.toFixed(1)} Hz`);const r=solveAcoustic(mesh,boundary,{...study,frequency,matvecFactory});samples.push({frequency,...sampleResult(mesh,r,receiverPoint),residual:r.residual});}
return {samples,receiverPoint:[...receiverPoint]};
}
