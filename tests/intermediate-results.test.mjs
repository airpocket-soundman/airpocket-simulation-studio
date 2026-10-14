import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectIntermediate} from '../src/intermediate-results.js';
const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]};
const thermal={field:{kind:'thermal',time:2,temperature:[20,30,40,50],units:{temperature:'degC'}}};
test('intermediate statistics, bounded pages and interpolation preserve units and provisional status',()=>{
 const result=inspectIntermediate(thermal,mesh,{point:[.25,.25,.25],offset:1,limit:2});assert.equal(result.provisional,true);assert.equal(result.field.minimum,20);assert.equal(result.field.maximum,50);assert.equal(result.measurement.value,35);assert.equal(result.measurement.unit,'degC');assert.equal(result.measurement.time,2);assert.deepEqual(result.page.values,[30,40]);assert.equal(result.page.hasMore,true);assert.equal(result.page.nextOffset,3);assert.equal(result.measurement.flux,undefined);
 const acoustic=inspectIntermediate({field:{kind:'acousticTransient',time:.1,pressure:[1,2,3,4],units:{pressure:'Pa'}}},mesh,{point:[0,0,0]});assert.equal(acoustic.measurement.value,1);assert.equal(acoustic.measurement.unit,'Pa');assert.equal(inspectIntermediate({},mesh).page,undefined);
});
test('intermediate measurements reject unsupported fields, bad units, bad meshes, extrapolation and oversized pages',()=>{
 for(const options of [{limit:201},{offset:-1},{offset:5},{point:[2,2,2]}])assert.throws(()=>inspectIntermediate(thermal,mesh,options));
 for(const field of [{...thermal.field,units:{temperature:'K'}},{...thermal.field,temperature:[1,2,3,NaN]},{...thermal.field,kind:'elastic'},{...thermal.field,time:-1}])assert.throws(()=>inspectIntermediate({field},mesh));
 assert.throws(()=>inspectIntermediate({},mesh,{point:[0,0,0]}),/scalar field/);assert.throws(()=>inspectIntermediate(thermal,{...mesh,tetrahedra:[[0,1,2,9]]}),/mesh/);
});

test('explicit element pages reconstruct adaptive connectivity against exact node pages without changing defaults',()=>{
 const refined={nodes:[...mesh.nodes,1,1,1],tetrahedra:[[0,1,2,3],[1,2,3,4]],nodeBodies:[7,7,7,7,7]},snapshot={field:{...thermal.field,temperature:[20,30,40,50,60]}};
 const before=JSON.stringify({refined,snapshot}),first=inspectIntermediate(snapshot,refined,{pageKind:'elements',limit:1}),second=inspectIntermediate(snapshot,refined,{pageKind:'elements',offset:first.page.nextOffset,limit:1});
 assert.deepEqual(first.page,{kind:'elements',offset:0,count:1,total:2,nextOffset:1,hasMore:true,tetrahedra:[[0,1,2,3]],elementBodies:[7]});
 assert.deepEqual(second.page.tetrahedra,[[1,2,3,4]]);assert.equal(second.page.nextOffset,2);assert.equal(second.page.hasMore,false);assert.equal(first.page.nodesMm,undefined);assert.equal(first.page.values,undefined);
 const nodes=[...inspectIntermediate(snapshot,refined,{limit:3}).page.nodesMm,...inspectIntermediate(snapshot,refined,{offset:3,limit:3}).page.nodesMm];
 const restored=[...first.page.tetrahedra,...second.page.tetrahedra];assert.deepEqual(restored,refined.tetrahedra);assert.deepEqual(nodes.flat(),refined.nodes);assert.deepEqual(first.mesh.boundsMm,[0,0,0,1,1,1]);
 const sampled=inspectIntermediate(snapshot,refined,{point:[1,1,1],elementIndex:1,bodyIndex:7});assert.equal(sampled.measurement.value,60);
 assert.equal(inspectIntermediate(snapshot,refined,{pageKind:'elements'}).page,undefined);assert.equal(inspectIntermediate(snapshot,refined,{limit:1}).page.kind,undefined);
 first.page.tetrahedra[0][0]=999;first.page.elementBodies[0]=999;assert.equal(JSON.stringify({refined,snapshot}),before);
});

test('element connectivity pages are capped, validate element offsets and reject measurement mixing',()=>{
 const large={...mesh,tetrahedra:Array.from({length:401},()=>[0,1,2,3])};
 const page=inspectIntermediate({},large,{pageKind:'elements',offset:200,limit:200}).page;assert.equal(page.count,200);assert.equal(page.total,401);assert.equal(page.nextOffset,400);assert.equal(page.hasMore,true);assert.equal(page.elementBodies,undefined);
 const empty=inspectIntermediate({},large,{pageKind:'elements',offset:401,limit:200}).page;assert.deepEqual(empty.tetrahedra,[]);assert.equal(empty.count,0);assert.equal(empty.hasMore,false);
 for(const options of [{pageKind:null},{pageKind:'faces'},{pageKind:'elements',offset:402},{pageKind:'elements',offset:1.5},{pageKind:'elements',limit:201},{pageKind:'elements',point:[0,0,0]},{pageKind:'elements',bodyIndex:0},{pageKind:'elements',elementIndex:0}])assert.throws(()=>inspectIntermediate(thermal,large,options));
 assert.throws(()=>inspectIntermediate({}, {...mesh,tetrahedra:[[0,1,2,4]]},{pageKind:'elements',limit:1}),/mesh/);
});
