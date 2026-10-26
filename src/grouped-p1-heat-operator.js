// Explicit piecewise-planar continuous-P1 outward flux per group, not a coupled solver.
import {buildPlanarP1HeatTransferOperator,applyPlanarP1HeatTransferOperator} from './planar-p1-heat-operator.js';
import {createGroupedInterfaceGeometry} from './grouped-interface-geometry.js';
import {canonicalJson,getProjectRevision,hashCanonicalJson} from './project-revision.js';
export const GROUPED_P1_HEAT_OPERATOR_LIMITS=Object.freeze({groups:8,activeNodesPerSide:128,nodes:4096,facesPerSide:512,terms:16384,sourceValues:1024,bytes:1048576,intersectionToleranceMm:1e-6});
const trusted=new WeakSet(),encoder=new TextEncoder();
const fail=message=>{throw Object.assign(Error(message.replace(/grouped temperature/gi,'grouped P1 heat flux')),{code:'GROUPED_P1_HEAT_OPERATOR_INVALID'});};
const finite=value=>{if(typeof value!=='number'||!Number.isFinite(value))fail('Nonfinite grouped P1 heat flux value');return value;};
const sum=values=>values.reduce((a,b)=>finite(a+b),0),close=(a,b,scale)=>Math.abs(a-b)<=1e-18+1e-12*scale;
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const {snapshot,fields,bounded,geometry,rejectCrossGroupIntersections,ids}=createGroupedInterfaceGeometry(fail);
const localGeometry=(g,group)=>({units:g.units,mesh:g.mesh,sourceFaces:group.sourceFaceIds.map(id=>g.sourceFaces[id]),targetFaces:group.targetFaceIds.map(id=>g.targetFaces[id])});
/** Reuse the unchanged per-plane P1 integration, then scatter by global target IDs.
 * Group-normal scalar flux may jump across a crease; it is never averaged there. */
export async function buildGroupedP1HeatTransferOperator(input){
 const g=geometry(input),groups=[];let termCount=0;
 for(const group of g.groups){const operator=await buildPlanarP1HeatTransferOperator(localGeometry(g,group)),terms=sum(operator.rows.map(row=>row.terms.length));if(termCount+terms>16384)fail('Grouped P1 coefficient capacity exceeded');termCount+=terms;groups.push({...group,operator});}
 rejectCrossGroupIntersections(g);
 const payload={schemaVersion:1,kind:'grouped-planar-p1-heat-transfer',solverConnected:false,units:{length:'mm',flux:'W/m2',load:'W',coefficient:'m2'},sourceValuePolicy:'group-local-outward-P1',targetLoadPolicy:'global-node-sum',geometryRevision:await getProjectRevision(g),coveredAreaM2:sum(groups.map(group=>group.operator.coveredAreaM2)),targetNodeIds:ids(g.targetFaces),termCount,groups};bounded(canonicalJson(payload));const operator={...payload,operatorRevision:await getProjectRevision(payload)};bounded(canonicalJson(operator));freeze(operator);trusted.add(operator);return operator;
}
export function serializeGroupedP1HeatTransferOperator(operator){if(!trusted.has(operator))fail('Trusted grouped P1 heat operator required');return bounded(canonicalJson(operator));}
function jsonDepth(raw){let depth=0,quoted=false;for(let i=0;i<raw.length;i++){const c=raw[i];if(quoted){if(c==='\\')i++;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='['||c==='{'){if(++depth>20)fail('Grouped P1 JSON depth exceeded');}else if(c===']'||c==='}')depth--;}}
/** Hash agreement is not trust: every local coefficient/group identity is rebuilt. */
export async function loadGroupedP1HeatTransferOperator(raw,input){if(typeof raw!=='string')fail('Grouped P1 JSON string required');bounded(raw);jsonDepth(raw);const g=geometry(input);let received;try{received=snapshot(JSON.parse(raw));}catch{fail('Invalid grouped P1 operator JSON');}const operator=await buildGroupedP1HeatTransferOperator(g);if(canonicalJson(received)!==canonicalJson(operator))fail('Grouped P1 coefficients/groups/geometry differ');return freeze({operator,source:{bytes:encoder.encode(raw).length,rawIdentity:await hashCanonicalJson(raw),meaning:'input-operator-JSON-identity-not-authentication'}});}
function fieldSnapshot(operator,input){
 const field=snapshot(input);fields(field,['units','groups']);if(field.units!=='W/m2'||!Array.isArray(field.groups)||field.groups.length!==operator.groups.length)fail('One W/m2 field per group required');const seen=new Set(),byName=new Map(operator.groups.map(g=>[g.groupId,g]));let count=0;
 for(const row of field.groups){fields(row,['groupId','values']);const group=byName.get(row.groupId);if(typeof row.groupId!=='string'||!group||seen.has(row.groupId)||!Array.isArray(row.values)||row.values.length!==group.operator.sourceWeights.length)fail('Invalid or duplicate grouped flux field');seen.add(row.groupId);const nodes=new Set(group.operator.sourceWeights.map(w=>w.nodeId)),seenNodes=new Set();for(const entry of row.values){fields(entry,['nodeId','value']);if(!Number.isSafeInteger(entry.nodeId)||!nodes.has(entry.nodeId)||seenNodes.has(entry.nodeId))fail('Unknown or duplicate group-local flux node');seenNodes.add(entry.nodeId);finite(entry.value);if(++count>1024)fail('Grouped flux source value capacity exceeded');}row.values.sort((a,b)=>a.nodeId-b.nodeId);}
 field.groups.sort((a,b)=>a.groupId<b.groupId?-1:a.groupId>b.groupId?1:0);bounded(canonicalJson(field));return field;
}
/** Positive source-outward heat rate becomes positive target applied nodal load.
 * The target-outward sign is its negative; this is heat-rate (W), not energy (J). */
export async function applyGroupedP1HeatTransferOperator(operator,input,rawField){
 if(!trusted.has(operator))fail('Trusted grouped P1 heat operator required');const g=geometry(input),field=fieldSnapshot(operator,rawField),[geometryRevision,fluxRevision]=await Promise.all([getProjectRevision(g),getProjectRevision(field)]);if(geometryRevision!==operator.geometryRevision)fail('Grouped P1 geometry revision mismatch');
 const byName=new Map(field.groups.map(group=>[group.groupId,group])),nodeHeatW=new Map(operator.targetNodeIds.map(id=>[id,0])),groups=[],scales=[];
 for(const group of operator.groups){const q=byName.get(group.groupId),values=new Map(q.values.map(row=>[row.nodeId,row.value])),local=await applyPlanarP1HeatTransferOperator(group.operator,localGeometry(g,group),{units:'W/m2',values:q.values});for(const [id,value]of local.nodeHeatW)nodeHeatW.set(id,finite(nodeHeatW.get(id)+value));for(const w of group.operator.sourceWeights)scales.push(Math.abs(finite(w.areaM2*values.get(w.nodeId))));for(const row of group.operator.rows)for(const t of row.terms)scales.push(Math.abs(finite(t.coefficientM2*values.get(t.sourceNodeId))));groups.push({groupId:group.groupId,coveredAreaM2:group.operator.coveredAreaM2,fluxRevision:local.fluxRevision,sourceOutwardW:local.sourceW,targetLoadW:local.targetW,targetOutwardW:local.targetOutwardW,closureErrorW:local.balanceErrorW});}
 const sourceOutwardW=sum(groups.map(group=>group.sourceOutwardW)),targetLoadW=sum([...nodeHeatW.values()]),targetOutwardW=finite(-targetLoadW),scale=sum(scales),closureErrorW=finite(sourceOutwardW+targetOutwardW);if(!close(sourceOutwardW,targetLoadW,scale))fail('Grouped P1 heat-rate conservation failed');return {operatorRevision:operator.operatorRevision,geometryRevision,fluxRevision,coveredAreaM2:operator.coveredAreaM2,sourceOutwardW,targetLoadW,targetOutwardW,closureErrorW,groups,nodeHeatW,solverConnected:false};
}
