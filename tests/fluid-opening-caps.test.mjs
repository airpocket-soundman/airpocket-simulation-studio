import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateOpeningCaps,openingCapDistance,clipOpeningCaps,capForCadFace} from '../src/fluid-opening-caps.js';
import {validateFluidDomain} from '../src/fluid-domain.js';
import {prepareFluidDomainProject} from '../src/fluid-domain-operations.js';
import {createStudioApi} from '../src/studio-api.js';
import {inspectProjectInput} from '../src/project-input-inspection.js';
import {inputOperationContracts} from '../src/browser-operation-input-contracts.js';
import {validateInternalMesh} from '../src/internal-fluid.js';
const t=Math.SQRT1_2;
function source(){return {kind:'fluidDomain',mode:'internal',solid:{kind:'tube',center:[0,0,0],axis:1,outerRadius:12,innerRadius:8,length:60},enclosure:[-12,-30,-12,24,60,24],seedPoint:[0,0,0],portPlanes:[],openingCaps:[{id:'inlet',point:[0,-10,0],normal:[-t,-t,0]},{id:'outlet',point:[0,10,0],normal:[t,t,0]}]};}

test('half-space caps require explicit bounded points, unit outward normals and the inward seed side',()=>{
 const s=source(),before=structuredClone(s);validateFluidDomain(s);assert.deepEqual(s,before);
 for(const mutate of [s=>s.openingCaps[0].normal=[t,t,0],s=>s.openingCaps[0].normal=[0,-2,0],s=>s.openingCaps[0].normal=[0,0,0],s=>s.openingCaps[0].normal=[,1,0],s=>s.openingCaps[0].point=[,0,0],s=>s.openingCaps[0].point=[0,0,0],s=>s.openingCaps[0].point=[100,0,0],s=>s.openingCaps[0].point[0]=Infinity,s=>s.openingCaps[0].id='outlet',s=>s.openingCaps.push(structuredClone(s.openingCaps[0])),s=>s.mode='exterior',s=>s.openingCaps=[],s=>s.openingCaps[0].guessed=true]){const bad=source();mutate(bad);assert.throws(()=>validateFluidDomain(bad));}
 const duplicate=source();duplicate.openingCaps.push({...structuredClone(duplicate.openingCaps[0]),id:'duplicate'});assert.throws(()=>validateOpeningCaps(duplicate),/Duplicate/);
 const extreme=source();extreme.enclosure=[0,0,0,1e308,1e308,1e308];assert.throws(()=>validateOpeningCaps(extreme),/numerical/);
});

test('clipping removes the explicitly outward half-space without rewriting caller input',()=>{
 const s=source(),before=structuredClone(s),rotations=[],translations=[],cuts=[];let next=10;
 const g={model:{occ:{addBox:()=>++next,rotate:(_tags,_x,_y,_z,...r)=>rotations.push(r),translate:(_tags,...p)=>translations.push(p),cut:(objects,tools)=>{cuts.push({objects,tools});return {outDimTags:[3,++next]};}}}};
 const last=clipOpeningCaps(g,3,s);assert.equal(cuts.length,2);assert.equal(last,cuts[1].objects[1]+2);
 for(const [i,r]of rotations.entries()){
  const cap=s.openingCaps[i],[ax,ay,az,angle]=r,length=Math.hypot(ax,ay,az),axis=[ax/length,ay/length,az/length],rotatedZ=[axis[1]*Math.sin(angle),-axis[0]*Math.sin(angle),Math.cos(angle)],world=translations[i].map((v,k)=>v+rotatedZ[k]);
  assert.ok(openingCapDistance(cap,world)>.99);assert.ok(openingCapDistance(cap,s.seedPoint)<0);
 }
 const axial=source();axial.openingCaps=[{id:'lower',point:[0,0,-5],normal:[0,0,-1]},{id:'upper',point:[0,0,5],normal:[0,0,1]}];rotations.length=0;translations.length=0;clipOpeningCaps(g,3,axial);assert.deepEqual(rotations,[[1,0,0,Math.PI]]);assert.deepEqual(translations,[[0,0,-5],[0,0,5]]);
 assert.deepEqual(s,before);assert.equal(clipOpeningCaps(g,77,{...s,openingCaps:undefined}),77);
 assert.throws(()=>clipOpeningCaps({model:{occ:{...g.model.occ,cut:()=>({outDimTags:[]})}}},3,s),/exactly one/);
});

test('planar CAD cap classification uses both plane offset and normal, not axis-aligned bounds',()=>{
 const s=source(),cap=s.openingCaps[0],g={model:{getType:()=>({entityType:'Plane'}),occ:{getCenterOfMass:()=>({x:0,y:-10,z:0})},getParametrization:()=>({parametricCoord:[0,0]}),getNormal:()=>({normals:[t,t,0]})}};
 assert.equal(capForCadFace(g,1,s.openingCaps),cap);g.model.getNormal=()=>({normals:[0,0,1]});assert.equal(capForCadFace(g,1,s.openingCaps),undefined);
});

test('shared source/API/semantic preparation retain caps and reject incompatible updates atomically',()=>{
 const s=source(),original={version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],sourceModel:s.solid,conditions:[]},prepared=prepareFluidDomainProject(original,{mode:'internal',enclosure:s.enclosure,seedPoint:s.seedPoint,portPlanes:[],openingCaps:s.openingCaps}),api=createStudioApi();
 assert.deepEqual(prepared.sourceModel,s);assert.equal(prepared.study.kind,'fluidDomain');api.loadProject(prepared);const saved=JSON.parse(JSON.stringify(api.exportProject()));api.loadProject(saved);assert.deepEqual(api.exportProject(),saved);
 assert.throws(()=>api.loadProject({...saved,sourceModel:{...s,openingCaps:[{...s.openingCaps[0],normal:[0,1,0]}]}}));assert.deepEqual(api.exportProject(),saved);
 assert.throws(()=>prepareFluidDomainProject(original,{mode:'exterior',enclosure:'box',paddingMm:5,openingCaps:s.openingCaps}),/Exterior/);
});

test('saved cap mesh rejects changed planes, outward nodes, missing IDs and incomplete cap tags',()=>{
 const s=source(),a=[0,-10,0],b=[0,10,0],nodes=[...a,...a.map((x,k)=>x+[t,-t,0][k]),...a.map((x,k)=>x+[0,0,1][k]),...b,...b.map((x,k)=>x+[t,-t,0][k]),...b.map((x,k)=>x+[0,0,1][k])],mesh={nodes,tetrahedra:[[0,1,2,3],[1,2,3,4],[2,3,4,5]],surface:[],domainSelection:{mode:'internal',seedPoint:[0,0,0],cadVolumeMm3:1,excludedVolumes:0,ports:[{capId:'inlet',faceTag:1},{capId:'outlet',faceTag:2}]}};
 const faces=new Map();for(const tet of mesh.tetrahedra)for(let skip=0;skip<4;skip++){const f=tet.filter((_,i)=>i!==skip),key=[...f].sort((a,b)=>a-b).join(',');if(faces.has(key))faces.delete(key);else faces.set(key,f);}mesh.surface=[...faces.values()].map(nodes=>({nodes,faceTag:nodes.every(i=>i<3)?1:nodes.every(i=>i>=3)?2:3,...(nodes.every(i=>i<3)?{openingCapId:'inlet'}:nodes.every(i=>i>=3)?{openingCapId:'outlet'}:{})}));
 validateInternalMesh(mesh,s);
 for(const mutate of [m=>m.nodes[1]-=1,m=>m.surface.find(f=>f.openingCapId==='inlet').openingCapId='outlet',m=>m.domainSelection.ports.pop(),m=>m.domainSelection.ports[0].plane=1,m=>m.domainSelection.channel={model:'CAD circular cylinder'},m=>m.surface.pop(),m=>{const f=m.surface.find(f=>f.openingCapId==='inlet');f.faceTag=99;delete f.openingCapId;}]){const bad=structuredClone(mesh);mutate(bad);assert.throws(()=>validateInternalMesh(bad,s));}
 const changed=source();changed.openingCaps[0].point[1]=-9;assert.throws(()=>validateInternalMesh(mesh,changed));
});

test('cap discovery and paged source inspection preserve point units and dimensionless explicit normals',async()=>{
 const sourceModel=source(),project={version:1,sourceModel,conditions:[],meshes:[]},schema=inputOperationContracts.prepareFluidDomain.inputSchema.properties.openingCaps;
 assert.equal(schema.maxItems,6);assert.deepEqual(schema.items.required,['id','point','normal']);assert.equal(schema.items.additionalProperties,false);
 for(const [key,unit]of [['point','mm'],['normal','1']]){const pointer='/sourceModel/openingCaps/0/'+key,r=await inspectProjectInput(project,{section:'source',pointer});assert.equal(r.units[pointer],unit);assert.deepEqual(r.page.entries.map(e=>e.value),sourceModel.openingCaps[0][key]);}
});
