import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createStdioClient} from '../../scripts/perf-browser.mjs';

// Prepared only. One explicitly gated export; no repeat, DOM injection or solver.
const runtimeSource=process.env.QA_RUNTIME_SOURCE,expectedLanguage='ja';
if(!/^[a-f0-9]{40}$/.test(runtimeSource??''))throw Error('Set the approved fixed runtime source SHA');
const declaration=execFileSync('git',['show',runtimeSource+':src/visual-export-jobs.js'],{encoding:'utf8'});
if(!declaration.includes('executionSettled:job.executionSettled===true'))throw Error('Runtime lacks the reviewed executionSettled contract');
const control=path.resolve('.qa/orbit-disconnect194b'),out=path.join(control,'out');
fs.mkdirSync(out,{recursive:true});
for(const name of ['private-pair.json','mutate-ready','export-ready'])if(fs.existsSync(path.join(control,name)))throw Error('Stale gate; operator must clear before launch: '+name);
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const save=(name,value)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const gate=async name=>{while(!fs.existsSync(path.join(control,name)))await sleep(100);};
save('driver-source',{runtimeSource,expectedLanguage,scope:'One foreground Japanese disconnect/reconnect condition only; no English/hidden matrix claim',driverHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),driverSha256:sha(fs.readFileSync(new URL(import.meta.url))),budget:{exports:1,animation:'orbit',seconds:15,watchdogMs:120000,maxArtifactBytes:33554432,solverRuns:0}});
let client,oldSession,freshSession,job,released=false;
const call=(session,method,args={})=>client.call('studio_browser_call',{sessionId:session.sessionId,method,args});
async function listing(){return (await client.call('studio_browser_sessions',{})).sessions;}
async function waitSession(exclude){const until=Date.now()+600000;for(;;){const sessions=await listing();if(sessions.length>1)throw Error('Unexpected competing sessions');const found=sessions.find(s=>s.sessionId!==exclude);if(found)return found;if(Date.now()>until)throw Error('Operator pairing window expired');await sleep(500);}}
function scopes(session,initial){for(const s of ['inspect','view'])assert.ok(session.scopes.includes(s));assert.ok(!session.scopes.includes('analyze'));assert.ok(!session.scopes.includes('edit'));}
const snap=async session=>({inspect:await call(session,'inspect'),cases:await call(session,'caseList'),compare:await call(session,'getCompareView'),result:await call(session,'getResultView'),view:await call(session,'getView')});
try{
 client=await createStdioClient({origin:'http://127.0.0.1:5188',spawnImpl:(...args)=>{const child=spawn(...args);save('owned-child',{pid:child.pid,runtimeSource});return child;},announce:info=>fs.writeFileSync(path.join(control,'private-pair.json'),JSON.stringify(info))});
 console.log('PRIVATE_PAIR_READY_NO_MUTATION');
 oldSession=await waitSession();scopes(oldSession,true);save('initial-session',{sessionId:oldSession.sessionId,scopes:oldSession.scopes});
 save('paired-metadata',{inspect:await call(oldSession,'inspect'),cases:await call(oldSession,'caseList'),capabilities:await call(oldSession,'exportCapabilities')});
 console.log('PAIRED_METADATA_WAIT_MUTATE');await gate('mutate-ready');
 const archivePath='docs/evidence/review51-real-archives/cases.json';
 const bytes=execFileSync('git',['show','1412075:'+archivePath],{maxBuffer:4*1024*1024}),archive=JSON.parse(bytes);
 const frozen=await call(oldSession,'caseArchiveExport');
 try{const parts=[];let offset=0;for(let p=0;p<64;p++){const response=await call(oldSession,'caseArchiveRead',{transferId:frozen.transferId,offset,length:65536});assert.equal(response.offset,offset);const b=Buffer.from(response.data,'base64');parts.push(b);offset+=b.length;if(response.nextOffset==null)break;assert.equal(response.nextOffset,offset);if(p===63)throw Error('Archive page cap');}const raw=Buffer.concat(parts);assert.equal(raw.length,frozen.totalBytes);assert.equal(sha(raw),frozen.sha256);assert.deepEqual(JSON.parse(raw),archive);fs.writeFileSync(path.join(out,'case-readback.json'),raw);save('case-readback-metadata',{sourcePath:archivePath,sourceBytes:bytes.length,sourceSha256:sha(bytes),...frozen});}finally{await call(oldSession,'caseArchiveRelease',{transferId:frozen.transferId});}
 const cases=await call(oldSession,'caseList');assert.equal(cases.cases.length,2);const references=cases.cases.map(c=>({caseId:c.caseId,expectedRevision:c.revision}));
 const camera={position:[61,41,84],target:[5,5,20],up:[0,1,0],fov:40};
 const prior=await call(oldSession,'getCompareView');
 assert.deepEqual(prior.archive,{kind:'comparison-view',version:1,sources:cases.cases.map(c=>({revision:c.revision})),settings:{field:'instantPressure',camera,deformScale:1,timeSeconds:0}},'Existing comparison setup differs; stop before requesting setup permission');
 save('setup-readonly',{archiveVerified:true,comparisonVerified:true,importCount:0,caseViewCount:0,setCompareViewCount:0});
 const capabilities=await call(oldSession,'exportCapabilities');save('capabilities',capabilities);assert.equal(capabilities.comparisonWebmExport.supported,true);
 const before=await snap(oldSession),request={requestId:'orbit-disconnect194b-'+Date.now(),references,format:'webm',animation:'orbit',seconds:15,field:'instantPressure',timeSeconds:0,deformScale:1,camera};save('ready-to-export',{before,request});
 console.log('READY_TO_EXPORT_WAIT_FOREGROUND');await gate('export-ready');
 const startedAt=Date.now();job=await call(oldSession,'startCompareExport',request);save('started',{job,startedAt});assert.equal(job.executionSettled,false);assert.equal(job.view.language,expectedLanguage);
 console.log('OWNED_ORBIT_STARTED_GUI_DISCONNECT_NOW');
 const polls=[];let oldUnavailable=false,missedWindow=null;
 while(Date.now()-startedAt<120000){
  let status;try{status=await call(oldSession,'exportStatus',{jobId:job.jobId});}
  catch(error){save('old-session-call-rejection',{message:error.message,code:error.code??null,receivedAt:Date.now()});assert.match(error.message,/Browser (session unavailable|disconnected|session expired)/i);oldUnavailable=true;break;}
  if(!missedWindow){polls.push({receivedAt:Date.now(),status});assert.ok(Buffer.byteLength(JSON.stringify(polls))<=2*1024*1024,'Status log byte cap');save('old-session-status-polls',polls);if(status.state==='completed')missedWindow='completed-before-disconnect';else if(!['running','cancelled'].includes(status.state))missedWindow='terminal-before-disconnect:'+status.state;if(status.state==='running'){assert.equal(status.executionSettled,false);if(status.progress?.fraction>0&&!fs.existsSync(path.join(out,'running-ready.json'))){save('running-ready',{receivedAt:Date.now(),status,meaning:'Positive running progress observed through formal MCP; root may now confirm GUI and disconnect immediately.'});console.log('POSITIVE_RUNNING_READY_GUI_DISCONNECT_NOW');}}if(missedWindow){save('missed-window',{reason:missedWindow,status});console.log('MISSED_WINDOW_NO_RETRY_WAIT_GUI_DISCONNECT');}}
  if(polls.length>=600)throw Error('Bounded old-session poll capacity reached');await sleep(200);
 }
 assert.equal(oldUnavailable,true,'Disconnect not observed within the active-export watchdog');
 const emptyDeadline=Date.now()+10000;let remaining;do{remaining=await listing();if(!remaining.some(s=>s.sessionId===oldSession.sessionId))break;await sleep(100);}while(Date.now()<emptyDeadline);assert.equal(remaining.length,0);save('after-first-disconnect-sessions',{sessions:remaining});
 let oldRejected;try{oldRejected={unexpected:await call(oldSession,'inspect')};}catch(error){oldRejected={rejected:true,message:error.message,code:error.code??null};}save('old-session-explicit-unavailable',oldRejected);assert.equal(oldRejected.rejected,true);assert.match(oldRejected.message,/Browser session unavailable/i);
 console.log('OLD_SESSION_UNAVAILABLE_WAIT_SAME_PAGE_FRESH_PAIR');
 freshSession=await waitSession(oldSession.sessionId);scopes(freshSession,false);save('fresh-session',{sessionId:freshSession.sessionId,scopes:freshSession.scopes});assert.notEqual(freshSession.sessionId,oldSession.sessionId);
 const freshPolls=[],settleDeadline=Date.now()+120000;let status;
 for(;;){status=await call(freshSession,'exportStatus',{jobId:job.jobId});freshPolls.push({receivedAt:Date.now(),status});save('fresh-session-old-job-status',freshPolls);if(status.executionSettled===true)break;if(Date.now()>settleDeadline)throw Error('Old export cleanup did not settle');await sleep(200);}
 let artifact;try{artifact={unexpected:await call(freshSession,'exportArtifact',{jobId:job.jobId,offset:0,length:1})};}catch(error){artifact={rejected:true,message:error.message,code:error.code??null};}save('fresh-session-artifact-result',artifact);
 const after=await snap(freshSession);save('before-after-state',{before,after});for(const key of ['cases','compare','result','view'])assert.deepEqual(after[key],before[key]);const bi=structuredClone(before.inspect),ai=structuredClone(after.inspect);delete bi.lifecycle;delete ai.lifecycle;assert.deepEqual(ai,bi);assert.equal(after.inspect.lifecycle.pageInstanceId,before.inspect.lifecycle.pageInstanceId);assert.ok(after.inspect.lifecycle.connectionEpoch>before.inspect.lifecycle.connectionEpoch);assert.equal(after.inspect.lifecycle.ownedExportJobs,0);assert.equal(after.inspect.lifecycle.ownedAnalysisJobs,0);
 const accepted=missedWindow===null&&status.state==='cancelled'&&status.executionSettled===true&&artifact.rejected===true&&/artifact is unavailable/i.test(artifact.message);
 save('primary-result',{accepted,missedWindow,failureReason:accepted?null:status.state==='completed'?'completed-before-cancellation':'Required disconnect cancellation/settlement/artifact refusal was not established',oldSessionUnavailable:true,freshSessionCanReadOldJob:true,state:status.state,executionSettled:status.executionSettled,artifactUnavailable:artifact.rejected===true,refusalBasis:status.state==='cancelled'&&artifact.rejected===true?'Observed retained cancelled job artifact refusal; not a per-job ownership ACL':null,plannedRefusalBasis:'Retained cancelled job state, not a per-job ownership ACL; new sessions delegate status/artifact reads.',physicalFiveStateUnchanged:true,samePageInstance:true,controlsVerifiedByDriver:false,exportCount:1,solverRuns:0});
 await call(freshSession,'releaseExport',{jobId:job.jobId});released=true;let absent;try{absent={unexpected:await call(freshSession,'exportStatus',{jobId:job.jobId})};}catch(error){absent={rejected:true,message:error.message,code:error.code??null};}save('after-release-job-status',absent);assert.equal(absent.rejected,true);assert.match(absent.message,/Unknown visual export job/i);
 console.log(accepted?'RESTORATION_PRIMARY_PASS_WAIT_GUI_CONTROLS_AND_DISCONNECT':'PARTIAL_NO_RETRY_WAIT_GUI_CONTROLS_AND_DISCONNECT');
 while((await listing()).length)await sleep(500);save('cleanup',{sessions:[],ownedJobReleased:released,ownedTransfersReleased:true});
}catch(error){if(client&&job&&!released){try{const session=freshSession??oldSession;let state=await call(session,'exportStatus',{jobId:job.jobId});if(state.state==='running'){await call(session,'cancelExport',{jobId:job.jobId});const until=Date.now()+10000;do{state=await call(session,'exportStatus',{jobId:job.jobId});if(state.executionSettled===true)break;await sleep(200);}while(Date.now()<until);}if(state.executionSettled===true){await call(session,'releaseExport',{jobId:job.jobId});released=true;}save('failure-resource-cleanup',{released,state});}catch(cleanupError){save('failure-resource-cleanup',{released:false,message:cleanupError.message,meaning:'No new export/retry; retained job may need same-page cleanup after a separately authorized fresh connection.'});}}save('driver-failure',{message:error.message,stack:error.stack,exportCount:job?1:0});console.log('FAILED_NO_RETRY '+error.message);if(client){while((await listing()).length)await sleep(500);save('failure-final-sessions',{sessions:[]});}}
finally{if(client){const close=await client.close();save('child-close',close);}fs.rmSync(path.join(control,'private-pair.json'),{force:true});console.log('CHILD_CLOSED_PRIVATE_TOKEN_REMOVED');}
