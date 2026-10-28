import {MAX_MESH_DIAGNOSTICS} from './mesh-validity.js';

const TET_FACES=[[1,2,3],[0,3,2],[0,1,3],[0,2,1]];
const keyOf=nodes=>[...nodes].sort((a,b)=>a-b).join(',');
const area=(xyz,f)=>{const p=f.map(i=>[xyz[3*i],xyz[3*i+1],xyz[3*i+2]]),u=p[1].map((v,k)=>v-p[0][k]),v=p[2].map((x,k)=>x-p[0][k]);return .5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);};

/** Read-only check that every tetra boundary face is assigned to exactly one CAD face tag
 * in mesh.surface, and that surface triangles do not lie inside the volume or repeat.
 * Never modifies the mesh and never invokes a mesher. */
export function analyzeBoundaryFaceAssignment(mesh){
 const nodes=mesh?.nodes,tets=mesh?.tetrahedra,surface=mesh?.surface;
 if(!(Array.isArray(nodes)||ArrayBuffer.isView(nodes))||!Array.isArray(tets)||!Array.isArray(surface))throw Error('Boundary assignment check requires nodes, tetrahedra and surface arrays');
 const nodeCount=nodes.length/3,validIndex=i=>Number.isInteger(i)&&i>=0&&i<nodeCount;
 const incidence=new Map();
 for(let e=0;e<tets.length;e++){const t=tets[e];if(!Array.isArray(t)||t.length!==4||!t.every(validIndex))throw Error('Invalid tetrahedron '+e);for(const face of TET_FACES){const k=keyOf(face.map(i=>t[i]));incidence.set(k,(incidence.get(k)??0)+1);}}
 const diagnostics=[],counts={missing:0,duplicate:0,interior:0,unassigned:0,invalid:0,nonManifold:0};
 const push=(code,message,evidence)=>{counts[code]++;if(diagnostics.length<MAX_MESH_DIAGNOSTICS)diagnostics.push({code:'MESH_BOUNDARY_'+code.replace(/[A-Z]/g,c=>'_'+c).toUpperCase(),severity:'error',message,evidence});};
 const assigned=new Map(),faceTags=new Map();
 for(let s=0;s<surface.length;s++){
  const f=surface[s]?.nodes;
  if(!Array.isArray(f)||f.length!==3||!f.every(validIndex)||new Set(f).size!==3){push('invalid','Surface triangle has invalid node indices',{surfaceIndex:s});continue;}
  const tag=surface[s].faceTag;
  if(!Number.isInteger(tag)){push('unassigned','Surface triangle has no CAD face tag',{surfaceIndex:s,nodes:f});}
  const k=keyOf(f),seen=assigned.get(k);
  if(seen){push('duplicate','Surface triangle is assigned more than once',{surfaceIndex:s,firstSurfaceIndex:seen.surfaceIndex,faceTags:[seen.faceTag,tag]});continue;}
  assigned.set(k,{surfaceIndex:s,faceTag:tag});
  const n=incidence.get(k)??0;
  if(n!==1){push('interior',n?'Surface triangle lies on an interior tetra face':'Surface triangle is not a face of any tetrahedron',{surfaceIndex:s,faceTag:tag,incidentTetrahedra:n});continue;}
  if(Number.isInteger(tag)){const row=faceTags.get(tag)??{faceTag:tag,triangles:0,areaMm2:0};row.triangles++;row.areaMm2+=area(nodes,f);faceTags.set(tag,row);}
 }
 let boundaryFaces=0;
 for(const [k,n]of incidence){
  if(n>2){push('nonManifold','Tetra face is shared by more than two elements',{nodes:k.split(',').map(Number),incidentTetrahedra:n});continue;}
  if(n!==1)continue;boundaryFaces++;
  if(!assigned.has(k))push('missing','Tetra boundary face has no CAD face assignment',{nodes:k.split(',').map(Number)});
 }
 const issues=Object.values(counts).reduce((a,b)=>a+b,0);
 return {schemaVersion:1,conforming:issues===0,boundaryFaces,surfaceTriangles:surface.length,counts,faceTags:[...faceTags.values()].sort((a,b)=>a.faceTag-b.faceTag),diagnostics,truncated:issues>diagnostics.length,remainingChecks:['Geometric distance of mesh nodes to the CAD surface is not checked.','Correct CAD face identity (vs. a consistent but wrong tag) is not checked beyond per-tag area.']};
}
