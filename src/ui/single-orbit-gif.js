import {COMPARISON_GIF,createGifEncoder,gifFrameDelays} from '../gif-encoder.js';
import {orbitCameraPosition,sha256Hex} from '../visual-export-fixed-frame.js';
import {canonicalJson} from '../project-revision.js';
import {canonicalViewState} from '../result-view-api.js';
export const SINGLE_ORBIT_GIF_LIMITS=Object.freeze({...COMPARISON_GIF,manifestBytes:16384,maxSourceWidth:640,maxSourceHeight:320});
const issued=new WeakMap(),readBlob=Blob.prototype.arrayBuffer;
const typed=Object.getPrototypeOf(Uint8Array.prototype),typedLength=Object.getOwnPropertyDescriptor(typed,'byteLength').get,typedBuffer=Object.getOwnPropertyDescriptor(typed,'buffer').get,abLength=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
function byteSnapshot(bytes,expected){
 if(!bytes||Object.getPrototypeOf(bytes)!==Uint8Array.prototype)fail('Ordinary orbit GIF bytes required');let n;try{n=typedLength.call(bytes);abLength.call(typedBuffer.call(bytes));}catch{fail('Shared or invalid orbit GIF bytes');}
 if(!Number.isSafeInteger(n)||n<1||n>COMPARISON_GIF.maxBytes||n!==expected)fail('Orbit GIF byte count differs from the issued animation');const owned=new Uint8Array(n);Uint8Array.prototype.set.call(owned,bytes);return owned;
}
const fail=message=>{throw Object.assign(Error(message),{code:'GIF_ORBIT_INVALID'});};
const cancelled=()=>Object.assign(Error('Single-view orbit GIF cancelled'),{code:'GIF_ORBIT_CANCELLED'});
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
function cameraSnapshot(input){
 if(!input||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Reflect.ownKeys(input).length!==4)fail('Plain bounded orbit camera required');
 const c={};for(const key of ['position','target','up','fov']){const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('Orbit camera data properties required');const v=d.value;if(key==='fov'){if(!Number.isFinite(v)||v<=0||v>=180)fail('Invalid orbit GIF camera');c[key]=v;}else{if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==3||Reflect.ownKeys(v).length!==4)fail('Three finite orbit camera coordinates required');c[key]=[];for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')||!Number.isFinite(d.value)||Math.abs(d.value)>1e9)fail('Invalid orbit GIF coordinate');c[key].push(d.value);}}}
 // Match the public result-view identity before deriving either the orbit or its proof.
 const normalized=canonicalViewState({camera:c}).camera;if(normalized.fov<=0||normalized.fov>=180)fail('Invalid canonical orbit GIF camera');return normalized;
}
export function singleOrbitGifCapabilities(env={}){let canvas,supported=false;try{canvas=(env.createCanvas??(()=>globalThis.document?.createElement('canvas')))();const ctx=canvas?.getContext?.('2d');supported=!!ctx&&typeof ctx.getImageData==='function'&&typeof ctx.drawImage==='function'&&typeof globalThis.crypto?.subtle?.digest==='function';}catch{}finally{if(canvas){canvas.width=0;canvas.height=0;}}return {supported,animations:['orbit'],mimeType:'image/gif',frames:24,width:640,height:320,maxArtifactBytes:COMPARISON_GIF.maxBytes,palette:'RGB332',colors:256,lossy:true,recording:'fixed-frame',...(!supported?{reason:'Orbit GIF needs a readable 2D canvas and SHA-256',alternatives:['webm','png']}:{})};}
export async function encodeSingleOrbitGif({camera,field,resultRevision,viewTimeSeconds,viewerFrameIndex,interpolated=false,timeApplies=false,modeIndex,animation='orbit',seconds,renderFrame,signal,onProgress=()=>{},assertCurrent=()=>{}},env={}){
 if(animation!=='orbit')fail('Single-view GIF supports orbit only');
 if(typeof field!=='string'||!field||field.length>64||typeof renderFrame!=='function'||resultRevision!==undefined&&!/^sha256:[a-f0-9]{64}$/.test(resultRevision))fail('Invalid orbit GIF source');
 if(viewTimeSeconds!==undefined&&(!Number.isFinite(viewTimeSeconds)||viewTimeSeconds<0)||viewerFrameIndex!==undefined&&(!Number.isSafeInteger(viewerFrameIndex)||viewerFrameIndex<0)||modeIndex!==undefined&&(!Number.isSafeInteger(modeIndex)||modeIndex<0)||typeof interpolated!=='boolean'||typeof timeApplies!=='boolean'||interpolated&&viewTimeSeconds===undefined)fail('Invalid selected GIF time/frame');
 const owned=cameraSnapshot(camera),delays=gifFrameDelays(seconds),plan=Array.from({length:24},(_,index)=>({index,phase:index/24,angleRadians:index/24*Math.PI*2,cameraPositionMm:orbitCameraPosition(owned.position,owned.target,index/24*Math.PI*2)}));
 const check=()=>{if(signal?.aborted)throw cancelled();assertCurrent();};check();
 const yieldControl=env.yieldControl??(()=>new Promise(resolve=>setTimeout(resolve,0))),canvas=(env.createCanvas??(()=>document.createElement('canvas')))();
 let encoder,sourceResolution;const records=[];
 try{canvas.width=640;canvas.height=320;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)fail('GIF canvas is unavailable');encoder=createGifEncoder({width:640,height:320,frames:24,maxBytes:env.maxBytes??COMPARISON_GIF.maxBytes});
  for(const step of plan){check();await yieldControl();check();const next={...structuredClone(owned),position:[...step.cameraPositionMm]},source=renderFrame(next,structuredClone(step));check();
   if(!source||source===canvas||!Number.isSafeInteger(source.width)||!Number.isSafeInteger(source.height)||source.width<1||source.height<1||source.width>640||source.height>320)fail('GIF source capture must fit 640 by 320');
   if(sourceResolution&&(source.width!==sourceResolution.width||source.height!==sourceResolution.height))fail('GIF source capture dimensions changed');sourceResolution??={width:source.width,height:source.height};
   const scale=Math.min(640/source.width,320/source.height),width=Math.max(1,Math.floor(source.width*scale)),height=Math.max(1,Math.floor(source.height*scale)),x=Math.floor((640-width)/2),y=Math.floor((320-height)/2);ctx.fillStyle='#102331';ctx.fillRect(0,0,640,320);ctx.drawImage(source,x,y,width,height);
   await encoder.addFrame(ctx.getImageData(0,0,640,320).data,delays[step.index],{check,yieldControl});check();records.push({...step,letterbox:{x,y,width,height},delayCentiseconds:delays[step.index]});onProgress({fraction:(step.index+1)/24});
  }
  check();const blob=encoder.finish(),bytes=new Uint8Array(await readBlob.call(blob)),sha256='sha256:'+await sha256Hex(bytes);check();const proof={sourceResultRevision:resultRevision,field,camera:owned,viewTimeSeconds,viewerFrameIndex,interpolated,timeApplies,selectedModeIndex:modeIndex,seconds,frames:records,sha256,totalBytes:bytes.length};if(new TextEncoder().encode(JSON.stringify(proof)).length>16384)fail('Orbit GIF proof exceeds metadata limit');issued.set(blob,freeze(proof));return blob;
 }finally{if(canvas){canvas.width=0;canvas.height=0;}}
}
export function getSingleOrbitGifVerification(blob){const proof=issued.get(blob);return proof?structuredClone(proof):null;}
export async function singleOrbitGifManifest(blob,bytes,{resultRevision,field,seconds,camera,timeSeconds,frameIndex,modeIndex}={}){
 const proof=issued.get(blob);if(!proof)fail('Orbit GIF proof is missing');
 if(proof.sourceResultRevision!==resultRevision)fail('Orbit GIF prepared result revision differs');
 if(proof.field!==field)fail('Orbit GIF prepared field differs');
 if(proof.seconds!==seconds)fail('Orbit GIF prepared duration differs');
 if((modeIndex??null)!==(proof.selectedModeIndex??null))fail('Orbit GIF prepared mode differs');
 if(timeSeconds!==undefined&&timeSeconds!==proof.viewTimeSeconds)fail('Orbit GIF prepared viewer time differs');
 if(frameIndex!==undefined&&frameIndex!==null&&frameIndex!==proof.viewerFrameIndex)fail('Orbit GIF prepared viewer frame differs');
 if(camera!==undefined&&canonicalJson(cameraSnapshot(camera))!==canonicalJson(proof.camera))fail('Orbit GIF prepared camera differs');
 const owned=byteSnapshot(bytes,proof.totalBytes),sha256='sha256:'+await sha256Hex(owned);if(sha256!==proof.sha256||owned.length!==proof.totalBytes)fail('Orbit GIF bytes differ from the issued complete animation');
 return {sha256,totalBytes:owned.length,resolution:{width:640,height:320},time:{animation:'orbit',durationSeconds:seconds,timeBasis:'display time',physicalTime:'Selected result field and viewer time remain fixed; only the camera moves',...(proof.selectedModeIndex===undefined?{}:{selectedModeIndex:proof.selectedModeIndex}),...(proof.viewTimeSeconds===undefined?{}:{viewerTimeSeconds:proof.viewTimeSeconds}),interpolated:proof.interpolated,timeSelectionBasis:proof.timeApplies?(proof.interpolated?'viewer-interpolated':'stored-frame'):'selected-field-has-no-time-history',...(proof.timeApplies&&proof.viewTimeSeconds!==undefined?{selectedPhysicalTimeSeconds:proof.viewTimeSeconds}:{}),...(!proof.interpolated&&proof.timeApplies&&proof.viewerFrameIndex!==undefined?{selectedStoredFrameIndex:proof.viewerFrameIndex}:{}),recording:'fixed-frame',realtime:false,frameCount:24,frameCountGuaranteed:true,phasePolicy:'i/24',camera:'orbit',loop:'infinite',delayCentiseconds:proof.frames.map(f=>f.delayCentiseconds),frames:structuredClone(proof.frames)},gif:{palette:'RGB332',colors:256,lossy:true,letterbox:true}};
}
