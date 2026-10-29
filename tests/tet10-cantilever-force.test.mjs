import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveElastic} from '../src/fem-core.js';
import {tet10FromTet4,tet10UniformFaceForces,solveTet10Elastic} from '../src/tet10-elastic.js';
// Synthetic cantilever (no real material): root z=0 clamped, uniform -y shear traction on the tip face z=L.
const E=2e9,nu=.3,b=20,h=3,L=60,F=10,I=b*h**3/12,Emm=E*1e-6,timoshenkoMm=F*L**3/(3*Emm*I)+F*L/(5/6*Emm/(2*(1+nu))*b*h);
function bar(nx,ny,nz){const nodes=[],tetrahedra=[],id=(i,j,k)=>(k*(ny+1)+j)*(nx+1)+i;for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)nodes.push(b*i/nx,h*j/ny,L*k/nz);for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=[id(i,j,k),id(i+1,j,k),id(i+1,j+1,k),id(i,j+1,k),id(i,j,k+1),id(i+1,j,k+1),id(i+1,j+1,k+1),id(i,j+1,k+1)];for(const t of [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]])tetrahedra.push(t.map(a=>c[a]));}return {nodes,tetrahedra};}
const clamp=mesh=>{const out=[];for(let n=0;n<mesh.nodes.length/3;n++)if(mesh.nodes[3*n+2]===0)for(let k=0;k<3;k++)out.push({node:n,direction:[0,1,2].map(i=>i===k?1:0),valueMm:0});return out;};
const tipY=(mesh,u)=>{let s=0,c=0;for(let n=0;n<mesh.nodes.length/3;n++)if(mesh.nodes[3*n+2]===L){s+=u[3*n+1];c++;}return s/c;};
test('Tet10 face forces sum to the applied load and sit on mid-edge nodes only',()=>{
 const mesh=tet10FromTet4(bar(2,1,4)),{areaMm2,forces}=tet10UniformFaceForces(mesh,(x,y,z)=>z===L,[0,-F,0]);
 assert.ok(Math.abs(areaMm2-b*h)<1e-9);assert.ok(Math.abs(forces.reduce((s,f)=>s+f.vectorN[1],0)+F)<1e-12);
 assert.ok(forces.every(f=>f.node>=mesh.cornerNodeCount));assert.throws(()=>tet10UniformFaceForces(mesh,()=>false,[0,-F,0]),/No Tet10/);
 assert.throws(()=>solveTet10Elastic(mesh,{youngModulus:E,poissonRatio:nu},{forces:[{node:-1,vectorN:[0,0,0]}]}),/nodal forces/);
});
test('Tet10 tip-loaded cantilever converges to beam theory while Tet4 on the same mesh locks',()=>{
 const ratios=[[2,1,8],[4,2,16]].map(n=>{const m=tet10FromTet4(bar(...n)),r=solveTet10Elastic(m,{youngModulus:E,poissonRatio:nu},{displacements:clamp(m),forces:tet10UniformFaceForces(m,(x,y,z)=>z===L,[0,-F,0]).forces});return -tipY(m,r.displacement)/timoshenkoMm;});
 // Fully clamped 3D root is slightly stiffer than the beam idealisation; refinement must approach it from below.
 for(const r of ratios)assert.ok(r>.93&&r<1.01,`${ratios}`);assert.ok(ratios[1]>ratios[0]&&ratios[1]-ratios[0]<.03,`${ratios}`);
 // Tet4 with the same one-element-through-thickness mesh: lumped tip load, far too stiff.
 const coarse=bar(2,1,8),tip=[];for(let n=0;n<coarse.nodes.length/3;n++)if(coarse.nodes[3*n+2]===L)tip.push(n);
 const r4=solveElastic(coarse,{youngModulus:E,poissonRatio:nu},{displacements:clamp(coarse),forces:tip.map(node=>({node,value:[0,-F/tip.length,0]}))},{method:'pcg-strict'});
 assert.ok(-tipY(coarse,r4.displacement)/timoshenkoMm<.6);
});
