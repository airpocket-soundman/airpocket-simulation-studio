import test from 'node:test';import assert from 'node:assert/strict';
import {buildPlanarP1HeatTransferOperator as build,applyPlanarP1HeatTransferOperator as apply} from '../src/planar-p1-heat-operator.js';
const corners=[0,0,0,1,0,0,1,1,0,0,1,0];
const geometry=()=>({units:'mm',mesh:{nodes:[...corners,...corners,0,0,0]},sourceFaces:[{nodes:[0,1,2]},{nodes:[0,2,3]}],targetFaces:[{nodes:[4,7,5]},{nodes:[5,7,6]}]});
test('apply rejects nonnumeric coordinates even on unused nodes, matching the public build geometry gate',async()=>{
 const g=geometry(),operator=await build(g),field={units:'W/m2',values:[0,1,2,3].map(nodeId=>({nodeId,value:1}))};
 for(const value of [null,true,false,'invalid-coordinate','0']){
  const bad=structuredClone(g);bad.mesh.nodes[24]=value;const before=structuredClone(bad);
  await assert.rejects(apply(operator,bad,field),e=>e.code==='PLANAR_P1_HEAT_OPERATOR_INVALID');await assert.rejects(build(bad));assert.deepEqual(bad,before);
 }
});
test('independent exact crossing matrix is reciprocal under source/target exchange and field order has no effect',async()=>{
 // Each fixed quarter-square triangle uses int f*g=A/12*((sum f)(sum g)+sum f_i*g_i).
 // This rational oracle uses neither overlap clipping nor production barycentrics.
 const exact=[[5,1,1,1],[5,5,5,1],[1,1,5,1],[5,1,5,5]],g=geometry(),swapped={...g,sourceFaces:g.targetFaces,targetFaces:g.sourceFaces};
 const forward=await build(g),reverse=await build(swapped);
 for(let j=0;j<4;j++)for(let i=0;i<4;i++){
  const a=forward.rows[j].terms.find(t=>t.sourceNodeId===i).coefficientM2,b=reverse.rows[i].terms.find(t=>t.sourceNodeId===j+4).coefficientM2,expected=exact[j][i]/48*1e-6;
  assert.ok(Math.abs(a-expected)<1e-21);assert.ok(Math.abs(b-expected)<1e-21);
 }
 const q={units:'W/m2',values:[{nodeId:0,value:1},{nodeId:1,value:0},{nodeId:2,value:-1},{nodeId:3,value:0}]},before=structuredClone(q),a=await apply(forward,g,q),b=await apply(forward,g,{units:q.units,values:[...q.values].reverse()});
 assert.equal(a.fluxRevision,b.fluxRevision);assert.deepEqual(a.nodeHeatW,b.nodeHeatW);assert.deepEqual(q,before);assert.ok(Math.abs(a.sourceW)<1e-21);assert.ok(Math.abs(a.targetW)<1e-21);
 for(const [j,expected]of [1/12,0,-1/12,0].entries())assert.ok(Math.abs(a.nodeHeatW.get(j+4)-expected*1e-6)<1e-21);
});
