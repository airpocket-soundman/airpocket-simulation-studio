// Private result export handoff. Selection lifetimes are supplied by the existing
// result-selection-state owner; this module does not create another generation.
export function createResultExportPreparation({captureSelection,getAnalysis,isBusy,getResultView,getSetupView,getLanguage,preflight,render}={}){
 if([captureSelection,getAnalysis,isBusy,getResultView,getSetupView,getLanguage,preflight,render].some(fn=>typeof fn!=='function'))throw Error('Invalid result export preparation adapter');
 let preparing=null,prepared=null,rendering=null,disposed=false;
 const expired=()=>Error('Displayed result changed or export preparation expired');
 const assertAvailable=()=>{if(disposed)throw Error('Result export preparation is disposed');if(preparing||rendering||isBusy())throw Error('Viewer is busy');};
 const cancel=()=>{
  prepared=null;
  if(preparing)preparing.cancelled=true;
  // Retain ownership until the renderer actually settles, even if it ignores abort.
  if(rendering){rendering.cancelled=true;rendering.controller.abort();}
 };
 return Object.freeze({
  async prepare(request){
   assertAvailable();prepared=null;
   const token={output:getAnalysis(),selected:captureSelection(),cancelled:false};preparing=token;
   try{
    if(!token.selected())throw expired();
    if(request?.format==='png-sequence')preflight(request);
    const view=await getResultView();
    if(disposed||token.cancelled||!token.selected()||getAnalysis()!==token.output||isBusy())throw expired();
    const snapshot={resultRevision:view.resultRevision,physicalRevision:view.physicalRevision,view:{result:{...view.state,...(token.output?.result?.kind==='thermal'&&view.physicalTimeSeconds!==undefined?{timeSeconds:view.physicalTimeSeconds}:{})},setup:getSetupView(),language:getLanguage()}};
    // Do not lend live view objects to the job or retain a caller-mutable snapshot.
    const detached=structuredClone(snapshot);
    if(disposed||token.cancelled||!token.selected()||getAnalysis()!==token.output||isBusy())throw expired();
    prepared={...token,resultRevision:view.resultRevision};return detached;
   }finally{if(preparing===token)preparing=null;}
  },
  async render(args){
   assertAvailable();const ready=prepared;prepared=null;
   if(!ready||!ready.selected()||getAnalysis()!==ready.output||args?.expectedResultRevision!==ready.resultRevision)throw expired();
   if(args.signal?.aborted)throw Error('Visual export cancelled');
   const token={...ready,controller:new AbortController(),cancelled:false};rendering=token;
   const abort=()=>{token.cancelled=true;token.controller.abort();};
   args.signal?.addEventListener('abort',abort,{once:true});
   try{
    const blob=await render({...args,signal:token.controller.signal});
    if(disposed||token.cancelled||!token.selected()||getAnalysis()!==token.output)throw expired();
    return blob;
   }finally{args.signal?.removeEventListener('abort',abort);if(rendering===token)rendering=null;}
  },
  cancel,
  dispose(){if(disposed)return;disposed=true;cancel();},
  isBusy(){return preparing!==null||rendering!==null;}
 });
}
