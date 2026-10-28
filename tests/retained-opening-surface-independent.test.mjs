import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRetainedOpeningSurfaceProvider as create} from '../src/retained-opening-surface.js';
const input=()=>({units:'mm',topologyIntent:'open-indexed-surface',sourceIdentity:'independent-triangle',mesh:{nodes:[0,0,0,1,0,0,0,1,0],triangles:[[0,1,2]],toleranceMm:1e-6}});
const code=c=>e=>e.code===c;
async function controlled(run){const original=crypto.subtle.digest,queue=[];crypto.subtle.digest=function(...args){return new Promise((resolve,reject)=>queue.push({ok:()=>original.apply(this,args).then(resolve,reject),no:()=>reject(Error('independent synthetic hash failure'))}));};try{await run(queue);}finally{crypto.subtle.digest=original;}}

test('malformed replacement does not steal a pending generation or invalidate its eventual valid lease',()=>controlled(async queue=>{
 const provider=create(),first=provider.replace(input());await queue[0].ok();const old=await first;
 const pending=provider.replace(input());assert.equal(provider.current(),null);await assert.rejects(provider.replace({...input(),units:'m'}));assert.equal(queue.length,2);await queue[1].ok();const next=await pending;assert.equal(next.generation,old.generation+1);assert.equal(provider.current(),next);provider.release(next);assert.equal(provider.current(),null);
}));

test('pending hash budget refuses before input inspection; hash failure and late old completion never resurrect leases',()=>controlled(async queue=>{
 const provider=create(),a=provider.replace(input()),ar=assert.rejects(a,code('OPENING_SURFACE_REPLACED')),b=provider.replace(input()),br=assert.rejects(b,code('OPENING_SURFACE_HASH_FAILED'));let touched=0;
 const poison=new Proxy(input(),{getPrototypeOf(target){touched++;return Reflect.getPrototypeOf(target);}});
 await assert.rejects(provider.replace(poison),code('OPENING_SURFACE_PENDING_LIMIT'));assert.equal(touched,0);assert.equal(queue.length,2);queue[1].no();await br;assert.equal(provider.current(),null);
 const c=provider.replace(input());await queue[2].ok();const current=await c;assert.equal(current.generation,3);await queue[0].ok();await ar;assert.equal(provider.current(),current);
 const d=provider.replace(input()),dr=assert.rejects(d,code('OPENING_SURFACE_REPLACED'));provider.dispose();await assert.rejects(provider.replace(poison),code('OPENING_SURFACE_DISPOSED'));assert.equal(touched,0);await queue[3].ok();await dr;assert.equal(provider.current(),null);provider.dispose();
}));
