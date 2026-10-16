import {framesOf} from './result-frames.js';
import {getProjectRevision} from './project-operations.js';
import {getPhysicalRevision} from './project-revision.js';
import {sampleDisplayedResult} from './probe.js';

const fieldsByKind={elastic:['displacement','stress'],modal:['displacement'],thermal:['temperature','heatFlux'],acousticTransient:['instantPressure'],acoustic:['pressure','spl','phase'],channelFlow:['speed','fluidPressure'],stokes:['speed','fluidPressure']};
const units={displacement:'mm',stress:'MPa',plasticStrain:'%',temperature:'degC',heatFlux:'W/m2',instantPressure:'Pa',pressure:'Pa peak',spl:'dB RMS',phase:'rad',speed:'m/s',fluidPressure:'Pa gauge'};
export function resultFields(result){const fields=[...(fieldsByKind[result?.kind]||[])];if(result?.kind==='elastic'&&result.plasticity)fields.push('plasticStrain');return fields.map(id=>({id,unit:units[id]}));}
export function displayRange(minimum,maximum,range,field){if(range&&range.field===field)return {min:range.minimum,max:range.maximum,mode:'fixed'};return {min:minimum,max:maximum,mode:'auto'};}
export function colorFraction(value,minimum,maximum){return maximum>minimum?Math.max(0,Math.min(1,(value-minimum)/(maximum-minimum))):0;}
// The single result colormap (HSL, blue at the minimum to red at the maximum), shared by the 3D view and legends.
export function colormapHsl(fraction){return [(1-fraction)*.65,.8,.5];}
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
function cameraSettings(value){
 if(!value||Object.keys(value).some(k=>!['position','target','up','fov'].includes(k))||!vector(value.position)||!vector(value.target)||!vector(value.up)||!Number.isFinite(value.fov)||value.fov<=0||value.fov>=180)throw Error('Invalid camera settings');
 const direction=value.target.map((v,i)=>v-value.position[i]),length=Math.hypot(...direction),up=Math.hypot(...value.up),cross=[direction[1]*value.up[2]-direction[2]*value.up[1],direction[2]*value.up[0]-direction[0]*value.up[2],direction[0]*value.up[1]-direction[1]*value.up[0]];
 if(![...direction,length,up,...cross,Math.hypot(...cross)].every(Number.isFinite)||length<=1e-9||up<=1e-9||Math.hypot(...cross)<=length*up*1e-9)throw Error('Camera direction and up vector are degenerate');return value;
}
// The live three.js/OrbitControls camera re-derives position through spherical coordinates on every update,
// so numbers drift by one ULP (e.g. 90 -> 89.99999999999999). Reads are canonicalized to 12 significant
// digits (idempotent) with a fixed key order so save -> apply -> read is exactly stable.
const canonicalNumber=v=>typeof v==='number'&&Number.isFinite(v)?Number(v.toPrecision(12))+0:v;
const canonicalVector=v=>Array.isArray(v)?v.map(canonicalNumber):v;
export function canonicalViewState(s){
 if(s?.camera&&typeof s.camera==='object'){const c=s.camera;s.camera={position:canonicalVector(c.position),target:canonicalVector(c.target),up:canonicalVector(c.up),fov:canonicalNumber(c.fov)};}
 if(s?.colorRange&&typeof s.colorRange==='object'&&!Array.isArray(s.colorRange)){const r=s.colorRange;s.colorRange={field:r.field,minimum:r.minimum,maximum:r.maximum};}
 return s;
}
export function validateResultViewSettings(settings,result){
 const fields=resultFields(result).map(f=>f.id);if(!fields.includes(settings.field))throw Error('Field is unavailable for this result');
 if(!Number.isFinite(settings.deformScale)||settings.deformScale<0)throw Error('Deformation scale must be finite and nonnegative');
 for(const key of ['surface','surfaceWire','volumeWire','section'])if(typeof settings[key]!=='boolean')throw Error('Invalid result layer setting');
 if(result.kind==='modal'){if(!Number.isInteger(settings.modeIndex)||!result.modes?.[settings.modeIndex])throw Error('Invalid stored mode index');}else if(settings.modeIndex!==null)throw Error('This result has no stored modes');
 if(result.kind==='acousticTransient'){if(!Number.isInteger(settings.frameIndex)||!result.snapshots?.[settings.frameIndex])throw Error('Invalid stored acoustic frame index');}else if(result.kind==='thermal'&&settings.frameIndex!==null){const frames=framesOf(result);if(!frames||!Number.isInteger(settings.frameIndex)||settings.frameIndex<0||settings.frameIndex>=frames.times.length)throw Error('Invalid stored thermal frame index');}else if(settings.frameIndex!==null)throw Error('This result has no stored time frames');
 if(settings.colorRange!==null){const r=settings.colorRange;if(!r||Object.keys(r).some(k=>!['field','minimum','maximum'].includes(k))||r.field!==settings.field||!Number.isFinite(r.minimum)||!Number.isFinite(r.maximum)||r.minimum>=r.maximum)throw Error('Invalid fixed color range or field unit mismatch');}
 cameraSettings(settings.camera);return settings;
}

// The result revision identifies archived calculation data, not a screen index.
// Settings never modify physical arrays, normalized modes or saved time frames.
export function createResultViewApi(adapter){
 async function current(){const output=adapter.getAnalysis();if(!output?.result||!resultFields(output.result).length)throw Error('No supported displayed result');const serialized=JSON.stringify(output),parsed=JSON.parse(serialized),revision=await getProjectRevision(parsed),physicalRevision=await getPhysicalRevision(parsed);if(adapter.getAnalysis()!==output||JSON.stringify(output)!==serialized)throw Error('Displayed result changed during inspection');return {output,serialized,revision,physicalRevision};}
 const unchanged=({output,serialized})=>adapter.getAnalysis()===output&&JSON.stringify(output)===serialized;
 function read(output){const s=canonicalViewState(structuredClone(adapter.get()));return validateResultViewSettings({...s,modeIndex:output.result.kind==='modal'?s.modeIndex:null,frameIndex:output.result.kind==='acousticTransient'?s.frameIndex:null},output.result);}
 // Thermal state.frameIndex remains null for legacy named-view consumers; physical-time metadata describes the actual display.
 const frameDisplay=()=>adapter.frameDisplay?.()||{};
 function thermalTime(output){if(output.result.kind!=='thermal')return {};const d=frameDisplay(),frames=framesOf(output.result),index=frames&&!d.interpolated?frames.times.indexOf(d.frameTime):-1;return d.frameTime===undefined?{}:{physicalTimeSeconds:d.frameTime,interpolated:!!d.interpolated,timeSelection:index>=0?'stored-frames-only':'viewer-slider-only',...(index>=0?{storedFrameIndex:index}:{})};}
 function summary(context,state){const r=context.output.result;return {schemaVersion:1,resultRevision:context.revision,physicalRevision:context.physicalRevision,kind:r.kind,fields:resultFields(r),state,modeCount:r.modes?.length||0,frameCount:r.snapshots?.length||0,...(r.kind==='modal'?{modeInterpretation:'normalized-shape-not-dynamic-response'}:{}),...(r.kind==='acousticTransient'?{physicalTimeSeconds:r.snapshots[state.frameIndex].time,timeSelection:'stored-frames-only'}:{}),...thermalTime(context.output),...(r.analysisAssessment||context.output.analysisAssessment?{analysisAssessment:structuredClone(r.analysisAssessment||context.output.analysisAssessment)}:{})};}
 return Object.freeze({
  async probe({expectedResultRevision,point,options={}}={}){
   const c=await current();if(expectedResultRevision!==undefined&&expectedResultRevision!==c.revision)throw Error('Displayed result revision conflict');const state=read(c.output),r=c.output.result;
   return {schemaVersion:1,resultRevision:c.revision,kind:r.kind,display:{field:state.field,modeIndex:state.modeIndex,frameIndex:state.frameIndex,...(r.kind==='acousticTransient'?{physicalTimeSeconds:r.snapshots[state.frameIndex].time}:{}),...thermalTime(c.output)},...sampleDisplayedResult(c.output.mesh,r,point,options,{modeIndex:state.modeIndex,frameIndex:state.frameIndex,...frameDisplay()}),...(r.kind==='modal'?{modeInterpretation:'normalized-shape-not-dynamic-response'}:{}),...(r.analysisAssessment||c.output.analysisAssessment?{analysisAssessment:structuredClone(r.analysisAssessment||c.output.analysisAssessment)}:{})};
  },
  async get({frameOffset=0,frameLimit=20,modeOffset=0,modeLimit=20}={}){
   for(const [offset,limit]of [[frameOffset,frameLimit],[modeOffset,modeLimit]])if(!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<0||limit>50)throw Error('Invalid result metadata page');
   const c=await current(),r=c.output.result,state=read(c.output),out=summary(c,state);
   return {...out,frames:(r.snapshots||[]).slice(frameOffset,frameOffset+frameLimit).map((f,i)=>({index:frameOffset+i,timeSeconds:f.time})),modes:(r.modes||[]).slice(modeOffset,modeOffset+modeLimit).map((m,i)=>({index:modeOffset+i,frequencyHz:m.frequencyHz,residual:m.residual}))};
  },
  async set({expectedResultRevision,settings}={},{guard=()=>true}={}){
   if(adapter.isBusy?.())throw Error('Viewer is busy');
   if(typeof expectedResultRevision!=='string'||!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(k=>!['field','modeIndex','frameIndex','timeSeconds','deformScale','surface','surfaceWire','volumeWire','section','camera','colorRange'].includes(k)))throw Error('Invalid result view command');
   const patch=structuredClone(settings),c=await current();if(c.revision!==expectedResultRevision)throw Error('Displayed result revision conflict');
   const previous=read(c.output),next={...previous,...patch};delete next.timeSeconds;
   if(patch.camera)next.camera={...previous.camera,...patch.camera};
   if(patch.field!==undefined&&patch.field!==previous.field&&!Object.hasOwn(patch,'colorRange'))next.colorRange=null;
   const result=c.output.result,thermal=result.kind==='thermal',frames=thermal?framesOf(result):null;
   const timeChanged=patch.timeSeconds!==undefined||patch.frameIndex!==undefined&&patch.frameIndex!==null;
   if(patch.timeSeconds!==undefined){
    if(patch.frameIndex!==undefined||!Number.isFinite(patch.timeSeconds)||!['acousticTransient','thermal'].includes(result.kind)||thermal&&!frames)throw Error('Specify one stored acoustic or thermal time or frame index');
    const index=result.snapshots.findIndex(f=>thermal?f.time===patch.timeSeconds:Math.abs(f.time-patch.timeSeconds)<=Math.max(1e-12,Math.abs(f.time)*1e-10));
    if(index<0)throw Error('No stored frame at requested physical time');next.frameIndex=index;
   }
   if(thermal&&timeChanged){
    const frame=result.snapshots?.[next.frameIndex],n=c.output.mesh?.nodes?.length/3;
    if(!frames||!Number.isInteger(next.frameIndex)||next.frameIndex<0||!frame)throw Error('Invalid stored thermal frame index');
    if(!Number.isFinite(frame.time)||frame.time<0||!Array.isArray(frame.temperature)||frame.temperature.length!==n||!frame.temperature.every(Number.isFinite))throw Error('Invalid stored thermal temperature frame');
   }
   if(thermal&&next.field==='heatFlux'&&frames){
    const display=frameDisplay(),final=timeChanged?next.frameIndex===frames.times.length-1:!display.interpolated&&(display.frameTime===undefined||display.frameTime===frames.times.at(-1));
    if(!final)throw Error('Heat flux is available only at the final thermal time');
   }
   validateResultViewSettings(next,c.output.result);
   if(!unchanged(c)||adapter.isBusy?.()||!guard())throw Error('Displayed result changed, viewer busy or command expired');
   const savedTime=adapter.getTimeView?.();
   try{adapter.set(structuredClone(next),{timeChanged});}catch(error){const errors=[error];try{adapter.set(previous,{timeChanged:false});}catch(rollback){errors.push(rollback);}try{if(savedTime!==undefined)adapter.restoreTimeView?.(savedTime);}catch(rollback){errors.push(rollback);}if(errors.length>1)throw new AggregateError(errors,'Viewer update and restoration failed');throw error;}
   return summary(c,read(c.output));
  }
 });
}
