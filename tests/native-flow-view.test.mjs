import test from 'node:test';import assert from 'node:assert/strict';
import {sliceTetrahedra} from '../src/native-flow-view.js';
test('display slice clips to the requested window and preserves linear physical fields',()=>{
 const points=[-1,-1,0,1,1,0,0,1,2,0,-1,2];const volume={pointCount:4,cellCount:1,points,connectivity:[0,1,2,3],offsets:[4],types:[10],fields:{Pressure:{values:[-1,1,2,2]},Velocity:{values:[1,0,0,1,0,0,1,0,0,1,0,0]}}};
 const slice=sliceTetrahedra(volume,{xmin:-.25,xmax:.25,zmin:.2,zmax:1.8});assert.ok(slice.positions.length>0);assert.equal(slice.positions.length/3,slice.pressure.length);
 for(let i=0;i<slice.pressure.length;i++){const [x,y,z]=slice.positions.slice(i*3,i*3+3);assert.ok(x>=-.250000001&&x<=.250000001&&z>=.199999999&&z<=1.800000001);assert.equal(y,0);assert.ok(Math.abs(slice.pressure[i]-x-z)<1e-7);assert.deepEqual(slice.velocity.slice(i*3,i*3+3),[1,0,0]);}
});
