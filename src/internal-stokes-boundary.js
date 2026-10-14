import {validateFluidDomain} from './fluid-domain.js';
import {validateInternalMesh} from './internal-fluid.js';
import {outwardSurfaceNormals} from './surface-loads.js';

export const internalStokesScope=Object.freeze({schemaVersion:1,model:'steady-internal-creeping-flow',boundary:'explicit-piecewise-linear-velocity-on-all-ports',units:{position:'mm',velocity:'m/s',pressure:'Pa',flow:'m3/s'},maxReynoldsNumber:0.1,supportedVelocityElements:['P1','P2'],unsupported:['natural-pressure-outlet','inertia','turbulence','compressibility','moving-walls','arbitrary-plane-ports']});
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Ports contain {plane,nodes:[{node,velocityMs:[vx,vy,vz]}]}; no guessed outlet.
 * P2 edge velocities use the same linear trace, so P1/P2 prescribed flux agrees.
 * All returned maps and callback data are detached from caller-owned objects.
 */
export function internalStokesBoundary(mesh,source,settings={}){
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(k=>!['dynamicViscosity','density','ports','pressureGauge','relativeFlowTolerance'].includes(k)))throw Error('Unsupported internal Stokes boundary setting');
 const {dynamicViscosity,density,ports,pressureGauge,relativeFlowTolerance=1e-6}=settings;
 validateFluidDomain(source);
 if(source.mode!=='internal')throw Error('Internal Stokes requires an internal fluid domain');
 validateInternalMesh(mesh,source);
 if(!Number.isFinite(dynamicViscosity)||dynamicViscosity<=0||!Number.isFinite(density)||density<=0)throw Error('Internal Stokes requires positive viscosity and density');
 if(!Number.isFinite(relativeFlowTolerance)||relativeFlowTolerance<0||relativeFlowTolerance>1e-3)throw Error('Invalid internal Stokes flow tolerance');
 const n=mesh?.nodes?.length/3;
 if(!Number.isInteger(n)||n<4||n>2000||!mesh.nodes.every(Number.isFinite)||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length||mesh.tetrahedra.length>8000||!mesh.surface.length||mesh.surface.length>32000)throw Error('Internal Stokes mesh exceeds 2000 nodes / 8000 tetrahedra or is invalid');
 const point=node=>mesh.nodes.slice(3*node,3*node+3),key=ids=>ids.slice().sort((a,b)=>a-b).join(','),boundaryKeys=new Set();
 const adjacent=new Map();for(const t of mesh.tetrahedra){if(!Array.isArray(t)||t.length!==4||new Set(t).size!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<n))throw Error('Invalid internal Stokes tetrahedron');for(let k=0;k<4;k++){const id=key(t.filter((_,i)=>i!==k));adjacent.set(id,(adjacent.get(id)||0)+1);}}
 const tagPlane=new Map();for(const p of mesh.domainSelection.ports){if(tagPlane.has(p.faceTag))throw Error('Duplicate internal port face tag');tagPlane.set(p.faceTag,p.plane);}
 const portFaces=new Map(source.portPlanes.map(p=>[p,[]])),wallTags=new Set(),wallNodes=new Set(),boundaryNodes=new Set();
 for(const face of mesh.surface){if(!Array.isArray(face.nodes)||face.nodes.length!==3||new Set(face.nodes).size!==3||!face.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<n)||!Number.isInteger(face.faceTag)||face.faceTag<1||boundaryKeys.has(key(face.nodes))||adjacent.get(key(face.nodes))!==1)throw Error('Invalid or duplicate internal Stokes surface');boundaryKeys.add(key(face.nodes));face.nodes.forEach(i=>boundaryNodes.add(i));const plane=tagPlane.get(face.faceTag);
  if(plane!==undefined){if(face.portPlane!==plane)throw Error('Internal port tag does not match its plane');portFaces.get(plane).push(face);}
  else{if(face.portPlane!==undefined)throw Error('Undeclared internal port surface');wallTags.add(face.faceTag);face.nodes.forEach(i=>wallNodes.add(i));}
 }
 if([...adjacent].some(([id,count])=>count>2||count===1&&!boundaryKeys.has(id))||!wallTags.size)throw Error('Internal Stokes requires complete boundary and no-slip walls');
 if(!Array.isArray(ports)||ports.length!==source.portPlanes.length||ports.length<2)throw Error('Explicit velocity is required on every internal port');
 const velocity=new Map([...wallNodes].map(i=>[i,[0,0,0]])),specified=new Set();
 for(const p of ports){if(!p||!Number.isInteger(p.plane)||!portFaces.has(p.plane)||specified.has(p.plane)||Object.keys(p).some(k=>!['plane','nodes'].includes(k)))throw Error('Invalid, duplicate or unsupported internal port');specified.add(p.plane);const expected=new Set(portFaces.get(p.plane).flatMap(f=>f.nodes)),seen=new Set();
  if(!Array.isArray(p.nodes)||p.nodes.length!==expected.size)throw Error('Explicit velocity is required on every port node');
  for(const entry of p.nodes){if(!entry||!Number.isInteger(entry.node)||!expected.has(entry.node)||seen.has(entry.node)||!vector(entry.velocityMs)||Object.keys(entry).some(k=>!['node','velocityMs'].includes(k)))throw Error('Invalid or duplicate internal port node velocity');seen.add(entry.node);const value=entry.velocityMs.slice(),old=velocity.get(entry.node);if(old&&old.some((v,k)=>Math.abs(v-value[k])>1e-14))throw Error('Port velocity conflicts with no-slip wall or shared port node');velocity.set(entry.node,old??value);}
 }
 if([...boundaryNodes].some(i=>!velocity.has(i)))throw Error('Internal boundary velocity is incomplete');
 const normals=outwardSurfaceNormals(mesh),fluxes=new Map(source.portPlanes.map(p=>[p,0])),traces=[];
 mesh.surface.forEach((face,index)=>{const plane=tagPlane.get(face.faceTag);if(plane===undefined)return;const points=face.nodes.map(point),u=points[1].map((v,k)=>v-points[0][k]),v=points[2].map((v,k)=>v-points[0][k]),areaMm2=Math.hypot(...cross(u,v))/2,expectedNormal=[0,1,2].map(k=>k===plane%3?(plane<3?-1:1):0);if(dot(normals[index],expectedNormal)<1-1e-8)throw Error('Internal port normal does not match its enclosure plane');const values=face.nodes.map(i=>velocity.get(i).slice()),average=[0,1,2].map(k=>values.reduce((s,q)=>s+q[k]/3,0));fluxes.set(plane,fluxes.get(plane)+dot(average,normals[index])*areaMm2*1e-6);traces.push({plane,points,values,u,v,uu:dot(u,u),uv:dot(u,v),vv:dot(v,v)});});
 const netFlowM3s=[...fluxes.values()].reduce((a,b)=>a+b,0),absoluteFlowM3s=[...fluxes.values()].reduce((s,v)=>s+Math.abs(v),0),relativeFlowImbalance=Math.abs(netFlowM3s)/Math.max(absoluteFlowM3s,1e-300);
 if(!Number.isFinite(absoluteFlowM3s)||!Number.isFinite(netFlowM3s)||absoluteFlowM3s<=0||![...fluxes.values()].some(v=>v<0)||![...fluxes.values()].some(v=>v>0)||relativeFlowImbalance>relativeFlowTolerance)throw Error('Internal port flow is zero or imbalanced');
 const maxSpeedMs=Math.max(...[...velocity.values()].map(v=>Math.hypot(...v))),spans=[0,1,2].map(k=>Math.max(...[...wallNodes].map(i=>mesh.nodes[3*i+k]))-Math.min(...[...wallNodes].map(i=>mesh.nodes[3*i+k]))),referenceLengthMm=Math.max(...spans),reynoldsNumber=density*maxSpeedMs*referenceLengthMm*.001/dynamicViscosity;
 if(!Number.isFinite(reynoldsNumber)||reynoldsNumber>0.1+1e-12||!(referenceLengthMm>0))throw Error('Internal Stokes requires Reynolds number <= 0.1 using wall bounding-box length');
 const gauge=pressureGauge??{node:ports[0].nodes[0].node,valuePa:0};if(!gauge||!Number.isInteger(gauge.node)||!boundaryNodes.has(gauge.node)||!Number.isFinite(gauge.valuePa))throw Error('Invalid internal Stokes pressure gauge');
 const boundaryVelocityAtPoint=p=>{if(!vector(p))throw Error('Invalid internal boundary point');for(const t of traces){const axis=t.plane%3;if(Math.abs(p[axis]-t.points[0][axis])>1e-7)continue;const w=p.map((v,k)=>v-t.points[0][k]),wu=dot(w,t.u),wv=dot(w,t.v),den=t.uu*t.vv-t.uv*t.uv,a=(t.vv*wu-t.uv*wv)/den,b=(t.uu*wv-t.uv*wu)/den;if(a>=-1e-8&&b>=-1e-8&&a+b<=1+1e-8)return [0,1,2].map(k=>(1-a-b)*t.values[0][k]+a*t.values[1][k]+b*t.values[2][k]);}throw Error('Point is not on a declared internal port');};
 return {boundary:{velocity,bodyFaceTags:[...wallTags].sort((a,b)=>a-b),pressureGauge:{...gauge}},solverOptions:{referenceLengthMm,referenceVelocity:[maxSpeedMs,0,0],boundaryVelocityAtPoint},diagnostics:{portFluxes:[...fluxes].map(([plane,outwardFlowM3s])=>({plane,outwardFlowM3s})),netFlowM3s,absoluteFlowM3s,relativeFlowImbalance,reynoldsNumber,maxSpeedMs},scope:structuredClone(internalStokesScope)};
}


