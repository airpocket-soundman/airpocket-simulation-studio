import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {MAX_STL_TRIANGLES,validateStlSource} from '../src/stl-source.js';

function cube(){const g=new BoxGeometry(10,10,10).toNonIndexed();g.translate(5,5,5);const positions=Array.from(g.attributes.position.array);g.dispose();return positions;}
const source=positions=>({kind:'stl',positions});
function reverse(positions){return positions.flatMap((_,i)=>i%9===0?[...positions.slice(i,i+3),...positions.slice(i+6,i+9),...positions.slice(i+3,i+6)]:[]);}

test('STL validator accepts a convex outward cube in mm without modifying its source',()=>{
 const input=source(cube()),before=structuredClone(input),summary=validateStlSource(input);
 assert.equal(summary.closedEdgeTopology,true);assert.equal(summary.components,1);assert.equal(summary.convexBoundaryChecked,true);assert.equal(summary.selfIntersectionsChecked,false);
 assert.equal(summary.triangles,12);assert.equal(summary.weldedVertices,8);assert.deepEqual(summary.boundsMm.dimensions,[10,10,10]);assert.ok(Math.abs(summary.signedVolumeMm3-1000)<1e-10);assert.deepEqual(input,before);
 const moved=source(input.positions.map((v,i)=>v+[1e6,-2e6,3e6][i%3]));assert.ok(Math.abs(validateStlSource(moved).signedVolumeMm3-1000)<1e-8);
 const scaled=validateStlSource(source(input.positions.map(v=>v*.01)));assert.ok(Math.abs(scaled.signedVolumeMm3-.001)<1e-12);
});

test('STL validator rejects malformed, defective, reversed, multiple and concave shells atomically',()=>{
 const p=cube(),localReverse=[...p.slice(0,3),...p.slice(6,9),...p.slice(3,6),...p.slice(9)],concave=p.map((v,i)=>{const start=i-i%3,point=p.slice(start,start+3);return point.every(value=>value===10)?5:v;});
 const cases=[
  source(p.slice(9)),source([...p,...p.slice(0,9)]),source([...p,...Array(9).fill(0)]),source(localReverse),source(reverse(p)),
  source([...p,...p.map((v,i)=>v+(i%3===0?20:0))]),source(concave),source(p.map((v,i)=>i===0?NaN:v)),source(p.map((v,i)=>i===0?Infinity:v)),
  source([]),source(p.slice(1)),source(Array((MAX_STL_TRIANGLES+1)*9).fill(0)),{kind:'stl',positions:p,unit:'mm'},
  source(p.map((v,i)=>i%3===2?v*1e-14:v))
 ];
 for(const input of cases){const before=structuredClone(input);assert.throws(()=>validateStlSource(input),/STL/);assert.deepEqual(input,before);}
 assert.throws(()=>validateStlSource(source(concave)),/convex shell/);
});
