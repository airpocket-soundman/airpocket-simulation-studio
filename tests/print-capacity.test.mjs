import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runScenario,defaultSpecs,assembleReport,SCOPE,LIMITS} from '../scripts/measure-print-transfer-capacity.mjs';

test('scaled-down capacity run passes and the report matches schemaVersion 1', async () => {
  const records = [];
  for (const spec of defaultSpecs(0.01).filter(s => s.kind === 'roundtrip')) records.push(await runScenario(spec));
  for (const r of records) {
    assert.equal(r.status, 'pass', r.name + ' ' + (r.error ?? ''));
    assert.ok(r.bytes > 0 && r.chunks === Math.ceil(r.bytes / 65536));
    assert.ok(r.exportChunks >= 1 && r.exportHashMatch && r.revisionMatch && r.exportBytesMatch);
    assert.ok(r.wallMs > 0 && r.peakRssBytes > 0 && r.peakHeapUsedBytesSampled > 0 && r.samples >= 1);
    assert.ok(r.segments > 0);
  }
  const report = assembleReport(records, {scale: 0.01});
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.scope, 'node; shared module; not browser heap, not network');
  assert.equal(SCOPE, report.scope);
  assert.equal(report.status, 'scaled');
  assert.equal(report.limits.maxImportBytes, 50000000);
  assert.ok(report.largestPassingBytes > 0 && Array.isArray(report.scenarios));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(report)));
});

test('over-limit payloads are refused with the documented messages', async () => {
  assert.equal(LIMITS.maxImportBytes, 50000000);
  assert.equal(LIMITS.maxGcodeTextChars, 25000000);
  const wanted = ['over-input-50MB+1', 'shared-retention-100MB', 'over-gcode-segments', 'over-gcode-parser-25MB+1'];
  for (const name of wanted) {
    const spec = defaultSpecs(1).find(s => s.name === name);
    const r = await runScenario(spec);
    assert.equal(r.status, 'refused-as-expected', name + ' ' + JSON.stringify(r.refusal ?? r.error));
    assert.ok(r.refusal.matched && r.refusal.message);
  }
});

test('a 4,000,000-byte 3MF (above the former ~3.25 MB base64 regex stack limit) round-trips', async () => {
  const r = await runScenario({name: 'regression-3mf-4MB', kind: 'roundtrip', format: '3mf', bytes: 4000000, gcodeBytes: 2000000, segments: 13000});
  assert.equal(r.status, 'pass', r.error ?? '');
  assert.equal(r.bytes, 4000000);
  assert.ok(r.exportHashMatch && r.revisionMatch);
});
