import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChannelLayerPlan} from '../src/channel-layer-plan.js';
import {createChannelLayerTet4,inspectChannelLayerTet4,CHANNEL_TET4_MAX_NODES,CHANNEL_TET4_MAX_ELEMENTS} from '../src/channel-layer-tet4.js';
const input=()=>({plan:createChannelLayerPlan({gapMm:10,firstHeightMm:0.1,growthRatio:2,layersPerWall:3}),lengthMm:2,widthMm:1,maxAspectRatio:20,minimumCellHeightMm:0.1});
// Independent scalar triple product, rather than the implementation's geometry helper.
const volume=(mesh,t)=>{const [a,b,c,d]=t.map(i=>mesh.nodes.slice(i*3,i*3+3));const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),w=d.map((x,i)=>x-a[i]);return (u[0]*v[1]*w[2]+u[1]*v[2]*w[0]+u[2]*v[0]*w[1]-u[2]*v[1]*w[0]-u[1]*v[0]*w[2]-u[0]*v[2]*w[1])/6;};

test('public inspection requires explicit millimetre units and supported output',()=>{
 for(const [field,values] of [['units',['m',null,undefined]],['output',['untrusted',null,undefined]]])for(const value of values){
  const m=createChannelLayerTet4(input());m[field]=value;const before=structuredClone(m);
  assert.throws(()=>inspectChannelLayerTet4(m),/units|output/);assert.deepEqual(m,before);
 }
});

test('absolute sub-picometre tolerance cannot admit under-height layers',()=>{
 const i={plan:createChannelLayerPlan({gapMm:1e-9,firstHeightMm:1e-14,growthRatio:1,layersPerWall:1}),lengthMm:1e-9,widthMm:1e-9,maxAspectRatio:100001,minimumCellHeightMm:5e-13};
 const before=structuredClone(i);assert.throws(()=>createChannelLayerTet4(i),/below the minimum/);assert.deepEqual(i,before);
 i.minimumCellHeightMm=1e-14;assert.equal(createChannelLayerTet4(i).tetrahedra.length,18);
});

test('hard capacity limits apply before conversion and inspection allocations',()=>{
 const i=input();i.plan.layersPerWall=257;
 assert.throws(()=>createChannelLayerTet4(i),/capacity/);
 const plan=createChannelLayerPlan({gapMm:1000,firstHeightMm:1,growthRatio:1,layersPerWall:300,maxLayers:600});
 assert.throws(()=>createChannelLayerTet4({...input(),plan,maxAspectRatio:400,minimumCellHeightMm:1}),/capacity/);
 const m=createChannelLayerTet4(input());m.nodes=new Array(CHANNEL_TET4_MAX_NODES*3+3);assert.throws(()=>inspectChannelLayerTet4(m),/capacity/);
 const n=createChannelLayerTet4(input());n.tetrahedra=new Array(CHANNEL_TET4_MAX_ELEMENTS+1);assert.throws(()=>inspectChannelLayerTet4(n),/capacity/);
 const maximum=createChannelLayerPlan({gapMm:1000,firstHeightMm:1,growthRatio:1,layersPerWall:256});
 const accepted=createChannelLayerTet4({...input(),plan:maximum,maxAspectRatio:1000,minimumCellHeightMm:1});
 assert.equal(accepted.nodes.length/3,CHANNEL_TET4_MAX_NODES);assert.equal(accepted.tetrahedra.length,CHANNEL_TET4_MAX_ELEMENTS);
});
test('seven reference cells produce conforming positive Tet4 and independently measured volume/walls',()=>{
 const mesh=createChannelLayerTet4(input());
 assert.equal(mesh.nodes.length/3,32);assert.equal(mesh.tetrahedra.length,42);
 const volumes=mesh.tetrahedra.map(t=>volume(mesh,t));assert.ok(volumes.every(v=>v>0));assert.ok(Math.abs(volumes.reduce((a,b)=>a+b,0)-20)/20<=1e-12);
 // Six internal faces per cell plus two triangles per adjacent cell pair.
 assert.equal(mesh.inspection.internalFaceCount,7*6+6*2);assert.equal(mesh.inspection.boundaryFaces.length,7*8+4);
 for(const wallId of [0,1]){
  const triangles=mesh.inspection.boundaryFaces.filter(f=>f.wallId===wallId);assert.equal(triangles.length,2);
  let area=0;for(const face of triangles){const p=face.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3));assert.ok(p.every(v=>v[1]===(wallId===0?0:10)));area+=Math.abs((p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[1][2]-p[0][2])*(p[2][0]-p[0][0]))/2;}
  assert.equal(area,2);
 }
 assert.equal(mesh.scope.solverConnected,false);assert.equal(mesh.scope.gmshConnected,false);
});
test('thresholds, reversed coordinates and huge factors are refused without mutation',()=>{
 for(const change of [i=>i.minimumCellHeightMm=0.11,i=>i.maxAspectRatio=19,i=>i.lengthMm=1e308,i=>[i.plan.coordinatesMm[1],i.plan.coordinatesMm[2]]=[i.plan.coordinatesMm[2],i.plan.coordinatesMm[1]]]){
  const i=input();change(i);const before=structuredClone(i);assert.throws(()=>createChannelLayerTet4(i));assert.deepEqual(i,before);
 }
});
test('missing cells, duplicate elements, flipped orientation and incompatible interface diagonals are refused',()=>{
 const original=createChannelLayerTet4(input());
 for(const change of [m=>m.tetrahedra.splice(6,6),m=>m.tetrahedra.push([...m.tetrahedra[0]]),m=>[m.tetrahedra[0][0],m.tetrahedra[0][1]]=[m.tetrahedra[0][1],m.tetrahedra[0][0]],m=>{for(const tet of m.tetrahedra.slice(6,12))for(let j=0;j<4;j++){const id=tet[j];if(id>=4&&id<8)tet[j]=id===4?5:id===5?4:id===6?7:6;}}]){
  const changed=structuredClone(original);change(changed);const before=structuredClone(changed);assert.throws(()=>inspectChannelLayerTet4(changed));assert.deepEqual(changed,before);
 }
});
test('deterministic detached ordering, serialization, and read-only inspection',()=>{
 const i=input(),before=structuredClone(i),a=createChannelLayerTet4(i),b=createChannelLayerTet4(i);assert.deepEqual(i,before);assert.deepEqual(a,b);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
 const saved=structuredClone(a);assert.deepEqual(inspectChannelLayerTet4(a),a.inspection);assert.deepEqual(a,saved);a.nodes[0]=99;assert.equal(b.nodes[0],0);
});
