import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResultExportPreparation} from '../src/result-export-preparation.js';
import {createResultSelectionState} from '../src/result-selection-state.js';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';

const revision='sha256:'+'a'.repeat(64),physical='sha256:'+'b'.repeat(64);
const view=()=>({resultRevision:revision,physicalRevision:physical,state:{field:'temperature',frameIndex:null,camera:{position:[1,2,3]}},physicalTimeSeconds:.123456789});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(options={}){
 const selection=createResultSelectionState(),a={result:{kind:'thermal'}},b={result:{kind:'thermal'}};
 let displayed=a,busy=false,preflights=0,renders=0,lastArgs;
 const setup={clipEnabled:false},current=view();
 const adapter=createResultExportPreparation({captureSelection:selection.capture,getAnalysis:()=>displayed,isBusy:()=>busy,getResultView:options.getResultView??(async()=>current),getSetupView:()=>setup,getLanguage:()=> 'en',preflight:()=>{preflights++;},render:args=>{renders++;lastArgs=args;return options.render?.(args)??new Blob(['synthetic-png'],{type:'image/png'});}});
 return {adapter,selection,a,b,current,setup,get preflights(){return preflights;},get renders(){return renders;},get lastArgs(){return lastArgs;},select(value){selection.invalidate();displayed=value;},setBusy(value){busy=value;}};
}
const args=()=>({requestId:'result-export',expectedResultRevision:revision,format:'png',view:{}});

test('synchronous host callback reentry cannot admit a second preparation',async()=>{
 for(const hook of ['isBusy','getAnalysis','captureSelection']){
  let adapter,nested,entered=false,views=0;const wait=deferred(),output={result:{kind:'thermal'}};
  const reenter=()=>{if(!entered){entered=true;nested=adapter.prepare(args());nested.catch(()=>{});}};
  adapter=createResultExportPreparation({captureSelection:()=>{if(hook==='captureSelection')reenter();return ()=>true;},getAnalysis:()=>{if(hook==='getAnalysis')reenter();return output;},isBusy:()=>{if(hook==='isBusy')reenter();return false;},getResultView:()=>{views++;return wait.promise;},getSetupView:()=>({}),getLanguage:()=> 'en',preflight:()=>{},render:()=>new Blob()});
  const pending=adapter.prepare(args());await assert.rejects(nested,/busy/);assert.equal(views,1);assert.equal(adapter.isBusy(),true);wait.resolve(view());await pending;assert.equal(adapter.isBusy(),false);
 }
});

test('synchronous cancellation or disposal during render checks cannot start the renderer',async()=>{
 for(const hook of ['selected','getAnalysis','isBusy'])for(const ending of ['cancel','dispose']){
  let adapter,handoff=false,renders=0;const output={result:{kind:'thermal'}},interrupt=()=>{if(handoff)adapter[ending]();};
  adapter=createResultExportPreparation({captureSelection:()=>()=>{if(hook==='selected')interrupt();return true;},getAnalysis:()=>{if(hook==='getAnalysis')interrupt();return output;},isBusy:()=>{if(hook==='isBusy')interrupt();return false;},getResultView:async()=>view(),getSetupView:()=>({}),getLanguage:()=> 'en',preflight:()=>{},render:()=>{renders++;return new Blob();}});
  await adapter.prepare(args());handoff=true;await assert.rejects(adapter.render(args()),/expired/);assert.equal(renders,0);assert.equal(adapter.isBusy(),false);
 }
});

test('synchronous preflight cancellation stops before asynchronous view inspection',async()=>{
 let adapter,views=0;adapter=createResultExportPreparation({captureSelection:()=>()=>true,getAnalysis:()=>null,isBusy:()=>false,getResultView:async()=>{views++;return view();},getSetupView:()=>({}),getLanguage:()=> 'en',preflight:()=>adapter.cancel(),render:()=>new Blob()});
 await assert.rejects(adapter.prepare({format:'png-sequence'}),/expired/);assert.equal(views,0);assert.equal(adapter.isBusy(),false);
});

test('bfcache-style pagehide invalidates pending preparation without permanently disposing the adapter',async()=>{
 const wait=deferred(),h=fixture({getResultView:()=>wait.promise}),pending=h.adapter.prepare(args());
 h.selection.invalidate();h.adapter.cancel();assert.equal(h.adapter.isBusy(),true);wait.resolve(view());await assert.rejects(pending,/expired/);
 // pageshow reuses the same adapter and selection owner, with a newly captured guard.
 await h.adapter.prepare(args());assert.equal(await (await h.adapter.render(args())).text(),'synthetic-png');assert.equal(h.adapter.isBusy(),false);
});

test('normal prepare preserves legacy thermal snapshot fields and detaches view/setup data',async()=>{
 const h=fixture(),snapshot=await h.adapter.prepare({format:'png-sequence'});
 assert.deepEqual(snapshot,{resultRevision:revision,physicalRevision:physical,view:{result:{...view().state,timeSeconds:view().physicalTimeSeconds},setup:{clipEnabled:false},language:'en'}});
 assert.equal(h.preflights,1);snapshot.view.setup.clipEnabled=true;snapshot.view.result.camera.position[0]=99;assert.equal(h.setup.clipEnabled,false);assert.equal(h.current.state.camera.position[0],1);
 const blob=await h.adapter.render(args());assert.equal(await blob.text(),'synthetic-png');assert.equal(h.renders,1);assert.equal(h.adapter.isBusy(),false);
 await assert.rejects(h.adapter.render(args()),/expired/);
});

test('A to B to identical A during preparation or between preparation/render cannot reuse an old handoff',async()=>{
 const wait=deferred(),h=fixture({getResultView:()=>wait.promise}),pending=h.adapter.prepare(args());h.select(h.b);h.select(h.a);wait.resolve(view());
 await assert.rejects(pending,/changed|expired/);assert.equal(h.renders,0);assert.equal(h.adapter.isBusy(),false);
 const fresh=fixture();await fresh.adapter.prepare(args());fresh.select(fresh.b);fresh.select(fresh.a);await assert.rejects(fresh.adapter.render(args()),/expired/);assert.equal(fresh.renders,0);
});

test('cancelled preparation retains ownership until its await settles and discards the result',async()=>{
 const wait=deferred(),h=fixture({getResultView:()=>wait.promise}),pending=h.adapter.prepare(args());h.adapter.cancel();
 assert.equal(h.adapter.isBusy(),true);await assert.rejects(h.adapter.prepare(args()),/busy/);wait.resolve(view());await assert.rejects(pending,/expired/);
 assert.equal(h.adapter.isBusy(),false);await h.adapter.prepare(args());assert.equal(h.renders,0);
});

test('render cancellation aborts its linked signal but never unlocks an unsettled renderer',async()=>{
 const wait=deferred(),h=fixture({render:()=>wait.promise}),source=new AbortController();await h.adapter.prepare(args());
 const pending=h.adapter.render({...args(),signal:source.signal});source.abort();assert.equal(h.lastArgs.signal.aborted,true);
 assert.equal(h.adapter.isBusy(),true);await assert.rejects(h.adapter.prepare(args()),/busy/);wait.resolve(new Blob(['late'],{type:'image/png'}));await assert.rejects(pending,/expired/);
 assert.equal(h.adapter.isBusy(),false);await h.adapter.prepare(args());
});

test('dispose is idempotent, aborts owned work and does not dispose the borrowed selection state',async()=>{
 const wait=deferred(),h=fixture({getResultView:()=>wait.promise}),selected=h.selection.capture(),pending=h.adapter.prepare(args());h.adapter.dispose();h.adapter.dispose();
 wait.resolve(view());await assert.rejects(pending,/expired/);await assert.rejects(h.adapter.prepare(args()),/disposed/);assert.equal(selected(),true);
 const renderWait=deferred(),running=fixture({render:()=>renderWait.promise});await running.adapter.prepare(args());const rendering=running.adapter.render(args());running.adapter.dispose();assert.equal(running.lastArgs.signal.aborted,true);renderWait.resolve(new Blob(['late'],{type:'image/png'}));await assert.rejects(rendering,/expired/);assert.equal(running.adapter.isBusy(),false);
});

test('preparation/render errors and busy/revision refusals release only their own operation',async()=>{
 const wait=deferred(),h=fixture({getResultView:()=>wait.promise}),pending=h.adapter.prepare(args());wait.reject(Error('inspection failed'));await assert.rejects(pending,/inspection failed/);assert.equal(h.adapter.isBusy(),false);
 const failed=fixture({render:()=>{throw Error('renderer failed');}});await failed.adapter.prepare(args());await assert.rejects(failed.adapter.render(args()),/renderer failed/);assert.equal(failed.adapter.isBusy(),false);
 const busy=fixture();busy.setBusy(true);await assert.rejects(busy.adapter.prepare(args()),/busy/);busy.setBusy(false);await busy.adapter.prepare(args());await assert.rejects(busy.adapter.render({...args(),expectedResultRevision:physical}),/expired/);assert.equal(busy.renders,0);
});

test('actual job service cancellation discards pending prepare and blocks new render until cancellation settles',async()=>{
 const wait=deferred(),h=fixture({getResultView:()=>wait.promise}),jobs=createVisualExportJobs({prepare:h.adapter.prepare,render:h.adapter.render});
 const pending=jobs.start(args());h.adapter.cancel();jobs.cancelAll();wait.resolve(view());await assert.rejects(pending,/expired/);assert.equal(h.renders,0);
 const renderWait=deferred(),running=fixture({render:()=>renderWait.promise}),service=createVisualExportJobs({prepare:running.adapter.prepare,render:running.adapter.render});
 const job=await service.start(args());service.cancel(job);await assert.rejects(service.start({...args(),requestId:'next'}),/already active/);
 assert.equal(running.lastArgs.signal.aborted,true);renderWait.resolve(new Blob(['late'],{type:'image/png'}));await service.waitForSettled(job);assert.equal(service.status(job).state,'cancelled');assert.throws(()=>service.artifact(job),/unavailable/);
 assert.equal(running.adapter.isBusy(),false);
 const next=await service.start({...args(),requestId:'next'});await service.waitForSettled(next);assert.equal(service.status(next).state,'completed');assert.equal(running.renders,2);
});

test('normal export bytes and job metadata remain identical to the former inline adapter',async()=>{
 const h=fixture(),legacy=createVisualExportJobs({id:()=> 'same-id',prepare:async()=>({resultRevision:revision,physicalRevision:physical,view:{result:{...view().state,timeSeconds:view().physicalTimeSeconds},setup:{clipEnabled:false},language:'en'}}),render:()=>new Blob(['synthetic-png'],{type:'image/png'})});
 const extracted=createVisualExportJobs({id:()=> 'same-id',prepare:h.adapter.prepare,render:h.adapter.render});
 const [a,b]=await Promise.all([legacy.start(args()),extracted.start(args())]);await Promise.all([legacy.waitForSettled(a),extracted.waitForSettled(b)]);
 assert.deepEqual(extracted.status(b),legacy.status(a));assert.deepEqual(extracted.artifact(b),legacy.artifact(a));
});
