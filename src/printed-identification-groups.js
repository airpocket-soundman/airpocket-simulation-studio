import {identifyPrintedParameters} from './printed-parameter-identification.js';
import {importPrintedMeasurementDataset} from './printed-measurement-dataset.js';
export const PRINTED_IDENTIFICATION_GROUP_LIMITS=Object.freeze({groups:100,specimens:100,parameters:3});
const fail=()=>{throw Object.assign(Error('Invalid or unrepresentable condition grouping'),{code:'PRINTED_IDENTIFICATION_GROUP_INVALID'});};
const conditions=s=>({buildDirection:[...s.buildDirection],temperatureC:s.temperatureC,speedMmPerSecond:s.speedMmPerSecond,batch:s.batch,dimensionsMm:[...s.dimensionsMm],gaugeLengthMm:s.gaugeLengthMm});
// Object.is numeric equality: even signed zero is retained. No rounding or tolerances.
const conditionKey=c=>JSON.stringify(c,(_key,v)=>typeof v==='number'&&Object.is(v,-0)?{negativeZero:true}:v);
/** Independent per-condition statistics; leaves the legacy overall `across` result untouched. */
export async function identifyPrintedParametersByCondition(rawDatasetJson,options){
 const identification=await identifyPrintedParameters(rawDatasetJson,options);
 const dataset=await importPrintedMeasurementDataset(rawDatasetJson);
 if(dataset.sourceSha256!==identification.dataset.sourceSha256||dataset.specimens.length>100||dataset.specimens.length!==identification.specimens.length)fail();
 const groups=[],lookup=new Map();
 for(let i=0;i<dataset.specimens.length;i++){
  const source=dataset.specimens[i],fit=identification.specimens[i];if(source.id!==fit.specimen)fail();
  const profile=conditions(source),key=conditionKey(profile);let group=lookup.get(key);
  if(!group){if(groups.length>=100)fail();group={id:'condition-'+(groups.length+1),conditions:profile,members:[],statistics:null};groups.push(group);lookup.set(key,group);}
  group.members.push(fit.identified?{specimen:fit.specimen,identified:true}:{specimen:fit.specimen,identified:false,reason:fit.reason});
 }
 const fits=new Map(identification.specimens.map(s=>[s.specimen,s]));
 for(const group of groups){
  const accepted=group.members.filter(s=>s.identified).map(s=>fits.get(s.specimen));if(!accepted.length)continue;
  const names=Object.keys(accepted[0].parameters);if(names.length>3)fail();group.statistics={};
  for(const name of names){const values=accepted.map(s=>s.parameters[name].value),n=values.length,mean=values.reduce((sum,x)=>sum+x/n,0),sampleStandardDeviation=n===1?null:Math.hypot(...values.map(x=>(x-mean)/Math.sqrt(n-1)));if(!Number.isFinite(mean)||sampleStandardDeviation!==null&&!Number.isFinite(sampleStandardDeviation))fail();group.statistics[name]={mean,sampleStandardDeviation,specimens:n};}
 }
 return {identification,grouping:{groupingVersion:1,dataset:{...identification.dataset},model:identification.model,options:{...identification.options},calibrated:false,accuracyVerified:false,covarianceAccuracyVerified:false,mixedConditions:groups.length>1,groups}};
}
