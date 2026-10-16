import {canonicalJson,getProjectRevision} from './project-revision.js';
import {createCaseStore} from './cases.js';
import {prepareCaseView} from './case-view.js';
import {validateNamedViewArchive} from './named-result-views.js';
import {validateResultViewSettings} from './result-view-api.js';
import {verifyMeasurementArchive} from './measurement-verification.js';
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===allowed.length&&allowed.every(key=>Object.hasOwn(value,key));
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
export async function validateCaseViewBundle(input){
 const serialized=canonicalJson(input);if(new TextEncoder().encode(serialized).length>100000000)throw Error('Case view bundle exceeds 100 MB');const archive=JSON.parse(serialized),fields=archive?.version===2?['version','kind','caseArchive','namedViewArchive','measurementArchive']:['version','kind','caseArchive','namedViewArchive'];
 if(!keys(archive,fields)||![1,2].includes(archive.version)||archive.kind!=='case-view-bundle'||!keys(archive.caseArchive,['version','cases']))throw Error('Invalid case view bundle');
 const store=createCaseStore();store.import(archive.caseArchive);const named=validateNamedViewArchive(archive.namedViewArchive),outputs=new Map();
 // Match the actual restored viewer output, including recomputed mesh metadata.
 for(let i=0;i<store.count();i++){const displayed=prepareCaseView(store.at(i));outputs.set(await getProjectRevision(JSON.parse(JSON.stringify(displayed))),displayed);}
 for(const view of named.views){const output=outputs.get(view.resultRevision);if(!output)throw Error('Named view has no matching saved result');if(view.setup.meshCount!==output.input.meshes.length)throw Error('Named view setup mesh count conflict');validateResultViewSettings(view.result,output.result);}
 if(archive.version===2)await verifyMeasurementArchive({caseArchive:archive.caseArchive,measurementArchive:archive.measurementArchive});return archive;
}
export function createCaseViewBundle({store,namedViews,measurements,isBusy=()=>false}={}){
 if(!store||!['export','import'].every(method=>typeof store[method]==='function')||!namedViews||!['export','prepareArchiveReplacement','matchesArchive'].every(method=>typeof namedViews[method]==='function')||measurements!==undefined&&(!measurements||!['exportArchive','prepareArchiveReplacement','matchesArchive'].every(method=>typeof measurements[method]==='function')))throw TypeError('Invalid case view bundle adapters');let locked=false;
 const check=guard=>{if(isBusy()||typeof guard!=='function'||!guard())throw Error('Case view bundle busy or command expired');};
 const storeCanonical=()=>typeof store.inspect==='function'?store.inspect().canonical:canonicalJson(store.export());
 const unchanged=archive=>storeCanonical()===canonicalJson(archive.caseArchive)&&namedViews.matchesArchive(archive.namedViewArchive)&&(!measurements||measurements.matchesArchive(archive.measurementArchive));
 async function capture(){const caseArchive=store.export(),namedViewArchive=await namedViews.export(),archive=measurements?{version:2,kind:'case-view-bundle',caseArchive,namedViewArchive,measurementArchive:(await measurements.exportArchive()).archive}:{version:1,kind:'case-view-bundle',caseArchive,namedViewArchive},archiveRevision=await getProjectRevision(archive);if(!unchanged(archive))throw Error('Case view bundle revision conflict');return {archive,archiveRevision};}
 const metadata=value=>({schemaVersion:1,archiveRevision:value.archiveRevision,caseCount:value.archive.caseArchive.cases.length,viewCount:value.archive.namedViewArchive.views.length,...(value.archive.version===2?{measurementCount:value.archive.measurementArchive.measurements.length}:{})});
 return Object.freeze({
 async list(){return metadata(await capture());},
 async exportArchive(){const before=await capture(),archive=await validateCaseViewBundle(before.archive);if(!unchanged(before.archive))throw Error('Case view bundle revision conflict');return {archiveRevision:before.archiveRevision,archive};},
 async importArchive(args={}, {guard=()=>true}={}){if(locked)throw Error('Case view bundle operation in progress');check(guard);if(!keys(args,['archive','expectedArchiveRevision']))throw Error('Invalid case view bundle import');args=JSON.parse(canonicalJson(args));if(!revision(args.expectedArchiveRevision))throw Error('Expected case view bundle revision is required');locked=true;
  try{const before=await capture();if(before.archiveRevision!==args.expectedArchiveRevision)throw Error('Case view bundle revision conflict');const next=await validateCaseViewBundle(args.archive);if(next.version===2&&!measurements)throw Error('Case view bundle v2 requires measurement history support');
   // Explicit legacy-import rule: replace cases/views and clear measurement history.
   const effective=measurements&&next.version===1?{...next,version:2,measurementArchive:{version:1,measurements:[]}}:next,nextRevision=await getProjectRevision(effective),namedRevision=await getProjectRevision(before.archive.namedViewArchive);check(guard);
   const namedPlan=await namedViews.prepareArchiveReplacement({archive:next.namedViewArchive,expectedArchiveRevision:namedRevision},{guard}),measurementPlan=measurements?await measurements.prepareArchiveReplacement({archive:effective.measurementArchive,expectedArchiveRevision:await getProjectRevision(before.archive.measurementArchive)},{guard}):null;
   const response={...metadata({archive:effective,archiveRevision:nextRevision}),imported:true,...(measurements&&next.version===1?{measurementsCleared:true}:{})};
   const replaceCases=()=>{check(guard);if(!unchanged(before.archive))throw Error('Case view bundle revision conflict');store.import(next.caseArchive);};
   namedPlan.commit(()=>{if(measurementPlan)measurementPlan.commit(replaceCases);else replaceCases();});return response;
  }finally{locked=false;}
 }
 });
}
