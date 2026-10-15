import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {BoxGeometry} from 'three';
import {solverAdapterKinds,legacyDefaultKind,getSolverAdapter,resolveSolverAdapter} from '../src/solver-adapters/index.js';
let sequence=0;
function box(bounds){const g=new BoxGeometry(...bounds.slice(3)).toNonIndexed();g.translate(...bounds.slice(0,3).map((v,k)=>v+bounds[k+3]/2));const positions=Array.from(g.attributes.position.array);g.dispose();return {positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))};}
const face=(mesh,z)=>mesh.positions.flatMap((_,i)=>i%9===0&&[2,5,8].every(k=>Math.abs(mesh.positions[i+k]-z)<1e-7)?[i/9]:[]),region=(mesh,triangles)=>({mesh,triangles});
async function run(project,options={},operation='elastic'){const previousSelf=globalThis.self,previousFetch=globalThis.fetch,messages=[],base=new URL('./fixtures/worker/',import.meta.url).href;globalThis.self={postMessage:data=>messages.push(data)};globalThis.fetch=async url=>{if(url===base+'fem-kernel.wasm'){const bytes=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}throw Error('Unexpected worker fetch '+url);};try{await import(new URL('../src/analysis.worker.js',import.meta.url).href+'?registry='+sequence++);await globalThis.self.onmessage({data:{operation,project:structuredClone(project),source:project.sourceModel,options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options},base}});return messages.findLast(m=>m.result||m.error);}finally{if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;globalThis.fetch=previousFetch;}}
const strip=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='performance'?undefined:x));
const m=box([0,0,0,10,10,40]),src={kind:'box',bounds:[0,0,0,10,10,40]};
const structural={version:1,sourceModel:src,study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0},meshes:[m],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'force',value:100,direction:[0,0,1],regions:[region(0,face(m,40))]}]};
const thermal={version:1,sourceModel:src,study:{kind:'thermal'},materialProperties:{conductivity:2},meshes:[m],conditions:[{type:'temperature',value:100,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'temperature',value:20,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const acoustic={version:1,sourceModel:src,study:{kind:'acoustic',frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0},meshes:[m],conditions:[{type:'acousticPressure',value:1,direction:[1,0,0],regions:[region(0,face(m,0))]},{type:'acousticPressure',value:0,direction:[1,0,0],regions:[region(0,face(m,40))]}]};
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),label+': '+actual+' vs '+expected);
const weighted=a=>a.reduce((sum,v,i)=>sum+v*((i%7)+1),0);
// Baselines were computed by running the pre-adapter worker (git 0e621df^:src/analysis.worker.js) on these fixtures.
function acousticBaseline(output){const r=output.result;
 assert.equal(r.kind,'acoustic');assert.equal(r.engine,'Airpocket Acoustic Tet4 / WASM CPU');assert.equal(r.frequency,1000);assert.equal(r.harmonicConvention,'exp(+i omega t)');assert.equal(r.amplitudeConvention,'peak pressure; SPL uses RMS');
 for(const k of ['real','imag','magnitude','phase','spl'])assert.equal(r[k].length,335,k);
 assert.equal(output.mesh.summary.nodeCount,335);assert.equal(output.mesh.summary.elementCount,1006);
 close(r.maxPressurePa,1,'maxPressurePa');close(r.maxSplDb,90.96910013008056,'maxSplDb');close(Math.min(...r.real),0,'min real');close(Math.max(...r.real),1,'max real');
 close(weighted(r.real),683.9928165073085,'real checksum');close(weighted(r.magnitude),683.9928165073085,'magnitude checksum');close(weighted(r.spl),81062.30642725776,'spl checksum');
 assert.ok(r.imag.every(v=>v===0));assert.equal(r.farField,undefined);assert.equal(r.sweep,undefined);assert.equal(r.coupling,undefined);
 assert.equal(output.boundary.acousticPressures.length>0,true);assert.equal(typeof r.performance.solveMs,'number');}
test('registry serves exactly the migrated disciplines and falls back to structural',()=>{
 assert.deepEqual([...solverAdapterKinds].sort(),['acoustic','channelFlow','creepingFlow','structural','thermal']);
 assert.equal(legacyDefaultKind,'structural');
 for(const kind of solverAdapterKinds){const a=getSolverAdapter(kind);assert.equal(a.kind,kind);assert.equal(typeof a.execute,'function');assert.equal(typeof a.progressMessage,'string');assert.equal(resolveSolverAdapter({kind}),a);}
 assert.equal(getSolverAdapter('nonexistent'),undefined);
 for(const study of [undefined,null,{},{kind:'nonexistent'}])assert.equal(resolveSolverAdapter(study),getSolverAdapter('structural'));
 assert.equal(getSolverAdapter('thermal').progressMessage,'Solving heat conduction…');
});
test('worker results are produced through the registry adapters with unchanged payloads',async()=>{
 const s=await run(structural),t=await run(thermal),a=await run(acoustic,{size:3});
 for(const r of [s,t,a])assert.equal(r.error,undefined);
 assert.equal(s.result.result.kind,'elastic');assert.ok(Math.abs(s.result.result.maxDisplacementMm-.04)<1e-7);assert.ok(Math.abs(s.result.result.reaction[2]+100)<1e-5);
 assert.ok(Math.abs(t.result.result.minTemperature-20)<1e-5);assert.ok(Math.abs(t.result.result.maxTemperature-100)<1e-5);
 acousticBaseline(a.result);
 assert.equal(typeof s.result.result.performance.solveMs,'number');
});
test('operation names are not rejected by the worker: only mesh is special, everything else solves (pre-change behavior)',async()=>{
 const elastic=await run(structural),bogus=await run(structural,{},'bogus-operation');
 assert.equal(bogus.error,undefined);assert.deepEqual(strip(bogus),strip(elastic));
 const mesh=await run(structural,{},'mesh');assert.equal(mesh.error,undefined);assert.ok(mesh.result.mesh&&!mesh.result.result);
});
test('rejections that precede dispatch keep their exact messages',async()=>{
 assert.equal((await run({...thermal,study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0}})).error,'Remove boundary conditions belonging to the other discipline or use the matching example');
 assert.equal((await run(thermal,{adaptive:true})).error,'Adaptive refinement currently supports structural analysis only');
 assert.equal((await run(structural,{fractureAssessment:{}})).error,'Fracture assessment requires registered toughness and surface data');
 assert.match((await run(thermal,{method:'mfem-wasm'})).error,/^WebGPU and MFEM currently support structural analysis only$/);
});

const channel={version:1,sourceModel:{kind:'cylinder'},study:{kind:'channelFlow',flowAxis:1,pressureDropPa:.01,dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500},meshes:[box([0,0,0,10,10,40])],conditions:[]};
const creeping={version:1,sourceModel:{kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:5},enclosure:[-20,-20,-20,40,40,40]},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],meshSettings:{refinements:[{center:[0,0,0],radius:30,size:.9}]},study:{kind:'creepingFlow',dynamicViscosity:1,fluidDensity:1000,freeStreamVelocity:[.001,0,0],referenceLengthMm:10}};
test('channelFlow adapter reaches the solver with the worker context and matches the pre-change payload',async()=>{
 const o=(await run(channel,{size:3})).result,r=o.result;
 assert.equal(r.kind,'channelFlow');assert.equal(r.engine,'Airpocket developed laminar channel / WASM CPU');assert.deepEqual(o.boundary,{reports:[]});
 assert.equal(r.velocity.length,3780);assert.equal(r.speed.length,1260);assert.equal(r.pressure.length,1260);assert.equal(r.iterations,43);
 close(r.maxSpeedMs,0.006133115844092243,'maxSpeedMs');close(r.meanVelocityMs,0.002910480462397977,'meanVelocityMs');close(r.inletFlowM3s,0.0000013053381951619476,'inlet');close(r.outletFlowM3s,0.0000013031103249001521,'outlet');close(r.relativeFlowImbalance,0.0017067379703227627,'imbalance');close(r.reynolds,69.85153109755144,'reynolds');close(r.pressureDropPa,0.01,'dp');
 close(weighted(r.velocity),9.336768033797657,'velocity checksum');close(weighted(r.pressure),25.17295857200065,'pressure checksum');
 assert.deepEqual(r.channel.axis,1);close(r.channel.hydraulicDiameterM,0.024,'Dh');assert.equal(typeof r.performance.solveMs,'number');
});
test('creepingFlow adapter reaches the solver with the worker context and matches the pre-change payload',async()=>{
 const o=(await run(creeping,{size:6})).result,r=o.result;
 assert.equal(r.kind,'stokes');assert.equal(r.engine,'Airpocket 3D creeping Stokes P1/P1 PSPG / WASM CPU');assert.equal(r.method,'wasm-gmres');assert.deepEqual(o.boundary,{reports:[]});
 assert.equal(r.velocity.length,4026);assert.equal(r.speed.length,1342);assert.equal(r.pressure.length,1342);assert.equal(r.iterations,56);
 close(r.maxSpeedMs,0.0011611171488440004,'maxSpeedMs');close(r.minPressurePa,-0.4994561508381112,'minP');close(r.maxPressurePa,0.30981349232420485,'maxP');close(r.dragN[0],0.00012245733983518335,'drag x');close(r.outerReactionN[0],0.0001824326713562844,'reaction x');
 close(weighted(r.velocity),4.57343525921675,'velocity checksum');close(weighted(r.pressure),-455.1053970959824,'pressure checksum');
 assert.deepEqual(r.stokes.pressureGauge,{node:23,valuePa:0});assert.equal(r.stokes.velocityElement,'P1');assert.equal(typeof r.performance.solveMs,'number');
});
test('failure stages set through the adapter context keep the pre-change stage, code and message',async()=>{
 const failureFor=(stage,message,code)=>({schemaVersion:1,code,stage,message,diagnostics:[{code,severity:'error',stage,target:'/',message,evidence:{},suggestions:[],requiresUserIntent:true}]});
 const badTemperature=await run({...structural,study:{kind:'structural',thermalStress:true,temperatureSource:{mesh:{nodes:[0,0,0],tetrahedra:[]},temperature:[20]}}});
 assert.equal(badTemperature.error,'Invalid transferred temperature field');assert.deepEqual(badTemperature.failure,failureFor('temperature-transfer','Invalid transferred temperature field','ANALYSIS_TEMPERATURE_TRANSFER_FAILED'));
 const badMaterial=await run({...structural,study:{kind:'structural',materialTemperature:500},materialProperties:{youngModulus:1e9,poissonRatio:0,temperatureMin:20,temperatureMax:80,dependence:{elasticTemperatureTable:[{temperature:20,youngModulus:1e9,poissonRatio:0},{temperature:80,youngModulus:5e8,poissonRatio:0}]}}});
 assert.equal(badMaterial.error,'Temperature is outside the registered material validity range');assert.deepEqual(badMaterial.failure,failureFor('material-evaluation','Temperature is outside the registered material validity range','ANALYSIS_MATERIAL_EVALUATION_FAILED'));
});
