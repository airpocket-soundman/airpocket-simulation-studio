import {sha256Hex} from './visual-export-fixed-frame.js';
import {fixedWebmSchedule,demuxFixedWebm,fixedWebmError} from './fixed-webm.js';
import {comparisonFixedWebmCapabilities,encodeComparisonTimeWebm} from './ui/comparison-fixed-webm.js';
import {COMPARISON_TIMING_LIMITS} from './comparison-frame-timing.js';
const verified=new WeakMap(),readBlob=Blob.prototype.arrayBuffer;
const fail=message=>{throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED',message);};
const nearest=(times,time)=>times.reduce((best,t,i)=>Math.abs(t-time)<Math.abs(times[best]-time)?i:best,0);
export function singleViewTimeWebmCapabilities(env={}){
 const capability=comparisonFixedWebmCapabilities(env),supported=capability.supported&&typeof globalThis.crypto?.subtle?.digest==='function';
 return {...capability,supported,resultKinds:['acousticTransient'],field:'instantPressure',timeSelection:'nearest-stored-frames-only',maxStoredFrames:COMPARISON_TIMING_LIMITS.frames,...(!supported?{code:'WEBM_FIXED_UNSUPPORTED',reason:'保存時刻のWebMには動画の符号化・復号の対応が必要です。PNG連番を使用してください。'}:{})};
}
export function createSingleViewAcousticTimePlan(output,seconds){
 const snapshots=output?.result?.snapshots;
 if(output?.result?.kind!=='acousticTransient'||!Array.isArray(snapshots)||snapshots.length<2||snapshots.length>COMPARISON_TIMING_LIMITS.frames)throw fixedWebmError('WEBM_FIXED_INVALID','Acoustic time WebM requires 2 to 2048 stored acoustic frames');
 const times=snapshots.map(snapshot=>snapshot.time);
 if(!times.every((t,i)=>Number.isFinite(t)&&t>=0&&(!i||t>times[i-1])))throw fixedWebmError('WEBM_FIXED_INVALID','Acoustic time WebM requires finite increasing stored times');
 const start=times[0],end=times.at(-1),frames=fixedWebmSchedule(seconds).map(step=>{
  const requestedTimeSeconds=step.phase===1?end:start+(end-start)*step.phase,snapshotIndex=nearest(times,requestedTimeSeconds),actualTimeSeconds=times[snapshotIndex];
  return Object.freeze({...step,snapshotIndex,requestedTimeSeconds,actualTimeSeconds,offsetSeconds:actualTimeSeconds-requestedTimeSeconds});
 });
 return Object.freeze({storedTimes:Object.freeze(times),frames:Object.freeze(frames),startTimeSeconds:start,endTimeSeconds:end});
}
/** Only this encoder can issue the private Blob proof; arbitrary renderer Blobs cannot claim fixed-frame endpoints. */
export async function encodeSingleViewAcousticTimeWebm({output,seconds,resultRevision,initialCanvas,renderFrame,signal,onProgress=()=>{},assertCurrent=()=>{}},env={}){
 if(!singleViewTimeWebmCapabilities(env).supported)throw fixedWebmError('WEBM_FIXED_UNSUPPORTED','保存時刻のWebMには動画の符号化・復号の対応が必要です。PNG連番を使用してください。');
 if(resultRevision!==undefined&&!/^sha256:[a-f0-9]{64}$/.test(resultRevision))throw fixedWebmError('WEBM_FIXED_INVALID','Invalid acoustic time result revision');
 const plan=createSingleViewAcousticTimePlan(output,seconds);let next=0,proof;
 const blob=await encodeComparisonTimeWebm({initialCanvas,camera:{},seconds,signal,assertCurrent,onProgress,onVerified:value=>{proof=structuredClone(value);},renderFrame:(_camera,{phase})=>{
  const step=plan.frames[next++];if(!step||phase!==step.phase)fail('Acoustic frame order changed');return renderFrame(step);
 }},env);
 if(signal?.aborted)throw fixedWebmError('WEBM_FIXED_CANCELLED','Acoustic time WebM cancelled');assertCurrent();
 if(!proof||next!==plan.frames.length)fail('Acoustic time frame proof is incomplete');
 const originalBytes=new Uint8Array(await readBlob.call(blob)),byteSha256='sha256:'+await sha256Hex(originalBytes);
 if(signal?.aborted)throw fixedWebmError('WEBM_FIXED_CANCELLED','Acoustic time WebM cancelled');assertCurrent();
 verified.set(blob,{sourceResultRevision:resultRevision,byteSha256,totalBytes:originalBytes.length,verification:proof,storedTimes:[...plan.storedTimes],frames:plan.frames.map(step=>({...step})),resolution:{width:initialCanvas.width,height:initialCanvas.height}});return blob;
}
/** Detached, bounded metadata only; no code path accepts this returned copy as an issued proof. */
export function getSingleViewAcousticTimeVerification(blob){const proof=verified.get(blob);return proof?structuredClone(proof):null;}
export async function singleViewAcousticTimeManifest(blob,bytes,{seconds,resultRevision}={}){
 const record=getSingleViewAcousticTimeVerification(blob);if(!record||record.sourceResultRevision!==resultRevision)fail('Single-view acoustic WebM proof is missing or stale');
 demuxFixedWebm(bytes);const ownedBytes=new Uint8Array(bytes),byteSha256='sha256:'+await sha256Hex(ownedBytes);
 if(byteSha256!==record.byteSha256||ownedBytes.length!==record.totalBytes)fail('Single-view acoustic WebM bytes differ from the decoded artifact');
 const schedule=fixedWebmSchedule(seconds),parsed=demuxFixedWebm(ownedBytes),proof=record.verification,plan=createSingleViewAcousticTimePlan({result:{kind:'acousticTransient',snapshots:record.storedTimes.map(time=>({time}))}},seconds);
 if(parsed.width!==record.resolution.width||parsed.height!==record.resolution.height||parsed.seconds!==seconds||proof.codec!=='vp8'||proof.frameCount!==schedule.length||proof.encodedFrameCount!==schedule.length||proof.decodedFrameCount!==schedule.length||proof.terminalTimestamp!==schedule.at(-1).timestamp||proof.totalDurationMicroseconds!==seconds*1000000||proof.verification!=='strict-webm-demux+video-decoder'||JSON.stringify(record.frames)!==JSON.stringify(plan.frames))fail('Single-view acoustic WebM proof differs from bytes or schedule');
 const time={animation:'time',durationSeconds:seconds,timeBasis:'display time',physicalTime:'nearest stored acoustic frames; no interpolation',recording:'fixed-frame',realtime:false,frameCount:schedule.length,frameCountGuaranteed:true,camera:'fixed',phasePolicy:'i/(N-1)',frameSelection:'nearest-stored-frames-only',requestedRangeSeconds:{start:plan.startTimeSeconds,end:plan.endTimeSeconds},storedFrameCount:record.storedTimes.length,frameTimings:record.frames.map(({index,phase,timestamp,duration,...physical})=>({index,phase,timestampMicroseconds:timestamp,durationMicroseconds:duration,...physical})),verification:proof};
 if(new TextEncoder().encode(JSON.stringify(time)).length>COMPARISON_TIMING_LIMITS.bytes)fail('Single-view acoustic time ledger exceeds its byte limit');return {time,resolution:record.resolution,sha256:byteSha256,totalBytes:ownedBytes.length};
}
