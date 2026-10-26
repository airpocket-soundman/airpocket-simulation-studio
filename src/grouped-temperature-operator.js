// Explicit piecewise-planar P1 temperature projection. No surface inference or coupled solver.
import {buildPlanarTemperatureOperator} from './planar-temperature-operator.js';
import {canonicalJson,getProjectRevision,hashCanonicalJson} from './project-revision.js';
import {clipPolygon,cross2,sub2} from './triangle-overlap.js';
export const GROUPED_TEMPERATURE_OPERATOR_LIMITS=Object.freeze({groups:8,activeNodesPerSide:128,nodes:4096,facesPerSide:512,bytes:1048576,conditionInfinity:1e10,intersectionToleranceMm:1e-6});
const trusted=new WeakSet(),encoder=new TextEncoder();
const fail=message=>{throw Object.assign(Error(message),{code:'GROUPED_TEMPERATURE_OPERATOR_INVALID'});};
const finite=x=>{if(typeof x!=='number'||!Number.isFinite(x))fail('Nonfinite grouped temperature projection value');return x;};
function snapshot(value,depth=0,budget={n:0}){if(depth>20||++budget.n>200000)fail('grouped temperature graph capacity exceeded');if(value===null||typeof value==='boolean')return value;if(typeof value==='number')return finite(value);if(typeof value==='string'){if(value.length>1024)fail('grouped temperature string capacity exceeded');return value;}if(Array.isArray(value)){if(Object.getPrototypeOf(value)!==Array.prototype||value.length>16384||Reflect.ownKeys(value).length!==value.length+1)fail('Ordinary dense grouped temperature arrays required');const out=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('grouped temperature data array required');out.push(snapshot(d.value,depth+1,budget));}return out;}if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length>32)fail('grouped temperature plain data required');const out=Object.create(null);for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))fail('grouped temperature data property required');out[key]=snapshot(d.value,depth+1,budget);}return out;}
function fields(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail('Unsupported grouped temperature fields');}
const bounded=text=>{if(text.length>1048576||encoder.encode(text).length>1048576)fail('grouped temperature operator byte capacity exceeded');return text;};
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const sum=a=>a.reduce((s,v)=>finite(s+v),0);
function solve(L,b){const n=b.length,y=Array(n),x=Array(n);for(let i=0;i<n;i++){let s=b[i];for(let j=0;j<i;j++)s=finite(s-L[i][j]*y[j]);y[i]=finite(s/L[i][i]);}for(let i=n-1;i>=0;i--){let s=y[i];for(let j=i+1;j<n;j++)s=finite(s-L[j][i]*x[j]);x[i]=finite(s/L[i][i]);}return x;}
function factor(M){const n=M.length,L=Array.from({length:n},()=>Array(n).fill(0));for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=M[i][j];for(let k=0;k<j;k++)s=finite(s-L[i][k]*L[j][k]);if(i===j){if(!(s>0))fail('Temperature mass is not positive definite');L[i][j]=Math.sqrt(s);}else L[i][j]=finite(s/L[j][j]);}return L;}

const ids=faces=>[...new Set(faces.flatMap(f=>f.nodes))].sort((a,b)=>a-b);
const sub=(a,b)=>a.map((v,k)=>finite(v-b[k]));
const dot=(a,b)=>sum(a.map((v,k)=>finite(v*b[k])));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].map(finite);
const point=(g,id)=>g.mesh.nodes.slice(3*id,3*id+3);
function geometry(input){
 const g=snapshot(input);fields(g,['units','mesh','sourceFaces','targetFaces','groups']);fields(g.mesh,['nodes']);
 const nodes=g.mesh.nodes;
 if(g.units!=='mm'||!Array.isArray(nodes)||nodes.length<18||nodes.length%3||nodes.length>4096*3||nodes.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e6))fail('Invalid grouped temperature geometry');
 for(const side of ['sourceFaces','targetFaces']){
  const faces=g[side];if(!Array.isArray(faces)||!faces.length||faces.length>512)fail('Grouped temperature face capacity exceeded');
  for(const face of faces){fields(face,['nodes']);if(!Array.isArray(face.nodes)||face.nodes.length!==3||new Set(face.nodes).size!==3||face.nodes.some(id=>!Number.isSafeInteger(id)||id<0||id>=nodes.length/3))fail('Invalid grouped face nodes');}
  if(ids(faces).length>128)fail('Grouped temperature active-node capacity exceeded');
 }
 if(!Array.isArray(g.groups)||g.groups.length<1||g.groups.length>8)fail('Grouped temperature group capacity exceeded');
 const names=new Set(),seen={sourceFaceIds:new Set(),targetFaceIds:new Set()};
 for(const group of g.groups){
  fields(group,['groupId','sourceFaceIds','targetFaceIds']);if(typeof group.groupId!=='string'||!(/^[A-Za-z0-9_-]{1,64}$/).test(group.groupId)||names.has(group.groupId))fail('Invalid or duplicate group ID');names.add(group.groupId);
  for(const key of ['sourceFaceIds','targetFaceIds']){const faceIds=group[key],faces=g[key==='sourceFaceIds'?'sourceFaces':'targetFaces'];if(!Array.isArray(faceIds)||!faceIds.length||faceIds.length>512)fail('Invalid group face assignment');for(const id of faceIds){if(!Number.isSafeInteger(id)||id<0||id>=faces.length||seen[key].has(id))fail('Every face must belong to exactly one group');seen[key].add(id);}faceIds.sort((a,b)=>a-b);}
 }
 if(seen.sourceFaceIds.size!==g.sourceFaces.length||seen.targetFaceIds.size!==g.targetFaces.length)fail('Missing group face assignment');
 g.groups.sort((a,b)=>a.groupId<b.groupId?-1:a.groupId>b.groupId?1:0);bounded(canonicalJson(g));return g;
}
function triangle(g,face){const p=face.nodes.map(id=>point(g,id)),a=sub(p[1],p[0]),b=sub(p[2],p[0]),raw=cross(a,b),length=Math.hypot(...raw),edgeLength=Math.hypot(...a);if(!(length>1e-12)||!(edgeLength>0))fail('Degenerate grouped triangle');return {ids:face.nodes,p,n:raw.map(v=>v/length),u:a.map(v=>v/edgeLength),area:length/2};}
function inside(p,t){const a=sub(t.p[1],t.p[0]),b=sub(t.p[2],t.p[0]),d=sub(p,t.p[0]),aa=dot(a,a),ab=dot(a,b),bb=dot(b,b),ad=dot(a,d),bd=dot(b,d),den=aa*bb-ab*ab;if(!(den>0))fail('Unstable grouped triangle intersection');const u=(bb*ad-ab*bd)/den,v=(aa*bd-ab*ad)/den;return u>=-1e-10&&v>=-1e-10&&u+v<=1+1e-10;}
function permittedContact(p,a,b,g){const common=a.ids.filter(id=>b.ids.includes(id)),eps=1e-6;if(!common.length)return false;if(common.length===1)return Math.hypot(...sub(p,point(g,common[0])))<=eps;if(common.length!==2)return false;const x=point(g,common[0]),edge=sub(point(g,common[1]),x),d=sub(p,x),len2=dot(edge,edge),t=dot(d,edge)/len2;if(t<0||t>1)return false;return Math.hypot(...d.map((v,k)=>v-t*edge[k]))<=eps;}
/** Cross-group contact is admitted only on the same global node or edge IDs.
 * This is a bounded triangle-set check, not a smooth surface/self-repair algorithm. */
function rejectCrossGroupIntersections(g){
 for(const [side,key]of [['sourceFaces','sourceFaceIds'],['targetFaces','targetFaceIds']]){
  const membership=new Map(g.groups.flatMap(group=>group[key].map(id=>[id,group.groupId]))),tri=g[side].map(f=>triangle(g,f));
  for(let i=0;i<tri.length;i++)for(let j=i+1;j<tri.length;j++){
   if(membership.get(i)===membership.get(j))continue;const a=tri[i],b=tri[j];
   if([0,1,2].some(k=>Math.max(...a.p.map(p=>p[k]))<Math.min(...b.p.map(p=>p[k]))-1e-6||Math.max(...b.p.map(p=>p[k]))<Math.min(...a.p.map(p=>p[k]))-1e-6))continue;
   const points=[],coplanar=Math.abs(dot(a.n,b.n))>1-1e-10&&b.p.every(p=>Math.abs(dot(sub(p,a.p[0]),a.n))<=1e-6);
   if(coplanar){
    const v=cross(a.n,a.u),project=p=>{const d=sub(p,a.p[0]);return [dot(d,a.u),dot(d,v)];},poly=clipPolygon(a.p.map(project),b.p.map(project),1e-10);let area=0;for(let k=1;k+1<poly.length;k++)area+=Math.abs(cross2(sub2(poly[k],poly[0]),sub2(poly[k+1],poly[0])))/2;
    if(area>1e-12+1e-12*Math.min(a.area,b.area))fail('Overlapping coplanar groups');for(const q of poly)points.push(a.p[0].map((x,k)=>x+q[0]*a.u[k]+q[1]*v[k]));
   }else{
    for(const [x,y]of [[a,b],[b,a]])for(let k=0;k<3;k++){
     const p=x.p[k],q=x.p[(k+1)%3],dp=dot(sub(p,y.p[0]),y.n),dq=dot(sub(q,y.p[0]),y.n);
     if(Math.abs(dp)<=1e-6&&inside(p,y))points.push(p);
     if(dp*dq<0){const t=dp/(dp-dq),hit=p.map((v,k)=>v+t*(q[k]-v));if(inside(hit,y))points.push(hit);}
    }
   }
   if(points.some(p=>!permittedContact(p,a,b,g)))fail('Cross-group intersection requires shared global node/edge IDs');
  }
 }
}
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
