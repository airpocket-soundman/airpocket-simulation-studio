import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectProjectGeometry} from '../src/geometry-inspection.js';
import {createProjectFromBuiltin,createProjectFromStl} from '../src/project-import.js';

const box=()=>createProjectFromBuiltin({source:{kind:'box',bounds:[1,2,3,10,20,40]}});
test('default geometry summary is compact and clearly distinguishes min/max from dimensions',async()=>{
  const project=box(),before=structuredClone(project),result=await inspectProjectGeometry(project);
  assert.equal(result.schemaVersion,1);assert.deepEqual(result.boundsMm,{min:[1,2,3],max:[11,22,43],size:[10,20,40]});
  assert.equal(result.meshCount,1);assert.equal(result.triangleCount,12);assert.equal(result.faceCount,6);
  assert.equal(result.mesh,undefined);assert.equal(result.persistentCadFaceIds,false);assert.deepEqual(project,before);
  assert.ok(JSON.stringify(result).length<600);
});

test('face pages report observed area, weighted centroid and normals without returning triangles',async()=>{
  const result=await inspectProjectGeometry(box(),{meshIndex:0,faceOffset:0,faceLimit:2}),mesh=result.mesh,page=mesh.facePage;
  assert.equal(page.returned,2);assert.equal(page.nextOffset,2);assert.equal(page.total,6);assert.match(mesh.displayMeshRevision,/^sha256:[a-f0-9]{64}$/);
  const face=page.faces[0];assert.equal(face.triangleCount,2);assert.equal(face.areaMm2,800);assert.deepEqual(face.boundsMm.size,[0,20,40]);assert.deepEqual(face.areaCentroidMm,[11,12,23]);
  assert.deepEqual(face.areaWeightedAverageNormal,[1,0,0]);assert.equal(face.normalCoherence,1);assert.equal(face.surfaceClassification,'not-inferred');
  assert.equal(face.triangles,undefined);assert.equal(face.positions,undefined);assert.equal(mesh.faceIdentity.persistentCadFace,false);
});

test('face scope changes with geometry or face mapping, independent of material',async()=>{
  const project=box(),first=await inspectProjectGeometry(project,{meshIndex:0});
  project.material='樹脂';assert.equal((await inspectProjectGeometry(project,{meshIndex:0})).mesh.displayMeshRevision,first.mesh.displayMeshRevision);
  project.meshes[0].positions[0]+=.1;assert.notEqual((await inspectProjectGeometry(project,{meshIndex:0})).mesh.displayMeshRevision,first.mesh.displayMeshRevision);
  project.meshes[0].positions[0]-=.1;project.meshes[0].faceIds[0]=20;assert.notEqual((await inspectProjectGeometry(project,{meshIndex:0})).mesh.displayMeshRevision,first.mesh.displayMeshRevision);
});

test('large face groups are paginated, sparse identities are sorted and offsets terminate',async()=>{
  const project=box(),triangle=project.meshes[0].positions.slice(0,9);
  project.meshes[0]={positions:Array.from({length:120},()=>triangle).flat(),faceIds:Array.from({length:120},(_,i)=>240-i*2)};project.selection=[[]];
  const result=await inspectProjectGeometry(project,{meshIndex:0,faceOffset:50,faceLimit:50});assert.equal(result.mesh.facePage.faces.length,50);assert.equal(result.mesh.facePage.nextOffset,100);
  assert.ok(result.mesh.facePage.faces.every((face,i,array)=>i===0||face.faceId>array[i-1].faceId));
  const empty=await inspectProjectGeometry(project,{meshIndex:0,faceOffset:120});assert.equal(empty.mesh.facePage.returned,0);assert.equal(empty.mesh.facePage.nextOffset,null);
});

test('opposing triangles do not claim a planar CAD surface and degenerate groups have null centroid',async()=>{
  const project=box();project.meshes=[{positions:[0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,1,0,0,2,2,2,2,2,2,2,2,2],faceIds:[0,0,1]}];project.selection=[[]];
  const faces=(await inspectProjectGeometry(project,{meshIndex:0})).mesh.facePage.faces;
  assert.deepEqual(faces[0].areaWeightedAverageNormal,[0,0,0]);assert.equal(faces[0].normalCoherence,0);assert.equal(faces[0].surfaceClassification,'not-inferred');
  assert.equal(faces[1].areaCentroidMm,null);assert.equal(faces[1].areaWeightedAverageNormal,null);assert.equal(faces[1].degenerateTriangleCount,1);
});

test('STL identities are explicitly triangle-local rather than persistent CAD faces',async()=>{
  const positions=box().meshes[0].positions,lines=['solid box'];for(let i=0;i<positions.length;i+=9)lines.push('facet normal 0 0 0','outer loop',...[0,3,6].map(k=>'vertex '+positions.slice(i+k,i+k+3).join(' ')),'endloop','endfacet');lines.push('endsolid box');
  const project=createProjectFromStl({bytes:new TextEncoder().encode(lines.join('\n')),scaleToMm:1}),result=await inspectProjectGeometry(project,{meshIndex:0});
  assert.equal(result.mesh.faceIdentity.kind,'stl-triangle-index');assert.equal(result.mesh.faceIdentity.persistentCadFace,false);assert.equal(result.mesh.faceCount,12);
});

test('invalid pages, IDs, inherited options and malformed projects are rejected',async()=>{
  for(const options of [{meshIndex:-1},{meshIndex:99},{meshIndex:'0'},{meshIndex:0,faceLimit:51},{meshIndex:0,faceLimit:0},{meshIndex:0,faceOffset:-1},{faceLimit:2},{constructor:'bad'},Object.create({meshIndex:0})])await assert.rejects(inspectProjectGeometry(box(),options));
  const project=box();project.meshes[0].faceIds[0]=-1;await assert.rejects(inspectProjectGeometry(project),/safe integers/);
  await assert.rejects(inspectProjectGeometry({version:1,meshes:[],conditions:[]}));
});

test('inspection describes a coherent version when caller changes inputs during digest',async()=>{
  const project=box(),pending=inspectProjectGeometry(project,{meshIndex:0});
  project.meshes[0].faceIds.push(9);project.sourceModel={kind:'step',data:''};
  const result=await pending;assert.equal(result.mesh.triangleCount,12);assert.equal(result.mesh.faceIdentity.kind,'display-face-group-index');
});
