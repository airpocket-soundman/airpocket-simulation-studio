import{encodeSingleDeformationGif,createSingleDeformationGifPlan,singleDeformationGifCapabilities,singleDeformationGifManifest,type DeformationGifOutput}from'../../src/ui/single-deformation-gif.js';
const output:DeformationGifOutput={mesh:{nodes:[0,0,0]},result:{kind:'elastic',displacement:[0,.1,0],magnitudes:[.1]}},camera={position:[0,0,10],target:[0,0,0],up:[0,1,0],fov:40};const p:Promise<Blob>=encodeSingleDeformationGif({output,camera,field:'displacement',seconds:2,peakScale:20,renderFrame:step=>{const s:number=step.deformScale;void s;return document.createElement('canvas');}});const cap:65536=singleDeformationGifCapabilities().maxNodes;
// @ts-expect-error Stress field is outside this displacement-only GIF.
createSingleDeformationGifPlan(output,2,'stress',20);
void p.then(async b=>{const m=await singleDeformationGifManifest(b,new Uint8Array(),{resultRevision:'sha256:'+'a'.repeat(64),field:'displacement',seconds:2,peakScale:20});const visualization:true=m.time.visualizationOnly;void visualization;});void cap;
// @ts-expect-error Static output cannot carry a defined modal displacement alias.
const staticAlias:DeformationGifOutput={mesh:{nodes:[0,0,0]},result:{kind:'elastic',displacement:[0,.1,0],magnitudes:[.1],modes:[]}};void staticAlias;
