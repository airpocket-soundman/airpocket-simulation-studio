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
import {singleThermalTimeWebmCapabilities,createSingleViewThermalTimePlan,encodeSingleViewThermalTimeWebm,getSingleViewThermalTimeVerification,singleViewThermalTimeManifest,type ThermalTimeOutput} from '../../src/single-view-time-webm.js';
const thermal:ThermalTimeOutput={mesh:{nodes:[0,0,0]},result:{kind:'thermal',transient:true,snapshots:[{time:0,temperature:[20]},{time:1,temperature:[30]}]}};
const thermalPlan=createSingleViewThermalTimePlan(thermal,1,'temperature');const thermalKind:'thermal'=singleThermalTimeWebmCapabilities().resultKinds[0];
// @ts-expect-error heat flux has no saved history
createSingleViewThermalTimePlan(thermal,1,'heatFlux');
void encodeSingleViewThermalTimeWebm({output:thermal,field:'temperature',seconds:1,initialCanvas:canvas,renderFrame:()=>canvas}).then(async b=>{const proof=getSingleViewThermalTimeVerification(b);const manifest=await singleViewThermalTimeManifest(b,new Uint8Array(),{seconds:1,resultRevision:'sha256:'+'a'.repeat(64)});const field:'temperature'=manifest.time.field;void proof;void field;});void thermalPlan;void thermalKind;
