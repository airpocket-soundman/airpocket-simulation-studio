import {BoxGeometry,CylinderGeometry,SphereGeometry,LatheGeometry,Vector2} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {createStudioApi} from './studio-api.js';
import {validateSphere,validateTube} from './fluid-domain.js';

export const STEP_IMPORT_OPTIONS=Object.freeze({linearUnit:'millimeter',linearDeflectionType:'bounding_box_ratio',linearDeflection:0.001,angularDeflection:0.2});
export const MAX_IMPORT_BYTES=50*1024*1024;

function bytesOf(input){
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):input instanceof Uint8Array?input:null;
  if(!bytes||!bytes.length||bytes.length>MAX_IMPORT_BYTES)throw Error('Import requires nonempty bytes (maximum 50 MB).');
  return bytes;
}
function savedProject(meshes,sourceModel,{name='Imported model',material='金属',materialProperties={},study={kind:'structural'}}={}){
  if(typeof name!=='string'||!name.trim()||!['金属','樹脂','ガラス','ゴム'].includes(material))throw Error('Invalid project name or material category.');
  const api=createStudioApi();api.loadProject({version:1,name,material,materialProperties:structuredClone(materialProperties),study:structuredClone(study),sourceModel:structuredClone(sourceModel),meshes,conditions:[],selection:meshes.map(()=>[])});
  return api.exportProject();
}
function display(geometry,faceIds){
  const expanded=geometry.index?geometry.toNonIndexed():geometry;
  const positions=Array.from(expanded.attributes.position.array);
  if(expanded!==geometry)expanded.dispose();geometry.dispose();
  return {positions,faceIds:faceIds??Array.from({length:positions.length/9},(_,i)=>i)};
}

/** OCCT result must have been read with STEP_IMPORT_OPTIONS (millimetres).
 * Original STEP bytes are preserved for actual volume meshing and CAD updates.
 * This function cannot prove that an externally supplied OCCT result matches bytes.
 */
export function createProjectFromStep({bytes,result,linearUnit,...options}){
  const input=bytesOf(bytes);
  if(linearUnit!=='millimeter')throw Error('STEP result must explicitly declare millimeter normalization.');
  if(!result?.success||!Array.isArray(result.meshes)||!result.meshes.length||result.meshes.length>500)throw Error('STEP import returned no usable meshes.');
  let totalCoordinates=0;
  const meshes=result.meshes.map(mesh=>{
    const vertices=mesh.attributes?.position?.array,indices=mesh.index?.array;
    if(!Array.isArray(vertices)||!vertices.length||vertices.length%3||!vertices.every(Number.isFinite)||!Array.isArray(indices)||!indices.length||indices.length%3||indices.length>18000000||!indices.every(i=>Number.isInteger(i)&&i>=0&&i<vertices.length/3)||!Array.isArray(mesh.brep_faces))throw Error('Invalid STEP tessellation.');
    totalCoordinates+=indices.length*3;if(totalCoordinates>18000000)throw Error('STEP tessellation exceeds project display size limit.');
    const faceIds=Array(indices.length/3).fill(-1);
    mesh.brep_faces.forEach((face,id)=>{
      if(!Number.isInteger(face.first)||!Number.isInteger(face.last)||face.first<0||face.last<face.first||face.last>=faceIds.length)throw Error('Invalid STEP face range.');
      for(let t=face.first;t<=face.last;t++){if(faceIds[t]!==-1)throw Error('Overlapping STEP face ranges.');faceIds[t]=id;}
    });
    if(faceIds.some(id=>id<0))throw Error('STEP face mapping does not cover every triangle.');
    return {positions:indices.flatMap(i=>vertices.slice(i*3,i*3+3).map(Math.fround)),faceIds};
  });
  let binary='';for(let i=0;i<input.length;i+=16384)binary+=String.fromCharCode(...input.subarray(i,i+16384));
  return savedProject(meshes,{kind:'step',data:btoa(binary)},options);
}

/** STL has no embedded units. Caller explicitly supplies conversion to mm. */
export function createProjectFromStl({bytes,scaleToMm,...options}){
  const input=bytesOf(bytes);
  if(!Number.isFinite(scaleToMm)||scaleToMm<=0)throw Error('STL requires a positive explicit scaleToMm.');
  const copy=input.slice(),geometry=new STLLoader().parse(copy.buffer);
  geometry.scale(scaleToMm,scaleToMm,scaleToMm);
  const mesh={...display(geometry),kind:'stl'};
  // Existing project validation enforces one outward, closed, convex shell and
  // the 2000-triangle limit. No repair or CAD-face claims are introduced.
  return savedProject([mesh],{kind:'stl',positions:mesh.positions.slice()},options);
}

/** Built-in source dimensions and resulting display coordinates are in mm. */
export function createProjectFromBuiltin({source,...options}){
  source=structuredClone(source);
  const box=bounds=>{
    if(!Array.isArray(bounds)||bounds.length!==6||!bounds.every(Number.isFinite)||bounds.slice(3).some(v=>v<=0))throw Error('Invalid box dimensions.');
    const geometry=new BoxGeometry(...bounds.slice(3));geometry.translate(...bounds.slice(0,3).map((v,i)=>v+bounds[i+3]/2));
    return display(geometry,Array.from({length:12},(_,i)=>Math.floor(i/2)));
  };
  let meshes;
  if(source?.kind==='box')meshes=[box(source.bounds)];
  else if(source?.kind==='boxes'){
    if(!Array.isArray(source.boxes)||!source.boxes.length||source.boxes.length>10)throw Error('Invalid box assembly.');
    meshes=source.boxes.map(box);
    for(let i=0;i<source.boxes.length;i++)for(let j=0;j<i;j++)if([0,1,2].every(k=>Math.min(source.boxes[i][k]+source.boxes[i][k+3],source.boxes[j][k]+source.boxes[j][k+3])>Math.max(source.boxes[i][k],source.boxes[j][k])+1e-9))throw Error('Independent box solids cannot overlap in volume.');
  } else if(source?.kind==='cylinder'){
    if(Object.keys(source).some(k=>k!=='kind'))throw Error('Built-in cylinder has fixed radius 12 mm, length 60 mm and Y axis.');
    const mesh=display(new CylinderGeometry(12,12,60,64,24,false));
    mesh.faceIds=mesh.faceIds.map((_,t)=>[1,4,7].every(k=>Math.abs(mesh.positions[t*9+k]-30)<.001)?1:[1,4,7].every(k=>Math.abs(mesh.positions[t*9+k]+30)<.001)?2:0);meshes=[mesh];
  } else if(source?.kind==='sphere'){
    validateSphere(source);const geometry=new SphereGeometry(source.radius,64,32);geometry.translate(...source.center);meshes=[display(geometry)];
  } else if(source?.kind==='tube'){
    validateTube(source);const half=source.length/2,geometry=new LatheGeometry([[source.innerRadius,-half],[source.outerRadius,-half],[source.outerRadius,half],[source.innerRadius,half],[source.innerRadius,-half]].map(p=>new Vector2(...p)),64);
    if(source.axis===0)geometry.rotateZ(-Math.PI/2);if(source.axis===2)geometry.rotateX(Math.PI/2);geometry.translate(...source.center);meshes=[display(geometry)];
  } else throw Error('Unsupported built-in source; use box, boxes, cylinder, sphere or tube.');
  return savedProject(meshes,source,options);
}
