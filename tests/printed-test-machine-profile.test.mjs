import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePrintedMachineProfile as validate, checkDatasetAgainstMachineProfile as check} from '../src/printed-test-machine-profile.js';
import {importPrintedMeasurementDataset as load} from '../src/printed-measurement-dataset.js';
// All values are synthetic test numbers, not the capacity or accuracy of any real or planned machine.
const profile = () => ({schemaVersion:1,id:'synthetic',revision:'1',origin:'diy',provenance:'synthetic',units:{force:'N',length:'mm',speed:'mm/s'},frame:{hardwareRevision:'1',softwareRevision:'1',modes:['tension','compression']},loadCell:{ratedCapacity:10,model:null},displacementSources:[{id:'crosshead',kind:'crosshead'},{id:'gauge-1',kind:'gauge'}],fixtures:[{id:'grip-1',mode:'tension'},{id:'platen-1',mode:'compression'}],limits:{enforcedBy:'device',force:5,stroke:20,speed:2},compliance:{status:'unmeasured',value:null,evidence:null},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null}});
const dataset = () => ({schemaVersion:1,id:'fit',revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'synthetic',hardwareRevision:'1',softwareRevision:'1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},specimens:[{id:'synthetic-specimen-1',dimensions:[1,1,10],gaugeLength:10,buildDirection:[0,0,1],batch:'synthetic-no-physical-batch',temperature:20,speed:1,displacementKind:'gauge',samples:[[0,0,0],[1,1,.1]]}]});

test('synthetic profile normalizes explicit units and never claims accuracy', () => {
 const r = validate(profile());
 assert.equal(r.accuracyVerified, false); assert.equal(r.ratedCapacityN, 10);
 assert.deepEqual(r.limits, {forceN:5, strokeMm:20, speedMmPerSecond:2});
 assert.equal(r.compliance.mmPerN, null);
 const si = profile(); si.units = {force:'kN',length:'m',speed:'m/s'}; si.loadCell.ratedCapacity = .01; si.limits = {enforcedBy:'device',force:.005,stroke:.02,speed:.002};
 assert.deepEqual(validate(si).limits, r.limits); assert.equal(validate(si).ratedCapacityN, 10);
});

test('reject missing fields, host-only stops, stops above capacity, missing fixtures and fake evidence', () => {
 const mutations = [
  p => delete p.limits.stroke, p => p.extra = 1, p => p.units.force = 'kgf', p => p.units.length = 'toString',
  p => p.limits.enforcedBy = 'host', p => p.limits.force = 11, p => p.limits.speed = 0, p => p.loadCell.ratedCapacity = Infinity,
  p => p.fixtures.pop(), p => p.fixtures.push({id:'x',mode:'bending'}), p => p.frame.modes = ['tension','tension'], p => p.frame.modes = [],
  p => p.displacementSources = [], p => p.displacementSources.push({id:'gauge-1',kind:'gauge'}), p => p.displacementSources[0].kind = 'video',
  p => p.compliance.value = 1e-4, p => p.calibration.forceEvidence = 'claimed',
  p => { p.calibration = {status:'reported',forceEvidence:'c1',displacementEvidence:'c2'}; },
  p => { p.compliance = {status:'reported',value:1e-4,evidence:'r1'}; },
  p => p.origin = 'commercial', p => p.schemaVersion = 2,
 ];
 for (const mutate of mutations) { const p = profile(); mutate(p); assert.throws(() => validate(p), {code:'PRINTED_MACHINE_PROFILE_INVALID'}, mutate.toString()); }
});

test('declared profile may report calibration and compliance with evidence, still unverified', () => {
 const p = profile(); p.provenance = 'declared';
 p.calibration = {status:'reported',forceEvidence:'owner-force-record-1',displacementEvidence:'owner-displacement-record-1'};
 p.compliance = {status:'reported',value:1e-4,evidence:'owner-compliance-record-1'};
 const r = validate(p); assert.equal(r.accuracyVerified, false); assert.equal(r.compliance.mmPerN, 1e-4);
 p.units.length = 'm'; p.units.force = 'kN'; p.loadCell.ratedCapacity = .01; p.limits = {enforcedBy:'device',force:.005,stroke:.02,speed:2};
 assert.ok(Math.abs(validate(p).compliance.mmPerN - 1e-4) < 1e-18);
 delete p.calibration.displacementEvidence; assert.throws(() => validate(p));
});

test('dataset is checked against the profile identity, limits and modes', async () => {
 const ok = check(validate(profile()), await load(JSON.stringify(dataset())));
 assert.deepEqual(ok, {compatible:true, accuracyVerified:false, findings:[]});
 const p = profile(); p.frame.hardwareRevision = '2'; p.frame.modes = ['compression']; p.fixtures = [{id:'platen-1',mode:'compression'}]; p.limits.force = .5; p.limits.speed = .5; p.displacementSources = [{id:'crosshead',kind:'crosshead'}];
 const d = dataset(); d.provenance = 'measured'; d.calibration = {status:'reported',forceEvidence:'a',displacementEvidence:'b',dimensionEvidence:'c'};
 const r = check(validate(p), await load(JSON.stringify(d)));
 assert.equal(r.compatible, false);
 assert.deepEqual(r.findings.map(f => f.code).sort(), ['dataset-calibration-without-profile-calibration','force-above-device-stop','hardware-revision-mismatch','no-gauge-displacement-source','speed-above-device-limit','tension-not-offered']);
});
