import {createSingleViewAcousticTimePlan,encodeSingleViewAcousticTimeWebm,singleViewTimeWebmCapabilities,singleViewAcousticTimeManifest,getSingleViewAcousticTimeVerification,type AcousticTimeOutput} from '../../src/single-view-time-webm.js';
const output:AcousticTimeOutput={result:{kind:'acousticTransient',snapshots:[{time:0},{time:1}]}};
const plan=createSingleViewAcousticTimePlan(output,1);const time:number=plan.frames[0].actualTimeSeconds;
// @ts-expect-error issued plans are immutable snapshots
plan.frames[0].snapshotIndex=1;
// @ts-expect-error thermal time is not supported by this path
createSingleViewAcousticTimePlan({result:{kind:'thermal',snapshots:[{time:0},{time:1}]}},1);
const canvas=document.createElement('canvas');const promise:Promise<Blob>=encodeSingleViewAcousticTimeWebm({output,seconds:1,initialCanvas:canvas,renderFrame:step=>{const offset:number=step.offsetSeconds;return canvas;}});
const capability=singleViewTimeWebmCapabilities();const kind:'acousticTransient'=capability.resultKinds[0];
void promise.then(async blob=>{const p=getSingleViewAcousticTimeVerification(blob);const m=await singleViewAcousticTimeManifest(blob,new Uint8Array(),{seconds:1,resultRevision:'sha256:'+'a'.repeat(64)});const guaranteed:true=m.time.frameCountGuaranteed;void p;void guaranteed;});
void time;void kind;
