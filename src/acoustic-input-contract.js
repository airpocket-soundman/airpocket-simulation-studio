import {validateHistorySettings} from './time-history-plan.js';
import {acousticResolutionLimits} from './acoustic-resolution-contract.js';
import {canonicalJson} from './project-revision.js';
import {validateImpedance} from './acoustic-impedance.js';
import {validateSphere} from './fluid-domain.js';
import {validateVibrationSource,validateVibrationStudy} from './vibration-source.js';
import {validateSourceAssessment} from './source-assessment.js';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),own=(value,key)=>Object.hasOwn(value,key),positive=value=>Number.isFinite(value)&&value>0,boolean=value=>typeof value==='boolean';
const units={geometry:'mm',frequency:'Hz',soundSpeed:'m/s',airDensity:'kg/m3',lossFactor:'1',referencePressurePa:'Pa',pressure:'Pa',impedance:'Pa*s/m',time:'s',acousticDuration:'s',pulseWidth:'s',acousticTimeStep:'s',dampingRate:'1/s',amplitudeMm:'mm',phaseDeg:'deg',directivityDistanceMm:'mm'};
/** Evidence covers declared acoustic inputs, not source truth or physical accuracy.
 * Case-linked modal fields use their saved identity; direct fields require mesh
 * and displacement evidence, which duplicates those arrays in provenance JSON. */
export function inspectAcousticInputContract(project,options={}, {mode='legacy'}={}){
 const requiredPointers=[],diagnostics=[],result={contract:'acoustic-wave',requiredPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Supply the intended acoustic input and record its source or an explicit exploratory assumption'],requiresUserIntent:true});
 const require=(pointer,value,valid,message)=>{requiredPointers.push(pointer);if(value===undefined||value===null)add('ACOUSTIC_INPUT_REQUIRED',pointer,'Required explicit acoustic input is missing');else if(!valid(value))add('ACOUSTIC_INPUT_INVALID',pointer,message);};
 try{
  if(!['quantitative','exploratory'].includes(mode)||!object(project)||!object(options)){add('ACOUSTIC_INPUT_INVALID','/','Invalid acoustic contract arguments');return result;}
  const s=object(project.study)?project.study:{};
  for(const key of ['acousticSnapshotCount','acousticSnapshotBudgetBytes'])for(const [base,input]of [['/study/',s],['/options/',options]])if(own(input,key)){try{validateHistorySettings({[key]:input[key]});}catch(error){add('ACOUSTIC_HISTORY_INVALID',base+key,error.message);}}
  require('/study/kind',s.kind,value=>value==='acoustic','Acoustic study kind required');
  for(const key of ['acousticTransient','sweep','exteriorRadiation','directivityEnabled'])require('/study/'+key,s[key],boolean,'Explicit acoustic branch setting required');
  for(const key of ['frequency','soundSpeed','airDensity'])require('/study/'+key,s[key],positive,'Positive finite acoustic medium value required');
  require('/study/lossFactor',s.lossFactor,value=>Number.isFinite(value)&&value>=0,'Nonnegative harmonic loss required');
  const point=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  if(s.acousticTransient===true){
   for(const [key,min,max]of [['acousticDuration',1e-6,.1],['pulseWidth',1e-6,.01],['acousticTimeStep',0,.01],['dampingRate',0,1e6]])require('/study/'+key,s[key],value=>Number.isFinite(value)&&value>=min&&value<=max,'Transient acoustic value outside supported bounds');
   require('/study/receiverPoint',s.receiverPoint,point,'Explicit finite receiver point required');
   if(s.lossFactor!==0||s.sweep||s.directivityEnabled||s.vibrationSource!==undefined)add('ACOUSTIC_BRANCH_INCOMPATIBLE','/study','Transient acoustics requires zero harmonic loss and no sweep, directivity or modal source');
   if(Number.isFinite(s.acousticDuration)&&Number.isFinite(s.pulseWidth)&&s.acousticDuration<12*s.pulseWidth*(1-1e-14))add('ACOUSTIC_PULSE_INCOMPLETE','/study/acousticDuration','Duration must include the complete 12-width pulse');
   // Explicit positive steps determine this solver workload limit before meshing.
   // Automatic stepping and the node-dependent budget still require the mesh.
   if(Number.isFinite(s.acousticDuration)&&s.acousticDuration>0&&Number.isFinite(s.acousticTimeStep)&&s.acousticTimeStep>0){const steps=Math.ceil(s.acousticDuration/s.acousticTimeStep);if(steps>60000)add('ACOUSTIC_WORKLOAD_UNSUPPORTED','/study/acousticTimeStep','Transient acoustic workload exceeds the supported 60000 time steps',{...(Number.isFinite(steps)?{steps}:{stepCountOverflow:true}),maximumSteps:60000});}
  }else require('/study/referencePressurePa',s.referencePressurePa,positive,'Explicit positive RMS reference pressure required');
  if(s.sweep===true){
   require('/study/sweepStart',s.sweepStart,positive,'Positive sweep start required');require('/study/sweepEnd',s.sweepEnd,value=>positive(value)&&value>=s.sweepStart,'Sweep end must be at least its start');require('/study/sweepCount',s.sweepCount,value=>Number.isInteger(value)&&value>=1&&value<=20,'Sweep count must be from 1 to 20');require('/study/receiverPoint',s.receiverPoint,point,'Explicit sweep receiver required');
  }
  if(s.acousticTransient===false&&positive(s.soundSpeed)&&Number.isFinite(s.lossFactor)&&s.lossFactor>=0){
   const frequencies=[['frequency',s.frequency],...(s.sweep===true?[['sweepStart',s.sweepStart],...(s.sweepCount>1?[['sweepEnd',s.sweepEnd]]:[])]:[])];
   for(const [key,frequency]of frequencies)if(positive(frequency))try{acousticResolutionLimits({frequency,soundSpeed:s.soundSpeed,lossFactor:s.lossFactor});if(!Number.isFinite((2*Math.PI*frequency/s.soundSpeed)**2))throw Error('Frequency/speed ratio exceeds numerical limits');}catch(error){add('ACOUSTIC_NUMERICAL_RANGE_UNSUPPORTED','/study/'+key,error.message);}
  }
  if(s.exteriorRadiation===true){requiredPointers.push('/sourceModel/enclosure');try{if(project.sourceModel?.kind!=='fluidDomain'||project.sourceModel.mode==='internal')throw Error('Exterior fluid domain required');validateSphere(project.sourceModel.enclosure);}catch{add('ACOUSTIC_RADIATION_GEOMETRY_INVALID','/sourceModel/enclosure','Exterior radiation requires a spherical exterior domain');}}
  if(s.directivityEnabled===true){
   require('/study/directivityAxis',s.directivityAxis,value=>Number.isInteger(value)&&value>=0&&value<=2,'Directivity axis must be 0, 1 or 2');require('/study/directivityPoints',s.directivityPoints,value=>Number.isInteger(value)&&value>=12&&value<=180,'Directivity count must be from 12 to 180');require('/study/directivityDistanceMm',s.directivityDistanceMm,positive,'Positive reference distance required');if(s.exteriorRadiation!==true)add('ACOUSTIC_BRANCH_INCOMPATIBLE','/study/directivityEnabled','Far field requires exterior radiation');
  }
  const runtimeKeys=['acousticSnapshotCount','acousticSnapshotBudgetBytes','kind','acousticTransient','frequency','soundSpeed','airDensity','lossFactor','referencePressurePa','acousticDuration','pulseWidth','acousticTimeStep','dampingRate','receiverPoint','sweep','sweepStart','sweepEnd','sweepCount','exteriorRadiation','directivityEnabled','directivityAxis','directivityPoints','directivityDistanceMm','vibrationSource'];
  for(const key of runtimeKeys)if(own(options,key)&&canonicalJson(options[key])!==canonicalJson(s[key]??null))add('ACOUSTIC_RUNTIME_OVERRIDE','/options/'+key,'Runtime acoustic input differs from the provenance-bearing study');
  for(const key of ['initialPressure','radiationBoundary','normalVelocity'])if(own(options,key))add('ACOUSTIC_RUNTIME_OVERRIDE','/options/'+key,'This acoustic input is not accepted through runtime options');
  const conditions=Array.isArray(project.conditions)?project.conditions:[];if(!Array.isArray(project.conditions))add('ACOUSTIC_INPUT_INVALID','/conditions','Explicit boundary condition array required');let pressureSource=false;
  const regionsValid=regions=>Array.isArray(regions)&&regions.length>0&&regions.every(region=>object(region)&&Number.isInteger(region.mesh)&&region.mesh>=0&&project.meshes?.[region.mesh]&&Array.isArray(region.triangles)&&region.triangles.length>0&&region.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<(project.meshes[region.mesh].faceIds?.length??0)));
  for(const [index,candidate]of conditions.entries()){
   const c=object(candidate)?candidate:{},base='/conditions/'+index;require(base+'/type',c.type,value=>['acousticPressure','acousticImpedance'].includes(value),'Boundary must belong to acoustics');require(base+'/value',c.value,value=>Number.isFinite(value)&&(c.type!=='acousticImpedance'||value>0),'Finite pressure or positive resistance required');require(base+'/regions',c.regions,regionsValid,'Nonempty acoustic boundary regions required');for(const key of ['planarRegion','cylindricalRegion','sphericalRegion'])if(c[key]!==undefined)requiredPointers.push(base+'/'+key);
   if(c.type==='acousticPressure'&&Number.isFinite(c.value)&&regionsValid(c.regions)&&!c.cadUpdateRequired)pressureSource=true;
   if(c.type==='acousticImpedance'){
    require(base+'/reactance',c.reactance,Number.isFinite,'Explicit impedance reactance required');if(c.impedanceTable!==undefined)requiredPointers.push(base+'/impedanceTable');try{validateImpedance(c);if(s.acousticTransient===true&&(c.reactance!==0||c.impedanceTable!==undefined))throw Error('Transient impedance must be constant and real');if(c.impedanceTable){const frequencies=[s.frequency,...(s.sweep?[s.sweepStart,s.sweepEnd]:[])];if(frequencies.some(f=>f<c.impedanceTable[0][0]||f>c.impedanceTable.at(-1)[0]))throw Error('Frequency outside impedance table');}}catch(error){add('ACOUSTIC_IMPEDANCE_INVALID',base,error.message);}
   }
  }
  if(s.vibrationSource!==undefined){
   const v=s.vibrationSource,base='/study/vibrationSource';try{validateVibrationSource(v);validateVibrationStudy(s);if(project.sourceModel?.kind!=='fluidDomain'||project.sourceModel.mode==='internal'||project.sourceModel.solid?.kind!=='box'||canonicalJson(project.sourceModel.solid.bounds)!==canonicalJson(v.bounds))throw Error('Modal source requires its unchanged exterior box solid');}catch(error){add('ACOUSTIC_VIBRATION_INVALID',base,error.message);}
   for(const key of ['name','modeIndex','frequencyHz','amplitudeMm','phaseDeg','bounds'])requiredPointers.push(base+'/'+key);
   if(v?.caseReference!==undefined){require(base+'/caseReference',v.caseReference,value=>object(value)&&Object.keys(value).length===3&&value.schemaVersion===1&&typeof value.caseId==='string'&&value.caseId.length>0&&typeof value.revision==='string'&&/^sha256:[a-f0-9]{64}$/.test(value.revision),'Valid saved-case source identity required');}else requiredPointers.push(base+'/mesh',base+'/displacement');
   if(v?.sourceAssessment!==undefined){requiredPointers.push(base+'/sourceAssessment');try{validateSourceAssessment(v.sourceAssessment);}catch(error){add('ACOUSTIC_VIBRATION_INVALID',base+'/sourceAssessment',error.message);}}
   if(conditions.some(c=>['acousticPressure','acousticImpedance'].includes(c?.type)))add('ACOUSTIC_BRANCH_INCOMPATIBLE','/conditions','Modal sound requires removal of manual pressure and impedance conditions');
  }else if(!pressureSource)add('ACOUSTIC_SOURCE_REQUIRED','/conditions','Explicit pressure source or supported saved modal source required');
 }catch{add('ACOUSTIC_INPUT_INVALID','/','Malformed acoustic inputs cannot be inspected');}
 result.requiredPointers=[...new Set(requiredPointers)];return result;
}
