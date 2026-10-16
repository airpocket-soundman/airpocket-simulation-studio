// Per-kind accessor for stored time frames (VIEWTIME). The viewer uses this single shape for every kind that has frames,
// instead of branching on result.kind. Frames are only the stored snapshots; interpolation lives in time-interpolation.js.
// acousticTransient: instantaneous pressure per stored snapshot. thermal: nodal temperature per stored snapshot
// (present only when the study opted in with thermalSnapshotCount; heat flux is final-step only and is not a frame field).
export function framesOf(result){
 if(!result||!Array.isArray(result.snapshots))return null;
 if(result.kind==='acousticTransient'&&result.snapshots.length>=1)
  return {kind:result.kind,fieldId:'instantPressure',times:result.snapshots.map(f=>f.time),fields:result.snapshots.map(f=>f.pressure),unit:'Pa',label:{ja:'瞬時音圧',en:'Instantaneous pressure'},timeUnit:'ms',timeScale:1000};
 if(result.kind==='thermal'&&result.transient&&result.snapshots.length>=2)
  return {kind:result.kind,fieldId:'temperature',times:result.snapshots.map(f=>f.time),fields:result.snapshots.map(f=>f.temperature),unit:'degC',label:{ja:'温度',en:'Temperature'},timeUnit:'s',timeScale:1};
 return null;
}
/** Frame index shown when no time has been chosen: the final stored frame for thermal (matches result.temperature), the first for acoustic. */
export function defaultFrameIndex(result){const f=framesOf(result);return f&&f.kind==='thermal'?f.times.length-1:0;}
