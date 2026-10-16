import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaseStore,CASE_STORE_MAX_RETAINED_BYTES} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';
import {getProjectRevision} from '../src/project-revision.js';

// Reuse the synthetic output of the cost test through a real small store round trip.
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./case-operations-cost.test.mjs',import.meta.url),'utf8');
const outputSource=source.slice(source.indexOf('const output=('),source.indexOf('\nfunction host'));
const output=new Function(outputSource+';return output;')();

test('the documented budget is 256 MiB and exposed by the store',()=>{
 const store=createCaseStore();assert.equal(CASE_STORE_MAX_RETAINED_BYTES,256*1024*1024);assert.equal(store.maxRetainedBytes,CASE_STORE_MAX_RETAINED_BYTES);assert.equal(store.retainedBytes(),0);
 assert.throws(()=>createCaseStore({maxRetainedBytes:0}),TypeError);
});
test('add refuses a save over the budget with CASE_MEMORY_BUDGET and keeps the store unchanged; the 8-case cap still wins its own message',()=>{
 const one=createCaseStore();one.add('a',output(1,0));const bytes=one.retainedBytes();assert.ok(bytes>0);
 const store=createCaseStore({maxRetainedBytes:bytes*2-1});store.add('a',output(1,0));
 assert.throws(()=>store.add('b',output(2,0)),{code:'CASE_MEMORY_BUDGET',message:/Case memory budget exceeded/});
 assert.equal(store.compare().length,1);assert.equal(store.retainedBytes(),bytes);
 const full=createCaseStore();for(let i=0;i<8;i++)full.add('c'+i,output(i,0));
 assert.throws(()=>full.add('ninth',output(9,0)),/^Error: Maximum 8 cases$/);
});
test('import and importJson refuse an over-budget archive and keep the previous cases',()=>{
 const donor=createCaseStore();donor.add('a',output(1,0));donor.add('b',output(2,0));
 const store=createCaseStore({maxRetainedBytes:Math.floor(donor.retainedBytes()*0.75)});
 for(const load of [()=>store.import(donor.export()),()=>store.importJson(donor.exportJson())])assert.throws(load,{code:'CASE_MEMORY_BUDGET'});
 assert.equal(store.compare().length,0);
 const ok=createCaseStore();ok.importJson(donor.exportJson());assert.equal(JSON.stringify(ok.export()),JSON.stringify(donor.export()));
 assert.equal(ok.inspect().canonical,donor.inspect().canonical);
 const clone=createCaseStore();clone.import(donor.export());assert.equal(clone.inspect().canonical,ok.inspect().canonical);
});
test('operations: saveCurrent and importArchive report CASE_MEMORY_BUDGET before touching the store',async()=>{
 const one=createCaseStore();one.add('a',output(1,0));const bytes=one.retainedBytes();
 const store=createCaseStore({maxRetainedBytes:bytes+Math.floor(bytes/2)}),display={value:null};let n=0;
 const operations=createCaseOperations({store,getAnalysis:()=>display.value,id:()=>'id-'+(++n)});
 const save=async(name,value)=>{display.value=value;return operations.saveCurrent({name,expectedResultRevision:await getProjectRevision(JSON.parse(JSON.stringify(value)))});};
 await save('a',output(1,0));const before=await operations.list();
 await assert.rejects(save('b',output(2,0)),{code:'CASE_MEMORY_BUDGET'});
 assert.deepEqual(await operations.list(),before);
 const donor=createCaseStore();donor.add('x',output(3,0));donor.add('y',output(4,0));
 await assert.rejects(operations.importArchive({archive:donor.export(),expectedArchiveRevision:before.archiveRevision}),{code:'CASE_MEMORY_BUDGET'});
 assert.deepEqual(await operations.list(),before);
});
test('a committed import frees its staged bytes but keeps replaying the same result',async()=>{
 const donor=createCaseStore();donor.add('a',output(1,0));
 const store=createCaseStore(),operations=createCaseOperations({store,id:(()=>{let n=0;return()=>'id-'+(++n);})()});
 const transfer=createCaseArchiveTransfer({cases:operations,maxBytes:5000000,maxTransfers:1,id:()=>'t1'});
 const bytes=new TextEncoder().encode(donor.exportJson());
 const {archiveRevision}=await operations.list();
 const {sha256}=await crypto.subtle.digest('SHA-256',bytes).then(d=>({sha256:'sha256:'+Buffer.from(d).toString('hex')}));
 const begun=transfer.beginImport({expectedArchiveRevision:archiveRevision,totalBytes:bytes.length,sha256});
 transfer.write({transferId:begun.transferId,offset:0,data:Buffer.from(bytes).toString('base64')});
 const first=await transfer.commit({transferId:begun.transferId});
 assert.deepEqual(await transfer.commit({transferId:begun.transferId}),first);
 assert.equal(store.compare().length,1);transfer.release({transferId:begun.transferId});
});
