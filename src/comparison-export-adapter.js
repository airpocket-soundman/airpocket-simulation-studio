import {getProjectRevision} from './project-revision.js';

function camera(value){
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!value||Object.keys(value).some(k=>!['position','target','up','fov'].includes(k))||!['position','target','up'].every(k=>vector(value[k]))||!Number.isFinite(value.fov)||value.fov<=0||value.fov>=180)throw Error('Invalid comparison camera');
 const d=value.target.map((v,i)=>v-value.position[i]),u=value.up,c=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]],a=Math.hypot(...d),b=Math.hypot(...u),cross=Math.hypot(...c);
 if(![a,b,cross,a*b].every(Number.isFinite)||a<=1e-9||b<=1e-9||cross<=a*b*1e-9)throw Error('Degenerate comparison camera');
 return value;
}

// Private source leases/canvas never cross the session boundary. Rendering is synchronous;
// encoding may yield, so leases and the command guard are checked again before delivery.
export function createComparisonExportAdapter({cases,getDefaults,isBusy=()=>false,renderComparison,encodePng}){
 const available=()=>{if(isBusy())throw Error('Viewer is busy');};
 return {
  async prepare(request,{guard=()=>true}={}){
   const check=()=>{if(!guard())throw Error('Comparison export expired');available();};check();
   const defaults=structuredClone(getDefaults()),view={...defaults,camera:camera(structuredClone(request.camera??defaults.camera)),deformScale:request.deformScale??defaults.deformScale};
   if(!Number.isFinite(view.deformScale)||view.deformScale<0)throw Error('Invalid comparison deformation scale');
   const sources=[];
   for(const reference of request.references){sources.push(await cases.readSource(reference,{guard}));check();}
   if(request.field==='heatFlux'&&request.timeSeconds!==undefined&&sources.some(source=>source.output.result.kind==='thermal'))throw Error('Thermal heat flux comparison is final-step only; omit timeSeconds');
   const revisions=[];for(const source of sources)revisions.push(await getProjectRevision(source.output));
   const assertCurrent=()=>{check();for(const source of sources)source.assertCurrent();};assertCurrent();
   if(JSON.stringify(getDefaults())!==JSON.stringify(defaults))throw Error('Viewer changed while preparing comparison');
   const rendered=renderComparison({cases:sources.map(source=>({caseId:source.caseId,label:source.name,source:source.output})),field:request.field,camera:view.camera,deformScale:view.deformScale,timeSeconds:request.timeSeconds,toleranceSeconds:request.toleranceSeconds});
   assertCurrent();
   const comparison={cases:sources.map((source,i)=>({caseId:source.caseId,revision:source.revision,resultRevision:revisions[i],label:source.name})),field:request.field,...(request.timeSeconds===undefined?{}:{requestedTimeSeconds:request.timeSeconds}),panels:rendered.panels,colorRange:rendered.colorRange,unit:rendered.unit};
   return {view,comparison,context:{canvas:rendered.canvas,assertCurrent}};
  },
  async render({context,signal,onProgress=()=>{}}){
   const check=()=>{if(signal?.aborted)throw Error('Comparison export cancelled');context.assertCurrent();};check();onProgress({fraction:0});
   const blob=await encodePng(context.canvas);check();onProgress({fraction:1});return blob;
  }
 };
}
