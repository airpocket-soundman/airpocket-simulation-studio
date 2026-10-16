import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonViewApi} from '../src/comparison-view-api.js';
import {captureComparisonView} from '../src/comparison-view-settings.js';

const hash=n=>'sha256:'+String(n).repeat(64);
const settings=()=>({field:'temperature',deformScale:0,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40},timeSeconds:5,toleranceSeconds:0});
function harness({validateCapture}={}){
 let panel={indices:[0,1],settings:settings()},busy=false,listReads=0,onList=()=>{},onRead=()=>{},applies=0;
 const listing={archiveRevision:hash(9),cases:[{caseId:'a',revision:hash(1)},{caseId:'b',revision:hash(2)}]},outputs={};
 for(const row of listing.cases)outputs[row.revision]={result:{kind:'thermal',transient:true,snapshots:[{time:0,temperature:[20]},{time:5,temperature:[25]},{time:10,temperature:[30]}]}};
 const sources=[],cases={async list(){onList(++listReads);return structuredClone(listing);},async readSource(ref){await onRead(ref);const row=listing.cases.find(r=>r.caseId===ref.caseId&&r.revision===ref.expectedRevision);if(!row)throw Error('Stale source');const source={output:outputs[row.revision],assertCurrent(){if(!listing.cases.some(r=>r.caseId===ref.caseId&&r.revision===ref.expectedRevision))throw Error('Stale source');}};sources.push(source);return source;}};
 const api=createComparisonViewApi({cases,capture:()=>structuredClone(panel),validateCapture,apply:next=>{applies++;panel=structuredClone(next);},isBusy:()=>busy});
 return {api,listing,outputs,get panel(){return structuredClone(panel);},setPanel:p=>{panel=structuredClone(p);},get applies(){return applies;},onList:fn=>{onList=fn;listReads=0;},onRead:fn=>{onRead=fn;},busy:value=>busy=value,get archive(){return captureComparisonView({references:listing.cases.map(r=>({caseId:r.caseId,expectedRevision:r.revision})),...settings()},listing);}};
}

test('invalid raw panel has null archive and usable CAS revision for importing a valid preset',async()=>{
 const h=harness(),archive=h.archive;h.setPanel({indices:[0,0],settings:settings()});
 const invalid=await h.api.get();assert.equal(invalid.archive,null);assert.match(invalid.revision,/^sha256:/);assert.ok(invalid.reason);
 const response=await h.api.set({archive,expectedRevision:invalid.revision});
 assert.deepEqual(response.archive,archive);assert.deepEqual(h.panel,{indices:[0,1],settings:settings()});assert.equal(h.applies,1);
 assert.equal((await h.api.get()).revision,response.revision);
});

test('applicability validation rejects incomplete current panel capture but still permits a valid import',async()=>{
 const h=harness({validateCapture:state=>{if(state.settings.timeSeconds===undefined)throw Error('Enter shared physical time');}}),archive=h.archive;
 const settingsWithoutTime=settings();delete settingsWithoutTime.timeSeconds;delete settingsWithoutTime.toleranceSeconds;
 h.setPanel({indices:[0,1],settings:settingsWithoutTime});
 const current=await h.api.get();assert.equal(current.archive,null);assert.equal(current.reason,'Enter shared physical time');
 await h.api.set({archive,expectedRevision:current.revision});assert.equal(h.applies,1);assert.equal(h.panel.settings.timeSeconds,5);
});

test('reordered cases with new runtime IDs rebind by portable source hash using the actual core',async()=>{
 const h=harness(),archive=h.archive;
 h.listing.cases=[{caseId:'new-b',revision:hash(2)},{caseId:'new-a',revision:hash(1)}];
 const current=await h.api.get(),before=structuredClone(h.listing);
 const result=await h.api.set({archive,expectedRevision:current.revision});
 assert.deepEqual(h.panel.indices,[1,0]);assert.deepEqual(result.archive,archive);assert.deepEqual(h.listing,before);
});

test('stale commands busy state and invalid or revoked updates preserve panel and cases',async()=>{
 for(const mode of ['stale','busy','guard','nested','panel-race','source-race']){
  const h=harness(),archive=h.archive,current=await h.api.get(),before=h.panel,casesBefore=structuredClone(h.listing);let valid=true;
  if(mode==='busy')h.busy(true);
  if(mode==='guard')h.onRead(()=>{valid=false;});
  if(mode==='nested')h.onRead(()=>h.api.set({archive,expectedRevision:current.revision}));
  if(mode==='panel-race')h.onList(n=>{if(n===3)h.setPanel({...before,settings:{...settings(),deformScale:2}});});
  if(mode==='source-race')h.onRead(()=>{h.listing.cases[0].revision=hash(3);});
  await assert.rejects(h.api.set({archive,expectedRevision:mode==='stale'?hash(0):current.revision},{guard:()=>valid}));
  assert.equal(h.applies,0);
  if(mode!=='panel-race')assert.deepEqual(h.panel,before);
  if(mode!=='source-race')assert.deepEqual(h.listing,casesBefore);
 }
});

test('transient presets require physical time honor tolerance and refuse time-selected flux',async()=>{
 for(const mutate of [a=>{delete a.settings.timeSeconds;delete a.settings.toleranceSeconds;},a=>a.settings.timeSeconds=4,a=>a.settings.field='heatFlux',a=>a.settings.field='stress']){
  const h=harness(),archive=h.archive,before=h.panel,current=await h.api.get();mutate(archive);
  await assert.rejects(h.api.set({archive,expectedRevision:current.revision}));assert.deepEqual(h.panel,before);assert.equal(h.applies,0);
 }
 const h=harness(),archive=h.archive;archive.settings.timeSeconds=4;archive.settings.toleranceSeconds=1;
 await h.api.set({archive,expectedRevision:(await h.api.get()).revision});assert.equal(h.panel.settings.timeSeconds,4);
});

test('inspection detects panel changes and fresh source leases are checked before applying',async()=>{
 const h=harness();h.onList(n=>{if(n===2)h.setPanel({indices:[1,0],settings:settings()});});
 await assert.rejects(h.api.get(),/changed during inspection/);assert.equal(h.applies,0);
 const source=harness(),archive=source.archive,current=await source.api.get();
 source.onRead(ref=>{if(ref.caseId==='b')source.outputs[hash(2)].result.kind='elastic';});
 await assert.rejects(source.api.set({archive,expectedRevision:current.revision}),/unavailable/);assert.equal(source.applies,0);
});
