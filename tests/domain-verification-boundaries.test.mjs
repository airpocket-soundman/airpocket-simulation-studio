import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractOpeningLoopCandidates} from '../src/opening-loop-candidates.js';
import {confirmOpeningCandidate} from '../src/opening-candidate-cap.js';
import {createChannelLayerPlan} from '../src/channel-layer-plan.js';
import {createChannelLayerTet4,CHANNEL_TET4_MAX_ELEMENTS,CHANNEL_TET4_MAX_NODES} from '../src/channel-layer-tet4.js';
const opening=()=>{
 const mesh={nodes:[-1,-1,0,1,-1,0,1,1,0,-1,1,0,-1,-1,10,1,-1,10,1,1,10,-1,1,10],triangles:[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7],[0,2,1],[0,3,2]],toleranceMm:1e-6};
 return {mesh,meshVersion:0,enclosure:[-2,-2,-1,4,4,12],confirmation:{confirmed:true,meshVersion:0,capId:'C'.repeat(64),candidate:extractOpeningLoopCandidates(mesh).candidates[0],outwardNormal:[0,0,1],interiorPointMm:[0,0,5]}};
};
test('CFDPORT1 cap identity and mesh version accept their documented boundaries, reject outside',()=>{
 const i=opening();assert.equal(confirmOpeningCandidate(i).source.openingCaps[0].id.length,64);
 i.meshVersion=i.confirmation.meshVersion=Number.MAX_SAFE_INTEGER;assert.equal(confirmOpeningCandidate(i).meshVersion,Number.MAX_SAFE_INTEGER);
 for(const change of [x=>x.confirmation.capId+='C',x=>x.confirmation.capId='0invalid',x=>x.meshVersion=x.confirmation.meshVersion=Number.MAX_SAFE_INTEGER+1,x=>x.meshVersion=x.confirmation.meshVersion=-1,x=>x.meshVersion=x.confirmation.meshVersion=.5]){
  const invalid=structuredClone(i);change(invalid);const before=structuredClone(invalid);assert.throws(()=>confirmOpeningCandidate(invalid));assert.deepEqual(invalid,before);
 }
});
test('CFDPORT1 strict inward clearance and unit normal tolerance preserve the existing cap contract',()=>{
 const i=opening();i.confirmation.interiorPointMm=[0,0,10-2e-6];assert.equal(confirmOpeningCandidate(i).status,'confirmed');
 i.confirmation.interiorPointMm=[0,0,10-.5e-6];assert.throws(()=>confirmOpeningCandidate(i),/inward/);
 i.confirmation.interiorPointMm=[0,0,5];i.confirmation.outwardNormal=[0,0,1+1e-9];assert.deepEqual(confirmOpeningCandidate(i).source.openingCaps[0].normal,i.confirmation.outwardNormal);
 i.confirmation.outwardNormal=[0,0,1+1e-6];assert.throws(()=>confirmOpeningCandidate(i),/unit/);
});
test('CFDMESH1 maximum retained mesh independently integrates volume and outward boundary normals',()=>{
 const plan=createChannelLayerPlan({gapMm:1000,firstHeightMm:1,growthRatio:1,layersPerWall:256});
 const mesh=createChannelLayerTet4({plan,lengthMm:2,widthMm:1,maxAspectRatio:1000,minimumCellHeightMm:1});
 assert.equal(mesh.nodes.length/3,CHANNEL_TET4_MAX_NODES);assert.equal(mesh.tetrahedra.length,CHANNEL_TET4_MAX_ELEMENTS);
 const point=id=>mesh.nodes.slice(3*id,3*id+3),sub=(a,b)=>a.map((v,k)=>v-b[k]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);
 let volume=0;for(const tet of mesh.tetrahedra){const [a,b,c,d]=tet.map(point),v=dot(sub(b,a),cross(sub(c,a),sub(d,a)))/6;assert.ok(v>0);volume+=v;}
 assert.ok(Math.abs(volume-2000)<=2000*1e-12);
 const areas={},areaVector=[0,0,0];
 for(const face of mesh.inspection.boundaryFaces){const [a,b,c]=face.nodes.map(point),normal=cross(sub(b,a),sub(c,a)),centroid=a.map((v,k)=>(v+b[k]+c[k])/3),fromCenter=sub(centroid,[1,500,.5]);assert.ok(dot(normal,fromCenter)>0);const area=Math.hypot(...normal)/2;areas[face.tag]=(areas[face.tag]??0)+area;for(let k=0;k<3;k++)areaVector[k]+=normal[k]/2;}
 assert.deepEqual(areas,{lowerWall:2,xMin:1000,zMin:2000,zMax:2000,xMax:1000,upperWall:2});
 assert.deepEqual(areaVector,[0,0,0]);
});
