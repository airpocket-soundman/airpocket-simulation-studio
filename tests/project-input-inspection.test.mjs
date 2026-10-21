import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectProjectInput as inspect} from '../src/project-input-inspection.js';
import {getProjectRevision} from '../src/project-revision.js';
import {createStudioApi} from '../src/studio-api.js';
import {planarRegionFromEuler,validatePlanarRegion} from '../src/planar-region.js';
import {cylindricalFrame} from '../src/cylindrical-region.js';
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
test('spherical selection, saved condition and provenance expose the same known dimensions with units',async()=>{
 const spec={exactCad:true,center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:.01,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90};
 const p=model();p.sphericalRegion={...spec,mesh:0};p.conditions.push({type:'force',value:123,direction:[-1,0,0],regions:[{mesh:0,triangles:[1]}],sphericalRegion:{...spec,mesh:0}});
 p.inputProvenance={schemaVersion:1,entries:[{pointer:'/sphericalRegion/radius',value:10,status:'unconfirmed',assumption:'Synthetic boundary reference'},{pointer:'/conditions/2/sphericalRegion/tolerance',value:.01,status:'unconfirmed',assumption:'Synthetic display tolerance'}]};
 const before=structuredClone(p),revision=await getProjectRevision(p),fixture={...p,sphericalRegion:{...p.sphericalRegion,legacyScale:2}};
 const selection=await inspect(p,{pointer:'/sphericalRegion',expectedRevision:revision}),condition=await inspect(p,{pointer:'/conditions/2/sphericalRegion',expectedRevision:revision});
 assert.equal(selection.units['/sphericalRegion/center'],'mm');assert.equal(selection.units['/sphericalRegion/radius'],'mm');assert.equal(selection.units['/sphericalRegion/tolerance'],'mm');
 assert.equal(selection.units['/sphericalRegion/axis'],'1');assert.equal(selection.units['/sphericalRegion/reference'],'1');
 for(const angle of ['latitudeMin','latitudeMax','startDegrees','sweepDegrees'])assert.equal(selection.units['/sphericalRegion/'+angle],'deg');
 assert.equal(selection.units['/sphericalRegion/mesh'],undefined);assert.equal(selection.descriptor.unit,undefined);
 for(const field of ['center','radius','tolerance','axis','reference','latitudeMin','latitudeMax','startDegrees','sweepDegrees'])assert.equal(selection.units['/sphericalRegion/'+field],condition.units['/conditions/2/sphericalRegion/'+field]);
 const centerPage=await inspect(p,{pointer:'/sphericalRegion/center'}),radiusEntry=await inspect(p,{pointer:'/sphericalRegion/radius'});
 assert.equal(centerPage.descriptor.unit,'mm');assert.deepEqual(centerPage.page.entries.map(e=>e.unit),['mm','mm','mm']);assert.deepEqual(centerPage.page.entries.map(e=>e.value),[0,0,0]);
 assert.equal(radiusEntry.descriptor.value,10);assert.equal(radiusEntry.descriptor.unit,'mm');
 const conditionValue=await inspect(p,{pointer:'/conditions/2/value'});assert.equal(conditionValue.descriptor.value,123);assert.equal(conditionValue.descriptor.unit,'N');
 const radius=await inspect(p,{pointer:'/inputProvenance/entries/0/value'}),tolerance=await inspect(p,{pointer:'/inputProvenance/entries/1/value'});
 assert.equal(radius.descriptor.value,10);assert.equal(radius.descriptor.unit,'mm');assert.equal(tolerance.descriptor.value,.01);assert.equal(tolerance.descriptor.unit,'mm');
 const unknownKey=await inspect(fixture,{pointer:'/sphericalRegion/legacyScale'});assert.equal(unknownKey.descriptor.value,2);assert.equal(unknownKey.descriptor.unit,undefined);
 assert.equal((await inspect(p,{pointer:'/sphericalRegion/diameter'})).exists,false);
 const reloaded=JSON.parse(JSON.stringify(p)),reloadedSelection=await inspect(reloaded,{pointer:'/sphericalRegion'}),reloadedCondition=await inspect(reloaded,{pointer:'/conditions/2/sphericalRegion'});
 assert.deepEqual(reloadedSelection.units,selection.units);assert.deepEqual(reloadedCondition.units,condition.units);
 assert.deepEqual(p,before);
});
test('planar rectangle descriptors expose saved mm, degrees and axis index units on selection, condition and provenance',async()=>{
 const planar={...planarRegionFromEuler(2,10,[0,0,30],[0,0],[20,30]),mesh:0};validatePlanarRegion(planar);
 const p=model();p.planarRegion=planar;p.conditions.push({type:'force',value:50,direction:[0,0,-1],regions:[{mesh:0,triangles:[0]}],planarRegion:{...planar}});
 p.inputProvenance={schemaVersion:1,entries:[{pointer:'/planarRegion/position',value:10,status:'unconfirmed',assumption:'Synthetic planar position'},{pointer:'/conditions/2/planarRegion/max/1',value:30,status:'unconfirmed',assumption:'Synthetic planar extent'}]};
 const before=structuredClone(p),revision=await getProjectRevision(p);
 const selection=await inspect(p,{pointer:'/planarRegion',expectedRevision:revision}),condition=await inspect(p,{pointer:'/conditions/2/planarRegion',expectedRevision:revision});
 for(const [field,unit] of [['position','mm'],['min','mm'],['max','mm'],['rotationDegrees','deg'],['axis','1']])assert.equal(selection.units['/planarRegion/'+field],unit,field);
 assert.equal(selection.units['/planarRegion/mesh'],undefined);assert.equal(selection.descriptor.unit,undefined);
 for(const field of ['position','min','max','rotationDegrees','axis','mesh'])assert.equal(selection.units['/planarRegion/'+field],condition.units['/conditions/2/planarRegion/'+field],field);
 const frame=await inspect(p,{pointer:'/planarRegion/frame'}),conditionFrame=await inspect(p,{pointer:'/conditions/2/planarRegion/frame'});
 assert.equal(frame.descriptor.unit,undefined);assert.equal(frame.units['/planarRegion/frame/origin'],'mm');assert.equal(frame.units['/planarRegion/frame/u'],'1');assert.equal(frame.units['/planarRegion/frame/v'],'1');assert.deepEqual(frame.units,Object.fromEntries(Object.entries(conditionFrame.units).map(([key,unit])=>[key.replace('/conditions/2',''),unit])));
 const position=await inspect(p,{pointer:'/planarRegion/position'}),axis=await inspect(p,{pointer:'/planarRegion/axis'});
 assert.equal(position.descriptor.value,10);assert.equal(position.descriptor.unit,'mm');assert.equal(axis.descriptor.value,2);assert.equal(axis.descriptor.unit,'1');
 const min=await inspect(p,{pointer:'/planarRegion/min'}),rotation=await inspect(p,{pointer:'/planarRegion/rotationDegrees'}),origin=await inspect(p,{pointer:'/planarRegion/frame/origin'});
 assert.equal(min.descriptor.unit,'mm');assert.deepEqual(min.page.entries.map(e=>[e.value,e.unit]),[[0,'mm'],[0,'mm']]);
 assert.deepEqual(rotation.page.entries.map(e=>[e.value,e.unit]),[[0,'deg'],[0,'deg'],[30,'deg']]);
 assert.deepEqual(origin.page.entries.map(e=>[e.value,e.unit]),[[0,'mm'],[0,'mm'],[10,'mm']]);
 assert.equal((await inspect(p,{pointer:'/planarRegion/max'})).descriptor.unit,'mm');
 assert.equal((await inspect(p,{pointer:'/conditions/2/planarRegion/max/1'})).descriptor.unit,'mm');
 const provenPosition=await inspect(p,{pointer:'/inputProvenance/entries/0/value'}),provenExtent=await inspect(p,{pointer:'/inputProvenance/entries/1/value'});
 assert.equal(provenPosition.descriptor.value,10);assert.equal(provenPosition.descriptor.unit,'mm');assert.equal(provenExtent.descriptor.value,30);assert.equal(provenExtent.descriptor.unit,'mm');
 const fixture={...p,planarRegion:{...planar,radius:5,tolerance:.1,position:10,legacyScale:2}};
 assert.equal((await inspect(fixture,{pointer:'/planarRegion/radius'})).descriptor.unit,undefined);assert.equal((await inspect(fixture,{pointer:'/planarRegion/tolerance'})).descriptor.unit,undefined);assert.equal((await inspect(fixture,{pointer:'/planarRegion/legacyScale'})).descriptor.unit,undefined);assert.equal((await inspect(fixture,{pointer:'/planarRegion/position'})).descriptor.unit,'mm');
 assert.deepEqual(p,before);
});
test('cylindrical and conical descriptors expose saved mm, degrees and direction units without mm on mesh or CAD flags',async()=>{
 const cone={origin:[0,0,0],axis:[0,1,0],reference:[1,0,0],radius:12,tolerance:.3,axialMin:-10,axialMax:10,startDegrees:315,sweepDegrees:90,radiusAtMax:15,exactCad:true,mesh:0};
 const cylindrical={origin:[0,0,0],axis:[0,1,0],reference:[1,0,0],radius:12,tolerance:.3,axialMin:-10,axialMax:10,startDegrees:315,sweepDegrees:90,exactCad:false,mesh:0};
 cylindricalFrame(cone);cylindricalFrame(cylindrical);
 const p=model();p.cylindricalRegion=cone;p.conditions.push({type:'force',value:75,direction:[1,0,0],regions:[{mesh:0,triangles:[1]}],cylindricalRegion:{...cylindrical}});
 p.inputProvenance={schemaVersion:1,entries:[{pointer:'/conditions/2/cylindricalRegion/tolerance',value:.3,status:'unconfirmed',assumption:'Synthetic radial tolerance'},{pointer:'/conditions/2/cylindricalRegion/sweepDegrees',value:90,status:'unconfirmed',assumption:'Synthetic angular sweep'}]};
 const before=structuredClone(p),revision=await getProjectRevision(p);
 const selection=await inspect(p,{pointer:'/cylindricalRegion',expectedRevision:revision}),condition=await inspect(p,{pointer:'/conditions/2/cylindricalRegion',expectedRevision:revision});
 for(const [field,unit] of [['origin','mm'],['radius','mm'],['tolerance','mm'],['axialMin','mm'],['axialMax','mm'],['radiusAtMax','mm'],['axis','1'],['reference','1'],['startDegrees','deg'],['sweepDegrees','deg']])assert.equal(selection.units['/cylindricalRegion/'+field],unit,field);
 assert.equal(selection.units['/cylindricalRegion/exactCad'],undefined);assert.equal(selection.units['/cylindricalRegion/mesh'],undefined);assert.equal(selection.descriptor.unit,undefined);
 assert.equal(condition.units['/conditions/2/cylindricalRegion/radiusAtMax'],undefined);
 for(const field of ['origin','radius','tolerance','axialMin','axialMax','axis','reference','startDegrees','sweepDegrees','exactCad','mesh'])assert.equal(selection.units['/cylindricalRegion/'+field],condition.units['/conditions/2/cylindricalRegion/'+field],field);
 const origin=await inspect(p,{pointer:'/cylindricalRegion/origin'}),axis=await inspect(p,{pointer:'/cylindricalRegion/axis'}),reference=await inspect(p,{pointer:'/cylindricalRegion/reference'});
 assert.equal(origin.descriptor.unit,'mm');assert.deepEqual(origin.page.entries.map(e=>[e.value,e.unit]),[[0,'mm'],[0,'mm'],[0,'mm']]);
 assert.equal(axis.descriptor.unit,'1');assert.deepEqual(axis.page.entries.map(e=>[e.value,e.unit]),[[0,'1'],[1,'1'],[0,'1']]);
 assert.equal(reference.descriptor.unit,'1');assert.deepEqual(reference.page.entries.map(e=>e.unit),['1','1','1']);
 for(const [field,value,unit] of [['radius',12,'mm'],['axialMin',-10,'mm'],['axialMax',10,'mm'],['tolerance',.3,'mm'],['startDegrees',315,'deg'],['sweepDegrees',90,'deg'],['radiusAtMax',15,'mm']]){const entry=await inspect(p,{pointer:'/cylindricalRegion/'+field});assert.equal(entry.descriptor.value,value,field);assert.equal(entry.descriptor.unit,unit,field);}
 assert.equal((await inspect(p,{pointer:'/conditions/2/cylindricalRegion/radius'})).descriptor.value,12);
 const provenTolerance=await inspect(p,{pointer:'/inputProvenance/entries/0/value'}),provenSweep=await inspect(p,{pointer:'/inputProvenance/entries/1/value'});
 assert.equal(provenTolerance.descriptor.value,.3);assert.equal(provenTolerance.descriptor.unit,'mm');assert.equal(provenSweep.descriptor.value,90);assert.equal(provenSweep.descriptor.unit,'deg');
 const fixture={...p,cylindricalRegion:{...cone,position:10,min:[0,0],legacyScale:2}};
 assert.equal((await inspect(fixture,{pointer:'/cylindricalRegion/position'})).descriptor.unit,undefined);assert.equal((await inspect(fixture,{pointer:'/cylindricalRegion/min'})).descriptor.unit,undefined);assert.equal((await inspect(fixture,{pointer:'/cylindricalRegion/legacyScale'})).descriptor.unit,undefined);
 assert.deepEqual(p,before);
});
test('region unit pages stay consistent across offsets and JSON roundtrips without converting or mutating saved values',async()=>{
 const planar={...planarRegionFromEuler(2,10,[0,0,0],[0,0],[20,30]),mesh:0},cylindrical={origin:[0,0,0],axis:[0,1,0],reference:[1,0,0],radius:12,tolerance:.3,axialMin:-10,axialMax:10,startDegrees:315,sweepDegrees:90,exactCad:false,mesh:0};
 validatePlanarRegion(planar);cylindricalFrame(cylindrical);
 const p=model();p.planarRegion=planar;p.conditions.push({type:'force',value:50,direction:[0,0,-1],regions:[{mesh:0,triangles:[0]}],planarRegion:{...planar}},{type:'force',value:75,direction:[1,0,0],regions:[{mesh:0,triangles:[1]}],cylindricalRegion:{...cylindrical}});
 const before=structuredClone(p),revision=await getProjectRevision(p),pointer='/conditions/2/planarRegion';
 const full=await inspect(p,{pointer,expectedRevision:revision}),pages=[];
 for(let offset=0;offset<8;offset=pages.at(-1)?.page.nextOffset??0){const page=await inspect(p,{pointer,offset,limit:3});pages.push(page);if(page.page.nextOffset===null)break;}
 assert.equal(pages.length,3);assert.deepEqual(pages.map(page=>page.page.offset),[0,3,6]);assert.deepEqual(pages.map(page=>page.page.nextOffset),[3,6,null]);
 for(const page of pages)for(const [key,unit] of Object.entries(page.units))assert.equal(unit,full.units[key],key);
 assert.equal(full.units[pointer+'/min'],'mm');assert.equal(pages[0].units[pointer+'/max'],'mm');assert.equal(pages[1].units[pointer+'/position'],'mm');assert.equal(pages[2].units[pointer+'/rotationDegrees'],'deg');
 const cylindricalPointer='/conditions/3/cylindricalRegion',cylindricalFull=await inspect(p,{pointer:cylindricalPointer}),cylindricalPages=[];
 for(let offset=0;offset<12;offset=cylindricalPages.at(-1)?.page.nextOffset??0){const page=await inspect(p,{pointer:cylindricalPointer,offset,limit:4});cylindricalPages.push(page);if(page.page.nextOffset===null)break;}
 assert.equal(cylindricalPages.length,3);assert.deepEqual(cylindricalPages.map(page=>page.page.offset),[0,4,8]);assert.deepEqual(cylindricalPages.map(page=>page.page.nextOffset),[4,8,null]);
 for(const page of cylindricalPages)for(const [key,unit] of Object.entries(page.units))assert.equal(unit,cylindricalFull.units[key],key);
 assert.equal(cylindricalFull.units[cylindricalPointer+'/radius'],'mm');assert.equal(cylindricalPages[0].units[cylindricalPointer+'/axialMin'],'mm');assert.equal(cylindricalPages[2].units[cylindricalPointer+'/startDegrees'],'deg');
 const partial=await inspect(p,{pointer:cylindricalPointer+'/origin',offset:1,limit:2}),whole=await inspect(p,{pointer:cylindricalPointer+'/origin'});
 assert.deepEqual(partial.page.entries.map(e=>[e.value,e.unit]),whole.page.entries.slice(1,3).map(e=>[e.value,e.unit]));assert.deepEqual(partial.page.entries.map(e=>e.unit),['mm','mm']);
 const reloaded=JSON.parse(JSON.stringify(p)),saved=(value)=>JSON.parse(JSON.stringify(value));
 assert.deepEqual(reloaded.conditions[2].planarRegion,saved(planar));assert.deepEqual(reloaded.conditions[3].cylindricalRegion,saved(cylindrical));
 assert.equal(reloaded.conditions[2].planarRegion.position,10);assert.deepEqual(reloaded.conditions[2].planarRegion.max,[20,30]);assert.equal(reloaded.conditions[3].cylindricalRegion.radius,12);assert.equal(reloaded.conditions[3].cylindricalRegion.tolerance,.3);assert.equal(reloaded.conditions[3].cylindricalRegion.axialMin,-10);assert.equal(reloaded.conditions[3].cylindricalRegion.startDegrees,315);
 assert.deepEqual(await inspect(reloaded,{pointer}),full);assert.deepEqual(await inspect(reloaded,{pointer:cylindricalPointer}),cylindricalFull);
 assert.equal((await inspect(reloaded,{pointer:'/planarRegion'})).revision,revision);
 assert.deepEqual(p,before);
});
