// Replay real Chrome and formal stdio MCP QA for work order 51 (VIEWCOMPARE).
// Prerequisite: dedicated branded Chrome with --remote-debugging-port=9333 and the Studio dev server.
// Usage: QA_ORIGIN=http://127.0.0.1:5174 node scripts/qa-review-51-chrome.mjs
// Output: .qa/review51/{export-summary.json,artifact.gif}; decode with scripts/qa-review-51-decode.py.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {closePage, openCdp} from './qa-cdp-client.mjs';
import {createStdioClient} from './perf-browser.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5174';
const out = path.resolve(ROOT, process.env.QA_OUT || '.qa/review51');
const casesPath = path.resolve(ROOT, process.env.QA_CASES || 'docs/evidence/review51-real-archives/cases.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const zeroRevision = `sha256:${'0'.repeat(64)}`;
const cdpVersion = await fetch(`http://127.0.0.1:${process.env.CDP_PORT || '9333'}/json/version`).then((response) => response.json());
mkdirSync(out, {recursive: true});

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
  const archiveBase64 = readFileSync(casesPath).toString('base64');
  await cdp.evaluate(`window.__qaArchive=JSON.parse(atob(${JSON.stringify(archiveBase64)})); true`);
  const initial = await cdp.evaluate('window.caseOperations.list()');
  const imported = await cdp.evaluate(`window.caseOperations.importArchive({archive:window.__qaArchive,expectedArchiveRevision:${JSON.stringify(initial.archiveRevision)}})`);
  const cases = imported.cases;
  const viewed = await cdp.evaluate(`window.caseOperations.view({caseId:${JSON.stringify(cases[0].caseId)},expectedRevision:${JSON.stringify(cases[0].revision)}})`);
  await sleep(1000);
  const camera = {position: [61, 41, 84], target: [5, 5, 20], up: [0, 1, 0], fov: 40};
  const compareArchive = {
    version: 1,
    kind: 'comparison-view',
    sources: cases.map((entry) => ({revision: entry.revision})),
    settings: {field: 'instantPressure', deformScale: 1, camera, timeSeconds: 0},
  };
  const currentCompare = await cdp.evaluate('window.comparisonViewApi.get()');
  const applied = await cdp.evaluate(`window.comparisonViewApi.set({archive:${JSON.stringify(compareArchive)},expectedRevision:${JSON.stringify(currentCompare.revision)}})`);
  await sleep(800);
  await cdp.evaluate(`(()=>{
    const details=document.querySelector('#agent-connection details'); if(details)details.open=true;
    document.querySelector('#agent-endpoint').value=${JSON.stringify(client.info.endpoint)};
    document.querySelector('#agent-token').value=${JSON.stringify(token)};
    const view=document.querySelector('[data-agent-scope="view"]'); if(view)view.checked=true;
    for(const scope of ['edit','analyze']){const input=document.querySelector('[data-agent-scope="'+scope+'"]'); if(input)input.checked=false;}
    document.querySelector('#agent-connect').click();
    return true;
  })()`);
  let session = null;
  for (let attempt = 0; attempt < 40 && !session; attempt++) {
    const {sessions = []} = await client.call('studio_browser_sessions', {});
    session = sessions[0] || null;
    if (!session) await sleep(500);
  }
  if (!session) throw new Error('No paired browser session');
  const call = (method, args = {}) => client.call('studio_browser_call', {sessionId: session.sessionId, method, args});
  const snapshot = async (label) => {
    const resultView = await call('getResultView', {}).catch((error) => ({unavailable: true, code: error.code, message: String(error.message)}));
    return {
      label,
      inputRevision: await cdp.evaluate('window.studioApi.getRevision()'),
      cases: await cdp.evaluate('window.caseOperations.list()'),
      caseList: await call('caseList', {}),
      compareView: await call('getCompareView', {}),
      compareApi: await cdp.evaluate('window.comparisonViewApi.get()'),
      resultView,
    };
  };
  const baseRequest = {
    requestId: `review51-${Date.now().toString(36)}`,
    references: cases.map((entry) => ({caseId: entry.caseId, expectedRevision: entry.revision})),
    field: 'instantPressure',
    format: 'gif',
    animation: 'time',
    seconds: 2,
    startTimeSeconds: 0,
    endTimeSeconds: 0.0012,
    deformScale: 1,
    camera,
  };
  const baseline = await snapshot('after-set');
  const attempts = [];
  const refusal = async (name, args) => {
    try {
      const result = await call('startCompareExport', args);
      return {name, refused: false, result};
    } catch (error) {
      return {name, refused: true, code: error.code, message: String(error.message)};
    }
  };
  attempts.push(await refusal('stale-case-revision', {
    ...baseRequest,
    requestId: `${baseRequest.requestId}-stale`,
    references: [{...baseRequest.references[0], expectedRevision: zeroRevision}, baseRequest.references[1]],
  }));
  attempts.push(await refusal('single-time', {...baseRequest, requestId: `${baseRequest.requestId}-single`, startTimeSeconds: 0.0006, endTimeSeconds: 0.0006}));
  attempts.push(await refusal('reversed-range', {...baseRequest, requestId: `${baseRequest.requestId}-reversed`, startTimeSeconds: 0.0012, endTimeSeconds: 0}));
  attempts.push(await refusal('outside-range', {...baseRequest, requestId: `${baseRequest.requestId}-outside`, endTimeSeconds: 0.002}));
  try {
    const staleView = await call('setCompareView', {archive: applied.archive, expectedRevision: zeroRevision});
    attempts.push({name: 'stale-comparison-view-revision', refused: false, result: staleView});
  } catch (error) {
    attempts.push({name: 'stale-comparison-view-revision', refused: true, code: error.code, message: String(error.message)});
  }
  const afterRefusals = await snapshot('after-refusals');

  const started = await call('startCompareExport', baseRequest);
  let status = started;
  for (let attempt = 0; attempt < 240; attempt++) {
    status = await call('exportStatus', {jobId: started.jobId});
    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(status.state)) break;
    await sleep(500);
  }
  if (status.state !== 'completed') throw new Error(`GIF export did not succeed: ${JSON.stringify(status)}`);
  const chunks = [];
  let offset = 0;
  for (let pageIndex = 0; pageIndex < 2000; pageIndex++) {
    const chunk = await call('exportArtifact', {jobId: started.jobId, offset, length: 65536});
    chunks.push(Buffer.from(chunk.data, 'base64'));
    if (chunk.nextOffset === null || chunk.nextOffset === undefined) break;
    offset = chunk.nextOffset;
  }
  const gif = Buffer.concat(chunks);
  writeFileSync(path.join(out, 'artifact.gif'), gif);
  const afterSuccess = await snapshot('after-success');

  const cancelRequest = {
    ...baseRequest,
    requestId: `${baseRequest.requestId}-cancel`,
    seconds: 15,
  };
  const cancelJob = await call('startCompareExport', cancelRequest);
  await sleep(80);
  const cancelResponse = await call('cancelExport', {jobId: cancelJob.jobId});
  let cancelStatus = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    cancelStatus = await call('exportStatus', {jobId: cancelJob.jobId});
    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(cancelStatus.state)) break;
    await sleep(250);
  }
  let cancelArtifact;
  try {
    cancelArtifact = await call('exportArtifact', {jobId: cancelJob.jobId, offset: 0, length: 65536});
  } catch (error) {
    cancelArtifact = {rejected: true, code: error.code, message: String(error.message)};
  }
  const afterCancel = await snapshot('after-cancel');

  const compareState = (baselineState, current) => ({
    inputRevision: baselineState.inputRevision === current.inputRevision,
    caseArchiveRevision: baselineState.cases.archiveRevision === current.cases.archiveRevision,
    caseIds: JSON.stringify(baselineState.cases.cases.map((entry) => [entry.caseId, entry.revision])) === JSON.stringify(current.cases.cases.map((entry) => [entry.caseId, entry.revision])),
    caseList: JSON.stringify(baselineState.caseList) === JSON.stringify(current.caseList),
    compareRevision: baselineState.compareView.revision === current.compareView.revision,
    compareArchive: JSON.stringify(baselineState.compareView.archive) === JSON.stringify(current.compareView.archive),
    compareApiRevision: baselineState.compareApi.revision === current.compareApi.revision,
    compareApiArchive: JSON.stringify(baselineState.compareApi.archive) === JSON.stringify(current.compareApi.archive),
    comparisonCamera: JSON.stringify(baselineState.compareView.archive?.settings?.camera) === JSON.stringify(current.compareView.archive?.settings?.camera),
    resultRevision: baselineState.resultView.resultRevision === current.resultView.resultRevision,
    resultCamera: JSON.stringify(baselineState.resultView.state?.camera) === JSON.stringify(current.resultView.state?.camera),
  });
  const summary = {
    schemaVersion: 1,
    date: new Date().toISOString().slice(0, 10),
    workOrder: 51,
    taskId: 'VIEWCOMPARE',
    parentTaskReleased: false,
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
    command: 'QA_ORIGIN=... node scripts/qa-review-51-chrome.mjs; python scripts/qa-review-51-decode.py .qa/review51/artifact.gif .qa/review51/export-summary.json',
    origin,
    browser: await cdp.evaluate('navigator.userAgent'),
    browserVersion: await cdp.evaluate('navigator.userAgent.match(/Chrome\\/[\\d.]+/)?.[0] ?? null'),
    browserProduct: cdpVersion.Browser,
    debugPort: Number(process.env.CDP_PORT || 9333),
    sessionScopes: session.scopes,
    cases: cases.map((entry, index) => ({caseId: entry.caseId, revision: entry.revision, name: entry.name, viewed: index === 0 ? viewed.displayed === true : undefined})),
    comparison: {requested: compareArchive, applied, before: baseline.compareView},
    baseline,
    attempts,
    afterRefusals,
    success: {
      request: baseRequest,
      jobId: started.jobId,
      state: status.state,
      bytes: gif.length,
      sha256: sha256(gif),
      artifact: status.artifact ?? null,
      manifest: status.artifact?.manifest ?? null,
    },
    afterSuccess,
    cancel: {request: cancelRequest, jobId: cancelJob.jobId, response: cancelResponse, terminal: cancelStatus, artifact: cancelArtifact},
    afterCancel,
    unchanged: {
      refusals: compareState(baseline, afterRefusals),
      success: compareState(baseline, afterSuccess),
      cancel: compareState(baseline, afterCancel),
    },
  };
  writeFileSync(path.join(out, 'export-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    success: {state: status.state, bytes: gif.length, sha256: sha256(gif), frames: status.artifact?.manifest?.gifAnimation?.frames ?? status.artifact?.manifest?.comparison?.gifAnimation?.frames, resolution: status.artifact?.manifest?.resolution},
    attempts: attempts.map(({name, refused, code, message}) => ({name, refused, code, message})),
    cancel: {terminal: cancelStatus?.state, artifact: cancelArtifact},
    unchanged: summary.unchanged,
  }, null, 2));
  await call('releaseExport', {jobId: started.jobId}).catch(() => {});
  await call('releaseExport', {jobId: cancelJob.jobId}).catch(() => {});
} finally {
  cdp.close();
  await closePage(page.id).catch(() => {});
  await client.close();
}
