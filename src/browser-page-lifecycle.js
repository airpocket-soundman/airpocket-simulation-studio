// Memory-only page identity. No credentials, endpoint, model data or persistent storage.
export function createBrowserPageLifecycle({id=()=>crypto.randomUUID()}={}){
 const pageInstanceId=id();if(typeof pageInstanceId!=='string'||!pageInstanceId||pageInstanceId.length>128)throw Error('Invalid page identity');
 let connectionEpoch=0,eventSequence=0;const events=[];
 const record=kind=>{if(!['created','connected','disconnected','pagehide','pageshow','hidden','visible','transport-error'].includes(kind))throw Error('Invalid lifecycle event');events.push({sequence:++eventSequence,kind,connectionEpoch});if(events.length>12)events.shift();};record('created');
 return {record,connected(){connectionEpoch++;record('connected');},snapshot(previous){
  if(previous!==undefined&&(!previous||typeof previous!=='object'||Array.isArray(previous)||Object.keys(previous).some(k=>!['pageInstanceId','connectionEpoch','inputRevision'].includes(k))||typeof previous.pageInstanceId!=='string'||!previous.pageInstanceId||previous.pageInstanceId.length>128||!Number.isSafeInteger(previous.connectionEpoch)||previous.connectionEpoch<0||previous.inputRevision!==undefined&&(typeof previous.inputRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(previous.inputRevision))))throw Error('Invalid previous page lifecycle');
  const relation=!previous?'unknown':previous.pageInstanceId!==pageInstanceId?'page-reset':previous.connectionEpoch===connectionEpoch?'same-connection':'same-page-reconnected';
  return {schemaVersion:1,pageInstanceId,connectionEpoch,eventSequence,events:events.map(e=>({...e})),relation,automaticReplay:false,recoverySteps:['Reconnect with explicitly selected scopes.','Inspect page identity and input revision; list analysis and export jobs before deciding whether anything remains.','Never automatically repeat a delivered or timed-out operation.','If the page changed, reload user-saved input/cases explicitly and start a new operation only after review.'],cause:'unconfirmed'};
 }};
}
let pageLifecycle;
export function defaultBrowserPageLifecycle(){return pageLifecycle??=createBrowserPageLifecycle();}

/** Low-entropy, self-reported UA token only. Never requests high-entropy version data. */
export function browserVersionMetadata(navigator=globalThis.navigator){
 const ua=typeof navigator?.userAgent==='string'?navigator.userAgent.slice(0,2048):'';
 for(const [name,pattern] of [['Edge',/Edg\/([0-9.]{1,32})/],['Chrome',/(?:Chrome|CriOS)\/([0-9.]{1,32})/],['Firefox',/Firefox\/([0-9.]{1,32})/],['Safari',/Version\/([0-9.]{1,32}).*Safari\//]]){
  const match=pattern.exec(ua);if(match)return {name,reportedVersion:match[1],precision:name==='Chrome'&&/^\d+\.0\.0\.0$/.test(match[1])?'reduced':'reported',fullVersionVerified:false,source:'navigator.userAgent'};
 }
 return {name:'unknown',reportedVersion:null,precision:'unavailable',fullVersionVerified:false,source:'navigator.userAgent'};
}
