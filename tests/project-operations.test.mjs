import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyProjectOperations,getProjectRevision} from '../src/project-operations.js';

const model=()=>({version:1,name:'two triangles',material:'金属',meshes:[{positions:[0,0,0,2,0,0,0,2,0,10,0,0,12,0,0,10,2,0],faceIds:[0,1]}],conditions:[]});
const op=(method,...args)=>({method,args});

test('browser shared API publishes a batch once and rejects concurrent changes',async()=>{
 const {createStudioApi}=await import('../src/studio-api.js');const api=createStudioApi();api.loadProject(model());const revision=await api.getRevision();
 const result=await api.applyOperations([op('selectTriangles',0,[0]),op('addCondition',{type:'fixed'})],{expectedRevision:revision});assert.equal(result.summary.conditionCount,1);assert.equal(result.revision,await api.getRevision());
 const before=api.exportProject(),pending=api.applyOperations([op('selectTriangles',0,[1]),op('addCondition',{type:'fixed'})]);api.clearSelection();
 // The intended concurrent change must differ in contents to be a conflict.
 api.selectTriangles(0,[1]);await assert.rejects(pending,/revision conflict/);assert.equal(api.exportProject().conditions.length,before.conditions.length);
});

test('atomic batch creates conditions and preserves the original saved project',async()=>{
  const project=model(),before=structuredClone(project),revision=await getProjectRevision(project);
  const result=await applyProjectOperations(project,[op('selectTriangles',0,[0]),op('addCondition',{type:'fixed'}),op('selectTriangles',0,[1]),op('addCondition',{type:'force',value:100,direction:[0,-1,0]})],{expectedRevision:revision});
  assert.deepEqual(project,before);assert.equal(result.schemaVersion,1);assert.equal(result.project.conditions.length,2);
  assert.equal(result.previousRevision,revision);assert.notEqual(result.revision,revision);assert.equal(result.revision,await getProjectRevision(result.project));
  assert.equal(result.results.length,4);
});

test('failure at the end of a batch cannot expose earlier changes',async()=>{
  const project=model(),before=structuredClone(project);
  await assert.rejects(applyProjectOperations(project,[op('setMaterial','樹脂'),op('selectTriangles',0,[99])]));
  assert.deepEqual(project,before);
});

test('revisions reject stale edits and ignore object property insertion order',async()=>{
  const project=model(),reordered=Object.fromEntries(Object.entries(project).reverse());
  assert.equal(await getProjectRevision(project),await getProjectRevision(reordered));
  assert.match(await getProjectRevision(project),/^sha256:[a-f0-9]{64}$/);
  const first=await applyProjectOperations(project,[op('setMaterial','樹脂')]);
  await assert.rejects(applyProjectOperations(first.project,[],{expectedRevision:first.previousRevision}),/revision conflict/);
  await assert.rejects(applyProjectOperations(project,[],{expectedRevision:123}),/must be a string/);
});

test('allowlist rejects prototype operations, persistence, unknown fields and wrong argument types',async()=>{
  for(const operation of [op('constructor'),op('toString'),op('__proto__'),op('loadProject',model()),op('exportProject'),op('selectTriangles','0',[0]),op('selectTriangles',0,[0],{replace:'false'}),op('removeCondition',0,1),{...op('clearSelection'),extra:true}]) {
    await assert.rejects(applyProjectOperations(model(),[operation]),TypeError);
  }
  await assert.rejects(applyProjectOperations(model(),Object.create({method:'clearSelection',args:[]})),TypeError);
  await assert.rejects(applyProjectOperations(model(),[Object.create({method:'clearSelection',args:[]})]),TypeError);
});

test('JSON validation rejects lossy values and cyclic objects',async()=>{
  const sparse=[1,,3];sparse.extra=2;await assert.rejects(getProjectRevision({sparse}),TypeError);
  let called=false;const accessor=[];Object.defineProperty(accessor,'0',{enumerable:true,get(){called=true;return 1;}});await assert.rejects(getProjectRevision({accessor}),TypeError);assert.equal(called,false);
  for(const invalid of [NaN,Infinity,undefined,()=>{},new Date(),new Uint8Array([1])])await assert.rejects(getProjectRevision({invalid}),TypeError);
  const cycle={};cycle.self=cycle;await assert.rejects(getProjectRevision(cycle),/Cyclic/);
  await assert.rejects(getProjectRevision([,1]),/Sparse/);
});

test('batch snapshots input and arguments before asynchronous revision calculation',async()=>{
  const project=model(),commands=[op('selectTriangles',0,[0]),op('addCondition',{type:'fixed'})];
  const pending=applyProjectOperations(project,commands);
  project.name='changed';commands[0].args[1][0]=99;
  const result=await pending;assert.equal(result.project.name,'two triangles');assert.deepEqual(result.project.conditions[0].regions[0].triangles,[0]);
});

test('saved metadata is retained without inventing unvalidated provenance fields',async()=>{
  const project=model();project.metadata={source:'measurement',assumptions:['uniform material'],unconfirmed:['density']};
  const result=await applyProjectOperations(project,[]);
  assert.deepEqual(result.project.metadata,project.metadata);assert.notEqual(result.project.metadata,project.metadata);
});

test('condition replacement and deletion use the shared semantic operations',async()=>{
  const result=await applyProjectOperations(model(),[op('selectTriangles',0,[0]),op('addCondition',{type:'fixed'}),op('selectTriangles',0,[1]),op('replaceConditionRegion',0),op('selectCondition',0)]);
  assert.deepEqual(result.project.selection,[[1]]);assert.deepEqual(result.project.conditions[0].regions,[{mesh:0,triangles:[1]}]);
  const removed=await applyProjectOperations(result.project,[op('removeCondition',0),op('clearSelection')]);assert.deepEqual(removed.project.conditions,[]);assert.deepEqual(removed.project.selection,[[]]);
});
