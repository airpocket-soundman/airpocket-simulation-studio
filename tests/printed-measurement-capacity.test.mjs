import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {importPrintedMeasurementDataset as load,PRINTED_DATASET_LIMITS as limits} from '../src/printed-measurement-dataset.js';
const specimen=id=>({id,dimensions:[2,5,40],gaugeLength:20,buildDirection:[0,0,1],batch:'synthetic',temperature:20,speed:1,displacementKind:'gauge',samples:[[0,0,0],[1,10,.2]]});
const dataset=()=>({schemaVersion:1,id:'capacity-synthetic',revision:'1',provenance:'synthetic',units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},instrument:{id:'synthetic-測定',hardwareRevision:'1',softwareRevision:'1'},calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},specimens:[specimen('s0')]});

test('PRINT2 exact UTF-8 byte boundary is accepted and one byte beyond is rejected',async()=>{
 const raw=JSON.stringify(dataset()),room=limits.bytes-Buffer.byteLength(raw),exact=raw+' '.repeat(room);
 assert.equal(Buffer.byteLength(exact),limits.bytes);
 const result=await load(exact);assert.equal(result.rawJson,exact);assert.equal(result.sourceSha256,createHash('sha256').update(exact).digest('hex'));
 // JS length remains below the byte limit: this exercises UTF-8 bytes, not the early character guard.
 const over=exact+' ';assert.ok(over.length<limits.bytes);await assert.rejects(load(over),{code:'PRINTED_DATASET_INVALID'});
});

test('PRINT2 exact specimen and aggregate sample capacities are accepted, plus one rejected',async()=>{
 const d=dataset();d.specimens=Array.from({length:limits.specimens},(_,i)=>specimen('s'+i));
 assert.equal((await load(JSON.stringify(d))).specimens.length,100);
 d.specimens.push(specimen('extra'));await assert.rejects(load(JSON.stringify(d)),{code:'PRINTED_DATASET_INVALID'});
 d.specimens=Array.from({length:100},(_,i)=>({...specimen('s'+i),samples:Array.from({length:100},(_,t)=>[t,10,.2])}));
 const raw=JSON.stringify(d),result=await load(raw);assert.equal(result.specimens.reduce((n,s)=>n+s.samples.length,0),10000);
 d.specimens[99].samples.push([100,10,.2]);await assert.rejects(load(JSON.stringify(d)),{code:'PRINTED_DATASET_INVALID'});assert.equal(result.rawJson,raw);
});

test('PRINT2 independent rectangular-section oracle preserves compressive signs and SI equivalents',async()=>{
 const d=dataset();d.specimens[0].samples[1]=[1,-30,-.4];
 const r=(await load(JSON.stringify(d))).specimens[0].samples[1];
 // 30 N / (2 mm * 5 mm) = 3 MPa; -0.4 mm / 20 mm = -0.02.
 assert.equal(r.engineeringStressPa,-3_000_000);assert.equal(r.engineeringStrain,-.02);
 d.units.length='m';d.units.force='kN';d.units.speed='m/s';Object.assign(d.specimens[0],{dimensions:[.002,.005,.04],gaugeLength:.02,speed:.001,samples:[[0,0,0],[1,-.03,-.0004]]});
 assert.deepEqual((await load(JSON.stringify(d))).specimens[0].samples[1],r);
});
