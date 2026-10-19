import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractOpeningLoopCandidates} from '../src/opening-loop-candidates.js';

// Synthetic indexed triangle surfaces in mm. These are hand-written fixtures, not STEP
// or OCC outputs, and they only exercise the pure candidate detector.
function tube(zShift=0){
 const nodes=[-1,-1,0, 1,-1,0, 1,1,0+zShift, -1,1,0, -1,-1,10, 1,-1,10, 1,1,10, -1,1,10];
 const triangles=[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
 return {nodes,triangles,toleranceMm:1e-6};
}
const loopIds=result=>result.candidates.map(c=>c.id);

test('a rectangular tube wall exposes exactly two 4-point 4 mm2 end loops without mutating the caller',()=>{
 const input=tube(),before=structuredClone(input),result=extractOpeningLoopCandidates(input);
 assert.deepEqual(input,before);
 assert.equal(result.status,'checked');assert.equal(result.toleranceMm,1e-6);
 assert.equal(result.nodeCount,8);assert.equal(result.triangleCount,8);
 assert.equal(result.boundaryEdgeCount,8);assert.equal(result.closedShell,false);
 assert.deepEqual(loopIds(result),['loop:0,1,2,3','loop:4,5,6,7']);
 assert.deepEqual(result.rejected,[]);
 for(const candidate of result.candidates){
  assert.equal(candidate.nodeIndices.length,4);
  assert.equal(candidate.pointsMm.length,4);
  assert.ok(Math.abs(candidate.areaMm2-4)<=1e-10,'area '+candidate.areaMm2);
  assert.ok(candidate.plane.residualMm<=1e-6,'residual '+candidate.plane.residualMm);
  assert.equal(candidate.outward,'undetermined');
  assert.equal(candidate.convex,true);
  assert.ok(Math.abs(Math.hypot(...candidate.normal)-1)<1e-12);
  assert.ok(Math.abs(candidate.perimeterMm-8)<=1e-10);
  assert.deepEqual(candidate.triangleIndices,candidate.triangleIndices.slice().sort((a,b)=>a-b));
 }
});

test('candidate identity is canonical under triangle order, winding and cycle start',()=>{
 const base=tube(),reference=extractOpeningLoopCandidates(base);
 const shuffled=tube();
 shuffled.triangles=structuredClone(shuffled.triangles).reverse().map(t=>[t[2],t[1],t[0]]);
 const rotated=tube();rotated.nodes=[...rotated.nodes.slice(6),...rotated.nodes.slice(0,6)];rotated.triangles=rotated.triangles.map(t=>t.map(i=>(i+6)%8));
 const shuffledResult=extractOpeningLoopCandidates(shuffled),rotatedResult=extractOpeningLoopCandidates(rotated);
 assert.deepEqual(loopIds(shuffledResult),loopIds(reference));
 assert.deepEqual(shuffledResult.candidates.map(c=>c.areaMm2),reference.candidates.map(c=>c.areaMm2));
 assert.equal(rotatedResult.candidates.length,2);
 for(const candidate of rotatedResult.candidates){assert.equal(candidate.nodeIndices.length,4);assert.ok(Math.abs(candidate.areaMm2-4)<=1e-10);assert.equal(candidate.convex,true);}
});

test('a single out-of-plane opening vertex, a boundary branch and a non-manifold edge are refused',()=>{
 const shifted=extractOpeningLoopCandidates(tube(0.01));
 assert.deepEqual(loopIds(shifted),['loop:4,5,6,7']);
 assert.deepEqual(shifted.rejected.map(r=>r.code),['OPENING_LOOP_NONPLANAR']);

 const branch=extractOpeningLoopCandidates({nodes:[0,0,0, 1,0,0, 0,1,0, 0,0,1, 1,1,1],triangles:[[0,1,2],[0,3,4]],toleranceMm:1e-6});
 assert.deepEqual(branch.candidates,[]);
 assert.deepEqual(branch.rejected.map(r=>r.code),['OPENING_LOOP_BOUNDARY_BRANCH']);
 assert.deepEqual(branch.rejected[0].nodeIndices,[0]);

 const incidence=extractOpeningLoopCandidates({nodes:[0,0,0, 1,0,0, 0,1,0, 0,0,1, 1,1,0],triangles:[[0,1,2],[0,1,3],[0,1,4]],toleranceMm:1e-6});
 assert.deepEqual(incidence.candidates,[]);
 assert.ok(incidence.rejected.some(r=>r.code==='OPENING_LOOP_NONMANIFOLD_EDGE'));
 assert.deepEqual(incidence.rejected.find(r=>r.code==='OPENING_LOOP_NONMANIFOLD_EDGE').nodeIndices,[0,1]);
});

test('coincident coordinates with distinct ids and a bow-tie polygon are not treated as success',()=>{
 const seam={nodes:[0,0,0, 1,0,0, 1,1,0, 0,1,0, 1,0,0, 2,0,0, 2,1,0, 1,1,0],triangles:[[0,1,2],[0,2,3],[4,5,6],[4,6,7]],toleranceMm:1e-6};
 const seamResult=extractOpeningLoopCandidates(seam);
 assert.deepEqual(seamResult.candidates,[]);
 assert.deepEqual(seamResult.rejected.map(r=>r.code),['OPENING_LOOP_UNWELDED_SEAM','OPENING_LOOP_UNWELDED_SEAM']);

 const bowtie=extractOpeningLoopCandidates({nodes:[0,0,0, 3,3,0, 3,0,0, 0,1,0, 1,1,0.5],triangles:[[4,0,1],[4,1,2],[4,2,3],[4,3,0]],toleranceMm:1e-6});
 assert.deepEqual(bowtie.candidates,[]);
 assert.deepEqual(bowtie.rejected.map(r=>r.code),['OPENING_LOOP_SELF_INTERSECTING']);
});

test('a closed shell returns zero candidates and is distinguished from a shape with a boundary defect',()=>{
 const closed=extractOpeningLoopCandidates({nodes:[0,0,0, 1,0,0, 0,1,0, 0,0,1],triangles:[[0,2,1],[0,1,3],[0,3,2],[1,2,3]],toleranceMm:1e-6});
 assert.deepEqual(closed.candidates,[]);assert.deepEqual(closed.rejected,[]);
 assert.equal(closed.boundaryEdgeCount,0);assert.equal(closed.closedShell,true);
 const broken=extractOpeningLoopCandidates(tube(0.01));
 assert.equal(broken.closedShell,false);assert.ok(broken.rejected.length>0);
});

test('malformed input, non-finite coordinates, repeated vertices and non-positive tolerance are rejected',()=>{
 const bad={nodes:[0,0,0, 1,0,0, 0,1,0],triangles:[[0,1,2]],toleranceMm:1e-6};
 assert.throws(()=>extractOpeningLoopCandidates({...bad,nodes:[0,0,0,1,0,0,0,NaN]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,nodes:[0,0,0,1,0,0,Infinity,1,0]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,nodes:[0,0,0,1,0,0]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,triangles:[[0,1,0]]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,triangles:[[0,1,3]]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,triangles:[[0,1,1.5]]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,triangles:[]}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,toleranceMm:0}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,toleranceMm:-1e-6}));
 assert.throws(()=>extractOpeningLoopCandidates({...bad,toleranceMm:NaN}));
});
