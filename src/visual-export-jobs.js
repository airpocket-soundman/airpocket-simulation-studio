import {FIXED_FRAME_LIMITS,readStoreZip,sha256Hex} from './visual-export-fixed-frame.js';
const CHUNK=65536;
const copy=value=>structuredClone(value);
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function request(value){
 if(!value||typeof value.requestId!=='string'||!value.requestId.trim()||value.requestId.length>128)throw Error('Invalid visual export requestId');
 if(typeof value.expectedResultRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(value.expectedResultRevision))throw Error('Invalid expectedResultRevision');
 if(!['png','webm','png-sequence'].includes(value.format))throw Error('Visual export format must be png, webm or png-sequence');
 const animation=value.animation??'orbit';
 if(!['orbit','deformation','time','slice'].includes(animation))throw Error('Invalid visual export animation or seconds');
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
 for(const record of detail.frames){const data=files.get(record.file);if(!data||record.resultRevision!==expectedResultRevision||'sha256:'+await sha256Hex(data)!==record.sha256)throw Error('png-sequence frame hash mismatch');}
 const manifest={schemaVersion:1,resultRevision:expectedResultRevision,format:'png-sequence',container:'zip',compression:'store',mimeType,sha256,totalBytes:bytes.length,frameCount:frames,
  resolution:detail.resolution,view:detail.view,time:{animation,timeBasis:'fixed-frame',realtime:false,wallClockIndependent:true,frameSelection:animation==='time'?'stored-acoustic-frames-only':'deterministic schedule'},
  manifestEntry:{name:'manifest.json',bytes:inner.length,sha256:'sha256:'+await sha256Hex(inner)},scale:detail.scale};
 if(JSON.stringify(manifest).length>MAX_MANIFEST_BYTES)throw Error('Visual export manifest exceeds its size bound');
 return manifest;
}
function buildManifest(job,mimeType,bytes,sha256){
 const {format,animation,seconds,expectedResultRevision}=job.request,result=job.view?.result&&typeof job.view.result==='object'?job.view.result:{},picked={};
 for(const key of RESULT_SETTINGS)if(typeof result[key]==='string'&&result[key].length<=64||finite(result[key]))picked[key]=result[key];
 if(result.camera&&typeof result.camera==='object'){const camera={};for(const key of ['position','target','up'])if(vector(result.camera[key]))camera[key]=vector(result.camera[key]);if(finite(result.camera.fov))camera.fov=result.camera.fov;if(Object.keys(camera).length)picked.camera=camera;}
 const size=format==='png'?pngSize(bytes):undefined,container=format==='png'?'png':'webm',codec=(/codecs=([^;]+)/.exec(mimeType)||[])[1];
 const manifest={schemaVersion:1,resultRevision:expectedResultRevision,format,container,mimeType,...(codec?{codec}:{}),sha256,totalBytes:bytes.length,
  view:picked,...(size?{resolution:size}:{}),
  scale:{units:{time:'second'},...(finite(picked.deformScale)?{deformScale:picked.deformScale,deformScaleKind:'visualization multiplier'}:{})}};
 if(format==='webm')manifest.time={animation,durationSeconds:seconds,timeBasis:'display time',...(animation==='time'?{physicalTime:'stored acoustic frames; physical time of each frame is shown in the overlay and is not scaled to the video duration',frameSelection:'stored-acoustic-frames-only'}:{}),fps:{target:TARGET_FPS,recording:'realtime',frameCountGuaranteed:false}};
 else manifest.time={animation:null,timeBasis:'single frame',...(finite(picked.timeSeconds)?{physicalTimeSeconds:picked.timeSeconds}:{})};
 if(JSON.stringify(manifest).length>MAX_MANIFEST_BYTES)throw Error('Visual export manifest exceeds its size bound');
 return manifest;
}
/** In-memory jobs; rendering, result validation and scene restoration belong to the adapter. */
export function createVisualExportJobs({render,prepare,maxBytes=32*1024*1024,maxJobs=4,id=()=>crypto.randomUUID()}={}){
 if(typeof render!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(maxJobs)||maxJobs<1)throw Error('Invalid visual export job configuration');
 const jobs=new Map(),requests=new Map();let retainedBytes=0,renderActive=false,epoch=0;
 const find=({jobId}={})=>{const job=jobs.get(jobId);if(!job)throw Error('Unknown visual export job');return job;};
 const summary=job=>({schemaVersion:1,jobId:job.jobId,requestId:job.request.requestId,state:job.state,format:job.request.format,resultRevision:job.request.expectedResultRevision,view:copy(job.view),progress:copy(job.progress),...(job.error?{error:job.error}:{}),...(job.metadata?{artifact:copy(job.metadata)}:{})});
 function stop(job){if(job.state==='running'){job.state='cancelled';job.controller.abort();}}
 function finish(job,blob){
  return (async()=>{
   if(job.state!=='running'||!jobs.has(job.jobId))return;
   const format=job.request.format,mime=format==='png'?'image/png':format==='png-sequence'?'application/zip':'video/webm';
   if(!(blob instanceof Blob)||!blob.size||!(blob.type===mime||mime==='video/webm'&&blob.type.startsWith('video/webm;')))throw Error('Renderer returned an invalid visual artifact');
   if(blob.size>maxBytes-retainedBytes)throw Error('Visual export retained byte budget exceeded');
   const bytes=new Uint8Array(await blob.arrayBuffer());
   if(job.state!=='running'||!jobs.has(job.jobId))return;
   // Reserve before hashing so overlapping completions share one exact byte budget.
   if(bytes.length>maxBytes-retainedBytes)throw Error('Visual export retained byte budget exceeded');
   retainedBytes+=bytes.length;job.bytes=bytes;
   try{
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    if(job.state!=='running'||!jobs.has(job.jobId))return;
    const sha256='sha256:'+Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');const manifest=format==='png-sequence'?await sequenceManifest(job,blob.type,bytes,sha256):buildManifest(job,blob.type,bytes,sha256);if(job.state!=='running'||!jobs.has(job.jobId))return;job.metadata={mimeType:blob.type,name:`result-${job.jobId}.${format==='png-sequence'?'zip':format}`,totalBytes:bytes.length,sha256,maxChunkBytes:CHUNK,manifest};job.progress={fraction:1};job.state='completed';
   }finally{if(job.state!=='completed'&&job.bytes){retainedBytes-=job.bytes.length;job.bytes=null;}}
  })();
 }
 return Object.freeze({
  async start(args,{guard=()=>true}={}){
   const normalized=request(args),key=canonical(normalized),prior=requests.get(normalized.requestId);
   if(prior){if(prior.key!==key)throw Error('Visual export requestId conflict');await prior.ready;return summary(find({jobId:prior.jobId}));}
   if(!guard())throw Error('Visual export request expired');
   if(renderActive||Array.from(requests.values()).some(r=>!r.jobId))throw Error('A visual export is already active');
   if(jobs.size+Array.from(requests.values()).filter(r=>!r.jobId).length>=maxJobs)throw Error('Visual export job limit reached; release a job');
   const startEpoch=epoch;let resolve,reject;const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});ready.catch(()=>{});const entry={key,ready,jobId:null};requests.set(normalized.requestId,entry);
   try{
    const snapshot=prepare?await prepare(copy(normalized)):{resultRevision:normalized.expectedResultRevision,view:normalized.view};
    if(!guard()||epoch!==startEpoch)throw Error('Visual export request expired');
    if(snapshot?.resultRevision!==normalized.expectedResultRevision)throw Error('Displayed result revision conflict');
    if(!snapshot.view||typeof snapshot.view!=='object'||Array.isArray(snapshot.view))throw Error('Visual export requires frozen view settings');
    const jobId=id();if(typeof jobId!=='string'||!jobId||jobs.has(jobId))throw Error('Invalid or duplicate visual export job ID');
    const job={jobId,request:freeze(copy(normalized)),view:freeze(copy(snapshot.view)),state:'running',progress:{fraction:0},controller:new AbortController(),bytes:null};jobs.set(jobId,job);entry.jobId=jobId;
    const onProgress=value=>{if(job.state!=='running')return;const fraction=typeof value==='number'?value:value?.fraction;if(Number.isFinite(fraction)&&fraction>=0&&fraction<=1)job.progress={fraction};};
    // Calling synchronously reserves the renderer before another start can run.
    renderActive=true;let output;try{output=render({...copy(normalized),view:copy(job.view),signal:job.controller.signal,onProgress});}catch(error){output=Promise.reject(error);}
    Promise.resolve(output).then(blob=>finish(job,blob)).catch(error=>{if(job.state==='running'&&jobs.has(jobId)){job.state='failed';job.error=String(error?.message||error).slice(0,1000);}}).finally(()=>{renderActive=false;});
    resolve();return summary(job);
   }catch(error){requests.delete(normalized.requestId);reject(error);throw error;}
  },
  status(args){return summary(find(args));},
  cancel(args){const job=find(args);stop(job);return summary(job);},
  cancelAll(){epoch++;for(const job of jobs.values())stop(job);return {schemaVersion:1,cancelled:true};},
  release(args){const job=find(args);stop(job);if(job.bytes){retainedBytes-=job.bytes.length;job.bytes=null;}jobs.delete(job.jobId);requests.delete(job.request.requestId);return {schemaVersion:1,jobId:job.jobId,released:true};},
  artifact({jobId,offset=0,length=CHUNK}={}){const job=find({jobId});if(job.state!=='completed'||!job.bytes)throw Error('Visual export artifact is unavailable');if(!Number.isSafeInteger(offset)||offset<0||offset>job.bytes.length||!Number.isSafeInteger(length)||length<1||length>CHUNK)throw Error('Invalid visual export artifact page');const end=Math.min(offset+length,job.bytes.length);return {schemaVersion:1,jobId,...copy(job.metadata),offset,nextOffset:end<job.bytes.length?end:null,encoding:'base64',data:base64(job.bytes.subarray(offset,end))};}
 });
}
