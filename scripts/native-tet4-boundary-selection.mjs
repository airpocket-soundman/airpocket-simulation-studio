// Explicit prepared-mesh selection only. No CAD mapping, traction integration,
// local frames or inferred loading/supports are performed.
import {canonicalJson} from '../src/project-revision.js';
import {createNativeTet4Record,NATIVE_TET4_LIMITS} from './native-tet4-contract.mjs';
const fail=message=>{throw Object.assign(Error(message),{code:'NATIVE_TET4_SELECTION_INVALID'});};
const fields=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail('Unsupported native Tet4 boundary selection fields');};
const node=(id,n)=>{if(!Number.isInteger(id)||id<0||id>=n)fail('Selection node is not a mesh member');};

/** Convert named sets of fully fixed boundary nodes and explicit global nodal N
 * vectors to the existing canonical prepared record. The entire input is
 * snapshotted synchronously before any asynchronous revision computation.
 */
export async function createNativeTet4RecordFromBoundarySelections(request){
 fields(request,['input','mesh','fixedNodeSets','nodalLoads']);
 const n=request.mesh?.nodes?.length/3;
 if(!Array.isArray(request.mesh?.nodes)||!Number.isInteger(n)||n<4||n>NATIVE_TET4_LIMITS.nodes||!Array.isArray(request.mesh?.tets)||!request.mesh.tets.length||request.mesh.tets.length>NATIVE_TET4_LIMITS.elements||request.mesh.tets.some(t=>!Array.isArray(t)||t.length!==4))fail('Selection mesh capacity or shape is invalid');
 if(!Array.isArray(request.fixedNodeSets)||!request.fixedNodeSets.length||request.fixedNodeSets.length>NATIVE_TET4_LIMITS.nodes||!Array.isArray(request.nodalLoads)||request.nodalLoads.length>NATIVE_TET4_LIMITS.nodes)fail('Selection count exceeds supported capacity');
 if(request.fixedNodeSets.some(s=>!Array.isArray(s?.nodeIds)||!s.nodeIds.length||s.nodeIds.length>n)||request.nodalLoads.some(l=>!Array.isArray(l?.forceN)||l.forceN.length!==3))fail('Selection vector/set capacity or shape is invalid');
 const {input,mesh,fixedNodeSets,nodalLoads}=JSON.parse(canonicalJson(request));
 const fixed=new Set(),setIds=new Set(),loaded=new Set(),forces=Array(3*n).fill(0);
 for(const selection of fixedNodeSets){
  fields(selection,['id','nodeIds']);
  if(typeof selection.id!=='string'||!selection.id.trim()||selection.id!==selection.id.trim()||selection.id.length>200||setIds.has(selection.id))fail('Invalid or duplicate fixed selection identity');
  setIds.add(selection.id);
  if(!Array.isArray(selection.nodeIds)||!selection.nodeIds.length||selection.nodeIds.length>n)fail('Invalid fixed boundary node set');
  for(const id of selection.nodeIds){node(id,n);if(fixed.has(id))fail('Duplicate or intersecting fixed boundary sets');fixed.add(id);}
 }
 for(const load of nodalLoads){
  fields(load,['nodeId','forceN']);node(load.nodeId,n);
  if(loaded.has(load.nodeId)||fixed.has(load.nodeId))fail('Duplicate or intersecting loaded/fixed node');
  if(!Array.isArray(load.forceN)||load.forceN.length!==3||load.forceN.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>NATIVE_TET4_LIMITS.forceN))fail('Invalid explicit global nodal force in N');
  loaded.add(load.nodeId);for(let k=0;k<3;k++)forces[3*load.nodeId+k]=load.forceN[k];
 }
 // Reuse the authoritative saved-input/material, geometry, finite force and
 // rigid-body support checks before deriving boundary membership.
 const record=await createNativeTet4Record({input,mesh,fixedNodes:[...fixed].sort((a,b)=>a-b),forces});
 const faces=new Map();
 for(const t of record.tets)for(const face of [[t[0],t[1],t[2]],[t[0],t[1],t[3]],[t[0],t[2],t[3]],[t[1],t[2],t[3]]]){
  const key=face.sort((a,b)=>a-b).join(','),entry=faces.get(key);
  if(entry){entry.count++;if(entry.count>2)fail('Nonmanifold prepared mesh boundary');}else faces.set(key,{count:1,nodes:face});
 }
 const boundary=new Set();for(const face of faces.values())if(face.count===1)for(const id of face.nodes)boundary.add(id);
 for(const id of [...fixed,...loaded])if(!boundary.has(id))fail('Selected node is not on the prepared mesh boundary');
 return record;
}
