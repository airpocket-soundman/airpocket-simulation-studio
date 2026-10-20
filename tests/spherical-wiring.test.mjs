import {test} from 'node:test';import assert from 'node:assert/strict';import load from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';import {transferConditions} from '../src/boundaries.js';
import {sphericalPatchArea,validateSphericalMesh} from '../src/spherical-cad.js';import {sphericalContains} from '../src/spherical-region.js';
import {createProjectFromBuiltin} from '../src/project-import.js';import {createStudioApi} from '../src/studio-api.js';import {applyProjectOperations,getProjectRevision} from '../src/project-operations.js';import {createCaseStore} from '../src/cases.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';import {sphericalRegionSchema} from '../src/semantic-operation-schema.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
const source={kind:'sphere',center:[0,0,0],radius:10},spec={center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:.01,exactCad:true,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90};
function input(){return createProjectFromBuiltin({source});}
function projectWithForce(){const api=createStudioApi();api.loadProject(input());api.selectSphericalRegion(0,spec);api.addCondition({type:'force',value:123,direction:[-1,0,0]});return api.exportProject();}
test('spherical semantic selection saves exact dimensions, restores, reapplies, clears and validates atomically',async()=>{
 const project=input(),revision=await getProjectRevision(project),edited=await applyProjectOperations(project,[{method:'selectSphericalRegion',args:[0,spec]},{method:'addCondition',args:[{type:'force',value:123,direction:[-1,0,0]}]}],{expectedRevision:revision}),api=createStudioApi();
 api.loadProject(JSON.parse(JSON.stringify(edited.project)));const saved=api.exportProject();assert.deepEqual(saved.conditions[0].sphericalRegion,{...spec,mesh:0});api.selectCondition(0);assert.ok(Math.abs(api.getSummary().selectedAreaMm2-sphericalPatchArea(spec))<1e-9);api.reapplyConditionRegion(0);assert.deepEqual(api.exportProject().conditions,saved.conditions);
 const selection=await api.inspectInput({pointer:'/sphericalRegion'}),condition=await api.inspectInput({pointer:'/conditions/0/sphericalRegion'});
 assert.equal(selection.units['/sphericalRegion/radius'],'mm');assert.equal(selection.units['/sphericalRegion/tolerance'],'mm');assert.equal(selection.units['/sphericalRegion/axis'],'1');assert.equal(selection.units['/sphericalRegion/latitudeMin'],'deg');assert.equal(selection.units['/sphericalRegion/mesh'],undefined);
 for(const field of ['center','radius','tolerance','axis','reference','latitudeMin','latitudeMax','startDegrees','sweepDegrees'])assert.equal(selection.units['/sphericalRegion/'+field],condition.units['/conditions/0/sphericalRegion/'+field]);
 api.clearSelection();assert.equal(api.exportProject().sphericalRegion,undefined);api.selectCondition(0);api.selectTriangles(0,[0]);assert.equal(api.exportProject().sphericalRegion,undefined);
 const corrupt=structuredClone(saved);corrupt.conditions[0].sphericalRegion.radius=11;assert.throws(()=>api.loadProject(corrupt),/dimensions/);assert.equal(api.exportProject().conditions[0].sphericalRegion.radius,10);
 const envelope=getBrowserOperationContracts({method:'edit'}).operations[0].inputSchema.properties.operations.items;assert.ok(envelope.properties.method.enum.includes('selectSphericalRegion'));assert.ok(JSON.stringify(envelope.allOf).includes('latitudeMin'));assert.equal(sphericalRegionSchema.properties.exactCad.const,true);
 const inspected=await api.inspectInput({pointer:'/conditions/0/sphericalRegion'});assert.ok(inspected);
});
test('spherical CAD fragmentation preserves exact area, force and heat power across remeshing and JSON case restore',async()=>{
 const project=projectWithForce();let previous;
 for(const size of [3,1.5]){
  const mesh=await generateMesh(load,source,{size,sphericalRegions:[{conditionIndex:0,region:project.conditions[0].sphericalRegion}]}),boundary=transferConditions(project,mesh),patch=mesh.sphericalPatches[0];
  assert.equal(new Set(mesh.tetrahedra.flat()).size,mesh.nodes.length/3,'CAD construction must not leave orphan nodes');
  assert.ok(Math.abs(patch.areaMm2-sphericalPatchArea(spec))<1e-7);assert.ok(boundary.reports[0].relativeAreaError<.03);if(previous!==undefined)assert.ok(boundary.reports[0].relativeAreaError<previous);previous=boundary.reports[0].relativeAreaError;
  const total=[0,1,2].map(k=>boundary.forces.reduce((sum,f)=>sum+f.value[k],0));assert.ok(Math.abs(total[0]+123)<1e-9);assert.ok(Math.abs(total[1])+Math.abs(total[2])<1e-9);
  const faces=mesh.surface.filter(f=>f.patchConditions.includes(0));assert.ok(faces.length);assert.ok(faces.every(f=>f.nodes.every(i=>sphericalContains(spec,mesh.nodes.slice(i*3,i*3+3)))));
  const thermal=structuredClone(project);thermal.conditions[0].type='heatPower';thermal.conditions[0].value=37;const heat=transferConditions(thermal,mesh);assert.ok(Math.abs(heat.heatFlux.reduce((s,f)=>s+f[1],0)-37)<1e-9);
  validateSphericalMesh(JSON.parse(JSON.stringify(mesh)),project);
  const reordered=structuredClone(mesh);reordered.sphericalPatches[0].region=Object.fromEntries(Object.entries(reordered.sphericalPatches[0].region).reverse());assert.doesNotThrow(()=>validateSphericalMesh(reordered,project));reordered.sphericalPatches[0].region.latitudeMax+=1;assert.throws(()=>validateSphericalMesh(reordered,project),/Invalid saved/);
  // Synthetic zero result exercises the archive validator only, not physics.
  const store=createCaseStore();store.add('sphere CAD archive reference',{input:project,mesh,calculation:{operation:'elastic',options:{size,method:'pcg',adaptive:false,maxRounds:3}},result:{kind:'elastic',maxDisplacementMm:0,maxVonMisesPa:0}});const archive=JSON.parse(JSON.stringify(store.export())),restored=createCaseStore();restored.import(archive);assert.equal(restored.list().length,1);
  for(const mutate of [m=>{m.sphericalPatches[0].areaMm2*=2;},m=>{m.surface.find(f=>f.patchConditions.includes(0)).patchConditions=[];},m=>{m.sphericalPatches[0].region.latitudeMax=40;}]){const bad=structuredClone(mesh);mutate(bad);assert.throws(()=>validateSphericalMesh(bad,project));}
  const relabeled=structuredClone(mesh);relabeled.surface.find(f=>f.patchConditions.includes(0)).patchConditions=[];
  relabeled.sphericalPatches[0].meshAreaMm2=relabeled.surface.filter(f=>f.patchConditions.includes(0)).reduce((sum,f)=>{const [a,b,c]=f.nodes.map(i=>relabeled.nodes.slice(i*3,i*3+3)),u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);return sum+Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;},0);
  assert.throws(()=>validateSphericalMesh(relabeled,project),/declaration/);
 }
});
test('sphere poles/full-longitude cap work; wrong radius, center, unsupported source and contact refuse',async()=>{
 const cap={...spec,latitudeMin:30,latitudeMax:90,sweepDegrees:360},mesh=await generateMesh(load,source,{size:2.5,sphericalRegions:[{conditionIndex:0,region:cap}]});assert.ok(Math.abs(mesh.sphericalPatches[0].areaMm2-sphericalPatchArea(cap))<1e-7);
 for(const d of [{...spec,radius:9},{...spec,center:[1,0,0]}])await assert.rejects(generateMesh(load,source,{size:4,sphericalRegions:[{conditionIndex:0,region:d}]}),/patch area or boundary/);
 await assert.rejects(generateMesh(load,{kind:'cylinder'},{size:4,sphericalRegions:[{conditionIndex:0,region:spec}]}),/STEP or sphere/);
 const api=createStudioApi();api.loadProject(input());api.selectSphericalRegion(0,spec);assert.throws(()=>api.addCondition({type:'thermalContact',value:1}),/thermal contact/);
});
test('STEP sphere supports an arbitrary frame and the real Worker preserves spherical load/reaction and archived input',async()=>{
 const g=await load({print:()=>{},printErr:()=>{}});g.initialize();let step;
 try{g.option.setNumber('General.Terminal',0);g.model.add('sphere-step');g.model.occ.addSphere(0,0,0,10);g.model.occ.synchronize();g.write('/sphere.step');step={kind:'step',data:Buffer.from(g.FS.readFile('/sphere.step')).toString('base64')};}finally{g.finalize();}
 const rotated={...spec,axis:[1,2,3],reference:[1,0,0]},mesh=await generateMesh(load,step,{size:3,sphericalRegions:[{conditionIndex:0,region:rotated}]});assert.ok(Math.abs(mesh.sphericalPatches[0].areaMm2/sphericalPatchArea(rotated)-1)<1e-7);
 const api=createStudioApi();api.loadProject({...input(),sourceModel:step});api.setMaterialProperties({youngModulus:1e9,poissonRatio:.3});api.setStudy({kind:'structural',gravityEnabled:false});
 api.selectSphericalRegion(0,{...spec,latitudeMin:60,latitudeMax:90,sweepDegrees:360});api.addCondition({type:'fixed'});api.selectSphericalRegion(0,spec);api.addCondition({type:'force',value:123,direction:[-1,0,0]});
 const project=api.exportProject();await assert.rejects(analyzeProject(project,{size:3,method:'pcg'}),{code:'ANALYSIS_BOUNDARY_REGION_TRANSFER'});const output=await analyzeProject(project,{size:1.5,method:'pcg'});assert.equal(output.mesh.sphericalPatches.length,2);assert.ok(Math.abs(output.result.reaction[0]-123)<1e-5);assert.ok(output.result.maxDisplacementMm>0);
 const store=createCaseStore();store.add('STEP sphere Worker',output);const restored=createCaseStore();restored.import(JSON.parse(JSON.stringify(store.export())));assert.deepEqual(restored.list()[0].output.input,project);
});
