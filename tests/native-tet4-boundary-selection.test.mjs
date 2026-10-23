import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeTet4Fixture} from './fixtures/native-tet4-record.mjs';
import {createNativeTet4RecordFromBoundarySelections as convert} from '../scripts/native-tet4-boundary-selection.mjs';
import {serializeNativeTet4Record,verifyNativeTet4Output} from '../scripts/native-tet4-contract.mjs';
import {runProof} from '../scripts/check-native-proof.mjs';
async function fixture(load=75){
 const f=await nativeTet4Fixture({load});
 return {f,request:{input:f.input,mesh:f.mesh,fixedNodeSets:[{id:'explicit-bottom-boundary',nodeIds:[3,1,0,2]}],nodalLoads:[4,5,6,7].map(nodeId=>({nodeId,forceN:f.forces.slice(3*nodeId,3*nodeId+3)}))}};
}
test('explicit translated bar selections produce the exact existing normalized record/hash without mutation',async()=>{
 for(const load of [75,-75,0]){
  const {f,request}=await fixture(load),before=structuredClone(request),r=await convert(request);
  assert.deepEqual(r,f.record);assert.deepEqual(await serializeNativeTet4Record(r),await serializeNativeTet4Record(f.record));assert.deepEqual(request,before);
  const reordered=structuredClone(request);reordered.fixedNodeSets[0].nodeIds.reverse();reordered.nodalLoads.reverse();assert.deepEqual(await convert(reordered),r);
 }
 const {request}=await fixture(),promise=convert(request);request.mesh.nodes[0]=999;request.nodalLoads[0].forceN[2]=999;
 assert.deepEqual(await promise,(await nativeTet4Fixture()).record);
});
test('invalid, duplicate, intersecting and unsupported selections are rejected without mutation',async()=>{
 const mutations=[r=>r.fixedNodeSets[0].nodeIds.push(0),r=>r.fixedNodeSets.push({id:'second',nodeIds:[2]}),r=>r.fixedNodeSets.push({id:r.fixedNodeSets[0].id,nodeIds:[4]}),r=>r.nodalLoads.push(structuredClone(r.nodalLoads[0])),r=>r.nodalLoads[0].nodeId=0,r=>r.nodalLoads[0].nodeId=8,r=>r.nodalLoads[0].nodeId='4',r=>r.nodalLoads[0].forceN[0]=NaN,r=>r.fixedNodeSets[0].nodeIds=[0,1],r=>r.fixedNodeSets[0].nodeIds=[],r=>r.nodalLoads[0].forceN=[1,2],r=>r.nodalLoads[0].forceN[2]=1e13,r=>r.nodalLoads[0].frame='local',r=>r.fixedNodeSets[0].components=['z'],r=>r.faceLoads=[{face:0,tractionN:1}],r=>r.input.materialProperties.density=1000,r=>r.mesh.tets[0][0]=999,r=>r.fixedNodeSets=Array(513).fill({id:'too-many',nodeIds:[0]})];
 for(const mutate of mutations){const {request}=await fixture();mutate(request);const before=structuredClone(request);await assert.rejects(convert(request));assert.deepEqual(request,before);}
});
test('interior mesh nodes cannot be selected as boundary loads',async()=>{
 const {request}=await fixture(),m=request.mesh,original=m.tets.shift(),p=[0,1,2].map(k=>original.reduce((sum,id)=>sum+m.nodes[3*id+k],0)/4),interior=m.nodes.length/3;
 m.nodes.push(...p);
 for(const face of [[original[0],original[1],original[2]],[original[0],original[1],original[3]],[original[0],original[2],original[3]],[original[1],original[2],original[3]]]){
  const t=[...face,interior],[a,b,c,d]=t.map(id=>m.nodes.slice(3*id,3*id+3)),u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]),w=d.map((x,k)=>x-a[k]);
  const det=u[0]*(v[1]*w[2]-v[2]*w[1])-u[1]*(v[0]*w[2]-v[2]*w[0])+u[2]*(v[0]*w[1]-v[1]*w[0]);if(det<0)[t[0],t[1]]=[t[1],t[0]];m.tets.push(t);
 }
 // The same subdivided mesh is valid before any interior selection is introduced.
 assert.equal((await convert(request)).nodes.length/3,9);
 request.nodalLoads.push({nodeId:interior,forceN:[0,0,1]});const before=structuredClone(request);
 await assert.rejects(convert(request),/not on the prepared mesh boundary/);assert.deepEqual(request,before);
});
async function execute(binary,wasm){
 for(const load of [75,-75,0]){
  const {f,request}=await fixture(load),record=await convert(request),{wire,recordRevision}=await serializeNativeTet4Record(record);
  const r=runProof(binary,wire,{wasm});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);
  const output=verifyNativeTet4Output(JSON.parse(r.stdout),{record,recordRevision,runtime:wasm?'wasm-development-check':'host-native'});
  const reference=runProof(binary,(await serializeNativeTet4Record(f.record)).wire,{wasm});assert.ifError(reference.error);assert.equal(reference.status,0,reference.stderr);assert.deepEqual(JSON.parse(reference.stdout),output);
  for(let id=0;id<8;id++)for(let k=0;k<3;k++){const expected=id>=4&&k===2?load*.06/(2e9*.0003):0;assert.ok(Math.abs(output.displacementM[3*id+k]-expected)<=1e-10+Math.abs(expected)*1e-7);}
  // Net force remains unchanged but the altered reaction pair introduces a couple.
  const altered=structuredClone(output);altered.reactionsN[2]+=10;altered.reactionsN[11]-=10;
  assert.throws(()=>verifyNativeTet4Output(altered,{record,recordRevision,runtime:output.runtime}),/moment balance/);
 }
}
test('actual selected-record WASM solves match original records and analytical displacement',{skip:!process.env.AIRPOCKET_NATIVE_PROOF_WASM},()=>execute(process.env.AIRPOCKET_NATIVE_PROOF_WASM,true));
test('actual selected-record host solves match original records and analytical displacement',{skip:!process.env.AIRPOCKET_NATIVE_PROOF},()=>execute(process.env.AIRPOCKET_NATIVE_PROOF,false));
