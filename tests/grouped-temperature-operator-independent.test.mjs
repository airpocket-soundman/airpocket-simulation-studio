import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildGroupedTemperatureOperator as build,applyGroupedTemperatureOperator as apply,serializeGroupedTemperatureOperator as serialize,loadGroupedTemperatureOperator as load} from '../src/grouped-temperature-operator.js';
const near=(a,b,t=2e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} versus ${b}`);
function unequalFold(){return {units:'mm',mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,2,1/3,1/3,0,0,0,0,1,0,0,0,1,0,0,0,2]},sourceFaces:[[0,1,4],[1,2,4],[2,0,4],[1,0,3]].map(nodes=>({nodes})),targetFaces:[[5,7,6],[6,8,5]].map(nodes=>({nodes})),groups:[{groupId:'first',sourceFaceIds:[0,1,2],targetFaceIds:[0]},{groupId:'second',sourceFaceIds:[3],targetFaceIds:[1]}]};}
const field=(offset=20,unit='degC')=>({units:unit,values:[0,0,0,0,1].map((v,nodeId)=>({nodeId,value:offset+v}))});

test('independent unequal-area folded oracle assembles one shared global mass instead of local averages',async()=>{
 // Areas 1/2 and 1 mm2; unnormalised M=1e-6/24*N and b=1e-6/18*[1,1,1,0].
 // Symmetry gives A=B=a, C=2/3-a, D=-a; first row gives a=1/9.
 const N=[[6,3,1,2],[3,6,1,2],[1,1,2,0],[2,2,0,4]],answer=[1/9,1/9,5/9,-1/9],rhs=[1/27,1/27,1/27,0];
 const g=unequalFold(),before=structuredClone(g),op=await build(g),r=await apply(op,g,field());assert.deepEqual(g,before);near(op.coveredAreaM2,1.5e-6,1e-18);assert.equal(op.rows.length,4);
 for(let i=0;i<4;i++){for(let j=0;j<4;j++)near(op.massNormalized[i][j],N[i][j]/36);near(op.crossNormalized[i][4],rhs[i]);near(N[i].reduce((s,v,j)=>s+v*answer[j]/36,0),rhs[i]);near(r.values[i].value,20+answer[i]);}
 near(r.sourceIntegral,30e-6+1e-6/6,1e-17);near(r.targetIntegral,r.sourceIntegral,1e-17);assert.ok(Math.abs(r.values[2].value-(20+1/3))>.2);assert.ok(Math.abs(r.values[3].value-20)>.1);
 const kelvin=await apply(op,g,field(293.15,'K'));kelvin.values.forEach((v,i)=>near(v.value-r.values[i].value,273.15));near(kelvin.targetIntegral-r.targetIntegral,273.15*1.5e-6,1e-15);
});

function pointGroups(){return {units:'mm',mesh:{nodes:[0,0,0,1,0,0,0,1,0,-1,0,1,0,-1,1,7,7,7]},sourceFaces:[{nodes:[0,1,2]},{nodes:[0,3,4]}],targetFaces:[{nodes:[6,8,7]},{nodes:[6,10,9]}],groups:[{groupId:'a',sourceFaceIds:[0],targetFaceIds:[0]},{groupId:'b',sourceFaceIds:[1],targetFaceIds:[1]}]};}
test('a shared point is one explicit DOF; coincident duplicate-ID point contact is refused',async()=>{
 const g=pointGroups();g.mesh.nodes.push(...g.mesh.nodes.slice(0,15));const op=await build(g),values=[11,12,13,14,15].map((value,nodeId)=>({nodeId,value})),r=await apply(op,g,{units:'degC',values});assert.equal(r.values.length,5);r.values.forEach((v,i)=>near(v.value,values[i].value));
 const duplicate=structuredClone(g);const sid=duplicate.mesh.nodes.length/3;duplicate.mesh.nodes.push(0,0,0,0,0,0);duplicate.sourceFaces[1].nodes[0]=sid;duplicate.targetFaces[1].nodes[0]=sid+1;await assert.rejects(build(duplicate),/shared global node\/edge IDs/);
});

test('nonconforming partial-edge contact is rejected even with independent full-coverage groups',async()=>{
 const g={units:'mm',mesh:{nodes:[0,0,0,1,0,0,0,1,0,.2,0,0,.8,0,0,.5,-1,0]},sourceFaces:[{nodes:[0,1,2]},{nodes:[3,5,4]}],targetFaces:[{nodes:[6,8,7]},{nodes:[9,10,11]}],groups:[{groupId:'a',sourceFaceIds:[0],targetFaceIds:[0]},{groupId:'b',sourceFaceIds:[1],targetFaceIds:[1]}]};g.mesh.nodes.push(...g.mesh.nodes);await assert.rejects(build(g),/shared global node\/edge IDs/);
});

test('unused global coordinates remain part of geometry identity while field permutation remains canonical',async()=>{
 const g=unequalFold(),op=await build(g),raw=serialize(op),changed=structuredClone(g);changed.mesh.nodes.push(99,98,97);const other=await build(changed);assert.notEqual(other.geometryRevision,op.geometryRevision);assert.notEqual(other.operatorRevision,op.operatorRevision);assert.deepEqual(other.rows,op.rows);await assert.rejects(load(raw,changed),/differ/);await assert.rejects(apply(op,changed,field()),/revision mismatch/);
 const a=field(),b=field();b.values.reverse();const [x,y]=await Promise.all([apply(op,g,a),apply(op,g,b)]);assert.equal(x.fieldRevision,y.fieldRevision);assert.deepEqual(x.values,y.values);assert.deepEqual(b.values.map(v=>v.nodeId),[4,3,2,1,0]);
});
