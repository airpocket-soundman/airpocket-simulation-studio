import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInputImportOperations} from '../src/input-import-operations.js';
import {createStudioApi} from '../src/studio-api.js';
import {createProjectFromBuiltin,createProjectFromStep,MAX_IMPORT_BYTES} from '../src/project-import.js';
import {getProjectRevision} from '../src/project-revision.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {BoxGeometry,Mesh} from 'three';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function step(bytes,{name}={}){return createProjectFromStep({bytes,name,linearUnit:'millimeter',result:{success:true,meshes:[{attributes:{position:{array:[0,0,0,1,0,0,0,1,0]}},index:{array:[0,1,2]},brep_faces:[{first:0,last:0}]}]}});}
function fixture(extra={}){const studio=createStudioApi();studio.loadProject(createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,1,1,1]}}));studio.setMaterialProperties({youngModulus:1e9,poissonRatio:0});let busy=false;return {studio,busy:value=>busy=value,operations:createInputImportOperations({studio,parseStep:step,isBusy:()=>busy,...extra})};}
const request=async h=>({expectedRevision:await getProjectRevision(h.studio.exportProject()),format:'step',bytes:new Uint8Array([1,2,3]),name:'Imported'});
test('STEP and explicitly scaled STL use existing factories and clear previous physical inputs',async()=>{
 const h=fixture(),args=await request(h),result=await h.operations.import(args);assert.equal(result.previousRevision,args.expectedRevision);assert.equal(result.revision,await getProjectRevision(h.studio.exportProject()));assert.deepEqual(result.units,{geometry:'mm'});assert.equal(h.studio.exportProject().sourceModel.kind,'step');assert.deepEqual(h.studio.exportProject().materialProperties,{});assert.deepEqual(h.studio.exportProject().conditions,[]);
 const mesh=new Mesh(new BoxGeometry(1,1,1)),stl=new STLExporter().parse(mesh,{binary:true});mesh.geometry.dispose();
 await h.operations.import({expectedRevision:result.revision,format:'stl',bytes:new Uint8Array(stl.buffer),scaleToMm:10,name:'Scaled'});const p=h.studio.exportProject();assert.equal(p.sourceModel.kind,'stl');assert.equal(Math.max(...p.sourceModel.positions),5);assert.equal(p.name,'Scaled');
});
test('strict input, scaling, byte budget and stale revision reject without mutation',async()=>{
 const h=fixture(),args=await request(h),before=h.studio.exportProject();
 for(const bad of [null,[],{}, {...args,format:'obj'},{...args,materialProperties:{}},{...args,bytes:[]},{...args,bytes:new Uint8Array()},{...args,bytes:new Uint8Array(MAX_IMPORT_BYTES+1)},{...args,scaleToMm:1},{...args,format:'stl'},{...args,format:'stl',scaleToMm:0},{...args,name:''},{...args,expectedRevision:'sha256:'+'0'.repeat(64)}]){await assert.rejects(h.operations.import(bad));assert.deepEqual(h.studio.exportProject(),before);}
 let accessed=false;const accessor={...args};Object.defineProperty(accessor,'name',{enumerable:true,get(){accessed=true;return 'bad';}});await assert.rejects(h.operations.import(accessor));assert.equal(accessed,false);
});
test('bytes and metadata are copied before awaiting; inputs over 5MiB remain admissible',async()=>{
 let captured;const h=fixture({parseStep:(bytes,options)=>{captured={bytes,options};return step(bytes,options);}}),args=await request(h);args.bytes=new Uint8Array(5*1024*1024+1);args.bytes[0]=7;const pending=h.operations.import(args);args.bytes[0]=9;args.name='Changed';await pending;assert.equal(captured.bytes[0],7);assert.equal(captured.options.name,'Imported');assert.equal(captured.bytes.length,5*1024*1024+1);assert.equal(h.studio.exportProject().name,'Imported');
});
test('abort retains import lease until provider settles, then rejects without commit',async()=>{
 const waiting=deferred(),started=deferred(),controller=new AbortController();let received;
 const h=fixture({parseStep:(bytes,options,{signal})=>{received=signal;started.resolve();return waiting.promise;}}),args=await request(h),before=h.studio.exportProject(),pending=h.operations.import(args,{signal:controller.signal});await started.promise;controller.abort();assert.equal(received,controller.signal);assert.equal(h.operations.isBusy(),true);await assert.rejects(h.operations.import(args),/in progress/);waiting.resolve(step(args.bytes));await assert.rejects(pending,/aborted/);assert.equal(h.operations.isBusy(),false);assert.deepEqual(h.studio.exportProject(),before);
 const finalController=new AbortController();let checks=0;await assert.rejects(h.operations.import(args,{signal:finalController.signal,guard:()=>{if(++checks===4)finalController.abort();return true;}}),/aborted/);assert.deepEqual(h.studio.exportProject(),before);
 const already=new AbortController();already.abort();await assert.rejects(h.operations.import(args,{signal:already.signal}),/aborted/);
});
test('provider failure, expired permission, busy host and changed input cannot overwrite state',async()=>{
 for(const change of ['guard','busy','input','reject']){const waiting=deferred(),started=deferred();let valid=true;const h=fixture({parseStep:()=>{started.resolve();return waiting.promise;}}),args=await request(h),pending=h.operations.import(args,{guard:()=>valid});await started.promise;
 if(change==='guard')valid=false;if(change==='busy')h.busy(true);if(change==='input')h.studio.setMaterialProperties({youngModulus:2e9,poissonRatio:0});const before=h.studio.exportProject();if(change==='reject')waiting.reject(Error('Parser rejected'));else waiting.resolve(step(args.bytes));await assert.rejects(pending,/expired|busy|changed|Parser rejected/);assert.deepEqual(h.studio.exportProject(),before);assert.equal(h.operations.isBusy(),change==='busy');}
 const h=fixture(),args=await request(h);h.busy(true);await assert.rejects(h.operations.import(args),/busy/);h.busy(false);await assert.rejects(h.operations.import(args,{guard:()=>false}),/expired/);
});
test('normalization and host validation complete before commit, and async hooks cannot commit',async()=>{
 for(const normalizeProject of [()=>{throw Error('hook');},async p=>p,p=>Promise.resolve(p),p=>({...p,bad:()=>{}})]){const h=fixture({normalizeProject}),before=h.studio.exportProject();await assert.rejects(h.operations.import(await request(h)));assert.deepEqual(h.studio.exportProject(),before);}
 const h=fixture({normalizeProject:p=>({...p,study:{kind:'structural',gravityEnabled:false}})}),result=await h.operations.import(await request(h));assert.equal(h.studio.exportProject().study.gravityEnabled,false);assert.equal(result.revision,await getProjectRevision(h.studio.exportProject()));
});
