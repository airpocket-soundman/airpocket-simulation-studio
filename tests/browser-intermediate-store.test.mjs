import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserIntermediateStore} from '../src/browser-intermediate-store.js';

const mesh=()=>({nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]});
const field=values=>({kind:'thermal',time:1,temperature:values,units:{temperature:'degC'}});
test('browser artifacts freeze inputs, authenticate mesh identity and return bounded physical samples',async()=>{
 const store=createBrowserIntermediateStore(),m=mesh();
 const mr=await store.capture('j1','rev1',{mesh:m});
 const event={field:field([20,30,40,50])},capturing=store.capture('j1','rev1',event);event.field.temperature[0]=999;const fr=await capturing;m.nodes[0]=999;
 const sample=await store.read('j1',fr.artifact.artifactId,{point:[.25,.25,.25],limit:2});
 assert.equal(sample.measurement.value,35);assert.equal(sample.measurement.unit,'degC');assert.equal(sample.page.count,2);assert.equal(sample.page.total,4);assert.equal(sample.provisional,true);assert.equal(sample.artifact.storage,'browser-memory');
 sample.page.values[0]=999;assert.equal((await store.read('j1',fr.artifact.artifactId,{limit:1})).page.values[0],20);
 await assert.rejects(store.read('j2',mr.artifact.artifactId),/Unknown/);
 await assert.rejects(store.read('j1',fr.artifact.artifactId,{limit:201}),/page/);
 await assert.rejects(store.read('j1',fr.artifact.artifactId,{point:[2,2,2]}),/outside/);
 await assert.rejects(store.capture('j1','wrong',{mesh:mesh()}),/integrity/);
 store.release('j1');assert.equal(store.summary('j1').sharedBytes,0);await assert.rejects(store.read('j1',fr.artifact.artifactId),/Unknown/);
});

test('remeshing binds new fields to the new mesh while old fields retain their original mesh',async()=>{
 const store=createBrowserIntermediateStore();await store.capture('j','r',{mesh:mesh()});const a=await store.capture('j','r',{field:field([1,2,3,4])});
 const moved=mesh();moved.nodes=moved.nodes.map((v,i)=>i%3===0?v+10:v);await store.capture('j','r',{mesh:moved});const b=await store.capture('j','r',{field:field([10,20,30,40])});
 assert.equal((await store.read('j',a.artifact.artifactId,{point:[.25,.25,.25]})).measurement.value,2.5);
 assert.equal((await store.read('j',b.artifact.artifactId,{point:[10.25,.25,.25]})).measurement.value,25);
 await assert.rejects(store.read('j',b.artifact.artifactId,{point:[.25,.25,.25]}),/outside/);
});

test('acoustic field pages and probes retain signed pressure in Pa and physical seconds',async()=>{
 const store=createBrowserIntermediateStore();await store.capture('wave','r',{mesh:mesh()});const frame=await store.capture('wave','r',{field:{kind:'acousticTransient',time:.002,pressure:[-1,1,3,5],units:{pressure:'Pa'}}});
 const result=await store.read('wave',frame.artifact.artifactId,{point:[.25,.25,.25],limit:4});assert.equal(result.measurement.value,2);assert.equal(result.measurement.unit,'Pa');assert.equal(result.measurement.time,.002);assert.equal(result.field.minimum,-1);assert.deepEqual(result.page.values,[-1,1,3,5]);
});

test('shared byte budget rejects extra storage without inventing a mesh link and release frees capacity',async()=>{
 const measuring=createBrowserIntermediateStore();const first=await measuring.capture('j','r',{mesh:mesh()});
 const store=createBrowserIntermediateStore({maxBytes:first.artifact.bytes+5});await store.capture('j','r',{mesh:mesh()});
 assert.equal((await store.capture('j','r',{field:field([1,2,3,4])})).limited,true);
 assert.equal((await store.capture('k','r',{mesh:mesh()})).limited,true);
 assert.equal((await store.capture('k','r',{field:field([1,2,3,4])})).unavailable,true);
 assert.equal(store.summary('k').storageLimited,true);store.release('j');assert.ok((await store.capture('k','r',{mesh:mesh()})).artifact);
 assert.ok(store.summary('k').sharedBytes<=store.summary('k').maxBytes);
});

test('release or cancellation during an asynchronous hash cannot resurrect artifacts',async()=>{
 let complete;const gate=new Promise(resolve=>complete=resolve),store=createBrowserIntermediateStore({hash:async()=>{await gate;return 'hash';}});let active=true;
 const capturing=store.capture('j','r',{mesh:mesh()},()=>active);store.release('j');active=false;complete();assert.equal(await capturing,undefined);assert.equal(store.summary('j').sharedBytes,0);
});

test('hash verification and scalar unit checks reject corrupted observations',async()=>{
 let digest='initial';const store=createBrowserIntermediateStore({hash:async()=>digest});const mr=await store.capture('j','r',{mesh:mesh()});digest='changed';await assert.rejects(store.read('j',mr.artifact.artifactId),{code:'INTERMEDIATE_INTEGRITY_FAILED'});
 const valid=createBrowserIntermediateStore();await valid.capture('j','r',{mesh:mesh()});await assert.rejects(valid.capture('j','r',{field:{...field([1,2,3,4]),units:{temperature:'K'}}}),/units/);
});
