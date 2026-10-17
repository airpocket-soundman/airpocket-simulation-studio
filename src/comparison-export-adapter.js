import {getProjectRevision} from './project-revision.js';
import {createComparisonTimePlan} from './comparison-time-plan.js';
import {createComparisonDeformationPlan} from './comparison-deformation-plan.js';

function camera(value){
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!value||Object.keys(value).some(k=>!['position','target','up','fov'].includes(k))||!['position','target','up'].every(k=>vector(value[k]))||!Number.isFinite(value.fov)||value.fov<=0||value.fov>=180)throw Error('Invalid comparison camera');
 const d=value.target.map((v,i)=>v-value.position[i]),u=value.up,c=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]],a=Math.hypot(...d),b=Math.hypot(...u),cross=Math.hypot(...c);
 if(![a,b,cross,a*b].every(Number.isFinite)||a<=1e-9||b<=1e-9||cross<=a*b*1e-9)throw Error('Degenerate comparison camera');
 return value;
}

// Private source leases/canvas never cross the session boundary. Rendering is synchronous;
// encoding may yield, so leases and the command guard are checked again before delivery.
export function createComparisonExportAdapter({cases,getDefaults,isBusy=()=>false,renderComparison,encodePng,recordVideo,acquireHostLock}){
 const available=()=>{if(isBusy())throw Error('Viewer is busy');};
 return {
  async prepare(request,{guard=()=>true}={}){
   const check=()=>{if(!guard())throw Error('Comparison export expired');available();};check();
   const defaults=structuredClone(getDefaults()),view={...defaults,camera:camera(structuredClone(request.camera??defaults.camera)),deformScale:request.deformScale??defaults.deformScale};
   if(!Number.isFinite(view.deformScale)||view.deformScale<0)throw Error('Invalid comparison deformation scale');
   const sources=[];
   for(const reference of request.references){sources.push(await cases.readSource(reference,{guard}));check();}
   const timeMode=request.format==='webm'&&request.animation==='time';
   if(timeMode&&request.timeSeconds!==undefined)throw Error('Comparison time video uses startTimeSeconds/endTimeSeconds, not a fixed timeSeconds');
   const timePlan=timeMode?createComparisonTimePlan(sources.map(s=>s.output),request):null;
   const deformationMode=request.format==='webm'&&request.animation==='deformation';
   if(deformationMode&&!Object.hasOwn(request,'deformScale'))throw Error('Deformation comparison requires an explicit positive deformScale');
   const deformationPlan=deformationMode?createComparisonDeformationPlan(sources.map(s=>s.output),request):null;
   if(request.field==='heatFlux'&&request.timeSeconds!==undefined&&sources.some(source=>source.output.result.kind==='thermal'))throw Error('Thermal heat flux comparison is final-step only; omit timeSeconds');
   const revisions=[];for(const source of sources)revisions.push(await getProjectRevision(source.output));
   const assertSources=()=>{if(!guard())throw Error('Comparison export expired');for(const source of sources)source.assertCurrent();};
   const assertCurrent=()=>{check();assertSources();};assertCurrent();
   if(JSON.stringify(getDefaults())!==JSON.stringify(defaults))throw Error('Viewer changed while preparing comparison');
   const renderAt=(nextCamera,timeSeconds,colorRange,deformScale=view.deformScale)=>renderComparison({cases:sources.map(source=>({caseId:source.caseId,label:source.name,source:source.output})),field:request.field,camera:nextCamera,deformScale,timeSeconds,toleranceSeconds:request.toleranceSeconds,colorRange,visualDeformation:deformationMode});
   const rendered=renderAt(view.camera,timePlan?timePlan.atPhase(0).timeSeconds:request.timeSeconds,timePlan?.colorRange,deformationPlan?0:view.deformScale);
   if(request.format==='webm')view.resolution={width:rendered.canvas.width,height:rendered.canvas.height};
   assertCurrent();
   const comparison={cases:sources.map((source,i)=>({caseId:source.caseId,revision:source.revision,resultRevision:revisions[i],label:source.name})),field:request.field,...(request.timeSeconds===undefined?{}:{requestedTimeSeconds:request.timeSeconds}),panels:rendered.panels,colorRange:rendered.colorRange,unit:rendered.unit,...(timePlan?{timeAnimation:timePlan.summary}:{}),...(deformationPlan?{deformationAnimation:deformationPlan.summary}:{})};
   const renderFrame=(nextCamera,{phase=0}={})=>{assertSources();const frame=renderAt(timeMode||deformationMode?view.camera:nextCamera,timePlan?timePlan.atPhase(phase).timeSeconds:request.timeSeconds,rendered.colorRange,deformationPlan?deformationPlan.atPhase(phase).deformScale:view.deformScale);assertSources();return frame.canvas;};
   return {view,comparison,context:{canvas:rendered.canvas,assertCurrent,assertSources,renderFrame}};
  },
  async render({context,format='png',animation='orbit',view,seconds,signal,onProgress=()=>{}}){
   const check=()=>{if(signal?.aborted)throw Error('Comparison export cancelled');context.assertCurrent();};check();onProgress({fraction:0});
   if(format==='webm'){
    if(typeof recordVideo!=='function'||typeof acquireHostLock!=='function')throw Error('Comparison WebM is unavailable');
    const lock=acquireHostLock(),active=()=>{if(signal?.aborted)throw Error('Comparison export cancelled');lock.assertOwned();context.assertSources();};
    try{active();const blob=await recordVideo({initialCanvas:context.canvas,renderFrame:(next,frame)=>{active();const canvas=context.renderFrame(next,frame);active();return canvas;},camera:view.camera,animation,seconds,signal,onProgress});active();return blob;}finally{lock.release();}
   }
   const blob=await encodePng(context.canvas);check();onProgress({fraction:1});return blob;
  }
 };
}
