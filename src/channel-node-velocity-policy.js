import {validateChannelLayerBoundaryTransfer} from './channel-layer-boundary-transfer.js';
import {CHANNEL_TET4_MAX_NODES} from './channel-layer-tet4.js';
import {canonicalJson,hashCanonicalJson} from './project-revision.js';

export const CHANNEL_NODE_VELOCITY_POLICY='wall-over-inlet-at-shared-nodes';
export const CHANNEL_NODE_POLICY_LIMITS=Object.freeze({nodes:CHANNEL_TET4_MAX_NODES,bytes:1000000});
const fail=()=>{throw Object.assign(Error('Invalid limited channel node velocity policy'),{code:'CHANNEL_NODE_POLICY_INVALID'});};
function bounded(value){
 let count=0;
 const walk=(v,depth)=>{
  if(++count>100000||depth>10)fail();
  if(typeof v==='string'){if(v.length>200)fail();return;}
  if(typeof v==='number'&&!Number.isFinite(v))fail();
  if(!v||typeof v!=='object')return;
  const prototype=Object.getPrototypeOf(v);
  if(Array.isArray(v)?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)fail();
  const keys=Reflect.ownKeys(v);if(keys.length>CHANNEL_NODE_POLICY_LIMITS.nodes+1)fail();
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))fail();walk(d.value,depth+1);}
 };
 walk(value,0);const json=canonicalJson(value);if(new TextEncoder().encode(json).length>CHANNEL_NODE_POLICY_LIMITS.bytes)fail();return json;
}
function args(options){
 if(!options||Object.keys(options).length!==3||!['input','transfer','policy'].every(k=>Object.getOwnPropertyDescriptor(options,k)&&'value'in Object.getOwnPropertyDescriptor(options,k)))fail();
 if(options.policy!==CHANNEL_NODE_VELOCITY_POLICY)fail();
 return options;
}
/** Resolves only velocity intent for the validated axis-aligned six-face channel.
 * Pressure remains face-based: no nodal pressure or solver input is constructed. */
export async function createChannelNodeVelocityPolicy(options){
 const {input,transfer,policy}=args(options),validated=await validateChannelLayerBoundaryTransfer(input,transfer);
 if(options.policy!==policy||options.input!==input||options.transfer!==transfer)fail();
 // The existing validator regenerates all geometry, normals, ownership and BCs.
 // These explicit checks prevent accidental generalization of z symmetry.
 for(const [id,normal] of [['side-z-min',[0,0,-1]],['side-z-max',[0,0,1]]]){
  const boundary=validated.boundaries.find(b=>b.boundaryId===id);
  if(boundary?.condition.type!=='symmetry'||canonicalJson(boundary.outwardNormal)!==canonicalJson(normal))fail();
 }
 const memberships=new Map();
 for(const face of validated.faces)for(const nodeId of face.nodeIds){if(!memberships.has(nodeId))memberships.set(nodeId,new Set());memberships.get(nodeId).add(face.boundaryId);}
 if(memberships.size>CHANNEL_NODE_POLICY_LIMITS.nodes)fail();
 const inlet=validated.boundaries.find(b=>b.boundaryId==='inlet').condition.velocityMps,overriddenInletNodeIds=[];
 const nodes=[...memberships].sort((a,b)=>a[0]-b[0]).map(([nodeId,set])=>{
  const boundaryIds=[...set].sort(),wall=set.has('lower-wall')||set.has('upper-wall');
  let velocityMps=[null,null,null],componentSources=[null,null,null];
  if(wall){velocityMps=[0,0,0];componentSources=['wall','wall','wall'];if(set.has('inlet'))overriddenInletNodeIds.push(nodeId);}
  else if(set.has('inlet')){velocityMps=[...inlet];componentSources=['inlet','inlet','inlet'];}
  else if(set.has('side-z-min')||set.has('side-z-max')){velocityMps[2]=0;componentSources[2]='symmetry';}
  return {nodeId,boundaryIds,velocityMps,componentSources};
 });
 const pressurePa=validated.boundaries.find(b=>b.boundaryId==='outlet').condition.pressurePa;
 const payload={schemaVersion:1,kind:'limited-channel-node-velocity-policy',meshRevision:validated.meshRevision,transferRevision:validated.transferRevision,policy,units:{velocity:'m/s',pressure:'Pa'},nodes,overriddenInletNodeIds,outletFaceConditions:validated.faces.filter(f=>f.boundaryId==='outlet').map(f=>({faceId:f.faceId,pressurePa})),scope:{geometry:'parallel-plate-axis-aligned-Tet4',symmetry:'z-component-only',pressure:'face-only-no-nodal-assignment',nullMeaning:'unconstrained-component',solverConnected:false,projectBoundaryApiConnected:false}};
 const policyRevision=await hashCanonicalJson(bounded(payload));
 // Revalidate after the revision await: a changed original manifest/input must
 // not be accepted merely because the generated result uses detached data.
 const current=await validateChannelLayerBoundaryTransfer(input,transfer);
 if(canonicalJson(current)!==canonicalJson(validated))fail();
 if(options.policy!==policy||options.input!==input||options.transfer!==transfer)fail();
 return {...payload,policyRevision};
}
/** Reloaded JSON is untrusted; exact regeneration rejects self-rehashed edits. */
export async function validateChannelNodeVelocityPolicy(options,received){
 const before=bounded(received),expected=await createChannelNodeVelocityPolicy(options);
 if(bounded(received)!==before||before!==canonicalJson(expected))fail();
 return expected;
}
