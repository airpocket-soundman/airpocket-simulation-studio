import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHost,solveCase,fillStore,roundTrip,quartiles} from '../scripts/measure-case-archive-transfer.mjs';
import {canonicalJson,getProjectRevision} from '../src/project-revision.js';

// Goldens were computed with the implementation before the performance change (4 cases of the 2 mm elastic bar).
const GOLDEN={
 archiveBytes: 4892027,
 archiveSha256: 'sha256:291aa2dc4571bd7329ca4f3936d7b4e88472ebb82f7087fdabe43444bfa8b182',
 archiveRevision: 'sha256:afdc4c41038d8643927e6d6b2e5a1a879e10fbd8a39eaf9e5b590ef0e454abca',
 listHash: '143f0a0e41ef2051fc058f93971baa29f2d3fb009d49caa22de0451c3fda2c75',
 saveHash: '2364663813b38e56231739564c35b39cdfe96d417a796c946c72b628ee121026'
};
const sha=text=>createHash('sha256').update(text).digest('hex');

test('case archive transfer keeps identical bytes, hashes and revisions and scales linearly',{timeout:60000},async()=>{
 const output=await solveCase(2),source=createHost(),saves=[];
 source.display.value=output;
 const revision=await getProjectRevision(JSON.parse(JSON.stringify(output)));
 for(let i=0;i<4;i++)saves.push(await source.operations.saveCurrent({name:`large case ${i+1}`,expectedResultRevision:revision}));
 const list=await source.operations.list();
 assert.equal(sha(canonicalJson(saves)),GOLDEN.saveHash);
 assert.equal(sha(canonicalJson(list)),GOLDEN.listHash);
 const destination=createHost(),trip=await roundTrip(source,destination);
 assert.equal(trip.bytes.length,GOLDEN.archiveBytes);
 assert.equal(trip.sha256,GOLDEN.archiveSha256);
 assert.equal(trip.archiveRevision,GOLDEN.archiveRevision);
 assert.equal(trip.restoredRevision,GOLDEN.archiveRevision);
 assert.deepEqual((await destination.operations.list()).cases.map(c=>c.revision),list.cases.map(c=>c.revision));
 // Per-chunk cost must not depend on how much has already been staged/read. Generous factor and absolute floor for CI noise.
 for(const [label,times] of [['write',trip.writeTimes],['read',trip.readTimes]]){
  assert.ok(times.length>=60,`${label}: enough chunks`);
  const {firstQuarterMeanMs:first,lastQuarterMeanMs:last}=quartiles(times);
  assert.ok(last<=Math.max(3*first,10),`${label}: last-quarter mean ${last} ms vs first-quarter mean ${first} ms`);
 }
});
