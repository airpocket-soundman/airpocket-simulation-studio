// Replay real branded-Chrome performance/memory QA for work order 48 (PERF1).
// Prerequisite: dedicated Chrome with --remote-debugging-port=9333 and the Studio dev server.
// Usage: QA_ORIGIN=http://127.0.0.1:5174 node scripts/qa-review-48-chrome.mjs
// Then merge with:
//   node scripts/perf-browser.mjs --merge-memory .qa/perf-probe.json --out .qa/perf-followup48.json
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {closePage, openCdp} from './qa-cdp-client.mjs';
import {createStdioClient, waitForSession, runBrowserPerf, PROBE_SNIPPET} from './perf-browser.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5174';
const out = path.resolve(ROOT, process.env.QA_OUT || '.qa');
const casesPath = path.resolve(ROOT, process.env.QA_CASES || 'docs/evidence/review50-real-archives/cases.json');
const perfCases = (process.env.QA_PERF_CASES || 'structural-tiny').split(',');
if (!perfCases.length || new Set(perfCases).size !== perfCases.length || perfCases.some(id => !['structural-tiny','structural-medium'].includes(id))) throw Error('QA_PERF_CASES supports distinct bounded structural-tiny/structural-medium cases only');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(out, {recursive: true});

const sourceCases = JSON.parse(readFileSync(casesPath, 'utf8'));
const input = structuredClone(sourceCases.cases[0].output.input);
input.name = 'Synthetic structural 100N nu0';
input.materialProperties = {youngModulus: 1e9, poissonRatio: 0};
let token = null;
const client = await createStdioClient({
  origin,
  announce: ({endpoint, origin: announcedOrigin, pairingToken}) => {
    token = pairingToken;
    console.log(`MCP endpoint ${endpoint} for ${announcedOrigin}`);
  },
});
const {page, cdp} = await openCdp('about:blank');
try {
  await cdp.setViewport(1280, 900);
  await cdp.navigate(`${origin}/?lang=en`);
  await sleep(2500);
  const projectBase64 = Buffer.from(JSON.stringify(input)).toString('base64');
  await cdp.evaluate(`window.__qaProject=JSON.parse(atob(${JSON.stringify(projectBase64)})); true`);
  const loaded = await cdp.evaluate('window.studioApi.loadProject(window.__qaProject)');
  const project = await cdp.evaluate('window.studioApi.exportProject()');
  const mesh = project.meshes?.[0];
  const zOf = (condition) => condition.regions.flatMap((region) => region.triangles.flatMap((triangle) => [0, 1, 2].map((vertex) => mesh.positions[triangle * 9 + vertex * 3 + 2])));
  const fixed = project.conditions.find((condition) => condition.type === 'fixed');
  const force = project.conditions.find((condition) => condition.type === 'force');
  const inputChecks = {
    source: JSON.stringify(project.sourceModel.bounds) === JSON.stringify([0, 0, 0, 10, 10, 40]),
    material: project.materialProperties.youngModulus === 1e9 && project.materialProperties.poissonRatio === 0,
    structural: project.study.kind === 'structural' && project.study.gravityEnabled === false,
    fixedZ0: Boolean(fixed) && fixed.value === 0 && zOf(fixed).every((z) => z === 0),
    forceZ40: Boolean(force) && force.value === 100 && force.direction[2] === 1 && zOf(force).every((z) => z === 40),
  };
  if (!Object.values(inputChecks).every(Boolean)) throw new Error(`Input checks failed: ${JSON.stringify(inputChecks)}`);
  await cdp.evaluate(`(()=>{
    const details=document.querySelector('#agent-connection details'); if(details)details.open=true;
    document.querySelector('#agent-endpoint').value=${JSON.stringify(client.info.endpoint)};
    document.querySelector('#agent-token').value=${JSON.stringify(token)};
    for(const scope of ['inspect','analyze']){const input=document.querySelector('[data-agent-scope="'+scope+'"]'); if(input)input.checked=true;}
    for(const scope of ['view','edit']){const input=document.querySelector('[data-agent-scope="'+scope+'"]'); if(input)input.checked=false;}
    document.querySelector('#agent-connect').click();
    return true;
  })()`);
  const session = await waitForSession(client, {timeoutMs: 120000, pollMs: 500});
  await cdp.evaluate(PROBE_SNIPPET);
  const installedAt = await cdp.evaluate('Date.now()');
  let probeBefore = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    probeBefore = JSON.parse(await cdp.evaluate('window.__perfProbe.report()'));
    if (probeBefore.samples.length >= 3) break;
    await sleep(500);
  }
  const cdpVersion = await fetch(`http://127.0.0.1:${process.env.CDP_PORT || '9333'}/json/version`).then((response) => response.json());
  const report = await runBrowserPerf({
    client,
    sessionId: session.sessionId,
    cases: perfCases,
    repeats: 1,
    pollMs: 50,
    timeoutMs: 300000,
    log: (record) => console.log(`perf ${record.id} ${record.status} cold=${record.cold?.totalMs}ms warm=${record.warm?.summary?.totalMs?.median}ms`),
  });
  report.browserProduct = cdpVersion.Browser;
  report.debugPort = Number(process.env.CDP_PORT || 9333);
  const settleTarget = Math.max(
    ...report.cases.map((entry) => entry.window.endEpochMs),
    ...report.cases.map((entry) => entry.window.cancelSettledEpochMs ?? 0),
  ) + 5000;
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = JSON.parse(await cdp.evaluate('window.__perfProbe.report()'));
    if ((current.samples.at(-1)?.t ?? 0) >= settleTarget) break;
    await sleep(1000);
  }
  const probe = JSON.parse(await cdp.evaluate('window.__perfProbe.report()'));
  await cdp.evaluate('window.__perfProbe.stop()');
  writeFileSync(path.join(out, 'perf-probe.json'), JSON.stringify(probe, null, 2) + '\n');
  writeFileSync(path.join(out, 'perf-followup48.raw.json'), JSON.stringify(report, null, 2) + '\n');
  // The merge-memory CLI reads and rewrites --out; initialize it while keeping raw immutable.
  writeFileSync(path.join(out, 'perf-followup48.json'), JSON.stringify(report, null, 2) + '\n');
  const summary = {
    schemaVersion: 1,
    date: new Date().toISOString().slice(0, 10),
    workOrder: 48,
    taskId: 'PERF1',
    parentTaskReleased: false,
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
    origin,
    browser: report.browser,
    browserProduct: cdpVersion.Browser,
    debugPort: Number(process.env.CDP_PORT || 9333),
    sessionScopes: session.scopes,
    inputChecks,
    input: {
      name: project.name,
      sourceModel: project.sourceModel,
      materialProperties: project.materialProperties,
      study: {kind: project.study.kind, gravityEnabled: project.study.gravityEnabled},
      conditions: project.conditions.map((condition) => ({type: condition.type, value: condition.value, direction: condition.direction})),
      meshCount: project.meshes.length,
      requestedMeshSize: report.cases.length === 1 ? report.cases[0].meshSize : null,
      requestedMeshSizes: report.cases.map(entry => ({caseId: entry.id, sizeMm: entry.meshSize})),
    },
    probe: {
      installedAt,
      intervalMs: probe.intervalMs,
      crossOriginIsolated: probe.crossOriginIsolated,
      sampleCount: probe.samples.length,
      beforeSamples: probeBefore.samples.length,
      userAgent: probe.userAgent,
      firstSampleAt: probe.samples[0]?.t ?? null,
      lastSampleAt: probe.samples.at(-1)?.t ?? null,
    },
    report,
    cleanup: {pageClosed: null, mcpClosed: null, probeStopped: true, note: 'Written before finally; closure is attempted but not independently observed.'},
  };
  writeFileSync(path.join(out, 'qa-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({
    inputChecks,
    status: report.cases.map((entry) => ({id: entry.id, status: entry.status, coldMs: entry.cold?.totalMs, warmMedianMs: entry.warm?.summary?.totalMs?.median, recovered: entry.cancel?.recoveredAfterCancel, meshObservation: entry.cold?.meshObservation})),
    probeSamples: probe.samples.length,
    loaded: loaded.loaded,
  }, null, 2));
} finally {
  cdp.close();
  await closePage(page.id).catch(() => {});
  await client.close();
}
