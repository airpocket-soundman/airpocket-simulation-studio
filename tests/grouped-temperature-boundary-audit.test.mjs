import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildGroupedTemperatureOperator as build,loadGroupedTemperatureOperator as load,serializeGroupedTemperatureOperator as serialize,applyGroupedTemperatureOperator as apply} from '../src/grouped-temperature-operator.js';
import {getProjectRevision} from '../src/project-revision.js';

// Independent explicit fixtures: no production clipping/intersection helpers.
function pair(nodes,faces){const n=nodes.length/3;return {units:'mm',mesh:{nodes:[...nodes,...nodes]},sourceFaces:faces.map(nodes=>({nodes})),targetFaces:faces.map(ids=>({nodes:[ids[0]+n,ids[2]+n,ids[1]+n]})),groups:faces.map((_,i)=>({groupId:'g'+i,sourceFaceIds:[i],targetFaceIds:[i]}))};}
const separate=triangles=>pair(triangles.flat(2),triangles.map((_,i)=>[3*i,3*i+1,3*i+2]));
const base=()=>separate([[[0,0,0],[1,0,0],[0,1,0]],[[0,0,2],[1,0,2],[0,1,2]]]);

test('independent boundary contacts require exact shared IDs: coplanar point/edge and noncoplanar tangency',async()=>{
 const A=[[0,0,0],[1,0,0],[0,1,0]];
 const refused=[
  [A,[[0,0,0],[-1,0,0],[0,-1,0]]], // coplanar point, distinct IDs
  [A,[[0,0,0],[1,0,0],[0,-1,0]]], // coplanar edge, distinct IDs
  [A,[[.2,.2,0],[.2,.2,1],[.7,.2,1]]], // vertex touches face interior
  [A,[[.2,0,0],[.8,0,0],[.5,0,1]]], // subedge touches boundary edge
 ];
 for(const triangles of refused){const g=separate(triangles),before=structuredClone(g);await assert.rejects(build(g),/shared global node\/edge/);assert.deepEqual(g,before);}
 // Shared origin only: same global ID in each side, and otherwise disjoint.
 const point=pair([0,0,0,1,0,0,0,1,0,-1,0,1,0,-1,1],[[0,1,2],[0,3,4]]);
 assert.equal((await build(point)).groups.length,2);
 // Shared edge IDs with coplanar adjacent triangles are allowed.
 const edge=pair([0,0,0,1,0,0,0,1,0,0,-1,0],[[0,1,2],[1,0,3]]);
 assert.equal((await build(edge)).groups.length,2);
 // A shared vertex does not authorize an intersection extending into the face.
 const crossing=pair([0,0,0,1,0,0,0,1,0,.4,.4,-1,.4,.4,1],[[0,1,2],[0,3,4]]);
 await assert.rejects(build(crossing),/shared global node\/edge/);
});

test('full explicit face assignment and all coordinates remain bound across compile/apply/load',async()=>{
 const g=base(),op=await build(g),raw=serialize(op),field={units:'degC',values:[0,1,2,3,4,5].map(nodeId=>({nodeId,value:20+nodeId}))};
 for(const mutate of [x=>x.groups[0].sourceFaceIds=[0,0],x=>x.groups[1].targetFaceIds=[],x=>x.groups[1].sourceFaceIds=[2],x=>x.groups[0].unknown=1,x=>x.sourceFaces[0].nodes[0]=null]){const bad=structuredClone(g);mutate(bad);await assert.rejects(build(bad));await assert.rejects(load(raw,bad));}
 const extra=structuredClone(g);extra.mesh.nodes.push(40,40,40);await assert.rejects(apply(op,extra,field),/revision mismatch/);await assert.rejects(load(raw,extra),/differ/);
 let reads=0;const accessor=base();Object.defineProperty(accessor.groups[0],'sourceFaceIds',{enumerable:true,get(){reads++;throw Error('must not run');}});await assert.rejects(load(raw,accessor));assert.equal(reads,0);
 const before=structuredClone(g),pending=load(raw,g);g.groups[0].groupId='late';g.mesh.nodes[0]=999;assert.equal(serialize((await pending).operator),raw);assert.equal((await load(raw,before)).source.rawIdentity,'sha256:'+createHash('sha256').update(raw).digest('hex'));
});

test('serialized provenance cannot replace rederived geometry, group assignment or normalized matrices',async()=>{
 const g=base(),op=await build(g),raw=serialize(op);
 for(const mutate of [x=>x.geometryRevision='sha256:'+'0'.repeat(64),x=>x.groups[0].operatorRevision='sha256:'+'0'.repeat(64),x=>x.groups[0].targetFaceIds=[1],x=>x.groups.reverse(),x=>x.massNormalized[0][0]+=1e-5,x=>x.rows[0].coefficients[0]+=1e-5,x=>x.sourceIds.reverse()]){
  const altered=JSON.parse(raw);mutate(altered);const {operatorRevision,...payload}=altered;altered.operatorRevision=await getProjectRevision(payload);await assert.rejects(load(JSON.stringify(altered),g),/differ/);
 }
 await assert.rejects(load(raw+' '.repeat(1048577),g),/capacity/);
 await assert.rejects(load(raw.replace('"conditionInfinity":','"conditionInfinity":1e999,"discarded":'),g));
 await assert.rejects(load('['.repeat(21)+']'.repeat(21),g),/depth/);
});
test('bounded snapshot rejects oversized, sparse and nonfinite unused data before compiling local groups',async()=>{
 for(const mutate of [x=>x.mesh.nodes=Array(4097*3).fill(0),x=>x.sourceFaces=Array.from({length:513},()=>({nodes:[0,1,2]})),x=>x.groups=Array.from({length:9},(_,i)=>({groupId:'g'+i,sourceFaceIds:[0],targetFaceIds:[0]})),x=>x.mesh.nodes.push(1e6+1,0,0),x=>x.mesh.nodes.push(null,0,0),x=>x.mesh.nodes.push(Infinity,0,0),x=>x.groups[0].groupId='x'.repeat(1025),x=>{x.groups[0].sourceFaceIds=[];x.groups[0].sourceFaceIds.length=16385;},x=>Object.setPrototypeOf(x.groups[0],{inherited:true})]){
  const g=base();mutate(g);await assert.rejects(build(g));
 }
});
