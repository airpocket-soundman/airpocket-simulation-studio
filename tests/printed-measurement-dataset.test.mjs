import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {importPrintedMeasurementDataset as load, importPrintedEquivalentDatasets as bind} from '../src/printed-measurement-dataset.js';
import {printedEquivalentFixture} from './fixtures/printed-equivalent-material.mjs';
const fixture = () => ({schemaVersion:1,id:'fit',revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'synthetic',hardwareRevision:'1',softwareRevision:'1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},specimens:[{id:'synthetic-specimen-1',dimensions:[1,1,10],gaugeLength:10,buildDirection:[0,0,1],batch:'synthetic-no-physical-batch',temperature:20,speed:1,displacementKind:'gauge',samples:[[0,0,0],[1,1,.1]]}]});
test('synthetic SI oracle, exact source hash and source preservation',async()=>{
 const d=fixture(),raw=JSON.stringify(d),r=await load(raw);
 assert.equal(r.specimens[0].samples[1].engineeringStressPa,1e6);
 assert.equal(r.specimens[0].samples[1].engineeringStrain,.01);
 assert.equal(r.sourceSha256,createHash('sha256').update(raw).digest('hex'));
 assert.equal(r.rawJson,raw); assert.equal(r.accuracyVerified,false); assert.deepEqual(JSON.parse(raw),d);
 const changed=await load(raw+' '); assert.notEqual(changed.sourceSha256,r.sourceSha256);
 const si=fixture();si.units.length='m';si.units.force='kN';si.units.speed='m/s';si.specimens[0].dimensions=[.001,.001,.01];si.specimens[0].gaugeLength=.01;si.specimens[0].speed=.001;si.specimens[0].samples[1]=[1,.001,.0001];
 assert.deepEqual((await load(JSON.stringify(si))).specimens,r.specimens);
});
test('reject missing metadata, units, invalid bounds, duplicate specimens and unsupported displacement',async()=>{
 const mutations=[d=>delete d.instrument.softwareRevision,d=>delete d.calibration,d=>d.units.force='kg',d=>d.units.length='toString',d=>d.specimens.push(structuredClone(d.specimens[0])),d=>d.specimens[0].buildDirection=[0,0,2],d=>d.specimens[0].dimensions[0]=0,d=>d.specimens[0].gaugeLength=11,d=>d.specimens[0].temperature=-274,d=>d.specimens[0].speed=0,d=>d.specimens[0].samples[1][0]=0,d=>d.specimens[0].samples[1][1]=null,d=>d.specimens[0].displacementKind='crosshead',d=>d.calibration.status='reported',d=>d.calibration.forceEvidence='invented',d=>d.specimens[0].samples=Array.from({length:10001},(_,i)=>[i,0,0])];
 for(const mutate of mutations){const d=fixture();mutate(d);await assert.rejects(load(JSON.stringify(d)),{code:'PRINTED_DATASET_INVALID'});}
 await assert.rejects(load(' '.repeat(2000001)));await assert.rejects(load('{'));await assert.rejects(load(JSON.stringify(fixture()).replace('[1,1,0.1]','[1,1e999,0.1]')));
});
test('measured calibration report requires all evidence without asserting verified accuracy',async()=>{
 const d=fixture();d.provenance='measured';d.calibration={status:'reported',forceEvidence:'certificate-force-1',displacementEvidence:'certificate-displacement-1',dimensionEvidence:'certificate-dimension-1'};
 assert.equal((await load(JSON.stringify(d))).accuracyVerified,false);
 delete d.calibration.dimensionEvidence;await assert.rejects(load(JSON.stringify(d)));
});
test('existing equivalent links require exact IDs/revisions/specimens/batch and independent specimens',async()=>{
 const p=printedEquivalentFixture().materialProperties,b=p.printedEquivalent.basis;b.kind='identified';b.identification={id:'fit',revision:'1',specimenIds:['synthetic-specimen-1']};b.independentValidation={id:'check',revision:'1',specimenIds:['independent']};
 const fit=fixture(),check=fixture();check.id='check';check.specimens[0].id='independent';const raws=[JSON.stringify(fit),JSON.stringify(check)],before=structuredClone(p);
 assert.equal((await bind(p,raws)).length,2);assert.deepEqual(p,before);
 for(const modify of [d=>d.revision='2',d=>d.specimens[0].id='wrong',d=>d.specimens[0].batch='other']){const bad=fixture();modify(bad);await assert.rejects(bind(p,[JSON.stringify(bad),raws[1]]));}
 await assert.rejects(bind(p,[raws[0]]));b.independentValidation.specimenIds=['synthetic-specimen-1'];await assert.rejects(bind(p,raws),/separate dataset/);
});
