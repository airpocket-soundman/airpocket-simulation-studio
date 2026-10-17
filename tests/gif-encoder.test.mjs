import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGifEncoder,gifFrameDelays} from '../src/gif-encoder.js';

// Independent general GIF parser/LZW decoder, including dictionary growth and special next-code cases.
function decode(bytes){
 let p=6;const word=()=>{const v=bytes[p]|bytes[p+1]<<8;p+=2;return v;},width=word(),height=word(),packed=bytes[p++];p+=2;
 const palette=bytes.slice(p,p+3*(2<<(packed&7)));p+=palette.length;const frames=[];let delay=0,loop;
 const blocks=()=>{const out=[];while(bytes[p]){const n=bytes[p++];out.push(...bytes.slice(p,p+n));p+=n;}p++;return out;};
 while(bytes[p]!==59){const marker=bytes[p++];if(marker===33){const type=bytes[p++];if(type===249){assert.equal(bytes[p++],4);p++;delay=word();p+=2;}else{const data=blocks();if(type===255)loop=data[data.length-2]|data[data.length-1]<<8;}continue;}
  assert.equal(marker,44);const left=word(),top=word(),w=word(),h=word(),flags=bytes[p++];assert.equal(flags,0);assert.equal(left+top,0);
  const minimum=bytes[p++],data=blocks(),clear=1<<minimum,end=clear+1;let dictionary,bits,next,bit=0,previous=null;const pixels=[];
  const reset=()=>{dictionary=Array.from({length:clear},(_,i)=>[i]);bits=minimum+1;next=end+1;previous=null;};reset();
  for(;;){let code=0;for(let i=0;i<bits;i++,bit++)code|=(data[bit>>3]>>(bit&7)&1)<<i;if(code===clear){reset();continue;}if(code===end)break;
   const entry=dictionary[code]??(code===next&&previous?[...previous,previous[0]]:null);assert.ok(entry,'valid LZW code');pixels.push(...entry);
   if(previous){dictionary[next++]=[...previous,entry[0]];if(next===(1<<bits)&&bits<12)bits++;}previous=entry;
  }
  assert.equal(pixels.length,w*h);frames.push({delay,pixels,width:w,height:h});
 }
 assert.equal(p,bytes.length-1);return {width,height,palette,loop,frames};
}
test('GIF decodes across LZW clear and 255-byte subblocks with expected RGB332 colors',async()=>{
 const width=320,height=20,rgba=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++)rgba.set([i%256,(i*7)%256,(i*13)%256,255],i*4);
 const encoder=createGifEncoder({width,height,frames:2});await encoder.addFrame(rgba,4);await encoder.addFrame(rgba,5);const blob=encoder.finish(),result=decode(new Uint8Array(await blob.arrayBuffer()));assert.equal(blob.type,'image/gif');assert.equal(result.width,width);assert.equal(result.height,height);assert.equal(result.loop,0);assert.deepEqual(result.frames.map(f=>f.delay),[4,5]);
 for(let i=0;i<width*height;i++){const p=i*4,index=Math.round(rgba[p]*7/255)<<5|Math.round(rgba[p+1]*7/255)<<2|Math.round(rgba[p+2]*3/255);assert.equal(result.frames[0].pixels[i],index);}
 assert.deepEqual(result.frames[0].pixels,result.frames[1].pixels);assert.throws(()=>encoder.finish(),/count/);
});
test('fixed delays are positive and sum exactly to every supported duration',()=>{
 for(let seconds=1;seconds<=15;seconds++){const delays=gifFrameDelays(seconds);assert.equal(delays.length,24);assert.equal(delays.reduce((a,b)=>a+b),seconds*100);assert.ok(delays.every(n=>Number.isInteger(n)&&n>0));}for(const x of [0,16,1.2,NaN])assert.throws(()=>gifFrameDelays(x));
});
test('encoder bounds, incomplete output, memory cap and cancellation refuse output',async()=>{
 assert.throws(()=>createGifEncoder({width:641,height:1}));const rgba=new Uint8ClampedArray(4*320*60),e=createGifEncoder({width:320,height:60,frames:1});assert.throws(()=>e.finish(),/incomplete/);let yields=0;
 await assert.rejects(e.addFrame(rgba,1,{yieldControl:async()=>{yields++;},check:()=>{if(yields)throw Error('cancelled');}}),/cancelled/);assert.throws(()=>e.finish(),/incomplete/);
 const capped=createGifEncoder({width:2,height:2,frames:1,maxBytes:810});await assert.rejects(capped.addFrame(new Uint8Array(16),1),/budget/);
});
