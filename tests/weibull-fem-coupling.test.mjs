import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveElastic} from '../src/fem-core.js';
import {evaluateWeibullFailureOnMesh,tetraVolumesMm3} from '../src/weibull-fracture.js';
// Synthetic analytical parameters only; they describe no real material.
const data={model:'weibull-2p-volume-pia',weibullModulus:10,characteristicStrengthPa:1e8,referenceVolumeMm3:1000,source:'Synthetic analytical reference only',testConditions:'Synthetic uniform-tension specimens of reference volume',surfaceCondition:'Synthetic; volume flaws only'};
const E=1e11,h=10,b=10,L=40,m=data.weibullModulus,V=h*b*L;
// Structured bar x in [-h/2,h/2], y in [0,b], z in [0,L] (mm); each hexahedron split into six Tet4.
function bar(nx,ny,nz){const nodes=[],tetrahedra=[],id=(i,j,k)=>(k*(ny+1)+j)*(nx+1)+i;for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)nodes.push(-h/2+h*i/nx,b*j/ny,L*k/nz);for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const c=[id(i,j,k),id(i+1,j,k),id(i+1,j+1,k),id(i,j+1,k),id(i,j,k+1),id(i+1,j,k+1),id(i+1,j+1,k+1),id(i,j+1,k+1)];for(const t of [[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]])tetrahedra.push(t.map(q=>c[q]));}return {nodes,tetrahedra};}
// End faces carry u_z only (plane sections); lateral rigid motion is removed at two corner nodes.
function solve(mesh,uz){const displacements=[],count=mesh.nodes.length/3;let a,c;for(let n=0;n<count;n++){const [x,y,z]=mesh.nodes.slice(3*n,3*n+3);if(z===0||z===L)displacements.push({node:n,direction:[0,0,1],valueMm:uz(x,z)});if(z===0&&y===0&&x===-h/2)a=n;if(z===0&&y===0&&x===h/2)c=n;}displacements.push({node:a,direction:[1,0,0],valueMm:0},{node:a,direction:[0,1,0],valueMm:0},{node:c,direction:[0,1,0],valueMm:0});return solveElastic(mesh,{youngModulus:E,poissonRatio:0},{displacements},{method:'pcg-strict'});}
const close=(a,b,tolerance)=>assert.ok(Math.abs(a/b-1)<tolerance,`${a} != ${b}`);
test('mesh element volumes integrate the bar volume exactly',()=>{for(const n of [[2,2,4],[4,3,5]])close(tetraVolumesMm3(bar(...n)).reduce((a,b)=>a+b),V,1e-12);});
test('FEM uniform tension reproduces the closed-form Weibull probability through mesh volumes',()=>{
 const sigma=9e7,mesh=bar(3,3,6),r=solve(mesh,(x,z)=>sigma/E*z),f=evaluateWeibullFailureOnMesh(mesh,r,data);
 close(f.totalVolumeMm3,V,1e-12);close(f.peakPrincipalPa,sigma,1e-8);close(f.failureProbability,1-Math.exp(-V/1000*(sigma/1e8)**m),1e-8);close(f.effectiveVolumeMm3,V,1e-7);
});
test('pure-bending stress integrated over Tet4 element volumes converges to V/(2(m+1)) with order 2',()=>{
 // Exact nu=0 pure-bending field sigma_zz = sigma_max*2x/h sampled at element centroids: isolates the volume integration from Tet4 bending locking.
 const sigmaMax=1.1e8,reference=V/(2*(m+1))/1000*(sigmaMax/1e8)**m,errors=[];
 for(const nx of [16,32,64]){const mesh=bar(nx,1,1),stresses=mesh.tetrahedra.map(t=>{const x=t.reduce((s,i)=>s+mesh.nodes[3*i],0)/4;return [0,0,sigmaMax*2*x/h,0,0,0];}),f=evaluateWeibullFailureOnMesh(mesh,{kind:'elastic',stresses},data);close(f.totalVolumeMm3,V,1e-12);errors.push(Math.abs(f.riskOfRupture/reference-1));}
 assert.ok(errors[2]<5e-3,`${errors}`);const order=Math.log2(errors[1]/errors[2]);assert.ok(Math.abs(order-2)<.1,`order ${order} ${errors}`);
});
test('mesh coupling rejects mismatched or degenerate meshes',()=>{
 const mesh=bar(1,1,1),r=solve(mesh,(x,z)=>1e-4*z);
 assert.throws(()=>evaluateWeibullFailureOnMesh({...mesh,tetrahedra:mesh.tetrahedra.slice(1)},r,data),/one stress/);
 assert.throws(()=>evaluateWeibullFailureOnMesh({...mesh,tetrahedra:[[0,0,1,2],...mesh.tetrahedra.slice(1)]},r,data),/degenerate/);
 assert.throws(()=>evaluateWeibullFailureOnMesh({...mesh,tetrahedra:[[0,1,2,99],...mesh.tetrahedra.slice(1)]},r,data),/node indices/);
 assert.throws(()=>evaluateWeibullFailureOnMesh({nodes:[0,0]},r,data),/Tet4/);
});
