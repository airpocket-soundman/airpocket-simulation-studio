import {canonicalJson,getProjectRevision} from './project-revision.js';
import {createCaseStore} from './cases.js';
import {prepareCaseView} from './case-view.js';
import {createResultViewApi} from './result-view-api.js';
import {validateMeasurementArchive} from './measurement-history.js';
const exact=(value,allowed)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===allowed.length&&allowed.every(key=>Object.hasOwn(value,key));
/** Reproduce recorded interpolation against archived fields. This does not verify
 * solver independence, experiment agreement or physical model accuracy. */
export async function verifyMeasurementArchive(command){
 // Snapshot both arguments before awaiting any hash, rejecting lossy JSON data.
 const normalized=canonicalJson(command),snapshot=JSON.parse(normalized);
 if(!exact(snapshot,['caseArchive','measurementArchive']))throw Error('Expected case and measurement archives');
 const caseJson=canonicalJson(snapshot.caseArchive);if(new TextEncoder().encode(caseJson).length>100000000)throw Error('Measurement verification case archive exceeds 100 MB');
 if(!exact(snapshot.caseArchive,['version','cases'])||snapshot.caseArchive.version!==1)throw Error('Invalid measurement verification case archive');
 const measurementArchive=validateMeasurementArchive(snapshot.measurementArchive),store=createCaseStore();store.import(snapshot.caseArchive);
 const outputs=new Map();for(let caseIndex=0;caseIndex<store.count();caseIndex++){const output=prepareCaseView(store.at(caseIndex)),resultRevision=await getProjectRevision(JSON.parse(JSON.stringify(output))),previous=outputs.get(resultRevision);if(previous)previous.caseIndexes.push(caseIndex);else outputs.set(resultRevision,{output,caseIndexes:[caseIndex]});}
 const matches=[];for(const record of measurementArchive.measurements){const matched=outputs.get(record.resultRevision);if(!matched)throw Error('Measurement has no matching restored saved result: '+record.id);const display=record.evidence.display,state={field:display.field,modeIndex:display.modeIndex,frameIndex:display.frameIndex,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:null,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}},resultView=createResultViewApi({getAnalysis:()=>matched.output,get:()=>state});
  const actual=await resultView.probe({expectedResultRevision:record.resultRevision,point:record.point,options:record.options});
  if(canonicalJson(actual)!==canonicalJson(record.evidence))throw Error('Measurement evidence does not match saved result: '+record.id);
  matches.push({measurementId:record.id,resultRevision:record.resultRevision,caseIndexes:[...matched.caseIndexes]});
 }
 return {schemaVersion:1,caseCount:snapshot.caseArchive.cases.length,measurementCount:measurementArchive.measurements.length,verified:true,verification:'recomputed-from-saved-results',physicalAccuracyVerified:false,matches};
}
