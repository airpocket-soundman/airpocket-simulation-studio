import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPlanarHeatTransferOperator as build,serializePlanarHeatTransferOperator as save,loadPlanarHeatTransferOperator as load,applyPlanarHeatTransferOperator as apply,PLANAR_HEAT_OPERATOR_LIMITS as limits} from '../src/planar-heat-operator.js';
import {getProjectRevision} from '../src/project-revision.js';
const fixture=()=>({units:'mm',mesh:{nodes:[0,0,0,1,0,0,1,1,0,0,1,0,0,0,0,1,0,0,1,1,0,0,1,0,.5,.5,0]},sourceFaces:[{nodes:[0,1,2]},{nodes:[0,2,3]}],targetFaces:[{nodes:[4,8,5]},{nodes:[5,8,6]},{nodes:[6,8,7]},{nodes:[7,8,4]}]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-18+Math.abs(b)*1e-12,`${a} != ${b}`);
// Independent exact P1 target mass-matrix integral; no overlap production helpers.
function exactNodes(g,flux){const result=new Map();for(const f of g.targetFaces){
 const p=f.nodes.map(id=>g.mesh.nodes.slice(3*id,3*id+3)),u=p[1].map((x,k)=>x-p[0][k]),v=p[2].map((x,k)=>x-p[0][k]);
 const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2*1e-6,q=p.map(pt=>flux.base+pt.reduce((s,x,k)=>s+x*.001*flux.gradient[k],0));
 f.nodes.forEach((id,k)=>result.set(id,(result.get(id)??0)+area/12*(q.reduce((s,x)=>s+x,0)+q[k])));
 }return result;}
test('compiled affine moments survive save/reload and match every independently integrated target node',async()=>{
 for(const rotated of [false,true])for(const sign of [1,-1]){
  const g=fixture();let flux={base:1,gradient:[2000,0,0]};
  if(rotated){for(let i=0;i<g.mesh.nodes.length;i+=3){const [x,y,z]=g.mesh.nodes.slice(i,i+3);g.mesh.nodes.splice(i,3,7+z,-3+y,11-x);}flux={base:23,gradient:[0,0,-2000]};}
  flux.base*=sign;flux.gradient=flux.gradient.map(x=>x*sign);const before=structuredClone(g),op=await build(g),raw=save(op),restored=await load(raw,g),r=await apply(restored,g,flux);
  assert.deepEqual(restored,op);assert.equal(save(restored),raw);assert.equal((await build(g)).operatorRevision,op.operatorRevision);
  near(r.coveredAreaM2,1e-6);near(r.sourceW,sign*2e-6);near(r.targetW,sign*2e-6);near(r.sourceW+r.targetOutwardW,0);
  for(const [id,heat] of exactNodes(g,flux))near(r.nodeHeatW.get(id),heat);assert.deepEqual(g,before);
 }
});
test('constant, zero and zero-total sign-changing fields conserve heat without relative division by zero',async()=>{
 const g=fixture();for(let i=0;i<g.mesh.nodes.length;i+=3)g.mesh.nodes[i]-=.5;const op=await build(g);
 for(const flux of [2,0,{base:0,gradient:[2000,0,0]}]){
  const r=await apply(op,g,flux);near(r.sourceW,typeof flux==='number'?flux*1e-6:0);near(r.balanceErrorW,0);
 }
});
test('tampered coefficients, contract or node IDs are rejected even after rehashing',async()=>{
 const g=fixture(),op=await build(g);
 for(const mutate of [r=>r.rows[0].coefficients[0]*=2,r=>r.sourceCoefficients[1]+=1,r=>r.schemaVersion=2,r=>r.rows[0].nodeId=999,r=>r.units.load='J',r=>r.coverageTolerance=.1,r=>r.extra='unsupported']){
  const r=JSON.parse(save(op));mutate(r);await assert.rejects(load(JSON.stringify(r),g));
  const {operatorRevision,...payload}=r;r.operatorRevision=await getProjectRevision(payload);await assert.rejects(load(JSON.stringify(r),g),/does not match/);
 }
 const clone=JSON.parse(save(op));await assert.rejects(apply(clone,g,2),/Build or load/);assert.throws(()=>save(clone),/Build or load/);
 assert.throws(()=>{op.rows[0].coefficients[0]=999;},TypeError);
});
test('apply and reload bind independently to source and target geometry identities',async()=>{
 const g=fixture(),op=await build(g);
 for(const mutate of [x=>x.mesh.nodes[0]=.1,x=>x.mesh.nodes[12]=.1,x=>x.sourceFaces.reverse(),x=>x.targetFaces[0].nodes.reverse()]){
  const changed=structuredClone(g);mutate(changed);const before=structuredClone(changed);
  await assert.rejects(apply(op,changed,2),/geometry identity|coverage bounds/);await assert.rejects(load(save(op),changed));assert.deepEqual(changed,before);
 }
});
test('equal-area extreme aspect mismatch is refused before unbounded overlap-grid enumeration',async()=>{
 const g=fixture();for(let i=0;i<g.mesh.nodes.length;i+=3){const source=i<12;g.mesh.nodes[i]*=source?1e6:1e-5;g.mesh.nodes[i+1]*=source?1e-16:1e-5;}
 const before=structuredClone(g);await assert.rejects(build(g),/coverage bounds/);assert.deepEqual(g,before);
});
test('geometry and flux are snapshotted before asynchronous hashing',async()=>{
 const g=fixture(),original=structuredClone(g),building=build(g);g.mesh.nodes[0]=999;const op=await building;
 const input=structuredClone(original),loading=load(save(op),input);input.mesh.nodes[0]=999;assert.deepEqual(await loading,op);
 const applyingGeometry=structuredClone(original),flux={base:1,gradient:[2000,0,0]},applying=apply(op,applyingGeometry,flux);applyingGeometry.mesh.nodes[0]=999;flux.gradient[0]=0;near((await applying).sourceW,2e-6);
});
test('unsupported, nonfinite, partial, same-facing and oversized inputs are refused',async()=>{
 const g=fixture(),op=await build(g);
 for(const mutate of [x=>x.units='m',x=>x.mesh.nodes[0]=Infinity,x=>x.targetFaces.pop(),x=>x.targetFaces=x.targetFaces.map(f=>({nodes:[...f.nodes].reverse()})),x=>x.sourceFaces[0].nodes=[0,1,1],x=>x.mesh.nodes=Array((limits.nodes+1)*3).fill(0),x=>x.sourceFaces=Array(limits.facesPerSide+1).fill({nodes:[0,1,2]}),x=>x.options={coverageTolerance:.5}]){
  const bad=structuredClone(g);mutate(bad);const before=structuredClone(bad);await assert.rejects(build(bad));assert.deepEqual(bad,before);
 }
 for(const flux of [Infinity,{base:1,gradient:[1,NaN,0]},{base:1,gradient:[0,0]},{base:1,quadratic:[1,0,0]}])await assert.rejects(apply(op,g,flux));
 await assert.rejects(load(' '.repeat(limits.bytes+1),g),/byte capacity/);await assert.rejects(load('{',g),/JSON/);
 const huge=fixture();huge.mesh.nodes=huge.mesh.nodes.map(v=>v*1e6);const big=await build(huge);await assert.rejects(apply(big,huge,1e308),/Nonfinite/);
});
