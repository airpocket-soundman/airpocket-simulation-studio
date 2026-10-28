import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRetainedOpeningSurfaceProvider as create,RETAINED_OPENING_SURFACE_LIMITS as limits} from '../src/retained-opening-surface.js';
function fixture(){return {units:'mm',topologyIntent:'open-indexed-surface',sourceIdentity:'caller-supplied-synthetic-box-v1',mesh:{nodes:[-1,-1,0,1,-1,0,1,1,0,-1,1,0,-1,-1,10,1,-1,10,1,1,10,-1,1,10],triangles:[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7],[0,2,1],[0,3,2]],toleranceMm:1e-6}};}
const request=lease=>({confirmed:true,capId:'top',candidate:lease.analysis.candidates[0],outwardNormal:[0,0,1],interiorPointMm:[0,0,5],enclosure:[-2,-2,-1,4,4,12]});
const code=expected=>e=>e.code===expected;
const sorted=x=>Array.isArray(x)?'['+x.map(sorted).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+sorted(x[k])).join(',')+'}':JSON.stringify(x);

test('retains exact indexed identity and independent content SHA; explicit cap is frozen without exposing private geometry',async()=>{
 const input=fixture(),before=structuredClone(input),p=create(),lease=await p.replace(input);
 assert.equal(lease.contentRevision,'sha256:'+createHash('sha256').update(sorted(input)).digest('hex'));assert.equal(p.current(),lease);assert.equal(lease.generation,1);assert.equal(lease.mesh,undefined);assert.deepEqual(lease.analysis.candidates[0].nodeIndices,[4,5,6,7]);
 input.mesh.nodes[14]=0;input.mesh.triangles[0][0]=7;
 const confirmation=request(lease),copy=structuredClone(confirmation),cap=p.confirm(lease,confirmation);
 assert.deepEqual(cap.source.openingCaps,[{id:'top',point:[0,0,10],normal:[0,0,1]}]);assert.deepEqual(cap.nodeIndices,[4,5,6,7]);assert.equal(cap.meshVersion,lease.generation);assert.equal(cap.contentRevision,lease.contentRevision);assert.equal(cap.sourceIdentity,before.sourceIdentity);assert.deepEqual(confirmation,copy);assert.ok(Object.isFrozen(cap.source.openingCaps[0].normal));assert.ok(Object.isFrozen(lease.analysis.candidates[0].pointsMm[0]));
});
test('replacement, ABA, clear, cloned and foreign leases cannot confirm',async()=>{
 const p=create(),a=await p.replace(fixture()),other=create(),foreign=await other.replace(fixture());
 for(const lease of [structuredClone(a),foreign])assert.throws(()=>p.confirm(lease,request(a)),code('OPENING_SURFACE_STALE_LEASE'));
 const input=fixture();input.sourceIdentity='B';const b=await p.replace(input),a2=await p.replace(fixture());
 assert.equal(a2.contentRevision,a.contentRevision);assert.ok(a2.generation>b.generation&&b.generation>a.generation);assert.throws(()=>p.confirm(a,request(a)),code('OPENING_SURFACE_STALE_LEASE'));assert.throws(()=>p.confirm(b,request(b)),code('OPENING_SURFACE_STALE_LEASE'));
 p.clear();assert.equal(p.current(),null);assert.throws(()=>p.confirm(a2,request(a2)),code('OPENING_SURFACE_STALE_LEASE'));const next=await p.replace(fixture());assert.equal(next.generation,a2.generation+2);
});
test('out-of-order hash completion and clear revoke pending work, with caller snapshots captured before await',async()=>{
 const original=crypto.subtle.digest,waits=[];crypto.subtle.digest=function(...args){return new Promise((resolve,reject)=>waits.push(()=>original.apply(this,args).then(resolve,reject)));};
 try{
  const p=create(),input=fixture(),originalIdentity=input.sourceIdentity,one=p.replace(input);input.sourceIdentity='late';input.mesh.nodes.fill(0);
  const two=p.replace(fixture());assert.equal(p.current(),null);await waits[1]();const b=await two;await waits[0]();await assert.rejects(one,code('OPENING_SURFACE_REPLACED'));assert.equal(p.current(),b);
  const three=p.replace(fixture());assert.equal(p.current(),null);assert.throws(()=>p.confirm(b,request(b)),code('OPENING_SURFACE_STALE_LEASE'));p.clear();await waits[2]();await assert.rejects(three,code('OPENING_SURFACE_REPLACED'));
  const copyInput=fixture(),four=p.replace(copyInput);copyInput.mesh.nodes.fill(0);copyInput.sourceIdentity='mutated';await waits[3]();const copyLease=await four;assert.equal(copyLease.sourceIdentity,originalIdentity);assert.equal(p.confirm(copyLease,request(copyLease)).source.openingCaps[0].point[2],10);
 }finally{crypto.subtle.digest=original;}
});
test('release deletes current issuance and dispose is terminal/idempotent, including pending work',async()=>{
 const p=create(),lease=await p.replace(fixture());p.release(lease);assert.equal(p.current(),null);assert.throws(()=>p.release(lease),code('OPENING_SURFACE_STALE_LEASE'));assert.throws(()=>p.confirm(lease,request(lease)),code('OPENING_SURFACE_STALE_LEASE'));
 const original=crypto.subtle.digest;let finish;crypto.subtle.digest=function(...args){return new Promise((resolve,reject)=>{finish=()=>original.apply(this,args).then(resolve,reject);});};
 try{const pending=p.replace(fixture());p.dispose();p.dispose();assert.equal(p.current(),null);await finish();await assert.rejects(pending,code('OPENING_SURFACE_REPLACED'));assert.throws(()=>p.clear(),code('OPENING_SURFACE_DISPOSED'));await assert.rejects(p.replace(fixture()),code('OPENING_SURFACE_DISPOSED'));assert.throws(()=>p.confirm(lease,request(lease)),code('OPENING_SURFACE_DISPOSED'));}finally{crypto.subtle.digest=original;}
});
test('two pending slots backpressure before snapshot without changing generation; all exit paths release slots',async()=>{
 const p=create(),base=await p.replace(fixture()),original=crypto.subtle.digest,waits=[];
 crypto.subtle.digest=function(...args){return new Promise((resolve,reject)=>waits.push({finish:()=>original.apply(this,args).then(resolve,reject),reject}));};
 try{
  const one=p.replace(fixture()),two=p.replace(fixture());let touched=0;const blocked={get mesh(){touched++;throw Error('must not snapshot');}};
  await assert.rejects(p.replace(blocked),code('OPENING_SURFACE_PENDING_LIMIT'));assert.equal(touched,0);assert.equal(waits.length,2);assert.equal(p.current(),null);
  await waits[1].finish();const winner=await two;assert.equal(winner.generation,base.generation+2);
  const malformed=fixture();malformed.units='m';await assert.rejects(p.replace(malformed),code('OPENING_SURFACE_INVALID_INPUT'));assert.equal(p.current(),winner);
  const third=p.replace(fixture());assert.equal(waits.length,3);await assert.rejects(p.replace(fixture()),code('OPENING_SURFACE_PENDING_LIMIT'));
  p.clear();await assert.rejects(p.replace(fixture()),code('OPENING_SURFACE_PENDING_LIMIT'));
  const rejected=assert.rejects(third,code('OPENING_SURFACE_HASH_FAILED'));waits[2].reject(Error('synthetic digest failure'));await rejected;
  const fourth=p.replace(fixture());assert.equal(waits.length,4);await waits[0].finish();await assert.rejects(one,code('OPENING_SURFACE_REPLACED'));
  await waits[3].finish();const last=await fourth;assert.equal(last.generation,winner.generation+3);assert.equal(p.current(),last);
 }finally{crypto.subtle.digest=original;}
});
test('health reports keep seams, closed shells and defects honest; no inferred outward direction or welding',async()=>{
 const p=create(),closed=fixture();closed.mesh.triangles.push([4,5,6],[4,6,7]);let lease=await p.replace(closed);assert.equal(lease.analysis.closedShell,true);assert.deepEqual(lease.analysis.candidates,[]);
 const seam=fixture();seam.mesh={nodes:[0,0,0,1,0,0,1,1,0,0,1,0,1,0,0,2,0,0,2,1,0,1,1,0],triangles:[[0,1,2],[0,2,3],[4,5,6],[4,6,7]],toleranceMm:1e-6};lease=await p.replace(seam);assert.ok(lease.analysis.rejected.some(r=>/SEAM/.test(r.code)));assert.equal(lease.analysis.candidates.length,0);
 const duplicate=fixture();duplicate.mesh.triangles.push([...duplicate.mesh.triangles[0]]);lease=await p.replace(duplicate);assert.equal(lease.analysis.candidates.length,0);assert.ok(lease.analysis.rejected.length);
 lease=await p.replace(fixture());assert.equal(lease.analysis.candidates[0].outward,'undetermined');const opposite=request(lease);opposite.outwardNormal=[0,0,-1];opposite.interiorPointMm=[0,0,10.5];assert.deepEqual(p.confirm(lease,opposite).source.openingCaps[0].normal,[0,0,-1]);
 for(const change of [r=>r.confirmed=false,r=>r.candidate=structuredClone(r.candidate),r=>r.outwardNormal=[0,0,2]]){const r=request(lease);change(r);if(r.candidate!==lease.analysis.candidates[0])r.candidate.pointsMm[0][0]+=.1;assert.throws(()=>p.confirm(lease,r));}
});
test('malformed fields/prototypes/accessors and numeric/count limits refuse without revoking the current lease',async()=>{
 const p=create(),lease=await p.replace(fixture());class Bad extends Array{}
 for(const change of [v=>v.units='m',v=>v.topologyIntent='closed-volume',v=>v.sourceIdentity=' ',v=>v.extra=1,v=>v.mesh.toleranceMm=0,v=>v.mesh.nodes[0]=Infinity,v=>v.mesh.nodes[0]=null,v=>v.mesh.nodes[0]=1e6+1,v=>v.mesh.triangles[0]=[0,0,1],v=>v.mesh.triangles[0]=[0,1,999],v=>v.mesh.nodes=new Bad(...v.mesh.nodes),v=>delete v.mesh.nodes[0],v=>v.mesh.nodes.extra=1,v=>v.mesh.nodes=new Float64Array(v.mesh.nodes),v=>v.mesh.triangles=Array.from({length:limits.triangles+1},()=>[0,1,2]),v=>v.mesh.nodes=Array((limits.nodes+1)*3).fill(0)]){
  const input=fixture();change(input);await assert.rejects(p.replace(input));assert.equal(p.current(),lease);
 }
 let touched=0;const input=fixture();Object.defineProperty(input.mesh,'nodes',{enumerable:true,get(){touched++;throw Error('getter');}});await assert.rejects(p.replace(input));assert.equal(touched,0);assert.equal(p.current(),lease);
 const bad=request(lease);Object.defineProperty(bad,'outwardNormal',{enumerable:true,get(){touched++;throw Error('getter');}});assert.throws(()=>p.confirm(lease,bad));assert.equal(touched,0);assert.equal(p.current(),lease);
});
test('declared node/triangle maxima execute within the fixed detector envelope and hashes bind order and tolerance',async()=>{
 const input=fixture();while(input.mesh.nodes.length<limits.nodes*3){const i=input.mesh.nodes.length/3;input.mesh.nodes.push(100+i,100,100);}while(input.mesh.triangles.length<limits.triangles)input.mesh.triangles.push([0,1,2]);const p=create(),full=await p.replace(input);assert.equal(full.analysis.nodeCount,512);assert.equal(full.analysis.triangleCount,1024);assert.ok(full.analysis.rejected.length);
 const base=await p.replace(fixture());for(const change of [v=>v.mesh.toleranceMm*=2,v=>v.sourceIdentity='other',v=>v.mesh.triangles.reverse(),v=>v.mesh.nodes.push(90,90,90)]){const input=fixture();change(input);assert.notEqual((await p.replace(input)).contentRevision,base.contentRevision);}
});
