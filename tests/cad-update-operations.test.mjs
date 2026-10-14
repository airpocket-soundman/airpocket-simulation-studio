import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BoxGeometry} from 'three';
import {createCadUpdateOperations,validateBrowserCadReplacement} from '../src/cad-update-operations.js';
import {getProjectRevision} from '../src/project-revision.js';
import {planCadUpdate} from '../src/cad-update.js';
import {createStudioApi} from '../src/studio-api.js';

const source={kind:'step',data:readFileSync(new URL('./fixtures/cad-update-reference.step',import.meta.url)).toString('base64')};
function box(){const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const mesh={kind:'cad',positions:Array.from(g.attributes.position.array),faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))};g.dispose();return mesh;}
const trianglesAt=(mesh,z)=>mesh.faceIds.flatMap((_,t)=>[2,5,8].every(k=>mesh.positions[t*9+k]===z)?[t]:[]);
function project(){const mesh=box();return {version:1,sourceModel:structuredClone(source),meshes:[mesh],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:trianglesAt(mesh,0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:trianglesAt(mesh,40)}]}]};}
function replacement(){const mesh=box();mesh.faceIds=mesh.faceIds.map(x=>x+100);return {sourceModel:structuredClone(source),meshes:[mesh]};}
function setup(initial=project(),isBusy=()=>false){let current=structuredClone(initial),loads=0;const studio={exportProject:()=>structuredClone(current),loadProject:p=>{loads++;current=structuredClone(p);}};return {api:createCadUpdateOperations({studio,isBusy}),studio,get:()=>structuredClone(current),loads:()=>loads,change:()=>{current.name='Concurrent change';}};}
async function argsFor(s,repl=replacement()){return {expectedRevision:await getProjectRevision(s.get()),replacement:repl,expectedReplacementRevision:await getProjectRevision(repl)};}

test('CAD preview pages compact reports and apply commits exactly the previewed replacement once',async()=>{
 const s=setup(),args=await argsFor(s),before=s.get(),repl=structuredClone(args.replacement);
 const preview=await s.api.preview({...args,offset:1,limit:1});assert.equal(preview.matched,2);assert.equal(preview.pending,0);assert.equal(preview.reportCount,2);assert.equal(preview.reports.length,1);assert.equal(preview.reports[0].index,1);assert.equal(preview.reports[0].triangleCount,2);assert.equal(preview.reports[0].faceCount,1);assert.equal(preview.reports[0].regions,undefined);assert.equal(preview.reports[0].faces,undefined);assert.equal(preview.project,undefined);assert.equal(s.loads(),0);assert.deepEqual(s.get(),before);
 const applied=await s.api.apply(args);assert.equal(s.loads(),1);assert.deepEqual(s.get(),JSON.parse(JSON.stringify(planCadUpdate(before,repl).project)));assert.equal(applied.revision,await getProjectRevision(s.get()));assert.equal(applied.previousRevision,args.expectedRevision);assert.equal(applied.replacementRevision,args.expectedReplacementRevision);assert.deepEqual(args.replacement,repl);assert.equal(applied.project,undefined);
});
test('changed and ambiguous CAD faces remain pending, preserving condition intent and clearing confirmations',async()=>{
 const p=project();p.materialProperties={youngModulus:1e9,poissonRatio:0,density:1000};p.inputProvenance={schemaVersion:1,entries:[{pointer:'/materialProperties/youngModulus',value:1e9,source:{kind:'agent-proposal'},rationale:'Reference',applicability:'Old design',status:'confirmed',assumption:'Nominal',confirmation:{by:'user',note:'Old design'}}]};
 const s=setup(p),repl=replacement();repl.meshes[0].positions=repl.meshes[0].positions.map((x,i)=>i%3===2&&x===40?50:x);const args=await argsFor(s,repl),out=await s.api.apply(args);assert.equal(out.pending,1);assert.equal(out.reports[1].reason,'missing-face');assert.equal(s.get().conditions[1].value,100);assert.deepEqual(s.get().conditions[1].regions,[]);assert.equal(s.get().inputProvenance.entries[0].status,'unconfirmed');assert.equal(s.get().inputProvenance.entries[0].confirmation,undefined);
 const duplicate=setup(),r=replacement();r.meshes.push(structuredClone(r.meshes[0]));const pending=await duplicate.api.preview(await argsFor(duplicate,r));assert.equal(pending.pending,2);assert.ok(pending.reports.every(x=>x.reason==='ambiguous-face'));
});
test('stale input, replacement, invalid replacement and paging reject without writes',async()=>{
 const s=setup(),args=await argsFor(s),before=s.get();
 await assert.rejects(s.api.apply({...args,expectedRevision:'sha256:'+'0'.repeat(64)}),/revision conflict/);
 await assert.rejects(s.api.apply({...args,expectedReplacementRevision:'sha256:'+'0'.repeat(64)}),/Replacement revision conflict/);
 await assert.rejects(s.api.apply({...args,replacement:{sourceModel:{kind:'box'},meshes:[]}}));
 await assert.rejects(s.api.apply({...args,expectedReplacementRevision:undefined}),/expectedReplacementRevision/);
 for(const values of [{offset:-1},{offset:1.5},{limit:0},{limit:51},{limit:Infinity}])await assert.rejects(s.api.preview({...args,...values}),/page/);
 assert.equal((await s.api.preview({...args,offset:100})).reports.length,0);assert.deepEqual(s.get(),before);assert.equal(s.loads(),0);
});
test('busy and revoked transactions reject, including changes while asynchronous hashing is pending',async()=>{
 let busy=false,valid=true;const s=setup(undefined,()=>busy),args=await argsFor(s),before=s.get();
 busy=true;await assert.rejects(s.api.preview(args),/busy/);await assert.rejects(s.api.apply(args),/busy/);busy=false;
 await assert.rejects(s.api.apply(args,{guard:()=>false}),/expired/);
 const expired=s.api.apply(args,{guard:()=>valid});valid=false;await assert.rejects(expired,/expired/);valid=true;
 const concurrentBusy=s.api.apply(args);busy=true;await assert.rejects(concurrentBusy,/busy/);busy=false;
 assert.equal(s.loads(),0);assert.deepEqual(s.get(),before);
 const concurrent=s.api.apply(args);s.change();await assert.rejects(concurrent,/changed/);assert.equal(s.loads(),0);assert.equal(s.get().name,'Concurrent change');
});
test('arguments are snapshotted before hashing and final source/permission checks cover output hashing',async()=>{
 const s=setup(),args=await argsFor(s),original=structuredClone(args.replacement),pending=s.api.apply(args);args.replacement.meshes[0].positions[0]=999;args.expectedRevision='changed';args.expectedReplacementRevision='changed';await pending;assert.deepEqual(s.get(),JSON.parse(JSON.stringify(planCadUpdate(project(),original).project)));
 const changed=setup(),params=await argsFor(changed);let checks=0;await assert.rejects(changed.api.apply(params,{guard:()=>{checks++;if(checks===3)changed.change();return true;}}),/changed/);assert.equal(changed.loads(),0);
 const expired=setup(),a=await argsFor(expired);let n=0;await assert.rejects(expired.api.apply(a,{guard:()=>++n<3}),/expired/);assert.equal(expired.loads(),0);
});
test('real studio adapter retains the committed JSON revision',async()=>{
 const studio=createStudioApi();studio.loadProject(project());const api=createCadUpdateOperations({studio}),r=replacement();
 const args={expectedRevision:await getProjectRevision(studio.exportProject()),replacement:r,expectedReplacementRevision:await getProjectRevision(r)};
 const applied=await api.apply(args);assert.equal(applied.revision,await getProjectRevision(studio.exportProject()));assert.equal(studio.exportProject().conditions.length,2);
});
test('browser CAD validation rejects lossy coordinates and metadata before any host mutation',async()=>{
 const s=setup(),api=createCadUpdateOperations({studio:s.studio,validateReplacement:validateBrowserCadReplacement});
 for(const mutate of [r=>r.meshes[0].positions[0]=.1,r=>r.meshes[0].ignoredMetadata=true,r=>delete r.meshes[0].kind,r=>r.meshes[0].sourceHash='',r=>r.meshes[0].sourceHash=1,r=>delete r.meshes,r=>r.name=123]){
  const r=replacement();mutate(r);const args=await argsFor(s,r);await assert.rejects(api.preview(args),/Browser CAD replacement/);await assert.rejects(api.apply(args),/Browser CAD replacement/);
 }
 assert.equal(s.loads(),0);assert.deepEqual(s.get(),project());
 const accepted=replacement();accepted.meshes[0].positions[0]=Math.fround(.1);accepted.meshes[0].sourceHash='cad-source';assert.doesNotThrow(()=>validateBrowserCadReplacement(accepted));
 // Generic/headless operations continue to accept double precision display JSON.
 const generic=replacement();generic.meshes[0].positions[0]=.1;assert.equal((await s.api.preview(await argsFor(s,generic))).schemaVersion,1);
});
test('browser adapter rounding and metadata projection preserve revisions for validated replacements',async()=>{
 let current=project(),loads=0;const studio={exportProject:()=>structuredClone(current),loadProject:p=>{
  loads++;current=structuredClone(p);current.meshes=current.meshes.map(m=>({positions:m.positions.map(Math.fround),faceIds:m.faceIds,kind:m.kind,...(m.sourceHash?{sourceHash:m.sourceHash}:{})}));
 }};
 const api=createCadUpdateOperations({studio,validateReplacement:validateBrowserCadReplacement}),r=replacement();r.meshes[0].positions[0]=Math.fround(.1);r.meshes[0].sourceHash='retained-source';
 const args={expectedRevision:await getProjectRevision(current),expectedReplacementRevision:await getProjectRevision(r),replacement:r};
 const preview=await api.preview(args);assert.equal(loads,0);assert.equal(preview.replacementRevision,args.expectedReplacementRevision);
 const applied=await api.apply(args);assert.equal(loads,1);assert.equal(applied.revision,await getProjectRevision(current));assert.equal(current.meshes[0].positions[0],Math.fround(.1));assert.equal(current.meshes[0].sourceHash,'retained-source');
});
