import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {BoxGeometry} from 'three';
let sequence=0;
function box(bounds){const g=new BoxGeometry(...bounds.slice(3)).toNonIndexed();g.translate(...bounds.slice(0,3).map((v,k)=>v+bounds[k+3]/2));const positions=Array.from(g.attributes.position.array);g.dispose();return {positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))};}
const face=(mesh,z)=>mesh.positions.flatMap((_,i)=>i%9===0&&[2,5,8].every(k=>Math.abs(mesh.positions[i+k]-z)<1e-7)?[i/9]:[]),region=(mesh,triangles)=>({mesh,triangles});
async function run(project,options={},operation='elastic'){const previousSelf=globalThis.self,previousFetch=globalThis.fetch,messages=[],base=new URL('./fixtures/worker/',import.meta.url).href;globalThis.self={postMessage:data=>messages.push(data)};globalThis.fetch=async url=>{if(url===base+'fem-kernel.wasm'){const bytes=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}throw Error('Unexpected worker fetch '+url);};try{await import(new URL('../src/analysis.worker.js',import.meta.url).href+'?registry='+sequence++);await globalThis.self.onmessage({data:{operation,project:structuredClone(project),source:project.sourceModel,options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options},base}});return messages.findLast(m=>m.result||m.error);}finally{if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;globalThis.fetch=previousFetch;}}
const m=box([0,0,0,10,10,40]),src={kind:'box',bounds:[0,0,0,10,10,40]};
const structural={version:1,sourceModel:src,study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0},meshes:[m],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'force',value:100,direction:[0,0,1],regions:[region(0,face(m,40))]}]};
const thermal={version:1,sourceModel:src,study:{kind:'thermal'},materialProperties:{conductivity:2},meshes:[m],conditions:[{type:'temperature',value:100,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'temperature',value:20,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const acoustic={version:1,sourceModel:src,study:{kind:'acoustic',frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0},meshes:[m],conditions:[{type:'acousticPressure',value:1,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'acousticPressure',value:0,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const channel={version:1,sourceModel:{kind:'cylinder'},study:{kind:'channelFlow',flowAxis:1,pressureDropPa:.01,dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500},meshes:[box([0,0,0,10,10,40])],conditions:[]};
const creeping={version:1,sourceModel:{kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:5},enclosure:[-20,-20,-20,40,40,40]},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],meshSettings:{refinements:[{center:[0,0,0],radius:30,size:.9}]},study:{kind:'creepingFlow',dynamicViscosity:1,fluidDensity:1000,freeStreamVelocity:[.001,0,0],referenceLengthMm:10}};
const ortho={...structural.materialProperties,orthotropic:{}},plastic={...structural.materialProperties,plasticity:{yieldStress:1e6}},hyper={...structural.materialProperties,hyperelastic:{model:'neo-hookean-log',shearModulus:5e5,bulkModulus:2e6,testCurve:[[.8,-2e5],[1,0],[1.2,2e5]]}};
const cases={
 creepingMfem:[creeping,{method:'mfem-wasm'}],
 creepingBadElement:[{...creeping,study:{...creeping.study,stokesVelocityElement:'P3'}}],
 creepingBadViscosity:[{...creeping,study:{...creeping.study,dynamicViscosity:0}}],
 creepingReynolds:[{...creeping,study:{...creeping.study,referenceLengthMm:1e6}}],
 orthoThermal:[{...thermal,materialProperties:{conductivity:2,orthotropic:{}}}],
 orthoModal:[{...structural,study:{kind:'structural',modalAnalysis:{}},materialProperties:ortho}],
 orthoMfem:[{...structural,materialProperties:ortho},{method:'mfem-wasm'}],
 orthoAndAdaptiveThermal:[{...thermal,materialProperties:{conductivity:2,orthotropic:{}}},{adaptive:true}],
 plasticFractionNoPlasticity:[{...structural,study:{kind:'structural',plasticLoadFractions:[.5,1]}}],
 plasticFractionThermal:[{...thermal,study:{kind:'thermal',plasticLoadFractions:[.5,1]}}],
 plasticAdaptive:[{...structural,materialProperties:plastic},{adaptive:true}],
 plasticMfem:[{...structural,materialProperties:plastic},{method:'mfem-wasm'}],
 plasticThermalStress:[{...structural,study:{kind:'structural',thermalStress:true},materialProperties:plastic}],
 modalThermalStress:[{...structural,study:{kind:'structural',modalAnalysis:{},thermalStress:true}}],
 modalGravity:[{...structural,study:{kind:'structural',modalAnalysis:{},gravityEnabled:true,gravity:[0,0,-9810]}}],
 modalOnThermal:[{...thermal,study:{kind:'thermal',modalAnalysis:{}}}],
 modalWebgpu:[{...structural,study:{kind:'structural',modalAnalysis:{}}},{method:'webgpu-pcg'}],
 sphericalOnBox:[{...acoustic,study:{...acoustic.study,exteriorRadiation:true}}],
 acousticWrongConditions:[{...acoustic,conditions:structural.conditions}],
 acousticAdaptive:[acoustic,{adaptive:true}],
 acousticMfem:[acoustic,{method:'webgpu-pcg'}],
 acousticConditionsBeforeAdaptive:[{...acoustic,conditions:structural.conditions},{adaptive:true}],
 thermalConditionsBeforeAdaptive:[{...thermal,conditions:structural.conditions},{adaptive:true}],
 thermalAdaptiveBeforeMfem:[thermal,{adaptive:true,method:'mfem-wasm'}],
 thermalWebgpu:[thermal,{method:'webgpu-pcg'}],
 channelConditions:[{...channel,conditions:structural.conditions}],
 channelAdaptive:[channel,{adaptive:true}],
 channelMfem:[channel,{method:'mfem-wasm'}],
 hyperPressure:[{...structural,materialProperties:hyper,conditions:[structural.conditions[0],{type:'pressure',value:1,direction:[0,0,1],regions:structural.conditions[1].regions}]}],
 hyperAdaptive:[{...structural,materialProperties:hyper},{adaptive:true}],
 hyperMfem:[{...structural,materialProperties:hyper},{method:'mfem-wasm'}],
 hyperThermalStress:[{...structural,study:{kind:'structural',thermalStress:true},materialProperties:hyper}],
 structuralThermalCondition:[{...structural,conditions:thermal.conditions}],
 structuralBadMaterial:[{...structural,materialProperties:{youngModulus:-1,poissonRatio:0}}],
 thermalBadMaterial:[{...thermal,materialProperties:{conductivity:-1}}],
 unknownKindThermalCondition:[{...structural,study:{kind:'mystery'},conditions:thermal.conditions}],
 unknownKindModal:[{...structural,study:{kind:'mystery',modalAnalysis:{}}}],
 unknownKindAdaptiveFallback:[{...structural,study:{kind:'mystery'}},{adaptive:true,maxRounds:1}],
 noStudyOrtho:[{...structural,study:undefined,materialProperties:ortho}],
};
// Baselines: [message, failure.stage, failure.code] recorded by running the pre-hook worker (HEAD 86311ef) on these cases; 'OK' = solves without error.
// Every rejection precedes meshing, so stage is always 'preparation'. The *Before* cases pin which message wins when several rules could fire.
const baselines={
 creepingMfem:["Stokes supports Airpocket CPU solvers only","preparation","ANALYSIS_PREPARATION_FAILED"],
 creepingBadElement:["Stokes velocity element must be P1 or P2","preparation","ANALYSIS_PREPARATION_FAILED"],
 creepingBadViscosity:["Stokes study requires positive viscosity and density and a finite nonzero free-stream velocity","preparation","ANALYSIS_PREPARATION_FAILED"],
 creepingReynolds:["Stokes prototype requires Reynolds number <= 0.1","preparation","ANALYSIS_PREPARATION_FAILED"],
 orthoThermal:["Orthotropic elasticity requires static linear CPU structure without thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 orthoModal:["Orthotropic elasticity requires static linear CPU structure without thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 orthoMfem:["Orthotropic elasticity requires static linear CPU structure without thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 orthoAndAdaptiveThermal:["Orthotropic elasticity requires static linear CPU structure without thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 plasticFractionNoPlasticity:["Plastic load fractions require a structural plasticity model","preparation","ANALYSIS_PREPARATION_FAILED"],
 plasticFractionThermal:["Plastic load fractions require a structural plasticity model","preparation","ANALYSIS_PREPARATION_FAILED"],
 plasticAdaptive:["Plasticity supports CPU structure without adaptation, modal analysis or thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 plasticMfem:["Plasticity supports CPU structure without adaptation, modal analysis or thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 plasticThermalStress:["Plasticity supports CPU structure without adaptation, modal analysis or thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],
 modalThermalStress:["Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation","preparation","ANALYSIS_PREPARATION_FAILED"],
 modalGravity:["Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation","preparation","ANALYSIS_PREPARATION_FAILED"],
 modalOnThermal:["Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation","preparation","ANALYSIS_PREPARATION_FAILED"],
 modalWebgpu:["Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation","preparation","ANALYSIS_PREPARATION_FAILED"],
 sphericalOnBox:["Spherical radiation requires a spherical exterior acoustic domain","preparation","ANALYSIS_PREPARATION_FAILED"],
 acousticWrongConditions:["Remove boundary conditions belonging to the other discipline or use the matching example","preparation","ANALYSIS_PREPARATION_FAILED"],
 acousticAdaptive:["Adaptive refinement currently supports structural analysis only","preparation","ANALYSIS_PREPARATION_FAILED"],
 acousticMfem:["WebGPU and MFEM currently support structural analysis only","preparation","ANALYSIS_PREPARATION_FAILED"],
 acousticConditionsBeforeAdaptive:["Remove boundary conditions belonging to the other discipline or use the matching example","preparation","ANALYSIS_PREPARATION_FAILED"],
 thermalConditionsBeforeAdaptive:["Remove boundary conditions belonging to the other discipline or use the matching example","preparation","ANALYSIS_PREPARATION_FAILED"],
 thermalAdaptiveBeforeMfem:["Adaptive refinement currently supports structural analysis only","preparation","ANALYSIS_PREPARATION_FAILED"],
 thermalWebgpu:["WebGPU and MFEM currently support structural analysis only","preparation","ANALYSIS_PREPARATION_FAILED"],
 channelConditions:["Remove boundary conditions belonging to the other discipline or use the matching example","preparation","ANALYSIS_PREPARATION_FAILED"],
 channelAdaptive:["Adaptive refinement currently supports structural analysis only","preparation","ANALYSIS_PREPARATION_FAILED"],
 channelMfem:["WebGPU and MFEM currently support structural analysis only","preparation","ANALYSIS_PREPARATION_FAILED"],
 hyperPressure:["Hyperelastic prototype supports CPU, dead forces, gravity and prescribed displacement; adaptive, follower pressure and thermal stress are unsupported","preparation","ANALYSIS_PREPARATION_FAILED"],
 hyperAdaptive:["Hyperelastic prototype supports CPU, dead forces, gravity and prescribed displacement; adaptive, follower pressure and thermal stress are unsupported","preparation","ANALYSIS_PREPARATION_FAILED"],
 hyperMfem:["Hyperelastic prototype supports CPU, dead forces, gravity and prescribed displacement; adaptive, follower pressure and thermal stress are unsupported","preparation","ANALYSIS_PREPARATION_FAILED"],
 hyperThermalStress:["Hyperelastic prototype supports CPU, dead forces, gravity and prescribed displacement; adaptive, follower pressure and thermal stress are unsupported","preparation","ANALYSIS_PREPARATION_FAILED"],
 structuralThermalCondition:["Remove boundary conditions belonging to the other discipline or use the matching example","preparation","ANALYSIS_PREPARATION_FAILED"],
 structuralBadMaterial:["ヤング率が有効範囲外です。","preparation","ANALYSIS_PREPARATION_FAILED"],
 thermalBadMaterial:["熱伝導率が有効範囲外です。","preparation","ANALYSIS_PREPARATION_FAILED"],
 unknownKindThermalCondition:["Remove boundary conditions belonging to the other discipline or use the matching example","preparation","ANALYSIS_PREPARATION_FAILED"],
 unknownKindModal:["Modal prototype requires linear CPU structure, homogeneous supports and no gravity, thermal stress or adaptation","preparation","ANALYSIS_PREPARATION_FAILED"],
 unknownKindAdaptiveFallback:"OK",
 noStudyOrtho:["Orthotropic elasticity requires static linear CPU structure without thermal stress","preparation","ANALYSIS_PREPARATION_FAILED"],};
test('pre-dispatch validation keeps exact messages, failure stage/code and ordering',async()=>{
 assert.deepEqual(Object.keys(baselines),Object.keys(cases));
 for(const [name,[project,options]] of Object.entries(cases)){
  const r=await run(project,options||{}),expected=baselines[name];
  if(expected==='OK'){assert.equal(r.error,undefined,name);continue;}
  assert.deepEqual([r.error,r.failure?.stage,r.failure?.code],expected,name);
 }
});
test('every adapter exposes the optional validate hook and the unknown-kind fallback uses the structural one',async()=>{
 const {solverAdapterKinds,getSolverAdapter,resolveSolverAdapter}=await import('../src/solver-adapters/index.js');
 for(const kind of solverAdapterKinds)assert.equal(typeof getSolverAdapter(kind).validate,'function',kind);
 assert.equal(resolveSolverAdapter({kind:'mystery'}).validate,getSolverAdapter('structural').validate);
 // phases that a discipline does not use are no-ops
 assert.doesNotThrow(()=>getSolverAdapter('thermal').validate({phase:'pre-load',data:{project:thermal,options:{}}}));
});
