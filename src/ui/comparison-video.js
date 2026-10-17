import {hasVideoFrames} from '../visual-export.js';

const WEBM_TYPES=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
const MAX_BYTES=32*1024*1024;
const cancelled=()=>Error('Comparison video cancelled');

export function comparisonVideoCapabilities({canvas,MediaRecorder:Recorder=globalThis.MediaRecorder}={}){
 const capture=canvas?canvas.captureStream:globalThis.HTMLCanvasElement?.prototype?.captureStream;
 if(typeof capture!=='function')return {supported:false,reason:'Canvas captureStream is unavailable'};
 const mimeType=WEBM_TYPES.find(type=>{try{return Recorder?.isTypeSupported?.(type)===true;}catch{return false;}});
 return mimeType?{supported:true,mimeType}:{supported:false,reason:'A supported WebM MediaRecorder codec is unavailable'};
}

function orbit(camera,phase){
 const angle=phase*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle),[x,y,z]=camera.position.map((v,i)=>v-camera.target[i]);
 return {...structuredClone(camera),position:[x*c+z*s+camera.target[0],y+camera.target[1],-x*s+z*c+camera.target[2]]};
}

/** Real-time orbit of one shared camera. The caller owns source leases and viewer restoration. */
export async function recordComparisonVideo({initialCanvas,renderFrame,camera,animation='orbit',seconds,signal,onProgress=()=>{}},env={}){
 const Recorder=env.MediaRecorder??globalThis.MediaRecorder,now=env.now??(()=>performance.now()),raf=env.requestAnimationFrame??globalThis.requestAnimationFrame,cancel=env.cancelAnimationFrame??globalThis.cancelAnimationFrame;
 const verify=env.hasVideoFrames??hasVideoFrames,maxBytes=env.maxBytes??MAX_BYTES;
 const flushWait=env.flushWait??(milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds)));
 if(signal?.aborted)throw cancelled();
 if(!['orbit','time','deformation'].includes(animation))throw Error('Comparison video supports orbit, stored time or visual deformation only');
 if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error('Comparison video duration must be an integer from 1 through 15');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_BYTES)throw Error('Invalid comparison video byte limit');
 if(typeof renderFrame!=='function'||typeof raf!=='function'||typeof cancel!=='function')throw Error('Comparison video rendering is unavailable');
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!camera||![camera.position,camera.target,camera.up].every(vector)||!Number.isFinite(camera.fov)||camera.fov<=0||camera.fov>=180)throw Error('Invalid comparison video camera');
 const direction=camera.target.map((v,i)=>v-camera.position[i]),up=camera.up,d=Math.hypot(...direction),u=Math.hypot(...up),cross=Math.hypot(direction[1]*up[2]-direction[2]*up[1],direction[2]*up[0]-direction[0]*up[2],direction[0]*up[1]-direction[1]*up[0]);
 if(![...direction,d,u,cross,d*u].every(Number.isFinite)||d<=1e-9||u<=1e-9||cross<=d*u*1e-9)throw Error('Degenerate comparison video camera');
 const capability=comparisonVideoCapabilities({canvas:initialCanvas,MediaRecorder:Recorder}),mime=capability.mimeType;
 if(!capability.supported)throw Error('WebM comparison recording is unavailable: '+capability.reason);
 const width=initialCanvas.width,height=initialCanvas.height;
 if(!Number.isInteger(width)||width<1||!Number.isInteger(height)||height<1)throw Error('Invalid comparison canvas dimensions');
 const originalCamera=structuredClone(camera),chunks=[];let stream,recorder,frameId,failPlayback,failure,bytes=0,finishRecording,stopping=false,renderedFrames=0,motion=false;
 const stopped=new Promise(resolve=>{finishRecording=resolve;});
 const fail=error=>{failure??=error;if(frameId!==undefined)cancel(frameId);failPlayback?.(failure);};
 const abort=()=>fail(cancelled());signal?.addEventListener('abort',abort,{once:true});
 try{
  stream=initialCanvas.captureStream(24);recorder=new Recorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});
  recorder.ondataavailable=event=>{if(!event.data?.size)return;bytes+=event.data.size;if(bytes>maxBytes){fail(Error('Comparison video exceeds its byte limit'));return;}chunks.push(event.data);};
  recorder.onstop=()=>{if(!stopping)fail(Error('Comparison recording stopped before playback completed'));finishRecording();};recorder.onerror=event=>{fail(event.error??Error('Comparison video recording failed'));finishRecording();};
  const requestFrame=()=>{const track=stream.getVideoTracks?.()[0];if(track?.readyState==='ended')throw Error('Comparison recording video track ended');track?.requestFrame?.();};
  recorder.start(250);requestFrame();const started=now();
  await new Promise((resolve,reject)=>{
   failPlayback=reject;
   const tick=()=>{try{
    if(failure)throw failure;if(signal?.aborted)throw cancelled();
    const phase=Math.max(0,Math.min(1,(now()-started)/(seconds*1000))),frame=renderFrame(animation==='orbit'?orbit(originalCamera,phase):structuredClone(originalCamera),{phase,animation});
    if(!frame||frame.width!==width||frame.height!==height||initialCanvas.width!==width||initialCanvas.height!==height)throw Error('Comparison canvas resolution changed during recording');
    if(frame!==initialCanvas){const context=initialCanvas.getContext('2d');if(!context)throw Error('Comparison canvas context is unavailable');context.clearRect(0,0,width,height);context.drawImage(frame,0,0);}
    requestFrame();renderedFrames++;motion||=phase>0&&phase<1;onProgress({fraction:phase,kind:animation});
    if(phase>=1)resolve();else frameId=raf(tick);
   }catch(error){reject(error);}};
   frameId=raf(tick);
  });
  if(renderedFrames<2||!motion)throw Error('Comparison video received too few animation frames; keep the browser foreground and retry');
  if(failure)throw failure;if(signal?.aborted)throw cancelled();requestFrame();
  // Offscreen canvas changes need an encoder turn before requestData/stop, especially under load.
  await new Promise((resolve,reject)=>{failPlayback=reject;Promise.resolve(flushWait(150)).then(resolve,reject);});
  if(failure)throw failure;if(signal?.aborted)throw cancelled();requestFrame();
 }catch(error){failure??=error;}
 finally{
  if(frameId!==undefined)cancel(frameId);failPlayback=undefined;
  try{
   if(recorder&&recorder.state!=='inactive'){
    stopping=true;try{recorder.requestData?.();}catch(error){failure??=error;}
    try{recorder.stop();}catch(error){failure??=error;finishRecording();}
    await stopped;
   }
  }finally{for(const track of stream?.getTracks?.()??[])try{track.stop();}catch(error){failure??=error;}signal?.removeEventListener('abort',abort);}
 }
 if(failure)throw failure;if(signal?.aborted)throw cancelled();
 if(!chunks.length)throw Error('Comparison recording produced no data');
 const blob=new Blob(chunks,{type:mime});
 if(!await verify(blob))throw Error('Comparison recording produced no video frames');
 if(signal?.aborted)throw cancelled();return blob;
}
