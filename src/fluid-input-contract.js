import {validateFluidDomain} from './fluid-domain.js';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const units={geometry:'mm',dynamicViscosity:'Pa*s',fluidDensity:'kg/m3',fluidSoundSpeed:'m/s',pressureDropPa:'Pa',freeStreamVelocity:'m/s',referenceLengthMm:'mm',velocity:'m/s',pressure:'Pa',density:'kg/m3'};
/** Existing steady limited-flow models only. Mesh-derived channel identity,
 * boundary completeness, flux balance and final regimes remain post-mesh checks.
 * Original STEP bytes are not duplicated into provenance requirements. */
export function inspectFluidInputContract(project,options={}, {mode='legacy'}={}){
 let kind;try{kind=project?.study?.kind;}catch{}
 const contract=kind==='channelFlow'?'fully-developed-channel-flow':kind==='creepingFlow'?'external-creeping-stokes-flow':'unsupported',requiredPointers=[],diagnostics=[],result={contract,requiredPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Specify the intended existing flow model, physical inputs and their source or explicit exploratory assumptions'],requiresUserIntent:true});
 const required=(pointer,value,valid,message,unit=null)=>{requiredPointers.push(pointer);if(value===undefined||value===null)add('FLUID_INPUT_REQUIRED',pointer,'Required explicit fluid input is missing',{unit});else if(!valid(value))add('FLUID_INPUT_INVALID',pointer,message,{unit});};
 try{
  if(!['quantitative','exploratory'].includes(mode)||!object(project)||!object(options)){add('FLUID_INPUT_INVALID','/','Invalid fluid input contract arguments');return result;}
  const study=object(project.study)?project.study:{},source=object(project.sourceModel)?project.sourceModel:{};
  required('/study/kind',study.kind,value=>['channelFlow','creepingFlow'].includes(value),'Only channelFlow and creepingFlow are covered');
  for(const key of ['dynamicViscosity','fluidDensity'])required('/study/'+key,study[key],value=>Number.isFinite(value)&&value>0,'Fluid viscosity and density must be positive',units[key]);
  required('/conditions',project.conditions,value=>Array.isArray(value)&&value.length===0,'Limited flow models use automatic boundaries and require an explicit empty conditions array');
  required('/sourceModel/kind',source.kind,value=>typeof value==='string'&&value.length>0,'Original supported fluid source required');
  const vector=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite),box=value=>Array.isArray(value)&&value.length===6&&value.every(Number.isFinite)&&value.slice(3).every(v=>v>0);
  const geometry=(solid,base)=>{
   required(base+'/kind',solid?.kind,value=>['box','boxes','sphere','tube','cylinder','step'].includes(value),'Unsupported excluded solid source');
   const keys=solid?.kind==='box'?['bounds']:solid?.kind==='boxes'?['boxes']:solid?.kind==='sphere'?['center','radius']:solid?.kind==='tube'?['center','axis','outerRadius','innerRadius','length']:[];
   for(const key of keys)required(base+'/'+key,solid[key],()=>true,'Explicit solid dimensions required',key==='axis'?'1':'mm');
  };
  if(source.kind==='fluidDomain'){
   try{validateFluidDomain(source);}catch(error){add('FLUID_DOMAIN_INVALID','/sourceModel',error.message);}
   required('/sourceModel/enclosure',source.enclosure,box,'Existing flow models require a box enclosure','mm');geometry(source.solid,'/sourceModel/solid');
   if(source.mode!==undefined)requiredPointers.push('/sourceModel/mode');
   if(source.mode==='internal'){
    required('/sourceModel/seedPoint',source.seedPoint,vector,'Internal domain requires explicit seed point','mm');
    required('/sourceModel/portPlanes',source.portPlanes,value=>Array.isArray(value)&&value.length===2&&new Set(value).size===2&&value.every(v=>Number.isInteger(v)&&v>=0&&v<6),'Internal channel requires two explicit box port planes');
    if(kind==='creepingFlow')add('FLUID_DOMAIN_UNSUPPORTED','/sourceModel/mode','Internal Stokes adapter is not connected to the common Worker execution path');
    if(kind==='channelFlow'&&Array.isArray(source.portPlanes)&&(!source.portPlanes.includes(study.flowAxis)||!source.portPlanes.includes(study.flowAxis+3)))add('FLUID_DOMAIN_UNSUPPORTED','/sourceModel/portPlanes','Internal channel port planes must match the explicit flow axis');
   }else if(kind==='channelFlow')add('FLUID_DOMAIN_UNSUPPORTED','/sourceModel','Channel flow supports an extracted internal straight channel, not exterior flow');
  }else if(kind==='channelFlow'&&source.kind==='box')required('/sourceModel/bounds',source.bounds,box,'Positive rectangular channel dimensions required','mm');
  else if(kind==='channelFlow'&&source.kind==='cylinder'){if(study.flowAxis!==1)add('FLUID_DOMAIN_UNSUPPORTED','/study/flowAxis','The fixed built-in round cylinder channel runs along Y');}
  else add('FLUID_DOMAIN_UNSUPPORTED','/sourceModel','Use a supported built-in straight channel or the documented fluid domain');
  if(kind==='channelFlow'){
   required('/study/flowAxis',study.flowAxis,value=>Number.isInteger(value)&&value>=0&&value<=2,'Channel flow axis must be 0, 1 or 2');
   required('/study/pressureDropPa',study.pressureDropPa,Number.isFinite,'Channel pressure drop must be finite Pa',units.pressureDropPa);
   required('/study/fluidSoundSpeed',study.fluidSoundSpeed,value=>Number.isFinite(value)&&value>0,'Fluid sound speed must be positive m/s',units.fluidSoundSpeed);
  }else if(kind==='creepingFlow'){
   required('/study/freeStreamVelocity',study.freeStreamVelocity,value=>vector(value)&&Number.isFinite(Math.hypot(...value))&&Math.hypot(...value)>0,'External Stokes needs a finite nonzero explicit free-stream velocity',units.freeStreamVelocity);
   required('/study/referenceLengthMm',study.referenceLengthMm,value=>Number.isFinite(value)&&value>0,'Explicit Stokes reference length must be positive mm',units.referenceLengthMm);
   required('/study/stokesVelocityElement',study.stokesVelocityElement,value=>['P1','P2'].includes(value),'Explicit Stokes velocity element P1 or P2 required');
   const re=study.fluidDensity*Math.hypot(...(vector(study.freeStreamVelocity)?study.freeStreamVelocity:[NaN]))*study.referenceLengthMm*.001/study.dynamicViscosity;
   if(Number.isFinite(study.referenceLengthMm)&&study.referenceLengthMm>0&&Number.isFinite(study.dynamicViscosity)&&study.dynamicViscosity>0&&Number.isFinite(study.fluidDensity)&&study.fluidDensity>0&&vector(study.freeStreamVelocity)&&(!Number.isFinite(re)||re>.1+1e-12))add('FLUID_REGIME_UNSUPPORTED','/study/referenceLengthMm','Stokes requires Reynolds number <= 0.1; body-size lower bound is also checked after meshing',{maximumReynoldsNumber:.1});
  }
  for(const key of ['kind','dynamicViscosity','fluidDensity','fluidSoundSpeed','pressureDropPa','flowAxis','freeStreamVelocity','referenceLengthMm','stokesVelocityElement'])if(own(options,key)&&!(Array.isArray(options[key])&&Array.isArray(study[key])?options[key].length===study[key].length&&options[key].every((value,index)=>value===study[key][index]):options[key]===study[key]))add('FLUID_RUNTIME_OVERRIDE','/options/'+key,'Runtime fluid value differs from the project; this Worker reads physical inputs from study',{studyPointer:'/study/'+key});
 }catch{add('FLUID_INPUT_INVALID','/','Malformed fluid input cannot be inspected');}
 return result;
}
