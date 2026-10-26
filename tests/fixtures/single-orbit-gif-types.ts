import {encodeSingleOrbitGif,singleOrbitGifCapabilities,getSingleOrbitGifVerification,singleOrbitGifManifest,type OrbitGifCamera} from '../../src/ui/single-orbit-gif.js';
const camera:OrbitGifCamera={position:[1,2,3],target:[0,0,0],up:[0,1,0],fov:40},canvas=document.createElement('canvas');const result:Promise<Blob>=encodeSingleOrbitGif({camera,field:'temperature',seconds:2,renderFrame:(c,step)=>{const angle:number=step.angleRadians;void c;void angle;return canvas;}});
// @ts-expect-error The orbit-only encoder never accepts stored-time animation
encodeSingleOrbitGif({camera,field:'temperature',animation:'time',seconds:1,renderFrame:()=>canvas});
const orbit:'orbit'=singleOrbitGifCapabilities().animations[0];void result.then(async b=>{const copy=getSingleOrbitGifVerification(b);const m=await singleOrbitGifManifest(b,new Uint8Array(),{seconds:2,field:'temperature',resultRevision:'sha256:'+'a'.repeat(64)});const frames:24=m.time.frameCount;void copy;void frames;});void orbit;
