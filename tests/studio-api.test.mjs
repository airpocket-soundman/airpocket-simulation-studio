import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudioApi} from '../src/studio-api.js';
const model=()=>({version:1,name:'two triangles',material:'金属',meshes:[{positions:[0,0,0,2,0,0,0,2,0,10,0,0,12,0,0,10,2,0],faceIds:[0,1]}],conditions:[]});
test('full project lifecycle: select, fix, load, save, restore, edit',()=>{
 const api=createStudioApi();api.loadProject(model());
 api.selectTriangles(0,[0,0]);assert.equal(api.getSummary().selectedAreaMm2,2);assert.equal(api.getSummary().selectedTriangles,1);
 api.addCondition({type:'fixed'});assert.equal(api.getSummary().selectedTriangles,0);
 api.selectTriangles(0,[1]);api.addCondition({type:'force',value:100,direction:[0,-1,0]});api.setMaterial('ゴム');
 const saved=JSON.parse(JSON.stringify(api.exportProject()));const restored=createStudioApi();restored.loadProject(saved);
 assert.deepEqual(restored.exportProject(),saved);restored.selectCondition(1);assert.equal(restored.getSummary().selectedAreaMm2,2);
 restored.removeCondition(0);assert.equal(restored.getSummary().conditionCount,1);
});
test('failed commands leave state unchanged',()=>{
 const api=createStudioApi();api.loadProject(model());const before=api.exportProject();
 assert.throws(()=>api.selectTriangles(0,[99]));assert.deepEqual(api.exportProject(),before);
 assert.throws(()=>api.addCondition({type:'force',value:1}));
 api.selectTriangles(0,[0]);const selected=api.exportProject();
 assert.throws(()=>api.addCondition({type:'force',value:1,direction:[0,0,0]}));
 assert.throws(()=>api.addCondition({type:'force',value:-1}));assert.deepEqual(api.exportProject(),selected);
 const bad=model();bad.selection=[[99]];assert.throws(()=>api.loadProject(bad));assert.deepEqual(api.exportProject(),selected);
});
test('API adapter used by UI receives identical commands',()=>{
 let state=null,reason;const api=createStudioApi({get:()=>state,set:(next,r)=>{state=next;reason=r;}});
 api.loadProject(model());assert.equal(reason,'load');api.selectTriangles(0,[0]);api.selectTriangles(0,[1],{replace:false});
 assert.equal(api.getSummary().selectedAreaMm2,4);api.selectTriangles(0,[0],{replace:false,erase:true});
 assert.deepEqual(state.selection,[[1]]);api.clearSelection();assert.equal(api.getSummary().selectedTriangles,0);
});
