// Merge and verify the real-Chrome performance/memory evidence for work order 48.
// Exits non-zero when a required check fails; no value is fabricated.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const summary = JSON.parse(readFileSync(path.join(ROOT, '.qa/qa-summary.json'), 'utf8'));
const report = JSON.parse(readFileSync(path.join(ROOT, '.qa/perf-followup48.json'), 'utf8'));
const probe = JSON.parse(readFileSync(path.join(ROOT, '.qa/perf-probe.json'), 'utf8'));
const record = report.cases[0];
const memory = record.memory;
const samples = probe.samples.filter((sample) => Number.isFinite(sample.t));
const start = record.window.startEpochMs;
const end = record.window.endEpochMs;
const cancelSettled = record.window.cancelSettledEpochMs;
const inside = samples.filter((sample) => sample.t >= start && sample.t <= end);
const baseline = samples.filter((sample) => sample.t < start);
const afterCancel = samples.filter((sample) => sample.t >= cancelSettled + 3000);
const afterSettle = samples.filter((sample) => sample.t >= end + 3000);
const byte = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const series = memory?.series ?? {};
const checks = {
  sourceFrozen: summary.sourceSha === '070ec8f885f0e15c889cacaed3c151292c1cc506' && report.git.revision === summary.sourceSha,
  gitClean: report.git.dirty === false,
  brandedChrome: String(report.browserProduct).startsWith('Chrome/155.') && String(report.browser.userAgent).includes('Chrome/155.'),
  ownedOrigin: summary.origin === 'http://127.0.0.1:5198' && report.origin === summary.origin,
  scopes: summary.sessionScopes.join(',') === 'inspect,analyze',
  inputSource: summary.inputChecks.source === true && JSON.stringify(summary.input.sourceModel.bounds) === JSON.stringify([0, 0, 0, 10, 10, 40]),
  inputMaterial: summary.inputChecks.material === true && summary.input.materialProperties.youngModulus === 1e9 && summary.input.materialProperties.poissonRatio === 0,
  inputStructural: summary.inputChecks.structural === true && summary.input.study.kind === 'structural',
  inputConditions: summary.inputChecks.fixedZ0 === true && summary.inputChecks.forceZ40 === true,
  requestedSize8: summary.input.requestedMeshSize === 8 && record.meshSize === 8 && report.repeats === 1,
  caseSucceeded: record.status === 'ok' && record.cold?.state === 'succeeded' && record.warm?.runs?.length === 1 && record.warm.runs[0].state === 'succeeded',
  cancellations: record.cancel?.points?.['first-event']?.states?.cancelled === 1
    && record.cancel?.points?.['half-warm-total']?.states?.cancelled === 1
    && record.cancel.recoveredAfterCancel === true,
  probeIsolated: probe.crossOriginIsolated === true && report.browser.crossOriginIsolated === true,
  probeTiming: probe.intervalMs === 1000 && baseline.length > 0 && inside.length > 0 && afterCancel.length > 0 && afterSettle.length > 0
    && samples[0].t <= start && samples.at(-1).t >= end + 3000,
  memoryAvailable: Boolean(memory?.available) && byte(memory.baselineBytes) && byte(memory.peakBytesSampled)
    && byte(memory.afterCancelBytes) && byte(memory.afterSettleBytes),
  separateSeries: memory?.order?.join(',') === 'uasm,jsHeap' && memory?.measuredSeries?.includes('uasm') && memory?.measuredSeries?.includes('jsHeap')
    && series.uasm?.available === true && series.jsHeap?.available === true,
  perSeriesSamples: series.uasm?.sampleCount > 0 && series.jsHeap?.sampleCount > 0
    && byte(series.uasm.baselineBytes) && byte(series.uasm.peakBytesSampled) && byte(series.uasm.afterCancelBytes) && byte(series.uasm.afterSettleBytes)
    && byte(series.jsHeap.baselineBytes) && byte(series.jsHeap.peakBytesSampled) && byte(series.jsHeap.afterCancelBytes) && byte(series.jsHeap.afterSettleBytes),
};
const passed = Object.values(checks).every(Boolean);
const evidence = {
  schemaVersion: 1,
  date: '2026-10-22',
  taskId: 'PERF1',
  workOrder: 48,
  status: passed ? 'passed' : 'failed',
  parentTaskReleased: false,
  note: 'This record closes only the requested real-Chrome structural-tiny performance/memory follow-up; the parent PERF1 task remains unreleased.',
  sourceSha: summary.sourceSha,
  environment: {
    browser: report.browser.userAgent,
    browserProduct: report.browserProduct,
    debugPort: summary.debugPort,
    origin: summary.origin,
    scopes: summary.sessionScopes,
    engine: 'real branded Chrome via CDP and formal stdio MCP',
  },
  commands: [
    'node scripts/qa-review-48-chrome.mjs',
    'node scripts/perf-browser.mjs --merge-memory .qa/perf-probe.json --out .qa/perf-followup48.json',
    'node scripts/qa-review-48-evidence.mjs',
  ],
  input: summary.input,
  inputChecks: summary.inputChecks,
  measurement: {
    case: record.id,
    meshSizeMm: record.meshSize,
    repeats: report.repeats,
    pollIntervalMs: report.pollIntervalMs,
    timeoutMs: report.timeoutMs,
    coldMs: record.cold?.totalMs ?? null,
    warmRuns: record.warm?.runs ?? [],
    warmSummary: record.warm?.summary ?? null,
    cancel: record.cancel ?? null,
    window: record.window,
  },
  probe: {
    installedAt: summary.probe.installedAt,
    firstSampleAt: samples[0]?.t ?? null,
    lastSampleAt: samples.at(-1)?.t ?? null,
    intervalMs: probe.intervalMs,
    crossOriginIsolated: probe.crossOriginIsolated,
    totalSamples: samples.length,
    baselineSamples: baseline.length,
    insideSamples: inside.length,
    afterCancelSamples: afterCancel.length,
    afterSettleSamples: afterSettle.length,
    baselineLast: baseline.at(-1) ?? null,
    inside: inside,
    afterCancelFirst: afterCancel[0] ?? null,
    afterSettleFirst: afterSettle[0] ?? null,
  },
  memory: {
    note: 'Sampled maxima, not true peak/RSS. Series are reported separately and are never added or substituted.',
    primarySeries: memory?.primarySeries ?? null,
    baselineBytes: memory?.baselineBytes ?? null,
    peakBytesSampled: memory?.peakBytesSampled ?? null,
    afterCancelBytes: memory?.afterCancelBytes ?? null,
    afterSettleBytes: memory?.afterSettleBytes ?? null,
    intervalMs: memory?.intervalMs ?? null,
    sampleCount: memory?.sampleCount ?? null,
    series,
  },
  cleanup: {pageClosed: null, mcpClosed: null, note: 'Historical closure flags were written before finally; actual closure was not independently verified.', probeStopped: summary.cleanup.probeStopped === true},
  checks,
  limitations: [
    'UASM timestamps mark asynchronous measurement requests, not resolution; interval sampling can overlap and window attribution is approximate.',
    'Page and MCP closure were attempted after the summary was written, but not independently verified; cleanup is not an acceptance assertion.',
    'The parent PERF1 status in src/progress.json was not changed.',
    'The browser probe observes periodic samples; peakBytesSampled is an approximation, not a process RSS, GPU or true peak measurement.',
    'UASM and usedJSHeapSize cover different scopes and are not summed; neither is total process memory.',
    'The size-8 mm value is the startJob option used by structural-tiny; the script does not independently report the resulting element count.',
  ],
};
writeFileSync(path.join(ROOT, 'docs/evidence/2026-10-22-review48-real-chrome.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({status: evidence.status, checks, timing: {coldMs: record.cold?.totalMs, warmMs: record.warm?.summary?.totalMs?.median, cancelLatency: record.cancel?.points}, memory: {baseline: memory?.baselineBytes, peak: memory?.peakBytesSampled, afterCancel: memory?.afterCancelBytes, afterSettle: memory?.afterSettleBytes, series: {uasm: series.uasm?.peakBytesSampled, jsHeap: series.jsHeap?.peakBytesSampled}}, probe: evidence.probe, }, null, 2));
if (!passed) process.exitCode = 1;
