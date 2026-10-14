import {inspectProjectInput} from './project-input-inspection.js';
import {createBuiltinProjectOperations} from './builtin-project-operations.js';
import {getProjectRevision,applyProjectOperations} from './project-operations.js';
import {canonicalJson} from './project-revision.js';

import {browserMethods} from './browser-operation-names.js';
export {browserMethods} from './browser-operation-names.js';
import {getAnalysisFailure} from './analysis-failure.js';
import {previewProjectOperations} from './project-edit-preview.js';

// Invoke only named semantic operations. No arbitrary window method or code path.
export function createBrowserSession({studio,analysis,view,resultView,cases,exports,namedViews,caseArchives,assessments,cadUpdates,builtinProjects,prints,printTransfers,caseBundles,caseBundleTransfers,measurements,inputImports,fluidDomains,caseSources,getResult,probe,showResult,isBusy=()=>false}) {
 const ownedInputTransfers=new Set(),ownedBundleTransfers=new Set(),ownedPrintTransfers=new Set(),ownedImports=new Set(),ownedExports=new Set(),owned=new Set(),requests=new Map();let editing=false,epoch=0;
 const executionBusy=()=>analysis?.isBusy?.()||[...owned].some(id=>{try{const job=analysis.getJob(id);return job.executionSettled===false||['queued','running','saving'].includes(job.state);}catch{return false;}});
 const busy=()=>isBusy()||executionBusy();
 const builtins=builtinProjects??(studio?createBuiltinProjectOperations({studio,isBusy:busy}):null);
 return {
  async call(method,args={},{expiresAt=Infinity}={}){
   const invocationEpoch=epoch;
   const valid=()=>epoch===invocationEpoch&&Date.now()<expiresAt;
   if(!valid())throw Error('Browser command expired');
   if(!Object.hasOwn(browserMethods,method))throw Error('Unknown browser method');
   if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Arguments must be an object');
   const project=()=>studio.exportProject();
   if(method==='inspect'){const snapshot=project(),revision=await getProjectRevision(snapshot);if(JSON.stringify(project())!==JSON.stringify(snapshot))throw Error('Project revision conflict');return {schemaVersion:1,revision,project:studio.getSummary(),liveBrowserMcp:true,methods:browserMethods,operationContracts:{schemaVersion:1,api:'getBrowserOperationContracts',mcp:'studio_browser_contracts'}};}
   if(method==='inspectInput'){
    const snapshot=project(),response=typeof studio.inspectInput==='function'?await studio.inspectInput(args):await inspectProjectInput(snapshot,args);
    if(!valid()||JSON.stringify(project())!==JSON.stringify(snapshot))throw Object.assign(Error('Project changed or command expired during input inspection'),{code:'INPUT_INSPECTION_STALE'});
    return response;
   }
   if(method==='inputImportBegin'){if(!inputImports)throw Error('Input import transfer unavailable');const result=await inputImports.beginImport(args,{guard:valid});if(!valid()){inputImports.release({transferId:result.transferId});throw Error('Input import command expired');}ownedInputTransfers.add(result.transferId);return result;}
   if(['inputImportWrite','inputImportCommit','inputImportRelease'].includes(method)){
    if(!inputImports)throw Error('Input import transfer unavailable');if(!ownedInputTransfers.has(args.transferId))throw Error('Input import transfer is not owned by this session');
    if(method==='inputImportWrite')return inputImports.write(args,{guard:valid});
    if(method==='inputImportRelease'){const response=inputImports.release(args,{guard:valid});ownedInputTransfers.delete(args.transferId);return response;}
    if(busy()||editing)throw Error('Input import unavailable or browser busy');editing=true;try{return await inputImports.commit(args,{guard:valid});}finally{editing=false;}
   }
   if(method==='geometry')return studio.inspectGeometrySummary(args);
   if(method==='inspectSurface')return studio.inspectSurfaceDiagnostics(args);
   if(method==='createBuiltinProject'){if(!builtins||editing||busy())throw Error('Browser is busy or project creation is unavailable');editing=true;try{return await builtins.create(args,{guard:valid});}finally{editing=false;}}
   if(method==='applyCaseSource'||method==='clearCaseSource'){if(!caseSources||editing||busy())throw Error('Case source operations unavailable or browser busy');editing=true;try{return await caseSources[method==='applyCaseSource'?'apply':'clear'](args,{guard:valid});}finally{editing=false;}}
   if(method==='prepareFluidDomain'||method==='applyFluidDomainMesh'){if(!fluidDomains||editing||busy())throw Error('Fluid domain operations unavailable or browser busy');editing=true;try{return await fluidDomains[method==='prepareFluidDomain'?'prepare':'applyMesh'](args,{guard:valid});}finally{editing=false;}}
   if(method==='preflight')return studio.preflight(args.options||{},args.context||{});
   if(method==='previewEdit'){
    const snapshot=project(),previewOptions={expectedRevision:args.expectedRevision,options:args.options,operation:args.operation,mode:args.mode},response=typeof studio.previewOperations==='function'?await studio.previewOperations(args.operations,previewOptions):await previewProjectOperations(snapshot,args.operations,{...previewOptions,target:'browser'});
    if(!valid()||JSON.stringify(project())!==JSON.stringify(snapshot))throw Object.assign(Error('Project changed or command expired during edit preview.'),{code:'EDIT_PREVIEW_STALE'});
    return response;
   }
   if(method==='edit'){
    if(editing||busy())throw Error('Browser is busy');editing=true;
    try{if(typeof args.expectedRevision!=='string')throw Error('expectedRevision is required');const snapshot=project();if(typeof studio.applyOperations==='function'){const applied=await studio.applyOperations(args.operations,{expectedRevision:args.expectedRevision,expectedResultingRevision:args.expectedResultingRevision},{guard:()=>valid()&&!busy()});return {schemaVersion:1,revision:applied.revision,summary:applied.summary,...(applied.normalization?{normalization:applied.normalization}:{})};}const output=await applyProjectOperations(snapshot,args.operations,{expectedRevision:args.expectedRevision,expectedResultingRevision:args.expectedResultingRevision});if(!valid()||JSON.stringify(project())!==JSON.stringify(snapshot)||busy())throw Error('Project changed, command expired or connection revoked');studio.loadProject(output.project);return {schemaVersion:1,revision:await getProjectRevision(project()),summary:studio.getSummary()};}finally{editing=false;}
   }
   if(method==='startJob'){if(typeof args.inputRevision!=='string'||typeof args.requestId!=='string'||!args.requestId.trim())throw Error('inputRevision and requestId are required');const fingerprint=canonicalJson(args),prior=requests.get(args.requestId);if(prior&&prior.fingerprint!==fingerprint)throw Error('requestId conflicts with previous browser request');if(editing||(!prior&&busy()))throw Error('Browser is busy');editing=true;try{const snapshot=project();if(await getProjectRevision(snapshot)!==args.inputRevision||JSON.stringify(project())!==JSON.stringify(snapshot)||!valid())throw Error('Project revision conflict or expired command');const job=analysis.startJob(args);owned.add(job.jobId);requests.set(args.requestId,{fingerprint,jobId:job.jobId});return job;}finally{editing=false;}}
   if(method==='listJobs')return analysis.listJobs(args);
   if(method==='jobStatus')return analysis.getJob(args.jobId);
   if(method==='jobEvents')return analysis.jobEvents(args.jobId,args);
   if(method==='jobArtifacts'){const {jobId,...query}=args;return analysis.listJobArtifacts(jobId,query);}
   if(method==='jobArtifact')return analysis.getJobArtifact(args.jobId,args.artifactId,{...(args.pageKind!==undefined?{pageKind:args.pageKind}:{}),point:args.point,offset:args.offset,limit:args.limit,...(args.bodyIndex!==undefined?{bodyIndex:args.bodyIndex}:{}),...(args.elementIndex!==undefined?{elementIndex:args.elementIndex}:{})});
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
   if(method==='startExport'){if(!exports||editing||executionBusy())throw Error('Export unavailable or browser busy');editing=true;try{const job=await exports.start(args,{guard:valid});ownedExports.add(job.jobId);return job;}finally{editing=false;}}
   if(method==='exportStatus')return exports.status(args);
   if(method==='exportArtifact')return exports.artifact(args);
   if(method==='cancelExport')return exports.cancel(args);
   if(method==='releaseExport'){const result=exports.release(args);ownedExports.delete(args.jobId);return result;}
   if(method==='namedViewList'||method==='namedViewExport'){if(!namedViews)throw Error('Named view API unavailable');return namedViews[method==='namedViewList'?'list':'export']();}
   if(method.startsWith('namedView')){const operations={namedViewSave:'save',namedViewApply:'apply',namedViewRemove:'remove',namedViewImport:'import'};if(!namedViews||busy()||editing)throw Error('Named views unavailable or browser busy');editing=true;try{return await namedViews[operations[method]](args,{guard:valid});}finally{editing=false;}}
   if(method==='measurementVerify'){if(!measurements?.verify)throw Error('Measurement verification unavailable');const response=await measurements.verify(args,{guard:valid});if(!valid())throw Error('Measurement command expired');return response;}
   if(['measurementList','measurementGet','measurementExport'].includes(method)){if(!measurements)throw Error('Measurement history unavailable');const operation={measurementList:'list',measurementGet:'get',measurementExport:'exportArchive'}[method],response=await measurements[operation](args);if(!valid())throw Error('Measurement command expired');return response;}
   if(['measurementSave','measurementRemove','measurementImport'].includes(method)){if(!measurements||busy()||editing)throw Error('Measurement history unavailable or browser busy');editing=true;try{return await measurements[{measurementSave:'save',measurementRemove:'remove',measurementImport:'importArchive'}[method]](args,{guard:valid});}finally{editing=false;}}
   if(method==='caseBundleList'){if(!caseBundles)throw Error('Case/view bundle unavailable');const result=await caseBundles.list();if(!valid())throw Error('Case/view bundle command expired');return result;}
   if(method==='caseBundleExport'||method==='caseBundleImport'){if(!caseBundleTransfers)throw Error('Case/view bundle transfer unavailable');const result=await caseBundleTransfers[method==='caseBundleExport'?'beginExport':'beginImport'](args,{guard:valid});if(!valid()){caseBundleTransfers.release({transferId:result.transferId});throw Error('Case/view bundle command expired');}ownedBundleTransfers.add(result.transferId);return result;}
   if(method==='caseBundleRead'){if(!caseBundleTransfers)throw Error('Case/view bundle transfer unavailable');return caseBundleTransfers.read(args);}
   if(method==='caseBundleWrite'){if(!caseBundleTransfers)throw Error('Case/view bundle transfer unavailable');return caseBundleTransfers.write(args,{guard:valid});}
   if(method==='caseBundleRelease'){if(!caseBundleTransfers)throw Error('Case/view bundle transfer unavailable');const result=caseBundleTransfers.release(args);ownedBundleTransfers.delete(args.transferId);return result;}
   if(method==='caseBundleCommit'){if(!caseBundleTransfers||busy()||editing)throw Error('Case/view bundle unavailable or browser busy');editing=true;try{return await caseBundleTransfers.commit(args,{guard:valid});}finally{editing=false;}}
   if(method==='caseArchiveExport'){if(!caseArchives)throw Error('Case archive transfer unavailable');return caseArchives.beginExport(args,{guard:valid});}
   if(method==='caseArchiveRead')return caseArchives.read(args);
   if(method==='caseArchiveRelease'){const result=caseArchives.release(args);ownedImports.delete(args.transferId);return result;}
   if(method==='caseArchiveImport'){if(!caseArchives)throw Error('Case archive transfer unavailable');const result=await caseArchives.beginImport(args,{guard:valid});if(!valid()){caseArchives.release({transferId:result.transferId});throw Error('Case archive command expired');}ownedImports.add(result.transferId);return result;}
   if(method==='caseArchiveWrite')return caseArchives.write(args,{guard:valid});
   if(method==='caseArchiveCommit'){if(!caseArchives||busy()||editing)throw Error('Case archive unavailable or browser busy');editing=true;try{return await caseArchives.commit(args,{guard:valid});}finally{editing=false;}}
   if(method==='getAssessment'){if(!assessments)throw Error('Assessment API unavailable');return assessments.get(args);}
   if(method==='evaluateAssessment'){if(!assessments||busy()||editing)throw Error('Assessment unavailable or browser busy');editing=true;try{return await assessments.evaluate(args,{guard:valid});}finally{editing=false;}}
   if(method==='printTransferExport'||method==='printTransferImport'){if(!printTransfers)throw Error('Print transfer API unavailable');const result=await printTransfers[method==='printTransferExport'?'beginExport':'beginImport'](args,{guard:valid});if(!valid()){printTransfers.release({transferId:result.transferId});throw Error('Print transfer command expired');}ownedPrintTransfers.add(result.transferId);return result;}
   if(method==='printTransferRead'){if(!printTransfers)throw Error('Print transfer API unavailable');return printTransfers.read(args);}
   if(method==='printTransferWrite'){if(!printTransfers)throw Error('Print transfer API unavailable');return printTransfers.write(args,{guard:valid});}
   if(method==='printTransferRelease'){if(!printTransfers)throw Error('Print transfer API unavailable');const result=printTransfers.release(args);ownedPrintTransfers.delete(args.transferId);return result;}
   if(method==='printTransferCommit'){if(!printTransfers||busy()||editing)throw Error('Print transfer unavailable or browser busy');editing=true;try{return await printTransfers.commit(args,{guard:valid});}finally{editing=false;}}
   if(method==='printInspect'||method==='getPrintData'){if(!prints)throw Error('Print API unavailable');const response=await prints[method==='printInspect'?'inspect':'get'](args);if(!valid())throw Error('Print command expired');return response;}
   if(method==='importPrint'||method==='setPrintView'){if(!prints||busy()||editing)throw Error('Print API unavailable or browser busy');editing=true;try{return await prints[method==='importPrint'?'import':'set'](args,{guard:valid});}finally{editing=false;}}
   if(method==='previewCadUpdate'){if(!cadUpdates||busy()||editing)throw Error('CAD update unavailable or browser busy');const response=await cadUpdates.preview(args);if(!valid())throw Error('CAD preview command expired');return response;}
   if(method==='applyCadUpdate'){if(!cadUpdates||busy()||editing)throw Error('CAD update unavailable or browser busy');editing=true;try{return await cadUpdates.apply(args,{guard:valid});}finally{editing=false;}}
   if(method==='caseList'){if(!cases)throw Error('Case API unavailable');return cases.list();}
   if(method.startsWith('case')){const names={caseView:'view',caseRestoreInput:'restoreInput',caseRename:'rename',caseRemove:'remove',caseSave:'saveCurrent'};if(!cases||busy()||editing)throw Error('Case API unavailable or browser busy');editing=true;try{return await cases[names[method]](args,{guard:valid});}finally{editing=false;}}
  },
  disconnect(){epoch++;for(const transferId of ownedInputTransfers){try{inputImports.release({transferId});}catch{/* released */}}ownedInputTransfers.clear();for(const transferId of ownedBundleTransfers){try{caseBundleTransfers.release({transferId});}catch{/* released */}}ownedBundleTransfers.clear();for(const transferId of ownedPrintTransfers){try{printTransfers.release({transferId});}catch{/* released */}}ownedPrintTransfers.clear();for(const transferId of ownedImports){try{caseArchives.release({transferId});}catch{/* released */}}ownedImports.clear();for(const jobId of ownedExports){try{exports.cancel({jobId});}catch{/* terminal or released */}}ownedExports.clear();for(const jobId of owned){try{analysis.cancelJob(jobId);}catch{/* terminal or released */}}owned.clear();requests.clear();}
 };
}

export function connectBrowserSession({endpoint,pairingToken,scopes,session,onState=()=>{},fetcher=fetch,intervalMs=750}) {
 const url=new URL(endpoint);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.search||url.hash)throw Error('Use an HTTP loopback endpoint');
 let stopped=false,token,sessionId,timer;const controller=new AbortController();
 async function request(path,body,pair=false,requestSignal=controller.signal){const r=await fetcher(url.origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+(pair?pairingToken:token),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:requestSignal,credentials:'omit',cache:'no-store'});if(!r.ok)throw Error(`Browser bridge refused (${r.status})`);return r.json();}
 async function poll(){if(stopped)return;try{const {commands}=await request('/poll');for(const command of commands){if(stopped)break;let reply={id:command.id};try{if(Date.now()>=command.expiresAt)throw Error('Browser command expired');if(!scopes.includes(browserMethods[command.method]))throw Error('Browser scope refused');reply.value=await session.call(command.method,command.args,{expiresAt:command.expiresAt});}catch(error){const failure=getAnalysisFailure(error);reply.error={message:error.message,code:error.code??failure?.code,...(failure?{failure}:{})};}if(!stopped)await request('/reply',reply);}if(!stopped)timer=setTimeout(poll,intervalMs);}catch(error){if(!stopped){stop();onState({state:'disconnected',message:error.message});}}}
 function stop(){if(stopped)return;stopped=true;clearTimeout(timer);session.disconnect();if(token)request('/disconnect',{},false,AbortSignal.timeout(2000)).catch(()=>{});controller.abort();onState({state:'disconnected'});}
 const ready=(async()=>{const paired=await request('/pair',{scopes},true);if(stopped)return;token=paired.token;sessionId=paired.sessionId;onState({state:'connected',sessionId,scopes});poll();return {sessionId,scopes};})();
 return {ready,stop};
}
