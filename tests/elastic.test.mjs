import {test} from 'node:test';import assert from 'node:assert/strict';import initialize from '@loumalouomega/gmsh-wasm';import {generateMesh} from '../src/mesh-core.js';import {solveElastic,principalStresses} from '../src/fem-core.js';
test('axial bar reference solution and reaction balance',async()=>{
 const mesh=await generateMesh(initialize,{kind:'box',bounds:[0,0,0,10,10,40]},{size:4});const fixed=[],end=[];
 for(let i=0;i<mesh.nodes.length/3;i++){if(Math.abs(mesh.nodes[i*3+2])<1e-7)fixed.push(i);if(Math.abs(mesh.nodes[i*3+2]-40)<1e-7)end.push(i);}
 // Uniform traction assembled over triangles, rather than equally over nodes.
 const forces=new Map();for(const s of mesh.surface)if(s.nodes.every(i=>end.includes(i))){const p=s.nodes.map(i=>mesh.nodes.slice(i*3,i*3+3)),a=p[1].map((v,k)=>v-p[0][k]),b=p[2].map((v,k)=>v-p[0][k]),area=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;for(const i of s.nodes)forces.set(i,(forces.get(i)||0)+area/3);}
 const result=solveElastic(mesh,{youngModulus:1e9,poissonRatio:0},{fixed,forces:[...forces].map(([node,f])=>({node,value:[0,0,f]}))});
 const expected=100*.04/(1e9*.0001)*1000,average=end.reduce((v,i)=>v+result.displacement[i*3+2],0)/end.length;
 assert.ok(Math.abs(average/expected-1)<1e-6);assert.ok(Math.abs(result.reaction[2]+100)<1e-5);assert.ok(result.residual<1e-8);
});
test('principal stresses preserve pure shear eigenvalues',()=>{const p=principalStresses([0,0,0,5,0,0]);assert.ok(Math.abs(p[0]-5)<1e-12);assert.ok(Math.abs(p[2]+5)<1e-12);});
