// Bounded persisted factorization of the existing facet-fixed pressure operator.
// Not a smooth-surface projection, P1 pressure field, or coupled solver.
import {pressureNodalForces} from './curved-pressure-transfer.js';
import {canonicalJson,getProjectRevision,hashCanonicalJson} from './project-revision.js';
export const CURVED_PRESSURE_OPERATOR_LIMITS=Object.freeze({nodes:4096,faces:512,bytes:1048576,coordinateMm:1e6,values:100000,depth:12});
const issued=new WeakSet(),encoder=new TextEncoder();
const fail=message=>{throw Object.assign(Error(message),{code:'CURVED_PRESSURE_OPERATOR_INVALID'});};
const finite=value=>{if(typeof value!=='number'||!Number.isFinite(value))throw Object.assign(Error('Curved operator numeric range exceeded'),{code:'CURVED_PRESSURE_OPERATOR_NUMERIC_LIMIT'});return value;};
function fields(value,keys){
 if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)fail('Plain exact data record required');
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('Missing, extra or accessor field');}
}
function snapshot(value,depth=0,budget={count:0}){
 if(++budget.count>CURVED_PRESSURE_OPERATOR_LIMITS.values||depth>CURVED_PRESSURE_OPERATOR_LIMITS.depth)fail('Data graph capacity exceeded');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number')return finite(value);
 if(typeof value==='string'){if(value.length>256)fail('String capacity exceeded');return value;}
 if(Array.isArray(value)){
  if(Object.getPrototypeOf(value)!==Array.prototype||value.length>3*CURVED_PRESSURE_OPERATOR_LIMITS.nodes||Reflect.ownKeys(value).length!==value.length+1)fail('Bounded ordinary dense array required');
  const result=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('Array accessors or holes unsupported');result.push(snapshot(d.value,depth+1,budget));}return result;
 }
 if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length>24)fail('Plain bounded record required');
 const result=Object.create(null);for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))fail('Data properties required');result[key]=snapshot(d.value,depth+1,budget);}return result;
}
function bytes(raw){if(raw.length>CURVED_PRESSURE_OPERATOR_LIMITS.bytes||encoder.encode(raw).length>CURVED_PRESSURE_OPERATOR_LIMITS.bytes)fail('Operator byte capacity exceeded');return raw;}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function geometrySnapshot(input){
 fields(input,['lengthUnit','surface','nodes','triangles']);
 if(!Array.isArray(input.nodes)||input.nodes.length<9||input.nodes.length%3||input.nodes.length>3*CURVED_PRESSURE_OPERATOR_LIMITS.nodes||!Array.isArray(input.triangles)||!input.triangles.length||input.triangles.length>CURVED_PRESSURE_OPERATOR_LIMITS.faces)fail('Geometry capacity exceeded');
 const g=snapshot(input);
 if(g.lengthUnit!=='mm'||!['open','closed'].includes(g.surface)||g.nodes.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>CURVED_PRESSURE_OPERATOR_LIMITS.coordinateMm))fail('Explicit finite mm geometry required');
 // Index, degeneracy, duplicate and closed-shell orientation checks are the
 // existing public geometry contract; zero pressure is only a geometry probe.
 const reference=pressureNodalForces({...g,pressureUnit:'Pa',pressure:g.triangles.map(()=>({real:0,imag:0}))});
 bytes(canonicalJson(g));return {g,reference};
}
function pressureSnapshot(input,count){fields(input,['units','values']);if(!Array.isArray(input.values)||input.values.length!==count)fail('One complex pressure per face required');const q=snapshot(input);if(q.units!=='Pa')fail('Pressure units must be Pa');for(const value of q.values){fields(value,['real','imag']);finite(value.real);finite(value.imag);}return q;}
function displacementSnapshot(input,count){fields(input,['units','real','imag']);if(!Array.isArray(input.real)||!Array.isArray(input.imag)||input.real.length!==count*3||input.imag.length!==count*3)fail('One complex displacement per node/component required');const u=snapshot(input);if(u.units!=='m')fail('Displacement units must be m');u.real.forEach(finite);u.imag.forEach(finite);return u;}
const requireIssued=operator=>{if(!issued.has(operator))fail('Build or load an issued immutable operator first');};
const verifyGeometry=(operator,revision)=>{if(operator.geometryRevision!==revision)fail('Geometry identity mismatch');};
const total=values=>values.reduce((sum,value)=>finite(sum+value),0);
const cross=(a,b)=>[finite(a[1]*b[2]-a[2]*b[1]),finite(a[2]*b[0]-a[0]*b[2]),finite(a[0]*b[1]-a[1]*b[0])];

/** The factored weight and normal preserve the existing multiplication order;
 * eagerly multiplying tiny normal components into weights can underflow. */
export async function buildCurvedPressureTransferOperator(input){
 const {g,reference}=geometrySnapshot(input),faces=g.triangles.map((nodeIds,faceIndex)=>{
  const areaMm2=reference.areasMm2[faceIndex],areaWeightM2=finite(areaMm2*1e-6/3);if(!(areaMm2>0&&areaWeightM2>0))fail('Unrepresentable positive facet area');
  return {faceIndex,nodeIds:[...nodeIds],outwardNormal:[...reference.normals[faceIndex]],areaMm2,areaWeightM2};
 });
 const payload={schemaVersion:1,kind:'facet-fixed-complex-pressure-operator',geometryRevision:await getProjectRevision(g),nodeCount:g.nodes.length/3,surface:g.surface,units:{length:'mm',pressure:'Pa',displacement:'m',force:'N',moment:'Nm',volume:'m3',work:'J',weight:'m2'},faces,scope:{pressure:'constant-complex-per-oriented-facet',transpose:'same-area-third-weights',normal:'declared-winding-no-auto-flip',solverConnected:false,smoothSurfaceAccuracy:false}};
 const operator={...payload,operatorRevision:await getProjectRevision(payload)};bytes(canonicalJson(operator));freeze(operator);issued.add(operator);return operator;
}
export function serializeCurvedPressureTransferOperator(operator){requireIssued(operator);return bytes(canonicalJson(operator));}
function checkDepth(raw){let depth=0,inString=false;for(let i=0;i<raw.length;i++){const c=raw[i];if(inString){if(c==='\\')i++;else if(c==='"')inString=false;}else if(c==='"')inString=true;else if(c==='['||c==='{'){if(++depth>CURVED_PRESSURE_OPERATOR_LIMITS.depth)fail('JSON depth capacity exceeded');}else if(c===']'||c==='}')depth--;}}
/** Hashes identify bytes, not authorship. Persisted factors are fully rederived. */
export async function loadCurvedPressureTransferOperator(raw,input){
 if(typeof raw!=='string')fail('Operator JSON text required');bytes(raw);checkDepth(raw);const {g}=geometrySnapshot(input);let parsed;try{parsed=JSON.parse(raw);}catch{fail('Invalid operator JSON');}
 const record=snapshot(parsed);if(!record||typeof record!=='object'||Array.isArray(record))fail('Operator record required');const {operatorRevision,...payload}=record;
 if(typeof operatorRevision!=='string'||operatorRevision!==await getProjectRevision(payload))fail('Operator revision mismatch');
 const operator=await buildCurvedPressureTransferOperator(g);if(canonicalJson(record)!==canonicalJson(operator))fail('Persisted operator differs from geometry or supported contract');
 return freeze({operator,source:{bytes:encoder.encode(raw).length,rawIdentity:await hashCanonicalJson(raw),meaning:'input-JSON-identity-not-authentication'}});
}
function forces(operator,g,q){
 const forceReal=Array(operator.nodeCount*3).fill(0),forceImag=Array(operator.nodeCount*3).fill(0);
 for(const f of operator.faces)for(const component of ['real','imag']){const target=component==='real'?forceReal:forceImag,weighted=finite(-f.areaWeightM2*q.values[f.faceIndex][component]);for(const node of f.nodeIds)for(let k=0;k<3;k++)target[3*node+k]=finite(target[3*node+k]+finite(weighted*f.outwardNormal[k]));}
 const resultantReal=[0,0,0],resultantImag=[0,0,0],momentReal=[0,0,0],momentImag=[0,0,0];
 for(let node=0;node<operator.nodeCount;node++){
  const r=g.nodes.slice(3*node,3*node+3).map(v=>finite(v*1e-3));
  for(const [values,resultant,moment]of [[forceReal,resultantReal,momentReal],[forceImag,resultantImag,momentImag]]){const f=values.slice(3*node,3*node+3),m=cross(r,f);for(let k=0;k<3;k++){resultant[k]=finite(resultant[k]+f[k]);moment[k]=finite(moment[k]+m[k]);}}
 }
 return {forceReal,forceImag,resultantReal,resultantImag,momentReal,momentImag,totalAreaMm2:total(operator.faces.map(f=>f.areaMm2)),units:{force:'N',moment:'Nm'}};
}
function transpose(operator,u){
 const volumeReal=[],volumeImag=[];
 for(const f of operator.faces)for(const [component,target]of [['real',volumeReal],['imag',volumeImag]]){let value=0;for(const node of f.nodeIds)for(let k=0;k<3;k++)value=finite(value+finite(finite(f.areaWeightM2*u[component][3*node+k])*f.outwardNormal[k]));target.push(value);}
 return {volumeReal,volumeImag,totalVolumeReal:total(volumeReal),totalVolumeImag:total(volumeImag),unit:'m3'};
}
export async function applyCurvedPressureTransferOperator(operator,input,pressure){
 requireIssued(operator);const {g}=geometrySnapshot(input),q=pressureSnapshot(pressure,operator.faces.length),[geometryRevision,pressureRevision]=await Promise.all([getProjectRevision(g),getProjectRevision(q)]);verifyGeometry(operator,geometryRevision);
 return {operatorRevision:operator.operatorRevision,geometryRevision,pressureRevision,...forces(operator,g,q)};
}
export async function applyCurvedPressureTranspose(operator,input,displacement){
 requireIssued(operator);const {g}=geometrySnapshot(input),u=displacementSnapshot(displacement,operator.nodeCount),[geometryRevision,displacementRevision]=await Promise.all([getProjectRevision(g),getProjectRevision(u)]);verifyGeometry(operator,geometryRevision);
 return {operatorRevision:operator.operatorRevision,geometryRevision,displacementRevision,...transpose(operator,u)};
}
/** Sum conj(u).f = -sum p*conj(integral u.n dA), with both components in J. */
export async function evaluateCurvedPressureVirtualWork(operator,input,pressure,displacement){
 requireIssued(operator);const {g}=geometrySnapshot(input),q=pressureSnapshot(pressure,operator.faces.length),u=displacementSnapshot(displacement,operator.nodeCount),[geometryRevision,pressureRevision,displacementRevision]=await Promise.all([getProjectRevision(g),getProjectRevision(q),getProjectRevision(u)]);verifyGeometry(operator,geometryRevision);
 const f=forces(operator,g,q),v=transpose(operator,u),nodal={real:0,imag:0},face={real:0,imag:0};let scale=0;
 const add=(object,key,term)=>{term=finite(term);object[key]=finite(object[key]+term);scale=finite(scale+Math.abs(term));};
 for(let i=0;i<f.forceReal.length;i++){add(nodal,'real',u.real[i]*f.forceReal[i]);add(nodal,'real',u.imag[i]*f.forceImag[i]);add(nodal,'imag',u.real[i]*f.forceImag[i]);add(nodal,'imag',-u.imag[i]*f.forceReal[i]);}
 for(let i=0;i<q.values.length;i++){add(face,'real',-q.values[i].real*v.volumeReal[i]);add(face,'real',-q.values[i].imag*v.volumeImag[i]);add(face,'imag',-q.values[i].imag*v.volumeReal[i]);add(face,'imag',q.values[i].real*v.volumeImag[i]);}
 const absoluteErrorJ=finite(Math.hypot(finite(nodal.real-face.real),finite(nodal.imag-face.imag))),relativeErrorJ=finite(scale>0?absoluteErrorJ/scale:absoluteErrorJ);
 if(absoluteErrorJ>1e-18+1e-12*scale)fail('Conjugate virtual work does not balance');
 return {operatorRevision:operator.operatorRevision,geometryRevision,pressureRevision,displacementRevision,nodalWork:nodal,pressureWork:face,absoluteErrorJ,relativeErrorJ,scaleJ:scale,unit:'J'};
}
