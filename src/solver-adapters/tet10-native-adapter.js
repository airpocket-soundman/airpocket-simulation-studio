import {structuralAdapter} from './structural-adapter.js';
import {tet10FromTet4,tet10UniformFaceForces,solveTet10Elastic} from '../tet10-elastic.js';
import {TET10_JOB_LIMITS,validateTet10JobProfile,tet10BoxFace,tet10Error} from '../tet10-job-profile.js';
import {resolveElasticMaterial} from '../material-dependence.js';
const edges=[[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]],key=(a,b)=>[Math.min(a,b),Math.max(a,b)].join(',');
export function solveNativeTet10Job(project,parent,boundary,options){
 validateTet10JobProfile(project,options,'elastic');
 if(parent.tetrahedra.length>TET10_JOB_LIMITS.parentElements||parent.nodes.length/3>TET10_JOB_LIMITS.nodes)throw tet10Error('Tet10 parent mesh capacity exceeded');
 const mesh=tet10FromTet4(parent);if(mesh.nodes.length/3>TET10_JOB_LIMITS.nodes)throw tet10Error('Tet10 quadratic node capacity exceeded');
 const mid=new Map();for(const t of mesh.tetrahedra)edges.forEach(([a,b],i)=>mid.set(key(t[a],t[b]),t[4+i]));
 mesh.surface=parent.surface.map(f=>{const[a,b,c]=f.nodes,nodes=[a,b,c,mid.get(key(a,b)),mid.get(key(b,c)),mid.get(key(c,a))];if(nodes.some(n=>!Number.isInteger(n)))throw tet10Error('Tet10 boundary face does not match a volume element');return{...f,nodes};});
 if(parent.nodeBodies)mesh.nodeBodies=Array(mesh.nodes.length/3).fill(0);if(parent.elementBodies)mesh.elementBodies=[...parent.elementBodies];mesh.elementOrder=2;mesh.elementType='Tet10';mesh.geometry='straight-affine';mesh.summary={...parent.summary,nodeCount:mesh.nodes.length/3,elementCount:mesh.tetrahedra.length,elementType:'Tet10',nodesPerElement:10,cornerNodeCount:mesh.cornerNodeCount,qualityBasis:'parent-corner-Tet4'};
 const fixed=new Set(),forces=new Map(),reports=[];for(let i=0;i<project.conditions.length;i++){const c=project.conditions[i],face=tet10BoxFace(project,c),onFace=(x,y,z)=>Math.abs([x,y,z][face.axis]-face.positionMm)<=face.toleranceMm;
  if(c.type==='fixed'){const nodes=[];for(let n=0;n<mesh.nodes.length/3;n++)if(onFace(...mesh.nodes.slice(3*n,3*n+3))){fixed.add(n);nodes.push(n);}reports.push({...boundary.reports[i],nodes,elementOrder:2});}
  else{const norm=Math.hypot(...c.direction),total=c.direction.map(x=>x/norm*c.value),load=tet10UniformFaceForces(mesh,onFace,total);if(Math.abs(load.areaMm2-face.areaMm2)>1e-7*Math.max(1,face.areaMm2))throw tet10Error('Tet10 force face area differs from the complete box face');for(const {node,vectorN}of load.forces){const f=forces.get(node)??[0,0,0];for(let k=0;k<3;k++)f[k]+=vectorN[k];forces.set(node,f);}reports.push({...boundary.reports[i],elementOrder:2,forceIntegration:'quadratic-consistent-mid-edges-only',faceCount:load.faceCount});}
 }
 const displacements=[...fixed].flatMap(node=>[0,1,2].map(k=>({node,direction:[0,1,2].map(j=>j===k?1:0),valueMm:0}))),nodalForces=[...forces].map(([node,vectorN])=>({node,vectorN}));
 const material=resolveElasticMaterial(project.materialProperties,20),solved=solveTet10Elastic(mesh,material.properties,{displacements,forces:nodalForces},TET10_JOB_LIMITS),magnitudes=Array.from({length:mesh.nodes.length/3},(_,n)=>Math.hypot(...solved.displacement.slice(3*n,3*n+3)));
 const gaussPoints=solved.gaussPoints.map(p=>{const [x,y,z,xy,yz,zx]=p.stress;return{...p,vonMisesPa:Math.sqrt(((x-y)**2+(y-z)**2+(z-x)**2)/2+3*(xy*xy+yz*yz+zx*zx))};});
 const result={...solved,kind:'elastic-tet10',elementOrder:2,representation:'straight-affine-Tet10-native-v1',provisional:true,method:'pcg-strict',materialEvaluation:material.evaluation,units:{coordinates:'mm',displacement:'mm',force:'N',stress:'Pa',volume:'mm3'},magnitudes,gaussPoints,maxDisplacementMm:Math.max(...magnitudes),maxVonMisesPa:Math.max(...gaussPoints.map(p=>p.vonMisesPa)),appliedForceN:nodalForces.reduce((sum,f)=>sum.map((x,k)=>x+f.vectorN[k]),[0,0,0]),viewSupported:false,pointSupported:false,compareSupported:false};
 if(!Number.isFinite(result.maxDisplacementMm)||!Number.isFinite(result.maxVonMisesPa)||!Number.isFinite(result.residual)||result.displacement.some(x=>!Number.isFinite(x)))throw tet10Error('Tet10 native result is non-finite');
 return{mesh,boundary:{fixed:[...fixed],forces:nodalForces.map(f=>[f.node,f.vectorN]),reports,elementOrder:2},result};
}
export const tet10NativeAdapter={kind:'structural',progressMessage:'Solving native straight Tet10 elasticity…',
 validate({phase,data}){validateTet10JobProfile(data.project,data.options,data.operation);structuralAdapter.validate({phase,data});},
 buildOptions(){return{maxElements:TET10_JOB_LIMITS.parentElements};},
 execute({data,mesh,boundary,observe}){const out=solveNativeTet10Job(data.project,mesh,boundary,data.options);Object.assign(mesh,out.mesh);Object.assign(boundary,out.boundary);observe({stage:'tet10-native-solve',elementOrder:2,residual:out.result.residual,iterations:out.result.iterations,converged:true});return out.result;}
};
