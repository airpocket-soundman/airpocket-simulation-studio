import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';
const rev='sha256:'+'a'.repeat(64);
const hash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const fixture=(options={})=>{let imports=0;const archive={version:1,cases:[],unknown:'日本語'.repeat(30000)};const cases={exportArchive:async()=>({archiveRevision:rev,archive}),importArchive:async(args,{guard})=>{assert.equal(guard(),true);imports++;return {archiveRevision:rev,count:args.archive.cases.length};},...options.cases};return {api:createCaseArchiveTransfer({...options,cases}),archive,count:()=>imports};};
async function upload(api,archive,extra={}){const bytes=Buffer.from(typeof archive==='string'?archive:JSON.stringify(archive));const entry=api.beginImport({expectedArchiveRevision:rev,totalBytes:bytes.length,sha256:hash(bytes),...extra});for(let offset=0;offset<bytes.length;offset+=65536)api.write({...entry,offset,data:bytes.subarray(offset,offset+65536).toString('base64')});return entry;}

test('export chunks retain all UTF-8 bytes and hash; release denies future access',async()=>{
 const {api,archive}=fixture(),entry=await api.beginExport();let offset=0,parts=[];do{const page=api.read({...entry,offset});parts.push(Buffer.from(page.data,'base64'));offset=page.nextOffset;}while(offset!==null);
 const bytes=Buffer.concat(parts);assert.deepEqual(JSON.parse(bytes.toString()),archive);assert.equal(entry.sha256,hash(bytes));assert.equal(entry.totalBytes,bytes.length);assert.equal(api.read({...entry,offset:bytes.length}).data,'');assert.throws(()=>api.read({...entry,length:65537}),/range/);assert.throws(()=>api.read({...entry,offset:-1}),/range/);api.release(entry);assert.throws(()=>api.read(entry),/released/);
});
test('import retries chunks and concurrent commits exactly once',async()=>{
 const {api,count}=fixture(),archive={version:1,cases:[]},bytes=Buffer.from(JSON.stringify(archive));const entry=api.beginImport({expectedArchiveRevision:rev,totalBytes:bytes.length,sha256:hash(bytes)});const chunk={...entry,offset:0,data:bytes.toString('base64')};assert.deepEqual(api.write(chunk),api.write(chunk));assert.throws(()=>api.write({...chunk,data:Buffer.from('x').toString('base64')}),/offset/);const replies=await Promise.all([api.commit(entry),api.commit(entry)]);assert.deepEqual(replies[0],replies[1]);await api.commit(entry);assert.equal(count(),1);assert.throws(()=>api.write(chunk),/writable/);
});
test('shared budget and transfer count reserve synchronously and release restores capacity',async()=>{
 const {api}=fixture({maxBytes:10,maxTransfers:2});const meta={expectedArchiveRevision:rev,totalBytes:5,sha256:rev};const a=api.beginImport(meta),b=api.beginImport(meta);assert.throws(()=>api.beginImport(meta),/count/);api.release(a);assert.throws(()=>api.beginImport({...meta,totalBytes:6}),/budget/);api.release(b);api.beginImport({...meta,totalBytes:10});
});
test('bad metadata/base64, gaps, excess writes, wrong direction and incomplete commits fail',async()=>{
 const {api}=fixture();for(const change of [{sha256:'bad'},{expectedArchiveRevision:'bad'},{totalBytes:0},{totalBytes:100000001}])assert.throws(()=>api.beginImport({expectedArchiveRevision:rev,totalBytes:2,sha256:rev,...change}),/metadata/);
 const entry=api.beginImport({expectedArchiveRevision:rev,totalBytes:2,sha256:rev});for(const data of ['@@','Zg=','Zh==','',Buffer.alloc(65537).toString('base64')])assert.throws(()=>api.write({...entry,offset:0,data}),/base64/);assert.throws(()=>api.write({...entry,offset:1,data:'eA=='}),/offset/);assert.throws(()=>api.write({...entry,offset:0,data:'eHh4'}),/offset/);assert.throws(()=>api.read(entry),/export/);await assert.rejects(api.commit(entry),/incomplete/);const exp=await api.beginExport();await assert.rejects(api.commit(exp),/not an import/);assert.throws(()=>api.write({...exp,offset:0,data:'eA=='}),/writable/);
});
test('hash, UTF-8, JSON errors and CAS conflicts never apply an archive',async()=>{
 const {api,count}=fixture();const mismatch=await upload(api,'{}',{sha256:rev});await assert.rejects(api.commit(mismatch),/hash/);const json=await upload(api,'{broken');await assert.rejects(api.commit(json),SyntaxError);const bytes=Buffer.from([0xff]),invalid=api.beginImport({expectedArchiveRevision:rev,totalBytes:1,sha256:hash(bytes)});api.write({...invalid,offset:0,data:bytes.toString('base64')});await assert.rejects(api.commit(invalid),/encoded|encoding/);assert.equal(count(),0);
 const conflict=fixture({cases:{importArchive:async()=>{throw Error('CASE_REVISION_CONFLICT');}}});const entry=await upload(conflict.api,{});await assert.rejects(conflict.api.commit(entry),/REVISION_CONFLICT/);
});
test('expiry, release and disconnect invalidate pending commits, retaining exports',async()=>{
 let unblock,entered;const started=new Promise(r=>entered=r);let applied=0;const {api}=fixture({cases:{importArchive:async(args,{guard})=>{entered();await new Promise(r=>unblock=r);if(!guard())throw Error('expired');applied++;return {};}}});const entry=await upload(api,{}),pending=api.commit(entry);await started;api.disconnect();unblock();await assert.rejects(pending,/expired/);assert.equal(applied,0);assert.throws(()=>api.write({...entry,offset:0,data:'e30='}),/released/);
 const exp=await api.beginExport();api.cancelAllImports();assert.ok(api.read(exp).data);const expired=await upload(api,{});await assert.rejects(api.commit(expired,{guard:()=>false}),/expired/);
});
test('export snapshot expiry does not reserve or leak transfers',async()=>{
 let valid=true;const {api}=fixture({maxTransfers:1,cases:{exportArchive:async()=>{valid=false;return {archiveRevision:rev,archive:{}};}}});await assert.rejects(api.beginExport({}, {guard:()=>valid}),/expired/);api.beginImport({expectedArchiveRevision:rev,totalBytes:2,sha256:rev});
});
test('export and import share byte reservations; released hashing cannot commit',async()=>{
 const {api}=fixture({maxBytes:10,cases:{exportArchive:async()=>({archiveRevision:rev,archive:{}})}});const entry=await api.beginExport();assert.throws(()=>api.beginImport({expectedArchiveRevision:rev,totalBytes:9,sha256:rev}),/budget/);api.release(entry);const incoming=await upload(api,{}),pending=api.commit(incoming);api.release(incoming);await assert.rejects(pending,/released|expired/);
});
test('expiry during export hashing removes reservation and identity',async()=>{
 let valid=true;const {api}=fixture({maxTransfers:1,id:()=> 'export-one',cases:{exportArchive:async()=>({archiveRevision:rev,archive:{}})}});const pending=api.beginExport({}, {guard:()=>valid});await Promise.resolve();valid=false;await assert.rejects(pending,/expired/);assert.throws(()=>api.read({transferId:'export-one'}),/released/);
});
