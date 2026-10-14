import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BoxGeometry} from 'three';
import {createProjectFromStep,createProjectFromStl,createProjectFromBuiltin} from '../src/project-import.js';
import {importProjectFile} from '../scripts/import-project.mjs';
import {createStudioApi} from '../src/studio-api.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';

test('real STEP import preserves original CAD bytes, mm dimensions and face identity through structural solve',async()=>{
  const fixture=new URL('./fixtures/cad-update-reference.step',import.meta.url),project=await importProjectFile(fileURLToPath(fixture));
  assert.deepEqual(Buffer.from(project.sourceModel.data,'base64'),await readFile(fixture));
  assert.equal(project.meshes.length,1);assert.equal(new Set(project.meshes[0].faceIds).size,6);
  const api=createStudioApi();api.loadProject(project);
  for(const [position,type] of [[0,'fixed'],[40,'force']]){
    api.selectPlanarRegion(0,{axis:2,position,min:[0,0],max:[10,10]});
    assert.equal(api.getSummary().selectedAreaMm2,100);
    api.addCondition({type,value:type==='force'?100:0,direction:[0,0,1]});
  }
  api.setMaterialProperties({youngModulus:1e9,poissonRatio:0});
  const output=await analyzeProject(api.exportProject(),{size:6});
  assert.ok(Math.abs(output.mesh.summary.volumeMm3-4000)<1e-5);
  assert.ok(Math.abs(output.result.maxDisplacementMm-.04)<1e-7);
  assert.ok(Math.abs(output.result.reaction[2]+100)<1e-5);
});

test('STEP display conversion rejects missing units, broken indices and incomplete face ranges',()=>{
  const bytes=new TextEncoder().encode('source bytes'),mesh={attributes:{position:{array:[0,0,0,1,0,0,0,1,0]}},index:{array:[0,1,2]},brep_faces:[{first:0,last:0}]};
  const input={bytes,linearUnit:'millimeter',result:{success:true,meshes:[mesh]}};
  assert.equal(createProjectFromStep(input).meshes[0].positions.length,9);
  assert.throws(()=>createProjectFromStep({...input,linearUnit:'meter'}),/millimeter/);
  const bad=structuredClone(input);bad.result.meshes[0].index.array[2]=4;assert.throws(()=>createProjectFromStep(bad),/tessellation/);
  const uncovered=structuredClone(input);uncovered.result.meshes[0].brep_faces=[];assert.throws(()=>createProjectFromStep(uncovered),/cover/);
  assert.equal(mesh.index.array[2],2);
});

test('real STEP reader converts embedded centimetre units to millimetres',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-step-units-'));
  try{
    const original=await readFile(new URL('./fixtures/cad-update-reference.step',import.meta.url),'utf8');
    assert.ok(original.includes('SI_UNIT(.MILLI.,.METRE.)'));
    const text=original.replace('SI_UNIT(.MILLI.,.METRE.)','SI_UNIT(.CENTI.,.METRE.)'),path=join(directory,'centimetres.step');
    await writeFile(path,text);const project=await importProjectFile(path);
    assert.equal(Math.max(...project.meshes[0].positions),400);
    assert.equal(Buffer.from(project.sourceModel.data,'base64').toString('utf8'),text);
  }finally{await rm(directory,{recursive:true,force:true});}
});

function stlBox(scale=1){
  const geometry=new BoxGeometry(10*scale,10*scale,40*scale).toNonIndexed();geometry.translate(5*scale,5*scale,20*scale);
  const positions=Array.from(geometry.attributes.position.array);geometry.dispose();
  return new TextEncoder().encode(['solid box',...Array.from({length:12},(_,i)=>['facet normal 0 0 0','outer loop',...Array.from({length:3},(_,k)=>'vertex '+positions.slice(i*9+k*3,i*9+k*3+3).join(' ')),'endloop','endfacet'].join('\n')),'endsolid box'].join('\n'));
}
test('STL import normalizes explicit units and retains convex closed-shell restrictions',()=>{
  const bytes=stlBox(.1),project=createProjectFromStl({bytes,scaleToMm:10});
  assert.equal(project.sourceModel.kind,'stl');assert.equal(Math.max(...project.meshes[0].positions),40);
  assert.deepEqual(project.meshes[0].positions,project.sourceModel.positions);assert.deepEqual(project.meshes[0].faceIds,Array.from({length:12},(_,i)=>i));
  assert.throws(()=>createProjectFromStl({bytes}),/scaleToMm/);
  assert.throws(()=>createProjectFromStl({bytes:new TextEncoder().encode('solid empty\nendsolid empty'),scaleToMm:1}));
  const open=new TextEncoder().encode('solid open\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid open');
  assert.throws(()=>createProjectFromStl({bytes:open,scaleToMm:1}),/closed/);
});

test('Node STL adapter uses the same import path and rejects unsupported extensions',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'studio-import-'));
  try{const path=join(directory,'box.stl');await writeFile(path,stlBox());const project=await importProjectFile(path,{scaleToMm:1});assert.equal(project.name,'box.stl');assert.equal(project.meshes[0].faceIds.length,12);await assert.rejects(importProjectFile(join(directory,'wrong.obj')),/Supported/);}finally{await rm(directory,{recursive:true,force:true});}
});

test('built-in sources create matching selectable display geometry without changing input',()=>{
  const sources=[{kind:'box',bounds:[0,0,0,10,10,40]},{kind:'boxes',boxes:[[0,0,0,10,10,20],[0,0,20,10,10,20]]},{kind:'cylinder'},{kind:'sphere',center:[0,0,0],radius:5},{kind:'tube',center:[0,0,0],axis:2,innerRadius:8,outerRadius:12,length:60}];
  for(const source of sources){const original=structuredClone(source),project=createProjectFromBuiltin({source});assert.deepEqual(source,original);assert.deepEqual(project.sourceModel,source);assert.ok(project.meshes[0].positions.length>0);assert.equal(project.conditions.length,0);}
  const api=createStudioApi();api.loadProject(createProjectFromBuiltin({source:sources[0]}));api.selectPlanarRegion(0,{axis:2,position:40,min:[0,0],max:[10,10]});assert.equal(api.getSummary().selectedAreaMm2,100);
  assert.throws(()=>createProjectFromBuiltin({source:{kind:'cylinder',radius:2}}),/fixed radius/);
  assert.throws(()=>createProjectFromBuiltin({source:{kind:'boxes',boxes:[[0,0,0,10,10,10],[0,0,0,10,10,10]]}}),/overlap/);
});
