import {importPrintedMeasurementDataset} from './printed-measurement-dataset.js';
import {comparePrintedHoldoutPrediction} from './printed-parameter-holdout.js';
import {runFiniteViscoPronyUniaxial,FINITE_VISCO_PRONY_LIMITS} from './finite-visco-prony-uniaxial.js';
export const PRINTED_SLS_PRONY_LIMITS=Object.freeze({pairs:8,totalDriverSteps:4096,datasetBytes:2000000,resultBytes:4000000});
const invalid=reason=>{throw Object.assign(Error('SLS/Prony roundtrip: '+reason),{code:'PRINTED_SLS_PRONY_INVALID',reason});};
const record=(o,keys)=>{if(!o||typeof o!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(o))||Reflect.ownKeys(o).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(o,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))invalid('exact-data-required');};
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
function snapshot(input){
 record(input,['rawTraining','rawValidation','options','specimenPairs','bulkModulusPa','rampDurationSeconds']);
 const {rawTraining,rawValidation,bulkModulusPa,rampDurationSeconds}=input;
 for(const raw of [rawTraining,rawValidation])if(typeof raw!=='string'||raw.length>2000000||new TextEncoder().encode(raw).length>2000000)invalid('dataset-byte-budget');
 if(!positive(bulkModulusPa)||bulkModulusPa<1||bulkModulusPa>1e12||!positive(rampDurationSeconds)||rampDurationSeconds>1e9)invalid('explicit-bulk-or-ramp');
 const names=['model','maxStrain','minPoints','maxRelativeStandardError','holdStrainTolerance'];record(input.options,names);const options=Object.fromEntries(names.map(k=>[k,input.options[k]]));if(options.model!=='sls-relaxation'||names.slice(1).some(k=>!positive(options[k]))||!Number.isInteger(options.minPoints)||options.minPoints<3||options.minPoints>10000)invalid('sls-options-required');
 const a=input.specimenPairs;if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length<1||a.length>8||Reflect.ownKeys(a).length!==a.length+1)invalid('pair-budget');const specimenPairs=[];
 for(let i=0;i<a.length;i++){const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))invalid('dense-pairs-required');record(d.value,['trainingSpecimenId','validationSpecimenId']);const pair={...d.value};if(Object.values(pair).some(v=>typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>200))invalid('pair-id');specimenPairs.push(pair);}
 return{rawTraining,rawValidation,bulkModulusPa,rampDurationSeconds,options,specimenPairs};
}
function profile(s,ramp){
 const anchor=s.samples[0],held=s.samples.slice(1);if(held.length<2||anchor.engineeringStrain!==0||anchor.engineeringStressPa!==0)invalid('explicit-step-hold-required');const amplitude=held[0].engineeringStrain,start=held[0].timeS,duration=held.at(-1).timeS-start;if(!(amplitude>0)||held.some(p=>p.engineeringStrain!==amplitude)||ramp>start-anchor.timeS)invalid('declared-ramp-hold-profile');
 for(let i=0;i<held.length;i++){const expected=start+duration*i/(held.length-1),tol=8*Number.EPSILON*Math.max(Math.abs(start),Math.abs(expected),duration,Number.MIN_VALUE);if(Math.abs(held[i].timeS-expected)>tol)invalid('uniform-held-samples-required');}
 return{amplitude,start,duration,zeroAnchorTimeSeconds:anchor.timeS,steps:held.length,held};
}
const freeze=o=>{if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
function metrics(values){const n=values.length,biasPa=values.reduce((s,x)=>s+x/n,0),meanAbsoluteErrorPa=values.reduce((s,x)=>s+Math.abs(x)/n,0),rootMeanSquareErrorPa=Math.hypot(...values.map(x=>x/Math.sqrt(n))),maximumAbsoluteErrorPa=Math.max(...values.map(Math.abs));if(![biasPa,meanAbsoluteErrorPa,rootMeanSquareErrorPa,maximumAbsoluteErrorPa].every(Number.isFinite))invalid('nonfinite-residual');return{count:n,biasPa,meanAbsoluteErrorPa,rootMeanSquareErrorPa,maximumAbsoluteErrorPa};}
function transfer(fit,K){
 const Einf=fit.equilibriumModulusPa.value,E0=Einf+fit.branchModulusPa.value,tauE=fit.relaxationTimeS.value;
 const muInf=3*K*Einf/(9*K-Einf),mu0=3*K*E0/(9*K-E0),mu1=mu0-muInf,tauShear=tauE*(3*K+muInf)/(3*K+mu0);
 if(!(9*K>E0)||![muInf,mu1].every(x=>Number.isFinite(x)&&x>=1&&x<=1e12)||K/muInf<2/3||K/muInf>3||mu1/muInf>1||!Number.isFinite(tauShear)||tauShear<1e-6||tauShear>1e6)return null;
 return{bulkModulusPa:K,equilibriumShearModulusPa:muInf,branches:[{shearModulusPa:mu1,relaxationTimeSeconds:tauShear}]};
}
function drive(p,source,ramp,fit){
 const green=source.amplitude+source.amplitude**2/2,tau=p.branches[0].relaxationTimeSeconds;
 for(const dt of [ramp,source.duration/(source.steps-1)])if(dt/tau<FINITE_VISCO_PRONY_LIMITS.minTimeRatio||dt/tau>FINITE_VISCO_PRONY_LIMITS.maxTimeRatio)invalid('driver-dt-tau-envelope');
 let prony;try{prony=runFiniteViscoPronyUniaxial({synthetic:true,provisional:true,calibrated:false,parameters:p,segments:[{toAxialGreenStrain:green,durationSeconds:ramp,steps:1},{toAxialGreenStrain:green,durationSeconds:source.duration,steps:source.steps-1}]});}catch{invalid('driver-envelope-or-integration');}
 const rows=prony.rows.map((r,i)=>{const requestedElapsedSeconds=source.held[i].timeS-source.start,driverElapsedSeconds=r.timeSeconds-ramp,idealStepStressPa=source.amplitude*(fit.equilibriumModulusPa.value+fit.branchModulusPa.value*Math.exp(-requestedElapsedSeconds/fit.relaxationTimeS.value)),observedStressPa=source.held[i].engineeringStressPa;return{sourceTimeSeconds:source.held[i].timeS,requestedElapsedSeconds,driverElapsedSeconds,timeOffsetSeconds:driverElapsedSeconds-requestedElapsedSeconds,observedStressPa,idealStepStressPa,pronyNominalStressPa:r.P11Pa,pronySecondPiolaStressPa:r.S11Pa,pronyCauchyStressPa:r.sigma11Pa};});
 return{zeroAnchorTimeSeconds:source.zeroAnchorTimeSeconds,firstHeldTimeSeconds:source.start,declaredRampStartTimeSeconds:source.start-ramp,engineeringHoldStrain:source.amplitude,axialGreenStrain:green,declaredRampDurationSeconds:ramp,prony,rows,metrics:{pronyMinusObserved:metrics(rows.map(r=>r.pronyNominalStressPa-r.observedStressPa)),pronyMinusIdealStep:metrics(rows.map(r=>r.pronyNominalStressPa-r.idealStepStressPa)),idealStepMinusObserved:metrics(rows.map(r=>r.idealStepStressPa-r.observedStressPa))}};
}
/** Finite-ramp, small-amplitude consistency only: scalar fitted Young relaxation is not a finite-strain constitutive law. */
export async function runPrintedSlsPronyRoundtrip(input,{signal}={}){
 const s=snapshot(input),check=()=>{if(signal!==undefined){let aborted;try{aborted=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'aborted').get.call(signal);}catch{invalid('abort-signal');}if(aborted)throw Object.assign(Error('Roundtrip aborted'),{code:'PRINTED_SLS_PRONY_ABORTED'});}};check();
 const [training,validation]=await Promise.all([importPrintedMeasurementDataset(s.rawTraining),importPrintedMeasurementDataset(s.rawValidation)]);check();
 if(training.normalizationVersion!==1||validation.normalizationVersion!==1)invalid('normalization-version');
 if(training.provenance!=='synthetic'||validation.provenance!=='synthetic')invalid('synthetic-only');
 const train=new Map(training.specimens.map(x=>[x.id,x])),valid=new Map(validation.specimens.map(x=>[x.id,x])),profiles=[];let total=0;
 for(const pair of s.specimenPairs){const a=train.get(pair.trainingSpecimenId),b=valid.get(pair.validationSpecimenId);if(!a||!b)invalid('pair-id');const from=profile(a,s.rampDurationSeconds),to=profile(b,s.rampDurationSeconds);total+=from.steps+to.steps;if(total>4096)invalid('total-driver-step-budget');profiles.push({from,to});}
 const holdout=await comparePrintedHoldoutPrediction({rawTraining:s.rawTraining,rawValidation:s.rawValidation,options:s.options,specimenPairs:s.specimenPairs});check();
 if(holdout.training.sourceSha256!==training.sourceSha256||holdout.validation.sourceSha256!==validation.sourceSha256)invalid('source-identity');
 const pairs=holdout.pairs.map((pair,i)=>{check();if(pair.status!=='compared')return pair;const p=transfer(pair.parameters,s.bulkModulusPa);if(!p)return{trainingSpecimenId:pair.trainingSpecimenId,validationSpecimenId:pair.validationSpecimenId,status:'refused',reason:'prony-parameter-envelope'};const trainingCurve=drive(p,profiles[i].from,s.rampDurationSeconds,pair.parameters);check();const validationCurve=drive(p,profiles[i].to,s.rampDurationSeconds,pair.parameters);check();return{trainingSpecimenId:pair.trainingSpecimenId,validationSpecimenId:pair.validationSpecimenId,status:'compared',identifiedParameters:pair.parameters,pronyParameters:p,holdoutIdealStepMetricsIncludingZeroAnchor:pair.metrics,training:trainingCurve,validation:validationCurve};});check();
 const result={roundtripVersion:1,mappingVersion:1,model:'printed-sls-prony-small-amplitude-roundtrip-v1',identificationVersion:1,normalizationVersion:1,holdoutVersion:holdout.holdoutVersion,synthetic:true,measured:false,provisional:true,calibrated:false,accuracyVerified:false,physicalIndependenceVerified:false,bulkModulusIdentified:false,parameterUncertaintyPropagated:false,meaning:'small-amplitude-finite-ramp-consistency-not-exact-reproduction',protocol:'declared-step-reference-versus-explicit-finite-ramp',units:{engineeringStrain:'1',greenStrain:'1',stress:'Pa',time:'s'},training:holdout.training,validation:holdout.validation,options:s.options,bulkModulusPa:s.bulkModulusPa,rampDurationSeconds:s.rampDurationSeconds,plannedDriverSteps:total,totalDriverSteps:pairs.filter(p=>p.status==='compared').reduce((n,p)=>n+p.training.prony.rows.length+p.validation.prony.rows.length,0),pairs};
 if(new TextEncoder().encode(JSON.stringify(result)).length>4000000)invalid('result-byte-budget');return freeze(result);
}
