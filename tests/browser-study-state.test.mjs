import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {browserStudyControls,serializeBrowserStudy as serialize,applyBrowserStudy as apply,normalizeBrowserProjectEdit as normalize} from '../src/browser-study-state.js';
const html=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
function initial(){return Object.fromEntries(Object.entries(browserStudyControls).map(([id,d])=>{
 if(d.type==='select'){const match=html.match(new RegExp('<select id="'+id+'">(.*?)</select>'));assert.ok(match,id);const options=[...match[1].matchAll(/<option\b([^>]*)>/g)];assert.deepEqual(options.map(m=>m[1].match(/value="([^"]*)"/)?.[1]),d.options,id);const selected=options.find(m=>/\bselected\b/.test(m[1]))??options[0];return [id,selected[1].match(/value="([^"]*)"/)[1]];}
 const input=html.match(new RegExp('<input\\b[^>]*\\bid="'+id+'"[^>]*>'));assert.ok(input,id);if(d.type==='checkbox')return [id,/\schecked(?:\s|>)/.test(input[0])];assert.equal(input[0].match(/type="([^"]+)"/)?.[1]??'text',d.type,id);return [id,input[0].match(/\bvalue="([^"]*)"/)?.[1]??''];
 }));}
function round(study,c=initial(),materialProperties={}){const result=apply(study,c);return {...result,study:serialize(result.controlValues,{...result.sourceState,materialProperties})};}
test('control descriptors match actual HTML and initial structural serialization retains the existing complete study',()=>{
 const c=initial(),s=serialize(c);assert.equal(s.kind,'structural');assert.equal(s.modeCount,2);assert.equal(s.modalIterations,60);assert.equal(s.acousticDuration,.004);assert.equal(s.pulseWidth,.0002);assert.equal(s.acousticTimeStep,0);assert.equal(s.temperature,80);assert.equal(s.referenceTemperature,20);assert.equal(s.stokesVelocityElement,'P1');assert.equal(s.referenceLengthMm,10);assert.equal(s.modalAnalysis,false);assert.equal(s.acousticTransient,false);assert.equal(s.vibrationSource,undefined);
 for(const key of ['freeStreamVelocity','gravity','receiverPoint'])assert.equal(s[key].length,3);assert.equal(Object.values(browserStudyControls).some(d=>!['number','checkbox','select','text'].includes(d.type)),false);
});
test('structural/thermal/acoustic loads use the same setters and serializer with inactive branch masking',()=>{
 const c=initial();c['solid-temperature']='67';c['flow-pressure-drop']='12';c['modal-enabled']=true;c['transient-acoustic']=true;c['exterior-radiation']=true;c['directivity-enabled']=true;
 for(const kind of ['structural','thermal','acoustic']){const s=round({kind,modalAnalysis:true,acousticTransient:true,exteriorRadiation:true,directivityEnabled:true,gravityEnabled:false,frequency:123,timeStep:2,steps:3},c).study;assert.equal(s.kind,kind);assert.equal(s.modalAnalysis,kind==='structural');assert.equal(s.acousticTransient,kind==='acoustic');assert.equal(s.exteriorRadiation,kind==='acoustic');assert.equal(s.directivityEnabled,kind==='acoustic');assert.equal(s.temperature,67);assert.equal(s.pressureDropPa,12);assert.equal(s.frequency,123);assert.equal(s.timeStep,2);assert.equal(s.steps,3);}
});
test('dynamic defaults match old adapter preservation and reset rules instead of resetting to hardcoded initial UI',()=>{
 const c=initial();Object.assign(c,{'solid-temperature':'72','reference-temperature':'11','material-temperature':'33','flow-pressure-drop':'42','modal-count':'5','modal-iterations':'99','stokes-reference-length':'22','acoustic-duration':'9','pulse-width':'.5','acoustic-time-step':'4','acoustic-damping':'7','acoustic-sweep':true,'transient-heat':true,'exterior-radiation':true});
 const loaded=round({kind:'thermal'},c).study;assert.equal(loaded.temperature,72);assert.equal(loaded.referenceTemperature,11);assert.equal(loaded.materialTemperature,33);assert.equal(loaded.pressureDropPa,42);assert.equal(loaded.modeCount,2);assert.equal(loaded.modalIterations,60);assert.equal(loaded.stokesVelocityElement,'P1');assert.equal(loaded.referenceLengthMm,undefined);assert.equal(loaded.acousticDuration,.004);assert.equal(loaded.pulseWidth,.0002);assert.equal(loaded.acousticTimeStep,0);assert.equal(loaded.dampingRate,0);assert.equal(loaded.sweep,false);assert.equal(loaded.transient,false);
 const missing=round(undefined,c).study;assert.equal(missing.kind,'structural');assert.equal(missing.modeCount,5);assert.equal(missing.modalIterations,99);assert.equal(missing.sweep,true);assert.equal(missing.transient,true);assert.equal(missing.modalAnalysis,false);
});
test('gravity inference, source handling and source-specific physical controls preserve existing behavior',()=>{
 const c=initial(),temperatureSource={name:'Field',mesh:{nodes:[1,2,3]},temperature:[40]},vibrationSource={name:'Mode',amplitudeMm:.01,phaseDeg:-45,mesh:{nodes:[1,2,3]},frequencyHz:123};
 const r=round({kind:'acoustic',temperatureSource,vibrationSource,gravity:[0,0,-2],freeStreamVelocity:[1,2,3],receiverPoint:[4,5,6]},c);assert.equal(r.study.gravityEnabled,true);assert.deepEqual(r.study.gravity,[0,0,-2]);assert.deepEqual(r.study.freeStreamVelocity,[1,2,3]);assert.deepEqual(r.study.receiverPoint,[4,5,6]);assert.deepEqual(r.study.temperatureSource,temperatureSource);assert.deepEqual(r.study.vibrationSource,vibrationSource);assert.equal(r.controlValues['vibration-amplitude'],'.01'.replace(/^\./,'0.'));assert.equal(r.controlValues['vibration-phase'],'-45');
 const structural=round({kind:'structural',vibrationSource,gravity:[0,0,-2],gravityEnabled:false},c);assert.equal(structural.study.vibrationSource,undefined);assert.equal(structural.sourceState.vibrationSource.name,'Mode');assert.equal(structural.study.gravityEnabled,false);assert.deepEqual(structural.study.gravity,[0,0,-2]);
 r.sourceState.temperatureSource.temperature[0]=999;assert.equal(temperatureSource.temperature[0],40);assert.equal(round({kind:'thermal'},c).sourceState.temperatureSource,null);
});
test('programmatic number/text/select/checkbox assignment mirrors browser sanitization without min/max clamping',()=>{
 const c=initial(),s=round({kind:'unsupported',modeCount:99,modalIterations:1000,temperature:null,referenceTemperature:'not a number',stokesVelocityElement:'unknown',flowAxis:9,directivityAxis:null,timeStep:'+1',steps:'1.',initialTemperature:'1e309',gravityEnabled:0,thermalStress:1},c);
 assert.equal(s.study.kind,'');assert.equal(s.study.modeCount,99);assert.equal(s.study.modalIterations,1000);assert.equal(s.study.temperature,0);assert.equal(s.study.referenceTemperature,0);assert.equal(s.study.stokesVelocityElement,'');assert.equal(s.study.flowAxis,0);assert.equal(s.study.directivityAxis,0);assert.equal(s.study.timeStep,0);assert.equal(s.study.steps,0);assert.equal(s.study.initialTemperature,0);assert.equal(s.study.gravityEnabled,false);assert.equal(s.study.thermalStress,true);
});
test('ms/us conversions are exactly one real control roundtrip and may deliberately be non-idempotent',()=>{
 const s={kind:'acoustic',acousticDuration:.006986962513465328,pulseWidth:.000321,acousticTimeStep:.000001234,dampingRate:42},r=round(s);assert.equal(r.controlValues['acoustic-duration'],String(s.acousticDuration*1000));assert.equal(r.controlValues['acoustic-time-step'],String(s.acousticTimeStep*1e6));assert.equal(r.study.acousticDuration,Number(String(s.acousticDuration*1000))*.001);assert.equal(r.study.pulseWidth,Number(String(s.pulseWidth*1000))*.001);assert.equal(r.study.acousticTimeStep,Number(String(s.acousticTimeStep*1e6))*1e-6);assert.notEqual(round(r.study).study.acousticDuration,r.study.acousticDuration);
});
test('plastic history is enabled only by structural plastic material and preserves matching step count validation',()=>{
 const c=initial(),p={plasticity:{model:'j2-isotropic'}},study={kind:'structural',plasticLoadFractions:[.1,.5,1,.3],nonlinearLoadSteps:4},r=round(study,c,p);assert.equal(r.controlValues['plastic-load-fractions'],'0.1,0.5,1,0.3');assert.deepEqual(r.study.plasticLoadFractions,[.1,.5,1,.3]);assert.equal(r.study.nonlinearLoadSteps,4);assert.equal(round(study,c,{}).study.plasticLoadFractions,undefined);assert.equal(round({...study,kind:'thermal'},c,p).study.plasticLoadFractions,undefined);
 c['plastic-load-fractions']='.1,,1';assert.throws(()=>serialize(c,{materialProperties:p}),/Invalid plastic load fractions/);
});
test('normalizer is pure and preserves outer candidate snapshots while dropping unsupported study fields',()=>{
 const c=initial(),candidate={version:1,name:'Original',meshes:[{positions:[0,0,0],faceIds:[]}],selection:[[]],conditions:[],materialProperties:{youngModulus:1e9},meshSettings:{refinements:[]},analysisIntent:{mode:'exploratory'},study:{kind:'thermal',temperature:44,unknownPhysicalInput:123}},before=structuredClone(candidate),oldControls=structuredClone(c),out=normalize(candidate,c),expected=round(candidate.study,c,candidate.materialProperties).study;
 assert.deepEqual(out.study,expected);assert.equal(out.study.unknownPhysicalInput,undefined);assert.deepEqual(candidate,before);assert.deepEqual(c,oldControls);for(const key of ['name','meshes','selection','conditions','materialProperties','meshSettings','analysisIntent'])assert.deepEqual(out[key],candidate[key]);out.meshes[0].positions[0]=99;assert.equal(candidate.meshes[0].positions[0],0);
 const defaults=normalize({version:1,study:{kind:'structural'}},c);assert.deepEqual(defaults.meshSettings,{refinements:[]});assert.deepEqual(defaults.materialProperties,{});
});
test('thermal snapshot count round-trips only for transient thermal and is absent when off',()=>{
 const base={kind:'thermal',transient:true,timeStep:1,steps:10};
 assert.equal(round({...base,thermalSnapshotCount:9}).study.thermalSnapshotCount,9);
 assert.equal(Object.hasOwn(round(base).study,'thermalSnapshotCount'),false);
 assert.equal(Object.hasOwn(round({...base,transient:false,thermalSnapshotCount:9}).study,'thermalSnapshotCount'),false);
 assert.equal(Object.hasOwn(round({kind:'structural',thermalSnapshotCount:9}).study,'thermalSnapshotCount'),false);
});
test('viewer wiring: per-kind accessor is used and unsupported thermal paths refuse',async()=>{
 for(const s of ['function renderTimeFrames(r)','if(framesOf(r))renderTimeFrames(r)','fixedFieldRange(framesOf(result).fields)','...thermalFrameDisplay()});};',"name:language==='en'?'Heat conduction reference sample'"])assert.ok(html.includes(s),s);assert.ok(!html.includes('Probing is available only for the final thermal step'));
 const exporter=await readFile(new URL('../src/visual-export.js',import.meta.url),'utf8');assert.match(exporter,/result\?\.kind!=='acousticTransient'/);assert.equal(exporter.split('Time playback export is not supported for thermal results yet').length-1,2);assert.ok(exporter.includes("timeAnimationResultKinds:['acousticTransient']"));
});
