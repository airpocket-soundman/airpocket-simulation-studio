import {validateProject} from './regions.js';
import {getProjectRevision} from './project-revision.js';

const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const bounds=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
function extend(box,positions,start=0,end=positions.length){
  for(let i=start;i<end;i++){const axis=i%3;box.min[axis]=Math.min(box.min[axis],positions[i]);box.max[axis]=Math.max(box.max[axis],positions[i]);}
}
function finishBounds(box){
  const size=box.max.map((value,axis)=>value-box.min[axis]);
  if(!size.every(Number.isFinite))throw Error('Geometry bounds exceed numerical range.');
  return {...box,size};
}
function identity(project,mesh){
  if(project.sourceModel?.kind==='stl')return {kind:mesh.kind==='gmsh-surface'?'stl-remeshed-surface-tag':'stl-triangle-index',persistentCadFace:false};
  if(mesh.kind==='gmsh-surface')return {kind:'gmsh-surface-tag',persistentCadFace:false};
  if(project.sourceModel?.kind==='step')return {kind:'step-display-face-index',persistentCadFace:false};
  return {kind:'display-face-group-index',persistentCadFace:false};
}

/** Compact observed geometry; no source triangles or inferred CAD surface types.
 * Face IDs address this display mesh revision only, never persistent CAD IDs.
 * A meshIndex explicitly requests a bounded face page, sorted by numeric ID.
 */
export async function inspectProjectGeometry(project,options={}){
  if(!plain(options)||Reflect.ownKeys(options).some(key=>typeof key!=='string'||!['meshIndex','faceOffset','faceLimit'].includes(key)||!('value' in Object.getOwnPropertyDescriptor(options,key))))throw new TypeError('Invalid geometry inspection options.');
  const {meshIndex,faceOffset=0,faceLimit=20}=options;
  if(meshIndex!==undefined&&(!Number.isSafeInteger(meshIndex)||meshIndex<0)||!Number.isSafeInteger(faceOffset)||faceOffset<0||!Number.isSafeInteger(faceLimit)||faceLimit<1||faceLimit>50)throw new TypeError('Invalid meshIndex or face page (limit 1–50).');
  if(meshIndex===undefined&&(Object.hasOwn(options,'faceOffset')||Object.hasOwn(options,'faceLimit')))throw Error('Face pagination requires an explicit meshIndex.');
  validateProject(project);
  if(meshIndex!==undefined&&!project.meshes[meshIndex])throw Error('Unknown meshIndex.');
  const overall=bounds();let triangleCount=0,faceCount=0;
  for(const mesh of project.meshes){
    if(!mesh.faceIds.every(id=>Number.isSafeInteger(id)&&id>=0))throw Error('Face identities must be nonnegative safe integers.');
    extend(overall,mesh.positions);triangleCount+=mesh.faceIds.length;faceCount+=new Set(mesh.faceIds).size;
  }
  const result={schemaVersion:1,units:{coordinates:'mm',area:'mm2'},basis:'display-tessellation',meshCount:project.meshes.length,triangleCount,faceCount,boundsMm:finishBounds(overall),faceIdentityScope:'display-mesh-revision',persistentCadFaceIds:false,facePagesRequireMeshIndex:true};
  if(meshIndex===undefined)return result;
  // Finish all geometric reads before awaiting the revision calculation.
  const mesh=project.meshes[meshIndex],meshBounds=bounds(),groups=new Map();extend(meshBounds,mesh.positions);
  const ids=[...new Set(mesh.faceIds)].sort((a,b)=>a-b),pageIds=ids.slice(faceOffset,faceOffset+faceLimit),wanted=new Set(pageIds);
  for(let triangle=0;triangle<mesh.faceIds.length;triangle++){
    const faceId=mesh.faceIds[triangle];if(!wanted.has(faceId))continue;
    let group=groups.get(faceId);if(!group){group={faceId,triangleCount:0,areaMm2:0,bounds:bounds(),areaCentroidMm:[0,0,0],weightedNormal:[0,0,0],degenerateTriangleCount:0};groups.set(faceId,group);}
    const start=triangle*9,p=mesh.positions.slice(start,start+9),u=[0,1,2].map(k=>p[k+3]-p[k]),v=[0,1,2].map(k=>p[k+6]-p[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],area=Math.hypot(...cross)/2;
    if(!Number.isFinite(area))throw Error('Geometry area exceeds numerical range.');
    group.triangleCount++;extend(group.bounds,p);group.areaMm2+=area;
    if(area===0)group.degenerateTriangleCount++;
    // Incremental weighted average avoids summing large absolute coordinates.
    if(area>0){const weight=area/group.areaMm2;for(let k=0;k<3;k++){const centroid=p[k]/3+p[k+3]/3+p[k+6]/3;group.areaCentroidMm[k]+=weight*(centroid-group.areaCentroidMm[k]);group.weightedNormal[k]+=cross[k]/2;}}
  }
  const faces=pageIds.map(id=>{
    const group=groups.get(id),averageNormal=group.areaMm2>0?group.weightedNormal.map(value=>value/group.areaMm2):null;
    if(!Number.isFinite(group.areaMm2)||group.areaCentroidMm.some(value=>!Number.isFinite(value))||averageNormal?.some(value=>!Number.isFinite(value)))throw Error('Geometry statistics exceed numerical range.');
    return {faceId:id,triangleCount:group.triangleCount,areaMm2:group.areaMm2,boundsMm:finishBounds(group.bounds),areaCentroidMm:group.areaMm2>0?group.areaCentroidMm:null,areaWeightedAverageNormal:averageNormal,normalCoherence:averageNormal?Math.min(1,Math.hypot(...averageNormal)):null,degenerateTriangleCount:group.degenerateTriangleCount,surfaceClassification:'not-inferred'};
  });
  const meshSummary={meshIndex,triangleCount:mesh.faceIds.length,faceCount:ids.length,boundsMm:finishBounds(meshBounds),faceIdentity:{...identity(project,mesh),scope:'display-mesh-revision',meshIndex,invalidatedByGeometryOrFaceMappingChange:true},normalBasis:'area-weighted-triangle-winding-unit-normals',facePage:{offset:faceOffset,limit:faceLimit,total:ids.length,returned:faces.length,nextOffset:faceOffset+faces.length<ids.length?faceOffset+faces.length:null,faces}};
  const displayMeshRevision=await getProjectRevision({positions:mesh.positions,faceIds:mesh.faceIds,kind:mesh.kind??'cad'});
  meshSummary.displayMeshRevision=displayMeshRevision;meshSummary.faceIdentity.displayMeshRevision=displayMeshRevision;result.mesh=meshSummary;
  return result;
}
