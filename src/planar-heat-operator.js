// Persistable affine heat-flux operator. No thermal/flow iteration or material inference.
import {planarHeatTransfer} from './planar-heat-transfer.js';
import {canonicalJson,getProjectRevision} from './project-revision.js';
export const PLANAR_HEAT_OPERATOR_LIMITS=Object.freeze({nodes:4096,facesPerSide:512,bytes:1048576,coordinateMm:1e6});
const trusted=new WeakSet(),encoder=new TextEncoder();
const fail=message=>{throw Object.assign(Error(message),{code:'PLANAR_HEAT_OPERATOR_INVALID'});};
const fields=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail('Unsupported planar heat operator fields');};
const finite=v=>{if(typeof v!=='number'||!Number.isFinite(v))fail('Nonfinite planar heat operator value');return v;};
const checkBytes=text=>{if(text.length>PLANAR_HEAT_OPERATOR_LIMITS.bytes||encoder.encode(text).length>PLANAR_HEAT_OPERATOR_LIMITS.bytes)fail('Planar heat operator byte capacity exceeded');return text;};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};

function geometrySnapshot(g){
 fields(g,['units','mesh','sourceFaces','targetFaces']);fields(g.mesh,['nodes']);
 if(g.units!=='mm')fail('Planar heat operator geometry units must be mm');
 const nodes=g.mesh.nodes,n=nodes?.length/3;
 if(!Array.isArray(nodes)||!Number.isInteger(n)||n<6||n>PLANAR_HEAT_OPERATOR_LIMITS.nodes||nodes.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>PLANAR_HEAT_OPERATOR_LIMITS.coordinateMm))fail('Invalid or oversized planar heat operator coordinates');
 for(const faces of [g.sourceFaces,g.targetFaces]){
  if(!Array.isArray(faces)||!faces.length||faces.length>PLANAR_HEAT_OPERATOR_LIMITS.facesPerSide)fail('Planar heat operator face capacity exceeded');
  for(const f of faces){fields(f,['nodes']);if(!Array.isArray(f.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||f.nodes.some(id=>!Number.isInteger(id)||id<0||id>=n))fail('Invalid planar heat operator face');}
 }
 // Full coverage requires matching global bounds. Check this before the legacy
 // overlap grid: equal-area but extremely long/thin disjoint shapes could
 // otherwise enumerate an enormous source grid despite bounded face counts.
 const bounds=faces=>faces.flatMap(f=>f.nodes).reduce((box,id)=>box.map(([lo,hi],k)=>[Math.min(lo,nodes[3*id+k]),Math.max(hi,nodes[3*id+k])]),[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]]);
 const sourceBounds=bounds(g.sourceFaces),targetBounds=bounds(g.targetFaces);
 if(sourceBounds.some((pair,k)=>pair.some((value,j)=>Math.abs(value-targetBounds[k][j])>1e-6)))fail('Heat operator requires full matching coverage bounds');
 const json=checkBytes(canonicalJson(g));return JSON.parse(json);
}
const sideIdentity=(g,faces)=>({units:g.units,faces,nodeCoordinates:[...new Set(faces.flatMap(f=>f.nodes))].sort((a,b)=>a-b).map(id=>({id,positionMm:g.mesh.nodes.slice(3*id,3*id+3)}))});
const revisions=async g=>Promise.all([getProjectRevision(sideIdentity(g,g.sourceFaces)),getProjectRevision(sideIdentity(g,g.targetFaces))]);
const sum=values=>finite(values.reduce((a,b)=>finite(a+b),0));
const close=(a,b,scale=Math.max(Math.abs(a),Math.abs(b)))=>Math.abs(a-b)<=1e-18+1e-12*scale;

/** Compile exact constant/global-affine flux moments using the existing overlap integrator. */
export async function buildPlanarHeatTransferOperator(geometry){
 const g=geometrySnapshot(geometry); // snapshot before all hash awaits
 const basis=[1,{base:0,gradient:[1,0,0]},{base:0,gradient:[0,1,0]},{base:0,gradient:[0,0,1]}];
 const transfers=basis.map(flux=>planarHeatTransfer(g.mesh,g.sourceFaces,g.targetFaces,flux));
 const targetIds=[...transfers[0].nodeHeatW.keys()].sort((a,b)=>a-b);
 const rows=targetIds.map(nodeId=>({nodeId,coefficients:transfers.map(r=>finite(r.nodeHeatW.get(nodeId)))}));
 const sourceCoefficients=transfers.map(r=>finite(r.sourceW));
 for(let k=0;k<4;k++)if(!close(sourceCoefficients[k],sum(rows.map(r=>r.coefficients[k])),sum(rows.map(r=>Math.abs(r.coefficients[k])))))fail('Compiled heat operator violates conservation');
 const [sourceGeometryRevision,targetGeometryRevision]=await revisions(g);
 const payload={schemaVersion:1,kind:'planar-affine-heat-transfer',units:{length:'mm',flux:'W/m2',gradient:'W/m3',load:'W'},basis:['1','x_m','y_m','z_m'],toleranceMm:1e-6,coverageTolerance:1e-6,sourceGeometryRevision,targetGeometryRevision,coveredAreaM2:finite(transfers[0].coveredAreaM2),sourceCoefficients,rows};
 const record={...payload,operatorRevision:await getProjectRevision(payload)};
 checkBytes(canonicalJson(record));freeze(record);trusted.add(record);return record;
}

/** Serialize only validated immutable operators. Hashes identify bytes, not authorship. */
export function serializePlanarHeatTransferOperator(operator){
 if(!trusted.has(operator))fail('Build or load a validated heat operator first');
 return checkBytes(canonicalJson(operator));
}

/** Untrusted persisted rows are rederived once from supplied geometry, even if
 * somebody recomputed their hash. No caller-provided coefficients become trusted.
 */
export async function loadPlanarHeatTransferOperator(raw,geometry){
 if(typeof raw!=='string')fail('Heat operator JSON text required');checkBytes(raw);
 const g=geometrySnapshot(geometry);
 let record;try{record=JSON.parse(raw);}catch{fail('Invalid heat operator JSON');}
 if(!record||typeof record!=='object'||Array.isArray(record))fail('Invalid heat operator record');
 const {operatorRevision,...payload}=record;
 if(typeof operatorRevision!=='string'||operatorRevision!==await getProjectRevision(payload))fail('Heat operator revision mismatch');
 const expected=await buildPlanarHeatTransferOperator(g);
 if(canonicalJson(record)!==canonicalJson(expected))fail('Persisted heat operator does not match its geometry or supported contract');
 return expected;
}

/** Apply affine coefficients after source and target geometry identity checks. */
export async function applyPlanarHeatTransferOperator(operator,geometry,flux){
 if(!trusted.has(operator))fail('Build or load a validated heat operator first');
 const g=geometrySnapshot(geometry);let weights;
 if(typeof flux==='number')weights=[finite(flux),0,0,0];
 else{
  if(!flux||typeof flux!=='object'||Array.isArray(flux)||Object.keys(flux).some(k=>!['base','gradient'].includes(k)))fail('Only constant or global affine heat flux is supported');
  const gradient=flux.gradient===undefined?[0,0,0]:flux.gradient;
  if(!Array.isArray(gradient)||gradient.length!==3)fail('Three global affine gradient components required');
  weights=[finite(flux.base),...gradient.map(finite)];
 }
 const [sourceRevision,targetRevision]=await revisions(g);
 if(sourceRevision!==operator.sourceGeometryRevision||targetRevision!==operator.targetGeometryRevision)fail('Heat operator source/target geometry identity mismatch');
 const dot=coefficients=>sum(coefficients.map((c,k)=>finite(c*weights[k])));
 const nodeHeatW=new Map(operator.rows.map(row=>[row.nodeId,dot(row.coefficients)]));
 const sourceW=dot(operator.sourceCoefficients),targetW=sum([...nodeHeatW.values()]);
 // Include term magnitudes so cancellation-dominated affine fields receive a
 // roundoff bound, not an arbitrary percentage of a near-zero final total.
 const scale=sum(operator.rows.flatMap(row=>row.coefficients.map((c,k)=>Math.abs(finite(c*weights[k])))));
 if(!close(sourceW,targetW,scale))fail('Applied heat operator violates conservation');
 return {operatorRevision:operator.operatorRevision,coveredAreaM2:operator.coveredAreaM2,sourceW,targetW,targetOutwardW:-targetW,balanceErrorW:finite(sourceW-targetW),nodeHeatW};
}
