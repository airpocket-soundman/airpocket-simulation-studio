import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CASES, PerfTimeoutError, REPORT_SCOPE, assertLocalOrigin, createStdioClient, mergeMemory, parseArgs, runBrowserPerf, waitForSession, writeReport} from '../scripts/perf-browser.mjs';

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
  assert.ok(m.baselineBytes > 0 && m.peakBytesSampled >= m.baselineBytes && m.afterSettleBytes > 0 && m.afterCancelBytes > 0 && m.samples.count > 0);
  assert.equal(report.browser.userAgent, 'TestUA');
  assert.equal(report.cases[0].memoryReason, undefined);
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
