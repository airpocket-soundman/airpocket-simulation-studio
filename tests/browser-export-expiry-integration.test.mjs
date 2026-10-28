import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {connectBrowserSession,createBrowserSession} from '../src/browser-session.js';
import {createBrowserPageLifecycle} from '../src/browser-page-lifecycle.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {createComparisonExportAdapter} from '../src/comparison-export-adapter.js';
import {recordComparisonVideo} from '../src/ui/comparison-video.js';
import {webmTestEnv} from './helpers/webm-test-env.mjs';

// These tests execute the production connector/session/jobs/adapter/recorder
// lifecycle. HTTP transport, MediaRecorder, canvas and visibility are synthetic;
// this is not an actual browser, codec, HTTPS pairing or real hidden-tab test.
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const encoded=new Uint8Array([0x1a,0x45,0xdf,0xa3,0x1f,0x43,0xb6,0x75,1]);
const revision='sha256:'+'a'.repeat(64);
const camera=()=>({position:[10,5,3],target:[0,1,3],up:[0,1,0],fov:40});

function transport(){
 const queue=[],replies=new Map(),pollWaiters=[];let waiting=null,sequence=0,polls=0,disconnects=0,expiredPolls=0;
 const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const drain=()=>{if(waiting&&queue.length){const current=waiting;waiting=null;current.resolve(response({commands:queue.splice(0)}));}};
 const fetcher=async(url,options)=>{
  assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
  const pathname=new URL(url).pathname;
  assert.equal(options.headers.Authorization,'Bearer '+(pathname==='/pair'?'synthetic-pairing':'synthetic-session-token'));
  if(pathname==='/pair')return response({token:'synthetic-session-token',sessionId:'synthetic-session'});
  if(pathname==='/disconnect'){disconnects++;return response({disconnected:true});}
  if(pathname==='/reply'){const reply=JSON.parse(options.body);const result=replies.get(reply.id);assert.ok(result);replies.delete(reply.id);result.resolve(reply);return response({ok:true});}
  assert.equal(pathname,'/poll');polls++;
  assert.equal(waiting,null,'only one HTTP poll is outstanding');
  const pending=deferred();waiting=pending;
  const abort=()=>{if(waiting===pending)waiting=null;pending.reject(new DOMException('Synthetic fetch aborted','AbortError'));};
  options.signal.addEventListener('abort',abort,{once:true});
  for(const resolve of pollWaiters.splice(0))resolve();drain();
  try{return await pending.promise;}finally{options.signal.removeEventListener('abort',abort);}
 };
 return {fetcher,async call(method,args){const id='command-'+(++sequence),reply=deferred();replies.set(id,reply);queue.push({id,method,args,expiresAt:Date.now()+60000});drain();return reply.promise;},
  waitForPoll(){return waiting?Promise.resolve():new Promise(resolve=>pollWaiters.push(resolve));},
  async expire(){await this.waitForPoll();const current=waiting;waiting=null;expiredPolls++;current.resolve(response({error:'synthetic-expired-session'},401));},
  get polls(){return polls;},get disconnects(){return disconnects;},get expiredPolls(){return expiredPolls;},get pending(){return waiting!==null;},get pendingReplies(){return replies.size;}};
}

function recordingHarness(language){
 const clock=webmTestEnv();clock.document.documentElement.lang=language;
 let nextFrame=0,recorder,trackStops=0,starts=0,frames=0,locked=false,locks=0,releases=0;
 const callbacks=new Map(),recorders=[];
 const canvas={width:1280,height:640,captureStream(){const track={readyState:'live',stop(){this.readyState='ended';trackStops++;},requestFrame(){}};return {getTracks:()=>[track],getVideoTracks:()=>[track]};}};
 class Recorder{
  static isTypeSupported(type){return type==='video/webm;codecs=vp8';}
  constructor(){this.state='inactive';recorder=this;recorders.push(this);}
  start(){this.state='recording';starts++;}
  requestData(){}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([encoded],{type:'video/webm;codecs=vp8'})});this.onstop?.();}
 }
 const env={...clock.env,MediaRecorder:Recorder,requestAnimationFrame:fn=>{const id=++nextFrame;callbacks.set(id,fn);return id;},cancelAnimationFrame:id=>callbacks.delete(id),flushWait:async()=>{}};
 const defaults={camera:camera(),deformScale:2,language},outputs=[{result:{kind:'thermal',temperature:[20]},fixture:'a'},{result:{kind:'thermal',temperature:[30]},fixture:'b'}];
 const adapter=createComparisonExportAdapter({
  cases:{readSource:async(ref,{guard})=>({caseId:ref.caseId,revision:ref.expectedRevision,name:ref.caseId,output:outputs[ref.caseId==='a'?0:1],assertCurrent(){assert.equal(guard(),true);}})},
  getDefaults:()=>defaults,isBusy:()=>locked,
  renderComparison:()=>{frames++;return {canvas,panels:[{timeSeconds:5},{timeSeconds:5}],colorRange:{minimum:20,maximum:30},unit:'degC'};},
  acquireHostLock(){assert.equal(locked,false);locked=true;locks++;return {assertOwned(){assert.equal(locked,true);},release(){assert.equal(locked,true);locked=false;releases++;}};},
  recordVideo:args=>recordComparisonVideo(args,env)
 });
 let jobNumber=0;const jobs=createVisualExportJobs({render:()=>new Blob(['synthetic-unowned'],{type:'image/png'}),prepareCompare:adapter.prepare,renderCompare:adapter.render,id:()=>`synthetic-job-${++jobNumber}`});
 return {clock,defaults,outputs,jobs,recorders,get recorder(){return recorder;},get trackStops(){return trackStops;},get starts(){return starts;},get locked(){return locked;},get locks(){return locks;},get releases(){return releases;},get pendingFrames(){return callbacks.size;},get frames(){return frames;},step(ms){clock.advance(ms);const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn();},show(){clock.document.hidden=false;clock.document.visibilityState='visible';clock.document.dispatchEvent(new Event('visibilitychange'));}};
}

for(const language of ['ja','en'])for(const visibility of ['visible','simulated-hidden'])test(`poll 401 disconnects recording and a fresh session recovers (${language}, ${visibility})`,{timeout:10000},async t=>{
 const h=recordingHarness(language),before=structuredClone({defaults:h.defaults,outputs:h.outputs}),lifecycle=createBrowserPageLifecycle({id:()=>`synthetic-page-${language}-${visibility}`});
 const sessions=[];
 function connect(){const wire=transport(),states=[],session=createBrowserSession({exports:h.jobs,lifecycle}),connection=connectBrowserSession({endpoint:'http://127.0.0.1:18499',pairingToken:'synthetic-pairing',scopes:['view','inspect'],session,fetcher:wire.fetcher,intervalMs:1,onState:value=>states.push(value)});sessions.push(connection);return {wire,states,session,connection};}
 t.after(()=>{for(const connection of sessions)connection.stop();h.jobs.cancelAll();});
 const request=requestId=>({requestId,references:[{caseId:'a',expectedRevision:revision},{caseId:'b',expectedRevision:revision}],field:'temperature',timeSeconds:5,format:'webm',animation:'orbit',seconds:1});
 // A completed artifact that was never owned by either session must survive disconnect.
 const unowned=await h.jobs.start({requestId:'unowned',expectedResultRevision:revision,format:'png',view:{field:'temperature'}});await h.jobs.waitForSettled(unowned);const unownedDigest=h.jobs.artifact(unowned).sha256;
 const first=connect();await first.connection.ready;
 const started=await first.wire.call('startCompareExport',request('first-recording'));assert.equal(started.error,undefined);const old=started.value;
 assert.equal(old.state,'running');assert.equal(h.locked,true);assert.equal(h.starts,1);h.step(250);
 assert.ok(h.jobs.status(old).progress.fraction>0);assert.ok(h.pendingFrames>0);
 if(visibility==='simulated-hidden'){
  h.clock.hide();await h.jobs.waitForSettled(old);const failed=h.jobs.status(old);assert.equal(failed.state,'failed');assert.equal(failed.errorCode,'WEBM_BACKGROUND_INTERRUPTED');assert.match(failed.error,language==='ja'?/背景/:/background/);
 }
 // Resolve a normal outstanding production /poll with a real HTTP 401 response;
 // no transport exception or export failure is injected into the application.
 await first.wire.expire();
 await h.jobs.waitForSettled(old);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(first.wire.expiredPolls,1);assert.ok(first.wire.polls>=2);assert.equal(first.wire.disconnects,1);assert.equal(first.wire.pending,false);assert.equal(first.wire.pendingReplies,0);
 assert.ok(first.states.some(s=>s.state==='disconnected'&&/401/.test(s.message??'')));
 assert.ok(lifecycle.snapshot().events.some(e=>e.kind==='transport-error'));assert.ok(lifecycle.snapshot().events.some(e=>e.kind==='disconnected'));
 assert.equal(h.jobs.status(old).state,visibility==='visible'?'cancelled':'failed');
 assert.throws(()=>h.jobs.artifact(old),/unavailable/);assert.equal(h.locked,false);assert.equal(h.releases,1);assert.equal(h.trackStops,1);assert.equal(h.pendingFrames,0);assert.equal(h.clock.timers,0);
 assert.equal(h.recorder.onstop,null);assert.equal(h.recorder.onerror,null);assert.equal(h.recorder.ondataavailable,null);
 assert.equal(h.jobs.status(unowned).state,'completed');assert.equal(h.jobs.artifact(unowned).sha256,unownedDigest);
 const oldPolls=first.wire.polls;first.connection.stop();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(first.wire.polls,oldPolls);
 h.show();
 const second=connect();await second.connection.ready;const refused=await second.wire.call('exportArtifact',old);assert.match(refused.error?.message??'',/unavailable/);assert.equal(refused.value,undefined);h.jobs.release(old);const recovered=await second.wire.call('startCompareExport',request('recovered-recording'));assert.equal(recovered.error,undefined);const next=recovered.value;assert.equal(next.state,'running');assert.equal(h.locked,true);
 h.step(250);h.step(750);await h.jobs.waitForSettled(next);
 const status=await second.wire.call('exportStatus',next);assert.equal(status.value.state,'completed');const page=await second.wire.call('exportArtifact',next);assert.equal(page.error,undefined);
 assert.deepEqual(Buffer.from(page.value.data,'base64'),Buffer.from(encoded));assert.equal(page.value.sha256,'sha256:'+createHash('sha256').update(encoded).digest('hex'));assert.equal(page.value.nextOffset,null);
 assert.equal(h.locked,false);assert.equal(h.locks,2);assert.equal(h.releases,2);assert.equal(h.trackStops,2);assert.equal(h.pendingFrames,0);assert.equal(h.clock.timers,0);assert.deepEqual({defaults:h.defaults,outputs:h.outputs},before);
 assert.equal(lifecycle.snapshot().connectionEpoch,2);second.connection.stop();await new Promise(resolve=>setImmediate(resolve));assert.equal(second.wire.pending,false);assert.equal(second.wire.pendingReplies,0);h.jobs.release(next);h.jobs.release(unowned);
});
