import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeTet4Record,validateNativeTet4Record,serializeNativeTet4Record,verifyNativeTet4Output} from '../scripts/native-tet4-contract.mjs';
import {nativeTet4Fixture} from './fixtures/native-tet4-record.mjs';
import {runProof} from '../scripts/check-native-proof.mjs';
test('prepared saved Tet4 records bind actual input/mesh content and serialize without mutation',async()=>{
 const f=await nativeTet4Fixture(),before=structuredClone(f);const a=await serializeNativeTet4Record(f.record),b=await serializeNativeTet4Record(JSON.parse(JSON.stringify(f.record)));
 assert.deepEqual(a,b);assert.match(a.wire,/^airpocket-native-tet4-v2 [a-f0-9]{64}/);assert.deepEqual(f,before);
 const changed=await createNativeTet4Record({...f,input:{...f.input,name:'different saved input'}});assert.notEqual(changed.sourceInputRevision,f.record.sourceInputRevision);assert.notEqual((await serializeNativeTet4Record(changed)).recordRevision,a.recordRevision);
});
test('serialization snapshots the observed record before asynchronous hashing',async()=>{
 const {record}=await nativeTet4Fixture(),before=structuredClone(record),expected=await serializeNativeTet4Record(before);
 const pending=serializeNativeTet4Record(record);record.forces[14]=999;record.youngPa=3e9;record.nodes[0]=8;
 assert.deepEqual(await pending,expected,'wire and revision must both describe the call-time record');
 assert.notDeepEqual(await serializeNativeTet4Record(record),expected,'later changes belong to a distinct record');
});
test('prepared contract refuses unsupported physics, wrong units, indices, degeneracy and unresolved rigid-body modes',async()=>{
 const f=await nativeTet4Fixture();
 for(const mutate of [r=>r.units='m-Pa-N',r=>r.youngPa='2e9',r=>r.poissonRatio=.49,r=>r.nodes[0]=Infinity,r=>r.nodes[0]='7',r=>r.nodes.push(1),r=>r.tets[0][0]=8,r=>r.tets[0][0]=r.tets[0][1],r=>r.tets.push([...r.tets[0]]),r=>[r.tets[0][0],r.tets[0][1]]=[r.tets[0][1],r.tets[0][0]],r=>r.fixedNodes=[0,1],r=>r.fixedNodes=[0,1,1],r=>r.forces[0]=NaN,r=>r.forces[0]=1e13,r=>r.sourceInputRevision='fake']){
  const r=structuredClone(f.record);mutate(r);assert.throws(()=>validateNativeTet4Record(r));
 }
 for(const patch of [{kind:'thermal'},{kind:'structural',modalAnalysis:true},{kind:'structural',gravityEnabled:true}])await assert.rejects(createNativeTet4Record({...f,input:{...f.input,study:patch}}));
 await assert.rejects(createNativeTet4Record({...f,input:{...f.input,meshes:[]}}));
 await assert.rejects(createNativeTet4Record({...f,input:{...f.input,conditions:[{type:'force',value:'bad'}]}}));
 await assert.rejects(createNativeTet4Record({...f,input:{...f.input,materialProperties:{...f.input.materialProperties,plasticity:{}}}}));
});
function syntheticOutput(record,recordRevision){return {schemaVersion:2,kind:record.kind,engine:'mfem-native',runtime:'host-native',mfemVersion:41000,recordRevision,sourceInputRevision:record.sourceInputRevision,meshRevision:record.meshRevision,units:'m-N',nodeCount:8,elementCount:6,converged:true,iterations:1,verifiedResidual:0,displacementM:Array(24).fill(0),reactionsN:[0,0,-75,...Array(21).fill(0)],appliedN:[0,0,75],balanceN:[0,0,0]};}
test('saved material dependence and evaluation envelopes cannot be silently discarded',async()=>{
 const f=await nativeTet4Fixture();
 const temperatureTable=[{temperature:0,youngModulus:1e9,poissonRatio:0},{temperature:100,youngModulus:3e9,poissonRatio:0}];
 for(const patch of [{dependence:{elasticTemperatureTable:temperatureTable}},{dependence:{rateDependent:true}},{dependence:{strainRateMin:1}},{temperatureMin:0},{temperatureMax:100},{phaseChange:{latentHeat:1}},{density:1000},{fractureData:null}])await assert.rejects(createNativeTet4Record({...f,input:{...f.input,materialProperties:{...f.input.materialProperties,...patch}}}));
 for(const key of ['materialTemperature','temperature','referenceTemperature'])await assert.rejects(createNativeTet4Record({...f,input:{...f.input,study:{...f.input.study,[key]:20}}}));
 const accepted=await createNativeTet4Record({...f,input:{...f.input,materialProperties:{...f.input.materialProperties,source:'constant synthetic reference',grade:'synthetic',notes:'No temperature or rate evaluation'}}});assert.equal(accepted.youngPa,2e9);
});
test('result contract refuses runtime substitution, wrong identity, nonfinite fields and force imbalance',async()=>{
 const {record}=await nativeTet4Fixture(),{recordRevision}=await serializeNativeTet4Record(record),out=syntheticOutput(record,recordRevision),options={record,recordRevision,runtime:'host-native'};verifyNativeTet4Output(out,options);
 for(const patch of [{runtime:'wasm-development-check'},{recordRevision:'fake'},{meshRevision:'fake'},{nodeCount:9},{units:'mm-N'},{converged:false},{verifiedResidual:NaN},{verifiedResidual:2e-8},{displacementM:Array(24).fill(Infinity)},{appliedN:[0,0,999]},{balanceN:[0,0,10]}])assert.throws(()=>verifyNativeTet4Output({...out,...patch},options));
});
const host=process.env.AIRPOCKET_NATIVE_PROOF,wasm=process.env.AIRPOCKET_NATIVE_PROOF_WASM;
test('actual same-source WASM prepared records solve without claiming host-native execution',{skip:!wasm},async()=>{
 for(const [load,nu] of [[75,0],[-75,0],[0,0],[75,.3]]){
  const {record}=await nativeTet4Fixture({load,nu}),{wire,recordRevision}=await serializeNativeTet4Record(record),r=runProof(wasm,wire,{wasm:true});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);
  const out=verifyNativeTet4Output(JSON.parse(r.stdout),{record,recordRevision,runtime:'wasm-development-check'});
  if(nu===0)for(let node=0;node<8;node++)for(let k=0;k<3;k++){const expected=k===2&&node>=4?load*.06/(2e9*.0003):0;assert.ok(Math.abs(out.displacementM[3*node+k]-expected)<=1e-10+Math.abs(expected)*1e-7);}
 }
 const {record}=await nativeTet4Fixture(),{wire}=await serializeNativeTet4Record(record),tokens=wire.trim().split(/\s+/);
 const bad=[];for(const [index,value] of [[4,-1],[5,.5],[6,513],[9,'NaN'],[33,99],[58,0],[61,'Infinity']]){const changed=tokens.slice();changed[index]=String(value);bad.push(changed.join(' ')+'\n');}bad.push(wire+'extra',wire.slice(0,-20),'x'.repeat(262145));
 for(const input of bad){const r=runProof(wasm,input,{wasm:true});assert.ifError(r.error);assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/native Tet4|Native proof input exceeds/);}
});
test('real prepared Tet4 host/WASM outputs match and translated bar matches analytical displacement',{skip:!host||!wasm},async()=>{
 for(const load of [75,-75,0]){
  const f=await nativeTet4Fixture({load}),{wire,recordRevision}=await serializeNativeTet4Record(f.record),outputs=[];
  for(const [binary,isWasm,runtime] of [[host,false,'host-native'],[wasm,true,'wasm-development-check']]){
   const r=runProof(binary,wire,{wasm:isWasm});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);const out=verifyNativeTet4Output(JSON.parse(r.stdout),{record:f.record,recordRevision,runtime});
   for(let node=0;node<8;node++)for(let k=0;k<3;k++){const expected=k===2&&node>=4?load*.06/(2e9*.0003):0;assert.ok(Math.abs(out.displacementM[3*node+k]-expected)<=1e-10+Math.abs(expected)*1e-7);}
   outputs.push(out);
  }
  for(const key of ['displacementM','reactionsN','balanceN'])for(let i=0;i<outputs[0][key].length;i++)assert.ok(Math.abs(outputs[0][key][i]-outputs[1][key][i])<=(key==='displacementM'?1e-10:1e-8));
 }
});
test('real prepared Tet4 entry refuses malformed, oversized and unsafe records identically',{skip:!host||!wasm},async()=>{
 const f=await nativeTet4Fixture(),{wire}=await serializeNativeTet4Record(f.record),tokens=wire.trim().split(/\s+/),bad=[];
 const changed=(index,value)=>{const t=tokens.slice();t[index]=String(value);bad.push(t.join(' ')+'\n');};
 // header: protocol,three hashes,E,nu,nodeCount,elementCount,fixedCount; then24coordinates,24indices,4fixednodes,24forces.
 changed(4,-1);changed(5,.5);changed(6,513);changed(9,'NaN');changed(33,99);changed(58,0);changed(61,'Infinity');bad.push(wire+'extra',wire.slice(0,-20),'x'.repeat(262145));
 for(const input of bad){const results=[runProof(host,input),runProof(wasm,input,{wasm:true})];for(const r of results){assert.ifError(r.error);assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/native Tet4|Native proof input exceeds/);}assert.equal(results[0].stderr.trim(),results[1].stderr.trim());}
});
