// Dependency-free opaque RGB332 GIF89a. Frequent dictionary clears keep LZW codes at nine bits.
export const COMPARISON_GIF=Object.freeze({width:640,height:320,frames:24,maxBytes:32*1024*1024,palette:'RGB332',colors:256});
export function gifFrameDelays(seconds){
 if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error('GIF seconds must be an integer from 1 through 15');
 return Array.from({length:24},(_,i)=>Math.round((i+1)*seconds*100/24)-Math.round(i*seconds*100/24));
}
const word=n=>[n&255,n>>8&255];
export function createGifEncoder({width,height,frames=24,maxBytes=COMPARISON_GIF.maxBytes}={}){
 if(!Number.isInteger(width)||width<1||width>640||!Number.isInteger(height)||height<1||height>320||!Number.isInteger(frames)||frames<1||frames>24||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>COMPARISON_GIF.maxBytes)throw Error('Invalid GIF bounds');
 const parts=[];let bytes=0,count=0,closed=false;
 const append=part=>{const b=Uint8Array.from(part);if(bytes+b.length>maxBytes)throw Error('GIF byte budget exceeded');parts.push(b);bytes+=b.length;};
 const palette=[];for(let i=0;i<256;i++)palette.push(Math.round((i>>5)*255/7),Math.round((i>>2&7)*255/7),Math.round((i&3)*255/3));
 append([...new TextEncoder().encode('GIF89a'),...word(width),...word(height),247,0,0,...palette]);
 append([33,255,11,...new TextEncoder().encode('NETSCAPE2.0'),3,1,0,0,0]);
 return {
  async addFrame(rgba,delayCs,{check=()=>{},yieldControl=async()=>{}}={}){
   if(closed||count>=frames||!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4||!Number.isInteger(delayCs)||delayCs<1||delayCs>65535)throw Error('Invalid GIF frame');
   check();const compressed=new Uint8Array(Math.ceil((width*height+Math.ceil(width*height/250)+2)*9/8));let position=0,bits=0,acc=0,run=0;
   const code=value=>{acc|=value<<bits;bits+=9;while(bits>=8){compressed[position++]=acc&255;acc>>>=8;bits-=8;}};
   code(256);
   for(let i=0;i<width*height;i++){
    if(i&&i%16384===0){check();await yieldControl();check();}
    if(run===250){code(256);run=0;}
    const p=i*4,a=rgba[p+3]/255;
    const r=Math.round((rgba[p]*a+255*(1-a))*7/255),g=Math.round((rgba[p+1]*a+255*(1-a))*7/255),b=Math.round((rgba[p+2]*a+255*(1-a))*3/255);
    code(r<<5|g<<2|b);run++;
   }
   code(257);if(bits)compressed[position++]=acc&255;check();
   append([33,249,4,4,...word(delayCs),0,0,44,0,0,0,0,...word(width),...word(height),0,8]);
   for(let i=0;i<position;i+=255){const n=Math.min(255,position-i);append([n,...compressed.subarray(i,i+n)]);}append([0]);count++;
  },
  finish(){if(closed||count!==frames)throw Error('GIF frame count incomplete');closed=true;append([59]);return new Blob(parts,{type:'image/gif'});}
 };
}
