import {canonicalJson,getProjectRevision,hashCanonicalJson} from './project-revision.js';
import {prepareCaseView} from './case-view.js';
import {createCaseStore,CASE_STORE_MAX_RETAINED_BYTES} from './cases.js';
import {validateRuntimeIdentity} from './runtime-identity.js';

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
 // Canonical view of the store. A store from createCaseStore memoises per-case canonical strings (private immutable records),
 // so inspecting is O(1) for unchanged cases; any other store is exported and serialised as before.
 // The change-detection `signature` is the store's record-token list (or the canonical string for other stores): no archive-sized
 // string is retained between operations; the archive string is joined on demand only when its hash is not cached.
 let lastArchiveHash;
 const caseHashes=new WeakMap();
 function inspectStore(){
  if(typeof store.inspect==='function')return store.inspect();
  const archive=store.export(),memo=new Map(),canonical=canonicalJson(archive,new Set(),memo);
  if(archive?.version!==1||!Array.isArray(archive.cases))throw error('CASE_ARCHIVE_INVALID','Expected the existing version-1 case archive');
  return {key:canonical,canonical,archive,cases:archive.cases.map(saved=>({token:{},canonical:memo.get(saved)??canonicalJson(saved),name:saved.name,runtimeIdentity:saved.output.calculation?.runtimeIdentity,assessment:saved.output.analysisAssessment}))};
 }
 const sameKey=(a,b)=>Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((token,i)=>token===b[i]):a===b;
 const current=()=>inspectStore().key;
 const settle=predicted=>typeof store.inspect==='function'?current():predicted();
 const archiveHash=inspected=>{if(!lastArchiveHash||!sameKey(lastArchiveHash.key,inspected.key))lastArchiveHash={key:inspected.key,promise:hashCanonicalJson(inspected.canonical)};return lastArchiveHash.promise;};
 const budgetOf=()=>typeof store.maxRetainedBytes==='number'?store.maxRetainedBytes:undefined;
 const mib=bytes=>(bytes/1048576).toFixed(1)+' MiB';
 const caseHash=entry=>{let promise=caseHashes.get(entry.token);if(!promise){promise=hashCanonicalJson(entry.canonical);caseHashes.set(entry.token,promise);}return promise;};
 const joinArchive=canonicals=>'{"cases":['+canonicals.join(',')+'],"version":1}';
 const utf8Length=text=>{let n=text.length;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<0x80)continue;if(c<0x800)n+=1;else{n+=2;if(c>=0xd800&&c<=0xdbff&&(text.charCodeAt(i+1)&0xfc00)===0xdc00)i++;}}return n;};
 const available=()=>{if(isBusy())throw error('CASE_HOST_BUSY','Stop the running calculation before changing cases or restoring inputs');};
 const guardCommand=guard=>{if(typeof guard!=='function')throw TypeError('Case command guard must be a function');if(!guard())throw error('CASE_COMMAND_EXPIRED','Case command expired or connection was revoked');};
 async function exclusive(action){if(active)throw error('CASE_OPERATION_BUSY','Another case operation is in progress');active=true;try{return await action();}finally{active=false;}}
 function unchanged(snapshot){if(!sameKey(current(),snapshot.signature))throw error('CASE_REVISION_CONFLICT','Case collection changed; list cases again');}
 function rows(entries,ids,revisions,comparison){
  return entries.map((saved,index)=>{
   const assessment=saved.assessment,runtimeIdentity=validateRuntimeIdentity(saved.runtimeIdentity);
   return {caseId:ids[index],revision:revisions[index],name:saved.name,kind:comparison[index].kind,metrics:structuredClone(comparison[index].metrics),...(runtimeIdentity?{runtimeIdentity}:{}),...(assessment?{analysisAssessment:{mode:assessment.mode,provisional:assessment.provisional,completePreflight:assessment.completePreflight}}:{})};
  });
 }
 async function snapshot(){
  const inspected=inspectStore(),serialized=inspected.key;
  const ids=sameKey(signature,serialized)?identities.slice():inspected.cases.map(()=>newId());
  const [archiveRevision,...revisions]=await Promise.all([archiveHash(inspected),...inspected.cases.map(caseHash)]);
  if(!sameKey(current(),serialized))throw error('CASE_REVISION_CONFLICT','Case collection changed during inspection');
  signature=serialized;identities=ids;
  const comparison=store.compare();
  let archive=inspected.archive;
  const state={archiveRevision,signature:serialized,ids,canonicals:inspected.cases.map(entry=>entry.canonical),names:inspected.cases.map(entry=>entry.name),cases:rows(inspected.cases,ids,revisions,comparison),
   // The full archive (a deep clone of every case) is materialised only by operations that need it.
   get archive(){if(!archive){archive=store.export();if(archive?.version!==1||!Array.isArray(archive.cases))throw error('CASE_ARCHIVE_INVALID','Expected the existing version-1 case archive');}return archive;},
   caseAt:index=>typeof store.exportCase==='function'?store.exportCase(index):state.archive.cases[index]};
  return state;
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
  list:()=>exclusive(async()=>{const state=await snapshot();return {schemaVersion:1,archiveRevision:state.archiveRevision,cases:state.cases};}),
  // Host-only source lease. The assertion never crosses the browser/MCP wire.
  readSource:(reference,{guard=()=>true}={})=>exclusive(async()=>{
   guardCommand(guard);
   const request=JSON.parse(canonicalJson(reference));
   if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>!['caseId','expectedRevision'].includes(key)))throw error('CASE_REFERENCE_INVALID','Supply only caseId and expectedRevision');
   const state=await snapshot();guardCommand(guard);const index=resolve(state,request);
   const output=JSON.parse(JSON.stringify(prepareCaseView(state.caseAt(index))));
   const assertCurrent=()=>{guardCommand(guard);unchanged(state);if(!sameKey(signature,state.signature)||identities[index]!==state.ids[index])throw error('CASE_REVISION_CONFLICT','Case identity changed; list cases again');};
   assertCurrent();return {caseId:state.ids[index],revision:state.cases[index].revision,name:state.cases[index].name,output,assertCurrent};
  }),
  exportArchive:()=>exclusive(async()=>{const state=await snapshot();return {schemaVersion:1,archiveRevision:state.archiveRevision,archive:state.archive};}),
  // Wire-identical to JSON.stringify(exportArchive().archive); available when the store can stringify without cloning.
  ...(typeof store.exportJson==='function'?{exportArchiveJson:()=>exclusive(async()=>{const state=await snapshot(),json=store.exportJson();unchanged(state);return {schemaVersion:1,archiveRevision:state.archiveRevision,json};})}:{}),
  importArchive:({archive,expectedArchiveRevision}={}, {guard=()=>true}={})=>exclusive(async()=>{
   guardCommand(guard);available();
   if(typeof expectedArchiveRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expectedArchiveRevision))throw error('CASE_REFERENCE_INVALID','Supply expectedArchiveRevision from list');
   const initial=inspectStore();
   let serialized;
   try{serialized=canonicalJson(archive);}catch(cause){throw error('CASE_ARCHIVE_INVALID','Case archive must contain plain JSON data');}
   if(utf8Length(serialized)>100000000)throw error('CASE_ARCHIVE_TOO_LARGE','Case archive exceeds 100000000 UTF-8 bytes');
   const budget=budgetOf();
   if(budget!==undefined&&serialized.length>budget)throw error('CASE_MEMORY_BUDGET','Case memory budget exceeded: the archive holds '+mib(serialized.length)+' of serialized case data; the limit is '+mib(budget));
   const temporary=createCaseStore({maxRetainedBytes:budget??CASE_STORE_MAX_RETAINED_BYTES});
   try{temporary.importJson(serialized);serialized=undefined;for(let index=0;index<temporary.compare().length;index++)prepareCaseView(temporary.exportCase(index));}catch(cause){throw error(cause.code==='CASE_MEMORY_BUDGET'?'CASE_MEMORY_BUDGET':'CASE_ARCHIVE_INVALID',cause.message);}
   const next=temporary.inspect();
   // `initial` is already canonical JSON, so hashing it equals the revision of its parsed value.
   const [previousRevision,archiveRevision,...revisions]=await Promise.all([archiveHash(initial),archiveHash(next),...next.cases.map(caseHash)]);
   guardCommand(guard);
   if(previousRevision!==expectedArchiveRevision||!sameKey(current(),initial.key))throw error('CASE_REVISION_CONFLICT','Case collection changed; list cases again');
   // Prepare every fallible response component before the atomic store replacement.
   const ids=next.cases.map(()=>newId()),cases=rows(next.cases,ids,revisions,temporary.compare());
   const response={schemaVersion:1,archiveRevision,cases,imported:true};
   if(!sameKey(current(),initial.key))throw error('CASE_REVISION_CONFLICT','Case collection changed; list cases again');
   available();guardCommand(guard);
   // The temporary store already validated every case; hand its immutable entries over instead of validating and cloning again.
   if(typeof store.adopt==='function')store.adopt(temporary);else store.import(temporary.export());
   signature=settle(()=>next.canonical);identities=ids;
   return response;
  }),
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
   if(state.cases.length>=8)throw error('CASE_LIMIT_REACHED','Maximum 8 cases');
   const budget=budgetOf();
   if(budget!==undefined&&typeof store.retainedBytes==="function"){const retained=store.retainedBytes(),needed=retained+serializedOutput.length+32+name.length;if(needed>budget)throw error('CASE_MEMORY_BUDGET','Case memory budget exceeded: the store retains '+mib(retained)+' of serialized case data and this case adds about '+mib(serializedOutput.length)+'; the limit is '+mib(budget)+'. Remove a case first');}
   const resultRevision=await hashCanonicalJson(serializedOutput);guardCommand(guard);
   if(resultRevision!==expectedResultRevision)throw error('CASE_RESULT_REVISION_CONFLICT','Current result revision differs from the expected revision');
   // Same canonical string as canonicalJson({name,output}): keys sort as "name" < "output" and the output string is already canonical.
   const savedCanonical='{"name":'+JSON.stringify(name)+',"output":'+serializedOutput+'}',revision=await hashCanonicalJson(savedCanonical);guardCommand(guard);
   // The unchanged cases' canonical strings come from the snapshot; nothing is serialised again.
   const caseId=newId();
   unchanged(state);available();
   const latest=getAnalysis();if(!latest?.result||canonicalJson(JSON.parse(JSON.stringify(latest)))!==serializedOutput)throw error('CASE_RESULT_REVISION_CONFLICT','Displayed analysis changed while preparing the case');
   guardCommand(guard);store.add(name,output);signature=settle(()=>joinArchive([...state.canonicals,savedCanonical]));identities=[...state.ids,caseId];
   const comparison=store.compare().at(-1),assessment=output.analysisAssessment;
   return {schemaVersion:1,caseId,revision,name,kind:comparison.kind,metrics:structuredClone(comparison.metrics),saved:true,...(assessment?{analysisAssessment:{mode:assessment.mode,provisional:assessment.provisional,completePreflight:assessment.completePreflight}}:{})};
  }),
  view:(reference,{guard=()=>true}={})=>exclusive(async()=>{guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,reference);prepareCaseView(state.caseAt(index));unchanged(state);available();guardCommand(guard);invoke(view,index);return {schemaVersion:1,...state.cases[index],displayed:true};}),
  restoreInput:(reference,{guard=()=>true}={})=>exclusive(async()=>{guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,reference),output=prepareCaseView(state.caseAt(index));unchanged(state);available();guardCommand(guard);invoke(loadProject,structuredClone(output.input));return {schemaVersion:1,...state.cases[index],inputRestored:true};}),
  remove:(reference,{guard=()=>true}={})=>exclusive(async()=>{
   guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,reference);
   unchanged(state);available();guardCommand(guard);
   if(typeof store.remove==='function')store.remove(index);else store.import({...state.archive,cases:state.archive.cases.filter((_,i)=>i!==index)});
   signature=settle(()=>joinArchive(state.canonicals.filter((_,i)=>i!==index)));identities=state.ids.filter((_,i)=>i!==index);return {schemaVersion:1,caseId:state.ids[index],removed:true};
  }),
  rename:(request,{guard=()=>true}={})=>exclusive(async()=>{
   guardCommand(guard);available();const state=await snapshot();guardCommand(guard);const index=resolve(state,request);
   if(typeof request.name!=='string'||!request.name.trim()||request.name.length>100)throw error('CASE_NAME_INVALID','Case name must contain 1–100 characters');
   // The canonical case string starts with its name when the case has no keys sorting before "name"; then only that prefix changes.
   const oldPrefix='{"name":'+JSON.stringify(state.names[index])+',',direct=typeof store.rename==='function'&&state.canonicals[index].startsWith(oldPrefix);
   let revision,predicted;
   if(direct){const renamed='{"name":'+JSON.stringify(request.name)+','+state.canonicals[index].slice(oldPrefix.length);revision=await hashCanonicalJson(renamed);predicted=()=>joinArchive(state.canonicals.map((canonical,i)=>i===index?renamed:canonical));}
   else{const archive=structuredClone(state.archive);archive.cases[index].name=request.name;revision=await getProjectRevision(archive.cases[index]);predicted=()=>canonicalJson(archive);state.renamedArchive=archive;}
   unchanged(state);available();guardCommand(guard);
   if(direct)store.rename(index,request.name);else store.import(state.renamedArchive);
   signature=settle(predicted);identities=state.ids;
   return {schemaVersion:1,...state.cases[index],name:request.name,revision,renamed:true};
  })
 });
}
