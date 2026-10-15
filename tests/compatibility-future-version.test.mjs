import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {validateNamedViewArchive,createNamedResultViews} from '../src/named-result-views.js';
import {createResultViewApi} from '../src/result-view-api.js';
import {createMeasurementHistory,validateMeasurementArchive} from '../src/measurement-history.js';
import {validateCaseViewBundle,createCaseViewBundle} from '../src/case-view-bundle.js';
import {validateInputProvenance} from '../src/input-provenance.js';
import {validateRuntimeIdentity} from '../src/runtime-identity.js';
import {restoreAnalysisError,analysisError,createAnalysisFailure} from '../src/analysis-failure.js';
import {getProjectRevision} from '../src/project-revision.js';

// Policy: docs/compatibility-policy.md. A future version must be refused without mutation.
// A format that currently does not refuse is pinned as `knownGap` (present behaviour, not desired behaviour).
const FUTURE=[2,99];
const clone=value=>structuredClone(value);
const savedOutput=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],study:{kind:'thermal'},materialProperties:{conductivity:1}},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'thermal',minTemperature:20,maxTemperature:50,temperature:[20,30,40,50],flux:[[1,2,3]]}});
const project=()=>({...savedOutput().input,name:'compat'});
const plainOutput={input:{version:1},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},result:{kind:'thermal',temperature:[20,30,40,50],flux:[[1,2,3]]}};
const viewState=()=>({field:'temperature',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:null,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}});
const setupState=()=>({clipEnabled:false,flip:false,axis:0,position:0,opacity:1,meshCount:1,hiddenParts:[]});
const identity=schemaVersion=>({schemaVersion,target:'node',isolation:'process',build:{status:'unavailable'},engine:{requestedMethod:null,actualEngine:null},assets:[]});
function namedFixture(){
 let live=viewState(),setup=setupState();
 const resultView=createResultViewApi({getAnalysis:()=>plainOutput,get:()=>structuredClone(live),set:s=>{live=structuredClone(s);},isBusy:()=>false});
 const api=createNamedResultViews({resultView,setupView:{get:()=>structuredClone(setup),set:v=>{setup=structuredClone(v);}}});
 return {api,resultView};
}

test('saved project (studio loadProject, version): future refused without mutation, current round-trips',async()=>{
 const api=createStudioApi();api.loadProject(project());
 const before=api.exportProject(),revision=await getProjectRevision(before);
 for(const version of [...FUTURE,0,undefined,'1']){const candidate=clone(project());candidate.version=version;assert.throws(()=>api.loadProject(candidate),/対応するプロジェクト/);assert.deepEqual(api.exportProject(),before);}
 assert.equal(await getProjectRevision(api.exportProject()),revision);
 const second=createStudioApi();second.loadProject(api.exportProject());assert.deepEqual(second.exportProject(),before);
 // additive: an unknown optional top-level field is carried, not rejected.
 const additive=createStudioApi();additive.loadProject({...project(),futureOptionalField:{note:'x'}});assert.deepEqual(additive.exportProject().futureOptionalField,{note:'x'});
});

test('input provenance document (schemaVersion): future refused, current accepted',()=>{
 const document={schemaVersion:1,entries:[]};assert.doesNotThrow(()=>validateInputProvenance(document));
 for(const schemaVersion of FUTURE)assert.throws(()=>validateInputProvenance({...document,schemaVersion}),/provenance/);
 const api=createStudioApi();api.loadProject(project());const before=api.exportProject();
 assert.throws(()=>api.setInputProvenance({schemaVersion:2,entries:[]}));assert.deepEqual(api.exportProject(),before);
 assert.throws(()=>createStudioApi().loadProject({...project(),inputProvenance:{schemaVersion:2,entries:[]}}));
});

test('runtime identity (schemaVersion): future refused, current accepted',()=>{
 for(const schemaVersion of FUTURE)assert.throws(()=>validateRuntimeIdentity(identity(schemaVersion)),/Invalid runtime identity/);
 assert.doesNotThrow(()=>validateRuntimeIdentity(identity(1)));
});

test('case archive (createCaseStore import, version): future refused without mutation, current round-trips',()=>{
 const store=createCaseStore();store.add('A',savedOutput());
 const archive=store.export(),before=clone(store.list());
 assert.equal(archive.version,1);
 for(const version of [...FUTURE,0,undefined]){assert.throws(()=>store.import({...clone(archive),version}),/Invalid case archive/);assert.deepEqual(store.list(),before);}
 const copy=createCaseStore();copy.import(clone(archive));assert.deepEqual(copy.export(),archive);
 // nested saved input version is also refused atomically
 const nested=clone(archive);nested.cases[0].output.input.version=2;assert.throws(()=>store.import(nested));assert.deepEqual(store.list(),before);
 // knownGap: the case archive top level is not key-checked, so an unknown sibling key is accepted and silently dropped.
 const lenient=createCaseStore();lenient.import({...clone(archive),futureField:true});assert.equal(Object.hasOwn(lenient.export(),'futureField'),false);
});

test('named result view archive (version): future refused without mutation, current round-trips',async()=>{
 const {api,resultView}=namedFixture(),before=await resultView.get(),list=await api.list();
 await api.save({name:'Ref',expectedResultRevision:before.resultRevision,expectedArchiveRevision:list.archiveRevision});
 const archive=await api.export(),listing=await api.list();assert.equal(archive.version,1);
 for(const version of [...FUTURE,0,undefined]){assert.throws(()=>validateNamedViewArchive({...clone(archive),version}),/Invalid named view archive/);await assert.rejects(api.import({archive:{...clone(archive),version},expectedArchiveRevision:listing.archiveRevision}),/Invalid named view archive/);assert.deepEqual(await api.export(),archive);}
 const other=namedFixture(),empty=await other.api.list();await other.api.import({archive:clone(archive),expectedArchiveRevision:empty.archiveRevision});assert.deepEqual(await other.api.export(),archive);
 assert.throws(()=>validateNamedViewArchive({...clone(archive),futureField:1}),/Invalid named view archive/);
});

test('measurement archive (version): future refused without mutation, current round-trips',async()=>{
 const empty={version:1,measurements:[]};assert.deepEqual(validateMeasurementArchive(empty),empty);
 for(const version of [...FUTURE,0])assert.throws(()=>validateMeasurementArchive({...empty,version}),/Invalid measurement archive/);assert.throws(()=>validateMeasurementArchive({measurements:[]}),/Invalid measurement archive/);
 assert.throws(()=>validateMeasurementArchive({...empty,futureField:1}),/Invalid measurement archive/);
 const resultView=createResultViewApi({getAnalysis:()=>plainOutput,get:()=>viewState(),set:()=>{},isBusy:()=>false});
 const history=createMeasurementHistory({resultView}),before=await history.exportArchive(),pending=await history.list();
 for(const version of FUTURE)await assert.rejects(history.prepareArchiveReplacement({archive:{...empty,version},expectedArchiveRevision:pending.archiveRevision}),/Invalid measurement archive/);
 assert.deepEqual((await history.exportArchive()).archive,before.archive);
 const plan=await history.prepareArchiveReplacement({archive:clone(empty),expectedArchiveRevision:pending.archiveRevision});assert.equal(typeof plan.commit,'function');
});

test('case/view bundle (version, kind): future refused without mutation, v1 and v2 accepted per adapters',async()=>{
 const bundle={version:1,kind:'case-view-bundle',caseArchive:{version:1,cases:[]},namedViewArchive:{version:1,views:[]}};
 assert.deepEqual(await validateCaseViewBundle(clone(bundle)),bundle);
 const v2={...clone(bundle),version:2,measurementArchive:{version:1,measurements:[]}};assert.deepEqual(await validateCaseViewBundle(clone(v2)),v2);
 for(const version of [0,3,99])await assert.rejects(validateCaseViewBundle({...clone(bundle),version}),/Invalid case view bundle/);
 await assert.rejects(validateCaseViewBundle({...clone(bundle),kind:'case-view-bundle-next'}),/Invalid case view bundle/);
 await assert.rejects(validateCaseViewBundle({...clone(bundle),futureField:1}),/Invalid case view bundle/);
 // nested future versions are refused too
 for(const mutate of [b=>{b.caseArchive.version=2;},b=>{b.namedViewArchive.version=2;},b=>{b.measurementArchive.version=2;}]){const candidate=clone(v2);mutate(candidate);await assert.rejects(validateCaseViewBundle(candidate));}
 // import through the real bundle API leaves cases/views untouched on refusal; v1 import is the documented legacy path.
 const store=createCaseStore(),{api:namedViews}=namedFixture(),bundles=createCaseViewBundle({store,namedViews}),current=await bundles.exportArchive();
 for(const version of [3,99])await assert.rejects(bundles.importArchive({archive:{...clone(bundle),version},expectedArchiveRevision:current.archiveRevision}));
 assert.deepEqual((await bundles.exportArchive()).archive,current.archive);
 await assert.rejects(bundles.importArchive({archive:clone(v2),expectedArchiveRevision:current.archiveRevision}),/requires measurement history support/);
 assert.equal((await bundles.importArchive({archive:clone(bundle),expectedArchiveRevision:current.archiveRevision})).imported,true);
});

test('analysis failure record (schemaVersion): knownGap, a future version is NOT refused; it degrades to the legacy message',()=>{
 const failure=createAnalysisFailure(analysisError('ANALYSIS_TEST','message',{stage:'solve'}),{stage:'solve'});
 assert.equal(restoreAnalysisError('legacy',failure).analysisFailure?.schemaVersion,1);
 const future=restoreAnalysisError('legacy',{...clone(failure),schemaVersion:2});
 assert.equal(future.analysisFailure,undefined);assert.equal(future.message,'legacy');assert.equal(future.code,undefined);
});
