import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisOptionsFromValues} from '../src/ui/analysis-options.js';

const form=(over={})=>({size:'5',method:'wasm-pcg',adaptive:false,maxRounds:'3',maxAdaptiveElements:'10000',maxAdaptiveSeconds:'60',tolerance:'2.5',stressTolerance:'4',...over});

test('form values convert exactly: Number fields and percent tolerances',()=>{
 const options=analysisOptionsFromValues(form());
 assert.deepEqual(options,{size:5,method:'wasm-pcg',adaptive:false,maxRounds:3,maxAdaptiveElements:10000,maxAdaptiveSeconds:60,tolerance:0.025,stressTolerance:0.04});
 assert.equal(typeof options.size,'number');assert.equal(typeof options.maxRounds,'number');assert.equal(typeof options.maxAdaptiveElements,'number');assert.equal(typeof options.maxAdaptiveSeconds,'number');
 assert.equal(options.tolerance,2.5/100);assert.equal(options.stressTolerance,4/100);
});

test('adaptive boolean and method string keep the raw source values',()=>{
 for(const adaptive of [false,true]){const o=analysisOptionsFromValues(form({adaptive,method:'weird-method'}));assert.equal(o.adaptive,adaptive);assert.equal(o.method,'weird-method');}
});

test('input object is not mutated and each call returns a fresh object with all keys',()=>{
 const values=form(),before=structuredClone(values);
 const a=analysisOptionsFromValues(values),b=analysisOptionsFromValues(values);
 assert.deepEqual(values,before);
 assert.deepEqual(a,b);
 assert.notEqual(a,b);
 assert.deepEqual(Object.keys(a),['size','method','adaptive','maxRounds','maxAdaptiveElements','maxAdaptiveSeconds','tolerance','stressTolerance']);
});

test('preflight and solve produce deepEqual options for the same form',()=>{
 const values=form();
 const forPreflight=analysisOptionsFromValues(values),forRun=analysisOptionsFromValues(values);
 assert.deepEqual(forPreflight,forRun);
 assert.deepEqual(Object.keys(forPreflight).sort(),Object.keys(forRun).sort());
});

test('empty string, non-numeric, zero and negative values pass through Number() unchanged',()=>{
 const empty=analysisOptionsFromValues(form({size:'',maxRounds:'',maxAdaptiveElements:'',maxAdaptiveSeconds:'',tolerance:'',stressTolerance:''}));
 assert.equal(empty.size,0);assert.equal(empty.maxRounds,0);assert.equal(empty.maxAdaptiveElements,0);assert.equal(empty.maxAdaptiveSeconds,0);assert.equal(empty.tolerance,0);assert.equal(empty.stressTolerance,0);
 assert.ok(Number.isNaN(analysisOptionsFromValues(form({size:'abc'})).size));
 const zero=analysisOptionsFromValues(form({size:'0',tolerance:'0'}));assert.equal(zero.size,0);assert.equal(zero.tolerance,0);
 const negative=analysisOptionsFromValues(form({size:'-1',tolerance:'-2.5'}));assert.equal(negative.size,-1);assert.equal(negative.tolerance,-0.025);
});
