import {canonicalJson} from './project-revision.js';
import {validateComparisonSettings} from './comparison-view-settings.js';
const LIMIT=32*1024*1024,CHUNK=65536;
const abort=()=>Error('Comparison video cancelled');
const clone=value=>JSON.parse(canonicalJson(value));
const hash=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const mime=value=>typeof value==='string'&&/^video\/webm(?:;codecs=[a-z0-9., -]+)?$/i.test(value);

/** Host-only consumer of the shared export queue; it owns only its own transient job. */
export function createComparisonVideoController({cases,exports,id=()=>crypto.randomUUID(),poll=100,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(typeof cases?.list!=='function'||!['startCompare','status','artifact','cancel','release','waitForSettled'].every(key=>typeof exports?.[key]==='function')||typeof id!=='function'||!Number.isInteger(poll)||poll<1||poll>1000||typeof delay!=='function')throw TypeError('Invalid comparison video controller adapters');
 let active=null;
 const capabilities=({format='webm'}={})=>{const c=exports.capabilities?.()?.[format==='gif'?'comparisonGifExport':'comparisonWebmExport'];return c&&typeof c.supported==='boolean'?structuredClone(c):{supported:false,reason:'Comparison WebM availability is unavailable'};};
 const stop=work=>{work.cancelled=true;if(work.jobId&&!work.cancelRequest)work.cancelRequest=Promise.resolve().then(()=>exports.cancel({jobId:work.jobId}));return work.cancelRequest;};
 function start(raw,{seconds=2,format='webm',animation='orbit',startTimeSeconds,endTimeSeconds,onProgress=()=>{}}={}){
  if(active)return Promise.reject(Error('Comparison video is already active'));
  const work={cancelled:false,jobId:null,cancelRequest:null};active=work;let settled;work.settled=new Promise(resolve=>settled=resolve);
  const check=()=>{if(work.cancelled||active!==work)throw abort();};
  const run=async()=>{
   try{
    if(!['webm','gif'].includes(format))throw Error('Invalid comparison video format');
    const capture=clone(raw);
    if(!capture||typeof capture!=='object'||Array.isArray(capture)||Object.keys(capture).some(key=>!['indices','settings'].includes(key))||!Array.isArray(capture.indices)||capture.indices.length!==2||!capture.indices.every(i=>Number.isSafeInteger(i)&&i>=0)||capture.indices[0]===capture.indices[1])throw Error('Select two distinct comparison cases');
    if(!Number.isInteger(seconds)||seconds<1||seconds>15||typeof onProgress!=='function')throw Error('Invalid comparison video duration or progress callback');
    if(!['orbit','time','deformation'].includes(animation))throw Error('Invalid comparison video animation');
    if(animation==='time'&&(!Number.isFinite(startTimeSeconds)||!Number.isFinite(endTimeSeconds)||startTimeSeconds<0||endTimeSeconds<=startTimeSeconds))throw Error('Comparison time video requires an increasing physical time range');
    if(animation!=='time'&&(startTimeSeconds!==undefined||endTimeSeconds!==undefined))throw Error('Physical range is only valid for time video');
    const settings=validateComparisonSettings(animation==='time'?{...capture.settings,timeSeconds:startTimeSeconds}:capture.settings);if(animation==='time')delete settings.timeSeconds;
    if(animation==='deformation'&&(!['displacement','stress'].includes(settings.field)||!(settings.deformScale>0)||settings.timeSeconds!==undefined||settings.toleranceSeconds!==undefined))throw Error('Deformation video requires displacement/stress, positive visualization scale and no time settings');
    const listing=clone(await cases.list());check();
    if(!Array.isArray(listing.cases))throw Error('Invalid saved-case listing');
    const references=capture.indices.map(index=>{const row=listing.cases[index];if(!row||typeof row.caseId!=='string'||!row.caseId||!hash(row.revision))throw Error('Invalid comparison case reference');return {caseId:row.caseId,expectedRevision:row.revision};});
    if(references[0].caseId===references[1].caseId)throw Error('Select two distinct comparison cases');
    const current=clone(await cases.list());check();if(canonicalJson(current)!==canonicalJson(listing))throw Error('Saved cases changed while preparing comparison video');
    const requestId=id();if(typeof requestId!=='string'||!requestId||requestId.length>128)throw Error('Invalid comparison video request identity');
    const job=await exports.startCompare({requestId,references,...settings,format,animation,seconds,...(animation==='time'?{startTimeSeconds,endTimeSeconds}:{})},{guard:()=>!work.cancelled&&active===work});
    if(typeof job?.jobId!=='string'||!job.jobId)throw Error('Invalid comparison video job');work.jobId=job.jobId;if(work.cancelled)await stop(work);check();
    let state;const deadline=Date.now()+120000;
    for(;;){check();state=await exports.status({jobId:work.jobId});check();if(state?.jobId!==work.jobId)throw Error('Comparison video job identity changed');const fraction=state.progress?.fraction;if(Number.isFinite(fraction)&&fraction>=0&&fraction<=1)onProgress({fraction});check();if(state.state!=='running')break;if(Date.now()>=deadline)throw Error('Comparison video timed out');await delay(poll);}
    if(state.state==='cancelled')throw abort();if(state.state!=='completed')throw Error(state.error||'Comparison video export failed');
    const metadata=clone(state.artifact);
    if(!metadata||!(format==='gif'?metadata.mimeType==='image/gif':mime(metadata.mimeType))||!hash(metadata.sha256)||!Number.isSafeInteger(metadata.totalBytes)||metadata.totalBytes<1||metadata.totalBytes>LIMIT)throw Error('Invalid comparison video artifact metadata');
    const bytes=new Uint8Array(metadata.totalBytes);let offset=0;
    while(offset<bytes.length){check();const length=Math.min(CHUNK,bytes.length-offset),page=await exports.artifact({jobId:work.jobId,offset,length});check();if(page?.jobId!==work.jobId||page.offset!==offset||page.encoding!=='base64'||page.sha256!==metadata.sha256||page.totalBytes!==bytes.length||page.mimeType!==metadata.mimeType||typeof page.data!=='string'||page.data.length>87384)throw Error('Invalid comparison video artifact page');let decoded;try{decoded=atob(page.data);if(btoa(decoded)!==page.data)throw Error();}catch{throw Error('Invalid comparison video base64');}if(decoded.length!==length)throw Error('Invalid comparison video artifact page length');for(let i=0;i<decoded.length;i++)bytes[offset+i]=decoded.charCodeAt(i);offset+=decoded.length;if(page.nextOffset!==(offset<bytes.length?offset:null))throw Error('Invalid comparison video artifact offset');}
    const digest='sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');check();if(digest!==metadata.sha256)throw Error('Comparison video artifact SHA-256 mismatch');
    if(format==='gif'){if(bytes.length<14||new TextDecoder().decode(bytes.subarray(0,6))!=='GIF89a'||bytes.at(-1)!==59||(bytes[6]|bytes[7]<<8)!==640||(bytes[8]|bytes[9]<<8)!==320)throw Error('Invalid comparison GIF header');}
    else if(bytes.length<4||bytes[0]!==26||bytes[1]!==69||bytes[2]!==223||bytes[3]!==163)throw Error('Invalid comparison WebM header');
    return {blob:new Blob([bytes],{type:metadata.mimeType}),metadata};
   }finally{
    try{if(work.jobId){const state=await exports.status({jobId:work.jobId});if(state.state==='running')await stop(work);if(work.cancelRequest)await work.cancelRequest;await exports.waitForSettled({jobId:work.jobId});}}
    finally{try{if(work.jobId)await exports.release({jobId:work.jobId});}finally{if(active===work)active=null;settled();}}
   }
  };
  return run();
 }
 return Object.freeze({capabilities,start,cancel(){const work=active;if(!work)return Promise.resolve();stop(work)?.catch(()=>{});return work.settled;}});
}
