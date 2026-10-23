import test from 'node:test';
import assert from 'node:assert/strict';
import {createChannelLayerPlan} from '../src/channel-layer-plan.js';
import {createChannelLayerTet4,CHANNEL_TET4_MAX_NODES} from '../src/channel-layer-tet4.js';
import {createChannelLayerBoundaryTransfer,getChannelLayerMeshRevision} from '../src/channel-layer-boundary-transfer.js';
import {canonicalJson,hashCanonicalJson} from '../src/project-revision.js';
import {createChannelNodeVelocityPolicy,validateChannelNodeVelocityPolicy,CHANNEL_NODE_VELOCITY_POLICY,CHANNEL_NODE_POLICY_LIMITS} from '../src/channel-node-velocity-policy.js';
async function fixture(){
 const mesh=createChannelLayerTet4({plan:createChannelLayerPlan({gapMm:10,firstHeightMm:.1,growthRatio:2,layersPerWall:3}),lengthMm:2,widthMm:1,maxAspectRatio:20,minimumCellHeightMm:.1});
 const input={mesh,expectedMeshRevision:await getChannelLayerMeshRevision(mesh),conditions:{lowerWall:{type:'no-slip-wall'},upperWall:{type:'no-slip-wall'},xMin:{type:'velocity-inlet',velocityMps:[1,0,0]},xMax:{type:'pressure-outlet',pressurePa:5},zMin:{type:'symmetry'},zMax:{type:'symmetry'}},maxTetEdgeAspectRatio:30,minimumTetVolumeMm3:1e-6};
 return {input,transfer:await createChannelLayerBoundaryTransfer(input),policy:CHANNEL_NODE_VELOCITY_POLICY};
}
test('independent coordinate oracle resolves all 32 shared-edge nodes and keeps pressure only on faces',async()=>{
 const options=await fixture(),before=structuredClone(options),result=await createChannelNodeVelocityPolicy(options);
 assert.equal(result.nodes.length,32);assert.equal(options.transfer.elements.length,42);assert.equal(result.overriddenInletNodeIds.length,4);
 const overridden=[];
 for(const n of result.nodes){
  const [x,y,z]=options.input.mesh.nodes.slice(3*n.nodeId,3*n.nodeId+3),wall=y===0||y===10;
  const memberships=[...(y===0?['lower-wall']:[]),...(y===10?['upper-wall']:[]),...(x===0?['inlet']:[]),...(x===2?['outlet']:[]),...(z===0?['side-z-min']:[]),...(z===1?['side-z-max']:[])].sort();
  assert.deepEqual(n.boundaryIds,memberships);assert.deepEqual(n.velocityMps,wall?[0,0,0]:x===0?[1,0,0]:[null,null,0]);assert.deepEqual(n.componentSources,wall?['wall','wall','wall']:x===0?['inlet','inlet','inlet']:[null,null,'symmetry']);
  assert.equal(Object.hasOwn(n,'pressurePa'),false);if(wall&&x===0)overridden.push(n.nodeId);
 }
 assert.deepEqual(result.overriddenInletNodeIds,overridden);assert.equal(result.outletFaceConditions.length,14);assert.ok(result.outletFaceConditions.every(f=>f.pressurePa===5&&f.faceId.startsWith('outlet:')));assert.equal(result.scope.solverConnected,false);assert.deepEqual(options,before);
});
test('explicit policy, exact normals and original geometry must validate before resolution',async()=>{
 for(const change of [o=>delete o.policy,o=>o.policy='automatic',o=>o.transfer.boundaries[4].outwardNormal=[1,0,0],o=>o.transfer.faces[0].nodeIds[0]=999,o=>o.input.mesh.nodes[0]=Infinity,o=>o.input.conditions.xMin.velocityMps[0]=NaN,o=>o.transfer.units.velocity='mm/s']){
  const o=await fixture();change(o);await assert.rejects(createChannelNodeVelocityPolicy(o));
 }
});
test('JSON reload regenerates exact assignments and rejects self-rehashed corruption without mutation',async()=>{
 const o=await fixture(),a=await createChannelNodeVelocityPolicy(o),b=await createChannelNodeVelocityPolicy({policy:o.policy,transfer:o.transfer,input:o.input});assert.deepEqual(a,b);assert.deepEqual(await validateChannelNodeVelocityPolicy(o,JSON.parse(JSON.stringify(a))),a);
 for(const change of [r=>r.nodes[0].velocityMps[0]=1,r=>r.nodes[5].velocityMps[0]=0,r=>r.nodes[0].boundaryIds=[],r=>r.overriddenInletNodeIds=[],r=>r.outletFaceConditions[0].pressurePa=0,r=>r.nodes.reverse(),r=>r.meshRevision='sha256:'+'0'.repeat(64)]){
  const r=structuredClone(a);change(r);const {policyRevision,...payload}=r;r.policyRevision=await hashCanonicalJson(canonicalJson(payload));const before=structuredClone(r);await assert.rejects(validateChannelNodeVelocityPolicy(o,r));assert.deepEqual(r,before);
 }
});
test('late input/manifest mutation is rejected; returned data is detached',async()=>{
 const o=await fixture(),pending=createChannelNodeVelocityPolicy(o);o.input.conditions.xMin.velocityMps[0]=2;await assert.rejects(pending);
 const fresh=await fixture(),a=await createChannelNodeVelocityPolicy(fresh);a.nodes[0].velocityMps[0]=9;a.outletFaceConditions[0].pressurePa=9;assert.equal(fresh.transfer.boundaries[2].condition.velocityMps[0],1);assert.equal(fresh.transfer.boundaries[3].condition.pressurePa,5);
});
test('received capacities, accessors and nonfinite values fail before untrusted traversal',async()=>{
 const o=await fixture(),r=await createChannelNodeVelocityPolicy(o);assert.equal(CHANNEL_NODE_POLICY_LIMITS.nodes,CHANNEL_TET4_MAX_NODES);
 for(const bad of [{...r,nodes:Array(CHANNEL_NODE_POLICY_LIMITS.nodes+1).fill(null)},{...r,nodes:[{velocityMps:[Infinity,null,0]}]},{...r,scope:{get value(){throw Error('accessor ran');}}}])await assert.rejects(validateChannelNodeVelocityPolicy(o,bad),e=>e.code==='CHANNEL_NODE_POLICY_INVALID');
});
test('inherited array map cannot forge canonical bytes for an altered node',async()=>{
 const o=await fixture(),r=await createChannelNodeVelocityPolicy(o),original=canonicalJson(r.nodes);
 r.nodes[0].velocityMps[0]=999;Object.setPrototypeOf(r.nodes,{...Array.prototype,map:()=>({join:()=>original.slice(1,-1)})});
 await assert.rejects(validateChannelNodeVelocityPolicy(o,r),e=>e.code==='CHANNEL_NODE_POLICY_INVALID');
});
test('maximum 512 wall layers remain within fixed node and serialized-output capacities',async()=>{
 const o=await fixture();o.input.mesh=createChannelLayerTet4({plan:createChannelLayerPlan({gapMm:10,firstHeightMm:.001,growthRatio:1,layersPerWall:256}),lengthMm:2,widthMm:1,maxAspectRatio:3000,minimumCellHeightMm:.001});o.input.expectedMeshRevision=await getChannelLayerMeshRevision(o.input.mesh);o.input.maxTetEdgeAspectRatio=3000;o.input.minimumTetVolumeMm3=1e-8;o.transfer=await createChannelLayerBoundaryTransfer(o.input);
 const r=await createChannelNodeVelocityPolicy(o);assert.equal(r.nodes.length,CHANNEL_NODE_POLICY_LIMITS.nodes);assert.equal(r.overriddenInletNodeIds.length,4);assert.ok(new TextEncoder().encode(JSON.stringify(r)).length<CHANNEL_NODE_POLICY_LIMITS.bytes);assert.equal((await validateChannelNodeVelocityPolicy(o,JSON.parse(JSON.stringify(r)))).policyRevision,r.policyRevision);
});
