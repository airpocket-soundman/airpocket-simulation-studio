import {test} from 'node:test';import assert from 'node:assert/strict';import load from '@loumalouomega/gmsh-wasm';
import {sphericalFrame,sphericalPoint,sphericalContains,sphericalTriangles} from '../src/spherical-region.js';
import {sphericalPatchArea,makeSphericalPatch} from '../src/spherical-cad.js';
export const spec={center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:0.01,exactCad:true,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90};
test('spherical sector area, rotated frame, pole and wrapped longitude follow analytic geometry',()=>{
 assert.ok(Math.abs(sphericalPatchArea(spec)-50*Math.PI)<1e-10);
 for(const d of [spec,{...spec,center:[2,-1,3],axis:[1,2,3],reference:[2,1,0]}]){assert.ok(sphericalContains(d,sphericalPoint(d,0,0)));assert.ok(!sphericalContains(d,sphericalPoint(d,60,0)));assert.ok(!sphericalContains(d,sphericalPoint(d,0,100)));}
 assert.ok(sphericalContains({...spec,latitudeMax:90},[0,0,10]));
 const tiny={...spec,radius:1e-12};assert.equal(sphericalContains(tiny,tiny.center),false);assert.equal(sphericalContains(tiny,sphericalPoint(tiny,0,0)),true);
 for(const d of [{...spec,exactCad:false},{...spec,radius:0},{...spec,latitudeMin:-91},{...spec,latitudeMax:-30},{...spec,axis:[0,0,0]},{...spec,reference:[0,0,1]},{...spec,radius:1e308}])assert.throws(()=>sphericalFrame(d));
 const positions=[sphericalPoint(spec,-10,350),sphericalPoint(spec,10,350),sphericalPoint(spec,0,10)].flat();assert.deepEqual(sphericalTriangles(positions,spec),[0]);
});
test('OCC meridian arc revolution yields exact sphere sectors including caps and full-longitude bands',async()=>{
 const g=await load({print:()=>{},printErr:()=>{}});g.initialize();try{g.option.setNumber('General.Terminal',0);
 for(const [i,d]of [spec,{...spec,latitudeMin:30,latitudeMax:90,sweepDegrees:360},{...spec,latitudeMin:-90,latitudeMax:-30,sweepDegrees:360},{...spec,latitudeMin:-90,latitudeMax:90,sweepDegrees:360},{...spec,axis:[1,2,3],reference:[1,0,0],center:[2,-3,4]}].entries()){
  g.model.add('sphere-'+i);const tag=makeSphericalPatch(g,d);g.model.occ.synchronize();assert.equal(g.model.getType(2,tag).entityType,'Sphere');assert.ok(Math.abs(g.model.occ.getMass(2,tag).mass/sphericalPatchArea(d)-1)<1e-9);
 }
 }finally{g.finalize();}
});
