import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderComparisonGif,comparisonGifCapabilities} from '../src/ui/comparison-gif.js';
const camera={position:[5,2,0],target:[0,0,0],up:[0,1,0],fov:40};
function fixture(){let reads=0;const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(){},getImageData(){reads++;return {data:new Uint8ClampedArray(640*320*4)};}})};return {canvas,get reads(){return reads;},env:{createCanvas:()=>canvas,yieldControl:async()=>{}}};}
test('GIF renders 24 deterministic orbit phases at fixed resolution without mutating camera',async()=>{
 const f=fixture(),before=structuredClone(camera),phases=[],positions=[],progress=[];const blob=await renderComparisonGif({camera,seconds:2,renderFrame:(next,{phase})=>{phases.push(phase);positions.push(next.position);return {width:1280,height:640};},onProgress:p=>progress.push(p.fraction)},f.env);
 assert.equal(blob.type,'image/gif');assert.equal(phases.length,24);assert.equal(phases[0],0);assert.equal(phases[23],23/24);assert.notDeepEqual(positions[0],positions[23]);assert.equal(progress.at(-1),1);assert.equal(f.reads,24);assert.deepEqual(camera,before);assert.equal(f.canvas.width,0);assert.equal(f.canvas.height,0);assert.ok(blob.size<32*1024*1024);
});
test('cancel/source guard during encoding yields discard output and free scratch canvas',async()=>{
 for(const mode of ['cancel','source']){const f=fixture(),controller=new AbortController();let checks=0,yields=0;f.env.yieldControl=async()=>{if(++yields===3&&mode==='cancel')controller.abort();};
 await assert.rejects(renderComparisonGif({camera,seconds:1,signal:controller.signal,assertCurrent:()=>{if(++checks===8&&mode==='source')throw Error('source changed');},renderFrame:()=>({width:1280,height:640})},f.env),/cancelled|source changed/);assert.equal(f.canvas.width,0);assert.equal(f.reads,1);}
});

test('GIF capability requires a usable 2D canvas and catches disabled contexts',()=>{assert.equal(comparisonGifCapabilities().supported,false);assert.equal(comparisonGifCapabilities({createCanvas:()=>({getContext:()=>null})}).supported,false);assert.equal(comparisonGifCapabilities({createCanvas:()=>{throw Error('blocked');}}).supported,false);assert.equal(comparisonGifCapabilities({createCanvas:()=>({getContext:()=>({})})}).supported,true);});

for(const animation of ['time','deformation'])test(`GIF ${animation} includes endpoints with a fixed camera and no input mutation`,async()=>{
 const f=fixture(),before=structuredClone(camera),phases=[];
 const blob=await renderComparisonGif({camera,animation,seconds:1,renderFrame:(next,frame)=>{assert.deepEqual(next,before);assert.equal(frame.animation,animation);phases.push(frame.phase);next.position[0]=999;return {width:1280,height:640};}},f.env);
 assert.equal(blob.type,'image/gif');assert.deepEqual(camera,before);assert.equal(phases.length,24);assert.equal(phases[0],0);assert.equal(phases.at(-1),1);assert.equal(phases[1],1/23);assert.equal(f.canvas.width,0);
});
