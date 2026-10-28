import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {encodeSingleOrbitGif as encode,getSingleOrbitGifVerification as proof,singleOrbitGifManifest as manifest,singleOrbitGifCapabilities} from '../src/ui/single-orbit-gif.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';import {orbitGifEnv} from './helpers/orbit-gif-env.mjs';import {decodeGif} from './helpers/gif-decode.mjs';
const revision='sha256:'+'a'.repeat(64),camera={position:[0,0,10],target:[0,0,0],up:[0,1,0],fov:40},sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const args=()=>({camera,field:'temperature',resultRevision:revision,viewTimeSeconds:2,viewerFrameIndex:0,interpolated:true,timeApplies:true,seconds:2,renderFrame:(_c,f)=>({width:100,height:200,color:[Math.round(f.index*255/23),0,255-Math.round(f.index*255/23)]})});

test('independent GIF/LZW decode binds complete orbit24, integer delays, palette and aspect-preserving letterbox pixels',async()=>{
 const h=orbitGifEnv(),positions=[],blob=await encode({...args(),renderFrame:(c,f)=>{positions.push(c.position);return args().renderFrame(c,f);}},h.env),bytes=new Uint8Array(await blob.arrayBuffer()),decoded=decodeGif(bytes),m=await manifest(blob,bytes,{resultRevision:revision,field:'temperature',seconds:2,camera,timeSeconds:2});
 assert.equal(decoded.frames.length,24);assert.equal(decoded.width,640);assert.equal(decoded.height,320);assert.equal(decoded.loop,0);assert.equal(decoded.frames.reduce((n,f)=>n+f.delay,0),200);assert.deepEqual(decoded.frames.map(f=>f.delay),Array.from({length:24},(_,i)=>Math.round((i+1)*200/24)-Math.round(i*200/24)));assert.equal(decoded.palette.length,768);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;assert.ok(Math.abs(positions[i][0]-10*Math.sin(a))<1e-9);assert.ok(Math.abs(positions[i][2]-10*Math.cos(a))<1e-9);assert.equal(m.time.frames[i].phase,i/24);assert.deepEqual(m.time.frames[i].letterbox,{x:240,y:0,width:160,height:320});}
 assert.equal(decoded.frames[0].pixels[160*640+320],3);assert.equal(decoded.frames.at(-1).pixels[160*640+320],224);assert.equal(decoded.frames[0].pixels[0],5);assert.equal(m.sha256,sha(bytes));assert.equal(m.time.selectedPhysicalTimeSeconds,2);assert.equal(m.time.interpolated,true);assert.equal(m.time.timeSelectionBasis,'viewer-interpolated');assert.equal(m.time.selectedStoredFrameIndex,undefined);assert.equal(m.time.frameCountGuaranteed,true);assert.equal(h.stats.canvases[0].width,0);
});

test('private proof refuses cloned/comparison-like/modified bytes, wrong prepared field, time, camera and duration',async()=>{
 const h=orbitGifEnv(),blob=await encode(args(),h.env),bytes=new Uint8Array(await blob.arrayBuffer()),options={resultRevision:revision,field:'temperature',seconds:2,timeSeconds:2};const copy=proof(blob);copy.field='stress';copy.frames[0].index=99;
 for(const changed of [{...options,field:'stress'},{...options,timeSeconds:5},{...options,seconds:3},{...options,resultRevision:'sha256:'+'b'.repeat(64)},{...options,camera:{...camera,position:[0,0,20]}}])await assert.rejects(manifest(blob,bytes,changed),{code:'GIF_ORBIT_INVALID'});
 await assert.rejects(manifest(new Blob([bytes],{type:'image/gif'}),bytes,options),{code:'GIF_ORBIT_INVALID'});const changed=new Uint8Array(bytes);changed[13]^=1;await assert.rejects(manifest(blob,changed,options),{code:'GIF_ORBIT_INVALID'});
 const snapshot=new Uint8Array(bytes),pending=manifest(blob,snapshot,options);snapshot.fill(0);assert.equal((await pending).sha256,sha(bytes));
 let reads=0;const huge={get length(){reads++;return 2**40;}};await assert.rejects(manifest(blob,huge,options),/Ordinary/);const small=new Uint8Array(1);Object.defineProperty(small,'byteLength',{get(){reads++;return bytes.length;}});await assert.rejects(manifest(blob,small,options),/byte count/);Object.defineProperty(bytes,'buffer',{get(){reads++;throw Error('getter');}});Object.defineProperty(bytes,'byteLength',{get(){reads++;throw Error('getter');}});assert.equal((await manifest(blob,bytes,options)).sha256,proof(blob).sha256);assert.equal(reads,0);
});

test('only bounded plain camera/orbit/source dimensions are admitted without invoking camera getters',async()=>{
 const h=orbitGifEnv();for(const animation of ['time','deformation','slice'])await assert.rejects(encode({...args(),animation},h.env),/orbit only/);for(const c of [{...camera,extra:0},{...camera,position:Array(10000).fill(1)},{...camera,position:[NaN,0,0]},{...camera,fov:180}])await assert.rejects(encode({...args(),camera:c},h.env));
 let touched=0;const c={...camera};Object.defineProperty(c,'position',{enumerable:true,get(){touched++;return [0,0,1];}});await assert.rejects(encode({...args(),camera:c},h.env));assert.equal(touched,0);
 let i=0;await assert.rejects(encode({...args(),renderFrame:()=>({width:++i===1?100:101,height:200})},h.env),/dimensions changed/);assert.equal(singleOrbitGifCapabilities(h.env).supported,true);
});

test('byte budget and cooperative cancellation refuse partial output; pending yield retains job exclusion until it settles',async()=>{
 const h=orbitGifEnv();await assert.rejects(encode(args(),{...h.env,maxBytes:810}),/budget/);let resume,paused=false;const api=createVisualExportJobs({render:r=>encode({...args(),signal:r.signal},{...h.env,yieldControl:()=>{paused=true;return new Promise(resolve=>resume=resolve);}})}),j=await api.start({requestId:'cancel',expectedResultRevision:revision,format:'gif',animation:'orbit',seconds:2,view:{result:{field:'temperature',timeSeconds:2,camera}}});assert.equal(paused,true);api.cancel(j);assert.equal(api.status(j).state,'cancelled');assert.equal(api.status(j).executionSettled,false);await assert.rejects(api.start({requestId:'second',expectedResultRevision:revision,format:'gif',seconds:2}),/already active/);assert.throws(()=>api.artifact(j),/unavailable/);resume();await api.waitForSettled(j);assert.equal(api.status(j).executionSettled,true);api.release(j);assert.throws(()=>api.status(j),/Unknown visual export job|Unknown visual export/);
});

test('job metadata requires exact issued GIF, records fixed physical selection and rejects incompatible GIF requests',async()=>{
 const h=orbitGifEnv(),api=createVisualExportJobs({render:()=>encode(args(),h.env)}),request={requestId:'orbit',expectedResultRevision:revision,format:'gif',animation:'orbit',seconds:2,view:{result:{field:'temperature',timeSeconds:2,camera}}},j=await api.start(request);await api.waitForSettled(j);const s=api.status(j);assert.equal(s.state,'completed',s.error);assert.equal(s.artifact.manifest.container,'gif');assert.equal(s.artifact.manifest.time.frameCount,24);assert.equal(s.artifact.manifest.time.selectedPhysicalTimeSeconds,2);assert.deepEqual(s.artifact.manifest.resolution,{width:640,height:320});assert.equal((await api.start(request)).jobId,j.jobId);
 await assert.rejects(api.start({...request,requestId:'frames',frames:24}),/frames is only/);
 const fake=createVisualExportJobs({render:()=>new Blob(['GIF89a'],{type:'image/gif'})}),bad=await fake.start({...request,requestId:'fake'});await fake.waitForSettled(bad);assert.equal(fake.status(bad).state,'failed');assert.throws(()=>fake.artifact(bad),/unavailable/);
});


test('modal proof mode0 cannot be borrowed by mode1 or absent-mode jobs; null and undefined both mean no mode',async()=>{
 const h=orbitGifEnv(),blob=await encode({camera,field:'displacement',modeIndex:0,seconds:1,renderFrame:()=>({width:100,height:100}),resultRevision:revision},h.env),bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(proof(blob).selectedModeIndex,0);
 const options={resultRevision:revision,field:'displacement',seconds:1};await assert.rejects(manifest(blob,bytes,{...options,modeIndex:1}),{code:'GIF_ORBIT_INVALID'});for(const modeIndex of [null,undefined])await assert.rejects(manifest(blob,bytes,{...options,modeIndex}),{code:'GIF_ORBIT_INVALID'});assert.equal((await manifest(blob,bytes,{...options,modeIndex:0})).time.selectedModeIndex,0);
 const api=createVisualExportJobs({render:()=>blob}),j=await api.start({requestId:'cross-mode',expectedResultRevision:revision,format:'gif',seconds:1,view:{result:{field:'displacement',modeIndex:1}}});await api.waitForSettled(j);assert.equal(api.status(j).state,'failed');assert.throws(()=>api.artifact(j),/unavailable/);
 const plain=await encode({...args(),viewTimeSeconds:undefined,viewerFrameIndex:undefined,interpolated:false,timeApplies:false},h.env),b=new Uint8Array(await plain.arrayBuffer());for(const modeIndex of [null,undefined]){const m=await manifest(plain,b,{resultRevision:revision,field:'temperature',seconds:2,modeIndex});assert.equal(m.time.selectedModeIndex,undefined);assert.equal(m.time.selectedPhysicalTimeSeconds,undefined);assert.equal(m.time.selectedStoredFrameIndex,undefined);assert.equal(m.time.timeSelectionBasis,'selected-field-has-no-time-history');}
});
import {PerspectiveCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {canonicalViewState} from '../src/result-view-api.js';

test('real OrbitControls ULP drift uses the public canonical camera for plan, proof and prepared job identity',async()=>{
 const c=new PerspectiveCamera(40,1,.1,1000);c.position.set(61,41,84);
 const root={addEventListener(){},removeEventListener(){}},element={style:{},ownerDocument:root,getRootNode:()=>root,addEventListener(){},removeEventListener(){}};
 const controls=new OrbitControls(c,element);controls.target.set(5,5,20);controls.update();
 const raw={position:c.position.toArray(),target:controls.target.toArray(),up:c.up.toArray(),fov:c.fov};controls.dispose();
 assert.notDeepEqual(raw.position,[61,41,84]);const prepared=canonicalViewState({camera:structuredClone(raw)}).camera;assert.deepEqual(prepared.position,[61,41,84]);
 const h=orbitGifEnv(),rendered=[],blob=await encode({...args(),camera:raw,renderFrame:next=>{rendered.push(next);return {width:640,height:320};}},h.env);
 assert.deepEqual(proof(blob).camera,prepared);assert.deepEqual(rendered[0],prepared);
 const bytes=new Uint8Array(await blob.arrayBuffer()),options={resultRevision:revision,field:'temperature',seconds:2,timeSeconds:2,frameIndex:null,modeIndex:null,camera:prepared};
 assert.equal((await manifest(blob,bytes,options)).time.selectedPhysicalTimeSeconds,2);
 const api=createVisualExportJobs({render:()=>blob}),job=await api.start({requestId:'canonical-main-shape',expectedResultRevision:revision,format:'gif',animation:'orbit',seconds:2,view:{result:{field:'temperature',timeSeconds:2,frameIndex:null,modeIndex:null,camera:prepared}}});
 await api.waitForSettled(job);assert.equal(api.status(job).state,'completed',JSON.stringify(api.status(job).error));
 await assert.rejects(manifest(blob,bytes,{...options,camera:{...prepared,position:[62,41,84]}}),/prepared camera differs/);
 const bad=await api.start({requestId:'different-camera',expectedResultRevision:revision,format:'gif',animation:'orbit',seconds:2,view:{result:{field:'temperature',timeSeconds:2,camera:{...prepared,position:[62,41,84]}}}});await api.waitForSettled(bad);assert.equal(api.status(bad).state,'failed');assert.throws(()=>api.artifact(bad),/unavailable/);
 await assert.rejects(encode({...args(),camera:{...camera,fov:179.99999999999}},h.env),/canonical orbit GIF camera/);
});
