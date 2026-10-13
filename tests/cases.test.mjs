import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCaseStore} from '../src/cases.js';
const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6}});
test('case snapshots and exported copies remain independent; archives roundtrip atomically',()=>{const store=createCaseStore(),o=output();store.add('A',o);o.result.maxDisplacementMm=99;const exported=store.export();exported.cases[0].output.input.name='edited';assert.equal(store.compare()[0].metrics[0].value,.04);assert.equal(store.list()[0].output.input.name,undefined);const next=createCaseStore();next.import(JSON.parse(JSON.stringify(store.export())));assert.deepEqual(next.export(),store.export());const bad=next.export();bad.cases.push({name:'invalid'});assert.throws(()=>next.import(bad));assert.deepEqual(next.export(),store.export());});
test('comparison keeps physics units and bounds case collection',()=>{const store=createCaseStore();store.add('A',output());const thermal=output();thermal.result={kind:'thermal',minTemperature:20,maxTemperature:80};store.add('T',thermal);assert.equal(store.compare()[1].metrics[1].unit,'°C');assert.throws(()=>store.remove(-1));for(let i=2;i<8;i++)store.add('case',output());assert.throws(()=>store.add('overflow',output()));store.remove(0);assert.equal(store.list().length,7);});
test('corrupt calculation operation, discipline and result ranges cannot replace saved cases',()=>{
 const store=createCaseStore();store.add('valid',output());const before=store.export();
 for(const change of [o=>o.calculation.operation='mesh',o=>o.input.study={kind:'thermal'},o=>o.result.maxDisplacementMm=-1,o=>o.result.maxVonMisesPa=Infinity,o=>o.result={kind:'thermal',minTemperature:80,maxTemperature:20},o=>o.result={kind:'acoustic',maxPressurePa:-1,maxSplDb:20}]){
  const bad=store.export();change(bad.cases[0].output);assert.throws(()=>store.import(bad));assert.deepEqual(store.export(),before);
 }
});
