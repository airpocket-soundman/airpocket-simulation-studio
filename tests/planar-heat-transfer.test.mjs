import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planarHeatTransfer} from '../src/planar-heat-transfer.js';

// Reference interface (synthetic): 10x10 mm square, z=0.
//   A: two triangles split by the P00-P11 diagonal, outward +z (nodes 0..3).
//   B: four triangles meeting at the centre (5,5), outward -z, a non-matching split
//      of the same square (nodes 4..8). A and B use separate node sets.
const reference=()=>({
  mesh:{nodes:[0,0,0, 10,0,0, 10,10,0, 0,10,0, 0,0,0, 10,0,0, 10,10,0, 0,10,0, 5,5,0]},
  facesA:[{nodes:[0,1,2]},{nodes:[0,2,3]}],
  facesB:[{nodes:[4,8,5]},{nodes:[5,8,6]},{nodes:[6,8,7]},{nodes:[7,8,4]}],
});

test('constant flux over a non-matching interface conserves heat and area',()=>{
  const {mesh,facesA,facesB}=reference();
  const result=planarHeatTransfer(mesh,facesA,facesB,1000);
  assert.ok(Math.abs(result.coveredAreaM2-1e-4)<1e-18,String(result.coveredAreaM2));
  assert.ok(Math.abs(result.sourceW-0.1)<1e-12,String(result.sourceW));
  assert.ok(Math.abs(result.targetW-0.1)<1e-12,String(result.targetW));
  assert.ok(Math.abs(result.balanceErrorW)<=1e-12,String(result.balanceErrorW));
  // Both sides recorded outward: Q_A + Q_B = 0.
  assert.ok(Math.abs(result.sourceW+result.targetOutwardW)<1e-15);
  assert.ok(Math.abs(result.targetOutwardW+0.1)<1e-12);
  const total=[...result.nodeHeatW.values()].reduce((s,v)=>s+v,0);
  assert.ok(Math.abs(total-result.targetW)<1e-15);
});

test('linear flux q(x)=1000+100000x W/m^2 integrates to 0.15 W and balances',()=>{
  const {mesh,facesA,facesB}=reference();
  const result=planarHeatTransfer(mesh,facesA,facesB,{base:1000,gradient:[100000,0,0]});
  assert.ok(Math.abs(result.sourceW-0.15)<1e-12,String(result.sourceW));
  assert.ok(Math.abs(result.targetW-0.15)<1e-12,String(result.targetW));
  assert.ok(Math.abs(result.sourceW+result.targetOutwardW)<1e-15);
  assert.ok(Math.abs(result.balanceErrorW)<=1e-12,String(result.balanceErrorW));
});

test('linear field matches the analytic nodal integral on a matching triangle',()=>{
  // Same triangle on both sides, A outward +z and B outward -z. Analytic nodal integrals
  // for q(x)=1000+100000*x_m over the right triangle (0,0)-(10,0)-(0,10) mm, where
  // int N_j dA = area/3 and int x N_j dA = a^3/24 (a=10 mm) for the two non-right-angle
  // nodes; total 1000*area + 100000*int x dA = 0.05 + 0.0166667 = 0.0666667 W.
  const mesh={nodes:[0,0,0, 10,0,0, 0,10,0, 0,0,0, 0,10,0, 10,0,0]};
  const result=planarHeatTransfer(mesh,[{nodes:[0,1,2]}],[{nodes:[3,4,5]}],{base:1000,gradient:[100000,0,0]});
  assert.ok(Math.abs(result.nodeHeatW.get(3)-0.020833333333333332)<1e-12,String(result.nodeHeatW.get(3)));
  assert.ok(Math.abs(result.nodeHeatW.get(4)-0.020833333333333332)<1e-12,String(result.nodeHeatW.get(4)));
  assert.ok(Math.abs(result.nodeHeatW.get(5)-0.025)<1e-12,String(result.nodeHeatW.get(5)));
  assert.ok(Math.abs(result.targetW-0.06666666666666667)<1e-12,String(result.targetW));
});

test('small totals are accepted on absolute balance error, not a 0/0 relative error',()=>{
  const {mesh,facesA,facesB}=reference();
  const result=planarHeatTransfer(mesh,facesA,facesB,1e-9);
  assert.ok(Math.abs(result.sourceW-1e-13)<1e-18,String(result.sourceW));
  assert.ok(Math.abs(result.balanceErrorW)<=1e-18,String(result.balanceErrorW));
});

test('rejects shared nodes, deficits, duplicates, holes, plane offset, degenerate faces, non-finite q and same-facing normals',()=>{
  const {mesh,facesA,facesB}=reference();
  // shared node sets
  assert.throws(()=>planarHeatTransfer(mesh,facesA,[{nodes:[0,1,2]}],1000),/separate nodes/);
  // 1% area deficit
  const deficit={...mesh,nodes:mesh.nodes.map((v,i)=>i>=12&&i%3<2?v*0.99:v)};
  assert.throws(()=>planarHeatTransfer(deficit,facesA,facesB,1000),/coverage/);
  // duplicate triangle
  assert.throws(()=>planarHeatTransfer(mesh,facesA,[...facesB,facesB[0]],1000),/coverage/);
  // 1% hole: drop one B triangle
  assert.throws(()=>planarHeatTransfer(mesh,facesA,facesB.slice(1),1000),/coverage/);
  // equal total area but an internal hole + overlap: shift one B triangle by 0.5 mm
  const shift=(p,d)=>[p[0]+d[0],p[1]+d[1],p[2]+d[2]],d=[0.5,0.5,0],shiftedMesh={nodes:[...mesh.nodes,...shift([0,0,0],d),...shift([5,5,0],d),...shift([10,0,0],d)]};
  assert.throws(()=>planarHeatTransfer(shiftedMesh,facesA,[{nodes:[9,10,11]},...facesB.slice(1)],1000),/coverage/);
  // 0.01 mm plane offset exceeds the default 1e-6 plane tolerance
  const offset={...mesh,nodes:mesh.nodes.map((v,i)=>i>=12&&i%3===2?v+0.01:v)};
  assert.throws(()=>planarHeatTransfer(offset,facesA,facesB,1000),/coincident/);
  // a looser plane tolerance accepts the same offset (0.01 < 0.02) and still balances
  assert.ok(Math.abs(planarHeatTransfer(offset,facesA,facesB,1000,{toleranceMm:0.02}).balanceErrorW)<=1e-12);
  // degenerate (collinear) face
  const degenerate={nodes:[0,0,0, 10,0,0, 0,10,0, 0,0,0, 5,0,0, 10,0,0]};
  assert.throws(()=>planarHeatTransfer(degenerate,[{nodes:[0,1,2]}],[{nodes:[3,4,5]}],1000),/Degenerate/);
  // non-finite heat flux density
  assert.throws(()=>planarHeatTransfer(mesh,facesA,facesB,{base:NaN}),/finite heat flux/);
  assert.throws(()=>planarHeatTransfer(mesh,facesA,facesB,{base:1000,gradient:[Infinity,0,0]}),/finite heat flux/);
  // same-facing normals are rejected, never auto-flipped
  assert.throws(()=>planarHeatTransfer(mesh,facesA,[{nodes:[4,5,8]},{nodes:[5,6,8]},{nodes:[6,7,8]},{nodes:[7,4,8]}],1000),/same-facing/);
});

test('rejects finite inputs whose intermediate or accumulated value leaves the finite range',()=>{
  // Synthetic guard case, not a physical model: 1e6 mm triangles with q=1e308 W/m^2
  // keep every input finite but make areaM2*q overflow.
  const overflow={nodes:[0,0,0, 1e6,0,0, 0,1e6,0, 0,0,0, 0,1e6,0, 1e6,0,0]};
  assert.throws(()=>planarHeatTransfer(overflow,[{nodes:[0,1,2]}],[{nodes:[3,4,5]}],1e308),/finite numeric range/);
  // A coordinate difference of two finite but huge coordinates also overflows.
  const huge={nodes:[1e308,0,0, -1e308,0,0, 0,1e308,0, 0,0,0, 0,1e6,0, 1e6,0,0]};
  assert.throws(()=>planarHeatTransfer(huge,[{nodes:[0,1,2]}],[{nodes:[3,4,5]}],1000),/finite numeric range/);
  // Ordinary zero and negative fluxes are physical inputs, not overflow, and must still work.
  const {mesh,facesA,facesB}=reference();
  const zero=planarHeatTransfer(mesh,facesA,facesB,0);
  assert.equal(zero.sourceW,0);
  assert.equal(zero.targetW,0);
  assert.equal(zero.balanceErrorW,0);
  const negative=planarHeatTransfer(mesh,facesA,facesB,-1000);
  assert.ok(Math.abs(negative.sourceW+0.1)<1e-12,String(negative.sourceW));
  assert.ok(Math.abs(negative.balanceErrorW)<=1e-12,String(negative.balanceErrorW));
});

test('does not mutate the mesh, faces or flux',()=>{
  const {mesh,facesA,facesB}=reference();
  const flux={base:1000,gradient:[100000,0,0]};
  const before=JSON.stringify({mesh,facesA,facesB,flux});
  planarHeatTransfer(mesh,facesA,facesB,flux);
  assert.equal(JSON.stringify({mesh,facesA,facesB,flux}),before);
});
