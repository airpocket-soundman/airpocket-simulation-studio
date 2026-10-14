import {getProjectRevision,applyProjectOperations} from './project-operations.js';
import {canonicalJson} from './project-revision.js';

export const browserMethods=Object.freeze({inspect:'inspect',geometry:'inspect',preflight:'inspect',listJobs:'inspect',jobStatus:'inspect',jobEvents:'inspect',jobArtifact:'inspect',probe:'inspect',edit:'edit',startJob:'analyze',cancelJob:'analyze',releaseJob:'analyze',showJob:'analyze',getView:'view',setView:'view',getResultView:'inspect',setResultView:'view',caseList:'inspect',caseView:'edit',caseRestoreInput:'edit',caseRename:'edit',caseRemove:'edit',caseSave:'analyze',exportCapabilities:'inspect',startExport:'view',exportStatus:'inspect',exportArtifact:'inspect',cancelExport:'view',releaseExport:'view',namedViewList:'inspect',namedViewExport:'inspect',namedViewSave:'view',namedViewApply:'view',namedViewRemove:'view',namedViewImport:'view',caseArchiveExport:'inspect',caseArchiveRead:'inspect',caseArchiveImport:'edit',caseArchiveWrite:'edit',caseArchiveCommit:'edit',caseArchiveRelease:'inspect',getAssessment:'inspect',evaluateAssessment:'analyze',previewCadUpdate:'inspect',applyCadUpdate:'edit',printInspect:'inspect',importPrint:'edit',getPrintData:'inspect',setPrintView:'view'});

// Invoke only named semantic operations. No arbitrary window method or code path.
export function createBrowserSession({studio,analysis,view,resultView,cases,exports,namedViews,caseArchives,assessments,cadUpdates,prints,getResult,probe,showResult,isBusy=()=>false}) {
 const ownedImports=new Set(),ownedExports=new Set(),owned=new Set(),requests=new Map();let editing=false,epoch=0;
 const busy=()=>isBusy()||[...owned].some(id=>{try{return ['queued','running','saving'].includes(analysis.getJob(id).state);}catch{return false;}});
 return {
  async call(method,args={},{expiresAt=Infinity}={}){
   const invocationEpoch=epoch;
   const valid=()=>epoch===invocationEpoch&&Date.now()<expiresAt;
   if(!valid())throw Error('Browser command expired');
   if(!Object.hasOwn(browserMethods,method))throw Error('Unknown browser method');
   if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Arguments must be an object');
   const project=()=>studio.exportProject();
   if(method==='inspect'){const snapshot=project(),revision=await getProjectRevision(snapshot);if(JSON.stringify(project())!==JSON.stringify(snapshot))throw Error('Project revision conflict');return {schemaVersion:1,revision,project:studio.getSummary(),liveBrowserMcp:true,methods:browserMethods};}
   if(method==='geometry')return studio.inspectGeometrySummary(args);
   if(method==='preflight')return studio.preflight(args.options||{},args.context||{});
   if(method==='edit'){
    if(editing||busy())throw Error('Browser is busy');editing=true;
    try{if(typeof args.expectedRevision!=='string')throw Error('expectedRevision is required');const snapshot=project();const output=await applyProjectOperations(snapshot,args.operations,{expectedRevision:args.expectedRevision});if(!valid()||JSON.stringify(project())!==JSON.stringify(snapshot)||busy())throw Error('Project changed, command expired or connection revoked');studio.loadProject(output.project);return {schemaVersion:1,revision:await getProjectRevision(project()),summary:studio.getSummary()};}finally{editing=false;}
   }
   if(method==='startJob'){if(typeof args.inputRevision!=='string'||typeof args.requestId!=='string'||!args.requestId.trim())throw Error('inputRevision and requestId are required');const fingerprint=canonicalJson(args),prior=requests.get(args.requestId);if(prior&&prior.fingerprint!==fingerprint)throw Error('requestId conflicts with previous browser request');if(editing||(!prior&&busy()))throw Error('Browser is busy');editing=true;try{const snapshot=project();if(await getProjectRevision(snapshot)!==args.inputRevision||JSON.stringify(project())!==JSON.stringify(snapshot)||!valid())throw Error('Project revision conflict or expired command');const job=analysis.startJob(args);owned.add(job.jobId);requests.set(args.requestId,{fingerprint,jobId:job.jobId});return job;}finally{editing=false;}}
   if(method==='listJobs')return analysis.listJobs(args);
   if(method==='jobStatus')return analysis.getJob(args.jobId);
   if(method==='jobEvents')return analysis.jobEvents(args.jobId,args);
   if(method==='jobArtifact')return analysis.getJobArtifact(args.jobId,args.artifactId,{point:args.point,offset:args.offset,limit:args.limit});
   if(method==='cancelJob')return analysis.cancelJob(args.jobId);
   if(method==='releaseJob'){const result=analysis.releaseJob(args.jobId);owned.delete(args.jobId);for(const [id,r]of requests)if(r.jobId===args.jobId)requests.delete(id);return result;}
   if(method==='showJob'){
    if(busy()||editing)throw Error('Browser is busy');editing=true;try{const output=analysis.getJobResult(args.jobId);
    const snapshot=project();if(await getProjectRevision(snapshot)!==await getProjectRevision(output.input)||JSON.stringify(project())!==JSON.stringify(snapshot)||!valid())throw Error('Project revision conflict, expired command or connection revoked; saved result is not current input');
    if(busy())throw Error('Browser became busy before displaying the saved result');return showResult(output,args.name||'Agent result');}finally{editing=false;}
   }
   if(method==='probe'){if(resultView?.probe)return resultView.probe(args);const output=getResult();if(!output?.result)throw Error('No displayed result');return {...probe(output.mesh,output.result,args.point,args.options||{}),analysisAssessment:output.analysisAssessment};}
   if(method==='getView')return view.get();
   if(method==='setView'){if(busy()||editing)throw Error('Browser is busy');view.set(args);return view.get();}
   if(method==='getResultView'){if(!resultView)throw Error('Result view API unavailable');return resultView.get(args);}
   if(method==='setResultView'){if(!resultView||busy()||editing)throw Error('Result view unavailable or browser busy');return resultView.set(args,{guard:valid});}
   if(method==='exportCapabilities'){if(!exports)throw Error('Export API unavailable');return exports.capabilities();}
   if(method==='startExport'){if(!exports||editing||[...owned].some(id=>{try{return ['queued','running','saving'].includes(analysis.getJob(id).state);}catch{return false;}}))throw Error('Export unavailable or browser busy');editing=true;try{const job=await exports.start(args,{guard:valid});ownedExports.add(job.jobId);return job;}finally{editing=false;}}
   if(method==='exportStatus')return exports.status(args);
   if(method==='exportArtifact')return exports.artifact(args);
   if(method==='cancelExport')return exports.cancel(args);
   if(method==='releaseExport'){const result=exports.release(args);ownedExports.delete(args.jobId);return result;}
   if(method==='namedViewList'||method==='namedViewExport'){if(!namedViews)throw Error('Named view API unavailable');return namedViews[method==='namedViewList'?'list':'export']();}
   if(method.startsWith('namedView')){const operations={namedViewSave:'save',namedViewApply:'apply',namedViewRemove:'remove',namedViewImport:'import'};if(!namedViews||busy()||editing)throw Error('Named views unavailable or browser busy');editing=true;try{return await namedViews[operations[method]](args,{guard:valid});}finally{editing=false;}}
   if(method==='caseArchiveExport'){if(!caseArchives)throw Error('Case archive transfer unavailable');return caseArchives.beginExport(args,{guard:valid});}
   if(method==='caseArchiveRead')return caseArchives.read(args);
   if(method==='caseArchiveRelease'){const result=caseArchives.release(args);ownedImports.delete(args.transferId);return result;}
   if(method==='caseArchiveImport'){if(!caseArchives)throw Error('Case archive transfer unavailable');const result=await caseArchives.beginImport(args,{guard:valid});if(!valid()){caseArchives.release({transferId:result.transferId});throw Error('Case archive command expired');}ownedImports.add(result.transferId);return result;}
   if(method==='caseArchiveWrite')return caseArchives.write(args,{guard:valid});
   if(method==='caseArchiveCommit'){if(!caseArchives||busy()||editing)throw Error('Case archive unavailable or browser busy');editing=true;try{return await caseArchives.commit(args,{guard:valid});}finally{editing=false;}}
   if(method==='getAssessment'){if(!assessments)throw Error('Assessment API unavailable');return assessments.get(args);}
   if(method==='evaluateAssessment'){if(!assessments||busy()||editing)throw Error('Assessment unavailable or browser busy');editing=true;try{return await assessments.evaluate(args,{guard:valid});}finally{editing=false;}}
   if(method==='printInspect'||method==='getPrintData'){if(!prints)throw Error('Print API unavailable');const response=await prints[method==='printInspect'?'inspect':'get'](args);if(!valid())throw Error('Print command expired');return response;}
   if(method==='importPrint'||method==='setPrintView'){if(!prints||busy()||editing)throw Error('Print API unavailable or browser busy');editing=true;try{return await prints[method==='importPrint'?'import':'set'](args,{guard:valid});}finally{editing=false;}}
   if(method==='previewCadUpdate'){if(!cadUpdates||busy()||editing)throw Error('CAD update unavailable or browser busy');const response=await cadUpdates.preview(args);if(!valid())throw Error('CAD preview command expired');return response;}
   if(method==='applyCadUpdate'){if(!cadUpdates||busy()||editing)throw Error('CAD update unavailable or browser busy');editing=true;try{return await cadUpdates.apply(args,{guard:valid});}finally{editing=false;}}
   if(method==='caseList'){if(!cases)throw Error('Case API unavailable');return cases.list();}
   if(method.startsWith('case')){const names={caseView:'view',caseRestoreInput:'restoreInput',caseRename:'rename',caseRemove:'remove',caseSave:'saveCurrent'};if(!cases||busy()||editing)throw Error('Case API unavailable or browser busy');editing=true;try{return await cases[names[method]](args,{guard:valid});}finally{editing=false;}}
  },
  disconnect(){epoch++;for(const transferId of ownedImports){try{caseArchives.release({transferId});}catch{/* released */}}ownedImports.clear();for(const jobId of ownedExports){try{exports.cancel({jobId});}catch{/* terminal or released */}}ownedExports.clear();for(const jobId of owned){try{analysis.cancelJob(jobId);}catch{/* terminal or released */}}owned.clear();requests.clear();}
 };
}

export function connectBrowserSession({endpoint,pairingToken,scopes,session,onState=()=>{},fetcher=fetch,intervalMs=750}) {
 const url=new URL(endpoint);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.search||url.hash)throw Error('Use an HTTP loopback endpoint');
 let stopped=false,token,sessionId,timer;const controller=new AbortController();
 async function request(path,body,pair=false,requestSignal=controller.signal){const r=await fetcher(url.origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+(pair?pairingToken:token),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:requestSignal,credentials:'omit',cache:'no-store'});if(!r.ok)throw Error(`Browser bridge refused (${r.status})`);return r.json();}
 async function poll(){if(stopped)return;try{const {commands}=await request('/poll');for(const command of commands){if(stopped)break;let reply={id:command.id};try{if(Date.now()>=command.expiresAt)throw Error('Browser command expired');if(!scopes.includes(browserMethods[command.method]))throw Error('Browser scope refused');reply.value=await session.call(command.method,command.args,{expiresAt:command.expiresAt});}catch(error){reply.error={message:error.message,code:error.code};}if(!stopped)await request('/reply',reply);}if(!stopped)timer=setTimeout(poll,intervalMs);}catch(error){if(!stopped){stop();onState({state:'disconnected',message:error.message});}}}
 function stop(){if(stopped)return;stopped=true;clearTimeout(timer);session.disconnect();if(token)request('/disconnect',{},false,AbortSignal.timeout(2000)).catch(()=>{});controller.abort();onState({state:'disconnected'});}
 const ready=(async()=>{const paired=await request('/pair',{scopes},true);if(stopped)return;token=paired.token;sessionId=paired.sessionId;onState({state:'connected',sessionId,scopes});poll();return {sessionId,scopes};})();
 return {ready,stop};
}
