import {canonicalJson,getProjectRevision} from './project-revision.js';
import {captureComparisonView,resolveComparisonView,validateComparisonViewSettings} from './comparison-view-settings.js';
import {inspectComparisonResult} from './comparison-result.js';
import {resolveSharedTime} from './view-compare-layout.js';

/** Portable panel configuration, never a physical-case or main-viewer mutation. */
export function createComparisonViewApi({cases,capture,apply,validateCapture=()=>{},isBusy=()=>false}){
 let writing=false;
 const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
 const hash=(state,listing)=>getProjectRevision({capture:state,caseArchiveRevision:listing.archiveRevision,caseReferences:listing.cases.map(({caseId,revision})=>({caseId,revision}))});
 async function snapshot(){
  const state=structuredClone(capture()),listing=await cases.list(),revision=await hash(state,listing),latest=await cases.list();
  if(!equal(state,capture())||!equal(listing,latest))throw Error('Comparison panel or cases changed during inspection');
  let archive=null,reason;
  try{validateCapture(state);const references=state.indices.map(i=>{const row=listing.cases[i];if(!row)throw Error('Choose two saved cases');return {caseId:row.caseId,expectedRevision:row.revision};});archive=captureComparisonView({references,...state.settings},listing);}catch(error){reason=error.message;}
  return {state,listing,response:{schemaVersion:1,revision,archive,...(reason?{reason}:{})}};
 }
 return Object.freeze({
  async get(){return (await snapshot()).response;},
  async set(args,{guard=()=>true}={}){
   if(writing)throw Error('Comparison settings operation in progress');
   const check=()=>{if(!guard())throw Error('Comparison settings command expired');if(isBusy())throw Error('Viewer is busy');};check();writing=true;
   try{
    if(!args||Object.keys(args).some(k=>!['archive','expectedRevision'].includes(k))||typeof args.expectedRevision!=='string')throw Error('Supply comparison archive and expectedRevision');
    const archive=validateComparisonViewSettings(args.archive),before=await snapshot();check();
    if(before.response.revision!==args.expectedRevision)throw Error('Comparison settings revision conflict');
    const request=resolveComparisonView(archive,before.listing),sources=[];
    for(const reference of request.references){sources.push(await cases.readSource(reference,{guard}));check();}
    const infos=sources.map(source=>inspectComparisonResult(source.output.result,request.field));
    if(infos.some(info=>!info.fields.includes(request.field)))throw Error('Field is unavailable for a comparison case');
    if(request.timeSeconds!==undefined&&sources.some(source=>source.output.result.kind==='thermal'&&request.field==='heatFlux'))throw Error('Thermal heat flux is final-step only');
    if(infos.some(info=>info.frameTimes)&&request.timeSeconds===undefined)throw Error('Comparison requires a shared physical time');
    if(request.timeSeconds!==undefined)resolveSharedTime(infos.map((info,i)=>({caseId:request.references[i].caseId,frameTimes:info.frameTimes})),request);
    const next={indices:request.references.map(ref=>before.listing.cases.findIndex(row=>row.caseId===ref.caseId)),settings:archive.settings},revision=await hash(next,before.listing);
    const latest=await snapshot();check();for(const source of sources)source.assertCurrent();
    if(latest.response.revision!==args.expectedRevision)throw Error('Comparison settings revision conflict');
    apply(structuredClone(next));
    return {schemaVersion:1,revision,archive:structuredClone(archive)};
   }finally{writing=false;}
  }
 });
}
