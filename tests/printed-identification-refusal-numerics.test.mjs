import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyPrintedParameters} from '../src/printed-parameter-identification.js';
import {syntheticDataset} from './fixtures/printed-identification-synthetic.mjs';

const common={maxStrain:.02,minPoints:3,maxRelativeStandardError:.1};
const finiteTree=value=>typeof value==='number'?Number.isFinite(value):value&&typeof value==='object'?Object.values(value).every(finiteTree):true;

test('unresolvable modulus uncertainty keeps its refusal without an Infinity-to-null JSON conversion',async()=>{
 const raw=syntheticDataset({noisePa:0,curves:[1,4,3,6,5].map((f,i)=>({t:i+1,strain:(i+1)*2**-510,stressPa:f*1e6}))});
 const result=await identifyPrintedParameters(raw,{...common,model:'linear-elastic'});
 assert.equal(result.identified,false);
 assert.equal(result.specimens[0].reason,'modulus-not-resolved');
 assert.equal(Object.hasOwn(result.specimens[0],'relativeStandardError'),false);
 assert.equal(Object.hasOwn(result.specimens[0],'parameters'),false);
 assert(finiteTree(result));
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
 assert.equal(result.calibrated,false);
});

test('subnormal unresolved hold times keep a reason without a fabricated relaxation time',async()=>{
 const raw=syntheticDataset({noisePa:0,curves:[{t:0,strain:0,stressPa:0},...[1,2,3,4].map(i=>({t:i*Number.MIN_VALUE,strain:.005,stressPa:1e6/i}))]});
 const result=await identifyPrintedParameters(raw,{...common,model:'sls-relaxation',holdStrainTolerance:.001});
 assert.equal(result.identified,false);
 assert.equal(result.specimens[0].reason,'relaxation-time-outside-window');
 assert.equal(Object.hasOwn(result.specimens[0],'relaxationTimeS'),false);
 assert.equal(Object.hasOwn(result.specimens[0],'parameters'),false);
 assert(finiteTree(result));
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});

test('finite refusal diagnostics remain available to consumers',async()=>{
 const raw=syntheticDataset({noisePa:0,curves:[1,2,3].map(i=>({t:i,strain:i*.001,stressPa:i*1e6}))});
 const result=await identifyPrintedParameters(raw,{...common,minPoints:4,model:'linear-elastic'});
 assert.deepEqual(result.specimens[0],{specimen:'synthetic-1',identified:false,reason:'too-few-points',points:3});
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});
