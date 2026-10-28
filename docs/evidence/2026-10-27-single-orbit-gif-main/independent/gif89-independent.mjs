// Independent bounded GIF89a/LZW reader from GIF89a specification, not product/test helper imports.
// https://www.w3.org/Graphics/GIF/spec-gif89a.txt
import assert from 'node:assert/strict';
export function readGif(bytes){
 assert.ok(bytes instanceof Uint8Array&&bytes.length>13&&bytes.length<=33554432);let at=0,controls=null,loop=null,ended=false;const frames=[];
 const take=n=>{assert.ok(Number.isSafeInteger(n)&&n>=0&&at+n<=bytes.length,'truncated GIF');const b=bytes.subarray(at,at+n);at+=n;return b;},u8=()=>take(1)[0],u16=()=>{const b=take(2);return b[0]+b[1]*256;},text=b=>Buffer.from(b).toString('ascii');
 assert.equal(text(take(6)),'GIF89a');const width=u16(),height=u16(),packed=u8(),background=u8(),aspect=u8();assert.equal(width,640);assert.equal(height,320);assert.ok(packed&128);const palette=take(3*(1<<((packed&7)+1))).slice();
 const blocks=()=>{const pieces=[];let size=0;for(let i=0;i<131073;i++){const n=u8();if(!n)return Buffer.concat(pieces);size+=n;assert.ok(size<=33554432);pieces.push(take(n));}throw Error('GIF sub-block count exceeded');};
 for(let count=0;count<128;count++){
  const tag=u8();if(tag===59){assert.equal(at,bytes.length);assert.equal(controls,null);ended=true;break;}
  if(tag===33){const label=u8();if(label===249){assert.equal(controls,null);assert.equal(u8(),4);const flags=u8(),delay=u16(),transparentIndex=u8();assert.equal(u8(),0);controls={controlFlags:flags,delay,transparentIndex};}else if(label===255){assert.equal(u8(),11);const application=text(take(11)),data=blocks();assert.equal(application,'NETSCAPE2.0');assert.equal(loop,null);assert.equal(data.length,3);assert.equal(data[0],1);loop=data[1]+data[2]*256;}else if(label===254){blocks();}else throw Error('Unsupported GIF extension '+label);continue;}
  assert.equal(tag,44);assert.ok(controls);assert.ok(frames.length<24);const left=u16(),top=u16(),w=u16(),h=u16(),flags=u8();assert.equal(left,0);assert.equal(top,0);assert.equal(w,width);assert.equal(h,height);assert.equal(flags&64,0,'interlaced frame not in app profile');assert.equal(flags&128,0,'local palette not in app profile');const minimum=u8(),compressed=blocks();const indices=lzw(compressed,minimum,w*h);frames.push({...controls,left,top,width:w,height:h,flags,minimum,indices});controls=null;
 }
 assert.equal(ended,true);assert.equal(frames.length,24);return {width,height,packed,background,aspect,palette,loop,frames};
}
function lzw(data,minimum,expected){
 assert.ok(Number.isInteger(minimum)&&minimum>=2&&minimum<=8);const clear=1<<minimum,end=clear+1,prefix=new Int16Array(4096),suffix=new Uint8Array(4096),stack=new Uint8Array(4096),out=new Uint8Array(expected);let width=minimum+1,next=end+1,old=-1,first=0,bit=0,pos=0,ended=false,sawClear=false;
 const code=()=>{assert.ok(bit+width<=data.length*8,'truncated LZW');let n=0;for(let i=0;i<width;i++,bit++)n|=((data[bit>>3]>>(bit&7))&1)<<i;return n;};
 for(let reads=0;reads<expected*2+512;reads++){
  let k=code();if(k===clear){width=minimum+1;next=end+1;old=-1;sawClear=true;continue;}assert.equal(sawClear,true,'LZW requires initial clear');if(k===end){ended=true;break;}const incoming=k;let depth=0;if(k===next){assert.ok(old>=0);stack[depth++]=first;k=old;}else assert.ok(k<next,'unknown LZW code');
  while(k>=clear){assert.ok(k<next&&depth<4095);stack[depth++]=suffix[k];k=prefix[k];}assert.ok(k>=0&&k<clear);first=k;stack[depth++]=first;assert.ok(pos+depth<=expected,'LZW pixel overflow');while(depth)out[pos++]=stack[--depth];
  if(old>=0&&next<4096){prefix[next]=old;suffix[next]=first;next++;if(next===(1<<width)&&width<12)width++;}old=incoming;
 }
 assert.equal(ended,true,'LZW end code missing');assert.equal(pos,expected,'LZW pixel underflow');return out;
}
export function rgbPixels(frame,palette){const rgb=new Uint8Array(frame.indices.length*3);for(let i=0;i<frame.indices.length;i++){const n=frame.indices[i]*3;assert.ok(n+2<palette.length);rgb.set(palette.subarray(n,n+3),i*3);}return rgb;}
