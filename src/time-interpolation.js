// Pure display-time interpolation between stored result snapshots (VIEWTIME).
// Solve steps, stored snapshots and interpolated display frames are different things:
// only stored snapshots are computed results; values between them are linear display interpolation,
// never extrapolated and never fed back into physics.
function checkTimes(times){
 if(!times||!(times.length>=1)||!Array.from(times).every(Number.isFinite))throw Error('Snapshot times must be finite numbers');
 for(let i=1;i<times.length;i++)if(!(times[i]>times[i-1]))throw Error('Snapshot times must be strictly increasing');
}
/** Bracket time t between stored snapshots. weight is the fraction from lower to upper (0 on an exact stored time). */
export function locateFrame(times,t){
 checkTimes(times);
 if(!Number.isFinite(t))throw Error('Display time must be finite');
 const n=times.length;
 if(t<times[0]||t>times[n-1])throw Error('Display time is outside the stored range; extrapolation is not performed');
 let lo=0,hi=n-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(times[mid]<=t)lo=mid;else hi=mid;}
 if(t===times[hi])return {lower:hi,upper:hi,weight:0,exact:true};
 if(t===times[lo])return {lower:lo,upper:lo,weight:0,exact:true};
 return {lower:lo,upper:hi,weight:(t-times[lo])/(times[hi]-times[lo]),exact:false};
}
/** Linearly interpolate field arrays (one per stored snapshot) at physical time t. Exact stored times return a copy and interpolated:false. */
export function interpolateFrames(times,fields,t){
 if(!Array.isArray(fields)||fields.length!==times.length)throw Error('One field array per stored snapshot is required');
 const at=locateFrame(times,t),a=fields[at.lower],b=fields[at.upper],size=a.length;
 if(b.length!==size||fields.some(f=>f.length!==size))throw Error('Snapshot fields must have equal length');
 const values=new Float64Array(size);
 if(at.exact){for(let i=0;i<size;i++)values[i]=a[i];}
 else{const w=at.weight;for(let i=0;i<size;i++)values[i]=(1-w)*a[i]+w*b[i];}
 return {values,time:t,lower:at.lower,upper:at.upper,weight:at.weight,interpolated:!at.exact};
}
/** Deterministic wall-clock-independent schedule of count display times from the first to the last stored time (count >= 2). */
export function playbackTimes(times,count){
 checkTimes(times);
 if(!Number.isInteger(count)||count<2)throw Error('Playback needs an integer frame count of at least 2');
 if(times.length<2)throw Error('Playback needs at least two stored snapshots');
 const t0=times[0],t1=times[times.length-1];
 return Array.from({length:count},(_,i)=>i===count-1?t1:t0+(t1-t0)*i/(count-1));
}
/** One fixed color range over all stored snapshots; linear interpolation cannot leave it. */
export function fixedFieldRange(fields){
 let min=Infinity,max=-Infinity;
 for(const f of fields)for(const v of f){if(!Number.isFinite(v))throw Error('Snapshot fields must be finite');if(v<min)min=v;if(v>max)max=v;}
 if(!Number.isFinite(min))throw Error('No snapshot values');
 return {min,max};
}
/** Map an integer fine-slider position 0..steps onto [first,last] stored time; both ends are exact. */
export function fineSliderTime(times,position,steps){
 checkTimes(times);
 if(!Number.isInteger(steps)||steps<1||!Number.isInteger(position)||position<0||position>steps)throw Error('Fine slider position must be an integer from 0 through steps');
 const t0=times[0],t1=times[times.length-1];
 return position===0?t0:position===steps?t1:t0+(t1-t0)*position/steps;
}
/** Advance a playback position by elapsed wall-clock time; one full sweep takes durationMs. Returns {position,done}; never exceeds steps. */
export function advancePlayback(position,elapsedMs,steps,durationMs){
 if(![position,elapsedMs,steps,durationMs].every(Number.isFinite)||steps<1||durationMs<=0||elapsedMs<0||position<0||position>steps)throw Error('Invalid playback arguments');
 const next=Math.min(steps,position+elapsedMs/durationMs*steps);
 return {position:next,done:next>=steps};
}
