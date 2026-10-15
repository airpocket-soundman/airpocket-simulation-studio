import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getObservationProfiles,resolveObservationProfile as resolve} from '../src/observation-profiles.js';
import {getCapabilities,diagnoseExecution} from '../src/capabilities.js';
const project=(kind='structural',study={},material={})=>({study:{kind,...study},materialProperties:material,conditions:[]});
test('worker branch matrix selects numerical versus text-only paths without loading solvers',async()=>{
 const cases=[
 [project(),{},'elastic-cpu'],[project('structural',{}, {orthotropic:{}}),{},'elastic-cpu'],
 [project('structural',{modalAnalysis:true,gravityEnabled:false}),{},'modal-cpu'],
 [project('structural',{}, {plasticity:{}}),{},'plasticity-cpu'],[project('structural',{}, {hyperelastic:{}}),{},'hyperelastic-cpu'],
 [project('thermal'),{},'thermal-steady'],[project('thermal',{transient:true}),{},'thermal-transient'],
 [project('thermal',{transient:true}),{transient:false},'thermal-steady'],
 [project('acoustic',{acousticTransient:true}),{},'acoustic-transient'],[project('acoustic',{sweep:true}),{},'acoustic-frequency'],
 [project('channelFlow'),{},'channel-flow'],[project('creepingFlow'),{},'stokes'],
 [project(),{method:'mfem-wasm'},'elastic-mfem'],[project(),{method:'webgpu-pcg'},'elastic-webgpu']
 ];
 for(const [p,o,id]of cases){const selected=resolve(p,o);assert.equal(selected.profileId,id);assert.equal(selected.supported,true);assert.deepEqual(selected.profile.events.slice(0,3).map(e=>e.stage),['preparation','mesh','progress']);}
 const source=await readFile(new URL('../src/observation-profiles.js',import.meta.url),'utf8');assert.doesNotMatch(source,/^import\s/m);
 for(const id of ['elastic-mfem','elastic-webgpu'])assert.deepEqual(getObservationProfiles().find(p=>p.id===id).events.filter(e=>!['execution-failure','pending-payload-limit'].includes(e.when)).map(e=>e.stage),['preparation','mesh','progress']);
});
test('unsupported combinations and malformed selectors never advertise fields',()=>{
 const cases=[ [project(),{method:4}], [project(),{adaptive:'yes'}], [project('thermal'),{includeFields:'yes'}],
 [project(),{method:'webgpu-pcg'},'node'],[project('thermal'),{method:'mfem-wasm'}],
 [project('fluidDomain'),{}],[project('unknown'),{}],
 [project('structural',{modalAnalysis:true}),{adaptive:true}],
 [project('structural',{}, {plasticity:{}}),{adaptive:true}],
 [project('structural',{}, {hyperelastic:{},plasticity:{}}),{}],
 [project('acoustic',{acousticTransient:true,sweep:true}),{}],
 [{...project('structural',{}, {hyperelastic:{}}),conditions:[{type:'pressure'}]},{}],
 [project('structural',{modalAnalysis:true,gravity:[0,0,-9.81]}),{}]
 ];
 for(const [p,o,target]of cases){const result=resolve(p,o,target);assert.equal(result.supported,false,JSON.stringify([p,o,target]));assert.equal(result.profile,null);assert.ok(result.reasons.length);assert.equal(result.fieldRetention.available,false);assert.equal(result.fieldRetention.meshAvailable,false);}
 assert.throws(()=>resolve({},null),/options/);assert.throws(()=>resolve({}, {},'unknown'),/target/);assert.throws(()=>resolve({}, {},'browser','bad'),/operation/);
});
test('mesh and scalar retention are independently declared and do not guarantee evidence',()=>{
 const mesh=resolve(project('fluidDomain'),{includeFields:true},'node','mesh');assert.equal(mesh.profileId,'mesh');assert.equal(mesh.fieldRetention.meshAvailable,true);assert.equal(mesh.fieldRetention.available,false);
 assert.equal(resolve(project('thermal'),{method:'mfem-wasm'},'browser','mesh').profileId,'mesh');
 const adaptiveMesh=resolve(project(),{adaptive:true},'browser','mesh');assert.equal(adaptiveMesh.adaptive.meshPerRound,false);assert.equal(adaptiveMesh.adaptive.textProgressOnly,false);
 const thermal=resolve(project('thermal'),{includeFields:true});assert.equal(thermal.fieldRetention.available,true);assert.equal(thermal.fieldRetention.scalarFieldsSupported,true);assert.equal(thermal.fieldRetention.availabilityIsGuarantee,false);assert.equal(thermal.fieldRetention.maxBytes,64000000);assert.equal(thermal.fieldRetention.eventRetention,256);
 const optout=resolve(project('thermal'));assert.equal(optout.fieldRetention.available,false);assert.equal(optout.fieldRetention.scalarFieldsSupported,true);assert.equal(optout.declarationOnly,true);assert.equal(optout.physicalAccuracyVerified,false);
 assert.match(thermal.profile.fields[0].cadence,/time 0/);
 const acoustic=resolve(project('acoustic',{acousticTransient:true}));assert.match(acoustic.profile.fields[0].cadence,/ceil\(steps\/60\)/);assert.match(acoustic.profile.fields[0].cadence,/excludes initial/);
 const adaptive=resolve(project(),{adaptive:true});assert.equal(adaptive.adaptive.meshPerRound,true);assert.equal(adaptive.adaptive.structuredRoundEvents,false);assert.ok(!adaptive.profile.events.some(e=>e.stage==='adaptive-round'));
});
test('catalog, diagnostics and returned selections are independent JSON metadata',()=>{
 const p=project('thermal'),before=structuredClone(p),a=resolve(p,{includeFields:true});a.profile.events[0].stage='corrupt';a.profile.fields[0].unit='bad';
 assert.equal(resolve(p).profile.events[0].stage,'preparation');assert.equal(resolve(p).profile.fields[0].unit,'degC');assert.deepEqual(p,before);
 const c=getCapabilities({target:'node'});assert.equal(c.observation.profiles.length,12);assert.ok(!c.observation.profiles.some(p=>p.id==='elastic-webgpu'));c.observation.profiles.length=0;assert.equal(getObservationProfiles({target:'node'}).length,12);
 assert.deepEqual(diagnoseExecution(p).selectedObservation,resolve(p));assert.throws(()=>diagnoseExecution(p,{includeFields:'yes'}),/options/);
 assert.deepEqual(JSON.parse(JSON.stringify(resolve(null))),resolve(null));
});

test('pending queue gap notifications are optional provisional host metadata with explicit required fields and budget basis',()=>{
 for(const profile of getObservationProfiles()){
  const declaration=profile.events.find(event=>event.stage==='observation-queue-limit');assert.ok(declaration);
  assert.equal(declaration.when,'pending-payload-limit');assert.equal(declaration.optional,true);assert.equal(declaration.provisional,true);
  assert.equal(declaration.pendingBasis,'in-flight-and-queued-full-payloads');assert.equal(declaration.byteBasis,'conservative-structural-estimate');assert.equal(declaration.storageBudgetSeparate,true);assert.equal(declaration.workerTransportBounded,false);
  assert.equal(declaration.latestPolicy,'last-accepted-snapshot');assert.equal(declaration.acceptedIsStored,false);
  assert.deepEqual(declaration.requiredFields,['observationQueue.reason','observationQueue.observationSequence','observationQueue.maxEvents','observationQueue.maxBytes','observationQueue.pendingEvents','observationQueue.pendingBytes','observationQueue.dropped','observationQueue.latestPolicy']);
 }
});
