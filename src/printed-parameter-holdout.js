import {importPrintedMeasurementDataset,PRINTED_DATASET_LIMITS} from './printed-measurement-dataset.js';
import {identifyPrintedParameters} from './printed-parameter-identification.js';

export const PRINTED_HOLDOUT_LIMITS=Object.freeze({datasetBytes:PRINTED_DATASET_LIMITS.bytes,pairs:100,totalSamples:10000,resultBytes:4000000});
const invalid=reason=>{throw Object.assign(Error('Printed holdout: '+reason),{code:'PRINTED_HOLDOUT_INVALID',reason});};
const fields={
 'linear-elastic':[],
 'bilinear-elastic-plastic':['maxTangentRatio'],
 'sls-relaxation':['holdStrainTolerance']
};
function record(o,names){if(!o||![Object.prototype,null].includes(Object.getPrototypeOf(o))||Reflect.ownKeys(o).length!==names.length||names.some(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))invalid('exact-own-data-required');}
function optionsSnapshot(o){
 const model=Object.getOwnPropertyDescriptor(o??{},'model');if(!model||!Object.hasOwn(model,'value')||typeof model.value!=='string'||!Object.hasOwn(fields,model.value))invalid('unsupported-model');
 const names=['model','maxStrain','minPoints','maxRelativeStandardError',...fields[model.value]];record(o,names);const copy=Object.fromEntries(names.map(k=>[k,o[k]]));
 for(const k of names.filter(k=>k!=='model'))if(typeof copy[k]!=='number'||!Number.isFinite(copy[k])||copy[k]<=0)invalid('invalid-identification-option');
 if(!Number.isSafeInteger(copy.minPoints)||copy.minPoints<3||copy.minPoints>10000||copy.model==='bilinear-elastic-plastic'&&copy.maxTangentRatio>=1)invalid('invalid-identification-option');return copy;
}
function pairsSnapshot(a){
 if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length<1||a.length>100||Reflect.ownKeys(a).length!==a.length+1)invalid('pair-budget-or-shape');
 const result=[],training=new Set(),validation=new Set();for(let i=0;i<a.length;i++){const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))invalid('dense-pairs-required');const p=d.value;record(p,['trainingSpecimenId','validationSpecimenId']);for(const k of ['trainingSpecimenId','validationSpecimenId'])if(typeof p[k]!=='string'||!p[k].trim()||p[k]!==p[k].trim()||p[k].length>200)invalid('invalid-pair-identity');if(training.has(p.trainingSpecimenId)||validation.has(p.validationSpecimenId))invalid('pair-not-one-to-one');training.add(p.trainingSpecimenId);validation.add(p.validationSpecimenId);result.push({trainingSpecimenId:p.trainingSpecimenId,validationSpecimenId:p.validationSpecimenId});}return result;
}
function freeze(o){if(o&&typeof o==='object'){for(const value of Object.values(o))freeze(value);Object.freeze(o);}return o;}
function sameConditions(a,b){
 for(const k of ['gaugeLengthMm','temperatureC','speedMmPerSecond','batch'])if(a[k]!==b[k])invalid('recorded-condition-mismatch');
 for(const k of ['dimensionsMm','buildDirection'])if(a[k].some((x,i)=>x!==b[k][i]))invalid('recorded-condition-mismatch');
}
function loadingProfile(s,options){
 let previous=-Infinity;for(const p of s.samples){if(p.engineeringStrain<0||p.engineeringStrain>options.maxStrain||p.engineeringStrain<=previous)invalid('loading-not-strictly-increasing-in-window');if(p.engineeringStrain===0&&p.engineeringStressPa!==0)invalid('nonzero-unloaded-anchor');previous=p.engineeringStrain;}
 if(!(previous>0))invalid('no-positive-loading');return{min:s.samples[0].engineeringStrain,max:previous};
}
function holdProfile(s,options,training){
 const [anchor,...held]=s.samples;if(anchor.engineeringStrain!==0||anchor.engineeringStressPa!==0||held.length<(training?Math.max(4,options.minPoints):2))invalid('explicit-step-hold-required');
 const amplitude=held[0].engineeringStrain;if(!(amplitude>0&&amplitude<=options.maxStrain)||held.some(p=>p.engineeringStrain!==amplitude))invalid('constant-positive-hold-required');
 return{amplitude,start:held[0].timeS,duration:held.at(-1).timeS-held[0].timeS};
}
const metadata=d=>({id:d.id,revision:d.revision,provenance:d.provenance,sourceSha256:d.sourceSha256,specimens:d.specimens.length,samples:d.specimens.reduce((n,s)=>n+s.samples.length,0)});
function prediction(model,parameters,sample,profile,index){
 const p=name=>parameters[name].value,e=sample.engineeringStrain;
 if(model==='linear-elastic')return p('youngsModulusPa')*e;
 if(model==='bilinear-elastic-plastic'){const E=p('youngsModulusPa'),yieldStress=p('yieldStressPa'),yieldStrain=yieldStress/E;return e<=yieldStrain?E*e:yieldStress+p('tangentModulusPa')*(e-yieldStrain);}
 if(index===0)return 0;return profile.amplitude*(p('equilibriumModulusPa')+p('branchModulusPa')*Math.exp(-(sample.timeS-profile.start)/p('relaxationTimeS')));
}
function comparePair(mapping,fit,validation,profile,model){
 if(!fit.identified)return{...mapping,status:'refused',reason:'training-not-identified',identificationReason:fit.reason};
 const rows=[];for(let i=0;i<validation.samples.length;i++){const point=validation.samples[i],predictedStressPa=prediction(model,fit.parameters,point,profile,i),residualPa=predictedStressPa-point.engineeringStressPa;if(!Number.isFinite(predictedStressPa)||!Number.isFinite(residualPa))return{...mapping,status:'refused',reason:'nonfinite-prediction-or-error'};rows.push({timeSeconds:point.timeS,engineeringStrain:point.engineeringStrain,observedStressPa:point.engineeringStressPa,predictedStressPa,residualPa});}
 const count=rows.length,biasPa=rows.reduce((n,r)=>n+r.residualPa/count,0),meanAbsoluteErrorPa=rows.reduce((n,r)=>n+Math.abs(r.residualPa)/count,0),rootMeanSquareErrorPa=Math.hypot(...rows.map(r=>r.residualPa/Math.sqrt(count))),maximumAbsoluteErrorPa=Math.max(...rows.map(r=>Math.abs(r.residualPa)));
 if(![biasPa,meanAbsoluteErrorPa,rootMeanSquareErrorPa,maximumAbsoluteErrorPa].every(Number.isFinite))return{...mapping,status:'refused',reason:'nonfinite-error-statistics'};
 return{...mapping,status:'compared',trainingPoints:fit.points,parameters:Object.fromEntries(Object.entries(fit.parameters).map(([name,p])=>[name,{...p}])),metrics:{count,biasPa,meanAbsoluteErrorPa,rootMeanSquareErrorPa,maximumAbsoluteErrorPa},samples:rows};
}

/** Declared holdout only. Fits training once; validation never enters a fit. No pass threshold, calibration or material application. */
export async function comparePrintedHoldoutPrediction(input){
 record(input,['rawTraining','rawValidation','options','specimenPairs']);const {rawTraining,rawValidation}=input,options=optionsSnapshot(input.options),specimenPairs=pairsSnapshot(input.specimenPairs);
 for(const raw of [rawTraining,rawValidation])if(typeof raw!=='string'||raw.length>PRINTED_HOLDOUT_LIMITS.datasetBytes||new TextEncoder().encode(raw).length>PRINTED_HOLDOUT_LIMITS.datasetBytes)invalid('dataset-byte-budget');
 const [training,validation]=await Promise.all([importPrintedMeasurementDataset(rawTraining),importPrintedMeasurementDataset(rawValidation)]);
 if(training.id===validation.id||training.sourceSha256===validation.sourceSha256)invalid('datasets-not-distinct');
 const train=new Map(training.specimens.map(s=>[s.id,s])),valid=new Map(validation.specimens.map(s=>[s.id,s]));if(validation.specimens.some(s=>train.has(s.id)))invalid('specimen-identity-overlap');
 if(specimenPairs.length!==train.size||specimenPairs.length!==valid.size||specimenPairs.some(p=>!train.has(p.trainingSpecimenId)||!valid.has(p.validationSpecimenId)))invalid('complete-one-to-one-mapping-required');
 if(metadata(training).samples+metadata(validation).samples>PRINTED_HOLDOUT_LIMITS.totalSamples)invalid('total-sample-budget');
 const profiles=specimenPairs.map(p=>{const a=train.get(p.trainingSpecimenId),b=valid.get(p.validationSpecimenId);sameConditions(a,b);if(options.model==='sls-relaxation'){const from=holdProfile(a,options,true),to=holdProfile(b,options,false);if(to.amplitude>from.amplitude||to.duration>from.duration)invalid('holdout-extrapolation');return to;}
  const from=loadingProfile(a,options),to=loadingProfile(b,options);if(to.min<from.min||to.max>from.max)invalid('holdout-extrapolation');return null;});
 const identified=await identifyPrintedParameters(rawTraining,options);if(identified.dataset.sourceSha256!==training.sourceSha256)invalid('training-source-changed');const fits=new Map(identified.specimens.map(s=>[s.specimen,s]));
 const pairs=specimenPairs.map((p,i)=>comparePair(p,fits.get(p.trainingSpecimenId),valid.get(p.validationSpecimenId),profiles[i],options.model)),compared=pairs.filter(p=>p.status==='compared').length;
 const report={holdoutVersion:1,model:options.model,options,training:metadata(training),validation:metadata(validation),independence:'declared-only',physicalIndependenceVerified:false,calibrated:false,accuracyVerified:false,recordedConditions:'exact-normalized-match-including-batch',residualConvention:'prediction-minus-observation',protocol:options.model==='sls-relaxation'?'declared-ideal-step-at-first-held-sample':'strictly-increasing-nonnegative-loading',extrapolation:false,summary:{pairs: pairs.length,compared,refused:pairs.length-compared},pairs};
 if(new TextEncoder().encode(JSON.stringify(report)).length>PRINTED_HOLDOUT_LIMITS.resultBytes)invalid('result-byte-budget');return freeze(report);
}
