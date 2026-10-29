import {elementGeometry,pcg} from './fem-core.js';
import {evaluateWeibullFailure} from './weibull-fracture.js';
// Minimal quadratic tetrahedron (Tet10) for linear isotropic elasticity. Nodes in mm, stresses in Pa.
// Node order: corners 0-3, then mid-edges 01,12,20,03,13,23. Straight edges only (affine geometry).
const EDGES=[[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]],GA=.5854101966249685,GB=.1381966011250105;
// Four-point degree-2 rule: exact for the stiffness of affine Tet10 (B linear, B^T D B quadratic).
export const TET10_GAUSS=[0,1,2,3].map(i=>[0,1,2,3].map(j=>i===j?GA:GB));
export function tet10FromTet4(mesh){
 if(!mesh?.nodes||mesh.nodes.length%3||!Array.isArray(mesh.tetrahedra)||!mesh.tetrahedra.length)throw Error('Tet10 conversion requires Tet4 nodes and tetrahedra');
 const count=mesh.nodes.length/3,nodes=Array.from(mesh.nodes),mid=new Map();
 const tetrahedra=mesh.tetrahedra.map(t=>{if(!Array.isArray(t)||t.length!==4||!t.every(i=>Number.isInteger(i)&&i>=0&&i<count))throw Error('Tet10 conversion requires four valid node indices per tetrahedron');
  return [...t,...EDGES.map(([a,b])=>{const key=Math.min(t[a],t[b])+','+Math.max(t[a],t[b]);if(!mid.has(key)){mid.set(key,nodes.length/3);for(let k=0;k<3;k++)nodes.push((nodes[3*t[a]+k]+nodes[3*t[b]+k])/2);}return mid.get(key);})];});
 return {nodes,tetrahedra,cornerNodeCount:count};
}
// Shape-function gradients (1/m) at barycentric point L, from corner gradients g.
function gradients(g,L){const d=[0,1,2,3].map(i=>g[i].map(v=>(4*L[i]-1)*v));for(const [a,b]of EDGES)d.push(g[a].map((v,k)=>4*(L[a]*g[b][k]+L[b]*v)));return d;}
function strainMatrix(d){const b=Array.from({length:6},()=>Array(30).fill(0));d.forEach(([x,y,z],a)=>{const i=a*3;b[0][i]=x;b[1][i+1]=y;b[2][i+2]=z;b[3][i]=y;b[3][i+1]=x;b[4][i+1]=z;b[4][i+2]=y;b[5][i]=z;b[5][i+2]=x;});return b;}
function elasticity(E,nu){const l=E*nu/((1+nu)*(1-2*nu)),mu=E/(2*(1+nu));return [0,1,2,3,4,5].map(i=>[0,1,2,3,4,5].map(j=>i<3&&j<3?l+(i===j?2*mu:0):i===j?mu:0));}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function element(mesh,t,d){const geo=elementGeometry(mesh,t.slice(0,4));if(!(geo.volume>0))throw Error('Tet10 requires non-degenerate tetrahedra');
 return {geo,points:TET10_GAUSS.map(L=>{const b=strainMatrix(gradients(geo.grad,L)),db=d.map(r=>b[0].map((_,j)=>r.reduce((s,v,c)=>s+v*b[c][j],0)));return {L,b,db,weight:geo.volume/4};})};}
export function tet10ElementStiffness(mesh,t,{youngModulus:E,poissonRatio:nu}){const {points}=element(mesh,t,elasticity(E,nu)),k=new Float64Array(900);
 for(const {b,db,weight}of points)for(let i=0;i<30;i++)for(let j=0;j<30;j++){let s=0;for(let a=0;a<6;a++)s+=b[a][i]*db[a][j];k[i*30+j]+=weight*s;}return k;}
// Displacement constraints along global axes only: {node, direction:[unit axis], valueMm}.
export function solveTet10Elastic(mesh,properties,{displacements=[]},{tolerance=1e-10,maxIterations=20000}={}){
 const {youngModulus:E,poissonRatio:nu}=properties;if(!(E>0)||!Number.isFinite(nu)||nu<=-1||nu>=.49)throw Error('Valid elastic constants required');
 if(!mesh.tetrahedra.every(t=>t.length===10))throw Error('Tet10 solve requires ten nodes per tetrahedron');
 const n=mesh.nodes.length,d=elasticity(E,nu),dirichlet=new Map();
 for(const {node,direction,valueMm}of displacements){const axis=direction.findIndex(v=>v!==0);if(axis<0||direction.some((v,k)=>k===axis?v!==1:v!==0)||!Number.isInteger(node)||node<0||node>=n/3)throw Error('Tet10 displacement constraints must use a valid node and a global unit axis');dirichlet.set(node*3+axis,valueMm*.001);}
 const elements=mesh.tetrahedra.map(t=>element(mesh,t,d)),entries=mesh.tetrahedra.map(t=>({ids:t.flatMap(i=>[i*3,i*3+1,i*3+2]),k:tet10ElementStiffness(mesh,t,properties)}));
 const r=pcg(n,entries,new Float64Array(n),dirichlet,{tolerance,maxIterations}),u=r.solution;
 // Stress recovery at the Gauss points (stress is linear inside each affine Tet10).
 const gaussPoints=[];elements.forEach(({points},e)=>{const local=entries[e].ids.map(i=>u[i]);for(const {L,db,weight}of points){const t=mesh.tetrahedra[e];gaussPoints.push({element:e,volumeMm3:weight*1e9,xMm:[0,1,2].map(k=>t.slice(0,4).reduce((s,i,a)=>s+L[a]*mesh.nodes[3*i+k],0)),stress:db.map(row=>dot(row,local))});}});
 return {kind:'elastic',engine:'Airpocket Tet10 / JavaScript CPU',displacement:Array.from(u,v=>v*1000),gaussPoints,iterations:r.iterations,residual:r.residual};
}
// Weakest-link sum over Gauss points: each point carries a quarter of its element volume.
export function evaluateWeibullFailureTet10(result,data){
 if(!Array.isArray(result?.gaussPoints)||!result.gaussPoints.length)throw Error('Tet10 Weibull assessment requires Gauss-point stresses');
 const volumes=result.gaussPoints.map(p=>p.volumeMm3);
 return {...evaluateWeibullFailure({kind:'elastic',stresses:result.gaussPoints.map(p=>p.stress)},volumes,data),totalVolumeMm3:volumes.reduce((a,b)=>a+b,0)};
}
