import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../scripts/perf-measure.mjs', import.meta.url));

test('perf harness writes a schema-1 Node-scope report for the tiny case (no timing thresholds)', {timeout: 180000}, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'perf-measure-'));
  try {
    const out = path.join(dir, 'report.json');
    const run = spawnSync(process.execPath, [script, '--cases', 'structural-tiny', '--repeats', '1', '--out', out], {encoding: 'utf8', timeout: 170000});
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.scope, 'node-worker-wasm-cpu; not browser, not GPU, not network');
    assert.equal(report.repeats, 1);
    for (const key of ['node', 'platform', 'arch', 'cpuModel']) assert.ok(report.environment[key], key);
    assert.equal(typeof report.git.revision === 'string' || report.git.revision === null, true);
    assert.equal(report.cases.length, 1);
    const c = report.cases[0];
    assert.equal(c.id, 'structural-tiny');
    assert.equal(c.status, 'ok');
    assert.ok(c.mesh.nodes > 0 && c.mesh.elements > 0);
    assert.ok(c.peakRssMiB > 0);
    assert.equal(c.cold.phase, 'cold');
    assert.equal(c.warm.runs.length, 1);
    for (const key of ['totalMs', 'meshMs', 'solverKernelMs', 'postProcessingMs']) {
      assert.ok(Number.isFinite(c.cold[key]) && c.cold[key] >= 0, key);
      const s = c.warm.summary[key];
      assert.ok(s && s.n === 1 && Number.isFinite(s.median) && s.min <= s.median && s.median <= s.max, key);
    }
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('perf harness rejects unknown cases and bad repeat counts', () => {
  assert.notEqual(spawnSync(process.execPath, [script, '--cases', 'nope'], {encoding: 'utf8'}).status, 0);
  assert.notEqual(spawnSync(process.execPath, [script, '--repeats', '0'], {encoding: 'utf8'}).status, 0);
});
