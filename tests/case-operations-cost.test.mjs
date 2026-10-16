import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';
import {canonicalJson,getProjectRevision,hashCanonicalJson} from '../src/project-revision.js';

// Synthetic, solver-free cases. `padding` makes an output large enough to feel O(size) work without a real solve.
const output=(seed=0,padding=0)=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04+seed/1000,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]},...(padding?{padding:Array.from({length:padding},(_,i)=>(i*7919+seed)%1000/8)}:{})});
function host(options={}){
 const store=options.store??createCaseStore(),display={value:null};let n=0;
 const operations=createCaseOperations({store,getAnalysis:()=>display.value,id:()=>'id-'+(++n)});
 return {store,display,operations,transfer:createCaseArchiveTransfer({cases:operations,id:()=>'tr-'+(++n)})};
}
// Previous implementation: export (deep clone), canonicalise everything, hash every case independently.
const reference=async store=>{
 const archive=store.export(),canonical=canonicalJson(archive);
 return {canonical,archiveRevision:await hashCanonicalJson(canonical),revisions:await Promise.all(archive.cases.map(saved=>getProjectRevision(saved)))};
};
async function agrees(h,label){
 const expected=await reference(h.store),listed=await h.operations.list();
 assert.equal(listed.archiveRevision,expected.archiveRevision,label+': archive revision');
 assert.deepEqual(listed.cases.map(row=>row.revision),expected.revisions,label+': case revisions');
 if(typeof h.store.inspect==='function')assert.equal(h.store.inspect().canonical,expected.canonical,label+': memoised canonical');
 assert.deepEqual(listed.cases.map(row=>row.name),h.store.compare().map(row=>row.name),label+': names');
 return listed;
}
const save=async(h,name,value)=>{h.display.value=value;return h.operations.saveCurrent({name,expectedResultRevision:await getProjectRevision(JSON.parse(JSON.stringify(value)))});};
const ref=row=>({caseId:row.caseId,expectedRevision:row.revision});

test('memoised canonical strings and revisions equal a full recomputation across save, rename, remove, import and external edits',async()=>{
 const h=host();await agrees(h,'empty');
 await save(h,'A "quoted" é😀',output(1));await agrees(h,'save 1');
 await save(h,'B',output(2));await save(h,'C',output(3));const three=await agrees(h,'save 3');
 const renamed=await h.operations.rename({...ref(three.cases[1]),name:'B2 ☃'});assert.equal(renamed.caseId,three.cases[1].caseId);const afterRename=await agrees(h,'rename');
 assert.equal(afterRename.cases[1].revision,renamed.revision);assert.equal(afterRename.cases[1].name,'B2 ☃');
 await h.operations.remove(ref(afterRename.cases[0]));const afterRemove=await agrees(h,'remove');assert.deepEqual(afterRemove.cases.map(r=>r.caseId),afterRename.cases.slice(1).map(r=>r.caseId));
 // Import replaces everything.
 const exported=(await h.operations.exportArchive()).archive,other=host();await save(other,'X',output(9));
 const imported=await other.operations.importArchive({archive:exported,expectedArchiveRevision:(await other.operations.list()).archiveRevision});assert.equal(imported.imported,true);await agrees(other,'import');
 assert.deepEqual(other.store.export(),h.store.export());assert.equal((await other.operations.list()).archiveRevision,(await h.operations.list()).archiveRevision);
 // Restore/view are read-only and leave the memo untouched.
 let displayed=0;const viewer=createCaseOperations({store:h.store,view:()=>{displayed++;},loadProject:()=>{}});const vrows=(await viewer.list()).cases;await viewer.view(ref(vrows[0]));await viewer.restoreInput(ref(vrows[0]));assert.equal(displayed,1);await agrees({...h,operations:viewer},'view/restore');
 // External mutations through the store API (not the adapter) are noticed by content.
 h.store.add('ext',output(5));await agrees(h,'external add');h.store.remove(0);await agrees(h,'external remove');h.store.rename(0,'ext renamed');await agrees(h,'external rename');
 const archive=h.store.export();archive.cases.reverse();h.store.import(archive);await agrees(h,'external import');
});
test('mutating anything the store hands out cannot corrupt its memoised canonical form',()=>{
 const store=createCaseStore();store.add('A',output(1));store.add('B',output(2));const before=store.inspect().canonical;
 const exported=store.export();exported.cases[0].output.result.maxDisplacementMm=99;exported.cases[1].name='tampered';
 const listed=store.list();listed[0].output.mesh.nodes.length=0;store.exportCase(1).output.padding=[1];
 const inspected=store.inspect();inspected.cases[0].assessment={mode:'edited'};inspected.cases[0].name='edited';
 assert.equal(store.inspect().canonical,before);assert.equal(canonicalJson(store.export()),before);
 const input=output(3);store.add('C',input);input.result.maxDisplacementMm=77;input.mesh.nodes.length=0;
 assert.equal(store.export().cases[2].output.result.maxDisplacementMm,.04+3/1000);
 assert.equal(store.inspect().canonical,canonicalJson(store.export()));
 // A failed mutation leaves the memo intact.
 assert.throws(()=>store.import({version:1,cases:[{name:' ',output:output(1)}]}),/Invalid case name/);assert.throws(()=>store.rename(0,' '),/Invalid case name/);assert.throws(()=>store.adopt({}),/Invalid case archive/);
 assert.equal(store.inspect().cases.length,3);assert.equal(store.inspect().canonical,canonicalJson(store.export()));
 // adopt() accepts only stores made by createCaseStore and matches import() exactly.
 const donor=createCaseStore();donor.add('Z',output(4));const target=createCaseStore();target.adopt(donor);const reimported=createCaseStore();reimported.import(donor.export());
 assert.equal(target.inspect().canonical,reimported.inspect().canonical);assert.deepEqual(target.export(),reimported.export());
 assert.equal(store.exportJson(),JSON.stringify(store.export()));
});
test('a store without the optional fast paths gives identical revisions, ids and archive bytes',async()=>{
 const real=createCaseStore();const plain={export:real.export,import:real.import,compare:real.compare,add:real.add,remove:real.remove};
 const fast=host(),slow=host({store:plain});
 for(const h of [fast,slow]){await save(h,'A',output(1));await save(h,'B',output(2,50));}
 const f=await fast.operations.list(),s=await slow.operations.list();assert.deepEqual(f,s);
 const fr=await fast.operations.rename({...ref(f.cases[0]),name:'N'}),sr=await slow.operations.rename({...ref(s.cases[0]),name:'N'});assert.deepEqual(fr,sr);
 const f2=await fast.operations.list(),s2=await slow.operations.list();assert.deepEqual(f2,s2);
 await fast.operations.remove(ref(f2.cases[1]));await slow.operations.remove(ref(s2.cases[1]));assert.deepEqual(await fast.operations.list(),await slow.operations.list());
 await save(fast,'C',output(3,20));await save(slow,'C',output(3,20));
 // Wire bytes, hashes and revisions of an export/import round trip do not depend on the fast paths.
 const a=await fast.transfer.beginExport(),b=await slow.transfer.beginExport();assert.equal(a.sha256,b.sha256);assert.equal(a.totalBytes,b.totalBytes);assert.equal(a.archiveRevision,b.archiveRevision);
 const legacy=new TextEncoder().encode(JSON.stringify((await slow.operations.exportArchive()).archive));
 assert.equal(a.sha256,'sha256:'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',legacy))].map(v=>v.toString(16).padStart(2,'0')).join(''));
 const destination=host();let offset=0;const chunks=[];do{const page=fast.transfer.read({transferId:a.transferId,offset});chunks.push(page.data);offset=page.nextOffset;}while(offset!==null);
 const begun=destination.transfer.beginImport({expectedArchiveRevision:(await destination.operations.list()).archiveRevision,totalBytes:a.totalBytes,sha256:a.sha256});let at=0;for(const data of chunks){destination.transfer.write({transferId:begun.transferId,offset:at,data});at+=Buffer.from(data,'base64').length;}
 const committed=await destination.transfer.commit({transferId:begun.transferId});assert.equal(committed.archiveRevision,a.archiveRevision);await agrees(destination,'transfer import');assert.deepEqual(destination.store.export(),fast.store.export());
});
test('import rejects the same archives with the same errors and leaves the store and ids untouched',async()=>{
 const h=host();await save(h,'A',output(1));const before=await h.operations.list(),expectedArchiveRevision=before.archiveRevision;
 const bad=output(2);bad.result.displacement.pop();
 await assert.rejects(h.operations.importArchive({archive:{version:1,cases:[{name:'bad',output:bad}]},expectedArchiveRevision}),{code:'CASE_ARCHIVE_INVALID',message:/fields/});
 await assert.rejects(h.operations.importArchive({archive:{version:1,cases:[{name:'x',output:{...output(1),oops:undefined}}]},expectedArchiveRevision}),{code:'CASE_ARCHIVE_INVALID',message:'Case archive must contain plain JSON data'});
 await assert.rejects(h.operations.importArchive({archive:{version:2,cases:[]},expectedArchiveRevision}),{code:'CASE_ARCHIVE_INVALID',message:'Invalid case archive'});
 await assert.rejects(h.operations.importArchive({archive:{version:1,cases:[]},expectedArchiveRevision:before.archiveRevision.replace(/.$/,c=>c==='0'?'1':'0')}),{code:'CASE_REVISION_CONFLICT'});
 assert.deepEqual(await h.operations.list(),before);await agrees(h,'after rejected imports');
 // Multi-byte text takes the same import path (the size limit counts UTF-8 bytes exactly like TextEncoder).
 const wide=output(3);wide.note='é€😀'.repeat(10);await h.operations.importArchive({archive:{version:1,cases:[{name:'wide 😀',output:wide}]},expectedArchiveRevision});await agrees(h,'multi-byte import');
});
test('repeated unchanged inspections do not scale with the stored size, and a rename does not rework the other cases',async()=>{
 const h=host();for(let i=0;i<8;i++)await save(h,'case '+i,output(i,150000));
 const time=async f=>{const t=performance.now();await f();return performance.now()-t;};
 const first=await time(()=>h.operations.list());
 let warm=Infinity;for(let i=0;i<10;i++)warm=Math.min(warm,await time(()=>h.operations.list()));
 // The previous implementation re-serialised the whole store on every call; memoised calls are far below one cold call.
 assert.ok(warm<Math.max(50,first*0.5),`warm list ${warm.toFixed(1)}ms vs first ${first.toFixed(1)}ms`);
 const rows=(await h.operations.list()).cases;
 const rename=await time(()=>h.operations.rename({...ref(rows[3]),name:'renamed'}));
 const again=await time(()=>h.operations.list());
 assert.ok(rename<Math.max(1000,first*3)&&again<Math.max(1000,first*2),`rename ${rename.toFixed(1)}ms, list after ${again.toFixed(1)}ms, first ${first.toFixed(1)}ms`);
 await agrees(h,'large store');
});
