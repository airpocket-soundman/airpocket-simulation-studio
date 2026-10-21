// Explicit prepared Tet4 contract; no CAD meshing or condition transfer is inferred.
import {getProjectRevision,canonicalJson} from '../src/project-revision.js';
import {createStudioApi} from '../src/studio-api.js';
export const NATIVE_TET4_LIMITS=Object.freeze({nodes:512,elements:1024,coordinateMm:1e6,forceN:1e12,youngPa:1e15,inputBytes:262144});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
export function validateNativeTet4Record(r){
 requireValue(object(r)&&Object.keys(r).length===11&&Object.keys(r).every(k=>['schemaVersion','kind','units','sourceInputRevision','meshRevision','youngPa','poissonRatio','nodes','tets','fixedNodes','forces'].includes(k))&&r.schemaVersion===2&&r.kind==='prepared-isotropic-tet4'&&r.units==='mm-Pa-N','Unsupported native Tet4 record');
 requireValue(typeof r.sourceInputRevision==='string'&&typeof r.meshRevision==='string'&&/^sha256:[a-f0-9]{64}$/.test(r.sourceInputRevision)&&/^sha256:[a-f0-9]{64}$/.test(r.meshRevision),'Native Tet4 revisions required');
 requireValue(finite(r.youngPa)&&r.youngPa>0&&r.youngPa<=NATIVE_TET4_LIMITS.youngPa&&finite(r.poissonRatio)&&r.poissonRatio>-1&&r.poissonRatio<.49,'Invalid native Tet4 material');
 const {nodes,tets,fixedNodes,forces}=r,n=nodes?.length/3;
 requireValue(Array.isArray(nodes)&&Number.isInteger(n)&&n>=4&&n<=NATIVE_TET4_LIMITS.nodes&&nodes.every(x=>finite(x)&&Math.abs(x)<=NATIVE_TET4_LIMITS.coordinateMm),'Invalid native Tet4 coordinates');
 requireValue(Array.isArray(tets)&&tets.length>0&&tets.length<=NATIVE_TET4_LIMITS.elements,'Invalid native Tet4 elements');
 const seen=new Set(),used=new Set(),adj=Array.from({length:n},()=>new Set());
 for(const t of tets){
  requireValue(Array.isArray(t)&&t.length===4&&new Set(t).size===4&&t.every(i=>Number.isInteger(i)&&i>=0&&i<n),'Invalid native Tet4 index');
  const key=[...t].sort((a,b)=>a-b).join(',');requireValue(!seen.has(key),'Duplicate native Tet4 element');seen.add(key);
  const a=nodes.slice(3*t[0],3*t[0]+3),edges=t.slice(1).map(i=>nodes.slice(3*i,3*i+3).map((x,k)=>x-a[k]));
  const s=Math.max(...edges.flat().map(Math.abs));const [u,v,w]=edges.map(e=>e.map(x=>x/s));
  const det=u[0]*(v[1]*w[2]-v[2]*w[1])-u[1]*(v[0]*w[2]-v[2]*w[0])+u[2]*(v[0]*w[1]-v[1]*w[0]);
  requireValue(finite(det)&&det>1e-12,'Degenerate or inverted native Tet4 element');
  for(const i of t){used.add(i);for(const j of t)adj[i].add(j);}
 }
 requireValue(used.size===n,'Unused native Tet4 node');const visited=new Set([0]),pending=[0];while(pending.length)for(const i of adj[pending.pop()])if(!visited.has(i)){visited.add(i);pending.push(i);}requireValue(visited.size===n,'Disconnected native Tet4 mesh');
 requireValue(Array.isArray(fixedNodes)&&fixedNodes.length>=3&&new Set(fixedNodes).size===fixedNodes.length&&fixedNodes.every(i=>Number.isInteger(i)&&i>=0&&i<n),'Invalid native Tet4 fixed nodes');
 const a=nodes.slice(fixedNodes[0]*3,fixedNodes[0]*3+3);let noncollinear=false;
 for(let i=1;i<fixedNodes.length;i++)for(let j=i+1;j<fixedNodes.length;j++){
  const u=nodes.slice(fixedNodes[i]*3,fixedNodes[i]*3+3).map((x,k)=>x-a[k]),v=nodes.slice(fixedNodes[j]*3,fixedNodes[j]*3+3).map((x,k)=>x-a[k]);
  const s=Math.max(...u.map(Math.abs),...v.map(Math.abs)),un=u.map(x=>x/s),vn=v.map(x=>x/s);
  if(Math.hypot(un[1]*vn[2]-un[2]*vn[1],un[2]*vn[0]-un[0]*vn[2],un[0]*vn[1]-un[1]*vn[0])>1e-12)noncollinear=true;
 }
 requireValue(noncollinear,'Native Tet4 fixed nodes must remove rigid-body modes');
 requireValue(Array.isArray(forces)&&forces.length===3*n&&forces.every(x=>finite(x)&&Math.abs(x)<=NATIVE_TET4_LIMITS.forceN),'Invalid native Tet4 nodal forces');
 return r;
}
export async function createNativeTet4Record({input,mesh,fixedNodes,forces}={}){
 ({input,mesh,fixedNodes,forces}=JSON.parse(canonicalJson({input,mesh,fixedNodes,forces}))); // freeze the observed JSON before any hash await
 const validation=createStudioApi();validation.loadProject(input);input=validation.exportProject();
 requireValue(object(input)&&input.version===1&&input.study?.kind==='structural','Native Tet4 supports saved structural input only');
 const m=input.materialProperties;
 requireValue(object(m)&&!['orthotropic','plasticity','hyperelastic'].some(k=>m[k]!==undefined)&&!['modalAnalysis','thermalStress'].some(k=>input.study[k])&&!input.study.gravityEnabled&&!input.study.gravity?.some(x=>x!==0),'Unsupported native Tet4 physics; gravity/temperature/advanced materials are not transferred');
 const r={schemaVersion:2,kind:'prepared-isotropic-tet4',units:'mm-Pa-N',sourceInputRevision:await getProjectRevision(input),meshRevision:await getProjectRevision(mesh),youngPa:m.youngModulus,poissonRatio:m.poissonRatio,nodes:structuredClone(mesh.nodes),tets:structuredClone(mesh.tets),fixedNodes:structuredClone(fixedNodes),forces:structuredClone(forces)};
 return validateNativeTet4Record(r);
}
export async function serializeNativeTet4Record(record){
 const r=validateNativeTet4Record(JSON.parse(canonicalJson(record))),recordRevision=await getProjectRevision(r);
 const wire=['airpocket-native-tet4-v2',recordRevision.slice(7),r.sourceInputRevision.slice(7),r.meshRevision.slice(7),r.youngPa,r.poissonRatio,r.nodes.length/3,r.tets.length,r.fixedNodes.length,...r.nodes,...r.tets.flat(),...r.fixedNodes,...r.forces].join(' ')+'\n';
 requireValue(Buffer.byteLength(wire)<=NATIVE_TET4_LIMITS.inputBytes,'Native Tet4 record exceeds byte limit');
 return {wire,recordRevision};
}
export function verifyNativeTet4Output(output,{record,recordRevision,runtime}){
 validateNativeTet4Record(record);const n=record.nodes.length/3;
 requireValue(output?.schemaVersion===2&&output.kind==='prepared-isotropic-tet4'&&output.runtime===runtime&&output.engine==='mfem-native'&&output.mfemVersion===41000&&output.recordRevision===recordRevision&&output.sourceInputRevision===record.sourceInputRevision&&output.meshRevision===record.meshRevision,'Native Tet4 result identity mismatch');
 requireValue(output.nodeCount===n&&output.elementCount===record.tets.length&&output.units==='m-N'&&output.converged===true,'Native Tet4 result contract mismatch');
 for(const key of ['displacementM','reactionsN'])requireValue(Array.isArray(output[key])&&output[key].length===3*n&&output[key].every(finite),'Invalid native Tet4 result '+key);
 requireValue(Number.isInteger(output.iterations)&&output.iterations>=0&&output.iterations<=2500&&finite(output.verifiedResidual)&&output.verifiedResidual>=0&&output.verifiedResidual<2e-8,'Invalid native Tet4 convergence');
 for(const key of ['appliedN','balanceN'])requireValue(Array.isArray(output[key])&&output[key].length===3&&output[key].every(finite),'Invalid native Tet4 '+key);
 const fixed=new Set(record.fixedNodes);
 for(let node=0;node<n;node++)for(let k=0;k<3;k++)if(fixed.has(node))requireValue(output.displacementM[3*node+k]===0,'Native Tet4 support moved');else requireValue(output.reactionsN[3*node+k]===0,'Native Tet4 unconstrained reaction');
 for(let k=0;k<3;k++){
  const applied=record.forces.reduce((sum,v,i)=>sum+(i%3===k?v:0),0),reaction=output.reactionsN.reduce((sum,v,i)=>sum+(i%3===k?v:0),0),tol=1e-8+Math.abs(applied)*1e-7;
  requireValue(Math.abs(output.appliedN[k]-applied)<=tol&&Math.abs(output.balanceN[k]-(applied+reaction))<=tol&&Math.abs(output.balanceN[k])<=tol,'Native Tet4 force balance failed');
 }
 return output;
}
