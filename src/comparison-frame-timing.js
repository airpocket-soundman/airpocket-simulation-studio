// Retain render requests, not decoded MediaRecorder frames. No input/result arrays
// are retained here and no missing physical state is interpolated.
// Leave 4 KiB for the existing metadata so the complete sidecar stays within
// the verification tool's established 64 KiB manifest limit.
export const COMPARISON_TIMING_LIMITS=Object.freeze({frames:2048,bytes:60*1024});
export function createComparisonFrameTiming(plan,{format}={}){
 const entries=[];let bytes=0;
 return {
  reset(){entries.length=0;bytes=0;},
  record(phase){
   if(entries.length>=COMPARISON_TIMING_LIMITS.frames)throw Error('Comparison frame timing exceeds its frame bound');
   const selection=plan.atPhase(phase),entry={renderIndex:entries.length,phase,requestedTimeSeconds:selection.timeSeconds,panels:selection.panels.map((panel,caseIndex)=>({caseIndex,...panel}))};
   const next=new TextEncoder().encode(JSON.stringify(entry)).length+1;
   if(bytes+next>COMPARISON_TIMING_LIMITS.bytes-1024)throw Error('Comparison frame timing exceeds its byte bound');
   bytes+=next;entries.push(entry);
  },
  snapshot(){return structuredClone({schemaVersion:1,timeSelection:'nearest-stored-frames-only',interpolated:false,identity:'Each panel caseIndex indexes comparison.cases (caseId, revision, resultRevision).',mapping:format==='gif'?'One entry per encoded GIF frame, in output order.':'Initial capture canvas, then each render callback; encoded WebM frames may be duplicated or dropped and are not mapped one-to-one.',limits:COMPARISON_TIMING_LIMITS,entries});}
 };
}
