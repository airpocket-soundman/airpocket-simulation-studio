import {COMPARISON_GIF,createGifEncoder,gifFrameDelays} from '../gif-encoder.js';
import {orbitCameraPosition} from '../visual-export-fixed-frame.js';

export function comparisonGifCapabilities({createCanvas=()=>globalThis.document?.createElement('canvas')}={}){let supported=false;try{supported=!!createCanvas()?.getContext?.('2d');}catch{}return {supported,animations:['orbit','time','deformation'],mimeType:'image/gif',frames:24,width:640,height:320,palette:'RGB332',colors:256};}

/** Fixed animation phases; one RGBA frame at a time. The adapter owns leases and restoration. */
export async function renderComparisonGif({renderFrame,camera,animation='orbit',seconds,signal,onProgress=()=>{},assertCurrent=()=>{}},env={}){
 const check=()=>{if(signal?.aborted)throw Error('Comparison GIF cancelled');assertCurrent();env.check?.();};
 const yieldControl=env.yieldControl??(()=>new Promise(resolve=>setTimeout(resolve,0)));
 if(!['orbit','time','deformation'].includes(animation))throw Error('Invalid comparison GIF animation');
 check();const delays=gifFrameDelays(seconds),{width,height,frames}=COMPARISON_GIF;
 const canvas=(env.createCanvas??(()=>document.createElement('canvas')))();canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('GIF canvas is unavailable');
 const encoder=createGifEncoder({width,height,frames,maxBytes:env.maxBytes??COMPARISON_GIF.maxBytes});
 try{
  for(let i=0;i<frames;i++){
   check();await yieldControl();check();const phase=i/(animation==='orbit'?frames:frames-1),next=animation==='orbit'?{...structuredClone(camera),position:orbitCameraPosition(camera.position,camera.target,phase*Math.PI*2)}:structuredClone(camera);
   const source=renderFrame(next,{phase,animation});check();
   if(!source||!Number.isInteger(source.width)||!Number.isInteger(source.height)||source.width<1||source.height<1)throw Error('Invalid comparison GIF source canvas');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(source,0,0,width,height);
   await encoder.addFrame(ctx.getImageData(0,0,width,height).data,delays[i],{check,yieldControl});check();onProgress({fraction:(i+1)/frames});
  }
  check();return encoder.finish();
 }finally{canvas.width=0;canvas.height=0;}
}
