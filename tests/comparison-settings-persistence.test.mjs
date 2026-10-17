import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparisonSettingsPersistence} from '../src/comparison-settings-persistence.js';
import {resolveComparisonView} from '../src/comparison-view-settings.js';
import {createComparisonViewApi} from '../src/comparison-view-api.js';
const hash=n=>'sha256:'+String(n).repeat(64);
const archive=()=>({version:1,kind:'comparison-view',sources:[{revision:hash(1)},{revision:hash(2)}],settings:{field:'temperature',deformScale:0,camera:{position:[1,2,3],target:[0,0,0],up:[0,1,0],fov:40},timeSeconds:5}});
const deferred=()=>{let resolve;return {promise:new Promise(r=>{resolve=r;}),resolve:v=>resolve(v)};};
function harness(text=null){
 let stored=text,current=archive(),revision='current',sets=0,gets=0,fail=false,getHook=async()=>{},writeHook=async()=>{};
 const listing={cases:[{caseId:'new-right',revision:hash(2)},{caseId:'new-left',revision:hash(1)}]},writes=[],applied=[];
 const api={async get(){gets++;const result={revision,archive:structuredClone(current)};await getHook();return result;},async set(command,{guard}){if(!guard()||command.expectedRevision!==revision)throw Error('Settings changed');const resolved=resolveComparisonView(command.archive,listing);sets++;applied.push(resolved);}};
 const storage={async get(){return stored;},async set(value){await writeHook();if(fail)throw Error('Quota');stored=value;writes.push(value);}};
 const controller=createComparisonSettingsPersistence({api,storage});
 return {controller,storage,api,listing,writes,applied,get stored(){return stored;},get sets(){return sets;},get gets(){return gets;},setCurrent:value=>{current=value;revision+='x';},fail:()=>{fail=true;},getHook:fn=>{getHook=fn;},writeHook:fn=>{writeHook=fn;}};
}
test('explicit opt-in saves one portable preset; reload only offers a candidate, explicit restore rebinds cases',async()=>{
 const h=harness();await h.controller.load();await h.controller.saveCurrent();assert.equal(h.writes.length,0);
 await h.controller.setEnabled(true);await h.controller.saveCurrent();assert.equal(JSON.parse(h.stored).enabled,true);
 assert.deepEqual(JSON.parse(h.stored).archive,archive());
 const reloaded=harness(h.stored);await reloaded.controller.load();assert.equal(reloaded.sets,0);assert.equal(reloaded.gets,0);assert.equal(reloaded.controller.getState().hasCandidate,true);
 await reloaded.controller.restore();assert.deepEqual(reloaded.applied[0].references.map(r=>r.caseId),['new-left','new-right']);
 h.setCurrent(null);await h.controller.saveCurrent();assert.deepEqual(JSON.parse(h.stored).archive,archive());
});
test('invalid records and unavailable/mismatched cases never mutate the current panel',async()=>{
 for(const text of ['broken',JSON.stringify({version:2,enabled:true,archive:archive()}),'x'.repeat(131073)]){const h=harness(text);await h.controller.load();assert.equal(h.controller.getState().hasCandidate,false);assert.ok(h.controller.getState().error);assert.equal(h.sets,0);}
 for(const duplicate of [false,true]){const h=harness(JSON.stringify({version:1,enabled:true,archive:archive()}));await h.controller.load();if(duplicate)h.listing.cases.push({caseId:'other',revision:hash(1)});else h.listing.cases[1].revision=hash(3);await h.controller.restore();assert.ok(h.controller.getState().error);assert.equal(h.sets,0);assert.equal(h.controller.getState().hasCandidate,true);}
});
test('generation protects late load/restore and deletion is serialized after an already-running old write',async()=>{
 const h=harness(JSON.stringify({version:1,enabled:true,archive:archive()})),load=deferred();
 const slow=createComparisonSettingsPersistence({api:h.api,storage:{get:()=>load.promise,set:h.storage.set}});const loading=slow.load();await slow.remove();load.resolve(h.stored);await loading;assert.equal(slow.getState().hasCandidate,false);
 const r=harness(JSON.stringify({version:1,enabled:true,archive:archive()}));await r.controller.load();const get=deferred();r.getHook(()=>get.promise);const restoring=r.controller.restore();await r.controller.remove();get.resolve();await restoring;assert.equal(r.sets,0);assert.equal(r.controller.getState().hasCandidate,false);
 const pending=harness();await pending.controller.setEnabled(true);const write=deferred();let calls=0;pending.writeHook(()=>++calls===1?write.promise:Promise.resolve());const saving=pending.controller.saveCurrent();await Promise.resolve();await Promise.resolve();const removing=pending.controller.remove();write.resolve();await Promise.all([saving,removing]);assert.deepEqual(JSON.parse(pending.stored),{version:1,enabled:false,archive:null});
 const reload=harness(pending.stored);await reload.controller.load();assert.equal(reload.controller.getState().hasCandidate,false);
});
test('storage failure is nonfatal and disabling keeps a candidate but prevents further automatic writes',async()=>{
 const h=harness();await h.controller.setEnabled(true);await h.controller.saveCurrent();await h.controller.setEnabled(false);const count=h.writes.length;await h.controller.saveCurrent();assert.equal(h.writes.length,count);assert.equal(h.controller.getState().hasCandidate,true);
 h.fail();await h.controller.setEnabled(true);await h.controller.saveCurrent();assert.ok(h.controller.getState().error);assert.ok((await h.api.get()).archive);assert.equal(h.sets,0);
});

test('opting in before initial storage read finishes retains the unread valid candidate',async()=>{
 const stored=JSON.stringify({version:1,enabled:false,archive:archive()}),read=deferred(),writes=[];
 const controller=createComparisonSettingsPersistence({api:{get:async()=>({archive:null})},storage:{get:()=>read.promise,set:async text=>writes.push(text)}});
 const loading=controller.load(),enabling=controller.setEnabled(true);read.resolve(stored);await Promise.all([loading,enabling]);
 assert.equal(controller.getState().enabled,true);assert.equal(controller.getState().hasCandidate,true);assert.deepEqual(JSON.parse(writes.at(-1)).archive,archive());
});

test('real comparison API retains CAS and busy checks when user changes comparison or starts recording during restore',async()=>{
 for(const event of ['user-change','video-start']){
  let panel={indices:[0,1],settings:{...archive().settings,timeSeconds:10}},busy=false,applies=0;
  const listing={archiveRevision:hash(9),cases:[{caseId:'left',revision:hash(1)},{caseId:'right',revision:hash(2)}]};
  const api=createComparisonViewApi({capture:()=>structuredClone(panel),apply:next=>{applies++;panel=next;},isBusy:()=>busy,cases:{list:async()=>structuredClone(listing),async readSource(){if(event==='user-change')panel.settings.timeSeconds=0;else busy=true;return {output:{result:{kind:'thermal',transient:true,snapshots:[{time:0,temperature:[20]},{time:5,temperature:[25]}]}},assertCurrent(){}};}}});
  const controller=createComparisonSettingsPersistence({api,storage:{get:async()=>JSON.stringify({version:1,enabled:true,archive:archive()}),set:async()=>{}}});
  await controller.load();await controller.restore();assert.equal(applies,0);assert.ok(controller.getState().error);assert.equal(panel.settings.timeSeconds,event==='user-change'?0:10);
 }
});

test('repeat loading during deletion cannot resurrect a cached candidate; queued enable/delete choices finish in order',async()=>{
 const h=harness(JSON.stringify({version:1,enabled:true,archive:archive()}));await h.controller.load();const wait=deferred();h.writeHook(()=>wait.promise);
 const deleting=h.controller.remove();await h.controller.load();assert.equal(h.controller.getState().hasCandidate,false);wait.resolve();await deleting;
 h.writeHook(async()=>{});await Promise.all([h.controller.setEnabled(true),h.controller.setEnabled(false),h.controller.remove()]);
 assert.deepEqual(JSON.parse(h.stored),{version:1,enabled:false,archive:null});assert.equal(h.controller.getState().hasCandidate,false);
});
