import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BoxGeometry} from 'three';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {sampleResult} from '../src/probe.js';

let sequence=0;
async function run(project,options={}){
 const previousSelf=globalThis.self,previousFetch=globalThis.fetch,messages=[],base=new URL('./fixtures/worker/',import.meta.url).href;
 globalThis.self={postMessage:data=>messages.push(data)};
 globalThis.fetch=async url=>{
  if(url!==base+'fem-kernel.wasm')throw Error('Unexpected worker fetch '+url);
  const bytes=await readFile(new URL('../public/fem-kernel.wasm',import.meta.url));
  return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 };
 try{
  await import(new URL('../src/analysis.worker.js',import.meta.url).href+'?plastic-integration='+sequence++);
  await globalThis.self.onmessage({data:{operation:'elastic',project:structuredClone(project),source:project.sourceModel,options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,...options},base}});
  const terminal=messages.findLast(m=>m.result||m.error);assert.ok(terminal);return terminal;
 }finally{
  if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;
  globalThis.fetch=previousFetch;
 }
}
function referenceProject(){
 const geometry=new BoxGeometry(10,10,40).toNonIndexed();geometry.translate(5,5,20);
 const positions=Array.from(geometry.attributes.position.array);geometry.dispose();
 const mesh={positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))};
 const face=(axis,value)=>positions.flatMap((_,i)=>i%9===0&&[0,3,6].every(k=>Math.abs(positions[i+k+axis]-value)<1e-7)?[i/9]:[]);
 const conditions=[[0,0,0],[1,0,0],[2,0,0],[2,40,.12]].map(([axis,position,value])=>({type:'displacement',value,direction:[0,1,2].map(k=>Number(k===axis)),regions:[{mesh:0,triangles:face(axis,position)}]}));
 return {version:1,name:'Synthetic plastic bar',sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},meshes:[mesh],conditions,study:{kind:'structural',gravityEnabled:false,nonlinearLoadSteps:5,maxNewtonIterations:30},materialProperties:{youngModulus:200e9,poissonRatio:.3,plasticity:{model:'j2-isotropic',yieldStress:250e6,hardeningModulus:1e9,testConditions:'Synthetic uniaxial reference'}}};
}
const close=(actual,expected,relative=1e-6)=>assert.ok(Math.abs(actual-expected)<=relative*Math.max(Math.abs(expected),1e-12),`${actual} vs ${expected}`);

test('plastic WASM worker agrees with a free-contraction reference and restores state/probes atomically',async()=>{
 const project=referenceProject(),api=createStudioApi();api.loadProject(project);
 const input=api.exportProject();assert.deepEqual(input.materialProperties.plasticity,project.materialProperties.plasticity);
 const terminal=await run(input);assert.equal(terminal.error,undefined);
 const output=terminal.result,r=output.result,kappa=(200e9*.003-250e6)/(200e9+1e9),stress=250e6+1e9*kappa;
 assert.match(r.engine,/WASM CPU/);assert.ok(output.mesh.tetrahedra.length<=2000);
 for(const s of r.stresses){close(s[2],stress);assert.ok(Math.abs(s[0])+Math.abs(s[1])<stress*1e-6);}
 for(const k of r.plasticity.equivalentPlasticStrain)close(k,kappa);
 const top=r.constraintRegionReactions.find(v=>v.conditionIndex===3);assert.ok(top);close(top.directionalReactionN,stress*1e-4);
 assert.equal(r.plasticity.history.length,5);assert.ok(r.plasticity.history.every(v=>v.residual<1e-8));assert.equal(r.plasticity.history.at(-1).loadFraction,1);
 const store=createCaseStore();store.add('Plastic bar',{...output,input,calculation:{operation:'elastic',options:{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3}}});
 const archive=JSON.parse(JSON.stringify(store.export())),restored=createCaseStore();restored.import(archive);
 const view=prepareCaseView(restored.list()[0]);assert.deepEqual(view.result.plasticity,r.plasticity);
 api.loadProject(view.input);assert.deepEqual(api.exportProject().materialProperties.plasticity,input.materialProperties.plasticity);
 const point=[0,1,2].map(k=>view.mesh.tetrahedra[0].reduce((sum,n)=>sum+view.mesh.nodes[3*n+k]/4,0));
 const probe=sampleResult(view.mesh,view.result,point,{elementIndex:0});close(probe.equivalentPlasticStrain,kappa);
 for(const corrupt of [p=>p.maxEquivalentPlasticStrain*=2,p=>p.plasticStrain[0].pop()]){
  const bad=structuredClone(archive),saved=restored.export();corrupt(bad.cases[0].output.result.plasticity);
  assert.throws(()=>restored.import(bad));assert.deepEqual(restored.export(),saved);
 }
 // Recomputed strain, energy and reaction consistency reject altered physical fields.
 for(const [corrupt,message] of [
  [output=>output.result.displacement.fill(0),/Saved plastic strain does not match its displacement/],
  [output=>output.result.plasticity.history.at(-1).elasticEnergyJ+=1,/Saved plastic final energies do not match its committed state/],
  [output=>output.result.reaction[2]=1e12,/Saved plastic total reaction does not match its constraint reactions/]
 ]){
  const bad=structuredClone(archive),saved=restored.export();corrupt(bad.cases[0].output);
  assert.throws(()=>restored.import(bad),message);assert.deepEqual(restored.export(),saved);
 }
 // Modal metadata cannot conceal registered plasticity with a missing committed result.
 {
  const bad=structuredClone(archive),saved=restored.export(),output=bad.cases[0].output;
  output.input.study.modalAnalysis=true;output.result.kind='modal';delete output.result.plasticity;
  assert.throws(()=>restored.import(bad),/Saved plasticity input has no plastic result/);assert.deepEqual(restored.export(),saved);
 }
 // The prototype node limit also applies to otherwise unchanged archived plastic fields.
 {
  const bad=structuredClone(archive),saved=restored.export(),mesh=bad.cases[0].output.mesh;
  while(mesh.nodes.length<2001*3)mesh.nodes.push(0,0,0);
  assert.equal(mesh.nodes.length/3,2001);
  assert.throws(()=>restored.import(bad),/Invalid saved plasticity fields/);assert.deepEqual(restored.export(),saved);
 }

});

test('plastic worker refuses adaptation, independent/GPU engines, modal and thermal-stress combinations',async()=>{
 const project=referenceProject();
 for(const options of [{adaptive:true},{method:'mfem-wasm'},{method:'webgpu-pcg'}]){
  const terminal=await run(project,options);assert.equal(terminal.result,undefined);assert.match(terminal.error,/plastic/i);
 }
 for(const study of [{modalAnalysis:true},{thermalStress:true,temperature:20}]){
  const terminal=await run({...project,study:{...project.study,...study}});assert.equal(terminal.result,undefined);assert.match(terminal.error,/plastic/i);
 }
});
