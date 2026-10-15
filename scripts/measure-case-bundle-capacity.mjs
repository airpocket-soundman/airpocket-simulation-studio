// Node-side honest capacity measurement for the case/view/measurement bundle.
// Scope: shared modules only (case store, named views, measurement history,
// case-view-bundle, case-archive-transfer). No browser UI, no network, no MCP.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {analyzeProject} from './headless-analysis.mjs';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {preflightProject} from '../src/analysis-preflight.js';
import {createInputProvenance} from '../src/input-provenance.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {createCaseViewBundle} from '../src/case-view-bundle.js';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';
import {createNamedResultViews} from '../src/named-result-views.js';
import {createResultViewApi,resultFields,canonicalViewState} from '../src/result-view-api.js';
import {createMeasurementHistory} from '../src/measurement-history.js';
import {getProjectRevision,canonicalJson} from '../src/project-revision.js';
import {advancedStructuralProject,documentAdvancedStructural} from '../tests/fixtures/advanced-structural-projects.mjs';
import {structuralContractProject,documentStructuralContract} from '../tests/fixtures/structural-contract-projects.mjs';

export const LIMITS=Object.freeze({maxCases:8,maxViews:16,maxMeasurements:100,maxMeasurementArchiveBytes:300000,chunkBytes:65536,maxBundleBytes:100000000});
export const SCOPE='node; shared modules; not browser UI, not network';
const SIZE_LIMIT_NOTE='Cases replicate one real analysis output under distinct names (the store accepts duplicate outputs); distinctPhysicalOutputs records this.';

// ---------------------------------------------------------------- builders
function documented(p,mode='exploratory'){
 p.analysisIntent={mode};
 p.inputProvenance=createInputProvenance(preflightProject(p).requiredPointers.map(pointer=>({pointer,value:pointer.slice(1).split('/').reduce((v,k)=>v[k],p),source:{kind:'agent-proposal'},rationale:'Explicit synthetic capacity-measurement input',status:'unconfirmed',assumption:'Synthetic reference; not measured',applicability:'Limited model; capacity measurement only'})));
 return p;
}
function barProject(extraStudy={},material={youngModulus:1e9,poissonRatio:0}){
 const p=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}),pos=p.meshes[0].positions,all=p.meshes[0].faceIds.map((_,i)=>i);
 const face=z=>all.filter(i=>[2,5,8].every(k=>Math.abs(pos[i*9+k]-z)<1e-8));
 p.study={kind:'structural',...extraStudy};p.materialProperties=material;
 p.conditions=[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}];
 return p;
}
const fatigueData={model:'stress-life',stressRatio:-1,snCurve:[{stressAmplitudePa:1e7,cycles:1e4},{stressAmplitudePa:1e6,cycles:1e6},{stressAmplitudePa:1e5,cycles:1e8}],ultimateStrengthPa:4e8,yieldStressPa:2.5e8,source:'Synthetic reference only',testConditions:'Synthetic fully reversed axial reference; not a real material'};
const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic analytical reference only',testConditions:'Uniform tensile stress; infinite centre crack, Y=1',surfaceCondition:'Synthetic crack; residual stress is specified separately'};
function acousticBase(){
 const base=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,2,2,4]}}),all=base.meshes[0].faceIds.map((_,i)=>i);
 const harmonic=structuredClone(base);harmonic.materialProperties={};harmonic.study={kind:'acoustic',acousticTransient:false,sweep:false,exteriorRadiation:false,directivityEnabled:false,frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0,referencePressurePa:20e-6};harmonic.conditions=[{type:'acousticPressure',value:1,direction:[0,0,1],regions:[{mesh:0,triangles:all}]}];
 return {base,harmonic};
}
function heatProject(){const p=advancedStructuralProject('thermalStress');p.study={kind:'thermal',transient:false,volumetricSource:0};p.materialProperties={conductivity:1};p.conditions=p.conditions.map(c=>({...c,type:'temperature',value:80}));return p;}

/** Every kind the repo can build headlessly through the shared analysis path (scripts/headless-analysis.mjs). */
export const KIND_BUILDERS={
 elastic:{label:'Linear elastic bar',build:()=>({project:barProject(),options:{size:5}})},
 thermal:{label:'Steady thermal',build:()=>({project:documented(heatProject()),options:{size:5}})},
 acoustic:{label:'Acoustic harmonic',build:()=>({project:documented(acousticBase().harmonic),options:{size:2}})},
 modal:{label:'Modal (lumped Tet4)',build:()=>({project:documentStructuralContract(structuralContractProject('modal'),'exploratory'),options:{size:5}})},
 acousticTransient:{label:'Transient acoustic pulse',build:()=>{const p=structuredClone(acousticBase().harmonic);p.study={...p.study,acousticTransient:true,acousticDuration:.0025,pulseWidth:.0002,dampingRate:0,acousticTimeStep:0,receiverPoint:[1,1,2]};return {project:documented(p),options:{size:2}};}},
 stokes:{label:'Creeping flow (Stokes P1)',build:()=>{const {base}=acousticBase(),p=structuredClone(base);p.materialProperties={};p.conditions=[];p.sourceModel={kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:1},enclosure:[-3,-3,-3,6,6,6]};p.study={kind:'creepingFlow',dynamicViscosity:.01,fluidDensity:1.2,freeStreamVelocity:[.0001,0,0],referenceLengthMm:2,stokesVelocityElement:'P1'};return {project:documented(p),options:{size:2}};}},
 channelFlow:{label:'Channel flow',build:()=>{const {base}=acousticBase(),p=structuredClone(base);p.materialProperties={};p.conditions=[];p.study={kind:'channelFlow',dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500,pressureDropPa:.001,flowAxis:2};return {project:documented(p),options:{size:2}};}},
 plastic:{label:'J2 plasticity',build:()=>({project:documentAdvancedStructural(advancedStructuralProject('plasticity')),options:{size:5}})},
 hyperelastic:{label:'Neo-Hookean hyperelastic',build:()=>({project:documentAdvancedStructural(advancedStructuralProject('hyperelastic')),options:{size:5}})},
 fatigue:{label:'Stress-life fatigue assessment',build:()=>({project:barProject({},{youngModulus:1e9,poissonRatio:0,fatigueData}),options:{size:5,fatigueAssessment:{minLoadFactor:-1,maxLoadFactor:1,meanStressCorrection:'none',appliedCycles:1e5}}})},
 fracture:{label:'LEFM mode-I fracture assessment',build:()=>({project:barProject({materialTemperature:20},{youngModulus:1e9,poissonRatio:0,fractureData}),options:{size:5,fractureAssessment:{flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack; a is half crack length',stressAssumption:'Uncracked nominal stress is uniform across the assumed flaw'}}})}
};
export const ALL_KINDS=Object.keys(KIND_BUILDERS);

// ---------------------------------------------------------------- helpers
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const now=()=>performance.now();
const round=v=>Math.round(v*100)/100;
function memoryTracker(){
 const peak={rss:0,heapUsed:0};const sample=()=>{const m=process.memoryUsage();peak.rss=Math.max(peak.rss,m.rss);peak.heapUsed=Math.max(peak.heapUsed,m.heapUsed);};
 const timer=setInterval(sample,25);timer.unref?.();sample();
 return {sample,stop(){sample();clearInterval(timer);return {peakRssBytes:peak.rss,peakHeapUsedBytes:peak.heapUsed};}};
}
const reply=async fn=>{try{return {ok:true,value:await fn()};}catch(error){return {ok:false,message:String(error?.message??error)};};};
function host({displayed,resultSettingsRef,measureView,meshCount=1}={}){
 const store=createCaseStore();let count=0;
 const settings=resultSettingsRef??{value:null},setup={value:{clipEnabled:false,flip:false,axis:0,position:0,opacity:1,meshCount,hiddenParts:[]}};
 const resultView=displayed?createResultViewApi({getAnalysis:()=>displayed.value,get:()=>settings.value,set:v=>{settings.value=structuredClone(v);}}):{};
 const namedViews=createNamedResultViews({resultView,setupView:{get:()=>setup.value,set:v=>{setup.value=structuredClone(v);}},id:()=>'view-'+(++count)});
 const measurements=createMeasurementHistory({resultView:measureView??{async get(){throw Error('No displayed result');},async probe(){throw Error('No displayed result');}}});
 const api=createCaseViewBundle({store,namedViews,measurements}),transfer=createCaseArchiveTransfer({cases:api});
 return {store,namedViews,measurements,api,transfer,settings,setup,resultView};
}
async function load(h,archive){return h.api.importArchive({archive,expectedArchiveRevision:(await h.api.list()).archiveRevision});}
function viewVariants(displayed,count){
 const fields=resultFields(displayed.result).map(f=>f.id),views=[];
 for(let i=0;i<count;i++){
  const field=fields[i%fields.length];
  views.push({field,modeIndex:displayed.result.kind==='modal'?i%displayed.result.modes.length:null,frameIndex:displayed.result.kind==='acousticTransient'?i%displayed.result.snapshots.length:null,deformScale:1+i,surface:i%2===0,surfaceWire:i%3===0,volumeWire:i%5===0,section:i%4===0,colorRange:null,camera:{position:[5+i,5,5],target:[0,0,0],up:[0,1,0],fov:30+i}});
 }
 return views;
}
function tetCentroids(mesh,count){
 const out=[],n=mesh.tetrahedra.length;
 for(let i=0;i<count;i++){const t=mesh.tetrahedra[Math.floor(i*n/count)%n],ids=Array.isArray(t)?t:t.nodes??t;out.push([0,1,2].map(a=>ids.reduce((s,node)=>s+mesh.nodes[3*node+a]/ids.length,0)));}
 return out;
}
async function transferRoundtrip(src,dst,expectedRevision,tamper){
 const t={};let started=now();
 const exported=await src.transfer.beginExport();t.beginExportMs=now()-started;
 started=now();const chunks=[];let offset=0;
 do{const page=src.transfer.read({transferId:exported.transferId,offset});chunks.push(Buffer.from(page.data,'base64'));offset=page.nextOffset;}while(offset!==null);t.readMs=now()-started;
 const bytes=Buffer.concat(chunks);
 return {exported,bytes,chunks,timings:t,async upload(data=bytes,revision=expectedRevision,hash=sha(data)){
  const begin=dst.transfer.beginImport({expectedArchiveRevision:revision,totalBytes:data.length,sha256:hash});let w=now(),count=0;
  for(let o=0;o<data.length;o+=LIMITS.chunkBytes){dst.transfer.write({transferId:begin.transferId,offset:o,data:data.subarray(o,o+LIMITS.chunkBytes).toString('base64')});count++;}
  return {begin,writeMs:now()-w,writeChunks:count};
 }};
}

// ---------------------------------------------------------------- per-kind run
async function measureKind(kind,config){
 const builder=KIND_BUILDERS[kind],record={kind,label:builder.label,status:'fail'},tracker=memoryTracker(),totalStart=now();
 try{
  let started=now();const {project,options}=builder.build();
  const output=await analyzeProject(project,options);record.analysisMs=round(now()-started);tracker.sample();
  record.resultKind=output.result.kind;record.resultFeatures=['plasticity','hyperelastic','fatigue','fracture','stokes','radiation','coupling'].filter(key=>output.result[key]!==undefined);
  record.singleOutputBytes=Buffer.byteLength(JSON.stringify(output));record.distinctPhysicalOutputs=1;
  // Cases: the shared store validates every one through the same code as the UI.
  const sourceStore=createCaseStore();started=now();
  for(let i=0;i<config.cases;i++)sourceStore.add(`${kind} case ${i+1}`,structuredClone(output));
  record.caseAddMs=round(now()-started);const caseArchive=sourceStore.export();
  const displayed=prepareCaseView(sourceStore.list()[0]),resultRevision=await getProjectRevision(JSON.parse(JSON.stringify(displayed)));
  record.resultRevision=resultRevision;
  // Views: hand-built from valid fields for this kind; validation happens in the bundle import.
  const meshCount=displayed.input.meshes.length,variants=viewVariants(displayed,config.views);
  const setupFor=i=>({clipEnabled:i%2===0,flip:i%3===0,axis:i%3,position:i/100,opacity:1,meshCount,hiddenParts:[]});
  const namedViewArchive={version:1,views:variants.map((result,i)=>({id:`view-${i+1}`,name:`${kind} view ${i+1}`,resultRevision,result,setup:setupFor(i)}))};
  // Measurements: real probes through the shared result-view API until the configured count or a code limit.
  const display={value:displayed},viewSettings={value:variants[0]},resultView=createResultViewApi({getAnalysis:()=>display.value,get:()=>viewSettings.value}),history=createMeasurementHistory({resultView,id:(()=>{let n=0;return()=>`m-${++n}`;})()});
  const points=tetCentroids(displayed.mesh,config.measurements);started=now();let stoppedBy='configured count reached';
  for(let i=0;i<points.length;i++){
   const attempt=await reply(async()=>history.save({name:`${kind} point ${i+1}`,expectedResultRevision:resultRevision,expectedArchiveRevision:(await history.list()).archiveRevision,point:points[i],options:{}}));
   if(!attempt.ok){stoppedBy=attempt.message;break;}
   if(i%10===0)tracker.sample();
  }
  record.measurementBuildMs=round(now()-started);
  const measurementArchive=(await history.exportArchive()).archive;
  record.measurementLimit={requested:config.measurements,achieved:measurementArchive.measurements.length,stoppedBy,archiveBytes:Buffer.byteLength(JSON.stringify(measurementArchive))};
  const original={version:2,kind:'case-view-bundle',caseArchive,namedViewArchive,measurementArchive};
  const originalRevision=await getProjectRevision(original);
  // Source host loads the bundle through the same validating import as the UI path.
  const displaySrc={value:displayed},settingsSrc={value:variants[0]};
  const source=host({displayed:displaySrc,resultSettingsRef:settingsSrc,meshCount});
  started=now();const imported=await load(source,original);record.validatingImportMs=round(now()-started);tracker.sample();
  started=now();const exportedByApi=await source.api.exportArchive();record.exportAndValidateMs=round(now()-started);tracker.sample();
  // Destination host: fresh, with real display adapters to prove every named view applies back.
  const displayDst={value:null},settingsDst={value:variants[0]},destination=host({displayed:displayDst,resultSettingsRef:settingsDst,meshCount});
  const emptyRevision=(await destination.api.list()).archiveRevision;
  const trip=await transferRoundtrip(source,destination,emptyRevision);tracker.sample();
  const bundleJson=JSON.parse(trip.bytes.toString('utf8'));
  const uploaded=await trip.upload();started=now();const commit=await destination.transfer.commit({transferId:uploaded.begin.transferId});record.commitMs=round(now()-started);tracker.sample();
  const restored=await destination.api.exportArchive();
  const verification={
   hashEqual:sha(trip.bytes)===trip.exported.sha256&&uploaded.begin.sha256===trip.exported.sha256,
   byteLengthEqual:trip.bytes.length===trip.exported.totalBytes,
   jsonEqualToBuiltBundle:canonicalJson(bundleJson)===canonicalJson(original),
   exportApiEqualsBuilt:canonicalJson(exportedByApi.archive)===canonicalJson(original),
   restoredEqualsBuilt:canonicalJson(restored.archive)===canonicalJson(original),
   archiveRevisionEqual:restored.archiveRevision===originalRevision&&commit.archiveRevision===originalRevision&&imported.archiveRevision===originalRevision,
   counts:{cases:commit.caseCount,views:commit.viewCount,measurements:commit.measurementCount}
  };
  verification.countsMatchConfig=commit.caseCount===config.cases&&commit.viewCount===config.views&&commit.measurementCount===measurementArchive.measurements.length;
  // Restored view fields: apply every restored named view and compare the live settings and setup.
  displayDst.value=prepareCaseView(destination.store.list()[0]);
  const listing=(await destination.namedViews.list()).views;let viewMismatches=0;
  for(let i=0;i<listing.length;i++){
   const v=listing[i];await destination.namedViews.apply({viewId:v.viewId,expectedRevision:v.revision,expectedResultRevision:resultRevision});
   if(canonicalJson(canonicalViewState(structuredClone(settingsDst.value)))!==canonicalJson(canonicalViewState(structuredClone(namedViewArchive.views[i].result)))||canonicalJson(destination.setup.value)!==canonicalJson(namedViewArchive.views[i].setup))viewMismatches++;
  }
  verification.restoredViewFields={appliedViews:listing.length,mismatches:viewMismatches};
  let measurementMismatches=0;for(const rec of measurementArchive.measurements){const got=await destination.measurements.get({measurementId:rec.id});if(!got.recordedEvidence||got.independentlyVerified!==false)measurementMismatches++;}
  verification.restoredMeasurementRecords={checked:measurementArchive.measurements.length,trustFlagMismatches:measurementMismatches};
  record.bytes={bundle:trip.bytes.length,caseArchive:Buffer.byteLength(JSON.stringify(caseArchive)),namedViewArchive:Buffer.byteLength(JSON.stringify(namedViewArchive)),measurementArchive:record.measurementLimit.archiveBytes};
  record.transfer={chunks:trip.chunks.length,uploadChunks:uploaded.writeChunks,maxChunkBytes:LIMITS.chunkBytes,sha256:trip.exported.sha256,readMs:round(trip.timings.readMs),beginExportMs:round(trip.timings.beginExportMs),writeMs:round(uploaded.writeMs)};
  record.verification=verification;
  const ok=verification.hashEqual&&verification.byteLengthEqual&&verification.jsonEqualToBuiltBundle&&verification.exportApiEqualsBuilt&&verification.restoredEqualsBuilt&&verification.archiveRevisionEqual&&verification.countsMatchConfig&&viewMismatches===0&&measurementMismatches===0&&Number(config.measurements===0||record.measurementLimit.achieved>0)===1;
  record.status=ok?'pass':'fail';if(!ok)record.error='Verification mismatch; see verification block';
  // Keep one verified bundle for refusal checks.
  record._refusalFixture={original,originalRevision,bytes:trip.bytes,displayedViews:variants.length};
 }catch(error){record.status='fail';record.error=String(error?.stack??error).split('\n').slice(0,4).join(' | ');}
 record.wallMs=round(now()-totalStart);record.memory=tracker.stop();record.processMaxRssBytesCumulative=process.resourceUsage().maxRSS*1024;
 return record;
}

// ---------------------------------------------------------------- over-limit refusals
async function refusals(fixture,kind){
 const checks=[],add=(name,expectedPattern,outcome,extra={})=>checks.push({name,expectedMessagePattern:String(expectedPattern),refused:!outcome.ok,actualMessage:outcome.ok?null:outcome.message,matchesDocumentedMessage:!outcome.ok&&expectedPattern.test(outcome.message),...extra});
 const {original,originalRevision,bytes}=fixture;
 // 9th case: direct store add and a 9-case archive import through the bundle.
 const store=createCaseStore();for(let i=0;i<LIMITS.maxCases;i++)store.add('fill '+(i+1),structuredClone(original.caseArchive.cases[0].output));
 const ninth=await reply(async()=>store.add('ninth',structuredClone(original.caseArchive.cases[0].output)));
 const beforeCases=JSON.stringify(store.export());
 add('ninth case added to a full store',/Maximum 8 cases/,ninth,{stateUnchanged:JSON.stringify(store.export())===beforeCases,kind});
 const nine=structuredClone(original);nine.caseArchive.cases=[...nine.caseArchive.cases];while(nine.caseArchive.cases.length<9)nine.caseArchive.cases.push({...structuredClone(nine.caseArchive.cases[0]),name:'extra '+nine.caseArchive.cases.length});
 const bundleHost=host();await load(bundleHost,original);const before=JSON.stringify(await bundleHost.api.exportArchive());
 add('9-case bundle import',/Invalid case archive/,await reply(()=>load(bundleHost,nine)),{stateUnchanged:JSON.stringify(await bundleHost.api.exportArchive())===before});
 const seventeen=structuredClone(original);seventeen.namedViewArchive.views=[...seventeen.namedViewArchive.views];while(seventeen.namedViewArchive.views.length<17){const i=seventeen.namedViewArchive.views.length;seventeen.namedViewArchive.views.push({...structuredClone(seventeen.namedViewArchive.views[0]),id:'extra-'+i,name:'extra '+i});}
 add('17-view bundle import',/Invalid named view archive/,await reply(()=>load(bundleHost,seventeen)),{stateUnchanged:JSON.stringify(await bundleHost.api.exportArchive())===before});
 const manyMeasurements=structuredClone(original);manyMeasurements.measurementArchive.measurements=[...manyMeasurements.measurementArchive.measurements];while(manyMeasurements.measurementArchive.measurements.length<101){const i=manyMeasurements.measurementArchive.measurements.length;manyMeasurements.measurementArchive.measurements.push({...structuredClone(manyMeasurements.measurementArchive.measurements[0]),id:'extra-'+i});}
 add('101-measurement bundle import',/Invalid measurement archive|exceeds 300000/,await reply(()=>load(bundleHost,manyMeasurements)),{stateUnchanged:JSON.stringify(await bundleHost.api.exportArchive())===before});
 // Transfer-layer refusals against a host that already holds the bundle.
 const dst=host(),empty=(await dst.api.list()).archiveRevision;
 const emptyBefore=JSON.stringify(await dst.api.exportArchive());
 const oversizedChunk=Buffer.alloc(LIMITS.chunkBytes+1,97).toString('base64');
 const begin=dst.transfer.beginImport({expectedArchiveRevision:empty,totalBytes:bytes.length,sha256:sha(bytes)});
 add('oversize chunk (65537 bytes) write',/Invalid archive base64 chunk/,await reply(async()=>dst.transfer.write({transferId:begin.transferId,offset:0,data:oversizedChunk})),{chunkBytes:LIMITS.chunkBytes+1});
 dst.transfer.release({transferId:begin.transferId});
 const exportHost=host();await load(exportHost,original);const exported=await exportHost.transfer.beginExport();
 add('oversize read range (65537 bytes)',/Invalid archive read range/,await reply(async()=>exportHost.transfer.read({transferId:exported.transferId,offset:0,length:LIMITS.chunkBytes+1})));
 add('import declared above 100 MB limit',/Invalid archive import metadata/,await reply(async()=>dst.transfer.beginImport({expectedArchiveRevision:empty,totalBytes:LIMITS.maxBundleBytes+1,sha256:sha(bytes)})),{declaredBytes:LIMITS.maxBundleBytes+1});
 // Tampered hash: wrong declared hash, and altered bytes with the original hash.
 const wrongHash=dst.transfer.beginImport({expectedArchiveRevision:empty,totalBytes:bytes.length,sha256:'sha256:'+'0'.repeat(64)});
 for(let o=0;o<bytes.length;o+=LIMITS.chunkBytes)dst.transfer.write({transferId:wrongHash.transferId,offset:o,data:bytes.subarray(o,o+LIMITS.chunkBytes).toString('base64')});
 add('declared hash differs from content',/Archive import hash mismatch/,await reply(()=>dst.transfer.commit({transferId:wrongHash.transferId})),{stateUnchanged:JSON.stringify(await dst.api.exportArchive())===emptyBefore});dst.transfer.release({transferId:wrongHash.transferId});
 const altered=Buffer.from(bytes),at=altered.indexOf(Buffer.from('case-view-bundle'));altered[at]=altered[at]^1;
 const tampered=dst.transfer.beginImport({expectedArchiveRevision:empty,totalBytes:altered.length,sha256:sha(bytes)});
 for(let o=0;o<altered.length;o+=LIMITS.chunkBytes)dst.transfer.write({transferId:tampered.transferId,offset:o,data:altered.subarray(o,o+LIMITS.chunkBytes).toString('base64')});
 add('content byte flipped after hashing',/Archive import hash mismatch/,await reply(()=>dst.transfer.commit({transferId:tampered.transferId})),{stateUnchanged:JSON.stringify(await dst.api.exportArchive())===emptyBefore});dst.transfer.release({transferId:tampered.transferId});
 // Internally consistent but altered content (hash re-computed) is rejected by bundle validation, not by the hash.
 const forged=JSON.parse(bytes.toString('utf8'));forged.namedViewArchive.views[0].resultRevision='sha256:'+'0'.repeat(64);const forgedBytes=Buffer.from(JSON.stringify(forged));
 const forgedBegin=dst.transfer.beginImport({expectedArchiveRevision:empty,totalBytes:forgedBytes.length,sha256:sha(forgedBytes)});
 for(let o=0;o<forgedBytes.length;o+=LIMITS.chunkBytes)dst.transfer.write({transferId:forgedBegin.transferId,offset:o,data:forgedBytes.subarray(o,o+LIMITS.chunkBytes).toString('base64')});
 add('rehashed bundle with orphan view revision',/matching saved result/,await reply(()=>dst.transfer.commit({transferId:forgedBegin.transferId})),{stateUnchanged:JSON.stringify(await dst.api.exportArchive())===emptyBefore});dst.transfer.release({transferId:forgedBegin.transferId});
 // Stale expected revision.
 const stale=dst.transfer.beginImport({expectedArchiveRevision:originalRevision,totalBytes:bytes.length,sha256:sha(bytes)});
 for(let o=0;o<bytes.length;o+=LIMITS.chunkBytes)dst.transfer.write({transferId:stale.transferId,offset:o,data:bytes.subarray(o,o+LIMITS.chunkBytes).toString('base64')});
 add('stale expected archive revision',/revision conflict/,await reply(()=>dst.transfer.commit({transferId:stale.transferId})),{stateUnchanged:JSON.stringify(await dst.api.exportArchive())===emptyBefore});dst.transfer.release({transferId:stale.transferId});
 return {checkedOnKind:kind,notExercised:['bundle larger than 100 MB (would require constructing >100 MB of cases; the size is bounded by 8 cases of at most 30000 tets each)'],checks,allRefused:checks.every(c=>c.refused&&c.matchesDocumentedMessage&&c.stateUnchanged!==false)};
}

// ---------------------------------------------------------------- entry points
export async function runCapacity({kinds=ALL_KINDS,cases=LIMITS.maxCases,views=LIMITS.maxViews,measurements=LIMITS.maxMeasurements,configuration='full'}={}){
 if(cases<1||cases>LIMITS.maxCases||views<1||views>LIMITS.maxViews||measurements<0||measurements>LIMITS.maxMeasurements)throw Error('Configuration exceeds documented limits; over-limit behaviour is tested separately');
 const started=now(),startedAt=new Date().toISOString(),results=[],config={cases,views,measurements};let fixture=null,fixtureKind=null;
 for(const kind of kinds){
  if(!KIND_BUILDERS[kind]){results.push({kind,status:'skipped',reason:'No headless builder is registered for this kind in scripts/measure-case-bundle-capacity.mjs'});continue;}
  const record=await measureKind(kind,config);
  if(record._refusalFixture&&!fixture&&record.status==='pass'){fixture=record._refusalFixture;fixtureKind=kind;}
  delete record._refusalFixture;results.push(record);
 }
 let refusalReport={checkedOnKind:null,checks:[],allRefused:false,error:'No kind passed; refusals not exercised'};
 if(fixture){try{refusalReport=await refusals(fixture,fixtureKind);}catch(error){refusalReport={checkedOnKind:fixtureKind,checks:[],allRefused:false,error:String(error?.stack??error).split('\n').slice(0,3).join(' | ')};}}
 const passed=results.filter(r=>r.status==='pass').length,failed=results.filter(r=>r.status==='fail').length,skipped=results.filter(r=>r.status==='skipped').length;
 const status=failed===0&&skipped===0&&passed===kinds.length&&refusalReport.allRefused?'pass':passed===0?'fail':'partial';
 return {schemaVersion:1,scope:SCOPE,configuration,generatedAt:startedAt,runtime:{node:process.version,platform:process.platform,arch:process.arch},limits:LIMITS,requested:{kinds,...config},note:SIZE_LIMIT_NOTE,summary:{status,kindsRequested:kinds.length,passed,failed,skipped,wallMs:round(now()-started)},kinds:results,refusals:refusalReport,notClaimed:['browser UI behaviour','real-Chrome rendering of any result kind','MCP/HTTP network transfer','published HTTPS','bundle exactly at 100 MB','distinct physical outputs per case (cases replicate one real output)']};
}
function arg(name,fallback){const found=process.argv.find(a=>a.startsWith('--'+name+'='));return found?found.slice(name.length+3):fallback;}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 const out=resolve(process.cwd(),arg('out','.qa/case-bundle-capacity.json')),kinds=arg('kinds',ALL_KINDS.join(',')).split(',').filter(Boolean);
 const report=await runCapacity({kinds,cases:Number(arg('cases',LIMITS.maxCases)),views:Number(arg('views',LIMITS.maxViews)),measurements:Number(arg('measurements',LIMITS.maxMeasurements)),configuration:arg('configuration','full')});
 await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({out,status:report.summary.status,passed:report.summary.passed,failed:report.summary.failed,skipped:report.summary.skipped,wallMs:report.summary.wallMs,refusalsAllRefused:report.refusals.allRefused}));
 process.exit(report.summary.status==='fail'?1:0);
}
