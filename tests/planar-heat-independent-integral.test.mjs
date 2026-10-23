import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planarHeatTransfer} from '../src/planar-heat-transfer.js';

// Synthetic manufactured field. Independent exact P1 mass-matrix integration
// on target triangles, with no overlap/clipping/barycentric production helpers.
const fixture=()=>({mesh:{nodes:[0,0,0,1,0,0,1,1,0,0,1,0,0,0,0,1,0,0,1,1,0,0,1,0,.5,.5,0]},facesA:[{nodes:[0,1,2]},{nodes:[0,2,3]}],facesB:[{nodes:[4,8,5]},{nodes:[5,8,6]},{nodes:[6,8,7]},{nodes:[7,8,4]}],flux:{base:1,gradient:[2000,0,0]}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-18+Math.abs(b)*1e-12,`${a} != ${b}`);
function exactTarget(f){
 const values=new Map();
 for(const face of f.facesB){
  const p=face.nodes.map(id=>f.mesh.nodes.slice(id*3,id*3+3)),u=p[1].map((v,k)=>v-p[0][k]),v=p[2].map((x,k)=>x-p[0][k]);
  const area=Math.sqrt((u[1]*v[2]-u[2]*v[1])**2+(u[2]*v[0]-u[0]*v[2])**2+(u[0]*v[1]-u[1]*v[0])**2)/2*1e-6;
  const q=p.map(point=>f.flux.base+point.reduce((sum,x,k)=>sum+x*.001*f.flux.gradient[k],0));
  face.nodes.forEach((id,i)=>values.set(id,(values.get(id)??0)+area/12*(q.reduce((a,b)=>a+b,0)+q[i])));
 }
 return values;
}
test('nonmatching affine field matches independent target nodal integrals after saved-input reload and rigid transforms',()=>{
 for(const transformed of [false,true])for(const sign of [1,-1]){
  const f=fixture();
  if(transformed){for(let i=0;i<f.mesh.nodes.length;i+=3){const [x,y,z]=f.mesh.nodes.slice(i,i+3);f.mesh.nodes.splice(i,3,7+z,-3+y,11-x);}f.flux={base:23,gradient:[0,0,-2000]};}
  f.flux.base*=sign;f.flux.gradient=f.flux.gradient.map(x=>x*sign);
  const before=JSON.stringify(f),reload=JSON.parse(before),actual=planarHeatTransfer(reload.mesh,reload.facesA,reload.facesB,reload.flux),expected=exactTarget(f);
  near(actual.sourceW,sign*2e-6);near(actual.targetW,sign*2e-6);near(actual.sourceW+actual.targetOutwardW,0);
  for(const [id,heat] of expected)near(actual.nodeHeatW.get(id),heat);
  assert.equal(JSON.stringify(f),before);
 }
});
test('unsupported polynomial orders and field keys are rejected rather than silently averaged',()=>{
 const f=fixture();for(const flux of [{...f.flux,quadratic:[1,0,0]},{...f.flux,degree:2},{...f.flux,baseW:3}])assert.throws(()=>planarHeatTransfer(f.mesh,f.facesA,f.facesB,flux),/constant or linear/);
});
test('partial overlap is explicitly refused without producing an unqualified heat total',()=>{
 const f=fixture();f.facesB=f.facesB.slice(1);assert.throws(()=>planarHeatTransfer(f.mesh,f.facesA,f.facesB,f.flux),/coverage/);
});
