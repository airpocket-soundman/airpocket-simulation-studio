import {validatePlasticLoadFractions} from './regions.js';

const numericFields={modeCount:'modal-count',modalIterations:'modal-iterations',directivityAxis:'directivity-axis',directivityPoints:'directivity-points',directivityDistanceMm:'directivity-distance',nonlinearLoadSteps:'nonlinear-steps',maxNewtonIterations:'nonlinear-iterations',materialTemperature:'material-temperature',flowAxis:'flow-axis',pressureDropPa:'flow-pressure-drop',dynamicViscosity:'flow-viscosity',fluidDensity:'flow-density',fluidSoundSpeed:'flow-sound-speed',maxRadiationIterations:'radiation-iterations',timeStep:'time-step',steps:'time-steps',initialTemperature:'initial-temperature',volumetricSource:'volumetric-source',frequency:'acoustic-frequency',soundSpeed:'sound-speed',airDensity:'air-density',lossFactor:'acoustic-loss',referencePressurePa:'reference-pressure',sweepStart:'sweep-start',sweepEnd:'sweep-end',sweepCount:'sweep-count'};
// IDs are the actual HTML controls. This descriptor also drives DOM reads/writes
// so preview normalization cannot silently drift from the applied GUI state.
const numberIds=[...Object.values(numericFields),'solid-temperature','reference-temperature','stokes-reference-length','acoustic-duration','pulse-width','acoustic-time-step','acoustic-damping','vibration-amplitude','vibration-phase','gravity-x','gravity-y','gravity-z','stokes-velocity-x','stokes-velocity-y','stokes-velocity-z','receiver-x','receiver-y','receiver-z'];
const checkIds=['modal-enabled','transient-acoustic','exterior-radiation','directivity-enabled','thermal-stress','gravity-enabled','transient-heat','acoustic-sweep'];
export const browserStudyControls=Object.freeze(Object.fromEntries([
 ...numberIds.map(id=>[id,Object.freeze({type:'number'})]),...checkIds.map(id=>[id,Object.freeze({type:'checkbox'})]),
 ['plastic-load-fractions',Object.freeze({type:'text'})],
 ['physics',Object.freeze({type:'select',options:Object.freeze(['structural','thermal','fluidDomain','channelFlow','creepingFlow','acoustic'])})],
 ['flow-axis',Object.freeze({type:'select',options:Object.freeze(['0','1','2'])})],['directivity-axis',Object.freeze({type:'select',options:Object.freeze(['0','1','2'])})],['stokes-element',Object.freeze({type:'select',options:Object.freeze(['P1','P2'])})]
]));
// HTMLInputElement.value uses LegacyNullToEmptyString, and number inputs apply
// the HTML valid-floating-point value sanitization algorithm. min/max/step do
// not clamp programmatic .value assignments. Selects clear unknown values.
function htmlValue(id,value){
 const type=browserStudyControls[id];if(!type)throw Error('Unknown browser study control');
 if(type.type==='checkbox')return !!value;
 const text=value===null?'':String(value);
 if(type.type==='select')return type.options.includes(text)?text:'';
 if(type.type==='number')return /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)&&Number.isFinite(Number(text))?text:'';
 return text.replace(/[\r\n]/g,'');
}
function plasticHistory(values,materialProperties){
 const raw=values['plastic-load-fractions'].trim();if(!raw||values.physics!=='structural'||!materialProperties?.plasticity)return {};
 const tokens=raw.split(','),fractions=tokens.map(Number);
 if(tokens.some(t=>!t.trim())||fractions.some(v=>!Number.isFinite(v)))throw Error('Invalid plastic load fractions: use 1–30 fractions in [0,1], positive first/final fractions, maximum 1 and matching load steps');
 const study={plasticLoadFractions:fractions,nonlinearLoadSteps:fractions.length};validatePlasticLoadFractions(study);return study;
}
export function serializeBrowserStudy(controlValues,{temperatureSource=null,vibrationSource=null,materialProperties={}}={}){
 const c=controlValues,n=id=>Number(c[id]),kind=c.physics;
 return {kind,...(kind==='acoustic'&&vibrationSource?{vibrationSource:{...structuredClone(vibrationSource),amplitudeMm:n('vibration-amplitude'),phaseDeg:n('vibration-phase')}}:{}),
 modalAnalysis:kind==='structural'&&c['modal-enabled'],modeCount:n('modal-count'),modalIterations:n('modal-iterations'),acousticTransient:kind==='acoustic'&&c['transient-acoustic'],acousticDuration:n('acoustic-duration')*.001,pulseWidth:n('pulse-width')*.001,acousticTimeStep:n('acoustic-time-step')*1e-6,dampingRate:n('acoustic-damping'),exteriorRadiation:kind==='acoustic'&&c['exterior-radiation'],directivityEnabled:kind==='acoustic'&&c['directivity-enabled'],directivityAxis:n('directivity-axis'),directivityPoints:n('directivity-points'),directivityDistanceMm:n('directivity-distance'),nonlinearLoadSteps:n('nonlinear-steps'),...plasticHistory(c,materialProperties),maxNewtonIterations:n('nonlinear-iterations'),materialTemperature:n('material-temperature'),flowAxis:n('flow-axis'),pressureDropPa:n('flow-pressure-drop'),dynamicViscosity:n('flow-viscosity'),fluidDensity:n('flow-density'),fluidSoundSpeed:n('flow-sound-speed'),stokesVelocityElement:c['stokes-element'],freeStreamVelocity:['stokes-velocity-x','stokes-velocity-y','stokes-velocity-z'].map(n),...(c['stokes-reference-length'].trim()?{referenceLengthMm:n('stokes-reference-length')}:{}),maxRadiationIterations:n('radiation-iterations'),...(temperatureSource?{temperatureSource:structuredClone(temperatureSource)}:{}),thermalStress:c['thermal-stress'],temperature:n('solid-temperature'),referenceTemperature:n('reference-temperature'),gravityEnabled:c['gravity-enabled'],gravity:['gravity-x','gravity-y','gravity-z'].map(n),transient:c['transient-heat'],timeStep:n('time-step'),steps:n('time-steps'),initialTemperature:n('initial-temperature'),volumetricSource:n('volumetric-source'),frequency:n('acoustic-frequency'),soundSpeed:n('sound-speed'),airDensity:n('air-density'),lossFactor:n('acoustic-loss'),referencePressurePa:n('reference-pressure'),sweep:c['acoustic-sweep'],sweepStart:n('sweep-start'),sweepEnd:n('sweep-end'),sweepCount:n('sweep-count'),receiverPoint:['receiver-x','receiver-y','receiver-z'].map(n)};
}
export function applyBrowserStudy(study,currentControlValues){
 const c=structuredClone(currentControlValues),set=(id,v)=>{c[id]=htmlValue(id,v);};
 const temperatureSource=study?.temperatureSource||null,vibrationSource=study?.vibrationSource||null;
 set('stokes-reference-length',study?.referenceLengthMm??'');
 if(vibrationSource){set('vibration-amplitude',vibrationSource.amplitudeMm);set('vibration-phase',vibrationSource.phaseDeg);}
 set('thermal-stress',!!study?.thermalStress);
 if(study?.temperature!==undefined)set('solid-temperature',study.temperature);
 if(study?.referenceTemperature!==undefined)set('reference-temperature',study.referenceTemperature);
 set('gravity-enabled',study?.gravityEnabled??!!study?.gravity?.some(v=>v!==0));
 if(study?.gravity)study.gravity.forEach((v,k)=>set(['gravity-x','gravity-y','gravity-z'][k],v));
 if(!study){set('physics','structural');set('modal-enabled',false);}
 if(study){
  set('physics',study.kind);set('modal-enabled',!!study.modalAnalysis);set('modal-count',study.modeCount??2);set('modal-iterations',study.modalIterations??60);set('exterior-radiation',!!study.exteriorRadiation);set('directivity-enabled',!!study.directivityEnabled);set('transient-heat',!!study.transient);
  for(const [key,id]of Object.entries(numericFields))if(!['modeCount','modalIterations'].includes(key)&&study[key]!==undefined)set(id,study[key]);
  if(study.referenceLengthMm!==undefined)set('stokes-reference-length',study.referenceLengthMm);
 }
 set('stokes-element',study?.stokesVelocityElement??'P1');
 if(study?.freeStreamVelocity)study.freeStreamVelocity.forEach((v,k)=>set(['stokes-velocity-x','stokes-velocity-y','stokes-velocity-z'][k],v));
 if(study?.receiverPoint)study.receiverPoint.forEach((v,k)=>set(['receiver-x','receiver-y','receiver-z'][k],v));
 if(study)set('acoustic-sweep',!!study.sweep);
 set('transient-acoustic',!!study?.acousticTransient);set('acoustic-duration',(study?.acousticDuration??.004)*1000);set('pulse-width',(study?.pulseWidth??.0002)*1000);set('acoustic-time-step',(study?.acousticTimeStep??0)*1e6);set('acoustic-damping',study?.dampingRate??0);
 set('plastic-load-fractions',study?.plasticLoadFractions?.join(',')||'');
 return {controlValues:c,sourceState:structuredClone({temperatureSource,vibrationSource})};
}
/** Trusted read-only host hook. candidate is already a validated normalized
 * project snapshot. The current raw controls supply the same dynamic defaults
 * as the real DOM adapter; no new physical values are selected here. */
export function normalizeBrowserProjectEdit(candidate,currentControlValues){
 const p=structuredClone(candidate),applied=applyBrowserStudy(p.study,currentControlValues);
 return {...p,materialProperties:p.materialProperties||{},meshSettings:p.meshSettings||{refinements:[]},study:serializeBrowserStudy(applied.controlValues,{...applied.sourceState,materialProperties:p.materialProperties||{}})};
}
