import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {printedIdentificationExample} from '../src/printed-identification-examples.js';
import {identifyPrintedParameters} from '../src/printed-parameter-identification.js';
import {syntheticPrintedMeasurementJson} from '../src/ui/printed-measurement-ui.js';
const expected={
 'linear-elastic':{youngsModulusPa:1e9},
 'bilinear-elastic-plastic':{youngsModulusPa:2e9,yieldStressPa:2e7,tangentModulusPa:1e8},
 'sls-relaxation':{equilibriumModulusPa:1.2e9,branchModulusPa:.8e9,relaxationTimeS:2}
};
test('three deterministic invented curves recover independently specified analytical constants',async()=>{
 for(const model of Object.keys(expected)){const example=printedIdentificationExample(model),d=JSON.parse(example.raw);assert.deepEqual(example.truth,expected[model]);assert.equal(d.provenance,'synthetic');assert.equal(d.calibration.status,'unverified');assert.match(d.instrument.id,/no-device/);assert.equal(d.specimens[0].samples.length,model==='linear-elastic'?21:model==='sls-relaxation'?82:101);assert.equal(printedIdentificationExample(model).raw,example.raw);const fit=await identifyPrintedParameters(example.raw,example.options);assert.equal(fit.identified,true);assert.equal(fit.calibrated,false);for(const [key,value]of Object.entries(expected[model]))assert.ok(Math.abs(fit.specimens[0].parameters[key].value/value-1)<1e-6,model+' '+key);}
 // These are independent force/initial-area and gauge-displacement checks on exact example rows.
 const linear=JSON.parse(printedIdentificationExample('linear-elastic').raw).specimens[0].samples;assert.deepEqual(linear[20],[20,10,.1]);
 const bilinear=JSON.parse(printedIdentificationExample('bilinear-elastic-plastic').raw).specimens[0].samples;assert.equal(bilinear[25][1],20);assert.equal(bilinear[100][1],23);
 const hold=JSON.parse(printedIdentificationExample('sls-relaxation').raw).specimens[0].samples;assert.equal(hold[1][1],8);assert.ok(Math.abs(hold[9][1]-(4.8+3.2/Math.E))<1e-14);
});
test('unknown models refuse and legacy 1585-byte measurement example stays exact',()=>{
 for(const bad of ['constructor','__proto__','plastic',null,{}])assert.throws(()=>printedIdentificationExample(bad),{code:'PRINTED_IDENTIFICATION_EXAMPLE_INVALID'});
 const raw=syntheticPrintedMeasurementJson();assert.equal(Buffer.byteLength(raw),1585);assert.equal(createHash('sha256').update(raw).digest('hex'),'378c09336e6da359df7ad2fe155aaf5bdbbe5c7956ff498ce1dc2824d13c4681');
 const a=printedIdentificationExample('linear-elastic');a.options.minPoints=100;a.truth.youngsModulusPa=1;assert.equal(printedIdentificationExample('linear-elastic').options.minPoints,5);assert.equal(printedIdentificationExample('linear-elastic').truth.youngsModulusPa,1e9);
});
