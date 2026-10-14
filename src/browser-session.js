import {getProjectRevision,applyProjectOperations} from './project-operations.js';
import {canonicalJson} from './project-revision.js';

export const browserMethods=Object.freeze({inspect:'inspect',geometry:'inspect',preflight:'inspect',jobStatus:'inspect',jobEvents:'inspect',probe:'inspect',edit:'edit',startJob:'analyze',cancelJob:'analyze',releaseJob:'analyze',showJob:'analyze',getView:'view',setView:'view'});

// Invoke only named semantic operations. No arbitrary window method or code path.
export function createBrowserSession({studio,analysis,view,getResult,probe,showResult,isBusy=()=>false}) {
 const owned=new Set(),requests=new Map();let editing=false,epoch=0;
 const busy=()=>isBusy()||[...owned].some(id=>{try{return ['queued','running','saving'].includes(analysis.getJob(id).state);}catch{return false;}});
 return {
  async call(method,args={}){
   const invocationEpoch=epoch;
   if(!Object.hasOwn(browserMethods,method))throw Error('Unknown browser method');
   if(!args||typeof args!=='object'||Array.isArray(args))throw Error('Arguments must be an object');
   const project=()=>studio.exportProject();
   if(method==='inspect'){const snapshot=project(),revision=await getProjectRevision(snapshot);if(JSON.stringify(project())!==JSON.stringify(snapshot))throw Error('Project revision conflict');return {schemaVersion:1,revision,project:studio.getSummary(),liveBrowserMcp:true,methods:browserMethods};}
   if(method==='geometry')return studio.inspectGeometrySummary(args);
   if(method==='preflight')return studio.preflight(args.options||{},args.context||{});
   if(method==='edit'){
    if(editing||busy())throw Error('Browser is busy');editing=true;
    try{if(typeof args.expectedRevision!=='string')throw Error('expectedRevision is required');const snapshot=project();const output=await applyProjectOperations(snapshot,args.operations,{expectedRevision:args.expectedRevision});if(epoch!==invocationEpoch||JSON.stringify(project())!==JSON.stringify(snapshot)||busy())throw Error('Project changed or connection revoked');studio.loadProject(output.project);return {schemaVersion:1,revision:await getProjectRevision(project()),summary:studio.getSummary()};}finally{editing=false;}
   }
   if(method==='startJob'){if(typeof args.inputRevision!=='string'||typeof args.requestId!=='string'||!args.requestId.trim())throw Error('inputRevision and requestId are required');const fingerprint=canonicalJson(args),prior=requests.get(args.requestId);if(prior&&prior.fingerprint!==fingerprint)throw Error('requestId conflicts with previous browser request');if(editing||(!prior&&busy()))throw Error('Browser is busy');const job=analysis.startJob(args);owned.add(job.jobId);requests.set(args.requestId,{fingerprint,jobId:job.jobId});return job;}
   if(method==='jobStatus')return analysis.getJob(args.jobId);
   if(method==='jobEvents')return analysis.jobEvents(args.jobId,args);
   if(method==='cancelJob')return analysis.cancelJob(args.jobId);
   if(method==='releaseJob'){const result=analysis.releaseJob(args.jobId);owned.delete(args.jobId);for(const [id,r]of requests)if(r.jobId===args.jobId)requests.delete(id);return result;}
   if(method==='showJob'){
    if(busy())throw Error('Browser is busy');const output=analysis.getJobResult(args.jobId);
    const snapshot=project();if(await getProjectRevision(snapshot)!==await getProjectRevision(output.input)||JSON.stringify(project())!==JSON.stringify(snapshot)||epoch!==invocationEpoch)throw Error('Project revision conflict or connection revoked; saved result is not current input');
    return showResult(output,args.name||'Agent result');
   }
   if(method==='probe'){const output=getResult();if(!output?.result)throw Error('No displayed result');return {...probe(output.mesh,output.result,args.point,args.options||{}),analysisAssessment:output.analysisAssessment};}
   if(method==='getView')return view.get();
   if(method==='setView'){view.set(args);return view.get();}
  },
  disconnect(){epoch++;for(const jobId of owned){try{analysis.cancelJob(jobId);}catch{/* terminal or released */}}owned.clear();requests.clear();}
 };
}

export function connectBrowserSession({endpoint,pairingToken,scopes,session,onState=()=>{},fetcher=fetch,intervalMs=750}) {
 const url=new URL(endpoint);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/'||url.search||url.hash)throw Error('Use an HTTP loopback endpoint');
 let stopped=false,token,sessionId,timer;const controller=new AbortController();
 async function request(path,body,pair=false){const r=await fetcher(url.origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+(pair?pairingToken:token),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,credentials:'omit',cache:'no-store'});if(!r.ok)throw Error(`Browser bridge refused (${r.status})`);return r.json();}
 async function poll(){if(stopped)return;try{const {commands}=await request('/poll');for(const command of commands){if(stopped)break;let reply={id:command.id};try{if(!scopes.includes(browserMethods[command.method]))throw Error('Browser scope refused');reply.value=await session.call(command.method,command.args);}catch(error){reply.error={message:error.message,code:error.code};}if(!stopped)await request('/reply',reply);}if(!stopped)timer=setTimeout(poll,intervalMs);}catch(error){if(!stopped){stop();onState({state:'disconnected',message:error.message});}}}
 function stop(){if(stopped)return;stopped=true;clearTimeout(timer);session.disconnect();if(token)request('/disconnect',{}).catch(()=>{}).finally(()=>controller.abort());else controller.abort();onState({state:'disconnected'});}
 const ready=(async()=>{const paired=await request('/pair',{scopes},true);if(stopped)return;token=paired.token;sessionId=paired.sessionId;onState({state:'connected',sessionId,scopes});poll();return {sessionId,scopes};})();
 return {ready,stop};
}
