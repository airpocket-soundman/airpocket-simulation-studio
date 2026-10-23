import {inspectChannelLayerTet4} from './channel-layer-tet4.js';
import {canonicalJson,hashCanonicalJson} from './project-revision.js';
import {tetraVolume} from './tetra-geometry.js';

const specifications=[
 ['lowerWall','lower-wall',[0,-1,0],'no-slip-wall'],['upperWall','upper-wall',[0,1,0],'no-slip-wall'],
 ['xMin','inlet',[-1,0,0],'velocity-inlet'],['xMax','outlet',[1,0,0],'pressure-outlet'],
 ['zMin','side-z-min',[0,0,-1],'symmetry'],['zMax','side-z-max',[0,0,1],'symmetry']
];
const failure=message=>{throw Object.assign(Error(message),{code:'CHANNEL_BOUNDARY_TRANSFER_INVALID'});};
const exact=(record,keys)=>{if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length!==keys.length||keys.some(k=>!Object.hasOwn(record,k)))failure('Missing or unknown transfer fields');};
const key=face=>[...face].sort((a,b)=>a-b).join('-');
const tetFaces=([a,b,c,d])=>[[b,c,d],[a,d,c],[a,b,d],[a,c,b]];
const position=(mesh,id)=>mesh.nodes.slice(3*id,3*id+3);
function geometry(mesh){
 inspectChannelLayerTet4(mesh); // Capacity and finite geometry gates precede serialization.
 const {units,output,lengthMm,widthMm,gapMm,nodes,tetrahedra}=mesh;
 return {units,output,lengthMm,widthMm,gapMm,nodes,tetrahedra};
}
/** Actual geometry hash, independent of untrusted cached inspection/scope fields. */
export async function getChannelLayerMeshRevision(mesh){
 return hashCanonicalJson(canonicalJson(geometry(mesh)));
}
function boundaryConditions(conditions){
 exact(conditions,specifications.map(s=>s[0]));
 for(const [tag,,,type] of specifications){
  const c=conditions[tag];exact(c,type==='velocity-inlet'?['type','velocityMps']:type==='pressure-outlet'?['type','pressurePa']:['type']);
  if(c.type!==type)failure('Unsupported condition on '+tag+': expected '+type);
  if(type==='velocity-inlet'&&(!Array.isArray(c.velocityMps)||c.velocityMps.length!==3||!c.velocityMps.every(v=>typeof v==='number'&&Number.isFinite(v))||c.velocityMps[0]<=0||c.velocityMps[1]!==0||c.velocityMps[2]!==0))failure('Limited inlet requires explicit finite positive x velocity in m/s');
  if(type==='pressure-outlet'&&(typeof c.pressurePa!=='number'||!Number.isFinite(c.pressurePa)))failure('Outlet pressure must be finite Pa');
 }
}
/** Transfer to an explicit limited manifest; no CAD projection, solver invocation or BC inference. */
export async function createChannelLayerBoundaryTransfer(input){
 exact(input,['mesh','expectedMeshRevision','conditions','maxTetEdgeAspectRatio','minimumTetVolumeMm3']);
 const {mesh,expectedMeshRevision,conditions,maxTetEdgeAspectRatio,minimumTetVolumeMm3}=input;
 if(typeof expectedMeshRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expectedMeshRevision))failure('Expected mesh revision required');
 if(!Number.isFinite(maxTetEdgeAspectRatio)||maxTetEdgeAspectRatio<1||!Number.isFinite(minimumTetVolumeMm3)||minimumTetVolumeMm3<=0)failure('Explicit finite Tet4 quality limits required');
 boundaryConditions(conditions);
 const current=()=>({mesh:geometry(input.mesh),conditions:input.conditions,expectedMeshRevision:input.expectedMeshRevision,maxTetEdgeAspectRatio:input.maxTetEdgeAspectRatio,minimumTetVolumeMm3:input.minimumTetVolumeMm3});
 const original=canonicalJson(current()),snapshot=JSON.parse(original),m=snapshot.mesh;
 const revision=await hashCanonicalJson(canonicalJson(m));
 const transferRevision=await hashCanonicalJson(canonicalJson({schemaVersion:1,kind:'limited-channel-boundary-transfer',meshRevision:revision,conditions:snapshot.conditions,maxTetEdgeAspectRatio,minimumTetVolumeMm3}));
 exact(input,['mesh','expectedMeshRevision','conditions','maxTetEdgeAspectRatio','minimumTetVolumeMm3']);
 if(canonicalJson(current())!==original)failure('Transfer input changed during revision verification');
 if(revision!==expectedMeshRevision)failure('Stale mesh revision');
 const inspection=inspectChannelLayerTet4(m),owners=new Map();
 const elements=m.tetrahedra.map((tet,index)=>{
  for(const face of tetFaces(tet)){const k=key(face);if(!owners.has(k))owners.set(k,[]);owners.get(k).push(index);}
  const points=tet.map(id=>position(m,id)),centroid=Array.from({length:3},(_,axis)=>points.reduce((sum,p)=>sum+p[axis]/4,0));
  const edges=[];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)edges.push(Math.hypot(...points[i].map((v,axis)=>v-points[j][axis])));
  const volumeMm3=tetraVolume(m.nodes,tet),edgeAspectRatio=Math.max(...edges)/Math.min(...edges),plateDistanceMm=Math.min(centroid[1],m.gapMm-centroid[1]);
  if(!Number.isFinite(edgeAspectRatio)||edgeAspectRatio>maxTetEdgeAspectRatio||volumeMm3<minimumTetVolumeMm3||!Number.isFinite(plateDistanceMm)||plateDistanceMm<=0)failure('Tet4 quality limit violated at '+index);
  return {tetrahedronId:'channel-tet-'+index,nodeIds:[...tet],centroidMm:centroid,volumeMm3,edgeAspectRatio,plateDistanceMm};
 });
 const boundaries=specifications.map(([tag,boundaryId,outwardNormal])=>({tag,boundaryId,outwardNormal:[...outwardNormal],wallId:tag==='lowerWall'?0:tag==='upperWall'?1:null,condition:structuredClone(snapshot.conditions[tag]),faceIds:[],areaMm2:0}));
 const faces=inspection.boundaryFaces.map(face=>{
  const boundary=boundaries.find(b=>b.tag===face.tag),points=face.nodes.map(id=>position(m,id)),[a,b,c]=points;
  const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],norm=Math.hypot(...cross);
  const normal=cross.map(x=>x===0?0:x/norm),centroidMm=Array.from({length:3},(_,axis)=>points.reduce((sum,p)=>sum+p[axis]/3,0));
  if(normal.some((n,i)=>!Number.isFinite(n)||Math.abs(n-boundary.outwardNormal[i])>1e-12))failure('Boundary face normal mismatch');
  const owner=owners.get(key(face.nodes));if(owner?.length!==1)failure('Boundary face must have one owner');
  const faceId=boundary.boundaryId+':'+key(face.nodes);boundary.faceIds.push(faceId);boundary.areaMm2+=face.areaMm2;
  return {faceId,boundaryId:boundary.boundaryId,nodeIds:[...face.nodes],tetrahedronId:elements[owner[0]].tetrahedronId,outwardNormal:normal,centroidMm,areaMm2:face.areaMm2,wallId:boundary.wallId};
 }).sort((a,b)=>a.faceId<b.faceId?-1:a.faceId>b.faceId?1:0);
 for(const boundary of boundaries)boundary.faceIds.sort();
 return {schemaVersion:1,kind:'limited-channel-boundary-transfer',meshRevision:revision,transferRevision,units:{length:'mm',area:'mm2',volume:'mm3',velocity:'m/s',pressure:'Pa'},boundaries,faces,elements,nodePlateDistancesMm:Array.from({length:m.nodes.length/3},(_,id)=>Math.min(m.nodes[3*id+1],m.gapMm-m.nodes[3*id+1])),qualityLimits:{maxTetEdgeAspectRatio,minimumTetVolumeMm3},scope:{geometry:'parallel-plate-axis-aligned-Tet4',flowDirection:'+x',solverConnected:false,projectBoundaryApiConnected:false,wallDistanceDefinition:'nearest-y-plate-only',unsupported:['general-3d-boundary-layer','y-plus','flow-solve','arbitrary-boundary-conditions']}};
}

/** Downstream read-only check: regenerate from exact inputs, never trust supplied tags/normals. */
export async function validateChannelLayerBoundaryTransfer(input,transfer){
 geometry(input?.mesh);
 // Reject an oversized manifest before canonical JSON allocates strings.
 const maximumFaces=4*(input?.mesh?.tetrahedra?.length??0);
 if(!Array.isArray(transfer?.faces)||transfer.faces.length>maximumFaces||!Array.isArray(transfer?.elements)||transfer.elements.length!==(input?.mesh?.tetrahedra?.length??0))failure('Invalid boundary manifest capacity');
 let values=0;
 const bounded=(value,depth=0)=>{
  if(++values>500000||depth>12)failure('Boundary manifest capacity exceeded');
  if(typeof value==='string'){if(value.length>200)failure('Boundary manifest string capacity exceeded');return;}
  if(!value||typeof value!=='object')return;
  const keys=Reflect.ownKeys(value);if(keys.length>(Array.isArray(value)?maximumFaces+1:32))failure('Boundary manifest record capacity exceeded');
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!('value' in d))failure('Boundary manifest accessors are unsupported');bounded(d.value,depth+1);}
 };
 bounded(transfer);
 const before=canonicalJson(transfer),expected=await createChannelLayerBoundaryTransfer(input);
 if(canonicalJson(transfer)!==before)failure('Boundary manifest changed during validation');
 if(before!==canonicalJson(expected))failure('Boundary manifest does not match exact geometry and conditions');
 return expected;
}
