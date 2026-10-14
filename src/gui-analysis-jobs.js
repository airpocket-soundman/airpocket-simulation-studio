import {restoreAnalysisError} from './analysis-failure.js';
import {getProjectRevision,canonicalJson} from './project-revision.js';
const terminal=new Set(['succeeded','failed','cancelled','timed_out']);
// GUI presentation remains the caller's responsibility. This adapter registers the same
// immutable calculation as API callers and retains only its own recent job history.
export function createGuiAnalysisJobs({analysis,getProject,onJob=()=>{}}={}){
 const owned=[];let active=null;
 function notify(job){onJob(structuredClone(job));}
 function prune(){for(let i=owned.length-1;i>=0;i--){try{analysis.getJob(owned[i]);}catch(error){if(!/Unknown job/.test(error.message))throw error;owned.splice(i,1);}}while(owned.length>=8){const index=owned.findIndex(id=>analysis.getJob(id).releaseAllowed===true);if(index<0)throw Error('GUI job history is busy');analysis.releaseJob(owned[index]);owned.splice(index,1);}}
 return {
 async run({operation='solve',options={},includeFields=true}={}){
  if(!['solve','mesh'].includes(operation)||typeof includeFields!=='boolean')throw Error('Invalid GUI analysis request');if(active)throw Error('A GUI calculation is already running');
  const request={cancelled:false,jobId:null};active=request;
  try{
   const snapshot=structuredClone(getProject()),settings=structuredClone(options),serialized=canonicalJson(snapshot),inputRevision=await getProjectRevision(snapshot);
   if(request.cancelled)throw Error('Calculation cancelled');if(canonicalJson(getProject())!==serialized)throw Error('Inputs changed before calculation; run again');
   prune();const job=analysis.startJob({operation,options:settings,includeFields,inputRevision,origin:'gui'});request.jobId=job.jobId;owned.push(job.jobId);let previous=-1;
   for(;;){const state=analysis.getJob(job.jobId);if(state.lastSequence!==previous){notify(state);previous=state.lastSequence;}if(terminal.has(state.state)&&state.executionSettled===true){if(state.state!=='succeeded')throw restoreAnalysisError(state.error?.message??'Calculation '+state.state,state.error?.failure);if(canonicalJson(getProject())!==serialized)throw Error('Inputs changed during calculation; run again');return analysis.getJobResult(job.jobId);}await new Promise(resolve=>setTimeout(resolve,10));}
  }catch(error){if(request.jobId){try{const state=analysis.getJob(request.jobId);if(!terminal.has(state.state))analysis.cancelJob(request.jobId);}catch{/* The host may already have released the job. */}}throw error;
  }finally{if(active===request)active=null;}
 },
 cancel(){if(!active)return {cancelled:false};active.cancelled=true;return active.jobId?analysis.cancelJob(active.jobId):{cancelled:true,pending:true};},
 current(){return active?.jobId?analysis.getJob(active.jobId):null;}
 };
}
