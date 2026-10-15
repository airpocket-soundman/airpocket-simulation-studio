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
import {diagnoseExecution} from '../src/capabilities.js';
const hyperPressureConditions=[structural.conditions[0],{type:'pressure',value:1,direction:[0,0,1],regions:structural.conditions[1].regions}];
const modal={kind:'structural',modalAnalysis:{}};
// [name, project, options, expected stable diagnostic code | null when the combination is allowed]
const table=[
 ['orthotropic on thermal',{...thermal,materialProperties:{conductivity:2,orthotropic:{}}},{},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['orthotropic modal',{...structural,study:modal,materialProperties:ortho},{},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['orthotropic mfem',{...structural,materialProperties:ortho},{method:'mfem-wasm'},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['plasticity adaptive',{...structural,materialProperties:plastic},{adaptive:true},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['plasticity mfem',{...structural,materialProperties:plastic},{method:'mfem-wasm'},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['plasticity webgpu',{...structural,materialProperties:plastic},{method:'webgpu-pcg'},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['plasticity thermalStress',{...structural,study:{kind:'structural',thermalStress:true},materialProperties:plastic},{},'MATERIAL_COMBINATION_UNSUPPORTED'],
 ['modal thermalStress',{...structural,study:{...modal,thermalStress:true}},{},'MODAL_COMBINATION_UNSUPPORTED'],
 ['modal gravity',{...structural,study:{...modal,gravityEnabled:true,gravity:[0,0,-9810]}},{},'MODAL_COMBINATION_UNSUPPORTED'],
 ['modal webgpu',{...structural,study:modal},{method:'webgpu-pcg'},'MODAL_COMBINATION_UNSUPPORTED'],
 ['modal mfem',{...structural,study:modal},{method:'mfem-wasm'},'MODAL_COMBINATION_UNSUPPORTED'],
 ['modal hyperelastic',{...structural,study:modal,materialProperties:hyper},{},'MODAL_COMBINATION_UNSUPPORTED'],
 ['hyperelastic pressure',{...structural,materialProperties:hyper,conditions:hyperPressureConditions},{},'HYPERELASTIC_COMBINATION_UNSUPPORTED'],
 ['hyperelastic adaptive',{...structural,materialProperties:hyper},{adaptive:true},'HYPERELASTIC_COMBINATION_UNSUPPORTED'],
 ['hyperelastic mfem',{...structural,materialProperties:hyper},{method:'mfem-wasm'},'HYPERELASTIC_COMBINATION_UNSUPPORTED'],
 ['hyperelastic thermalStress',{...structural,study:{kind:'structural',thermalStress:true},materialProperties:hyper},{},'HYPERELASTIC_COMBINATION_UNSUPPORTED'],
 ['thermal adaptive',thermal,{adaptive:true},'ADAPTIVE_STUDY_UNSUPPORTED'],
 ['acoustic adaptive',acoustic,{adaptive:true},'ADAPTIVE_STUDY_UNSUPPORTED'],
 ['thermal webgpu',thermal,{method:'webgpu-pcg'},'ENGINE_STUDY_UNSUPPORTED'],
 ['channel mfem',channel,{method:'mfem-wasm'},'ENGINE_STUDY_UNSUPPORTED'],
 ['plain structural',structural,{},null],
 ['hyperelastic cpu dead force',{...structural,materialProperties:hyper},{},null],
 ['thermal cpu',thermal,{},null],
];
const combinationCodes=['MATERIAL_COMBINATION_UNSUPPORTED','MODAL_COMBINATION_UNSUPPORTED','HYPERELASTIC_COMBINATION_UNSUPPORTED','ADAPTIVE_STUDY_UNSUPPORTED','ENGINE_STUDY_UNSUPPORTED'];
test('worker validation and diagnoseExecution agree on every execution combination',async()=>{
 for(const [name,project,options,code] of table){
  const r=await run(project,options),codes=diagnoseExecution(project,{method:'wasm-pcg',adaptive:false,...options},'browser').diagnostics.filter(d=>combinationCodes.includes(d.code)).map(d=>d.code);
  if(code===null){assert.equal(r.error,undefined,name+' worker');assert.deepEqual(codes,[],name+' diagnostics');continue;}
  assert.equal(r.failure?.stage,'preparation',name+' worker');
  assert.ok(codes.includes(code),name+' diagnostics '+codes);
  const d=diagnoseExecution(project,{method:'wasm-pcg',adaptive:false,...options},'browser').diagnostics.find(x=>x.code===code);
  assert.equal(d.severity,'error');assert.equal(d.requiresUserIntent,false);assert.ok(d.suggestions.length>0);
 }
});
test('rule table is the single source of the worker messages',async()=>{
 const {executionCombinationRules}=await import('../src/execution-combination-rules.js');
 assert.deepEqual(executionCombinationRules.map(r=>r.id),['orthotropic-structural','plasticity-structural','modal-structural','hyperelastic-structural','adaptive-non-structural','gpu-mfem-non-structural']);
 for(const [name,project,options,code] of table.filter(t=>t[3])){const r=await run(project,options);assert.ok(executionCombinationRules.some(x=>x.message===r.error),name+' '+r.error);}
});
