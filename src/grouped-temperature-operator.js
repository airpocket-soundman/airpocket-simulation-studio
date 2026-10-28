// Explicit piecewise-planar P1 temperature projection. No surface inference or coupled solver.
import {buildPlanarTemperatureOperator} from './planar-temperature-operator.js';
import {canonicalJson,getProjectRevision,hashCanonicalJson} from './project-revision.js';
import {createGroupedInterfaceGeometry} from './grouped-interface-geometry.js';
export const GROUPED_TEMPERATURE_OPERATOR_LIMITS=Object.freeze({groups:8,activeNodesPerSide:128,nodes:4096,facesPerSide:512,bytes:1048576,conditionInfinity:1e10,intersectionToleranceMm:1e-6});
const trusted=new WeakSet(),encoder=new TextEncoder();
const fail=message=>{throw Object.assign(Error(message),{code:'GROUPED_TEMPERATURE_OPERATOR_INVALID'});};
const finite=x=>{if(typeof x!=='number'||!Number.isFinite(x))fail('Nonfinite grouped temperature projection value');return x;};
const {snapshot,fields,bounded,geometry,rejectCrossGroupIntersections,ids}=createGroupedInterfaceGeometry(fail);
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const sum=a=>a.reduce((s,v)=>finite(s+v),0);
function solve(L,b){const n=b.length,y=Array(n),x=Array(n);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s=finite(s-L[i][j]*y[j]);y[i]=finite(s/L[i][i]);}for(let i=n-1;i>=0;i--){let s=y[i];for(let j=i+1;j<n;j++)s=finite(s-L[j][i]*x[j]);x[i]=finite(s/L[i][i]);}return x;}
function factor(M){const n=M.length,L=Array.from({length:n},()=>Array(n).fill(0));for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=M[i][j];for(let k=0;k<j;k++)s=finite(s-L[i][k]*L[j][k]);if(i===j){if(!(s>0))fail('Temperature mass is not positive definite');L[i][j]=Math.sqrt(s);}else L[i][j]=finite(s/L[j][j]);}return L;}

export async function buildGroupedTemperatureOperator(input){
 const g=geometry(input),sourceIds=ids(g.sourceFaces),targetIds=ids(g.targetFaces),sourceIndex=new Map(sourceIds.map((id,i)=>[id,i])),targetIndex=new Map(targetIds.map((id,i)=>[id,i]));
 // Each group retains the existing plane/full-coverage/opposing-normal gates.
 const compiled=[];for(const group of g.groups){const local={units:g.units,mesh:g.mesh,sourceFaces:group.sourceFaceIds.map(id=>g.sourceFaces[id]),targetFaces:group.targetFaceIds.map(id=>g.targetFaces[id])};compiled.push({group,operator:await buildPlanarTemperatureOperator(local)});}
 rejectCrossGroupIntersections(g);
 const area=sum(compiled.map(c=>c.operator.coveredAreaM2)),n=targetIds.length,M=Array.from({length:n},()=>Array(n).fill(0)),T=Array.from({length:n},()=>Array(sourceIds.length).fill(0)),weights=Array(sourceIds.length).fill(0);
 // Assemble matrices, never local projected temperatures or averaged shared nodes.
 for(const {operator:o}of compiled){const fraction=o.coveredAreaM2/area;for(let i=0;i<o.rows.length;i++){const row=targetIndex.get(o.rows[i].nodeId);for(let j=0;j<o.rows.length;j++){const col=targetIndex.get(o.rows[j].nodeId);M[row][col]=finite(M[row][col]+o.massNormalized[i][j]*fraction);}for(let j=0;j<o.sourceIds.length;j++){const col=sourceIndex.get(o.sourceIds[j]);T[row][col]=finite(T[row][col]+o.crossNormalized[i][j]*fraction);}}for(const w of o.sourceWeights){const col=sourceIndex.get(w.nodeId);weights[col]=finite(weights[col]+w.areaM2);}}
 const L=factor(M),inverse=Array.from({length:n},(_,j)=>solve(L,Array.from({length:n},(_,i)=>i===j?1:0))),conditionInfinity=finite(Math.max(...M.map(r=>sum(r.map(Math.abs))))*Math.max(...M.map((_,i)=>sum(inverse.map(col=>Math.abs(col[i]))))));if(conditionInfinity>1e10)fail('Grouped temperature mass conditioning exceeds limit');
 const columns=sourceIds.map((_,j)=>solve(L,T.map(row=>row[j]))),rows=targetIds.map((nodeId,i)=>({nodeId,coefficients:columns.map(col=>col[i])}));
 for(let i=0;i<n;i++)for(let j=0;j<sourceIds.length;j++)if(Math.abs(sum(M[i].map((v,k)=>finite(v*columns[j][k])))-T[i][j])>1e-12*Math.max(1,Math.abs(T[i][j])))fail('Grouped temperature matrix residual exceeded');
 const payload={schemaVersion:1,kind:'grouped-planar-p1-temperature-l2',solverConnected:false,units:{length:'mm',mass:'m2',coefficient:'dimensionless'},geometryRevision:await getProjectRevision(g),groups:compiled.map(({group,operator:o})=>({...group,operatorRevision:o.operatorRevision,coveredAreaM2:o.coveredAreaM2})),coveredAreaM2:area,sourceIds,sourceWeights:sourceIds.map((nodeId,i)=>({nodeId,areaM2:weights[i]})),targetWeights:targetIds.map((nodeId,i)=>({nodeId,areaM2:finite(sum(M[i])*area)})),massNormalized:M,crossNormalized:T,conditionInfinity,rows},op={...payload,operatorRevision:await getProjectRevision(payload)};bounded(canonicalJson(op));freeze(op);trusted.add(op);return op;
}
export function serializeGroupedTemperatureOperator(op){if(!trusted.has(op))fail('Trusted grouped temperature operator required');return bounded(canonicalJson(op));}
export async function loadGroupedTemperatureOperator(raw,input){
 if(typeof raw!=='string')fail('Grouped temperature JSON required');bounded(raw);let depth=0,quoted=false;for(let i=0;i<raw.length;i++){if(quoted){if(raw[i]==='\\')i++;else if(raw[i]==='"')quoted=false;}else if(raw[i]==='"')quoted=true;else if(raw[i]==='['||raw[i]==='{'){if(++depth>20)fail('Grouped JSON depth exceeded');}else if(raw[i]===']'||raw[i]==='}')depth--;}
 const g=geometry(input);let received;try{received=snapshot(JSON.parse(raw));}catch{fail('Invalid grouped operator JSON');}const op=await buildGroupedTemperatureOperator(g);if(canonicalJson(received)!==canonicalJson(op))fail('Grouped coefficients/assignments/geometry differ');return freeze({operator:op,source:{bytes:encoder.encode(raw).length,rawIdentity:await hashCanonicalJson(raw),meaning:'input-operator-JSON-identity-not-authentication'}});
}
export async function applyGroupedTemperatureOperator(op,input,field){
 if(!trusted.has(op))fail('Trusted grouped temperature operator required');const g=geometry(input),q=snapshot(field);fields(q,['units','values']);if(!['degC','K'].includes(q.units)||!Array.isArray(q.values)||q.values.length!==op.sourceIds.length)fail('Homogeneous degC or K field required');const values=new Map(),minimum=q.units==='K'?0:-273.15;
 for(const r of q.values){fields(r,['nodeId','value']);if(!op.sourceIds.includes(r.nodeId)||values.has(r.nodeId)||finite(r.value)<minimum||Math.abs(r.value)>Number.MAX_VALUE/(128*1e10))fail('Invalid grouped temperature node/value');values.set(r.nodeId,r.value);}q.values.sort((a,b)=>a.nodeId-b.nodeId);
 const rebuilt=await buildGroupedTemperatureOperator(g);if(rebuilt.operatorRevision!==op.operatorRevision)fail('Grouped geometry revision mismatch');const x=op.sourceIds.map(id=>values.get(id)),y=op.rows.map(r=>sum(r.coefficients.map((v,j)=>finite(v*x[j]))));if(y.some(v=>v<minimum-1e-10))fail('Projected temperature below absolute zero');
 const residual=op.massNormalized.map((r,i)=>finite(sum(r.map((v,j)=>finite(v*y[j])))-sum(op.crossNormalized[i].map((v,j)=>finite(v*x[j]))))),scale=Math.max(1,...x.map(Math.abs),...y.map(Math.abs));if(residual.some(v=>Math.abs(v)>1e-10*scale))fail('Grouped temperature residual exceeded');const sourceIntegral=sum(op.sourceWeights.map(w=>finite(w.areaM2*values.get(w.nodeId)))),targetIntegral=sum(op.targetWeights.map((w,i)=>finite(w.areaM2*y[i])));if(Math.abs(sourceIntegral-targetIntegral)>1e-10*op.coveredAreaM2*scale)fail('Grouped area-temperature integral differs');
 return {operatorRevision:op.operatorRevision,geometryRevision:op.geometryRevision,fieldRevision:await getProjectRevision(q),coveredAreaM2:op.coveredAreaM2,units:q.units,integralUnits:q.units+'*m2',sourceIntegral,targetIntegral,maxNormalizedResidual:Math.max(...residual.map(Math.abs)),values:op.rows.map((r,i)=>({nodeId:r.nodeId,value:y[i]})),solverConnected:false};
}
