import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSingleViewAcousticTimePlan,encodeSingleViewAcousticTimeWebm,singleViewAcousticTimeManifest,getSingleViewAcousticTimeVerification} from '../src/single-view-time-webm.js';
import {demuxFixedWebm,muxFixedWebm} from '../src/fixed-webm.js';
import {fixedCodecEnv} from './helpers/single-view-fixed-codec.mjs';
const revision='sha256:'+'c'.repeat(64),canvas={width:4,height:4},times=[.125,.126,.5,.901,1.7];
const args=()=>({output:{result:{kind:'acousticTransient',snapshots:times.map(time=>({time}))}},seconds:1,resultRevision:revision,initialCanvas:canvas,renderFrame:()=>canvas});
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');

test('independent nonzero/nonuniform physical axis and integer presentation oracle cover every supported duration',()=>{
 const input=args().output,before=structuredClone(input);
 for(let seconds=1;seconds<=15;seconds++){
  const p=createSingleViewAcousticTimePlan(input,seconds),n=Math.min(seconds*24,120),total=BigInt(seconds)*1000000n,round=k=>Number((BigInt(k)*total*2n+BigInt(n))/(2n*BigInt(n)));
  assert.equal(p.frames.length,n);
  for(let i=0;i<n;i++){
   const f=p.frames[i],target=i===n-1?times.at(-1):times[0]+(times.at(-1)-times[0])*i/(n-1);
   let expected=0;for(let j=1;j<times.length;j++)if(Math.abs(times[j]-target)<Math.abs(times[expected]-target))expected=j;
   assert.equal(f.snapshotIndex,expected);assert.ok(Math.abs(f.requestedTimeSeconds-target)<1e-14);assert.equal(f.actualTimeSeconds,times[expected]);assert.equal(f.offsetSeconds,f.actualTimeSeconds-f.requestedTimeSeconds);assert.equal(f.timestamp,round(i));assert.equal(f.duration,round(i+1)-round(i));
  }
  assert.equal(p.frames[0].actualTimeSeconds,times[0]);assert.equal(p.frames.at(-1).actualTimeSeconds,times.at(-1));assert.equal(p.frames.at(-1).offsetSeconds,0);
 }
 assert.deepEqual(input,before);
});

test('independent same-schedule payload substitution cannot borrow decoded proof, including detached proof and iterator forgery',async()=>{
 const blob=await encodeSingleViewAcousticTimeWebm(args(),fixedCodecEnv().env),bytes=new Uint8Array(await Blob.prototype.arrayBuffer.call(blob)),parsed=demuxFixedWebm(bytes);
 parsed.packets.at(-1).data[0]^=1;const changed=muxFixedWebm(parsed);assert.notEqual(sha(changed),sha(bytes));
 for(const value of [changed,new Uint8Array(changed)]){Object.defineProperty(value,Symbol.iterator,{value:()=>bytes[Symbol.iterator]()});await assert.rejects(singleViewAcousticTimeManifest(blob,value,{seconds:1,resultRevision:revision}),{code:'WEBM_ENDPOINT_UNVERIFIED'});}
 const detached=getSingleViewAcousticTimeVerification(blob);detached.byteSha256=sha(changed);detached.frames.at(-1).actualTimeSeconds=99;
 await assert.rejects(singleViewAcousticTimeManifest(new Blob([bytes],{type:blob.type}),bytes,{seconds:1,resultRevision:revision}),{code:'WEBM_ENDPOINT_UNVERIFIED'});
 const manifest=await singleViewAcousticTimeManifest(blob,bytes,{seconds:1,resultRevision:revision});assert.equal(manifest.sha256,sha(bytes));assert.equal(manifest.time.frameTimings.at(-1).actualTimeSeconds,times.at(-1));
});

test('aborting a pending codec probe never issues proof or invokes render, and late probe settlement stays harmless',async()=>{
 const h=fixedCodecEnv(),controller=new AbortController();let complete,renders=0;
 h.env.VideoEncoder.isConfigSupported=()=>new Promise(resolve=>complete=resolve);
 const pending=encodeSingleViewAcousticTimeWebm({...args(),signal:controller.signal,renderFrame:()=>{renders++;return canvas;}},h.env),rejected=assert.rejects(pending,{code:'WEBM_FIXED_CANCELLED'});
 await Promise.resolve();controller.abort();await rejected;complete({supported:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(renders,0);assert.equal(h.stats.codecClosed,0);assert.equal(h.stats.inputClosed,0);
});
