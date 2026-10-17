import {framesOf} from './result-frames.js';
import {computeSharedRange} from './view-compare-layout.js';

const nearest=(times,time)=>times.reduce((best,t,i)=>Math.abs(t-time)<Math.abs(times[best]-time)?i:best,0);

/** A physical-time plan over existing fields; never interpolates or solves new states. */
export function createComparisonTimePlan(outputs,{field,startTimeSeconds:start,endTimeSeconds:end,toleranceSeconds}={}){
 if(!Array.isArray(outputs)||outputs.length!==2||!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=end)throw Error('Comparison time video requires two cases and an increasing physical time range');
 if(toleranceSeconds!==undefined&&(!Number.isFinite(toleranceSeconds)||toleranceSeconds<0))throw Error('Invalid comparison time tolerance');
 const kind=outputs[0]?.result?.kind;
 if(!['thermal','acousticTransient'].includes(kind)||outputs.some(o=>o?.result?.kind!==kind)||field!==(kind==='thermal'?'temperature':'instantPressure'))throw Error('Time comparison requires two thermal temperature results or two transient acoustic pressure results');
 const frames=outputs.map(o=>framesOf(o.result));
 if(frames.some(f=>!f||f.times.length<2||!f.times.every((t,i)=>Number.isFinite(t)&&t>=0&&(!i||t>f.times[i-1]))))throw Error('Time comparison requires increasing stored frame times');
 const overlapStart=Math.max(...frames.map(f=>f.times[0])),overlapEnd=Math.min(...frames.map(f=>f.times.at(-1)));
 if(start<overlapStart||end>overlapEnd)throw Error('Comparison time range must lie within both saved time axes');
 const maxima=[],counts=[],ranges=frames.map((f,k)=>{
  const first=nearest(f.times,start),last=nearest(f.times,end),n=outputs[k].mesh?.nodes?.length/3;
  if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid comparison time mesh');
  let minimum=Infinity,maximum=-Infinity,worst=Math.max(Math.abs(f.times[first]-start),Math.abs(f.times[last]-end));
  for(let i=0;i<f.times.length-1;i++){
   const midpoint=f.times[i]+(f.times[i+1]-f.times[i])/2;
   if(midpoint>=start&&midpoint<=end)worst=Math.max(worst,(f.times[i+1]-f.times[i])/2);
  }
  if(toleranceSeconds!==undefined&&worst>toleranceSeconds)throw Error('Comparison time interval exceeds stored-frame tolerance');
  for(let i=first;i<=last;i++){
   const values=f.fields[i];if(!Array.isArray(values)||values.length!==n||!values.every(Number.isFinite))throw Error('Invalid stored comparison time field');
   for(const value of values){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
  }
  maxima.push(worst);counts.push(last-first+1);
  return {caseId:String(k),field,unit:f.unit,minimum,maximum};
 });
 const shared=computeSharedRange(ranges);
 const atPhase=phase=>{
  if(!Number.isFinite(phase)||phase<0||phase>1)throw Error('Invalid comparison time phase');
  const timeSeconds=phase===1?end:start+(end-start)*phase;
  return {timeSeconds,panels:frames.map(f=>{const frameIndex=nearest(f.times,timeSeconds);return {frameIndex,timeSeconds:f.times[frameIndex],offsetSeconds:f.times[frameIndex]-timeSeconds};})};
 };
 return {atPhase,colorRange:shared.colorRange,unit:shared.unit,summary:{kind,field,startTimeSeconds:start,endTimeSeconds:end,timeSelection:'nearest-stored-frames-only',interpolated:false,camera:'fixed',rangeBasis:'all-selectable-stored-frames',selectedFrameCounts:counts,maxAbsOffsetSeconds:maxima,...(toleranceSeconds===undefined?{}:{toleranceSeconds}),initial:atPhase(0),final:atPhase(1)}};
}
