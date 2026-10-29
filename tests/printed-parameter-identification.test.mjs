import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyPrintedParameters as identify} from '../src/printed-parameter-identification.js';
import {SYNTHETIC_TRUTH as T, syntheticDataset, ramp, linearStress, bilinearStress, relaxationCurve} from './fixtures/printed-identification-synthetic.mjs';
const LIN = {model:'linear-elastic',maxStrain:.01,minPoints:5,maxRelativeStandardError:.05};
const BIL = {model:'bilinear-elastic-plastic',maxStrain:.08,minPoints:5,maxRelativeStandardError:.05,maxTangentRatio:.5};
const SLS = {model:'sls-relaxation',maxStrain:1,minPoints:10,maxRelativeStandardError:.1,holdStrainTolerance:1e-6};
const near = (p, truth, k = 4) => assert.ok(Math.abs(p.value - truth) <= k * p.standardError, `${p.value} vs ${truth} ± ${p.standardError}`);

test('linear elastic: recovers E within standard error, labels synthetic and uncalibrated, aggregates specimens', async () => {
 const r = await identify(syntheticDataset({curves: ramp(50, .005, linearStress()), specimens: 3, seed: 7}), LIN);
 assert.equal(r.identified, true); assert.equal(r.calibrated, false); assert.equal(r.accuracyVerified, false); assert.equal(r.dataset.provenance, 'synthetic');
 for (const s of r.specimens) { near(s.parameters.youngsModulusPa, T.youngsModulusPa); assert.ok(s.parameters.youngsModulusPa.relativeStandardError < .01); }
 assert.equal(r.across.youngsModulusPa.specimens, 3); assert.ok(r.across.youngsModulusPa.sampleStandardDeviation > 0);
});

test('linear elastic: standard error matches seed-to-seed scatter and scales with noise', async () => {
 let inside = 0; const errors = [], ses = [];
 for (let seed = 1; seed <= 60; seed++) {
  const p = (await identify(syntheticDataset({curves: ramp(30, .005, linearStress()), seed}), LIN)).specimens[0].parameters.youngsModulusPa;
  if (Math.abs(p.value - T.youngsModulusPa) <= 2 * p.standardError) inside++; errors.push(p.value - T.youngsModulusPa); ses.push(p.standardError);
 }
 assert.ok(inside >= 51, `coverage ${inside}/60`);
 const scatter = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length), meanSe = ses.reduce((a, b) => a + b) / ses.length;
 assert.ok(scatter / meanSe > .7 && scatter / meanSe < 1.4, `scatter/se ${scatter / meanSe}`);
 const se = async noisePa => (await identify(syntheticDataset({curves: ramp(30, .005, linearStress()), noisePa}), LIN)).specimens[0].parameters.youngsModulusPa.standardError;
 const ratio = await se(1e6) / await se(1e5);
 assert.ok(ratio > 7 && ratio < 13, `se ratio ${ratio}`);
});

test('bilinear elastic-plastic: recovers E, yield stress and tangent modulus', async () => {
 const r = await identify(syntheticDataset({curves: ramp(200, .06, bilinearStress()), seed: 3}), BIL), p = r.specimens[0].parameters;
 assert.equal(r.identified, true);
 near(p.youngsModulusPa, T.youngsModulusPa); near(p.yieldStressPa, T.yieldStressPa); near(p.tangentModulusPa, T.tangentModulusPa);
 assert.ok(Math.abs(p.yieldStressPa.value / T.yieldStressPa - 1) < .02);
});

test('SLS relaxation: recovers equilibrium modulus, branch modulus and relaxation time', async () => {
 const r = await identify(syntheticDataset({curves: relaxationCurve(), noisePa: 1e5, seed: 5}), SLS), p = r.specimens[0].parameters;
 assert.equal(r.identified, true);
 near(p.equilibriumModulusPa, T.equilibriumModulusPa); near(p.branchModulusPa, T.branchModulusPa); near(p.relaxationTimeS, T.relaxationTimeS);
 assert.ok(Math.abs(p.relaxationTimeS.value / T.relaxationTimeS - 1) < .05);
});

test('refuses unidentifiable parameters instead of returning a number', async () => {
 const lin = (await identify(syntheticDataset({curves: ramp(200, .01, linearStress()), seed: 4}), BIL)).specimens[0];
 assert.equal(lin.identified, false, 'purely linear curve has no yield');
 const early = (await identify(syntheticDataset({curves: ramp(200, .0202, bilinearStress()), seed: 4}), BIL)).specimens[0];
 assert.equal(early.identified, false, 'yield at the end of the loaded range');
 const swamped = (await identify(syntheticDataset({curves: ramp(6, 1e-5, linearStress()), noisePa: 1e6, seed: 9}), LIN)).specimens[0];
 assert.equal(swamped.identified, false, 'noise swamps the elastic signal');
 assert.deepEqual((await identify(syntheticDataset({curves: ramp(4, .005, linearStress())}), LIN)).specimens[0], {specimen: 'synthetic-1', identified: false, reason: 'too-few-points', points: 4});
 for (const tau of [5000, 1e-4]) {
  const s = (await identify(syntheticDataset({curves: relaxationCurve({tau}), noisePa: 1e5}), SLS)).specimens[0];
  assert.equal(s.identified, false, `tau ${tau}`); assert.match(s.reason, /relaxation/);
 }
});

test('only validator-accepted datasets and exact options are accepted; inputs are not mutated', async () => {
 const raw = syntheticDataset({curves: ramp(20, .005, linearStress())}), d = JSON.parse(raw);
 d.specimens[0].displacementKind = 'crosshead';
 await assert.rejects(identify(JSON.stringify(d), LIN), {code: 'PRINTED_DATASET_INVALID'});
 await assert.rejects(identify(JSON.parse(raw), LIN), {code: 'PRINTED_DATASET_INVALID'});
 const claim = JSON.parse(raw); claim.calibration.status = 'reported';
 await assert.rejects(identify(JSON.stringify(claim), LIN), {code: 'PRINTED_DATASET_INVALID'});
 for (const bad of [undefined, {...LIN, extra: 1}, {...LIN, model: 'prony'}, {...LIN, minPoints: 2}, {...LIN, maxStrain: 0}, {...LIN, maxRelativeStandardError: NaN}, {...BIL, maxTangentRatio: 1}, (({holdStrainTolerance, ...o}) => o)(SLS)]) {
  await assert.rejects(identify(raw, bad), {code: 'PRINTED_IDENTIFICATION_INVALID'});
 }
 const opts = structuredClone(LIN); await identify(raw, opts); assert.deepEqual(opts, LIN);
});
