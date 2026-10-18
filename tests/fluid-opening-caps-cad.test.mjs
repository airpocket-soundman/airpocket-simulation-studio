import {test} from 'node:test';
import assert from 'node:assert/strict';
import load from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {validateInternalMesh} from '../src/internal-fluid.js';
import {createFluidDomainOperations} from '../src/fluid-domain-operations.js';
import {createStudioApi} from '../src/studio-api.js';
import {getProjectRevision} from '../src/project-revision.js';
import {openingCapDistance} from '../src/fluid-opening-caps.js';
const t=Math.SQRT1_2,source={kind:'fluidDomain',mode:'internal',solid:{kind:'tube',center:[0,0,0],axis:1,outerRadius:12,innerRadius:8,length:60},enclosure:[-12,-30,-12,24,60,24],seedPoint:[0,0,0],portPlanes:[],openingCaps:[{id:'inlet',point:[0,-10,0],normal:[-t,-t,0]},{id:'outlet',point:[0,10,0],normal:[t,t,0]}]};

test('oblique half-space caps retain the seed-connected tube volume and exact CAD reference',async()=>{
 const mesh=await generateMesh(load,source,{size:3}),d=mesh.domainSelection;
 // x+y=-10 and x+y=10 bound a constant 20 mm axial length at every (x,z).
 assert.ok(Math.abs(d.cadVolumeMm3/(Math.PI*64*20)-1)<1e-8);
 assert.ok(Math.abs(mesh.summary.volumeMm3/d.cadVolumeMm3-1)<.025);
 assert.equal(d.channel,undefined);assert.deepEqual([...new Set(d.ports.map(p=>p.capId))].sort(),['inlet','outlet']);
 for(const cap of source.openingCaps){
  const faces=mesh.surface.filter(f=>f.openingCapId===cap.id);assert.ok(faces.length);
  let area=0;for(const face of faces){for(const node of face.nodes)assert.ok(Math.abs(openingCapDistance(cap,mesh.nodes.slice(3*node,3*node+3)))<1e-5);const [a,b,c]=face.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3)),u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);area+=.5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);}assert.ok(Math.abs(area/(Math.PI*64*Math.SQRT2)-1)<.025);
 }
 for(let i=0;i<mesh.nodes.length;i+=3)assert.ok(source.openingCaps.every(cap=>openingCapDistance(cap,mesh.nodes.slice(i,i+3))<1e-5));
 validateInternalMesh(JSON.parse(JSON.stringify(mesh)),source);
 const studio=createStudioApi();studio.loadProject({version:1,sourceModel:source,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],study:{kind:'fluidDomain'},materialProperties:{},conditions:[]});const input=studio.exportProject(),inputRevision=await getProjectRevision(input),operations=createFluidDomainOperations({studio,getMeshJob:()=>({job:{jobId:'cap-mesh',operation:'mesh',state:'succeeded',executionSettled:true,inputRevision},output:{input,mesh}})}),applied=await operations.applyMesh({expectedRevision:inputRevision,jobId:'cap-mesh'});assert.deepEqual(applied.domainSelection.ports.map(p=>p.capId).sort(),['inlet','outlet']);assert.deepEqual(studio.exportProject().sourceModel,source);
 const roundtrip=JSON.parse(JSON.stringify(studio.exportProject()));studio.loadProject(roundtrip);assert.deepEqual(studio.exportProject(),roundtrip);
 const bad=structuredClone(mesh);bad.surface.find(f=>f.openingCapId==='inlet').openingCapId='outlet';assert.throws(()=>validateInternalMesh(bad,source));
 const relabeled=structuredClone(mesh),face=relabeled.surface.find(f=>f.openingCapId==='inlet');face.faceTag=999999;delete face.openingCapId;assert.throws(()=>validateInternalMesh(relabeled,source));
 const holed=structuredClone(mesh);holed.surface.splice(holed.surface.findIndex(f=>f.openingCapId==='inlet'),1);assert.throws(()=>validateInternalMesh(holed,source),/incomplete/);
 const missing=structuredClone(source);missing.openingCaps.push({id:'unused',point:[10,0,0],normal:[1,0,0]});await assert.rejects(generateMesh(load,missing,{size:3}),/does not intersect/);
});
