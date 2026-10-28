import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildPlanarTemperatureOperator as build,applyPlanarTemperatureOperator as apply,serializePlanarTemperatureOperator as serialize,loadPlanarTemperatureOperator as load} from '../src/planar-temperature-operator.js';
import {getProjectRevision} from '../src/project-revision.js';
const near=(a,b,t=2e-11)=>assert.ok(Math.abs(a-b)<=t,`${a} versus ${b}`);
function geometry(scale=1,oblique=false){const xy=[[0,0],[1,0],[1,1],[0,1],[.5,.5],[0,0],[1,0],[1,1],[0,1]],nodes=xy.flatMap(([x,y])=>oblique?[2+.6*scale*x,-3+.8*scale*x,7+scale*y]:[scale*x,scale*y,0]);return {units:'mm',mesh:{nodes},sourceFaces:[[0,1,4],[1,2,4],[2,3,4],[3,0,4]].map(nodes=>({nodes})),targetFaces:[[5,7,6],[5,8,7]].map(nodes=>({nodes}))};}
const field=(offset=0,units='degC')=>({units,values:[0,0,0,0,1].map((v,nodeId)=>({nodeId,value:offset+v}))});

test('exact non-affine consistent mass and cross-load oracle survives scale, oblique rotation and translation',async()=>{
 // Exact integration over four fan triangles; no production integration helper.
 const M=[[4,1,2,1],[1,2,1,0],[2,1,4,1],[1,0,1,2]],b=[1/8,1/24,1/8,1/24],answer=[.5,0,.5,0];
 for(const [s,rot] of [[1,false],[10,false],[2,true]]){const g=geometry(s,rot),op=await build(g),r=await apply(op,g,field());near(op.coveredAreaM2,s*s*1e-6,1e-16);
  for(let i=0;i<4;i++){for(let j=0;j<4;j++)near(op.massNormalized[i][j],M[i][j]/24);near(op.crossNormalized[i][4],b[i]);near(r.values[i].value,answer[i]);near(M[i].reduce((v,m,j)=>v+m*answer[j]/24,0),b[i]);}
  near(r.sourceIntegral,s*s*1e-6/3,1e-16);near(r.targetIntegral,s*s*1e-6/3,1e-16);assert.ok(Math.abs(r.values[0].value-.375)>.1);assert.ok(r.values[0].value>.4,'not zero point sampling');
 }
});

test('absolute-temperature offset commutes with non-affine projection while area integral scales in m2',async()=>{
 const g=geometry(10,true),op=await build(g),c=await apply(op,g,field(100)),k=await apply(op,g,field(373.15,'K'));for(let i=0;i<4;i++)near(k.values[i].value-c.values[i].value,273.15);near(k.sourceIntegral-c.sourceIntegral,273.15*1e-4,1e-14);near(k.targetIntegral-c.targetIntegral,273.15*1e-4,1e-14);assert.equal(k.integralUnits,'K*m2');assert.equal(c.integralUnits,'degC*m2');
});

test('self-rehashed mass, cross-load, conditioning and integral weights cannot replace geometry-derived coefficients',async()=>{
 const g=geometry(),op=await build(g),raw=serialize(op);
 for(const change of [v=>v.massNormalized[0][0]+=.01,v=>v.crossNormalized[0][4]+=.01,v=>v.targetWeights[0].areaM2*=2,v=>v.sourceWeights[0].areaM2*=2,v=>v.conditionInfinity+=1]){const value=JSON.parse(raw);change(value);const {operatorRevision,...payload}=value;value.operatorRevision=await getProjectRevision(payload);await assert.rejects(load(JSON.stringify(value),g),{code:'PLANAR_TEMPERATURE_OPERATOR_INVALID'});}
 const copy=structuredClone(g);Object.setPrototypeOf(copy.targetFaces,Object.create(Array.prototype));await assert.rejects(build(copy),{code:'PLANAR_TEMPERATURE_OPERATOR_INVALID'});
});
