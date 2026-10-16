import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {getProjectRevision} from '../src/project-revision.js';
const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]}});
function setup(options={}){const store=createCaseStore();store.add('A',output());store.add('B',output());let sequence=0;return {store,api:createCaseOperations({store,id:()=>String(++sequence),...options})};}
const reference=row=>({caseId:row.caseId,expectedRevision:row.revision});

test('case discovery exposes recorded bounded runtime identity without adding it to legacy results',async()=>{
 const store=createCaseStore(),a=output();a.calculation.runtimeIdentity={schemaVersion:1,target:'browser',isolation:'web-worker',build:{status:'unavailable'},engine:{requestedMethod:'pcg',actualEngine:null},assets:[]};store.add('recorded',a);store.add('legacy',output());
 const api=createCaseOperations({store}),rows=(await api.list()).cases;assert.deepEqual(rows[0].runtimeIdentity,a.calculation.runtimeIdentity);assert.equal(rows[1].runtimeIdentity,undefined);assert.equal(rows[0].output,undefined);rows[0].runtimeIdentity.build.status='edited';assert.equal((await api.list()).cases[0].runtimeIdentity.build.status,'unavailable');
});
test('listing is compact, independent and stable without output payloads',async()=>{
 const {api}=setup(),first=await api.list(),second=await api.list();assert.deepEqual(first,second);assert.equal(first.cases[0].metrics[0].unit,'mm');assert.match(first.cases[0].revision,/^sha256:[a-f0-9]{64}$/);assert.equal(first.cases[0].output,undefined);assert.ok(JSON.stringify(first).length<2000);first.cases[0].metrics[0].value=99;assert.equal((await api.list()).cases[0].metrics[0].value,.04);
});
test('rename retains ID but changes revision, and stale revisions cannot remove it',async()=>{
 const {api,store}=setup(),row=(await api.list()).cases[0];const renamed=await api.rename({...reference(row),name:'Renamed'});assert.equal(renamed.caseId,row.caseId);assert.notEqual(renamed.revision,row.revision);await assert.rejects(api.remove(reference(row)),{code:'CASE_REVISION_CONFLICT'});assert.equal(store.compare()[0].name,'Renamed');assert.equal(store.compare().length,2);
});
test('remove preserves survivor identities and resolves current index for viewing/restoring',async()=>{
 const displayed=[],loaded=[],{api,store}=setup({view:index=>displayed.push(index),loadProject:p=>{loaded.push(p);p.conditions.push({edited:true});}}),rows=(await api.list()).cases;
 await api.remove(reference(rows[0]));assert.equal((await api.list()).cases[0].caseId,rows[1].caseId);await api.view(reference(rows[1]));await api.restoreInput(reference(rows[1]));assert.deepEqual(displayed,[0]);assert.equal(loaded.length,1);assert.deepEqual(store.list()[0].output.input.conditions,[]);await assert.rejects(api.rename({...reference(rows[0]),name:'Wrong'}),{code:'CASE_UNKNOWN'});
});
test('external index changes and duplicate snapshots invalidate old references',async()=>{
 const {api,store}=setup(),rows=(await api.list()).cases;store.remove(0);await assert.rejects(api.rename({...reference(rows[0]),name:'Wrong'}),{code:'CASE_UNKNOWN'});assert.equal(store.compare()[0].name,'B');
 const duplicate=store.export();duplicate.cases.push(structuredClone(duplicate.cases[0]));store.import(duplicate);const twins=(await api.list()).cases;assert.notEqual(twins[0].caseId,twins[1].caseId);store.remove(0);await assert.rejects(api.remove(reference(twins[0])),{code:'CASE_UNKNOWN'});assert.equal(store.compare().length,1);
});
test('busy host, invalid name and failed store import leave cases unchanged',async()=>{
 let busy=false;const {api,store}=setup({isBusy:()=>busy}),row=(await api.list()).cases[0],before=store.export();busy=true;await assert.rejects(api.remove(reference(row)),{code:'CASE_HOST_BUSY'});assert.equal((await api.list()).cases.length,2);busy=false;await assert.rejects(api.rename({...reference(row),name:' '}),{code:'CASE_NAME_INVALID'});assert.deepEqual(store.export(),before);
 const rejecting=createCaseOperations({store:{...store,import(){throw Error('Rejected');}}}),saved=(await rejecting.list()).cases[0];await assert.rejects(rejecting.rename({...reference(saved),name:'Rejected'}),/Rejected/);assert.deepEqual(store.export(),before);assert.equal((await rejecting.list()).cases[0].caseId,saved.caseId);
});
test('invalid saved result is rejected before display or input restoration',async()=>{
 const store=createCaseStore(),bad=output();bad.result.displacement.pop();store.add('Corrupt field',bad);let called=false;const api=createCaseOperations({store,view:()=>{called=true;},loadProject:()=>{called=true;}}),row=(await api.list()).cases[0],before=store.export();await assert.rejects(api.view(reference(row)),/fields/);await assert.rejects(api.restoreInput(reference(row)),/fields/);assert.equal(called,false);assert.deepEqual(store.export(),before);
});
test('concurrent operations and external changes during hashing cannot target stale indices',async()=>{
 const {api,store}=setup(),row=(await api.list()).cases[0];const pending=api.rename({...reference(row),name:'Pending'});await assert.rejects(api.remove(reference(row)),{code:'CASE_OPERATION_BUSY'});store.remove(0);await assert.rejects(pending,{code:'CASE_REVISION_CONFLICT'});assert.equal(store.compare()[0].name,'B');
});
test('expired guards reject every command at entry and after asynchronous inspection',async()=>{
 for(const method of ['view','restoreInput','remove','rename'])for(const timing of ['entry','hash']){
  let calls=0,valid=true;const {api,store}=setup({view:()=>{calls++;},loadProject:()=>{calls++;}}),row=(await api.list()).cases[0],before=store.export(),request={...reference(row),name:'Must not apply'};
  if(timing==='entry')valid=false;
  const pending=api[method](request,{guard:()=>valid});valid=false;
  await assert.rejects(pending,{code:'CASE_COMMAND_EXPIRED'});assert.equal(calls,0);assert.deepEqual(store.export(),before);
 }
});
test('guard is rechecked after preparing display/input and before rename/remove commit',async()=>{
 for(const method of ['view','restoreInput','remove','rename']){
  let checks=0,calls=0;const {api,store}=setup({view:()=>{calls++;},loadProject:()=>{calls++;}}),row=(await api.list()).cases[0],before=store.export();
  await assert.rejects(api[method]({...reference(row),name:'Must not apply'},{guard:()=>++checks<3}),{code:'CASE_COMMAND_EXPIRED'});
  assert.equal(checks,3);assert.equal(calls,0);assert.deepEqual(store.export(),before);
 }
});
test('current guard permits commands and a guard cannot be supplied through JSON arguments',async()=>{
 const {api}=setup(),row=(await api.list()).cases[0];const renamed=await api.rename({...reference(row),name:'Allowed'},{guard:()=>true});assert.equal(renamed.name,'Allowed');
 await assert.rejects(api.remove({...reference(renamed),guard:true},{guard:()=>false}),{code:'CASE_COMMAND_EXPIRED'});
});
const resultRevision=value=>getProjectRevision(JSON.parse(JSON.stringify(value)));
test('saveCurrent checks normalized result revision and preserves old case identities',async()=>{
 const current=output();current.optional=undefined;const {api,store}=setup({getAnalysis:()=>current}),rows=(await api.list()).cases;
 const saved=await api.saveCurrent({name:'Current',expectedResultRevision:await resultRevision(current)});
 assert.equal(saved.saved,true);assert.equal(saved.output,undefined);assert.equal(saved.metrics[0].unit,'mm');assert.equal(saved.revision,await getProjectRevision({name:'Current',output:JSON.parse(JSON.stringify(current))}));
 const after=(await api.list()).cases;assert.deepEqual(after.slice(0,2),rows);assert.equal(after[2].caseId,saved.caseId);assert.equal(after[2].revision,saved.revision);current.result.displacement[0]=99;assert.equal(store.list()[2].output.result.displacement[0],0);
});
test('saveCurrent rejects stale result, invalid name, missing host and full store before commit',async()=>{
 const current=output(),{api,store}=setup({getAnalysis:()=>current}),before=store.export(),revision=await resultRevision(current);
 await assert.rejects(api.saveCurrent({name:' ',expectedResultRevision:revision}),{code:'CASE_NAME_INVALID'});
 await assert.rejects(api.saveCurrent({name:'Stale',expectedResultRevision:'sha256:'+'0'.repeat(64)}),{code:'CASE_RESULT_REVISION_CONFLICT'});
 assert.deepEqual(store.export(),before);
 const unavailable=createCaseOperations({store});await assert.rejects(unavailable.saveCurrent({name:'No host',expectedResultRevision:revision}),{code:'CASE_OPERATION_UNAVAILABLE'});
 for(let i=2;i<8;i++)store.add('Existing '+i,output());const full=store.export();await assert.rejects(api.saveCurrent({name:'Overflow',expectedResultRevision:revision}),{code:'CASE_LIMIT_REACHED'});assert.deepEqual(store.export(),full);
});
test('saveCurrent rejects corrupt fields before add and enforces busy and command guard',async()=>{
 const current=output();let busy=false,valid=true;const {api,store}=setup({getAnalysis:()=>current,isBusy:()=>busy}),before=store.export(),revision=await resultRevision(current);
 busy=true;await assert.rejects(api.saveCurrent({name:'Busy',expectedResultRevision:revision}),{code:'CASE_HOST_BUSY'});busy=false;
 const pending=api.saveCurrent({name:'Expired',expectedResultRevision:revision},{guard:()=>valid});valid=false;await assert.rejects(pending,{code:'CASE_COMMAND_EXPIRED'});
 current.result.displacement.pop();await assert.rejects(api.saveCurrent({name:'Bad',expectedResultRevision:await resultRevision(current)}),/fields/);assert.deepEqual(store.export(),before);
});
test('saveCurrent refuses external store or displayed-output changes during hashing',async()=>{
 for(const change of ['store','result']){
  const current=output(),{api,store}=setup({getAnalysis:()=>current}),revision=await resultRevision(current),pending=api.saveCurrent({name:'Should not save',expectedResultRevision:revision});
  if(change==='store')store.remove(0);else current.result.maxDisplacementMm=.08;
  await assert.rejects(pending,{code:change==='store'?'CASE_REVISION_CONFLICT':'CASE_RESULT_REVISION_CONFLICT'});assert.equal(store.compare().length,change==='store'?1:2);
 }
});

test('archive export is a hashed independent snapshot and never changes display',async()=>{
 let called=0;const {api,store}=setup({view:()=>called++,loadProject:()=>called++});
 const before=store.export(),listed=await api.list(),exported=await api.exportArchive();
 assert.equal(exported.archiveRevision,await getProjectRevision(before));assert.equal(listed.archiveRevision,exported.archiveRevision);assert.deepEqual(exported.archive,before);
 exported.archive.cases[0].name='Changed copy';assert.deepEqual(store.export(),before);assert.equal(called,0);
});

test('archive replacement invalidates all old IDs and returns stable new compact references',async()=>{
 const {api,store}=setup(),before=await api.list(),archive=store.export();archive.cases[0].name='Imported';
 const imported=await api.importArchive({archive,expectedArchiveRevision:before.archiveRevision});
 assert.equal(imported.imported,true);assert.equal(imported.archiveRevision,await getProjectRevision(archive));assert.equal(imported.cases[0].name,'Imported');
 assert.ok(imported.cases.every(row=>!before.cases.some(old=>old.caseId===row.caseId)));assert.deepEqual((await api.list()).cases,imported.cases);
 await assert.rejects(api.remove(reference(before.cases[1])),{code:'CASE_UNKNOWN'});
 assert.equal(imported.cases[0].output,undefined);
});

test('invalid archives and stale archive revision leave the entire collection unchanged',async()=>{
 const {api,store}=setup(),before=store.export(),listed=await api.list();
 const badFields=structuredClone(before);badFields.cases[1].output.result.displacement.pop();
 const tooMany={version:1,cases:Array.from({length:9},()=>before.cases[0])};
 for(const archive of [null,{version:2,cases:[]},tooMany,badFields,{version:1,cases:[{name:'Bad',output:{}}]}]){
  await assert.rejects(api.importArchive({archive,expectedArchiveRevision:listed.archiveRevision}),{code:'CASE_ARCHIVE_INVALID'});assert.deepEqual(store.export(),before);assert.deepEqual(await api.list(),listed);
 }
 await assert.rejects(api.importArchive({archive:before,expectedArchiveRevision:'sha256:'+'0'.repeat(64)}),{code:'CASE_REVISION_CONFLICT'});assert.deepEqual(store.export(),before);
});

test('archive import rechecks guard, host busy and collection changes after hashing',async()=>{
 for(const change of ['expiry','busy','collection']){
  let valid=true,busy=false;const {api,store}=setup({isBusy:()=>busy}),listed=await api.list(),before=store.export();
  const pending=api.importArchive({archive:{version:1,cases:[]},expectedArchiveRevision:listed.archiveRevision},{guard:()=>valid});
  if(change==='expiry')valid=false;else if(change==='busy')busy=true;else store.remove(0);
  await assert.rejects(pending,{code:{expiry:'CASE_COMMAND_EXPIRED',busy:'CASE_HOST_BUSY',collection:'CASE_REVISION_CONFLICT'}[change]});
  assert.deepEqual(store.export(),change==='collection'?{version:1,cases:[before.cases[1]]}:before);
 }
});

test('archive import is exclusive and checks guard immediately before commit',async()=>{
 const {api,store}=setup(),listed=await api.list(),before=store.export();let checks=0;
 const pending=api.importArchive({archive:{version:1,cases:[]},expectedArchiveRevision:listed.archiveRevision},{guard:()=>++checks<3});
 await assert.rejects(api.exportArchive(),{code:'CASE_OPERATION_BUSY'});await assert.rejects(pending,{code:'CASE_COMMAND_EXPIRED'});assert.equal(checks,3);assert.deepEqual(store.export(),before);
});
