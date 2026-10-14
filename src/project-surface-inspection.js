import {canonicalJson,getProjectRevision} from './project-revision.js';
import {validateProject} from './regions.js';
import {inspectSurface} from './surface-inspection.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
/** Diagnostics on display triangles only, without changing geometry. Compare
 * revision across pages; triangle indices address that exact project's mesh.
 * problemTrianglesTruncated means a subsequent problem page exists. */
export async function inspectProjectSurface(project,options){
 if(!plain(options))throw Error('Surface inspection requires meshIndex options');
 const settings=JSON.parse(canonicalJson(options)),snapshot=JSON.parse(canonicalJson(project));
 if(Object.keys(settings).some(key=>!['meshIndex','toleranceMm','problemOffset','problemLimit'].includes(key))||!Number.isSafeInteger(settings.meshIndex)||settings.meshIndex<0)throw Error('Invalid project surface inspection options');
 const {meshIndex,toleranceMm,problemOffset=0,problemLimit=100}=settings;
 if(!Number.isSafeInteger(problemOffset)||problemOffset<0||!Number.isInteger(problemLimit)||problemLimit<1||problemLimit>200||toleranceMm!==undefined&&(!Number.isFinite(toleranceMm)||toleranceMm<=0))throw Error('Invalid project surface inspection page or tolerance');
 validateProject(snapshot);if(meshIndex>=snapshot.meshes.length)throw Error('Surface mesh index out of range');
 const report=inspectSurface(snapshot.meshes[meshIndex].positions,{...(toleranceMm!==undefined?{toleranceMm}:{}),problemOffset,problemLimit});
 return {schemaVersion:1,revision:await getProjectRevision(snapshot),meshIndex,units:{geometry:'mm',volume:'mm3'},basis:'display-triangles',...report,cadExactGeometryChecked:false,geometryModified:false,limitations:['Display triangles are tolerance-welded for topology diagnostics; source CAD exact geometry is not checked','Self intersections are not checked; closed edge topology does not prove a valid solid','No automatic repair is performed; problem triangle indices refer to the returned project revision']};
}
