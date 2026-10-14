import {canonicalJson,getProjectRevision} from './project-revision.js';
import {prepareCaseView} from './case-view.js';

const error=(code,message)=>Object.assign(Error(message),{code});
/** Runtime-only identity adapter; the existing version-1 archive stays unchanged.
 * Own rename/remove preserve surviving IDs. Any externally observed store change
 * invalidates all IDs, including indistinguishable duplicate cases: list again.
 * Host view/loadProject callbacks must be synchronous and atomic on failure, as
 * this adapter cannot roll back arbitrary UI effects. They must not edit the store.
 * Mutations/restoration accept an internal second argument {guard}, checked at
 * entry, after asynchronous inspection and immediately before host/store effects.
 */
export function createCaseOperations({store,view,loadProject,getAnalysis,isBusy=()=>false,id=()=>globalThis.crypto.randomUUID()}={}){
 if(!store||!['export','import','compare'].every(key=>typeof store[key]==='function')||view!==undefined&&typeof view!=='function'||loadProject!==undefined&&typeof loadProject!=='function'||getAnalysis!==undefined&&typeof getAnalysis!=='function'||typeof isBusy!=='function'||typeof id!=='function')throw TypeError('Invalid case adapter');
 let signature,identities=[],active=false;
 const issued=new Set();
 function newId(){const value=id();if(typeof value!=='string'||!value||issued.has(value))throw error('CASE_ID_INVALID','Case identity must be unique within this adapter');issued.add(value);return value;}
 const current=()=>canonicalJson(store.export());
 const available=()=>{if(isBusy())throw error('CASE_HOST_BUSY','Stop the running calculation before changing cases or restoring inputs');};
 const guardCommand=guard=>{if(typeof guard!=='function')throw TypeError('Case command guard must be a function');if(!guard())throw error('CASE_COMMAND_EXPIRED','Case command expired or connection was revoked');};
 async function exclusive(action){if(active)throw error('CASE_OPERATION_BUSY','Another case operation is in progress');active=true;try{return await action();}finally{active=false;}}
 function unchanged(snapshot){if(current()!==snapshot.signature)throw error('CASE_REVISION_CONFLICT','Case collection changed; list cases again');}
 async function snapshot(){
  const archive=store.export(),serialized=canonicalJson(archive);
  if(archive?.version!==1||!Array.isArray(archive.cases))throw error('CASE_ARCHIVE_INVALID','Expected the existing version-1 case archive');
  const ids=signature===serialized?identities.slice():archive.cases.map(()=>newId());
  const revisions=await Promise.all(archive.cases.map(saved=>getProjectRevision(saved)));
  if(current()!==serialized)throw error('CASE_REVISION_CONFLICT','Case collection changed during inspection');
  signature=serialized;identities=ids;
  const comparison=store.compare();
  const cases=archive.cases.map((saved,index)=>{
   const assessment=saved.output.analysisAssessment;
   return {caseId:ids[index],revision:revisions[index],name:saved.name,kind:comparison[index].kind,metrics:structuredClone(comparison[index].metrics),...(assessment?{analysisAssessment:{mode:assessment.mode,provisional:assessment.provisional,completePreflight:assessment.completePreflight}}:{})};
  });
  return {archive,signature:serialized,ids,cases};
 }
 function resolve(snapshot,{caseId,expectedRevision}={}){
  if(typeof caseId!=='string'||typeof expectedRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expectedRevision))throw error('CASE_REFERENCE_INVALID','Supply caseId and expectedRevision from list');
  const index=snapshot.ids.indexOf(caseId);
  if(index<0)throw error('CASE_UNKNOWN','Unknown or expired case ID; list cases again');
  if(snapshot.cases[index].revision!==expectedRevision)throw error('CASE_REVISION_CONFLICT','Case content changed; list cases again');
  return index;
 }
 function invoke(callback,arg){
  if(!callback)throw error('CASE_OPERATION_UNAVAILABLE','The host does not support this case operation');
  const result=callback(arg);
  if(result&&typeof result.then==='function'){Promise.resolve(result).catch(()=>{});throw error('CASE_CALLBACK_ASYNC','Case host callbacks must be synchronous');}
 }
 return Object.freeze({
  list:()=>exclusive(async()=>({schemaVersion:1,cases:(await snapshot()).cases})),
  saveCurrent:({name,expectedResultRevision}={}, {guard=()=>true}={})=>exclusive(async()=>{
   guardCommand(guard);available();
   if(!getAnalysis||typeof store.add!=='function')throw error('CASE_OPERATION_UNAVAILABLE','The host does not support saving the current result');
   if(typeof name!=='string'||!name.trim()||name.length>100)throw error('CASE_NAME_INVALID','Case name must contain 1–100 characters');
   if(typeof expectedResultRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expectedResultRevision))throw error('CASE_REFERENCE_INVALID','Supply expectedResultRevision from the current result');
   const value=getAnalysis();if(!value?.result)throw error('CASE_RESULT_UNAVAILABLE','No current analysis result is available');
   // Match result-view-api's persisted-JSON revision, including dropped undefined
   // properties, but store the original normalized output rather than prepared view data.
   const output=JSON.parse(JSON.stringify(value)),serializedOutput=canonicalJson(output);
   prepareCaseView({name,output});guardCommand(guard);
   const state=await snapshot();guardCommand(guard);
   if(state.archive.cases.length>=8)throw error('CASE_LIMIT_REACHED','Maximum 8 cases');
   const resultRevision=await getProjectRevision(output);guardCommand(guard);
   if(resultRevision!==expectedResultRevision)throw error('CASE_RESULT_REVISION_CONFLICT','Current result revision differs from the expected revision');
   const saved={name,output},revision=await getProjectRevision(saved);guardCommand(guard);
   const archive=structuredClone(state.archive);archive.cases.push(saved);const serializedArchive=canonicalJson(archive),caseId=newId();
   unchanged(state);available();
   const latest=getAnalysis();if(!latest?.result||canonicalJson(JSON.parse(JSON.stringify(latest)))!==serializedOutput)throw error('CASE_RESULT_REVISION_CONFLICT','Displayed analysis changed while preparing the case');
   guardCommand(guard);store.add(name,output);signature=serializedArchive;identities=[...state.ids,caseId];
   const comparison=store.compare().at(-1),assessment=output.analysisAssessment;
   return {schemaVersion:1,caseId,revision,name,kind:comparison.kind,metrics:structuredClone(comparison.metrics),saved:true,...(assessment?{analysisAssessment:{mode:assessment.mode,provisional:assessment.provisional,completePreflight:assessment.completePreflight}}:{})};
  }),
  view:(reference,{guard=()=>true}={})=>exclusive(async()=>{guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,reference);prepareCaseView(state.archive.cases[index]);unchanged(state);available();guardCommand(guard);invoke(view,index);return {schemaVersion:1,...state.cases[index],displayed:true};}),
  restoreInput:(reference,{guard=()=>true}={})=>exclusive(async()=>{guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,reference),output=prepareCaseView(state.archive.cases[index]);unchanged(state);available();guardCommand(guard);invoke(loadProject,structuredClone(output.input));return {schemaVersion:1,...state.cases[index],inputRestored:true};}),
  remove:(reference,{guard=()=>true}={})=>exclusive(async()=>{guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,reference);const archive=structuredClone(state.archive);archive.cases.splice(index,1);const serialized=canonicalJson(archive);unchanged(state);available();guardCommand(guard);store.import(archive);signature=serialized;identities=state.ids.filter((_,i)=>i!==index);return {schemaVersion:1,caseId:state.ids[index],removed:true};}),
  rename:(request,{guard=()=>true}={})=>exclusive(async()=>{
   guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,request);
   if(typeof request.name!=='string'||!request.name.trim()||request.name.length>100)throw error('CASE_NAME_INVALID','Case name must contain 1–100 characters');
   const archive=structuredClone(state.archive);archive.cases[index].name=request.name;
   const revision=await getProjectRevision(archive.cases[index]),serialized=canonicalJson(archive);unchanged(state);available();guardCommand(guard);store.import(archive);signature=serialized;identities=state.ids;
   return {schemaVersion:1,...state.cases[index],name:request.name,revision,renamed:true};
  })
 });
}
