import {canonicalJson,getProjectRevision} from './project-revision.js';
import {createCaseStore} from './cases.js';
import {prepareCaseView} from './case-view.js';
import {validateNamedViewArchive} from './named-result-views.js';
import {validateResultViewSettings} from './result-view-api.js';
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===allowed.length&&allowed.every(key=>Object.hasOwn(value,key));
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
export async function validateCaseViewBundle(input){
 const serialized=canonicalJson(input);if(new TextEncoder().encode(serialized).length>100000000)throw Error('Case view bundle exceeds 100 MB');const archive=JSON.parse(serialized);
 if(!keys(archive,['version','kind','caseArchive','namedViewArchive'])||archive.version!==1||archive.kind!=='case-view-bundle'||!keys(archive.caseArchive,['version','cases']))throw Error('Invalid case view bundle');
 const store=createCaseStore();store.import(archive.caseArchive);const named=validateNamedViewArchive(archive.namedViewArchive),outputs=new Map();
 // Match the actual restored viewer output, including recomputed mesh metadata.
 for(const saved of store.list()){const displayed=prepareCaseView(saved);outputs.set(await getProjectRevision(JSON.parse(JSON.stringify(displayed))),displayed);}
 for(const view of named.views){const output=outputs.get(view.resultRevision);if(!output)throw Error('Named view has no matching saved result');if(view.setup.meshCount!==output.input.meshes.length)throw Error('Named view setup mesh count conflict');validateResultViewSettings(view.result,output.result);}
 return archive;
}
export function createCaseViewBundle({store,namedViews,isBusy=()=>false}={}){
 if(!store||!['export','import'].every(method=>typeof store[method]==='function')||!namedViews||!['export','prepareArchiveReplacement'].every(method=>typeof namedViews[method]==='function'))throw TypeError('Invalid case view bundle adapters');let locked=false;
 const check=guard=>{if(isBusy()||typeof guard!=='function'||!guard())throw Error('Case view bundle busy or command expired');};
 async function capture(){const caseArchive=store.export(),namedViewArchive=await namedViews.export(),archive={version:1,kind:'case-view-bundle',caseArchive,namedViewArchive},archiveRevision=await getProjectRevision(archive);if(canonicalJson(store.export())!==canonicalJson(caseArchive)||canonicalJson(await namedViews.export())!==canonicalJson(namedViewArchive))throw Error('Case view bundle revision conflict');return {archive,archiveRevision};}
 const metadata=value=>({schemaVersion:1,archiveRevision:value.archiveRevision,caseCount:value.archive.caseArchive.cases.length,viewCount:value.archive.namedViewArchive.views.length});
 return Object.freeze({
 async list(){return metadata(await capture());},
 async exportArchive(){const before=await capture(),archive=await validateCaseViewBundle(before.archive),latest=await capture();if(latest.archiveRevision!==before.archiveRevision)throw Error('Case view bundle revision conflict');return {archiveRevision:before.archiveRevision,archive};},
 async importArchive({archive:input,expectedArchiveRevision}={},{guard=()=>true}={}){if(locked)throw Error('Case view bundle operation in progress');check(guard);if(!revision(expectedArchiveRevision))throw Error('Expected case view bundle revision is required');locked=true;
  try{const before=await capture();if(before.archiveRevision!==expectedArchiveRevision)throw Error('Case view bundle revision conflict');const next=await validateCaseViewBundle(input),nextRevision=await getProjectRevision(next),namedRevision=await getProjectRevision(before.archive.namedViewArchive);check(guard);
   const plan=await namedViews.prepareArchiveReplacement({archive:next.namedViewArchive,expectedArchiveRevision:namedRevision},{guard});const response={...metadata({archive:next,archiveRevision:nextRevision}),imported:true};
   plan.commit(()=>{check(guard);if(canonicalJson(store.export())!==canonicalJson(before.archive.caseArchive))throw Error('Case view bundle revision conflict');store.import(next.caseArchive);});return response;
  }finally{locked=false;}
 }
 });
}
