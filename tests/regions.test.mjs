import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaOfTriangle,brushTriangles,validateProject } from '../src/regions.js';
test('surface area and physical radius',()=>{
 const p=[0,0,0,2,0,0,0,2,0,10,0,0,12,0,0,10,2,0];
 assert.equal(areaOfTriangle(p,0),2);
 assert.deepEqual(brushTriangles(p,{x:0,y:0,z:0},1),[0]);
});
test('reject invalid triangle references in saved projects',()=>{
 const p={version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:[3]}]}]};
 assert.throws(()=>validateProject(p));
 p.conditions[0].regions[0].triangles=[0]; assert.equal(validateProject(p),p);
});
