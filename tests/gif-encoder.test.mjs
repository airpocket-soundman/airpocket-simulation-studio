import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGifEncoder,gifFrameDelays} from '../src/gif-encoder.js';

// Independent general GIF parser/LZW decoder, including dictionary growth and special next-code cases.
import {decodeGif as decode} from './helpers/gif-decode.mjs';

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
