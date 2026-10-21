import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CASES, MEMORY_SERIES, MEMORY_SETTLE_MS, PerfTimeoutError, REPORT_SCOPE, assertLocalOrigin, createStdioClient, mergeMemory, parseArgs, runBrowserPerf, waitForSession, writeReport} from '../scripts/perf-browser.mjs';

const TOKEN = 'SECRET-PAIRING-TOKEN-0123456789';

// Fake connector on a simulated clock: sleep() advances time, jobs settle after `duration` simulated ms.
function fake({duration = 400, never = false, settleDelay = 30} = {}) {
  const clock = {t: 1000};
  const jobs = new Map();
  let n = 0;
  const view = j => {
    const age = clock.t - j.t0;
    if (j.cancelAt !== null && !never) return age >= (j.cancelAt - j.t0) + settleDelay ? {state: 'cancelled', executionSettled: true} : {state: 'running', executionSettled: false};
    if (!never && age >= duration) return {state: 'succeeded', executionSettled: true};
    return {state: 'running', executionSettled: false};
  };
  const methods = {
    inspect: () => ({revision: 'sha256:' + 'a'.repeat(64), project: {loaded: true, name: 'block'}}),
    startJob: a => { const j = {id: 'job-' + ++n, t0: clock.t, cancelAt: null, args: a}; jobs.set(j.id, j); return {jobId: j.id, state: 'running'}; },
    jobStatus: a => ({jobId: a.jobId, ...view(jobs.get(a.jobId))}),
    jobEvents: a => {
      const j = jobs.get(a.jobId), age = clock.t - j.t0, all = [];
      if (age >= 10) all.push({sequence: 1, elapsedMs: 10, type: 'progress', stage: 'progress', message: 'Meshing'});
      if (age >= 100) all.push({sequence: 2, elapsedMs: 100, type: 'progress', stage: 'mesh'});
      if (age >= 120) all.push({sequence: 3, elapsedMs: 120, type: 'progress', stage: 'progress', message: 'Solving'});
      const events = all.filter(e => e.sequence > a.afterSequence);
      return {events, nextSequence: events.at(-1)?.sequence ?? a.afterSequence, hasMore: false};
    },
    cancelJob: a => { const j = jobs.get(a.jobId); j.cancelAt ??= clock.t; return {state: 'running'}; },
    releaseJob: () => ({released: true})
  };
  const calls = [];
  const client = {
    info: {origin: 'http://127.0.0.1:5174'},
    async call(tool, args) {
      calls.push([tool, args]);
      if (tool === 'studio_browser_sessions') return {sessions: [{sessionId: 's1', scopes: ['inspect', 'analyze']}]};
      assert.equal(tool, 'studio_browser_call');
      return methods[args.method](args.args);
    }
  };
  return {client, calls, opts: {now: () => clock.t, epoch: () => 1700000000000 + clock.t, sleep: async ms => { clock.t += ms; }, pollMs: 20}};
}

test('non-localhost origins are refused, localhost ones accepted', () => {
  for (const bad of ['https://example.com', 'http://192.168.1.5:5174', 'http://localhost.evil.com', 'http://127.0.0.1:5174/app', 'http://user:pw@localhost:5174', 'file:///x', 'not a url'])
    assert.throws(() => assertLocalOrigin(bad), /Refusing|Invalid/, bad);
  for (const ok of ['http://127.0.0.1:5174', 'http://localhost:5174', 'http://[::1]:5174', 'https://localhost:8443']) assert.ok(assertLocalOrigin(ok));
  assert.throws(() => parseArgs(['--origin', 'https://airpocket-soundman.github.io']), /Refusing/);
  assert.equal(parseArgs([]).origin, 'http://127.0.0.1:5174');
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
  assert.throws(() => parseArgs(['--repeats', '0']), /--repeats/);
});

test('fake run produces schema v1 with cold, warm, cancel and null memory with a reason', async () => {
  const f = fake();
  const report = await runBrowserPerf({client: f.client, sessionId: 's1', cases: ['structural-tiny', 'structural-medium'], repeats: 2, timeoutMs: 5000, ...f.opts});
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.scope, REPORT_SCOPE);
  assert.equal(report.revision, 'sha256:' + 'a'.repeat(64));
  assert.equal(report.browser.userAgent, null);
  assert.equal(report.cases.length, 2);
  for (const c of report.cases) {
    assert.equal(c.status, 'ok');
    assert.equal(c.meshSize, CASES[c.id].size);
    assert.ok(c.cold.totalMs >= 400 && c.cold.firstEventMs >= 10 && c.cold.meshMs >= 0);
    assert.equal(c.warm.runs.length, 2);
    assert.equal(c.warm.summary.totalMs.n, 2);
    for (const p of ['first-event', 'half-warm-total']) {
      const pt = c.cancel.points[p];
      assert.equal(pt.n, 2);
      assert.deepEqual(pt.states, {cancelled: 2});
      assert.ok(pt.latencyMs.median >= 30, 'latency includes simulated settle delay');
    }
    assert.ok(c.cancel.points['half-warm-total'].requestedAfterMs.median >= c.warm.summary.totalMs.median / 2 - 1);
    assert.equal(c.cancel.recoveredAfterCancel, true);
    assert.equal(c.memory, null);
    assert.match(c.memoryReason, /probe-absent/);
  }
  // every started job froze the same revision and requested the case mesh size; jobs were released
  const starts = f.calls.filter(([, a]) => a.method === 'startJob').map(([, a]) => a.args);
  assert.ok(starts.every(a => a.inputRevision === report.revision && typeof a.requestId === 'string' && [8, 3].includes(a.options.size)));
  assert.equal(new Set(starts.map(a => a.requestId)).size, starts.length);
  assert.equal(f.calls.filter(([, a]) => a.method === 'releaseJob').length, starts.length);
});

test('memory probe merge fills the memory block and user agent', async () => {
  const f = fake();
  const report = await runBrowserPerf({client: f.client, sessionId: 's1', cases: ['structural-tiny'], repeats: 1, timeoutMs: 5000, ...f.opts});
  const w = report.cases[0].window;
  const samples = [];
  for (let t = w.startEpochMs - 2000; t <= w.endEpochMs + 6000; t += 50) samples.push({t, usedJSHeapSize: 1000 + (t % 7), uasmBytes: null});
  mergeMemory(report, {intervalMs: 50, userAgent: 'TestUA', crossOriginIsolated: false, samples});
  const m = report.cases[0].memory;
  assert.equal(m.available, true);
  // Only the JS heap series carries values here; UASM must stay explicitly unavailable, not borrow the heap.
  assert.equal(m.primarySeries, 'jsHeap');
  assert.equal(m.series.uasm.available, false);
  assert.match(m.series.uasm.unavailable.peakBytesSampled, /measureUserAgentSpecificMemory/);
  const s = m.series.jsHeap;
  assert.ok(s.baselineBytes > 0 && s.peakBytesSampled >= s.baselineBytes && s.afterSettleBytes > 0 && s.afterCancelBytes > 0 && s.sampleCount > 0);
  assert.equal(m.baselineBytes, s.baselineBytes);
  assert.equal(m.peakBytesSampled, s.peakBytesSampled);
  assert.equal(report.browser.userAgent, 'TestUA');
  assert.equal(report.cases[0].memoryReason, undefined);
});

// --- period-series memory merge fixtures ------------------------------------------------------------------
// Minimal schema-1 report with one ok case and a controllable window, so the numeric acceptance can pin
// exact sample timestamps without going through the fake connector clock.
const windowedReport = window => ({
  schemaVersion: 1, scope: REPORT_SCOPE,
  browser: {userAgent: null, userAgentNote: 'not from probe', crossOriginIsolated: null},
  cases: [{id: 'structural-tiny', status: 'ok', window, memory: null, memoryReason: 'probe-absent'}]
});

test('mixed UASM and JS-heap series are reported separately and never summed into a peak', () => {
  const window = {startEpochMs: 100000, endEpochMs: 110000, cancelSettledEpochMs: 108000};
  const samples = [
    {t: 95000, uasmBytes: 900, usedJSHeapSize: 100},   // baseline, before the window
    {t: 100000, uasmBytes: 1000, usedJSHeapSize: 200},
    {t: 101000, uasmBytes: null, usedJSHeapSize: 250}, // UASM missing here; must not fall back to the heap
    {t: 102000, uasmBytes: 1200, usedJSHeapSize: 300},
    {t: 103000, uasmBytes: 1100, usedJSHeapSize: null},// heap missing here; must not fall back to UASM
    {t: 109000, uasmBytes: 800, usedJSHeapSize: 150},
    {t: 111500, uasmBytes: 1050, usedJSHeapSize: 220}, // >= cancelSettled 108000 + 3000
    {t: 114000, uasmBytes: 950, usedJSHeapSize: 190}   // >= end 110000 + 3000
  ];
  const report = windowedReport(window);
  mergeMemory(report, {intervalMs: 1000, userAgent: 'TestUA', crossOriginIsolated: true, samples});
  const m = report.cases[0].memory;
  assert.equal(m.available, true);
  assert.deepEqual(m.order, MEMORY_SERIES.map(d => d.key));
  assert.deepEqual(m.measuredSeries, ['uasm', 'jsHeap']);
  assert.equal(m.series.uasm.peakBytesSampled, 1200);
  assert.equal(m.series.jsHeap.peakBytesSampled, 300);
  // baseline and post-cancel values come from the same series as the peak
  assert.equal(m.series.uasm.baselineBytes, 900);
  assert.equal(m.series.jsHeap.baselineBytes, 100);
  assert.equal(m.series.uasm.afterCancelBytes, 1050);
  assert.equal(m.series.jsHeap.afterCancelBytes, 220);
  assert.equal(m.series.uasm.afterSettleBytes, 950);
  assert.equal(m.series.jsHeap.afterSettleBytes, 190);
  // a spot where UASM is missing is not replaced by the heap, and vice versa
  assert.equal(m.series.uasm.sampleCount, 4);
  assert.equal(m.series.jsHeap.sampleCount, 4);
  // no total: neither the sum (1500) nor any combined value is presented as RAM
  assert.equal(m.totalBytes, undefined);
  assert.equal(m.totalPeakBytes, undefined);
  assert.notEqual(m.peakBytesSampled, 1500);
  assert.ok(!JSON.stringify(m).includes('1500'));
  // the flat compatibility fields mirror the primary (semantic) series only
  assert.equal(m.primarySeries, 'uasm');
  assert.equal(m.peakBytesSampled, 1200);
  assert.equal(m.samples.intervalMs, 1000);
  assert.match(m.note, /per series|per-series|periodic/i);
});

test('NaN, Infinity and negative bytes are not adopted; a 1000 ms interval is not a true peak', () => {
  const window = {startEpochMs: 100000, endEpochMs: 110000, cancelSettledEpochMs: null};
  const samples = [
    {t: 100500, uasmBytes: NaN, usedJSHeapSize: Infinity},
    {t: 101500, uasmBytes: Infinity, usedJSHeapSize: -1},
    {t: 102500, uasmBytes: -1, usedJSHeapSize: NaN},
    {t: 103500, uasmBytes: 500, usedJSHeapSize: 400}
  ];
  const report = windowedReport(window);
  mergeMemory(report, {intervalMs: 1000, samples});
  const m = report.cases[0].memory;
  assert.equal(m.series.uasm.peakBytesSampled, 500);
  assert.equal(m.series.jsHeap.peakBytesSampled, 400);
  assert.equal(m.series.uasm.sampleCount, 1);
  assert.equal(m.series.jsHeap.sampleCount, 1);
  assert.equal(m.intervalMs, 1000);
  assert.ok(!/true peak|exact peak/i.test(m.note));
  assert.match(m.note, /periodic|approximation/i);
  // the case has no cancel-settled timestamp, so the post-cancel value stays null with a reason
  assert.equal(m.series.uasm.afterCancelBytes, null);
  assert.match(m.series.uasm.unavailable.afterCancelBytes, /no cancel-settled timestamp/);
});

test('single-series probes keep the other series unavailable and never borrow its values', () => {
  const window = {startEpochMs: 100000, endEpochMs: 110000, cancelSettledEpochMs: 105000};
  // UASM only
  const uasmOnly = windowedReport(window);
  mergeMemory(uasmOnly, {intervalMs: 1000, crossOriginIsolated: true,
    samples: [{t: 100500, uasmBytes: 1000}, {t: 101500, uasmBytes: 1200}, {t: 109000, uasmBytes: 700}]});
  let m = uasmOnly.cases[0].memory;
  assert.equal(m.available, true);
  assert.equal(m.primarySeries, 'uasm');
  assert.equal(m.series.uasm.peakBytesSampled, 1200);
  assert.equal(m.series.jsHeap.available, false);
  assert.equal(m.series.jsHeap.peakBytesSampled, null);
  assert.match(m.series.jsHeap.unavailable.peakBytesSampled, /usedJSHeapSize/);
  // heap only
  const heapOnly = windowedReport(window);
  mergeMemory(heapOnly, {intervalMs: 1000, crossOriginIsolated: false,
    samples: [{t: 100500, usedJSHeapSize: 200}, {t: 101500, usedJSHeapSize: 300}, {t: 109000, usedJSHeapSize: 150}]});
  m = heapOnly.cases[0].memory;
  assert.equal(m.available, true);
  assert.equal(m.primarySeries, 'jsHeap');
  assert.equal(m.series.jsHeap.peakBytesSampled, 300);
  assert.equal(m.series.uasm.available, false);
  assert.equal(m.series.uasm.peakBytesSampled, null);
});

test('missing window samples and missing post-cancel samples stay null with a reason', () => {
  // no sample inside the window at all
  const empty = windowedReport({startEpochMs: 100000, endEpochMs: 110000, cancelSettledEpochMs: 105000});
  mergeMemory(empty, {intervalMs: 1000, samples: [{t: 50000, uasmBytes: 1000, usedJSHeapSize: 200}]});
  assert.equal(empty.cases[0].memory, null);
  assert.match(empty.cases[0].memoryReason, /no probe samples inside the case window/);

  // samples inside the window, but none after the cancel settle offset
  const window = {startEpochMs: 100000, endEpochMs: 110000, cancelSettledEpochMs: 109500};
  const report = windowedReport(window);
  mergeMemory(report, {intervalMs: 1000, samples: [{t: 100000, uasmBytes: 1000, usedJSHeapSize: 200}, {t: 105000, uasmBytes: 1100, usedJSHeapSize: 210}]});
  const m = report.cases[0].memory;
  assert.equal(m.series.uasm.peakBytesSampled, 1100);
  assert.equal(m.series.uasm.afterCancelBytes, null);
  assert.match(m.series.uasm.unavailable.afterCancelBytes, new RegExp('cancelSettledEpochMs \\+ ' + MEMORY_SETTLE_MS + ' ms'));
  assert.equal(m.series.uasm.afterSettleBytes, null);
  assert.match(m.series.uasm.unavailable.afterSettleBytes, new RegExp('endEpochMs \\+ ' + MEMORY_SETTLE_MS + ' ms'));
});

test('mergeMemory mutates the report in place, leaves the probe untouched, and keeps timing when memory is unavailable', async () => {
  const f = fake();
  const report = await runBrowserPerf({client: f.client, sessionId: 's1', cases: ['structural-tiny'], repeats: 1, timeoutMs: 5000, ...f.opts});
  const before = structuredClone(report.cases[0]);
  const probe = {intervalMs: 1000, samples: [{t: report.cases[0].window.startEpochMs - 5000, uasmBytes: 1000, usedJSHeapSize: 200}]};
  const probeSnapshot = structuredClone(probe);
  const returned = mergeMemory(report, probe);
  assert.equal(returned, report, 'existing contract: report is mutated in place and returned');
  assert.deepEqual(probe, probeSnapshot, 'probe input is read-only');
  const c = report.cases[0];
  assert.equal(c.memory, null);
  assert.match(c.memoryReason, /no probe samples inside the case window/);
  // an unavailable memory series does not damage the successful elapsed/cancel measurements
  assert.equal(c.cold.totalMs, before.cold.totalMs);
  assert.equal(c.warm.summary.totalMs.median, before.warm.summary.totalMs.median);
  assert.deepEqual(c.cancel.points, before.cancel.points);
});

test('a job that never settles is recorded as a failed case; report is still produced and nothing leaks the token', async () => {
  const f = fake({never: true});
  const report = await runBrowserPerf({client: f.client, sessionId: 's1', cases: ['structural-tiny'], repeats: 1, timeoutMs: 500, ...f.opts});
  const c = report.cases[0];
  assert.equal(c.status, 'failed');
  assert.equal(c.timedOut, true);
  assert.match(c.error, /did not settle within 500 ms/);
  assert.equal(c.memory, null);
  assert.ok(f.calls.some(([, a]) => a.method === 'cancelJob'), 'best-effort cancel after timeout');
  assert.ok(report.cases.some(x => x.status !== 'ok'), 'main() maps this to a non-zero exit code');
});

test('waitForSession waits for pairing, enforces scopes and times out', async () => {
  let t = 0, polls = 0;
  const client = {call: async () => ({sessions: ++polls < 3 ? [] : [{sessionId: 'x', scopes: ['inspect', 'analyze']}]})};
  const s = await waitForSession(client, {now: () => t, sleep: async ms => { t += ms; }, pollMs: 10, timeoutMs: 1000});
  assert.equal(s.sessionId, 'x');
  await assert.rejects(waitForSession({call: async () => ({sessions: [{sessionId: 'y', scopes: ['inspect']}]})}, {}), /lacks required scope.*analyze/);
  await assert.rejects(waitForSession({call: async () => ({sessions: []})}, {now: () => t, sleep: async ms => { t += ms; }, pollMs: 10, timeoutMs: 50}), PerfTimeoutError);
});

test('the pairing token is never written to the report or to a temp dir', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'perf-browser-'));
  try {
    const f = fake();
    const client = {...f.client, info: {origin: 'http://127.0.0.1:5174', endpoint: 'http://127.0.0.1:1'}, _token: TOKEN};
    const report = await runBrowserPerf({client, sessionId: 's1', cases: ['structural-tiny'], repeats: 1, timeoutMs: 5000, ...f.opts});
    const file = writeReport(report, path.join(dir, 'r.json'));
    const text = readFileSync(file, 'utf8');
    assert.ok(!text.includes(TOKEN) && !/token|pairingToken/i.test(text));
    for (const name of readdirSync(dir)) assert.ok(!readFileSync(path.join(dir, name), 'utf8').includes(TOKEN));
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('stdio client spawns studio-mcp, hands pairing only to announce, and closes cleanly', async () => {
  let announced = null;
  const client = await createStdioClient({origin: 'http://127.0.0.1:5174', announce: a => { announced = a; }});
  try {
    assert.ok(announced.pairingToken && announced.endpoint.startsWith('http://127.0.0.1:'));
    assert.deepEqual(Object.keys(client.info).sort(), ['endpoint', 'origin']);
    assert.ok(!JSON.stringify(client.info).includes(announced.pairingToken));
    assert.deepEqual(await client.call('studio_browser_sessions', {}), {sessions: []});
    await assert.rejects(createStdioClient({origin: 'https://example.com'}), /Refusing/);
  } finally { await client.close(); }
});
