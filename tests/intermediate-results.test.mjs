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
