import {inspectSurface} from './surface-inspection.js';

export const MAX_STL_TRIANGLES=2000;

// Coordinates are normalized to millimetres before entering this source format.
// Accept one consistently oriented convex shell; never repair input geometry.
export function validateStlSource(source){
 if(!source||typeof source!=='object'||Array.isArray(source)||source.kind!=='stl'||Object.keys(source).some(k=>!['kind','positions'].includes(k)))throw Error('Invalid STL source: only kind and millimetre positions are supported');
 const positions=source.positions;
 if(!Array.isArray(positions)||!positions.length||positions.length%9||positions.length>MAX_STL_TRIANGLES*9||!positions.every(Number.isFinite))throw Error('STL source requires finite triangles in mm (maximum 2000 triangles)');
 const summary=inspectSurface(positions),dimensions=summary.boundsMm.dimensions,diagonal=Math.hypot(...dimensions),volumeTolerance=Math.max(1e-24,diagonal**3*1e-12);
 if(!summary.closedEdgeTopology||summary.components!==1)throw Error('STL volume meshing requires one closed manifold shell without holes, duplicates, degenerate facets or inconsistent winding');
 if(!Number.isFinite(volumeTolerance)||!(summary.signedVolumeMm3>volumeTolerance))throw Error('STL shell must have outward winding and a positive nondegenerate volume');
 const vertices=[],seen=new Set();
 for(let i=0;i<positions.length;i+=3){const p=positions.slice(i,i+3),key=p.join(',');if(!seen.has(key)){seen.add(key);vertices.push(p);}}
 const distanceTolerance=summary.toleranceMm;
 for(let i=0;i<positions.length;i+=9){
  const a=positions.slice(i,i+3),u=positions.slice(i+3,i+6).map((v,k)=>v-a[k]),v=positions.slice(i+6,i+9).map((value,k)=>value-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
  const unit=normal.map(value=>value/length);
  for(const p of vertices){const distance=p.reduce((sum,value,k)=>sum+(value-a[k])*unit[k],0);if(!Number.isFinite(distance)||distance>distanceTolerance)throw Error('STL volume meshing currently requires a convex shell; a vertex lies outside a facet half-space');}
 }
 return {...summary,convexBoundaryChecked:true};
}

// Archive validation is synchronous. It verifies metadata and geometric volume,
// but does not recompute the asynchronous SHA-256 source fingerprint.
export function validateStlMesh(mesh,input,calculation){
 const source=input?.sourceModel,metadata=mesh?.stl;
 if(source?.kind!=='stl'){if(metadata!==undefined)throw Error('Unexpected saved STL mesh metadata');return;}
 const summary=validateStlSource(source),allowed=['sourceVolumeMm3','convexBoundaryChecked','triangleCount','boundaryTransfer'];
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||Object.keys(metadata).some(k=>!allowed.includes(k))||metadata.convexBoundaryChecked!==true||metadata.boundaryTransfer!=='projection'||metadata.triangleCount!==summary.triangles||!Number.isFinite(metadata.sourceVolumeMm3)||Math.abs(metadata.sourceVolumeMm3/summary.signedVolumeMm3-1)>1e-6)throw Error('Invalid saved STL mesh metadata');
 if(calculation?.options?.adaptive||input.conditions?.some(c=>c.planarRegion||c.cylindricalRegion?.exactCad||c.sphericalRegion)||mesh.planarPatches?.length||mesh.cylindricalPatches?.length||mesh.sphericalPatches?.length)throw Error('Saved STL meshes do not support adaptive refinement or exact CAD patches');
 if(typeof mesh.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(mesh.sourceHash))throw Error('Invalid saved STL source fingerprint');
 const display=input.meshes?.[0];
 if(input.meshes?.length!==1||!display||!['stl','gmsh-surface'].includes(display.kind))throw Error('Saved STL source requires one matching display surface');
 if(display.kind==='gmsh-surface'&&display.sourceHash!==mesh.sourceHash)throw Error('Saved STL display fingerprint does not match its volume mesh');
 if(display.kind==='stl'&&(!Array.isArray(display.positions)||display.positions.length!==source.positions.length||display.positions.some((v,i)=>v!==source.positions[i])||!Array.isArray(display.faceIds)||display.faceIds.length!==summary.triangles||display.faceIds.some((v,i)=>v!==i)))throw Error('STL display triangles do not match the original source');
 if(!Array.isArray(mesh.nodes)||!mesh.nodes.length||mesh.nodes.length%3||mesh.nodes.length>360000||!mesh.nodes.every(Number.isFinite)||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length||mesh.tetrahedra.length>30000)throw Error('Invalid saved STL volume mesh');
 let volume=0;
 for(const t of mesh.tetrahedra){
  if(!Array.isArray(t)||t.length!==4||new Set(t).size!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3))throw Error('Invalid saved STL tetrahedron');
  const p=t.map(i=>mesh.nodes.slice(3*i,3*i+3)),a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]),c=p[3].map((v,k)=>v-p[0][k]),v=Math.abs(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  if(!Number.isFinite(v)||v<1e-15)throw Error('Invalid saved STL tetrahedron volume');volume+=v;
 }
 if(!Number.isFinite(volume)||Math.abs(volume/summary.signedVolumeMm3-1)>1e-6)throw Error('Saved STL generated volume does not match its source shell');
 const planes=[],origin=summary.boundsMm.min,tolerance=summary.toleranceMm*2;
 for(let i=0;i<source.positions.length;i+=9){
  const a=source.positions.slice(i,i+3),u=source.positions.slice(i+3,i+6).map((v,k)=>v-a[k]),v=source.positions.slice(i+6,i+9).map((value,k)=>value-a[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...cross),normal=cross.map(value=>value/length),offset=a.reduce((sum,value,k)=>sum+(value-origin[k])*normal[k],0);
  if(!planes.some(p=>p.normal.every((value,k)=>Math.abs(value-normal[k])<1e-10)&&Math.abs(p.offset-offset)<=tolerance))planes.push({normal,offset});
 }
 if(!Array.isArray(mesh.surface)||!mesh.surface.length||mesh.surface.length>120000||mesh.surface.some(f=>!Array.isArray(f.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||!f.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3)))throw Error('Invalid saved STL boundary surface');
 // Deduplicate coplanar facets and bound archive work before testing geometry.
 if((mesh.nodes.length/3+mesh.surface.length*3)*planes.length>20000000)throw Error('Saved STL boundary consistency check exceeds its operation limit');
 const distance=(node,plane)=>plane.normal.reduce((sum,value,k)=>sum+(mesh.nodes[node*3+k]-origin[k])*value,0)-plane.offset;
 for(let node=0;node<mesh.nodes.length/3;node++)if(planes.some(plane=>{const d=distance(node,plane);return !Number.isFinite(d)||d>tolerance;}))throw Error('Saved STL volume mesh extends outside its convex source');
 for(const face of mesh.surface)if(!planes.some(plane=>face.nodes.every(node=>Math.abs(distance(node,plane))<=tolerance)))throw Error('Saved STL boundary triangles do not lie on the source facets');
}
