import{encodeSingleStoredTimeGif,createSingleStoredTimeGifPlan,singleStoredTimeGifCapabilities,singleStoredTimeGifManifest,getSingleStoredTimeGifVerification,type StoredTimeGifOutput}from'../../src/ui/single-stored-time-gif.js';
const output:StoredTimeGifOutput={mesh:{nodes:[0,0,0]},result:{kind:'thermal',transient:true,snapshots:[{time:0,temperature:[20]},{time:1,temperature:[30]}]}},camera={position:[1,2,3],target:[0,0,0],up:[0,1,0],fov:40};const plan=createSingleStoredTimeGifPlan(output,2,'temperature'),cap:61=singleStoredTimeGifCapabilities().maxStoredFrames;
const p:Promise<Blob>=encodeSingleStoredTimeGif({output,field:'temperature',camera,seconds:2,renderFrame:frame=>{const time:number=frame.actualTimeSeconds;void time;return document.createElement('canvas');}});
// @ts-expect-error Heat flux has no stored scalar time export.
createSingleStoredTimeGifPlan(output,2,'heatFlux');
void p.then(async b=>{const proof=getSingleStoredTimeGifVerification(b),m=await singleStoredTimeGifManifest(b,new Uint8Array(),{resultRevision:'sha256:'+'a'.repeat(64),seconds:2,field:'temperature',camera});const n:24=m.time.frameCount;void proof;void n;});void plan;void cap;
