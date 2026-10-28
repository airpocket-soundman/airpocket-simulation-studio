import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChannelLayerPlan} from '../src/channel-layer-plan.js';
import {createChannelLayerTet4} from '../src/channel-layer-tet4.js';
import {createChannelLayerBoundaryTransfer,getChannelLayerMeshRevision,validateChannelLayerBoundaryTransfer} from '../src/channel-layer-boundary-transfer.js';
const mesh=()=>createChannelLayerTet4({plan:createChannelLayerPlan({gapMm:10,firstHeightMm:.1,growthRatio:2,layersPerWall:3}),lengthMm:2,widthMm:1,maxAspectRatio:20,minimumCellHeightMm:.1});
const conditions=()=>({lowerWall:{type:'no-slip-wall'},upperWall:{type:'no-slip-wall'},xMin:{type:'velocity-inlet',velocityMps:[1,0,0]},xMax:{type:'pressure-outlet',pressurePa:0},zMin:{type:'symmetry'},zMax:{type:'symmetry'}});
const input=async()=>{const m=mesh();return {mesh:m,expectedMeshRevision:await getChannelLayerMeshRevision(m),conditions:conditions(),maxTetEdgeAspectRatio:30,minimumTetVolumeMm3:1e-6};};
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(b)),a+' != '+b);

test('all 60 oriented faces have stable IDs, unique Tet owners, explicit BCs and independently verified plane areas',async()=>{
 const i=await input(),r=await createChannelLayerBoundaryTransfer(i);assert.equal(r.faces.length,60);assert.equal(new Set(r.faces.map(f=>f.faceId)).size,60);
 assert.deepEqual(r.boundaries.map(b=>b.boundaryId),['lower-wall','upper-wall','inlet','outlet','side-z-min','side-z-max']);r.boundaries.forEach((b,j)=>close(b.areaMm2,[2,2,10,10,20,20][j]));
 for(const f of r.faces){
  const owner=r.elements.find(e=>e.tetrahedronId===f.tetrahedronId);assert.ok(f.nodeIds.every(id=>owner.nodeIds.includes(id)));
  const axis=f.outwardNormal.findIndex(n=>Math.abs(n)===1),planeAxes=[0,1,2].filter(a=>a!==axis),p=f.nodeIds.map(id=>i.mesh.nodes.slice(3*id,3*id+3));
  const [a,b]=planeAxes;let twiceArea=0;for(let j=0;j<3;j++)twiceArea+=p[j][a]*p[(j+1)%3][b]-p[(j+1)%3][a]*p[j][b];close(f.areaMm2,Math.abs(twiceArea)/2);
  assert.ok(f.outwardNormal.reduce((sum,n,j)=>sum+n*(f.centroidMm[j]-owner.centroidMm[j]),0)>0);
  assert.ok(r.boundaries.find(b=>b.boundaryId===f.boundaryId).faceIds.includes(f.faceId));
 }
 assert.equal(r.boundaries.find(b=>b.boundaryId==='inlet').condition.velocityMps[0],1);
 assert.equal(r.boundaries.find(b=>b.boundaryId==='outlet').condition.pressurePa,0);
 assert.equal(r.scope.solverConnected,false);assert.equal(r.scope.projectBoundaryApiConnected,false);
});

test('plate distances and Tet diagonal quality match analytical seven-cell values',async()=>{
 const r=await createChannelLayerBoundaryTransfer(await input());
 const heights=[.1,.2,.4,8.6,.4,.2,.1];
 for(const [index,e]of r.elements.entries()){
  const h=heights[Math.floor(index/6)];close(e.volumeMm3,2*h/6);close(e.edgeAspectRatio,Math.sqrt(2**2+1**2+h**2)/Math.min(1,h));
 }
 close(Math.min(...r.elements.map(e=>e.plateDistanceMm)),.025);
 const expected=[0,.1,.3,.7,.7,.3,.1,0];r.nodePlateDistancesMm.forEach((d,id)=>close(d,expected[Math.floor(id/4)]));
 close(r.elements.reduce((sum,e)=>sum+e.volumeMm3,0),20);
});

test('stale geometry and changed inputs are refused; cached inspection cannot override actual mesh',async()=>{
 const i=await input();i.mesh.lengthMm=3;await assert.rejects(createChannelLayerBoundaryTransfer(i));
 const stale=await input();stale.expectedMeshRevision='sha256:'+'0'.repeat(64);await assert.rejects(createChannelLayerBoundaryTransfer(stale),/Stale mesh/);
 const cached=await input();cached.mesh.inspection.boundaryFaces=[];cached.mesh.inspection.areasMm2.lowerWall=99;assert.equal((await createChannelLayerBoundaryTransfer(cached)).faces.length,60);
 for(const change of [i=>i.conditions.xMax.pressurePa=1,i=>i.conditions={...conditions(),xMax:{type:'pressure-outlet',pressurePa:1}},i=>i.maxTetEdgeAspectRatio=99,i=>i.expectedMeshRevision='sha256:'+'1'.repeat(64)]){
  const changing=await input(),pending=createChannelLayerBoundaryTransfer(changing);change(changing);await assert.rejects(pending,/input changed/);
 }
});

test('missing, extra and unsupported boundary conditions and stricter Tet thresholds fail without mutation',async()=>{
 const changes=[i=>delete i.conditions.zMin,i=>i.conditions.extra={type:'symmetry'},i=>i.conditions.lowerWall={type:'symmetry'},i=>i.conditions.xMin.velocityMps=[-1,0,0],i=>i.conditions.xMin.velocityMps=[1,.1,0],i=>i.conditions.xMax.pressurePa=Infinity,i=>i.maxTetEdgeAspectRatio=20,i=>i.minimumTetVolumeMm3=.04];
 for(const change of changes){const i=await input();change(i);const before=structuredClone(i);await assert.rejects(createChannelLayerBoundaryTransfer(i));assert.deepEqual(i,before);}
});

test('transfer is detached, ordered and JSON reproducible with all six conditions retained',async()=>{
 const i=await input(),before=structuredClone(i),a=await createChannelLayerBoundaryTransfer(i),b=await createChannelLayerBoundaryTransfer(i);
 assert.deepEqual(i,before);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
 a.boundaries[2].condition.velocityMps[0]=99;a.faces[0].nodeIds[0]=99;assert.deepEqual(i,before);assert.equal(b.boundaries[2].condition.velocityMps[0],1);
 i.conditions.xMax.pressurePa=100;const changed=await createChannelLayerBoundaryTransfer(i);assert.equal(changed.meshRevision,b.meshRevision);assert.notEqual(changed.transferRevision,b.transferRevision);
});

test('downstream validation refuses altered normal, owner, area, condition and revision',async()=>{
 const i=await input(),transfer=await createChannelLayerBoundaryTransfer(i);
 assert.deepEqual(await validateChannelLayerBoundaryTransfer(i,JSON.parse(JSON.stringify(transfer))),transfer);
 for(const change of [r=>r.faces[0].outwardNormal=[0,0,1],r=>r.faces[0].tetrahedronId='channel-tet-999',r=>r.faces[0].areaMm2=99,r=>r.boundaries[2].condition.velocityMps[0]=2,r=>r.transferRevision='sha256:'+'0'.repeat(64),r=>r.faces.push({...r.faces[0]}),r=>r.faces[0].faceId='x'.repeat(201)]){
  const bad=structuredClone(transfer);change(bad);const before=structuredClone(bad);await assert.rejects(validateChannelLayerBoundaryTransfer(i,bad));assert.deepEqual(bad,before);
 }
});

test('custom array prototypes cannot hide corrupted transfer faces behind canonical map output',async()=>{
 const i=await input(),valid=await createChannelLayerBoundaryTransfer(i),received=structuredClone(valid);
 const {canonicalJson}=await import('../src/project-revision.js');const originalFaces=valid.faces.map(face=>canonicalJson(face)).join(',');let invoked=false;
 received.faces[0].nodeIds[0]=999;Object.setPrototypeOf(received.faces,{__proto__:Array.prototype,map(){invoked=true;return {join(){return originalFaces;}};}});
 await assert.rejects(validateChannelLayerBoundaryTransfer(i,received),e=>e.code==='CHANNEL_BOUNDARY_TRANSFER_INVALID');assert.equal(invoked,false);assert.equal(received.faces[0].nodeIds[0],999);
 assert.deepEqual(await validateChannelLayerBoundaryTransfer(i,JSON.parse(JSON.stringify(valid))),valid);
});

test('input mesh and inlet arrays reject custom prototypes before inherited serialization or array methods',async()=>{
 for(const target of ['nodes','tetrahedra','tetrahedron','inlet']){
  const i=await input();const array=target==='inlet'?i.conditions.xMin.velocityMps:target==='tetrahedron'?i.mesh.tetrahedra[0]:i.mesh[target];let invoked=false;
  Object.setPrototypeOf(array,{__proto__:Array.prototype,toJSON(){invoked=true;return [];},every(){invoked=true;return true;}});
  await assert.rejects(createChannelLayerBoundaryTransfer(i),e=>e.code==='CHANNEL_BOUNDARY_TRANSFER_INVALID');assert.equal(invoked,false);
 }
});
