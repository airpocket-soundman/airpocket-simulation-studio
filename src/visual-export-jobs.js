import {singleSliceGifManifest,SINGLE_SLICE_GIF_LIMITS} from './ui/single-slice-gif.js';
import {singleDeformationGifManifest,SINGLE_DEFORMATION_GIF_LIMITS} from './ui/single-deformation-gif.js';
import {singleStoredTimeGifManifest,SINGLE_STORED_TIME_GIF_LIMITS} from './ui/single-stored-time-gif.js';
import {singleOrbitGifManifest,SINGLE_ORBIT_GIF_LIMITS} from './ui/single-orbit-gif.js';
import {singleViewThermalTimeManifest,singleViewAcousticTimeManifest} from './single-view-time-webm.js';
import {canonicalJson} from './project-revision.js';
import {FIXED_FRAME_LIMITS,readStoreZip,sha256Hex} from './visual-export-fixed-frame.js';
import {COMPARISON_TIMING_LIMITS} from './comparison-frame-timing.js';
import {fixedWebmSchedule,demuxFixedWebm,fixedWebmError} from './fixed-webm.js';
const CHUNK=65536,readBlob=Blob.prototype.arrayBuffer;
const copy=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function request(value){
 if(!value||typeof value.requestId!=='string'||!value.requestId.trim()||value.requestId.length>128)throw Error('Invalid visual export requestId');
 if(typeof value.expectedResultRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(value.expectedResultRevision))throw Error('Invalid expectedResultRevision');
 if(!['png','webm','png-sequence','gif'].includes(value.format))throw Error('Visual export format must be png, webm, gif or png-sequence');
 const animation=value.animation??'orbit';
 if(!['orbit','deformation','time','slice'].includes(animation))throw Error('Invalid visual export animation or seconds');
 if(value.format==='gif'&&!['orbit','time','deformation','slice'].includes(animation))throw Error('Single-view GIF supports orbit, stored time or visual deformation only');
 if(value.format==='png-sequence'){
  if(value.seconds!==undefined&&value.seconds!==null)throw Error('png-sequence is fixed-frame; seconds is not accepted, use frames');
  const frames=value.frames??FIXED_FRAME_LIMITS.defaultFrames;
  if(!Number.isInteger(frames)||frames<FIXED_FRAME_LIMITS.minFrames||frames>FIXED_FRAME_LIMITS.maxFrames)throw Error('png-sequence frames must be an integer from '+FIXED_FRAME_LIMITS.minFrames+' through '+FIXED_FRAME_LIMITS.maxFrames);
  return {requestId:value.requestId,expectedResultRevision:value.expectedResultRevision,format:value.format,animation,frames,...(value.view===undefined?{}:{view:copy(value.view)})};
 }
 if(value.frames!==undefined&&value.frames!==null)throw Error('frames is only valid with format png-sequence');
 const seconds=value.seconds??5;
 if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error('Invalid visual export animation or seconds');
 return {requestId:value.requestId,expectedResultRevision:value.expectedResultRevision,format:value.format,animation,seconds,...(value.view===undefined?{}:{view:copy(value.view)})};
}
function comparisonRequest(raw){
 const value=JSON.parse(canonicalJson(raw)),allowed=['requestId','references','field','timeSeconds','toleranceSeconds','deformScale','camera','format','animation','seconds','startTimeSeconds','endTimeSeconds'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error('Invalid comparison export request');
 if(typeof value.requestId!=='string'||!value.requestId.trim()||value.requestId.length>128)throw Error('Invalid visual export requestId');
 if(!Array.isArray(value.references)||value.references.length!==2||value.references.some(ref=>!ref||typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).some(key=>!['caseId','expectedRevision'].includes(key))||typeof ref.caseId!=='string'||!ref.caseId||ref.caseId.length>200||typeof ref.expectedRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(ref.expectedRevision))||value.references[0].caseId===value.references[1].caseId)throw Error('Comparison export requires two distinct exact saved-case references');
 if(typeof value.field!=='string'||!value.field||value.field.length>50)throw Error('Comparison export requires an explicit field');
 for(const key of ['timeSeconds','toleranceSeconds','deformScale','startTimeSeconds','endTimeSeconds'])if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<0))throw Error('Invalid comparison export '+key);
 if(value.toleranceSeconds!==undefined&&value.timeSeconds===undefined&&value.animation!=='time')throw Error('toleranceSeconds requires timeSeconds');
 if(value.camera!==undefined){const c=value.camera;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(key=>!['position','target','up','fov'].includes(key))||!vector(c.position)||!vector(c.target)||!vector(c.up)||!finite(c.fov)||c.fov<=0||c.fov>=180)throw Error('Invalid comparison camera');const d=c.target.map((v,i)=>v-c.position[i]),cross=[d[1]*c.up[2]-d[2]*c.up[1],d[2]*c.up[0]-d[0]*c.up[2],d[0]*c.up[1]-d[1]*c.up[0]];if(![...d,...cross,Math.hypot(...d),Math.hypot(...c.up),Math.hypot(...cross)].every(Number.isFinite)||Math.hypot(...d)<=1e-9||Math.hypot(...c.up)<=1e-9||Math.hypot(...cross)<=Math.hypot(...d)*Math.hypot(...c.up)*1e-9)throw Error('Degenerate comparison camera');}
 const format=value.format===undefined?'png':value.format;if(!['png','webm','gif'].includes(format))throw Error('Comparison export format must be png, webm or gif');
 if(format==='png'&&(Object.hasOwn(value,'animation')||Object.hasOwn(value,'seconds')))throw Error('Comparison PNG does not accept animation or seconds');
 if(format==='webm'||format==='gif'){
  const animation=value.animation===undefined?'orbit':value.animation;if(!['orbit','time','deformation'].includes(animation))throw Error('Comparison video supports orbit, time or deformation only');
  if(animation==='deformation'&&(!['displacement','stress'].includes(value.field)||!(value.deformScale>0)||['timeSeconds','toleranceSeconds','startTimeSeconds','endTimeSeconds'].some(key=>value[key]!==undefined)))throw Error('Comparison deformation video requires displacement/stress, a positive explicit visualization scale and no physical time arguments');
  if(animation==='time'){if(value.timeSeconds!==undefined||!Number.isFinite(value.startTimeSeconds)||!Number.isFinite(value.endTimeSeconds)||value.startTimeSeconds<0||value.endTimeSeconds<=value.startTimeSeconds)throw Error('Comparison time video requires an explicit increasing physical time range without timeSeconds');}
  else if(value.startTimeSeconds!==undefined||value.endTimeSeconds!==undefined)throw Error('Physical start/end times are only valid for time video');
  const seconds=value.seconds===undefined?5:value.seconds;if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error('Comparison video seconds must be an integer from 1 through 15');return {...value,format,animation,seconds,target:'comparison'};
 }
 if(value.startTimeSeconds!==undefined||value.endTimeSeconds!==undefined)throw Error('Physical start/end times are only valid for time video');
 return {...value,format,target:'comparison'};
}
function gifSize(bytes){if(bytes.length<14||new TextDecoder().decode(bytes.subarray(0,6))!=='GIF89a'||bytes.at(-1)!==59)throw Error('Invalid comparison GIF header');const width=bytes[6]|bytes[7]<<8,height=bytes[8]|bytes[9]<<8;if(width!==640||height!==320)throw Error('Invalid comparison GIF dimensions');return {width,height};}
function comparisonManifest(job,mimeType,bytes,sha256){
 const {format,animation,seconds}=job.request,recorded=job.view?.resolution,size=format==='png'?pngSize(bytes):format==='gif'?gifSize(bytes):recorded;
 if(!size||!Number.isSafeInteger(size.width)||size.width<1||!Number.isSafeInteger(size.height)||size.height<1)throw Error(format==='png'?'Comparison renderer returned invalid PNG dimensions':'Comparison video requires recorded canvas resolution');
 const fixedTime=format==='webm'&&animation==='time';
 const codec=format==='webm'?(/codecs=([^;]+)/.exec(mimeType)||[])[1]:undefined;
 const manifest={schemaVersion:1,target:'comparison',format,container:format,mimeType,...(codec?{codec}:{}),sha256,totalBytes:bytes.length,resolution:{width:size.width,height:size.height},comparison:copy(job.comparison),view:copy(job.view),...(format==='gif'?{time:{animation,durationSeconds:seconds,timeBasis:'display time',recording:'fixed-frame',realtime:false,frameCount:24,frameCountGuaranteed:true,phasePolicy:animation==='orbit'?'i/24':'i/23',camera:animation==='orbit'?'orbit':'fixed',...(animation==='time'?{frameSelection:'nearest-stored-frames-only',requestedRangeSeconds:{start:job.request.startTimeSeconds,end:job.request.endTimeSeconds}}:{}),...(animation==='deformation'?{physicalTime:'Fixed saved structural result; visualization multiplier only, not a physical load history.'}:{}),delayCentiseconds:Array.from({length:24},(_,i)=>Math.round((i+1)*seconds*100/24)-Math.round(i*seconds*100/24)),loop:'infinite'},gif:{palette:'RGB332',colors:256,lossy:true},sourceResolution:copy(job.view.sourceResolution)}:{}),...(format==='webm'?{time:{animation,durationSeconds:seconds,timeBasis:'display time',physicalTime:animation==='deformation'?'Fixed saved structural result; only the visualization multiplier changes linearly from zero to the requested scale, not a physical load history.':animation==='time'?'Requested physical range maps to nearest stored frames per panel; actual times and signed offsets are shown in each rendered frame.':'Each panel retains its selected saved result and physical time throughout the display orbit.',camera:animation==='orbit'?'orbit':'fixed',...(animation==='time'?{frameSelection:'nearest-stored-frames-only',requestedRangeSeconds:{start:job.request.startTimeSeconds,end:job.request.endTimeSeconds}}:{}),fps:{target:TARGET_FPS,recording:'realtime',frameCountGuaranteed:false}}}:{})};
 if(fixedTime){
  const schedule=fixedWebmSchedule(seconds),proof=job.getFixedVerification?.(),parsed=demuxFixedWebm(bytes);
  if(!proof||proof.schemaVersion!==1||proof.codec!=='vp8'||proof.frameCount!==schedule.length||proof.encodedFrameCount!==schedule.length||proof.decodedFrameCount!==schedule.length||proof.terminalTimestamp!==schedule.at(-1).timestamp||proof.totalDurationMicroseconds!==seconds*1000000||proof.verification!=='strict-webm-demux+video-decoder'||parsed.width!==size.width||parsed.height!==size.height||parsed.seconds!==seconds)throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Comparison WebM endpoint verification is missing or inconsistent');
  manifest.time={animation,durationSeconds:seconds,timeBasis:'display time',recording:'fixed-frame',realtime:false,frameCount:schedule.length,frameCountGuaranteed:true,phasePolicy:'i/(N-1)',camera:'fixed',frameSelection:'nearest-stored-frames-only',requestedRangeSeconds:{start:job.request.startTimeSeconds,end:job.request.endTimeSeconds},presentationSchedule:schedule.map(({index,timestamp,duration})=>({index,timestampMicroseconds:timestamp,durationMicroseconds:duration})),verification:copy(proof)};
  delete job.getFixedVerification;
 }
 let timing;try{timing=job.getTimeFrames?.();}finally{delete job.getTimeFrames;}
 if(fixedTime&&!timing)throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Comparison fixed WebM physical frame timing is missing');
 if(timing){
  if(!Array.isArray(timing.entries)||timing.entries.length>COMPARISON_TIMING_LIMITS.frames||new TextEncoder().encode(JSON.stringify(timing)).length>COMPARISON_TIMING_LIMITS.bytes)throw Error('Comparison frame timing exceeds its size bound');
  if(fixedTime&&timing.entries.length!==fixedWebmSchedule(seconds).length)throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Comparison fixed WebM timing is incomplete');
  if(fixedTime){for(const [i,entry] of timing.entries.entries()){const phase=i/(timing.entries.length-1),requested=i===timing.entries.length-1?job.request.endTimeSeconds:job.request.startTimeSeconds+(job.request.endTimeSeconds-job.request.startTimeSeconds)*phase;if(entry.renderIndex!==i||entry.phase!==phase||entry.requestedTimeSeconds!==requested||!Array.isArray(entry.panels)||entry.panels.length!==2||entry.panels.some((p,k)=>p.caseIndex!==k||!Number.isSafeInteger(p.frameIndex)||p.frameIndex<0||!Number.isFinite(p.timeSeconds)||!Number.isFinite(p.offsetSeconds)||p.offsetSeconds!==p.timeSeconds-requested))throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Comparison fixed WebM physical frame timing differs from its presentation schedule');}}
  if(format==='gif'&&timing.entries.length!==24)throw Error('Comparison GIF frame timing is incomplete');
  manifest.time.frameTimings=copy(timing);
 }
 if(new TextEncoder().encode(JSON.stringify(manifest)).length>MAX_MANIFEST_BYTES+(timing?COMPARISON_TIMING_LIMITS.bytes:0))throw Error('Visual export manifest exceeds its size bound');return manifest;
}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function base64(bytes){let text='';for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);return btoa(text);}

const TARGET_FPS=24,MAX_MANIFEST_BYTES=4096,RESULT_SETTINGS=['field','modeIndex','frameIndex','timeSeconds','deformScale'];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function vector(v){return Array.isArray(v)&&v.length===3&&v.every(finite)?v.slice():undefined;}
function pngSize(bytes){const sig=[137,80,78,71,13,10,26,10];if(bytes.length<24||sig.some((v,i)=>bytes[i]!==v))return undefined;const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=dv.getUint32(16),height=dv.getUint32(20);return width>0&&height>0?{width,height}:undefined;}
// Only facts this module already holds: frozen request/view, artifact bytes and MIME type. Nothing is inferred from pixels or invented.
async function sequenceManifest(job,mimeType,bytes,sha256){
 const {animation,frames,expectedResultRevision}=job.request,files=readStoreZip(bytes),inner=files.get('manifest.json');
 if(!inner)throw Error('png-sequence archive has no manifest.json');
 const detail=JSON.parse(new TextDecoder().decode(inner));
 if(detail.frameCount!==frames||!Array.isArray(detail.frames)||detail.frames.length!==frames||files.size!==frames+1)throw Error('png-sequence archive does not match the requested frame count');
 // schemaVersion 2 archives carry only physicalRevision (resultRevision hashes wall-clock solveMs, which would make the ZIP bytes vary).
 const v2=detail.schemaVersion===2;if(v2&&(!job.physicalRevision||detail.physicalRevision!==job.physicalRevision))throw Error('png-sequence physical revision mismatch');
 for(const record of detail.frames){const data=files.get(record.file);if(!data||(v2?record.physicalRevision!==job.physicalRevision||record.resultRevision!==undefined:record.resultRevision!==expectedResultRevision)||'sha256:'+await sha256Hex(data)!==record.sha256)throw Error('png-sequence frame hash mismatch');}
 const manifest={schemaVersion:1,resultRevision:expectedResultRevision,...(v2?{physicalRevision:job.physicalRevision}:{}),format:'png-sequence',container:'zip',compression:'store',mimeType,sha256,totalBytes:bytes.length,frameCount:frames,
  resolution:detail.resolution,view:detail.view,time:{animation,timeBasis:'fixed-frame',realtime:false,wallClockIndependent:true,frameSelection:animation==='time'?(detail.schedule?.resultKind==='thermal'?'stored-thermal-temperature-frames-only':'stored-acoustic-frames-only'):'deterministic schedule',...(animation==='time'&&detail.schedule?.resultKind==='thermal'?{resultKind:'thermal',field:'temperature'}:{})},
  manifestEntry:{name:'manifest.json',bytes:inner.length,sha256:'sha256:'+await sha256Hex(inner)},scale:detail.scale};
 if(JSON.stringify(manifest).length>MAX_MANIFEST_BYTES)throw Error('Visual export manifest exceeds its size bound');
 return manifest;
}
async function buildManifest(job,mimeType,bytes,sha256,blob){
 const {format,animation,seconds,expectedResultRevision}=job.request,result=job.view?.result&&typeof job.view.result==='object'?job.view.result:{},picked={};
 for(const key of RESULT_SETTINGS)if(typeof result[key]==='string'&&result[key].length<=64||finite(result[key]))picked[key]=result[key];
 if(result.camera&&typeof result.camera==='object'){const camera={};for(const key of ['position','target','up'])if(vector(result.camera[key]))camera[key]=vector(result.camera[key]);if(finite(result.camera.fov))camera.fov=result.camera.fov;if(Object.keys(camera).length)picked.camera=camera;}
 const size=format==='png'?pngSize(bytes):undefined,container=format==='png'?'png':format==='gif'?'gif':'webm',codec=(/codecs=([^;]+)/.exec(mimeType)||[])[1];
 const manifest={schemaVersion:1,resultRevision:expectedResultRevision,format,container,mimeType,...(codec?{codec}:{}),sha256,totalBytes:bytes.length,
  view:picked,...(size?{resolution:size}:{}),
  scale:{units:{time:'second'},...(finite(picked.deformScale)?{deformScale:picked.deformScale,deformScaleKind:'visualization multiplier'}:{})}};
 if(format==='webm')manifest.time={animation,durationSeconds:seconds,timeBasis:'display time',...(animation==='time'?{physicalTime:'stored acoustic frames; physical time of each frame is shown in the overlay and is not scaled to the video duration',frameSelection:'stored-acoustic-frames-only'}:{}),fps:{target:TARGET_FPS,recording:'realtime',frameCountGuaranteed:false}};
 else manifest.time={animation:null,timeBasis:'single frame',...(finite(picked.timeSeconds)?{physicalTimeSeconds:picked.timeSeconds}:{})};
 if(format==='webm'&&animation==='time'){if(!['temperature','instantPressure'].includes(picked.field))throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Stored-time artifact requires temperature or instantaneous pressure');const fixed=await (picked.field==='temperature'?singleViewThermalTimeManifest:singleViewAcousticTimeManifest)(blob,bytes,{seconds,resultRevision:expectedResultRevision});if(fixed.sha256!==sha256||fixed.totalBytes!==bytes.length)throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Single-view acoustic artifact identity changed');Object.assign(manifest,fixed);}
 if(format==='gif'){const fixed=await (animation==='time'?singleStoredTimeGifManifest:animation==='deformation'?singleDeformationGifManifest:animation==='slice'?singleSliceGifManifest:singleOrbitGifManifest)(blob,bytes,{seconds,resultRevision:expectedResultRevision,field:picked.field,camera:picked.camera,timeSeconds:picked.timeSeconds,frameIndex:picked.frameIndex,modeIndex:picked.modeIndex,peakScale:picked.deformScale,setup:job.view?.setup,surface:result.surface,section:result.section});if(fixed.sha256!==sha256||fixed.totalBytes!==bytes.length)throw Error('Orbit GIF identity changed');Object.assign(manifest,fixed);}
 if(new TextEncoder().encode(JSON.stringify(manifest)).length>MAX_MANIFEST_BYTES+(format==='gif'?Math.max(SINGLE_ORBIT_GIF_LIMITS.manifestBytes,SINGLE_STORED_TIME_GIF_LIMITS.manifestBytes,SINGLE_DEFORMATION_GIF_LIMITS.manifestBytes,SINGLE_SLICE_GIF_LIMITS.manifestBytes):format==='webm'&&animation==='time'?COMPARISON_TIMING_LIMITS.bytes:0))throw Error('Visual export manifest exceeds its size bound');
 return manifest;
}
/** In-memory jobs; rendering, result validation and scene restoration belong to the adapter. */
const WEBM_FAILURE_CODES=new Set(['WEBM_BACKGROUND_INTERRUPTED','WEBM_PROGRESS_STALLED','WEBM_STOP_TIMEOUT','WEBM_FIXED_INVALID','WEBM_FIXED_UNSUPPORTED','WEBM_FIXED_CODEC_FAILURE','WEBM_FIXED_OUTPUT_MISMATCH','WEBM_FIXED_CANCELLED','WEBM_FIXED_TIMEOUT','WEBM_ENDPOINT_UNVERIFIED','GIF_ORBIT_INVALID','GIF_ORBIT_CANCELLED','GIF_TIME_INVALID','GIF_TIME_CANCELLED','GIF_TIME_TIMEOUT','GIF_DEFORMATION_INVALID','GIF_DEFORMATION_CANCELLED','GIF_DEFORMATION_TIMEOUT','GIF_SLICE_INVALID','GIF_SLICE_CANCELLED','GIF_SLICE_TIMEOUT']);
export function createVisualExportJobs({render,prepare,prepareCompare,renderCompare,maxBytes=32*1024*1024,maxJobs=4,id=()=>crypto.randomUUID()}={}){
 if(typeof render!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(maxJobs)||maxJobs<1)throw Error('Invalid visual export job configuration');
 const jobs=new Map(),requests=new Map();let retainedBytes=0,renderActive=false,epoch=0;
 const find=({jobId}={})=>{const job=jobs.get(jobId);if(!job)throw Error('Unknown visual export job');return job;};
 const summary=job=>({schemaVersion:1,jobId:job.jobId,requestId:job.request.requestId,state:job.state,executionSettled:job.executionSettled===true,format:job.request.format,...(job.request.target==='comparison'?{target:'comparison',comparison:copy(job.comparison)}:{resultRevision:job.request.expectedResultRevision}),view:copy(job.view),progress:copy(job.progress),...(job.error?{error:job.error}:{}),...(job.errorCode?{errorCode:job.errorCode}:{}),...(job.metadata?{artifact:copy(job.metadata)}:{})});
 function stop(job){if(job.state==='running'){job.state='cancelled';job.controller.abort();}}
 function finish(job,blob){
  return (async()=>{
   if(job.state!=='running'||!jobs.has(job.jobId))return;
   job.assertLifetime?.();
   const format=job.request.format,mime=format==='png'?'image/png':format==='png-sequence'?'application/zip':format==='gif'?'image/gif':'video/webm';
   if(!(blob instanceof Blob)||!blob.size||!(blob.type===mime||mime==='video/webm'&&blob.type.startsWith('video/webm;')))throw Error('Renderer returned an invalid visual artifact');
   if(blob.size>maxBytes-retainedBytes)throw Error('Visual export retained byte budget exceeded');
   const strictSingleTime=job.request.target!=='comparison'&&format==='webm'&&job.request.animation==='time';
   const strictIssued=strictSingleTime||job.request.target!=='comparison'&&format==='gif';
   if(strictIssued&&Object.hasOwn(blob,'arrayBuffer'))throw fixedWebmError(format==='gif'?(job.request.animation==='time'?'GIF_TIME_INVALID':job.request.animation==='deformation'?'GIF_DEFORMATION_INVALID':job.request.animation==='slice'?'GIF_SLICE_INVALID':'GIF_ORBIT_INVALID'):'WEBM_ENDPOINT_UNVERIFIED',format==='gif'?'Single-view GIF Blob reader was replaced':'Single-view acoustic Blob reader was replaced');
   const bytes=new Uint8Array(await (strictIssued?readBlob.call(blob):blob.arrayBuffer()));
   if(job.state!=='running'||!jobs.has(job.jobId))return;
   job.assertLifetime?.();
   // Reserve before hashing so overlapping completions share one exact byte budget.
   if(bytes.length>maxBytes-retainedBytes)throw Error('Visual export retained byte budget exceeded');
   retainedBytes+=bytes.length;job.bytes=bytes;
   try{
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    if(job.state!=='running'||!jobs.has(job.jobId))return;
    job.assertLifetime?.();
    const sha256='sha256:'+Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');const manifest=job.request.target==='comparison'?comparisonManifest(job,blob.type,bytes,sha256):format==='png-sequence'?await sequenceManifest(job,blob.type,bytes,sha256):await buildManifest(job,blob.type,bytes,sha256,blob);if(job.state!=='running'||!jobs.has(job.jobId))return;job.metadata={mimeType:blob.type,name:`${job.request.target==='comparison'?'comparison':'result'}-${job.jobId}.${format==='png-sequence'?'zip':format}`,totalBytes:bytes.length,sha256,maxChunkBytes:CHUNK,manifest};job.progress={fraction:1};job.state='completed';
   }finally{if(job.state!=='completed'&&job.bytes){retainedBytes-=job.bytes.length;job.bytes=null;}}
  })();
 }
 async function start(args,{guard=()=>true,jobGuard=guard}={},compare=false){
   if(compare&&(typeof prepareCompare!=='function'||typeof renderCompare!=='function'))throw Error('Comparison export is unavailable');
   const normalized=compare?comparisonRequest(args):request(args),key=(compare?'comparison:':'result:')+canonical(normalized),prior=requests.get(normalized.requestId);
   if(prior){if(prior.key!==key)throw Error('Visual export requestId conflict');await prior.ready;return summary(find({jobId:prior.jobId}));}
   if(!guard())throw Error('Visual export request expired');
   if(renderActive||Array.from(requests.values()).some(r=>!r.jobId))throw Error('A visual export is already active');
   if(jobs.size+Array.from(requests.values()).filter(r=>!r.jobId).length>=maxJobs)throw Error('Visual export job limit reached; release a job');
   const startEpoch=epoch;let accepted=false;
   // Source leases retain this same guard: deadline before admission, session lifetime afterwards.
   const sourceGuard=()=>epoch===startEpoch&&(accepted?jobGuard():guard()&&jobGuard());
   let resolve,reject;const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});ready.catch(()=>{});const entry={key,ready,jobId:null};requests.set(normalized.requestId,entry);
   try{
    const snapshot=compare?await prepareCompare(copy(normalized),{guard:sourceGuard}):prepare?await prepare(copy(normalized)):{resultRevision:normalized.expectedResultRevision,view:normalized.view};
    if(!sourceGuard())throw Error('Visual export request expired');
    if(!compare&&snapshot?.resultRevision!==normalized.expectedResultRevision)throw Error('Displayed result revision conflict');
    let comparison;if(compare){comparison=JSON.parse(canonicalJson(snapshot?.comparison));if(!comparison||typeof comparison!=='object'||Array.isArray(comparison)||new TextEncoder().encode(JSON.stringify(comparison)).length>3000)throw Error('Invalid or oversized comparison export metadata');}
    if(!snapshot.view||typeof snapshot.view!=='object'||Array.isArray(snapshot.view))throw Error('Visual export requires frozen view settings');
    const jobId=id();if(typeof jobId!=='string'||!jobId||jobs.has(jobId))throw Error('Invalid or duplicate visual export job ID');
    const physicalRevision=typeof snapshot.physicalRevision==='string'&&/^sha256:[0-9a-f]{64}$/.test(snapshot.physicalRevision)?snapshot.physicalRevision:undefined;
    const job={jobId,physicalRevision,...(compare?{comparison:freeze(copy(comparison)),...(['gif','webm'].includes(normalized.format)&&normalized.animation==='time'&&typeof snapshot.context?.getTimeFrames==='function'?{getTimeFrames:snapshot.context.getTimeFrames,...(normalized.format==='webm'?{getFixedVerification:snapshot.context.getFixedVerification}:{})}:{} )}:{}),request:freeze(copy(normalized)),view:freeze(copy(snapshot.view)),state:'running',executionSettled:false,progress:{fraction:0},controller:new AbortController(),bytes:null,...(compare?{assertLifetime:()=>{if(!sourceGuard())throw Error('Comparison export expired');}}:{})};
    if(!sourceGuard())throw Error('Visual export request expired');
    accepted=true;jobs.set(jobId,job);entry.jobId=jobId;
    const onProgress=value=>{if(job.state!=='running')return;const fraction=typeof value==='number'?value:value?.fraction;if(Number.isFinite(fraction)&&fraction>=0&&fraction<=1)job.progress={fraction};};
    // Calling synchronously reserves the renderer before another start can run.
    renderActive=true;let output;try{output=(compare?renderCompare:render)({...copy(normalized),...(compare?{comparison:copy(job.comparison),context:snapshot.context}:{}),...(physicalRevision?{physicalRevision}:{}),view:copy(job.view),signal:job.controller.signal,onProgress});}catch(error){output=Promise.reject(error);}
    job.settled=Promise.resolve(output).then(blob=>finish(job,blob)).catch(error=>{if(job.state==='running'&&jobs.has(jobId)){job.state='failed';job.error=String(error?.message||error).slice(0,1000);if(WEBM_FAILURE_CODES.has(error?.code))job.errorCode=error.code;}}).finally(()=>{renderActive=false;job.executionSettled=true;});
    resolve();return summary(job);
   }catch(error){requests.delete(normalized.requestId);reject(error);throw error;}
  }
 return Object.freeze({
  start:(args,options)=>start(args,options),
  startCompare:(args,options)=>start(args,options,true),
  status(args){return summary(find(args));},
  waitForSettled(args){return find(args).settled;},
  cancel(args){const job=find(args);stop(job);return summary(job);},
  cancelAll(){epoch++;for(const job of jobs.values())stop(job);return {schemaVersion:1,cancelled:true};},
  release(args){const job=find(args);stop(job);if(job.bytes){retainedBytes-=job.bytes.length;job.bytes=null;}jobs.delete(job.jobId);requests.delete(job.request.requestId);return {schemaVersion:1,jobId:job.jobId,released:true};},
  artifact({jobId,offset=0,length=CHUNK}={}){const job=find({jobId});if(job.state!=='completed'||!job.bytes)throw Error('Visual export artifact is unavailable');if(!Number.isSafeInteger(offset)||offset<0||offset>job.bytes.length||!Number.isSafeInteger(length)||length<1||length>CHUNK)throw Error('Invalid visual export artifact page');const end=Math.min(offset+length,job.bytes.length);return {schemaVersion:1,jobId,...copy(job.metadata),offset,nextOffset:end<job.bytes.length?end:null,encoding:'base64',data:base64(job.bytes.subarray(offset,end))};}
 });
}
