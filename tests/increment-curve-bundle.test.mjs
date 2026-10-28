import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import initialize from '@loumalouomega/gmsh-wasm';
import {solveElastic} from '../src/fem-core.js';
import {createIncrementCurveArtifacts} from '../src/increment-curve-export.js';
import {buildSyntheticBarBundle,writeSyntheticBarBundle} from '../scripts/increment-curve-bundle.mjs';

const forces=[0,50,100,50,0];

test('explicit force route re-solves each step and matches the analytic bar',async()=>{
  const {bundle,artifacts}=await buildSyntheticBarBundle({forces});
  const peak=artifacts.curve.steps[2];
  assert.equal(peak.status,'converged');
  assert.ok(Math.abs(peak.extensionMm/0.04-1)<1e-6);
  assert.ok(Math.abs(peak.engineeringStressPa/1e6-1)<1e-6);
  assert.ok(Math.abs(peak.engineeringStrain/0.001-1)<1e-6);
  assert.equal(artifacts.curve.steps[0].extensionMm,0);
  assert.deepEqual(artifacts.curve.steps.map(step=>step.controlledValue),forces);
  // Repeated loads come from separate identical solves; different loads give different results.
  assert.equal(artifacts.curve.steps[1].resultRevision,artifacts.curve.steps[3].resultRevision);
  assert.notEqual(artifacts.curve.steps[1].resultRevision,peak.resultRevision);
  const reread=await createIncrementCurveArtifacts(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(reread.curve,artifacts.curve);
});

test('a failing solve yields a failed row with no numbers and later steps are not interpolated',async()=>{
  let call=0;
  const {artifacts}=await buildSyntheticBarBundle({forces:[0,50,100]},{initializeGmsh:initialize,solve:(...args)=>{if(++call===2)throw Error('boom');return solveElastic(...args);}});
  const [first,failed,last]=artifacts.curve.steps;
  assert.equal(first.status,'converged');
  assert.equal(failed.status,'failed');assert.equal(failed.extensionMm,null);assert.equal(failed.engineeringStressPa,null);
  assert.equal(last.status,'converged');
});

test('unconverged residual is a failed row, and invalid routes are rejected',async()=>{
  const {artifacts}=await buildSyntheticBarBundle({forces:[10]},{initializeGmsh:initialize,solve:(...args)=>({...solveElastic(...args),residual:1})});
  assert.equal(artifacts.curve.steps[0].status,'failed');
  for(const bad of [[],[NaN],[Infinity],[1e12],'x',new Array(129).fill(1)])await assert.rejects(buildSyntheticBarBundle({forces:bad}));
  await assert.rejects(buildSyntheticBarBundle({forces:[1],poissonRatio:0.5}));
});

test('writer refuses overwrite, relative paths and leaves no file when a build fails',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'curve-bundle-'));
  try{
    const out=join(directory,'bundle.json');
    const saved=await writeSyntheticBarBundle({forces:[0,100]},out);
    const written=JSON.parse(await readFile(out,'utf8'));
    assert.deepEqual(Object.keys(written),['spec','steps']);
    assert.equal(saved.steps[1].status,'converged');
    await assert.rejects(writeSyntheticBarBundle({forces:[0,100]},out),/already exists/);
    await assert.rejects(writeSyntheticBarBundle({forces:[0]},'relative.json'),/absolute/);
    await assert.rejects(writeSyntheticBarBundle({forces:[NaN]},join(directory,'failing.json')));
    await writeFile(join(directory,'keep.txt'),'x');
    assert.deepEqual((await readdir(directory)).sort(),['bundle.json','keep.txt']);
  }finally{await rm(directory,{recursive:true,force:true});}
});
