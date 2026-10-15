// Node-side performance measurement harness (PERF1/P2). See docs/performance-measurement.md.
// Usage: node scripts/perf-measure.mjs [--out <file>] [--repeats <n>] [--cases <id,id|all>] [--cancel|--no-cancel] [--list]
// Scope: Node worker_threads + WASM on CPU only. It says nothing about browsers, WebGPU, network or transfer size.
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {BoxGeometry} from 'three';

export const REPORT_SCHEMA_VERSION = 1;
export const REPORT_SCOPE = 'node-worker-wasm-cpu; not browser, not GPU, not network';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function box(bounds) {
  const g = new BoxGeometry(...bounds.slice(3)).toNonIndexed();
  g.translate(...bounds.slice(0, 3).map((v, k) => v + bounds[k + 3] / 2));
  const positions = Array.from(g.attributes.position.array);
  g.dispose();
  return {positions, faceIds: Array.from({length: positions.length / 9}, (_, i) => Math.floor(i / 2))};
}
const face = (mesh, z) => mesh.positions.flatMap((_, i) => i % 9 === 0 && [2, 5, 8].every(k => Math.abs(mesh.positions[i + k] - z) < 1e-7) ? [i / 9] : []);
const region = (mesh, triangles) => ({mesh, triangles});
const BOUNDS = [0, 0, 0, 10, 10, 40];
function base(study, materialProperties, conditions) {
  const m = box(BOUNDS);
  return {version: 1, sourceModel: {kind: 'box', bounds: BOUNDS}, study, ...(materialProperties ? {materialProperties} : {}), meshes: [m], conditions: conditions(m)};
}
const structural = m => [
  {type: 'fixed', value: 0, direction: [1, 0, 0], regions: [region(0, face(m, 0))]},
  {type: 'force', value: 100, direction: [0, 0, 1], regions: [region(0, face(m, 40))]}
];
const steel = {youngModulus: 1e9, poissonRatio: 0};
// Same 10x10x40 mm reference block the worker pipeline tests use; only mesh size / physics differ.
export const CASES = {
  'structural-tiny': {physics: 'structural', size: 8, build: () => base({kind: 'structural'}, steel, structural)},
  'structural-coarse': {physics: 'structural', size: 5, build: () => base({kind: 'structural'}, steel, structural)},
  'structural-medium': {physics: 'structural', size: 3, build: () => base({kind: 'structural'}, steel, structural)},
  'structural-fine': {physics: 'structural', size: 2, build: () => base({kind: 'structural'}, steel, structural)},
  'structural-xfine': {physics: 'structural', size: 1.2, build: () => base({kind: 'structural'}, steel, structural)},
  'thermal-steady': {physics: 'thermal', size: 3, build: () => base({kind: 'thermal'}, {conductivity: 2}, m => [
    {type: 'temperature', value: 100, direction: [1, 0, 0], regions: [region(0, face(m, 0))]},
    {type: 'temperature', value: 20, direction: [1, 0, 0], regions: [region(0, face(m, 40))]}])},
  'acoustic-harmonic': {physics: 'acoustic', size: 3, build: () => base({kind: 'acoustic', frequency: 4000, soundSpeed: 343, airDensity: 1.2, lossFactor: 0, receiverPoint: [5, 5, 20]}, null,
    m => [{type: 'acousticPressure', value: 1, direction: [1, 0, 0], regions: [region(0, face(m, 0))]}])}
};

const median = a => { const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const r3 = v => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;

// Runs one analysis and splits the wall time using host-side event timestamps. Phase boundaries are
// approximations of what the worker reports: they include message passing and structured clone.
async function runOnce(project, size) {
  const {analyzeProject} = await import('./headless-analysis.mjs');
  const marks = {};
  const t0 = performance.now();
  const at = name => { marks[name] ??= performance.now() - t0; };
  const result = await analyzeProject(project, {size}, 'elastic', {observe: true, onEvent: e => {
    if (e.stage === 'preparation') at('prepared');
    else if (e.stage === 'progress' && /mesh/i.test(e.message ?? '')) at('meshStart');
    else if (e.stage === 'mesh') at('meshDone');
    else if (e.stage === 'progress' && /^(Solving|Assembling)/i.test(e.message ?? '')) at('solveStart');
  }});
  const total = performance.now() - t0;
  const meshDone = marks.meshDone ?? null, solveStart = marks.solveStart ?? meshDone;
  const solverMs = result.result?.performance?.solveMs ?? null;
  const solvePhase = solveStart === null ? null : total - solveStart;
  return {
    totalMs: total,
    workerStartMs: marks.meshStart ?? marks.prepared ?? null,
    meshMs: marks.meshStart !== undefined && meshDone !== null ? meshDone - marks.meshStart : null,
    boundaryTransferMs: meshDone !== null && solveStart !== null ? solveStart - meshDone : null,
    solvePhaseMs: solvePhase,
    solverKernelMs: solverMs,
    postProcessingMs: solvePhase !== null && solverMs !== null ? Math.max(0, solvePhase - solverMs) : null,
    mesh: {nodes: result.mesh?.summary?.nodeCount ?? (result.mesh?.nodes ? result.mesh.nodes.length / 3 : null), elements: result.mesh?.summary?.elementCount ?? result.mesh?.tetrahedra?.length ?? null},
    resultKind: result.result?.kind ?? null
  };
}

// Cancellation: abort via the AbortSignal analyzeProject accepts (the Node counterpart of the Worker client's cancel).
// Latency = abort() call to promise settlement; settlement happens only after worker.terminate() resolved.
export const CANCEL_DEFAULT_CASES = ['structural-medium', 'thermal-steady'];
export const CANCEL_STATES = ['cancelled', 'completed-before-cancel', 'error'];
const CANCEL_EXIT_TIMEOUT_MS = 240000;
async function cancelOnce(project, size, trigger, delayMs) {
  const {analyzeProject} = await import('./headless-analysis.mjs');
  const controller = new AbortController();
  let abortedAt = null, firedAfterMs = null;
  const t0 = performance.now();
  const abort = () => { if (abortedAt === null) { abortedAt = performance.now(); firedAfterMs = abortedAt - t0; controller.abort(); } };
  const timer = trigger === 'half-warm-total' ? setTimeout(abort, delayMs) : null;
  let state, message = null;
  try {
    await analyzeProject(project, {size}, 'elastic', {observe: true, signal: controller.signal, onEvent: () => { if (trigger === 'first-event') abort(); }});
    state = 'completed-before-cancel';
  } catch (e) { message = e?.message ?? String(e); state = /Calculation cancelled/.test(message) ? 'cancelled' : 'error'; }
  const settledAt = performance.now();
  clearTimeout(timer);
  return {trigger, state, requestedAfterMs: firedAfterMs, latencyMs: abortedAt === null ? null : settledAt - abortedAt, totalMs: settledAt - t0, ...(state === 'error' ? {error: message} : {})};
}
async function cancelChildMain(id, repeats) {
  const c = CASES[id];
  await runOnce(c.build(), c.size); // warm-up so baseline and cancel runs are warm
  const base = [];
  for (let i = 0; i < repeats; i++) base.push((await runOnce(c.build(), c.size)).totalMs);
  const baselineMs = median(base), runs = [];
  for (const trigger of ['first-event', 'half-warm-total']) for (let i = 0; i < repeats; i++) runs.push(await cancelOnce(c.build(), c.size, trigger, baselineMs / 2));
  const usage = process.resourceUsage();
  process.stdout.write('\nPERF_CANCEL ' + JSON.stringify({baselineWarmTotalMs: baselineMs, runs, maxRssKiB: usage.maxRSS}) + '\n');
  // No process.exit: a clean natural exit is itself the release check (the parent enforces a timeout).
}
function summarizeCancel(runs, trigger) {
  const rs = runs.filter(r => r.trigger === trigger), lat = rs.map(r => r.latencyMs).filter(Number.isFinite);
  const states = {};
  for (const r of rs) states[r.state] = (states[r.state] ?? 0) + 1;
  return {n: rs.length, states, latencyMs: lat.length ? {median: r3(median(lat)), min: r3(Math.min(...lat)), max: r3(Math.max(...lat)), n: lat.length} : null,
    requestedAfterMs: rs.length && rs.every(r => Number.isFinite(r.requestedAfterMs)) ? r3(median(rs.map(r => r.requestedAfterMs))) : null};
}
function measureCancel(id, repeats) {
  const started = performance.now();
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child-cancel', id, '--repeats', String(repeats)], {cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, timeout: CANCEL_EXIT_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe']});
  const timedOut = child.error?.code === 'ETIMEDOUT';
  const line = (child.stdout ?? '').split('\n').find(l => l.startsWith('PERF_CANCEL '));
  const base = {note: 'Node-side only: AbortSignal on analyzeProject (worker_threads); browser cancel response is NOT measured', exitTimeoutMs: CANCEL_EXIT_TIMEOUT_MS};
  if (!line) return {...base, status: 'failed', processReleased: false, error: (timedOut ? 'child did not exit within timeout' : (child.stderr ?? '').trim().split('\n').slice(-3).join(' | ')) || 'no result'};
  const data = JSON.parse(line.slice('PERF_CANCEL '.length));
  return {...base, status: 'ok', repeats, baselineWarmTotalMs: r3(data.baselineWarmTotalMs),
    triggers: {'first-event': summarizeCancel(data.runs, 'first-event'), 'half-warm-total': {...summarizeCancel(data.runs, 'half-warm-total'), note: 'abort requested at 50% of the median warm total time measured earlier in this child'}},
    runs: data.runs.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? r3(v) : v]))),
    processReleased: child.status === 0 && !timedOut, childExitCode: child.status, childWallMs: r3(performance.now() - started),
    peakRssMiB: r3(data.maxRssKiB / 1024), peakRssNote: 'ru_maxrss of the dedicated cancel child process'};
}

// Child mode: one process per case so ru_maxrss is that case's peak. Prints one JSON line on stdout.
async function childMain(id, repeats) {
  const c = CASES[id];
  const runs = [];
  for (let i = 0; i < 1 + repeats; i++) runs.push({phase: i === 0 ? 'cold' : 'warm', ...await runOnce(c.build(), c.size)});
  const usage = process.resourceUsage();
  process.stdout.write('\nPERF_RESULT ' + JSON.stringify({runs, maxRssKiB: usage.maxRSS, finalRssBytes: process.memoryUsage().rss}) + '\n');
}

function gitInfo() {
  const git = args => { try { return execFileSync('git', args, {cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch { return null; } };
  const status = git(['status', '--porcelain']);
  return {revision: git(['rev-parse', 'HEAD']), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), dirty: status === null ? null : status.length > 0};
}

const FIELDS = ['totalMs', 'workerStartMs', 'meshMs', 'boundaryTransferMs', 'solvePhaseMs', 'solverKernelMs', 'postProcessingMs'];
function summarize(runs) {
  const out = {};
  for (const f of FIELDS) {
    const v = runs.map(r => r[f]).filter(Number.isFinite);
    out[f] = v.length ? {median: r3(median(v)), min: r3(Math.min(...v)), max: r3(Math.max(...v)), n: v.length} : null;
  }
  return out;
}

export async function measure({cases = Object.keys(CASES), repeats = 3, cancel = 'default'} = {}) {
  const results = [];
  for (const id of cases) {
    const c = CASES[id];
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child', id, '--repeats', String(repeats)], {cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 240000, stdio: ['ignore', 'pipe', 'pipe']});
    const line = (child.stdout ?? '').split('\n').find(l => l.startsWith('PERF_RESULT '));
    if (child.status !== 0 || !line) {
      results.push({id, physics: c.physics, meshSize: c.size, status: 'failed', error: (child.error?.message ?? (child.stderr ?? '').trim().split('\n').slice(-3).join(' | ')) || 'no result'});
      continue;
    }
    const data = JSON.parse(line.slice('PERF_RESULT '.length));
    const doCancel = cancel === 'all' || (cancel === 'default' && CANCEL_DEFAULT_CASES.includes(id));
    const rounded = data.runs.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? r3(v) : v])));
    const cold = rounded[0], warm = rounded.slice(1);
    results.push({
      id, physics: c.physics, meshSize: c.size, status: 'ok', mesh: cold.mesh, resultKind: cold.resultKind, repeats,
      cold, warm: {runs: warm, summary: summarize(warm)},
      peakRssMiB: r3(data.maxRssKiB / 1024),
      peakRssNote: 'process-wide ru_maxrss of a dedicated child process for this case (includes Node, worker thread and WASM memory)',
      ...(doCancel ? {cancel: measureCancel(id, repeats)} : {})
    });
  }
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    scope: REPORT_SCOPE,
    generatedAt: new Date().toISOString(),
    notes: [
      'Measurements, not support limits or guarantees.',
      'cold = first run in a fresh Node process; warm = later runs in the same process (each still spawns a new Worker).',
      'cancel block (only for cancel-measured cases): Node-side AbortSignal cancellation; browser memory, time and cancel response are NOT measured.',
      'solverKernelMs is reported by the solver; postProcessingMs = solve phase minus solverKernelMs (includes result assembly and message cloning).'
    ],
    environment: {node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, osRelease: os.release(), cpuModel: os.cpus()[0]?.model ?? null, cpuCount: os.cpus().length, totalMemMiB: Math.round(os.totalmem() / 1048576)},
    git: gitInfo(),
    repeats,
    cases: results
  };
}

function parseArgs(argv) {
  const o = {out: '.qa/perf-report.json', repeats: 3, cases: 'all', child: null, childCancel: null, cancel: 'default', list: false};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--repeats') o.repeats = Number(argv[++i]);
    else if (a === '--cases') o.cases = argv[++i];
    else if (a === '--child') o.child = argv[++i];
    else if (a === '--child-cancel') o.childCancel = argv[++i];
    else if (a === '--cancel') o.cancel = 'all';
    else if (a === '--no-cancel') o.cancel = 'none';
    else if (a === '--list') o.list = true;
    else throw Error('Unknown argument: ' + a);
  }
  if (!Number.isInteger(o.repeats) || o.repeats < 1 || o.repeats > 20) throw Error('--repeats must be an integer from 1 to 20');
  if (!o.out) throw Error('--out requires a path');
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.list) console.log(Object.keys(CASES).join('\n'));
    else if (o.childCancel) {
      if (!CASES[o.childCancel]) throw Error('Unknown case: ' + o.childCancel);
      await cancelChildMain(o.childCancel, o.repeats);
    } else if (o.child) {
      if (!CASES[o.child]) throw Error('Unknown case: ' + o.child);
      await childMain(o.child, o.repeats);
    } else {
      const ids = o.cases === 'all' ? Object.keys(CASES) : o.cases.split(',');
      for (const id of ids) if (!CASES[id]) throw Error('Unknown case: ' + id);
      const report = await measure({cases: ids, repeats: o.repeats, cancel: o.cancel});
      const out = path.resolve(o.out);
      mkdirSync(path.dirname(out), {recursive: true});
      writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
      for (const c of report.cases) console.log(c.id.padEnd(20), c.status === 'ok' ? `nodes ${c.mesh.nodes} elems ${c.mesh.elements} cold ${c.cold.totalMs} ms warm median ${c.warm.summary.totalMs?.median} ms peakRSS ${c.peakRssMiB} MiB` + (c.cancel ? ` | cancel ${c.cancel.status === 'ok' ? Object.entries(c.cancel.triggers).map(([t, v]) => `${t} ${v.latencyMs?.median} ms [${Object.keys(v.states)}]`).join('; ') + ' released=' + c.cancel.processReleased : 'FAILED ' + c.cancel.error}` : '') : 'FAILED ' + c.error);
      console.log('report:', out);
      if (report.cases.some(c => c.status !== 'ok' || (c.cancel && c.cancel.status !== 'ok'))) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
