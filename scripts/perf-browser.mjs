// Browser-side performance measurement driver (PERF1/P2). See docs/perf-browser-plan.md.
// Usage: node scripts/perf-browser.mjs [--origin <http://127.0.0.1:5174>] [--out <file>] [--repeats <n>] [--cases <id,id>]
//        [--timeout-ms <n>] [--pair-timeout-ms <n>] [--poll-ms <n>] [--session <id>]
//        node scripts/perf-browser.mjs --merge-memory <probe.json> [--out <report.json>]
//        node scripts/perf-browser.mjs --print-probe | --list
// Scope: a real browser page on localhost driven through the stdio connector (studio-mcp.mjs --browser-origin=...).
// It measures job wall time and cancel response as observed through the connector. It does NOT measure GPU, network,
// other browsers or memory limits. Memory is measured only if the operator installs window.__perfProbe (see --print-probe).
import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const REPORT_SCHEMA_VERSION = 1;
export const REPORT_SCOPE = 'browser via connector; localhost; real browser';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Conceptually the same cases as scripts/perf-measure.mjs (same 10x10x40 mm block, same mesh sizes).
// The page's loaded input must already match the physics; only options.size differs for structural cases.
export const CASES = {
  'structural-tiny': {physics: 'structural', size: 8},
  'structural-medium': {physics: 'structural', size: 3},
  'structural-fine': {physics: 'structural', size: 2},
  'thermal-steady': {physics: 'thermal', size: 3},
  'acoustic-harmonic': {physics: 'acoustic', size: 3}
};
export const DEFAULT_CASES = ['structural-tiny', 'structural-medium', 'structural-fine'];
export const CANCEL_POINTS = ['first-event', 'half-warm-total'];
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'timed_out']);

export const PROBE_SNIPPET = `(()=>{window.__perfProbe?.stop?.();const p=window.__perfProbe={schemaVersion:2,intervalMs:1000,userAgent:navigator.userAgent,crossOriginIsolated:window.crossOriginIsolated===true,samples:[]};
let inflight=false,stopped=false;
const tick=async()=>{if(stopped)return;const t=Date.now();p.samples.push({source:'jsHeap',t,tRequested:t,tResolved:t,usedJSHeapSize:performance.memory?performance.memory.usedJSHeapSize:null,uasmBytes:null});
if(inflight||!p.crossOriginIsolated||!performance.measureUserAgentSpecificMemory)return;inflight=true;const s={source:'uasm',t,tRequested:t,tResolved:null,usedJSHeapSize:null,uasmBytes:null};
try{try{s.uasmBytes=(await performance.measureUserAgentSpecificMemory()).bytes;}catch{}s.tResolved=Date.now();if(!stopped)p.samples.push(s);}finally{inflight=false;}};
const timer=setInterval(tick,p.intervalMs);tick();p.stop=()=>{stopped=true;clearInterval(timer);};
p.report=()=>JSON.stringify({schemaVersion:p.schemaVersion,intervalMs:p.intervalMs,userAgent:p.userAgent,crossOriginIsolated:p.crossOriginIsolated,samples:[...p.samples].sort((a,b)=>a.t-b.t)});})();`;


const median = a => { const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const r3 = v => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;
const stats = v => { const f = v.filter(Number.isFinite); return f.length ? {median: r3(median(f)), min: r3(Math.min(...f)), max: r3(Math.max(...f)), n: f.length} : null; };

export function assertLocalOrigin(origin) {
  let u;
  try { u = new URL(origin); } catch { throw Error('Invalid --origin: not a URL'); }
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  if (!['http:', 'https:'].includes(u.protocol) || !hosts.includes(u.hostname) || u.username || u.password || (u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) {
    throw Error('Refusing origin ' + u.origin + ': only a bare http(s) origin on localhost, 127.0.0.1 or [::1] is allowed');
  }
  return u.origin;
}

export class PerfTimeoutError extends Error {
  constructor(message) { super(message); this.name = 'PerfTimeoutError'; }
}

// --- stdio connector client -------------------------------------------------------------------------------
// The pairing token lives only in this closure. It is handed to `announce` (terminal) and never stored elsewhere.
export async function createStdioClient({origin, spawnImpl = spawn, announce = () => {}, startupTimeoutMs = 15000}) {
  const safeOrigin = assertLocalOrigin(origin);
  const child = spawnImpl(process.execPath, [path.join(REPO, 'scripts/studio-mcp.mjs'), '--browser-origin=' + safeOrigin], {cwd: REPO, stdio: ['pipe', 'pipe', 'pipe']});
  const pending = new Map();
  let id = 0, stderr = '', token = null, info = null;
  const redact = text => token ? String(text).split(token).join('[redacted]') : String(text);
  const lines = createInterface({input: child.stdout});
  lines.on('line', line => { try { const m = JSON.parse(line); pending.get(m.id)?.(m); } catch { /* ignore non JSON-RPC lines */ } });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, m => { pending.delete(key); m.error ? reject(Error(redact(m.error.message))) : resolve(m.result); });
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', id: key, method, params}) + '\n');
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('studio-mcp did not print the Browser connector line in time')), startupTimeoutMs);
    child.once('exit', code => { clearTimeout(timer); reject(Error('studio-mcp exited early (code ' + code + ')')); });
    child.stderr.on('data', d => {
      stderr += d;
      const m = stderr.match(/Browser connector: (.+)\n/);
      if (m && !info) {
        const parsed = JSON.parse(m[1]);
        token = parsed.pairingToken; info = {endpoint: parsed.endpoint, origin: parsed.origin};
        clearTimeout(timer); resolve();
      }
    });
  });
  await rpc('initialize', {protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {name: 'perf-browser', version: '1'}});
  child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  announce({endpoint: info.endpoint, origin: info.origin, pairingToken: token});
  return {
    info,
    async call(tool, args = {}) {
      const result = await rpc('tools/call', {name: tool, arguments: args});
      if (result.isError) throw Object.assign(Error(redact(result.content?.[0]?.text ?? 'connector error')), {code: result.structuredContent?.error?.code});
      return result.structuredContent?.value;
    },
    async close() { try { child.stdin.end(); } catch { /* already closed */ } await new Promise(r => { const t = setTimeout(() => { child.kill(); r(); }, 3000); child.once('exit', () => { clearTimeout(t); r(); }); if (child.exitCode !== null) r(); }); lines.close(); }
  };
}

export async function waitForSession(client, {sessionId = null, timeoutMs = 600000, pollMs = 1000, now = () => Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms))} = {}) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const {sessions = []} = await client.call('studio_browser_sessions', {});
    const s = sessionId ? sessions.find(x => x.sessionId === sessionId) : sessions[0];
    if (s) {
      const scopes = s.scopes ?? [];
      const missing = ['inspect', 'analyze'].filter(x => !scopes.includes(x));
      if (missing.length) throw Error('Paired session lacks required scope(s): ' + missing.join(', ') + ' (grant inspect and analyze in the page connection UI)');
      return s;
    }
    if (now() >= deadline) throw new PerfTimeoutError('No browser session paired within ' + timeoutMs + ' ms');
    await sleep(pollMs);
  }
}

// --- measurement ------------------------------------------------------------------------------------------
const field = (e, k) => e?.[k] ?? e?.event?.[k] ?? e?.data?.[k];

export function createMeasurer({client, sessionId, pollMs = 50, timeoutMs = 300000, now = () => performance.now(), epoch = () => Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms))}) {
  const call = (method, args = {}) => client.call('studio_browser_call', {sessionId, method, args});
  let counter = 0;

  async function pollUntil(job, {onTick, deadlineAt}) {
    // Returns the settled status. Events are pulled by cursor; each is stamped with the host receive time.
    let cursor = 0;
    const events = [];
    for (;;) {
      const page = await call('jobEvents', {jobId: job.jobId, afterSequence: cursor, limit: 100});
      for (const e of page.events ?? []) events.push({e, receivedAt: now()});
      cursor = page.nextSequence ?? cursor;
      const status = await call('jobStatus', {jobId: job.jobId});
      if (TERMINAL.has(status.state) && status.executionSettled === true) {
        // Drain any events that arrived with the final transition.
        const last = await call('jobEvents', {jobId: job.jobId, afterSequence: cursor, limit: 100});
        for (const e of last.events ?? []) events.push({e, receivedAt: now()});
        return {status, events, settledAt: now(), settledEpoch: epoch()};
      }
      if (onTick) await onTick(events, status);
      if (now() >= deadlineAt) throw new PerfTimeoutError('job ' + job.jobId + ' did not settle within ' + timeoutMs + ' ms (last state ' + status.state + ')');
      await sleep(pollMs);
    }
  }

  async function bestEffortCancel(job) { try { await call('cancelJob', {jobId: job.jobId}); } catch { /* reported by the timeout itself */ } }

  async function startJob(revision, caseDef, tag) {
    const requestId = `perf-${tag}-${++counter}-${Math.floor(now())}`;
    const startEpoch = epoch(), t0 = now();
    const job = await call('startJob', {inputRevision: revision, requestId, operation: 'solve', origin: 'api', options: {size: caseDef.size}});
    return {job, t0, startEpoch};
  }

  async function release(job) { try { await call('releaseJob', {jobId: job.jobId}); } catch { /* retained job; non-fatal */ } }

  function phases(events, t0, final) {
    const marks = {};
    for (const {e, receivedAt} of events) {
      const stage = field(e, 'stage'), msg = String(field(e, 'message') ?? '');
      const at = name => { marks[name] ??= receivedAt - t0; };
      marks.first ??= receivedAt - t0;
      if (stage === 'preparation') at('prepared');
      else if (stage === 'progress' && /mesh/i.test(msg)) at('meshStart');
      else if (stage === 'mesh') at('meshDone');
      else if (stage === 'progress' && /^(Solving|Assembling)/i.test(msg)) at('solveStart');
    }
    const total = final - t0, meshDone = marks.meshDone ?? null, solveStart = marks.solveStart ?? meshDone;
    return {
      totalMs: total, firstEventMs: marks.first ?? null,
      meshMs: marks.meshStart !== undefined && meshDone !== null ? meshDone - marks.meshStart : null,
      solvePhaseMs: solveStart === null ? null : total - solveStart,
      eventCount: events.length
    };
  }

  async function runSolve(revision, caseDef, tag) {
    const {job, t0, startEpoch} = await startJob(revision, caseDef, tag);
    try {
      const settled = await pollUntil(job, {deadlineAt: t0 + timeoutMs});
      const ph = phases(settled.events, t0, settled.settledAt);
      const jobElapsedMs = settled.events.reduce((m, {e}) => Math.max(m, field(e, 'elapsedMs') ?? 0), 0);
      if (settled.status.jobId !== job.jobId) throw Error('Performance job identity mismatch');
      const summary = settled.status.result?.mesh;
      const count = key => Number.isSafeInteger(summary?.[key]) && summary[key] > 0 ? summary[key] : null;
      const meshObservation = {source: 'jobStatus.result.mesh', jobId: job.jobId, inputRevision: revision, requestedSizeMm: caseDef.size, nodeCount: count('nodeCount'), elementCount: count('elementCount'), meshRevision: null, identityLimitation: 'Retained job and input identity only; compact job summary does not expose a mesh-content hash.'};
      if (settled.status.inputRevision !== undefined && settled.status.inputRevision !== revision) throw Error('Performance job input revision mismatch');
      if (meshObservation.nodeCount === null || meshObservation.elementCount === null) meshObservation.unavailableReason = 'Compact final mesh counts are absent or invalid; do not infer counts from requested size.';
      return {meshObservation, state: settled.status.state, ok: settled.status.state === 'succeeded', ...ph, jobElapsedMs: jobElapsedMs || null, startEpochMs: startEpoch, endEpochMs: settled.settledEpoch, ...(settled.status.state !== 'succeeded' ? {error: settled.status.error?.message ?? settled.status.state} : {})};
    } catch (err) { if (err instanceof PerfTimeoutError) await bestEffortCancel(job); throw err; }
    finally { await release(job).catch(() => {}); }
  }

  async function runCancel(revision, caseDef, trigger, halfMs) {
    const {job, t0, startEpoch} = await startJob(revision, caseDef, 'cancel-' + trigger);
    let cancelAt = null, requestedAfterMs = null;
    const fire = async () => { if (cancelAt === null) { cancelAt = now(); requestedAfterMs = cancelAt - t0; await call('cancelJob', {jobId: job.jobId}); } };
    try {
      const settled = await pollUntil(job, {deadlineAt: t0 + timeoutMs, onTick: async (events) => {
        if (trigger === 'first-event' && events.length > 0) await fire();
        else if (trigger === 'half-warm-total' && now() - t0 >= halfMs) await fire();
      }});
      const state = settled.status.state === 'cancelled' ? 'cancelled' : settled.status.state === 'succeeded' ? 'completed-before-cancel' : 'error';
      return {trigger, state, requestedAfterMs, latencyMs: cancelAt === null ? null : settled.settledAt - cancelAt, totalMs: settled.settledAt - t0, startEpochMs: startEpoch, endEpochMs: settled.settledEpoch,
        ...(state === 'error' ? {error: settled.status.error?.message ?? settled.status.state} : {})};
    } catch (err) { if (err instanceof PerfTimeoutError) await bestEffortCancel(job); throw err; }
    finally { await release(job).catch(() => {}); }
  }

  async function inspect() { return call('inspect', {}); }
  return {runSolve, runCancel, inspect, call};
}

const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' && !k.endsWith('EpochMs') ? r3(v) : v]));
const FIELDS = ['totalMs', 'firstEventMs', 'meshMs', 'solvePhaseMs', 'jobElapsedMs'];

function summarizeCancel(runs, trigger) {
  const rs = runs.filter(r => r.trigger === trigger), states = {};
  for (const r of rs) states[r.state] = (states[r.state] ?? 0) + 1;
  return {n: rs.length, states, latencyMs: stats(rs.map(r => r.latencyMs)), requestedAfterMs: stats(rs.map(r => r.requestedAfterMs))};
}

export async function runBrowserPerf({client, sessionId, cases = DEFAULT_CASES, repeats = 3, pollMs = 50, timeoutMs = 300000, now, epoch, sleep, log = () => {}} = {}) {
  const m = createMeasurer({client, sessionId, pollMs, timeoutMs, now, epoch, sleep});
  const inspected = await m.inspect();
  const revision = inspected.revision;
  const out = [];
  for (const id of cases) {
    const def = CASES[id];
    const rec = {id, physics: def.physics, meshSize: def.size, status: 'ok', repeats, notes: ['loaded input physics is not verified by the script; the operator must load the matching study']};
    try {
      const cold = await m.runSolve(revision, def, id + '-cold');
      if (!cold.ok) throw Error('cold run ended ' + cold.state + (cold.error ? ': ' + cold.error : ''));
      const warm = [];
      for (let i = 0; i < repeats; i++) { const w = await m.runSolve(revision, def, id + '-warm'); if (!w.ok) throw Error('warm run ended ' + w.state + (w.error ? ': ' + w.error : '')); warm.push(w); }
      const summary = Object.fromEntries(FIELDS.map(f => [f, stats(warm.map(w => w[f]))]));
      const halfMs = (summary.totalMs?.median ?? 0) / 2;
      const cancelRuns = [];
      for (const trigger of CANCEL_POINTS) for (let i = 0; i < repeats; i++) cancelRuns.push(await m.runCancel(revision, def, trigger, halfMs));
      const recovered = await m.runSolve(revision, def, id + '-recover');
      rec.recovered = round(recovered);
      rec.cold = round(cold); rec.warm = {runs: warm.map(round), summary};
      rec.cancel = {
        note: 'latency = cancelJob request to observed (state terminal and executionSettled) through connector polling; includes poll granularity',
        pollIntervalMs: pollMs, baselineWarmTotalMs: r3(summary.totalMs?.median),
        points: {'first-event': summarizeCancel(cancelRuns, 'first-event'), 'half-warm-total': {...summarizeCancel(cancelRuns, 'half-warm-total'), note: 'cancel requested at 50% of the median warm total'}},
        runs: cancelRuns.map(round), recoveredAfterCancel: recovered.ok
      };
      rec.window = {startEpochMs: cold.startEpochMs, endEpochMs: Math.max(recovered.endEpochMs, ...cancelRuns.map(r => r.endEpochMs)), cancelSettledEpochMs: cancelRuns.length ? cancelRuns.at(-1).endEpochMs : null};
      rec.memory = null;
      rec.memoryReason = 'probe-absent: install window.__perfProbe in the page (node scripts/perf-browser.mjs --print-probe) and merge with --merge-memory';
    } catch (err) {
      rec.status = 'failed'; rec.error = err.message; rec.timedOut = err instanceof PerfTimeoutError;
      rec.memory = null; rec.memoryReason = 'case failed';
    }
    log(rec);
    out.push(rec);
  }
  return {
    schemaVersion: REPORT_SCHEMA_VERSION, scope: REPORT_SCOPE, generatedAt: new Date().toISOString(),
    revision, origin: client.info?.origin ?? null,
    git: gitInfo(),
    browser: {userAgent: inspected.userAgent ?? null, userAgentNote: inspected.userAgent ? 'from inspect' : 'not exposed by inspect; filled by --merge-memory when a probe is supplied', crossOriginIsolated: null},
    hostEnvironment: {node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(), cpuModel: os.cpus()[0]?.model ?? null, cpuCount: os.cpus().length, totalMemMiB: Math.round(os.totalmem() / 1048576)},
    repeats, pollIntervalMs: pollMs, timeoutMs, loadedInput: inspected.project ?? null,
    cases: out,
    notes: [
      'Measurements, not support limits or guarantees.',
      'Times are host-observed through connector polling (jobEvents/jobStatus), not in-page performance.now(); they include connector round trips and poll granularity.',
      'cold = first job of the case in the loaded page session; warm = later jobs in the same page (no reload).',
      'GPU, network, other browsers and memory limits are not measured. Memory is null unless an operator probe is merged.',
      'Merged memory is reported per series (uasm = measureUserAgentSpecificMemory, jsHeap = performance.memory.usedJSHeapSize). The series cover different scopes and are never summed; neither is total process or peak RAM.'
    ]
  };
}

// --- memory probe merge -----------------------------------------------------------------------------------
// A probe sample may carry two measurements that cover different scopes:
//   uasmBytes       performance.measureUserAgentSpecificMemory().bytes (cross-origin isolated; semantic, whole-agent)
//   usedJSHeapSize  performance.memory.usedJSHeapSize (non-standard, coarse; JS heap only)
// They are merged as separate series. A value is never substituted per sample from one series to the other, the
// two series are never summed, and no series peak is reported as total process/peak RAM. Only finite, non-negative
// byte values are measurements; NaN/Infinity/-1/null mean "not measured" and are never coerced to 0.
export const MEMORY_SERIES = [
  {key: 'uasm', name: 'measureUserAgentSpecificMemory', field: 'uasmBytes',
    source: 'performance.measureUserAgentSpecificMemory().bytes (cross-origin isolated; semantic, whole-agent scope)'},
  {key: 'jsHeap', name: 'performance.memory.usedJSHeapSize', field: 'usedJSHeapSize',
    source: 'performance.memory.usedJSHeapSize bytes (non-standard, coarse; JS heap scope)'}
];
export const MEMORY_SETTLE_MS = 3000;

const byteValue = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null;

function mergeMemorySeries(def, all, {startEpochMs, endEpochMs, cancelSettledEpochMs, settleMs, intervalMs, probeSchemaVersion}) {
  const valueOf = s => byteValue(s?.[def.field]);
  // UASM is asynchronous. An interval crossing a phase boundary cannot be
  // assigned to either side using only its request time. Legacy probes carry
  // only t and retain their historical request-time interpretation explicitly.
  const bounds = s => {
    if(def.key!=='uasm')return [s.t,s.t];
    const legacy=!('tRequested' in s)&&!('tResolved' in s);
    if(legacy&&probeSchemaVersion!==2)return [s.t,s.t];
    return Number.isFinite(s.tRequested)&&s.tRequested>=0&&Number.isFinite(s.tResolved)&&s.tResolved>=s.tRequested&&s.t===s.tRequested?[s.tRequested,s.tResolved]:[NaN,NaN];
  };
  const inWindow = all.filter(s => {const [a,b]=bounds(s);return a>=startEpochMs&&b<=endEpochMs&&valueOf(s)!==null;});
  const peak = inWindow.length ? Math.max(...inWindow.map(valueOf)) : null;
  const beforeWindow = all.filter(s => bounds(s)[1] < startEpochMs && valueOf(s) !== null);
  const baseline = beforeWindow.length ? valueOf(beforeWindow.at(-1)) : null;
  const afterSettleMs = endEpochMs + settleMs;
  const afterCancelMs = Number.isFinite(cancelSettledEpochMs) ? cancelSettledEpochMs + settleMs : null;
  const afterSettle = all.filter(s => bounds(s)[0] >= afterSettleMs && valueOf(s) !== null)[0] ?? null;
  const afterCancel = afterCancelMs === null ? null : (all.filter(s => bounds(s)[0] >= afterCancelMs && valueOf(s) !== null)[0] ?? null);
  const unavailable = {};
  if (peak === null) unavailable.peakBytesSampled = 'no ' + def.name + ' sample inside the case window';
  if (baseline === null) unavailable.baselineBytes = 'no ' + def.name + ' sample before the case window';
  if (afterCancel === null) unavailable.afterCancelBytes = afterCancelMs === null ? 'case has no cancel-settled timestamp' : 'no ' + def.name + ' sample at or after cancelSettledEpochMs + ' + settleMs + ' ms';
  if (afterSettle === null) unavailable.afterSettleBytes = 'no ' + def.name + ' sample at or after endEpochMs + ' + settleMs + ' ms';
  return {
    name: def.name, source: def.source, field: def.field,
    available: peak !== null,
    sampleCount: inWindow.length, intervalMs,
    timing: def.key==='uasm' ? (probeSchemaVersion!==2&&all.some(s=>!('tRequested' in s)&&!('tResolved' in s)) ? 'legacy request timestamps present; asynchronous completion is unknown for those samples' : 'request/resolution interval must fit wholly within the selected phase') : 'synchronous JS heap at request time',
    baselineBytes: baseline,
    peakBytesSampled: peak,
    afterCancelBytes: afterCancel === null ? null : valueOf(afterCancel),
    afterSettleBytes: afterSettle === null ? null : valueOf(afterSettle),
    unavailable
  };
}

// Mutates `report` in place (the existing contract) and returns it. `probe` is read-only.
export function mergeMemory(report, probe, {settleMs = MEMORY_SETTLE_MS} = {}) {
  if (!probe || !Array.isArray(probe.samples)) throw Error('Probe file has no samples array');
  const probeSchemaVersion = probe.schemaVersion === undefined ? 1 : probe.schemaVersion;
  if (![1,2].includes(probeSchemaVersion)) throw Error('Unsupported memory probe schema');
  const intervalMs = (typeof probe.intervalMs === 'number' && Number.isFinite(probe.intervalMs) && probe.intervalMs > 0) ? probe.intervalMs : null;
  const all = probe.samples.filter(s => s && Number.isFinite(s.t) && s.t>=0).sort((a, b) => a.t - b.t);
  const legacy = s => !('tRequested' in s)&&!('tResolved' in s);
  const validInterval = s => Number.isFinite(s.tRequested)&&s.tRequested>=0&&Number.isFinite(s.tResolved)&&s.tResolved>=s.tRequested&&s.t===s.tRequested;
  report.memoryProbeAudit = {schemaVersion: probeSchemaVersion, totalSamples: probe.samples.length, invalidTimestampSamples: probe.samples.length-all.length, legacyRequestTimeSamples: probeSchemaVersion===1?all.filter(legacy).length:0, invalidUasmTimingSamples: all.filter(s=>!(probeSchemaVersion===1&&legacy(s))&&!validInterval(s)).length, note: 'Invalid UASM timing is excluded from every phase; valid synchronous heap timestamps remain independent.'};
  for (const c of report.cases) {
    if (c.status !== 'ok' || !c.window) continue;
    const {startEpochMs, endEpochMs, cancelSettledEpochMs} = c.window;
    const inside = all.filter(s => s.t >= startEpochMs && s.t <= endEpochMs);
    if (!inside.length) { c.memory = null; c.memoryReason = 'no probe samples inside the case window (probe interval may exceed the case duration)'; continue; }
    const series = {};
    for (const def of MEMORY_SERIES) series[def.key] = mergeMemorySeries(def, all, {startEpochMs, endEpochMs, cancelSettledEpochMs, settleMs, intervalMs, probeSchemaVersion});
    const measured = MEMORY_SERIES.filter(d => series[d.key].available);
    if (!measured.length) {
      c.memory = null;
      c.memoryReason = 'probe samples inside the case window carry no finite non-negative byte value for any series (' + MEMORY_SERIES.map(d => d.key).join(', ') + ')';
      continue;
    }
    // Flat fields are an explicit single-series view (`primarySeries`) kept for compatibility; they never combine series.
    const primary = measured[0];
    c.memory = {
      available: true,
      primarySeries: primary.key,
      source: series[primary.key].source,
      baselineBytes: series[primary.key].baselineBytes,
      peakBytesSampled: series[primary.key].peakBytesSampled,
      afterCancelBytes: series[primary.key].afterCancelBytes,
      afterSettleBytes: series[primary.key].afterSettleBytes,
      samples: {intervalMs, count: series[primary.key].sampleCount},
      intervalMs,
      sampleCount: inside.length,
      order: MEMORY_SERIES.map(d => d.key),
      measuredSeries: measured.map(d => d.key),
      series,
      note: 'peakBytesSampled is the maximum of periodic samples (an approximation) computed per series from that series\u2019 own samples only. Do not add the series together and do not report either series as total process or peak RAM. The probe itself uses memory.'
    };
    delete c.memoryReason;
  }
  report.browser.userAgent ??= probe.userAgent ?? null;
  if (probe.userAgent && report.browser.userAgent === probe.userAgent) report.browser.userAgentNote = 'from operator probe';
  report.browser.crossOriginIsolated = probe.crossOriginIsolated ?? null;
  return report;
}

function gitInfo() {
  const git = args => { try { return execFileSync('git', args, {cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch { return null; } };
  const status = git(['status', '--porcelain']);
  return {revision: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), dirty: status === null ? null : status.length > 0};
}

export function parseArgs(argv) {
  const o = {origin: 'http://127.0.0.1:5174', out: '.qa/perf-browser-report.json', repeats: 3, cases: DEFAULT_CASES.join(','), timeoutMs: 300000, pairTimeoutMs: 600000, pollMs: 50, session: null, mergeMemory: null, printProbe: false, list: false};
  const val = (i, name) => { if (argv[i] === undefined) throw Error(name + ' requires a value'); return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--origin') o.origin = val(++i, a);
    else if (a === '--out') o.out = val(++i, a);
    else if (a === '--repeats') o.repeats = Number(val(++i, a));
    else if (a === '--cases') o.cases = val(++i, a);
    else if (a === '--timeout-ms') o.timeoutMs = Number(val(++i, a));
    else if (a === '--pair-timeout-ms') o.pairTimeoutMs = Number(val(++i, a));
    else if (a === '--poll-ms') o.pollMs = Number(val(++i, a));
    else if (a === '--session') o.session = val(++i, a);
    else if (a === '--merge-memory') o.mergeMemory = val(++i, a);
    else if (a === '--print-probe') o.printProbe = true;
    else if (a === '--list') o.list = true;
    else throw Error('Unknown argument: ' + a);
  }
  if (!Number.isInteger(o.repeats) || o.repeats < 1 || o.repeats > 10) throw Error('--repeats must be an integer from 1 to 10');
  for (const [k, n] of [['--timeout-ms', o.timeoutMs], ['--pair-timeout-ms', o.pairTimeoutMs], ['--poll-ms', o.pollMs]]) if (!Number.isFinite(n) || n < 10) throw Error(k + ' must be a number >= 10');
  assertLocalOrigin(o.origin);
  return o;
}

function operatorInstructions({endpoint, origin, pairingToken}, showCode) {
  return [
    'Operator steps (one dedicated Chrome profile/tab, localhost only):',
    '  1. Open ' + origin + '/?lang=en and load the case input (10x10x40 mm block with the matching study).',
    '  2. Optional memory: open DevTools and paste the probe from `node scripts/perf-browser.mjs --print-probe`.',
    '  3. In the app connection UI enter, and grant ONLY the inspect and analyze scopes:',
    '       endpoint: ' + endpoint,
    '       pairing code: ' + (showCode ? pairingToken : '(withheld: stdout is not a terminal; rerun interactively)'),
    '  4. Wait; the script starts as soon as a paired session appears. Do not touch the page while it runs.',
    ''
  ].join('\n');
}

export function writeReport(report, out) {
  const file = path.resolve(out);
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  return file;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.printProbe) { console.log(PROBE_SNIPPET); return 0; }
  if (o.list) { console.log(Object.keys(CASES).join('\n')); return 0; }
  if (o.mergeMemory) {
    const file = path.resolve(o.out);
    const report = mergeMemory(JSON.parse(readFileSync(file, 'utf8')), JSON.parse(readFileSync(path.resolve(o.mergeMemory), 'utf8')));
    writeReport(report, o.out);
    for (const c of report.cases) {
      if (!c.memory) { console.log(c.id.padEnd(20), 'memory: ' + c.memoryReason); continue; }
      // List every series separately; never print a summed or combined peak as total RAM.
      const parts = c.memory.order.map(k => { const s = c.memory.series[k]; return s.available ? `${k} sampled-max ${s.peakBytesSampled} B` : `${k} unavailable`; });
      console.log(c.id.padEnd(20), 'memory (per series, not a total): ' + parts.join('; '));
    }
    return 0;
  }
  const ids = o.cases.split(',');
  for (const id of ids) if (!CASES[id]) throw Error('Unknown case: ' + id);
  const client = await createStdioClient({origin: o.origin, announce: info => process.stdout.write(operatorInstructions(info, process.stdout.isTTY === true))});
  let code = 0;
  try {
    const session = await waitForSession(client, {sessionId: o.session, timeoutMs: o.pairTimeoutMs});
    console.log('paired session', session.sessionId, 'scopes', (session.scopes ?? []).join(','));
    const report = await runBrowserPerf({client, sessionId: session.sessionId, cases: ids, repeats: o.repeats, pollMs: o.pollMs, timeoutMs: o.timeoutMs,
      log: c => console.log(c.id.padEnd(20), c.status === 'ok' ? `cold ${c.cold.totalMs} ms warm median ${c.warm.summary.totalMs?.median} ms cancel ${CANCEL_POINTS.map(p => p + ' ' + c.cancel.points[p].latencyMs?.median + ' ms').join('; ')} recovered=${c.cancel.recoveredAfterCancel}` : 'FAILED ' + c.error)});
    console.log('report:', writeReport(report, o.out));
    if (report.cases.some(c => c.status !== 'ok')) code = 1;
  } finally { await client.close(); }
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
