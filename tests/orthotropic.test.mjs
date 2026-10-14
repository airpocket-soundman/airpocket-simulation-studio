import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateOrthotropic,orthotropicElasticity} from '../src/orthotropic-material.js';
const axes=[[1,0,0],[0,1,0],[0,0,1]],data={model:'linear-orthotropic',youngModuliPa:[1e9,2e9,3e9],poissonRatios:[.1,.2,.1],shearModuliPa:[4e8,5e8,6e8],axes,source:'Synthetic analytical reference',testConditions:'Linear orthotropic constant-stress/strain reference; not measured print data'},multiply=(a,b)=>a.map(row=>row.reduce((sum,v,i)=>sum+v*b[i],0)),near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)),a+' != '+b);
test('orthotropic engineering compliance obeys cyclic Poisson definitions and reciprocity',()=>{
 const d=orthotropicElasticity(data),[e1,e2,e3]=data.youngModuliPa,[n12,n23,n31]=data.poissonRatios,compliance=[[1/e1,-n12/e1,-n31/e3],[-n12/e1,1/e2,-n23/e2],[-n31/e3,-n23/e2,1/e3]];
 for(let column=0;column<3;column++){const strain=[...compliance.map(r=>r[column]),0,0,0],stress=multiply(d,strain);stress.forEach((v,i)=>near(v,i===column?1:0));}for(let i=3;i<6;i++)near(d[i][i],data.shearModuliPa[i-3]);
});
test('orthotropic isotropic limit equals Lamé engineering-strain stiffness in every orientation',()=>{
 const E=2e9,nu=.3,G=E/(2*(1+nu)),q=Math.SQRT1_2,rotated=[[q,q,0],[-q,q,0],[0,0,1]];
 for(const frame of [axes,rotated]){const d=orthotropicElasticity({...data,youngModuliPa:[E,E,E],poissonRatios:[nu,nu,nu],shearModuliPa:[G,G,G],axes:frame}),lambda=E*nu/((1+nu)*(1-2*nu));for(let i=0;i<6;i++)for(let j=0;j<6;j++)near(d[i][j],i<3&&j<3?lambda+(i===j?2*G:0):i===j?G:0);}
});
test('material-frame rotations permute directional stiffness and preserve positive strain energy',()=>{
 const base=orthotropicElasticity(data),rotated=orthotropicElasticity({...data,axes:[[0,1,0],[0,0,1],[1,0,0]]});near(rotated[0][0],base[2][2]);near(rotated[1][1],base[0][0]);near(rotated[3][3],base[5][5]);for(const e of [[1,0,0,0,0,0],[.1,-.2,.3,.4,-.5,.6],[0,0,0,1,1,1]])assert.ok(multiply(rotated,e).reduce((s,v,i)=>s+v*e[i],0)>0);
});
test('unstable orthotropic constants, invalid axes and missing calibration records are rejected',()=>{
 for(const mutate of [d=>d.source='',d=>d.testConditions='',d=>d.youngModuliPa[0]=0,d=>d.poissonRatios=[.99,.99,.99],d=>d.axes[1]=[1,0,0],d=>d.axes[2]=[0,0,-1],d=>d.model='unknown',d=>d.invented=1]){const d=structuredClone(data);mutate(d);assert.throws(()=>validateOrthotropic(d));}
});
import {solveElastic} from '../src/fem-core.js';
import {validateMaterialProperties,materialReadiness} from '../src/materials.js';
import {resolveElasticMaterial} from '../src/material-dependence.js';
import {validateOrthotropicResult} from '../src/orthotropic-result.js';
import {wasmMatvecFactory} from '../src/wasm-matvec.js';
import {readFileSync} from 'node:fs';
const mesh={nodes:[0,0,0,10,0,0,0,10,0,0,0,10],tetrahedra:[[0,1,2,3]]},linear={...data,poissonRatios:[0,0,0]},boundary={fixed:[0],displacements:[{node:1,direction:[0,1,0],valueMm:0},{node:1,direction:[0,0,1],valueMm:0},{node:2,direction:[1,0,0],valueMm:0},{node:2,direction:[0,0,1],valueMm:0},{node:3,direction:[1,0,0],valueMm:0},{node:3,direction:[0,1,0],valueMm:0}],forces:[{node:3,value:[0,0,1]}]};
test('orthotropic loaded Tet4 matches analytical directional displacement, reaction and WASM',async()=>{
 const {instance}=await WebAssembly.instantiate(readFileSync('public/fem-kernel.wasm'));
 for(const [frame,E] of [[axes,3e9],[[[0,1,0],[0,0,1],[1,0,0]],2e9]]){
  const p={orthotropic:{...linear,axes:frame}},js=solveElastic(mesh,p,boundary,{method:'pcg-strict'}),wasm=solveElastic(mesh,p,boundary,{method:'wasm-pcg',matvecFactory:wasmMatvecFactory(instance)});
  near(js.displacement[11],1*.01**2/(E*(.01**3/6))*1000);near(js.reaction[2],-1);near(js.stresses[0][2],60000);js.displacement.forEach((v,i)=>near(v,wasm.displacement[i]));assert.deepEqual(js.orthotropic,p.orthotropic);
 }
});
test('rotating geometry, loads, supports and material axes preserves the physical solution',()=>{
 const q=Math.SQRT1_2,rotate=([x,y,z])=>[q*x+q*z,y,-q*x+q*z],base=solveElastic(mesh,{orthotropic:data},boundary,{method:'pcg-strict'}),rotatedMesh={...mesh,nodes:Array.from({length:4},(_,i)=>rotate(mesh.nodes.slice(i*3,i*3+3))).flat()},rotatedBoundary={fixed:boundary.fixed,displacements:boundary.displacements.map(v=>({...v,direction:rotate(v.direction)})),forces:boundary.forces.map(v=>({...v,value:rotate(v.value)}))},r=solveElastic(rotatedMesh,{orthotropic:{...data,axes:axes.map(rotate)}},rotatedBoundary,{method:'pcg-strict'});
 for(let i=0;i<4;i++)rotate(base.displacement.slice(i*3,i*3+3)).forEach((v,j)=>near(r.displacement[i*3+j],v));near(r.maxVonMisesPa,base.maxVonMisesPa);rotate(base.reaction).forEach((v,i)=>near(r.reaction[i],v));
});
test('orthotropic pure engineering shear patch uses the specified shear modulus',()=>{
 const gamma=.002,displacements=Array.from({length:4},(_,node)=>axes.map((direction,i)=>({node,direction,valueMm:i===0?gamma*mesh.nodes[node*3+1]:0}))).flat(),r=solveElastic(mesh,{orthotropic:data},{displacements},{method:'pcg-strict'});
 r.strains[0].forEach((v,i)=>near(v,i===3?gamma:0));r.stresses[0].forEach((v,i)=>near(v,i===3?data.shearModuliPa[0]*gamma:0));
});
test('orthotropic materials require compatible models and retain legacy incomplete-axis rejection',()=>{
 assert.deepEqual(materialReadiness('樹脂',{orthotropic:data}).linearElasticMissing,[]);assert.deepEqual(resolveElasticMaterial({orthotropic:data}).properties.orthotropic,data);
 for(const extra of [{plasticity:{}},{hyperelastic:{}},{fatigueData:{}},{fractureData:{}},{dependence:{directionality:'isotropic'}},{dependence:{directionality:'orthotropic',axes:[[0,1,0],[0,0,1],[1,0,0]]}}])assert.throws(()=>validateMaterialProperties({orthotropic:data,...extra}));
 assert.throws(()=>resolveElasticMaterial({dependence:{directionality:'orthotropic',axes}}));for(const options of [{method:'mfem-wasm'},{method:'webgpu-pcg'},{temperature:30}])assert.throws(()=>solveElastic(mesh,{orthotropic:data,expansion:1e-5},boundary,options));
});
test('saved orthotropic fields reject altered constants, axes, provenance, stresses and displacement',()=>{
 const input={study:{kind:'structural'},materialProperties:{orthotropic:data}},calculation={options:{method:'pcg-strict'}},r=solveElastic(mesh,input.materialProperties,boundary,calculation.options);validateOrthotropicResult(mesh,r,input,calculation);
 for(const mutate of [v=>v.orthotropic.source='other',v=>v.orthotropic.axes= [[0,1,0],[0,0,1],[1,0,0]],v=>v.orthotropic.youngModuliPa[0]*=2,v=>v.stresses[0][0]+=100,v=>v.strains[0][0]+=.01,v=>v.displacement[11]+=.1,v=>delete v.orthotropic]){const changed=structuredClone(r);mutate(changed);assert.throws(()=>validateOrthotropicResult(mesh,changed,input,calculation));}
 assert.throws(()=>validateOrthotropicResult(mesh,r,{...input,study:{kind:'structural',thermalStress:true}},calculation));
});
