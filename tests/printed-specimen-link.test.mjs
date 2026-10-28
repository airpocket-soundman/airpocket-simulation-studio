import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {writeSpecimen3mf, readSpecimen3mf} from '../src/printed-measurement-specimen.js';
import {importPrintedMeasurementDataset as load} from '../src/printed-measurement-dataset.js';
import {checkDatasetAgainstSpecimenPlans as check, requireDatasetMatchesSpecimenPlans as require_} from '../src/printed-specimen-link.js';
const xmlOptions = {parseXml: text => new DOMParser({onError: (_l, m) => { throw Error(m); }}).parseFromString(text, 'application/xml')};
// Synthetic dimensions and tolerance only; not from any test standard or real measurement.
const plan = (over = {}) => ({specimenId:'synthetic-dumbbell',specimenVersion:1,shape:'dumbbell',dimensionsMm:{overallLength:100,gripWidth:20,narrowWidth:10,parallelLength:40,filletRadius:5,thickness:4},orientation:'flat',process:{layerHeight:.2,wallLoops:2,infillDensity:1,infillPattern:'rectilinear',topShellLayers:3,bottomShellLayers:3},...over});
const tol = {dimensionMm: .05};
const specimen = (id, over = {}) => ({id, dimensions:[10,4,40], gaugeLength:25, buildDirection:[0,1,0], batch:'synthetic-no-physical-batch', temperature:20, speed:1, displacementKind:'gauge', samples:[[0,0,0],[1,1,.01]], ...over});
const dataset = specimens => load(JSON.stringify({schemaVersion:1,id:'link',revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'synthetic',hardwareRevision:'1',softwareRevision:'1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},specimens}));
const reread = async p => (await readSpecimen3mf((await writeSpecimen3mf(p)).bytes, xmlOptions)).record;
const link = (id, r) => ({datasetSpecimenId:id, specimenId:r.plan.specimenId, specimenVersion:r.plan.specimenVersion, planSha256:r.planSha256});

test('dataset specimens matching their re-read 3MF plans give no findings', async () => {
 const flat = await reread(plan()), upright = await reread(plan({specimenVersion:2, orientation:'upright'})), edge = await reread(plan({specimenVersion:3, orientation:'on-edge'}));
 const d = await dataset([specimen('s1'), specimen('s2', {dimensions:[4,10,40], buildDirection:[0,0,-1]}), specimen('s3', {dimensions:[10.03,3.98,40.02], buildDirection:[1,0,0]})]);
 const r = check(d, [flat, upright, edge], [link('s1', flat), link('s2', upright), link('s3', edge)], tol);
 assert.deepEqual(r.findings, []); assert.equal(r.printVerified, false);
 // flat build axis is thickness: dims [10,4,..] means axis 1; [4,10,..] means axis 0.
 assert.deepEqual(check(await dataset([specimen('s1', {dimensions:[4,10,40], buildDirection:[1,0,0]})]), [flat], [link('s1', flat)], tol).findings, []);
 assert.equal(require_(d, [flat, upright, edge], [link('s1', flat), link('s2', upright), link('s3', edge)], tol).compatible, true);
});

test('mismatched references, dimensions and build direction are reported and rejected', async () => {
 const flat = await reread(plan()), other = await reread(plan({specimenVersion:2, process:{...plan().process, layerHeight:.12}}));
 const d = await dataset([
  specimen('cross', {dimensions:[10,4.2,40]}), specimen('len', {dimensions:[10,4,45], gaugeLength:42}), specimen('dir', {buildDirection:[0,0,1]}),
  specimen('hash'), specimen('missing'), specimen('unlinked')]);
 const links = [link('cross', flat), link('len', flat), link('dir', flat), {...link('hash', flat), planSha256:other.planSha256},
  {...link('missing', flat), specimenVersion:9}, link('ghost', flat)];
 const r = check(d, [flat, other], links, tol);
 assert.deepEqual(r.findings.map(f => `${f.specimen}:${f.code}`).sort(), ['cross:cross-section-mismatch','dir:build-direction-mismatch','ghost:link-without-dataset-specimen','hash:plan-hash-mismatch','len:gauge-exceeds-parallel-section','len:parallel-length-mismatch','missing:specimen-plan-missing','unlinked:dataset-specimen-unlinked']);
 assert.throws(() => require_(d, [flat, other], links, tol), {code:'PRINTED_SPECIMEN_LINK_MISMATCH'});
});

test('invalid link inputs are rejected and no tolerance is assumed', async () => {
 const flat = await reread(plan()), d = await dataset([specimen('s1')]), ok = [link('s1', flat)];
 for (const t of [undefined, {}, {dimensionMm:-1}, {dimensionMm:NaN}, {dimensionMm:.1, extra:1}]) assert.throws(() => check(d, [flat], ok, t), {code:'PRINTED_SPECIMEN_LINK_INVALID'});
 assert.throws(() => check(d, [flat, flat], ok, tol), {code:'PRINTED_SPECIMEN_LINK_INVALID'});
 assert.throws(() => check(d, [flat], [...ok, ...ok], tol), {code:'PRINTED_SPECIMEN_LINK_INVALID'});
 assert.throws(() => check(d, [flat], [{...ok[0], note:'x'}], tol), {code:'PRINTED_SPECIMEN_LINK_INVALID'});
 assert.throws(() => check(d, [{...flat, kind:'other'}], ok, tol), {code:'PRINTED_SPECIMEN_LINK_INVALID'});
});
