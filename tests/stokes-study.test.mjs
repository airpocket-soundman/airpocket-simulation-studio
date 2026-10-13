import {test} from 'node:test';
import assert from 'node:assert/strict';
import initialize from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {validateStokesStudy,stokesBoundary} from '../src/stokes-study.js';
import {createStudioApi} from '../src/studio-api.js';
const source={kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:5},enclosure:[-20,-20,-20,40,40,40]},study={kind:'creepingFlow',dynamicViscosity:1,fluidDensity:1000,freeStreamVelocity:[.001,0,0]};
test('Stokes study rejects invalid velocity, material and reference scales atomically',()=>{
 validateStokesStudy(study);
 const project={version:1,sourceModel:source,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],study},api=createStudioApi();api.loadProject(project);const saved=api.exportProject();
 for(const changes of [{dynamicViscosity:0},{fluidDensity:0},{freeStreamVelocity:[0,0,0]},{freeStreamVelocity:[Infinity,0,0]},{freeStreamVelocity:[1,0]},{referenceLengthMm:0},{referenceLengthMm:101}]){
  assert.throws(()=>validateStokesStudy({...study,...changes}));assert.throws(()=>api.loadProject({...project,study:{...study,...changes}}));assert.deepEqual(api.exportProject(),saved);
 }
 for(const changes of [{sourceModel:{...source,mode:'internal'}},{sourceModel:{...source,enclosure:{kind:'sphere',center:[0,0,0],radius:30}}},{conditions:[{type:'force',value:1,direction:[1,0,0],regions:[{mesh:0,triangles:[0]}]}]}]){assert.throws(()=>api.loadProject({...project,...changes}),/Stokes/);assert.deepEqual(api.exportProject(),saved);}
});
test('Stokes boundary classifies real Gmsh box and solid facets and derives a safe body scale',async()=>{
 const mesh=await generateMesh(initialize,source,{size:6,maxElements:8000}),before=structuredClone(mesh),boundary=stokesBoundary(mesh,source,study);
 assert.ok(Math.abs(boundary.referenceLengthMm-10)<1e-5);assert.equal(boundary.pressureGauge.valuePa,0);assert.deepEqual(boundary.velocity.get(boundary.pressureGauge.node),study.freeStreamVelocity);
 assert.deepEqual(new Set(boundary.velocity.keys()),new Set(mesh.surface.flatMap(face=>face.nodes)));
 for(const face of mesh.surface)for(const node of face.nodes)assert.deepEqual(boundary.velocity.get(node),boundary.bodyFaceTags.includes(face.faceTag)?[0,0,0]:study.freeStreamVelocity);
 assert.deepEqual(mesh,before);assert.throws(()=>stokesBoundary(mesh,source,{...study,referenceLengthMm:5}),/smaller than/);assert.throws(()=>stokesBoundary(mesh,source,{...study,freeStreamVelocity:[.1,0,0]}),/Reynolds/);
 const missing=structuredClone(mesh);missing.surface=missing.surface.filter(face=>boundary.bodyFaceTags.includes(face.faceTag));assert.throws(()=>stokesBoundary(missing,source,study),/distinct/);
 const wrongBounds=structuredClone(mesh);wrongBounds.solidBoundsMm=[-2,-2,-2,4,4,4];assert.throws(()=>stokesBoundary(wrongBounds,source,study),/CAD bounding box/);
 const absentBounds=structuredClone(mesh);delete absentBounds.solidBoundsMm;assert.throws(()=>stokesBoundary(absentBounds,{...source,solid:{kind:'step',data:'AAAA'}},study),/original CAD/);
});
