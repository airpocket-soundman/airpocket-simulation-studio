import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveElastic} from '../src/fem-core.js';
import {evaluateWeibullFailureOnMesh} from '../src/weibull-fracture.js';
import {tet10FromTet4,tet10ElementStiffness,solveTet10Elastic,evaluateWeibullFailureTet10} from '../src/tet10-elastic.js';
// Synthetic analytical parameters only; they describe no real material.
const data={model:'weibull-2p-volume-pia',weibullModulus:10,characteristicStrengthPa:1e8,referenceVolumeMm3:1000,source:'Synthetic analytical reference only',testConditions:'Synthetic uniform-tension specimens of reference volume',surfaceCondition:'Synthetic; volume flaws only'};
const E=1e11,h=10,b=10,L=40,m=data.weibullModulus,V=h*b*L,sigmaMax=1.1e8,reference=V/(2*(m+1))/1000*(sigmaMax/1e8)**m;
function bar(nx,ny,nz){const nodes=[],tetrahedra=[],id=(i,j,k)=>(k*(ny+1)+j)*(nx+1)+i;for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)nodes.push(-h/2+h*i/nx,b*j/ny,L*k/nz);for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=[id(i,j,k),id(i+1,j,k),id(i+1,j+1,k),id(i,j+1,k),id(i,j,k+1),id(i+1,j,k+1),id(i+1,j+1,k+1),id(i,j+1,k+1)];for(const t of [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]])tetrahedra.push(t.map(q=>c[q]));}return {nodes,tetrahedra};}
// End faces carry u_z = kappa*x*z (plane sections, nu=0 pure bending); lateral rigid motion removed at two corners.
function boundary(mesh,uz){const displacements=[],count=mesh.nodes.length/3;let a,c;for(let n=0;n<count;n++){const [x,y,z]=mesh.nodes.slice(3*n,3*n+3);if(z===0||z===L)displacements.push({node:n,direction:[0,0,1],valueMm:uz(x,z)});if(z===0&&y===0&&x===-h/2)a=n;if(z===0&&y===0&&x===h/2)c=n;}displacements.push({node:a,direction:[1,0,0],valueMm:0},{node:a,direction:[0,1,0],valueMm:0},{node:c,direction:[0,1,0],valueMm:0});return {displacements};}
const bending=(x,z)=>sigmaMax*2*x/(h*E)*z;
test('Tet10 element stiffness is symmetric, annihilates rigid motion and reproduces Tet4 energy for linear fields',()=>{
 const mesh=tet10FromTet4({nodes:[0,0,0,3,0,0,0.5,2,0,1,0.7,4],tetrahedra:[[0,1,2,3]]}),t=mesh.tetrahedra[0],k=tet10ElementStiffness(mesh,t,{youngModulus:2e11,poissonRatio:.3}),scale=Math.max(...k.map(Math.abs));
 for(let i=0;i<30;i++)for(let j=0;j<30;j++)assert.ok(Math.abs(k[i*30+j]-k[j*30+i])<1e-12*scale);
 const apply=u=>Array.from({length:30},(_,i)=>u.reduce((s,v,j)=>s+k[i*30+j]*v,0)),xyz=i=>mesh.nodes.slice(3*i,3*i+3).map(v=>v*.001);
 for(const field of [p=>[1,0,0],p=>[0,0,1],p=>[-p[1],p[0],0],p=>[0,-p[2],p[1]]])assert.ok(Math.max(...apply(t.flatMap(i=>field(xyz(i)))).map(Math.abs))<1e-9*scale*1e-3);
 // Linear field: Tet10 energy equals Tet4 energy V*eps:D:eps for eps_xx=1e-3, eps_xy(engineering)=2e-3.
 const u=t.flatMap(i=>{const [x,y]=xyz(i);return [1e-3*x+1e-3*y,1e-3*x,0];}),energy=u.reduce((s,v,i)=>s+v*apply(u)[i],0);
 const lambda=2e11*.3/(1.3*.4),mu=2e11/2.6,volume=4e-9;assert.ok(Math.abs(energy/(volume*((lambda+2*mu)*1e-6+mu*4e-6))-1)<1e-12);
});
test('Tet10 matches Tet4 solveElastic exactly for uniform tension (nu=0.3)',()=>{
 const mesh=bar(2,2,3),p={youngModulus:E,poissonRatio:.3},tension=(x,z)=>1e-3*z,stress4=solveElastic(mesh,p,boundary(mesh,tension),{method:'pcg-strict'}).stresses,m10=tet10FromTet4(mesh),r=solveTet10Elastic(m10,p,boundary(m10,tension));
 assert.equal(m10.nodes.length/3,mesh.nodes.length/3+[...new Set(mesh.tetrahedra.flatMap(t=>[[0,1],[1,2],[2,0],[0,3],[1,3],[2,3]].map(([a,c])=>Math.min(t[a],t[c])+','+Math.max(t[a],t[c]))))].length);
 for(const g of r.gaussPoints)stress4[g.element].forEach((s,k)=>assert.ok(Math.abs(g.stress[k]-s)<1e-7*E*1e-3,`${k} ${g.stress[k]} ${s}`));
});
test('Tet4 bending locking: FE-solved Weibull risk stays far from V/(2(m+1)) on practical meshes',()=>{
 const errors=[[8,2,4],[16,2,8]].map(n=>{const mesh=bar(...n),r=solveElastic(mesh,{youngModulus:E,poissonRatio:0},boundary(mesh,bending),{method:'pcg-strict'});return evaluateWeibullFailureOnMesh(mesh,r,data).riskOfRupture/reference-1;});
 assert.ok(errors[0]>10&&errors[1]>1,`${errors}`);
});
test('Tet10 pure-bending stress is exact and Weibull risk converges to V/(2(m+1)) under refinement',()=>{
 const errors=[];
 for(const nx of [2,4,8,16]){const mesh=tet10FromTet4(bar(nx,1,1)),r=solveTet10Elastic(mesh,{youngModulus:E,poissonRatio:0},boundary(mesh,bending)),f=evaluateWeibullFailureTet10(r,data);
  for(const g of r.gaussPoints)assert.ok(Math.abs(g.stress[2]-sigmaMax*2*g.xMm[0]/h)<1e-9*sigmaMax&&[0,1,3,4,5].every(k=>Math.abs(g.stress[k])<1e-9*sigmaMax));
  assert.ok(Math.abs(f.totalVolumeMm3/V-1)<1e-12);errors.push(Math.abs(f.riskOfRupture/reference-1));}
 assert.ok(errors[3]<5e-4,`${errors}`);for(let i=1;i<4;i++)assert.ok(errors[i]<errors[i-1]/6,`${errors}`);
 const order=Math.log2(errors[2]/errors[3]);assert.ok(order>3.5,`order ${order}`);
});
test('Tet10 rejects invalid input',()=>{
 assert.throws(()=>tet10FromTet4({nodes:[0,0,0],tetrahedra:[[0,1,2,3]]}),/four valid/);
 const mesh=tet10FromTet4(bar(1,1,1));
 assert.throws(()=>solveTet10Elastic(bar(1,1,1),{youngModulus:E,poissonRatio:0},{}),/ten nodes/);
 assert.throws(()=>solveTet10Elastic(mesh,{youngModulus:E,poissonRatio:.5},{}),/elastic constants/);
 assert.throws(()=>solveTet10Elastic(mesh,{youngModulus:E,poissonRatio:0},{displacements:[{node:0,direction:[1,1,0],valueMm:0}]}),/unit axis/);
 assert.throws(()=>evaluateWeibullFailureTet10({gaussPoints:[]},data),/Gauss-point/);
});
