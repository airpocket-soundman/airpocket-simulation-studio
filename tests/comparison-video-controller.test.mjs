import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createComparisonVideoController} from '../src/comparison-video-controller.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
const rev='sha256:'+'a'.repeat(64),other='sha256:'+'b'.repeat(64),snapshot=()=>({schemaVersion:1,archiveRevision:rev,cases:[{caseId:'one',revision:rev},{caseId:'two',revision:other}]}),capture=()=>({indices:[0,1],settings:{field:'temperature',timeSeconds:5,toleranceSeconds:0,deformScale:1,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}}}),bytes=()=>{const b=new Uint8Array(70000);b.set([26,69,223,163]);return b;},blob=()=>new Blob([bytes()],{type:'video/webm;codecs=vp9'}),prepared=()=>({comparison:{field:'temperature',cases:[],panels:[]},view:{resolution:{width:1280,height:640}}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture({renderCompare=()=>blob(),list=async()=>snapshot(),prepareCompare=()=>prepared(),patch={}}={}){let released=0,admitted=0;const queue=createVisualExportJobs({render:()=>{},prepareCompare,renderCompare}),exports={...queue,capabilities:()=>({comparisonWebmExport:{supported:true,mimeType:'video/webm;codecs=vp9'}}),startCompare:(...args)=>{admitted++;return queue.startCompare(...args);},release:args=>{released++;return queue.release(args);},...patch},controller=createComparisonVideoController({cases:{list},exports,id:()=> 'controller-'+admitted,poll:1});return {controller,exports,queue,get released(){return released;},get admitted(){return admitted;}};}

test('controller resolves indices twice, reconstructs bounded pages and verifies WebM SHA before releasing job',async()=>{
 let received;const h=fixture({renderCompare:args=>{received=args;return blob();}}),input=capture(),promise=h.controller.start(input);input.settings.field='stress';const result=await promise;assert.equal(received.field,'temperature');assert.equal(received.seconds,2);assert.equal(received.format,'webm');assert.equal(received.animation,'orbit');assert.deepEqual(received.references,[{caseId:'one',expectedRevision:rev},{caseId:'two',expectedRevision:other}]);assert.equal(result.blob.type,'video/webm;codecs=vp9');assert.equal(result.blob.size,70000);assert.equal(result.metadata.sha256,'sha256:'+createHash('sha256').update(bytes()).digest('hex'));assert.equal(h.released,1);assert.equal(h.controller.capabilities().supported,true);
});

test('controller cancels only its running job and waits for renderer settlement before release and UI admission',async()=>{
 const finish=deferred(),entered=deferred();let signal;const h=fixture({renderCompare:args=>{signal=args.signal;entered.resolve();return finish.promise;}}),started=h.controller.start(capture());const rejected=assert.rejects(started,/cancelled/);await entered.promise;let done=false;const cancelling=h.controller.cancel().then(()=>done=true);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(signal.aborted,true);assert.equal(done,false);assert.equal(h.released,0);await assert.rejects(h.controller.start(capture()),/already active/);finish.resolve(blob());await cancelling;await rejected;assert.equal(done,true);assert.equal(h.released,1);await h.controller.cancel();assert.equal(h.released,1);
});

test('controller cancellation during source preparation or queued preparation leaves no orphan job',async()=>{
 const source=deferred();let calls=0;const h=fixture({list:()=>{calls++;return source.promise;}}),pending=h.controller.start(capture()),rejected=assert.rejects(pending,/cancelled/);let settled=false;const cancelled=h.controller.cancel().then(()=>settled=true);await Promise.resolve();assert.equal(settled,false);source.resolve(snapshot());await cancelled;await rejected;assert.equal(h.admitted,0);assert.equal(h.released,0);
 const preparing=deferred(),entered=deferred();let guard;const q=fixture({prepareCompare:(_request,options)=>{guard=options.guard;entered.resolve();return preparing.promise;}}),start=q.controller.start(capture()),failed=assert.rejects(start,/expired|cancelled/);await entered.promise;const stop=q.controller.cancel();assert.equal(guard(),false);preparing.resolve(prepared());await stop;await failed;assert.equal(q.released,0);
});

test('controller rejects changed sources and invalid capture before shared queue admission',async()=>{
 let count=0;const h=fixture({list:()=>{const list=snapshot();if(++count===2)list.cases[0].revision=other;return list;}});await assert.rejects(h.controller.start(capture()),/Saved cases changed/);assert.equal(h.admitted,0);
 const normal=fixture();for(const change of [c=>c.indices=[0,0],c=>c.indices=[-1,1],c=>c.indices=[0,99],c=>c.settings.camera.up=[0,0,0],c=>c.settings.field='unknown']){const c=capture();change(c);await assert.rejects(normal.controller.start(c));}await assert.rejects(normal.controller.start(capture(),{seconds:16}));assert.equal(normal.admitted,0);
});

test('controller discards tampered metadata, offsets, base64 and hashes and always releases',async()=>{
 for(const corrupt of [page=>({...page,offset:9}),page=>({...page,nextOffset:0}),page=>({...page,data:'!!!!'}),page=>({...page,data:'AAAA'}),page=>({...page,data:page.data.slice(0,-4)+'AAAA'})]){const h=fixture(),original=h.exports.artifact;h.exports.artifact=args=>corrupt(original(args));await assert.rejects(h.controller.start(capture()),/artifact|base64|SHA-256/);assert.equal(h.released,1);}
 const h=fixture(),status=h.exports.status;h.exports.status=args=>{const value=status(args);if(value.artifact)value.artifact.totalBytes=32*1024*1024+1;return value;};await assert.rejects(h.controller.start(capture()),/metadata/);assert.equal(h.released,1);
});
