import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractOpeningLoopCandidates} from '../src/opening-loop-candidates.js';
import {confirmOpeningCandidate} from '../src/opening-candidate-cap.js';
// Synthetic 2 x 2 x 10 mm box, with its top face removed.
function fixture(){
 const mesh={nodes:[-1,-1,0,1,-1,0,1,1,0,-1,1,0,-1,-1,10,1,-1,10,1,1,10,-1,1,10],triangles:[[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7],[0,2,1],[0,3,2]],toleranceMm:1e-6};
 return {mesh,meshVersion:7,enclosure:[-2,-2,-1,4,4,12],confirmation:{confirmed:true,meshVersion:7,capId:'top',candidate:extractOpeningLoopCandidates(mesh).candidates[0],outwardNormal:[0,0,1],interiorPointMm:[0,0,5]}};
}
test('confirmed box opening preserves identity, version, tolerance and explicit outward cap',()=>{
 const input=fixture(),before=structuredClone(input),out=confirmOpeningCandidate(input);
 assert.deepEqual(input,before);assert.equal(out.status,'confirmed');assert.equal(out.meshVersion,7);assert.equal(out.toleranceMm,1e-6);assert.deepEqual(out.nodeIndices,[4,5,6,7]);
 assert.deepEqual(out.source.openingCaps,[{id:'top',point:[0,0,10],normal:[0,0,1]}]);
 out.nodeIndices[0]=99;out.source.openingCaps[0].normal[2]=-1;assert.deepEqual(input,before);
});
test('unconfirmed, stale, tampered, reversed and inconsistent confirmations fail without mutation',()=>{
 for(const change of [x=>x.confirmation.confirmed=false,x=>x.confirmation.meshVersion=6,x=>x.confirmation.candidate.pointsMm[0][0]+=1,x=>x.confirmation.candidate.triangleIndices=[],x=>x.confirmation.outwardNormal=[0,0,-1],x=>x.confirmation.outwardNormal=[1,0,0],x=>x.confirmation.outwardNormal=[0,0,2],x=>x.confirmation.interiorPointMm=[0,0,10],x=>x.mesh.nodes[12]+=0.1]){
  const input=fixture();change(input);const before=structuredClone(input);assert.throws(()=>confirmOpeningCandidate(input));assert.deepEqual(input,before);
 }
});
test('normal sign is chosen explicitly, independent of canonical loop winding',()=>{
 const input=fixture();input.confirmation.outwardNormal=[0,0,-1];input.confirmation.interiorPointMm=[0,0,10.5];
 assert.deepEqual(confirmOpeningCandidate(input).source.openingCaps[0].normal,[0,0,-1]);
});
test('duplicate faces and unresolved seam invalidate old candidate',()=>{
 for(const change of [x=>x.mesh.triangles.push([...x.mesh.triangles[0]]),x=>{x.mesh.nodes.push(...x.mesh.nodes.slice(12,15));x.mesh.triangles[0][2]=8;}]){
  const input=fixture();change(input);const before=structuredClone(input);assert.throws(()=>confirmOpeningCandidate(input));assert.deepEqual(input,before);
 }
});
