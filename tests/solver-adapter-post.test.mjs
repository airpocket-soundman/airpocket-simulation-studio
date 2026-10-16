import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {BoxGeometry} from 'three';
let sequence=0;
async function run(project,options={},operation='elastic'){const previousSelf=globalThis.self,previousFetch=globalThis.fetch,messages=[],base=new URL('./fixtures/worker/',import.meta.url).href;globalThis.self={postMessage:data=>messages.push(data)};globalThis.fetch=async url=>{if(url===base+'fem-kernel.wasm'){const bytes=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}throw Error('Unexpected worker fetch '+url);};try{await import(new URL('../src/analysis.worker.js',import.meta.url).href+'?build='+sequence++);await globalThis.self.onmessage({data:{operation,project:structuredClone(project),source:project.sourceModel,options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options},observe:true,base}});return messages;}finally{if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;globalThis.fetch=previousFetch;}}
function box(bounds){const g=new BoxGeometry(...bounds.slice(3)).toNonIndexed();g.translate(...bounds.slice(0,3).map((v,k)=>v+bounds[k+3]/2));const positions=Array.from(g.attributes.position.array);g.dispose();return {positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))};}
const face=(mesh,z)=>mesh.positions.flatMap((_,i)=>i%9===0&&[2,5,8].every(k=>Math.abs(mesh.positions[i+k]-z)<1e-7)?[i/9]:[]),region=(mesh,triangles)=>({mesh,triangles});
const m=box([0,0,0,10,10,40]),src={kind:'box',bounds:[0,0,0,10,10,40]};
const structural={version:1,sourceModel:src,study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0},meshes:[m],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'force',value:100,direction:[0,0,1],regions:[region(0,face(m,40))]}]};
const thermal={version:1,sourceModel:src,study:{kind:'thermal'},materialProperties:{conductivity:2},meshes:[m],conditions:[{type:'temperature',value:100,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'temperature',value:20,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const acoustic={version:1,sourceModel:src,study:{kind:'acoustic',frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0},meshes:[m],conditions:[{type:'acousticPressure',value:1,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'acousticPressure',value:0,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const channel={version:1,sourceModel:{kind:'cylinder'},study:{kind:'channelFlow',flowAxis:1,pressureDropPa:.01,dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500},meshes:[box([0,0,0,10,10,40])],conditions:[]};
const creeping={version:1,sourceModel:{kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:5},enclosure:[-20,-20,-20,40,40,40]},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],meshSettings:{refinements:[{center:[0,0,0],radius:30,size:.9}]},study:{kind:'creepingFlow',dynamicViscosity:1,fluidDensity:1000,freeStreamVelocity:[.001,0,0],referenceLengthMm:10}};
// Timing-valued fields are stripped; everything else (messages, stages, events, result payload) is digested.
const timing=new Set(['solveMs','setupMs','totalMs','cpuCorrectionMs','gpuPhaseMs','elapsedMs','elapsedSeconds']);
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!timing.has(k)).map(([k,x])=>[k,strip(x)])):typeof v==='number'&&!Number.isFinite(v)?String(v):v;
const digest=messages=>createHash('sha256').update(JSON.stringify(strip(messages))).digest('hex').slice(0,16);
const summarize=messages=>{const t=messages.findLast(x=>x.result||x.error);return {count:messages.length,progress:messages.filter(x=>x.progress).map(x=>x.progress).join('|'),stages:messages.filter(x=>x.event).map(x=>x.event.stage).join(','),error:t.error??null,failureStage:t.failure?.stage??null,failureCode:t.failure?.code??null,nodes:t.result?.mesh?.nodes?.length??null,tets:t.result?.mesh?.tetrahedra?.length??null,rounds:t.result?.adaptive?.history?.length??null,stop:t.result?.adaptive?.stopReason??null,sha:digest(messages)};};
const fractureAssessment={flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack; a is half crack length',stressAssumption:'Uncracked nominal stress is uniform across the assumed flaw'};
const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic analytical reference only',testConditions:'Uniform tensile stress; infinite centre crack, Y=1',surfaceCondition:'Synthetic crack; residual stress is specified separately'};
const fatigueData={model:'stress-life',stressRatio:-1,snCurve:[{stressAmplitudePa:1e7,cycles:1e4},{stressAmplitudePa:1e6,cycles:1e6},{stressAmplitudePa:1e5,cycles:1e8}],ultimateStrengthPa:4e8,yieldStressPa:2.5e8,source:'Synthetic reference only',testConditions:'Synthetic fully reversed axial reference; not a real material'};
const fatigueAssessment={minLoadFactor:-1,maxLoadFactor:1,meanStressCorrection:'none',appliedCycles:1e5};
const withMaterial=(p,materialProperties,study)=>({...p,materialProperties,...(study?{study}:{})});
const transient={kind:'thermal',transient:true,initialTemperature:20,timeStep:.5,steps:2},tm=(min,max)=>({conductivity:2,density:1000,specificHeat:500,temperatureMin:min,temperatureMax:max});
const cases={
 creepingSolve:[creeping,{size:6}],
 creepingSolveFatigueGuard:[creeping,{size:6,fatigueAssessment}],
 channelSolve:[channel,{size:3}],
 channelSolveFractureGuard:[channel,{size:3,fractureAssessment}],
 thermalInRange:[withMaterial(thermal,{conductivity:2,temperatureMin:0,temperatureMax:150}),{}],
 thermalAboveRange:[withMaterial(thermal,{conductivity:2,temperatureMin:0,temperatureMax:50}),{}],
 thermalBelowRange:[withMaterial(thermal,{conductivity:2,temperatureMin:30,temperatureMax:150}),{}],
 thermalNoRange:[thermal,{}],
 thermalFractureGuard:[withMaterial(thermal,{conductivity:2,temperatureMin:0,temperatureMax:50}),{fractureAssessment}],
 thermalTransientInRange:[withMaterial({...thermal,study:transient},tm(0,150)),{}],
 thermalTransientBelowRange:[withMaterial({...thermal,study:transient},tm(30,150)),{}],
 thermalTransientInitialAbove:[withMaterial({...thermal,study:{...transient,initialTemperature:160}},tm(0,150)),{}],
 structuralPlain:[structural,{}],
 structuralFracture:[withMaterial(structural,{youngModulus:1e9,poissonRatio:0,fractureData}),{fractureAssessment}],
 structuralFractureMissingData:[structural,{fractureAssessment:{}}],
 structuralFatigue:[withMaterial(structural,{youngModulus:1e9,poissonRatio:0,fatigueData}),{fatigueAssessment}],
 structuralFractureThenFatigue:[withMaterial(structural,{youngModulus:1e9,poissonRatio:0,fractureData,fatigueData}),{fractureAssessment,fatigueAssessment}],
 structuralThermalStressFractureGuard:[{...structural,study:{kind:'structural',thermalStress:true}},{fractureAssessment}],
 acousticSolve:[acoustic,{}],
 acousticFatigueGuard:[acoustic,{fatigueAssessment}],
};
// Baselines were recorded by running the pre-move worker (boundary-transfer skip and postprocess checks still inline in analysis.worker.js).
const baselines={
 "creepingSolve": {
  "count": 17,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving three-dimensional creeping Stokes flow…|Stokes GMRES 56 iterations",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 4026,
  "tets": 6481,
  "rounds": null,
  "stop": null,
  "sha": "9afc0904c101bc03"
 },
 "creepingSolveFatigueGuard": {
  "count": 18,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving three-dimensional creeping Stokes flow…|Stokes GMRES 56 iterations",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration,diagnostic",
  "error": "Fatigue assessment requires uniaxial elastic structure without thermal stress",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "01f10bae60608e01"
 },
 "channelSolve": {
  "count": 9,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving fully developed channel flow…",
  "stages": "preparation,mesh,iteration,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 3780,
  "tets": 5211,
  "rounds": null,
  "stop": null,
  "sha": "b33521b1a46966d4"
 },
 "channelSolveFractureGuard": {
  "count": 10,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving fully developed channel flow…",
  "stages": "preparation,mesh,iteration,iteration,iteration,diagnostic",
  "error": "Fracture assessment requires linear structural analysis",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "1fc6b5d844e248db"
 },
 "thermalInRange": {
  "count": 7,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "e7c174fd77907b59"
 },
 "thermalAboveRange": {
  "count": 8,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step,diagnostic",
  "error": "Temperature is outside the registered material validity range",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "1434e8da686110d8"
 },
 "thermalBelowRange": {
  "count": 8,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step,diagnostic",
  "error": "Temperature is outside the registered material validity range",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "1434e8da686110d8"
 },
 "thermalNoRange": {
  "count": 7,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "e7c174fd77907b59"
 },
 "thermalFractureGuard": {
  "count": 8,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step,diagnostic",
  "error": "Fracture assessment requires linear structural analysis",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "8d8de214030b5bed"
 },
 "thermalTransientInRange": {
  "count": 8,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step,time-step",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "bce3ba14e70ab73d"
 },
 "thermalTransientBelowRange": {
  "count": 9,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step,time-step,diagnostic",
  "error": "Temperature is outside the registered material validity range",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "3406978adf5c9661"
 },
 "thermalTransientInitialAbove": {
  "count": 9,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving heat conduction…",
  "stages": "preparation,mesh,time-step,time-step,diagnostic",
  "error": "Temperature is outside the registered material validity range",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "49bb7c0f5d0b35a1"
 },
 "structuralPlain": {
  "count": 12,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "4ddecfe8fc2bc8f4"
 },
 "structuralFracture": {
  "count": 12,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "a3b0867ed5dc021b"
 },
 "structuralFractureMissingData": {
  "count": 13,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration,diagnostic",
  "error": "Fracture assessment requires registered toughness and surface data",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "26cd451545a6ee7c"
 },
 "structuralFatigue": {
  "count": 12,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "739c569993af5cde"
 },
 "structuralFractureThenFatigue": {
  "count": 12,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "cf2d7f7aaacd9140"
 },
 "structuralThermalStressFractureGuard": {
  "count": 13,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
  "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration,diagnostic",
  "error": "Fracture assessment requires linear structural analysis",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "d1ddc9587c6b430e"
 },
 "acousticSolve": {
  "count": 8,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving frequency-domain acoustics…",
  "stages": "preparation,mesh,iteration,iteration",
  "error": null,
  "failureStage": null,
  "failureCode": null,
  "nodes": 282,
  "tets": 218,
  "rounds": null,
  "stop": null,
  "sha": "f682628fe9b9b222"
 },
 "acousticFatigueGuard": {
  "count": 9,
  "progress": "Generating volume mesh…|Transferring boundary regions…|Solving frequency-domain acoustics…",
  "stages": "preparation,mesh,iteration,iteration,diagnostic",
  "error": "Fatigue assessment requires uniaxial elastic structure without thermal stress",
  "failureStage": "postprocess",
  "failureCode": "ANALYSIS_POSTPROCESS_FAILED",
  "nodes": null,
  "tets": null,
  "rounds": null,
  "stop": null,
  "sha": "3ccefd91e7ad9973"
 }
};
test('post-processing (boundary transfer skip, assessments, temperature range) keeps messages, stages, codes and payloads',{timeout:900000},async()=>{
 const captured={};
 for(const [name,[project,options,operation]] of Object.entries(cases)){
  captured[name]=summarize(await run(project,options,operation));
  if(baselines)assert.deepEqual(captured[name],baselines[name],name);
 }
 if(!baselines)console.log('BASELINES='+JSON.stringify(captured));
 else assert.deepEqual(Object.keys(baselines),Object.keys(cases));
});
test('only discipline-specific adapters expose skipsBoundaryTransfer/postprocess',async()=>{
 const {getSolverAdapter,solverAdapterKinds}=await import('../src/solver-adapters/index.js');
 for(const k of solverAdapterKinds){const a=getSolverAdapter(k);assert.equal(a.skipsBoundaryTransfer,['creepingFlow','channelFlow'].includes(k)?true:undefined,k+' skipsBoundaryTransfer');assert.equal(typeof a.postprocess,['thermal','structural'].includes(k)?'function':'undefined',k+' postprocess');}
});
