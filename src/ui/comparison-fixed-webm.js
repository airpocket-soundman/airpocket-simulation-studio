import {fixedWebmSchedule,muxFixedWebm,demuxFixedWebm,FIXED_WEBM_LIMITS,fixedWebmError} from '../fixed-webm.js';
import {createWebmRecordingLifecycle} from './webm-recording-lifecycle.js';

// WebCodecs coded dimensions may include non-visible padding (e.g. VP8
// 440x637 -> coded 440x638). Verify the exact visible/display image, while
// bounding decoder storage to a deliberately narrow +16 pixels on each axis.
const MAX_DECODED_PADDING=16;
function decodedViewportMatches(frame,width,height){
 const r=frame.visibleRect;
 return Number.isSafeInteger(frame.codedWidth)&&Number.isSafeInteger(frame.codedHeight)&&frame.codedWidth>=width&&frame.codedHeight>=height&&frame.codedWidth<=width+MAX_DECODED_PADDING&&frame.codedHeight<=height+MAX_DECODED_PADDING&&r!==null&&r!==undefined&&[r.x,r.y,r.width,r.height].every(Number.isSafeInteger)&&r.x===0&&r.y===0&&r.width===width&&r.height===height&&r.x+r.width<=frame.codedWidth&&r.y+r.height<=frame.codedHeight&&frame.displayWidth===width&&frame.displayHeight===height&&frame.rotation===0&&frame.flip===false;
}

export function comparisonFixedWebmCapabilities(env={}){
 const pick=k=>Object.hasOwn(env,k)?env[k]:globalThis[k];
 const available=['VideoEncoder','VideoDecoder','VideoFrame','EncodedVideoChunk'].every(k=>typeof pick(k)==='function')&&['VideoEncoder','VideoDecoder'].every(k=>typeof pick(k).isConfigSupported==='function');
 return {supported:available,recording:'fixed-frame',codec:'vp8',codecSupport:'checked-at-export',maxFrames:120,maxArtifactBytes:FIXED_WEBM_LIMITS.bytes,...(!available?{code:'WEBM_FIXED_UNSUPPORTED',reason:'保存時刻のWebMには動画の符号化・復号の対応が必要です。比較GIFを使用してください。'}:{})};
}

// A bounded app encoder, never a page/user script. Decode the strict muxed result
// before publishing it; callbacks/paint/elapsed wall time are not encoded evidence.
export async function encodeComparisonTimeWebm({initialCanvas,renderFrame,camera,animation='time',seconds,signal,onProgress=()=>{},onVerified=()=>{},assertCurrent=()=>{}},env={}){
 if(animation!=='time')throw fixedWebmError('WEBM_FIXED_INVALID','Fixed WebM only supports comparison stored time');
 if(!comparisonFixedWebmCapabilities(env).supported)throw fixedWebmError('WEBM_FIXED_UNSUPPORTED','保存時刻のWebMには動画の符号化・復号の対応が必要です。比較GIFを使用してください。');
 const Encoder=env.VideoEncoder??globalThis.VideoEncoder,Decoder=env.VideoDecoder??globalThis.VideoDecoder,Frame=env.VideoFrame??globalThis.VideoFrame,Chunk=env.EncodedVideoChunk??globalThis.EncodedVideoChunk;
 const plan=fixedWebmSchedule(seconds),width=initialCanvas?.width,height=initialCanvas?.height;
 if(!Number.isSafeInteger(width)||width<1||width>1280||!Number.isSafeInteger(height)||height<1||height>640)throw fixedWebmError('WEBM_FIXED_INVALID','Fixed WebM canvas exceeds 1280 by 640');
 const config={codec:'vp8',width,height,bitrate:5000000,framerate:plan.length/seconds,latencyMode:'realtime'},decoderConfig={codec:'vp8',codedWidth:width,codedHeight:height};
 const schedule=env.setTimeout??globalThis.setTimeout,clear=env.clearTimeout??globalThis.clearTimeout,yieldControl=env.yieldControl??(()=>new Promise(resolve=>schedule(resolve,0)));
 let encoder,decoder,lifecycle,error,retained=0,timer,rejectFailure,disposed=false;
 const failed=new Promise((_,reject)=>rejectFailure=reject);failed.catch(()=>{});
 const fail=e=>{if(!error){error=typeof e?.code==='string'&&/^(WEBM_FIXED_(INVALID|UNSUPPORTED|CODEC_FAILURE|OUTPUT_MISMATCH|CANCELLED|TIMEOUT)|WEBM_ENDPOINT_UNVERIFIED|WEBM_BACKGROUND_INTERRUPTED|WEBM_PROGRESS_STALLED)$/.test(e.code)?e:fixedWebmError('WEBM_FIXED_CODEC_FAILURE','Fixed WebM codec failed');rejectFailure(error);}};
 const cancelled=()=>fixedWebmError('WEBM_FIXED_CANCELLED','Comparison fixed-frame WebM cancelled');
 const check=()=>{if(disposed)throw fixedWebmError('WEBM_FIXED_CODEC_FAILURE','Fixed WebM operation is closed');if(signal?.aborted)throw cancelled();if(error)throw error;lifecycle?.check();assertCurrent();};
 const race=promise=>Promise.race([Promise.resolve(promise),failed]);
 const abort=()=>fail(cancelled());signal?.addEventListener('abort',abort,{once:true});
 const submittedTimestamps=new Set(),submittedDecodeTimestamps=new Set();
 const packets=new Map(),expected=new Map(plan.map(p=>[p.timestamp,p]));
 try{
  check();timer=schedule(()=>fail(fixedWebmError('WEBM_FIXED_TIMEOUT','Fixed WebM exceeded its 120 second limit')),120000);
  lifecycle=createWebmRecordingLifecycle({...env,onFailure:fail});
  let support;try{support=Promise.all([Encoder.isConfigSupported(config),Decoder.isConfigSupported(decoderConfig)]);}catch{throw fixedWebmError('WEBM_FIXED_UNSUPPORTED','Stored-time VP8 codec support could not be checked. Use comparison GIF instead.');}
  const [enc,dec]=await race(support.catch(()=>{throw fixedWebmError('WEBM_FIXED_UNSUPPORTED','Stored-time VP8 codec support could not be checked. Use comparison GIF instead.');}));check();
  if(!enc?.supported||!dec?.supported)throw fixedWebmError('WEBM_FIXED_UNSUPPORTED','This browser cannot encode and verify stored-time VP8 WebM. Use comparison GIF instead.');
  encoder=new Encoder({error:e=>{if(!disposed)fail(e);},output:chunk=>{if(disposed)return;try{
   check();const p=expected.get(chunk.timestamp);
   if(!p||!submittedTimestamps.has(chunk.timestamp)||packets.has(chunk.timestamp)||chunk.type!=='key'||!Number.isSafeInteger(chunk.byteLength)||chunk.byteLength<1||chunk.byteLength>FIXED_WEBM_LIMITS.bytes-65536-retained)throw fixedWebmError('WEBM_FIXED_OUTPUT_MISMATCH','Fixed WebM encoder returned missing, duplicate or unexpected frame data');
   if(chunk.duration!=null&&chunk.duration!==p.duration)throw fixedWebmError('WEBM_FIXED_OUTPUT_MISMATCH','Fixed WebM encoded frame duration changed');
   const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);retained+=data.length;packets.set(chunk.timestamp,{timestamp:p.timestamp,duration:p.duration,type:'key',data});lifecycle.progress();
  }catch(e){fail(e);}}});encoder.configure(config);let submitted=0;
  for(const entry of plan){
   check();while(encoder.encodeQueueSize>=FIXED_WEBM_LIMITS.queue||submitted-packets.size>=FIXED_WEBM_LIMITS.queue){await race(yieldControl());check();}
   const canvas=renderFrame(structuredClone(camera),{phase:entry.phase,animation:'time'});check();
   if(canvas?.width!==width||canvas?.height!==height)throw fixedWebmError('WEBM_FIXED_INVALID','Comparison fixed WebM canvas dimensions changed');
   let frame;try{frame=new Frame(canvas,{timestamp:entry.timestamp,duration:entry.duration});submittedTimestamps.add(entry.timestamp);submitted++;encoder.encode(frame,{keyFrame:true});}finally{frame?.close();}
   lifecycle.progress();onProgress({fraction:(entry.index+1)/plan.length,kind:'time',recording:'fixed-frame'});await race(yieldControl());
  }
  await race(encoder.flush());check();
  if(packets.size!==plan.length||plan.some(p=>!packets.has(p.timestamp)))throw fixedWebmError('WEBM_FIXED_OUTPUT_MISMATCH','Fixed WebM encoder did not return every scheduled frame including the endpoint');
  encoder.close();encoder=undefined;
  const bytes=muxFixedWebm({width,height,seconds,packets:plan.map(p=>packets.get(p.timestamp))}),parsed=demuxFixedWebm(bytes);
  const decoded=new Set();
  decoder=new Decoder({error:e=>{if(!disposed)fail(e);},output:frame=>{try{if(disposed)return;
   check();if(!expected.has(frame.timestamp)||!submittedDecodeTimestamps.has(frame.timestamp)||decoded.has(frame.timestamp)||!decodedViewportMatches(frame,width,height))throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Fixed WebM decoded frame identity or dimensions differ');decoded.add(frame.timestamp);lifecycle.progress();
  }catch(e){fail(e);}finally{frame.close();}}});decoder.configure(decoderConfig);let submittedDecode=0;
  for(const packet of parsed.packets){check();while(decoder.decodeQueueSize>=FIXED_WEBM_LIMITS.queue||submittedDecode-decoded.size>=FIXED_WEBM_LIMITS.queue){await race(yieldControl());check();}submittedDecodeTimestamps.add(packet.timestamp);submittedDecode++;decoder.decode(new Chunk(packet));await race(yieldControl());}
  await race(decoder.flush());check();
  if(decoded.size!==plan.length||plan.some(p=>!decoded.has(p.timestamp)))throw fixedWebmError('WEBM_ENDPOINT_UNVERIFIED','Fixed WebM could not decode every scheduled frame including the endpoint');
  onVerified({schemaVersion:1,codec:'vp8',frameCount:plan.length,encodedFrameCount:packets.size,decodedFrameCount:decoded.size,terminalTimestamp:plan.at(-1).timestamp,totalDurationMicroseconds:seconds*1000000,verification:'strict-webm-demux+video-decoder'});check();
  return new Blob([bytes],{type:'video/webm;codecs=vp8'});
 }finally{
  disposed=true;clear(timer);lifecycle?.dispose();signal?.removeEventListener('abort',abort);for(const codec of [encoder,decoder])if(codec?.state!=='closed')try{codec?.close();}catch{}packets.clear();
 }
}
