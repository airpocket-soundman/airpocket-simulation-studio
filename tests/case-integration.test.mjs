import {test} from 'node:test';
import assert from 'node:assert/strict';
import initialize from '@loumalouomega/gmsh-wasm';
import {generateMesh} from '../src/mesh-core.js';
import {transferConditions} from '../src/boundaries.js';
import {solveElastic} from '../src/fem-core.js';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';

test('real material comparison archives reproduce axial solutions from restored inputs',async()=>{
 const sourceModel={kind:'box',bounds:[0,0,0,10,10,40]},mesh=await generateMesh(initialize,sourceModel,{size:4}),api=createStudioApi();
 api.loadProject({version:1,sourceModel,study:{kind:'structural'},meshes:[{positions:mesh.surface.flatMap(f=>f.nodes.flatMap(n=>mesh.nodes.slice(3*n,3*n+3))),faceIds:mesh.surface.map(f=>f.faceTag)}],conditions:[]});
 const face=z=>mesh.surface.flatMap((f,i)=>f.nodes.every(n=>Math.abs(mesh.nodes[3*n+2]-z)<1e-7)?[i]:[]);
 api.selectTriangles(0,face(0));api.addCondition({type:'fixed'});api.selectTriangles(0,face(40));api.addCondition({type:'force',value:100,direction:[0,0,1]});
 const store=createCaseStore(),calculation={operation:'elastic',options:{size:4,method:'pcg-strict',adaptive:false,maxRounds:3}};
 for(const [name,E,expected]of [['E1',1e9,.04],['E2',2e9,.02]]){
  api.setMaterialProperties({youngModulus:E,poissonRatio:0});const input=api.exportProject(),boundary=transferConditions(input,mesh),result=solveElastic(mesh,input.materialProperties,boundary,calculation.options);
  assert.ok(Math.abs(result.maxDisplacementMm-expected)<1e-7);assert.ok(Math.abs(result.reaction[2]+100)<1e-5);store.add(name,{mesh,boundary,result,input,calculation});
 }
 const archive=JSON.parse(JSON.stringify(store.export())),restored=createCaseStore();restored.import(archive);
 assert.equal(restored.compare().length,2);assert.ok(Math.abs(restored.compare()[0].metrics[0].value/restored.compare()[1].metrics[0].value-2)<1e-5);
 for(const c of restored.list()){
  api.loadProject(c.output.input);const p=api.exportProject(),boundary=transferConditions(p,c.output.mesh),result=solveElastic(c.output.mesh,p.materialProperties,boundary,c.output.calculation.options);
  assert.deepEqual(result.displacement,c.output.result.displacement);assert.deepEqual(result.reaction,c.output.result.reaction);
 }
 api.setMaterialProperties({youngModulus:3e9,poissonRatio:0});assert.deepEqual(restored.export(),archive);
});
