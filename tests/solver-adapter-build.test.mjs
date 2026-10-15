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
const fluidMesh={version:1,sourceModel:{kind:'fluidDomain',solid:{kind:'box',bounds:[0,0,0,10,10,10]},enclosure:[-10,-10,-10,30,30,30]},study:{kind:'fluidDomain'},meshes:[box([0,0,0,10,10,10])],conditions:[]};
function stlCube(){const g=new BoxGeometry(10,10,10).toNonIndexed();g.translate(5,5,5);const positions=Array.from(g.attributes.position.array);g.dispose();const mesh={kind:'stl',positions,faceIds:Array.from({length:positions.length/9},(_,i)=>i)},f=x=>mesh.faceIds.filter(t=>[0,3,6].every(k=>Math.abs(positions[t*9+k]-x)<1e-8));return {version:1,name:'stl',sourceModel:{kind:'stl',positions:[...positions]},meshes:[mesh],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:f(0)}]},{type:'force',value:100,direction:[1,0,0],regions:[{mesh:0,triangles:f(10)}]}],materialProperties:{youngModulus:1e9,poissonRatio:0},study:{kind:'structural',gravityEnabled:false}};}
const stl=stlCube();
// Timing-valued fields are stripped; everything else (messages, stages, events, result payload) is digested.
const timing=new Set(['solveMs','setupMs','totalMs','cpuCorrectionMs','gpuPhaseMs','elapsedMs','elapsedSeconds']);
const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!timing.has(k)).map(([k,x])=>[k,strip(x)])):typeof v==='number'&&!Number.isFinite(v)?String(v):v;
const digest=messages=>createHash('sha256').update(JSON.stringify(strip(messages))).digest('hex').slice(0,16);
const summarize=messages=>{const t=messages.findLast(x=>x.result||x.error);return {count:messages.length,progress:messages.filter(x=>x.progress).map(x=>x.progress).join('|'),stages:messages.filter(x=>x.event).map(x=>x.event.stage).join(','),error:t.error??null,failureStage:t.failure?.stage??null,failureCode:t.failure?.code??null,nodes:t.result?.mesh?.nodes?.length??null,tets:t.result?.mesh?.tetrahedra?.length??null,rounds:t.result?.adaptive?.history?.length??null,stop:t.result?.adaptive?.stopReason??null,sha:digest(messages)};};
const cases={
 structuralAdaptive:[structural,{adaptive:true,maxRounds:2}],
 structuralAdaptiveLimits:[structural,{adaptive:true,maxRounds:3,tolerance:.02,stressTolerance:.1,maxAdaptiveElements:5000}],
 structuralAdaptiveBadLimits:[structural,{adaptive:true,maxRounds:9}],
 structuralPlain:[structural,{}],
 thermalPlain:[thermal,{}],
 thermalAdaptive:[thermal,{adaptive:true}],
 acousticAdaptive:[acoustic,{adaptive:true}],
 channelAdaptive:[channel,{adaptive:true}],
 creepingAdaptive:[creeping,{adaptive:true}],
 meshOnlyBox:[structural,{size:6},'mesh'],
 meshOnlyAdaptiveIgnored:[structural,{size:6,adaptive:true},'mesh'],
 meshOnlyThermal:[thermal,{size:6},'mesh'],
 stlSolve:[stl,{}],
 stlAdaptive:[stl,{adaptive:true}],
 stlMeshOnly:[stl,{size:6},'mesh'],
 fluidDomainMeshOnly:[fluidMesh,{size:6},'mesh'],
 fluidDomainSolve:[fluidMesh,{size:6}],
 channelFlow:[channel,{size:3}],
 creepingMeshOnly:[creeping,{size:6},'mesh'],
 creepingMeshOnlyHugeCap:[creeping,{size:6,maxElements:99999},'mesh'],
 creepingMeshOnlyFineHugeCap:[creeping,{size:3,maxElements:99999},'mesh'],
 creepingMeshOnlySmallCap:[creeping,{size:6,maxElements:500},'mesh'],
 creepingSolve:[creeping,{size:6}],
};
// Baselines were recorded by running the pre-move worker (build/adaptive loop still inline in analysis.worker.js).
const baselines={
 "structuralAdaptive": {
 "count": 26,
 "progress": "Generating volume mesh…|Adaptive round 1/2: meshing|Adaptive round 1/2: solving|Transferring boundary regions…|Solving linear elasticity…|Adaptive round 2/2: meshing|Adaptive round 2/2: solving|Transferring boundary regions…|Solving linear elasticity…",
 "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration,mesh,iteration,iteration,iteration,iteration,iteration,iteration,iteration",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 591,
 "tets": 515,
 "rounds": 2,
 "stop": "maximum refinement rounds reached",
 "sha": "fad8deaf0709ee5a"
 },
 "structuralAdaptiveLimits": {
 "count": 39,
 "progress": "Generating volume mesh…|Adaptive round 1/3: meshing|Adaptive round 1/3: solving|Transferring boundary regions…|Solving linear elasticity…|Adaptive round 2/3: meshing|Adaptive round 2/3: solving|Transferring boundary regions…|Solving linear elasticity…|Adaptive round 3/3: meshing|Adaptive round 3/3: solving|Transferring boundary regions…|Solving linear elasticity…",
 "stages": "preparation,mesh,iteration,iteration,iteration,iteration,iteration,iteration,mesh,iteration,iteration,iteration,iteration,iteration,iteration,iteration,mesh,iteration,iteration,iteration,iteration,iteration,iteration,iteration,iteration",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 864,
 "tets": 823,
 "rounds": 3,
 "stop": "displacement, peak stress and stress variation thresholds met",
 "sha": "0b99ad97da293d9a"
 },
 "structuralAdaptiveBadLimits": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,diagnostic",
 "error": "Invalid adaptive limits",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "0d57d16690c21632"
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
 "thermalPlain": {
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
 "thermalAdaptive": {
 "count": 3,
 "progress": "",
 "stages": "preparation,diagnostic",
 "error": "Adaptive refinement currently supports structural analysis only",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "702182150fd66c98"
 },
 "acousticAdaptive": {
 "count": 3,
 "progress": "",
 "stages": "preparation,diagnostic",
 "error": "Adaptive refinement currently supports structural analysis only",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "702182150fd66c98"
 },
 "channelAdaptive": {
 "count": 3,
 "progress": "",
 "stages": "preparation,diagnostic",
 "error": "Adaptive refinement currently supports structural analysis only",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "702182150fd66c98"
 },
 "creepingAdaptive": {
 "count": 3,
 "progress": "",
 "stages": "preparation,diagnostic",
 "error": "Adaptive refinement currently supports structural analysis only",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "702182150fd66c98"
 },
 "meshOnlyBox": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 243,
 "tets": 184,
 "rounds": null,
 "stop": null,
 "sha": "91ed4a0a4cc13adb"
 },
 "meshOnlyAdaptiveIgnored": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 243,
 "tets": 184,
 "rounds": null,
 "stop": null,
 "sha": "91ed4a0a4cc13adb"
 },
 "meshOnlyThermal": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 243,
 "tets": 184,
 "rounds": null,
 "stop": null,
 "sha": "91ed4a0a4cc13adb"
 },
 "stlSolve": {
 "count": 10,
 "progress": "Generating volume mesh…|Transferring boundary regions…|Solving linear elasticity…",
 "stages": "preparation,mesh,iteration,iteration,iteration,iteration",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 243,
 "tets": 184,
 "rounds": null,
 "stop": null,
 "sha": "39532be798795374"
 },
 "stlAdaptive": {
 "count": 2,
 "progress": "",
 "stages": "diagnostic",
 "error": "STL volume meshing does not support adaptive refinement",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "b1dcb6530775587c"
 },
 "stlMeshOnly": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 243,
 "tets": 184,
 "rounds": null,
 "stop": null,
 "sha": "c21c525fc5d15825"
 },
 "fluidDomainMeshOnly": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 864,
 "tets": 949,
 "rounds": null,
 "stop": null,
 "sha": "e0aba7127e783276"
 },
 "fluidDomainSolve": {
 "count": 2,
 "progress": "",
 "stages": "diagnostic",
 "error": "Exterior fluid domains support meshing only outside acoustic analysis; general 3D flow solving remains unsupported",
 "failureStage": "preparation",
 "failureCode": "ANALYSIS_PREPARATION_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "b732686c85eabffa"
 },
 "channelFlow": {
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
 "creepingMeshOnly": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 4026,
 "tets": 6481,
 "rounds": null,
 "stop": null,
 "sha": "6de13e5c5f563398"
 },
 "creepingMeshOnlyHugeCap": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,mesh",
 "error": null,
 "failureStage": null,
 "failureCode": null,
 "nodes": 4026,
 "tets": 6481,
 "rounds": null,
 "stop": null,
 "sha": "6de13e5c5f563398"
 },
 "creepingMeshOnlyFineHugeCap": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,diagnostic",
 "error": "Element limit exceeded; increase mesh size",
 "failureStage": "mesh",
 "failureCode": "ANALYSIS_MESH_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "d4281bda3c8df38c"
 },
 "creepingMeshOnlySmallCap": {
 "count": 4,
 "progress": "Generating volume mesh…",
 "stages": "preparation,diagnostic",
 "error": "Element limit exceeded; increase mesh size",
 "failureStage": "mesh",
 "failureCode": "ANALYSIS_MESH_FAILED",
 "nodes": null,
 "tets": null,
 "rounds": null,
 "stop": null,
 "sha": "d4281bda3c8df38c"
 },
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
 }
 };
test('mesh build and adaptive loop keep messages, stages, codes and payloads',{timeout:900000},async()=>{
 const captured={};
 for(const [name,[project,options,operation]] of Object.entries(cases)){
  captured[name]=summarize(await run(project,options,operation));
  if(baselines)assert.deepEqual(captured[name],baselines[name],name);
 }
 if(!baselines)console.log('BASELINES='+JSON.stringify(captured));
 else assert.deepEqual(Object.keys(baselines),Object.keys(cases));
});
test('only discipline-specific adapters expose the optional buildOptions/adaptive hooks',async()=>{
 const {getSolverAdapter,solverAdapterKinds}=await import('../src/solver-adapters/index.js');
 for(const k of solverAdapterKinds){const a=getSolverAdapter(k);assert.equal(typeof a.buildOptions,k==='creepingFlow'?'function':'undefined',k+' buildOptions');assert.equal(typeof a.adaptive,k==='structural'?'function':'undefined',k+' adaptive');}
});
