// Private result export handoff. Selection lifetimes are supplied by the existing
// result-selection-state owner; this module does not create another generation.
export function createResultExportPreparation({captureSelection,getAnalysis,isBusy,getResultView,getSetupView,getLanguage,preflight,render}={}){
 if([captureSelection,getAnalysis,isBusy,getResultView,getSetupView,getLanguage,preflight,render].some(fn=>typeof fn!=='function'))throw Error('Invalid result export preparation adapter');
 let preparing=null,prepared=null,rendering=null,disposed=false;
 const expired=()=>Error('Displayed result changed or export preparation expired');
 const assertAvailable=()=>{if(disposed)throw Error('Result export preparation is disposed');if(preparing||rendering)throw Error('Viewer is busy');};
 // Host callbacks can synchronously cancel, dispose or attempt another export.
 // Read their answers first, then inspect the operation's own cancellation flags.
 const assertCurrent=(token,checkBusy=true)=>{
  const selected=token.selected(),same=getAnalysis()===token.output,busy=checkBusy&&isBusy();
  if(disposed||token.cancelled||!selected||!same||busy)throw expired();
 };
 const cancel=()=>{
  prepared=null;
  if(preparing)preparing.cancelled=true;
  // Retain ownership until the renderer actually settles, even if it ignores abort.
  if(rendering){rendering.cancelled=true;rendering.controller.abort();}
 };
 return Object.freeze({
  async prepare(request){
   assertAvailable();prepared=null;
   const token={output:null,selected:null,cancelled:false};preparing=token;
   try{
    if(isBusy())throw Error('Viewer is busy');
    token.output=getAnalysis();token.selected=captureSelection();assertCurrent(token);
    if(request?.format==='gif'||request?.format==='png-sequence'||request?.format==='webm'&&request?.animation==='time')preflight(request);
    if(disposed||token.cancelled)throw expired();
    const view=await getResultView();
    assertCurrent(token);
    const snapshot={resultRevision:view.resultRevision,physicalRevision:view.physicalRevision,view:{result:{...view.state,...(token.output?.result?.kind==='thermal'&&view.physicalTimeSeconds!==undefined?{timeSeconds:view.physicalTimeSeconds}:{})},setup:getSetupView(),language:getLanguage()}};
    // Do not lend live view objects to the job or retain a caller-mutable snapshot.
    const detached=structuredClone(snapshot);
    assertCurrent(token);
    prepared={...token,resultRevision:view.resultRevision};return detached;
   }finally{if(preparing===token)preparing=null;}
  },
  async render(args){
   assertAvailable();const ready=prepared;prepared=null;
   const token={...ready,controller:new AbortController(),cancelled:false};rendering=token;
   const abort=()=>{token.cancelled=true;token.controller.abort();};
   let sourceSignal,subscribed=false;
   try{
    if(isBusy())throw Error('Viewer is busy');
    if(!ready||args?.expectedResultRevision!==ready.resultRevision)throw expired();
    assertCurrent(token);
    sourceSignal=args.signal;
    if(sourceSignal?.aborted)throw Error('Visual export cancelled');
    sourceSignal?.addEventListener('abort',abort,{once:true});subscribed=true;
    const renderArgs={...args,signal:token.controller.signal};
    if(disposed||token.cancelled)throw expired();
    const blob=await render(renderArgs);
    assertCurrent(token,false);
    return blob;
   }finally{try{if(subscribed)sourceSignal?.removeEventListener('abort',abort);}finally{if(rendering===token)rendering=null;}}
  },
  cancel,
  dispose(){if(disposed)return;disposed=true;cancel();},
  isBusy(){return preparing!==null||rendering!==null;}
 });
}
