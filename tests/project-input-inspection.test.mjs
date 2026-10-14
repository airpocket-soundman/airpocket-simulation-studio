import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectProjectInput as inspect} from '../src/project-input-inspection.js';
import {getProjectRevision} from '../src/project-revision.js';
import {createStudioApi} from '../src/studio-api.js';
const model=()=>({version:1,name:'Existing input',sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:.3,source:'Explicit reference data'},meshSettings:{refinements:[]},meshes:[{positions:[0,0,0,2,0,0,0,2,0,10,0,0,12,0,0,10,2,0],faceIds:[0,1]}],conditions:[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:[0]}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:[1]}]}],selection:[[]]});
test('inspection reveals existing material and condition values with exact input revision and known units',async()=>{
 const p=model(),before=structuredClone(p),revision=await getProjectRevision(p),r=await inspect(p,{section:'material',expectedRevision:revision});assert.equal(r.revision,revision);assert.equal(r.pointer,'/materialProperties');assert.equal(r.exists,true);assert.equal(r.descriptor.type,'object');assert.equal(r.descriptor.omitted,true);assert.equal(r.descriptor.value,undefined);assert.deepEqual(r.page.entries.map(e=>e.pointer),['/materialProperties/poissonRatio','/materialProperties/source','/materialProperties/youngModulus']);assert.equal(r.page.entries.find(e=>e.pointer.endsWith('youngModulus')).value,1e9);assert.equal(r.units['/materialProperties/youngModulus'],'Pa');assert.equal(r.page.entries.find(e=>e.type==='string').unit,undefined);
 const c=await inspect(p,{section:'conditions',pointer:'/conditions/1',expectedRevision:revision});assert.equal(c.page.entries.find(e=>e.pointer.endsWith('/value')).value,100);assert.equal(c.units['/conditions/1/value'],'N');assert.deepEqual(p,before);
 r.page.entries[0].value=999;assert.equal((await inspect(p,{section:'material'})).page.entries[0].value,.3);
});
test('explicit pointers reconstruct region selection by bounded pages without returning nested arrays wholesale',async()=>{
 const p=model();p.conditions[0].regions[0].triangles=Array.from({length:10000},(_,i)=>i);
 const meta=await inspect(p,{section:'conditions',pointer:'/conditions/0/regions/0'}),triangles=meta.page.entries.find(e=>e.pointer.endsWith('/triangles'));assert.equal(triangles.length,10000);assert.equal(triangles.value,undefined);assert.equal(triangles.sha256,await getProjectRevision(p.conditions[0].regions[0].triangles));
 const a=await inspect(p,{section:'conditions',pointer:triangles.pointer,limit:200}),b=await inspect(p,{section:'conditions',pointer:triangles.pointer,offset:a.page.nextOffset,limit:200});assert.equal(a.page.entries.length,200);assert.equal(a.page.total,10000);assert.equal(a.page.nextOffset,200);assert.deepEqual(a.page.entries.slice(0,3).map(e=>e.value),[0,1,2]);assert.equal(b.page.entries[0].value,200);assert.equal(b.page.nextOffset,400);assert.ok(JSON.stringify(a).length<65536);assert.equal(a.page.entries[0].unit,undefined);
});
test('source bytes, mesh positions and field payloads stay metadata until an explicit bounded pointer is read',async()=>{
 const p=model();p.sourceModel={kind:'step',data:'QUFB'.repeat(250000)};p.study.temperatureSource={name:'Thermal reference',mesh:{nodes:Array(12000).fill(0),tetrahedra:[[0,1,2,3]]},temperature:Array(4000).fill(40)};
 const overview=await inspect(p),source=await inspect(p,{section:'source'});assert.ok(!JSON.stringify(overview).includes('QUFBQUFB'));const data=source.page.entries.find(e=>e.pointer==='/sourceModel/data');assert.equal(data.omitted,true);assert.equal(data.length,1000000);assert.equal(data.value,undefined);
 const bytes=await inspect(p,{section:'source',pointer:'/sourceModel/data',offset:10,limit:200});assert.equal(bytes.page.text.length,200);assert.equal(bytes.page.encoding,'utf-16-code-units');assert.equal(bytes.page.total,1000000);assert.equal(bytes.page.nextOffset,210);
 const field=await inspect(p,{section:'study',pointer:'/study/temperatureSource/temperature',limit:3});assert.deepEqual(field.page.entries.map(e=>e.value),[40,40,40]);assert.equal(field.page.entries[0].unit,'degC');const nodes=await inspect(p,{section:'study',pointer:'/study/temperatureSource/mesh/nodes',limit:3});assert.equal(nodes.page.entries[0].unit,'mm');assert.equal(nodes.page.total,12000);
});
test('pointer decoding is strict and only own properties are visible; absent sections are explicit',async()=>{
 const p=model();p.metadata={'a/b~c':{answer:42}};const r=await inspect(p,{pointer:'/metadata/a~1b~0c/answer'});assert.equal(r.descriptor.value,42);assert.equal(r.descriptor.unit,undefined);
 for(const pointer of ['/__proto__','/constructor','/metadata/toString','/meshes/length','/conditions/01'])assert.equal((await inspect(p,{pointer})).exists,false);
 for(const pointer of ['metadata','/~2','/~','/a~9b'])await assert.rejects(inspect(p,{pointer}),{code:'INPUT_INSPECTION_ARGUMENT_INVALID'});
 await assert.rejects(inspect(p,{section:'material',pointer:'/study'}),{code:'INPUT_INSPECTION_ARGUMENT_INVALID'});assert.equal((await inspect(p,{section:'provenance'})).exists,false);assert.equal((await inspect(p,{section:'intent'})).exists,false);
});
test('paging bounds, unknown units and large response refusal are explicit without changing inputs',async()=>{
 const p=model();p.metadata={mystery:123,values:Array(200).fill('界'.repeat(400))};const before=structuredClone(p);
 for(const args of [{section:'unknown'},{section:null},{limit:201},{limit:0},{offset:-1},{pointer:'/metadata',limit:51},{pointer:'/metadata',offset:3},{pointer:'/name',offset:1},{extra:1},{expectedRevision:null}])await assert.rejects(inspect(p,args));
 const empty=await inspect(p,{section:'selection',pointer:'/selection/0',limit:200});assert.deepEqual(empty.page.entries,[]);assert.equal(empty.page.nextOffset,null);assert.equal((await inspect(p,{pointer:'/metadata/mystery'})).descriptor.unit,undefined);
 await assert.rejects(inspect(p,{pointer:'/metadata/values',limit:200}),{code:'INPUT_INSPECTION_RESPONSE_LIMIT'});assert.equal((await inspect(p,{pointer:'/metadata/values',limit:1})).page.entries.length,1);assert.deepEqual(p,before);
});
test('read-only snapshots reject invalid JSON/accessors and do not observe mid-hash caller mutation',async()=>{
 const p=model(),before=structuredClone(p),pending=inspect(p,{section:'material'});p.materialProperties.youngModulus=2e9;assert.equal((await pending).page.entries.find(e=>e.pointer.endsWith('youngModulus')).value,1e9);
 let getters=0;const args={};Object.defineProperty(args,'pointer',{enumerable:true,get(){getters++;return '';}});await assert.rejects(inspect(before,args));const bad={...before};Object.defineProperty(bad,'evil',{enumerable:true,get(){getters++;return 3;}});await assert.rejects(inspect(bad));assert.equal(getters,0);
 for(const value of [NaN,undefined,()=>{},new Date()])await assert.rejects(inspect({...before,invalid:value}));await assert.rejects(inspect(before,{expectedRevision:'sha256:'+'0'.repeat(64)}),{code:'INPUT_INSPECTION_REVISION_CONFLICT'});
});
test('shared input read supports inspect, one-condition preview/edit, stale refusal and reinspection',async()=>{
 const api=createStudioApi();api.loadProject(model());const before=api.exportProject(),first=await api.inspectInput({section:'conditions',pointer:'/conditions/1'}),commands=[{method:'selectCondition',args:[1]},{method:'removeCondition',args:[1]},{method:'addCondition',args:[{type:'force',value:200,direction:[0,0,1]}]}],preview=await api.previewOperations(commands,{expectedRevision:first.revision});assert.deepEqual(api.exportProject(),before);await api.applyOperations(commands,{expectedRevision:first.revision,expectedResultingRevision:preview.revision});const after=await api.inspectInput({section:'conditions',pointer:'/conditions/1',expectedRevision:preview.revision});assert.equal(after.page.entries.find(e=>e.pointer.endsWith('/value')).value,200);await assert.rejects(api.inspectInput({expectedRevision:first.revision}),{code:'INPUT_INSPECTION_REVISION_CONFLICT'});
 const reading=api.inspectInput({section:'material'});api.setStudy({kind:'thermal'});await assert.rejects(reading,{code:'INPUT_INSPECTION_STALE'});
});
test('provenance snapshots reuse original known units and uncertainty labels remain data',async()=>{
 const p=model();p.inputProvenance={schemaVersion:1,entries:[{pointer:'/materialProperties/youngModulus',value:1e9,status:'unconfirmed',assumption:'Reference only'}]};const r=await inspect(p,{section:'provenance',pointer:'/inputProvenance/entries/0'});assert.equal(r.page.entries.find(e=>e.pointer.endsWith('/value')).unit,'Pa');assert.equal(r.page.entries.find(e=>e.pointer.endsWith('/status')).value,'unconfirmed');
 const s=await inspect(p,{section:'source',pointer:'/sourceModel/kind'});assert.equal(s.descriptor.unit,undefined);
});
