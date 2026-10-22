// Replay real Chrome and formal stdio MCP QA for work order 50 (BROWSEREXPORT1).
// Prerequisite: launch a dedicated branded Chrome with --remote-debugging-port=9333,
// start the Studio dev server, and keep the source tree unchanged during the run.
// Usage: QA_ORIGIN=http://127.0.0.1:5174 node scripts/qa-review-50-chrome.mjs
// Output: .qa/review50/{export-summary.json,artifact.zip}; decode with scripts/qa-review-50-decode.py.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {closePage, openCdp} from './qa-cdp-client.mjs';
import {createStdioClient} from './perf-browser.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:5174';
const out = path.resolve(ROOT, process.env.QA_OUT || '.qa/review50');
const casesPath = path.resolve(ROOT, process.env.QA_CASES || 'docs/evidence/review50-real-archives/cases.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
  const ref = imported.cases[0];
  const viewed = await cdp.evaluate(`window.caseOperations.view({caseId:${JSON.stringify(ref.caseId)},expectedRevision:${JSON.stringify(ref.revision)}})`);
  await sleep(1200);
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
  const snapshot = async (label) => ({
    label,
    inputRevision: await cdp.evaluate('window.studioApi.getRevision()'),
    cases: await cdp.evaluate('window.caseOperations.list()'),
    caseList: await call('caseList', {}),
    resultView: await call('getResultView', {}),
    compareView: await call('getCompareView', {}),
    view: await call('getView', {}),
  });

  const before = await snapshot('before');
  const setViewResult = await call('setView', {clipEnabled: false, axis: 0, position: 4});
  const afterSetView = await snapshot('after-set-view');
  const requestId = `review50-${Date.now().toString(36)}`;
  const started = await call('startExport', {
    requestId,
    expectedResultRevision: before.resultView.resultRevision,
    format: 'png-sequence',
    animation: 'slice',
    frames: 3,
  });
  let status = started;
  for (let attempt = 0; attempt < 120; attempt++) {
    status = await call('exportStatus', {jobId: started.jobId});
    if (['completed', 'succeeded', 'failed', 'cancelled', 'timed_out'].includes(status.state)) break;
    await sleep(500);
  }
  if (status.state !== 'completed' && status.state !== 'succeeded') throw new Error(`Export did not succeed: ${JSON.stringify(status)}`);
  const chunks = [];
  let offset = 0;
  for (let pageIndex = 0; pageIndex < 1000; pageIndex++) {
    const chunk = await call('exportArtifact', {jobId: started.jobId, offset, length: 65536});
    chunks.push(Buffer.from(chunk.data, 'base64'));
    if (chunk.nextOffset === null || chunk.nextOffset === undefined) break;
    offset = chunk.nextOffset;
  }
  const zip = Buffer.concat(chunks);
  writeFileSync(path.join(out, 'artifact.zip'), zip);
  const after = await snapshot('after-success');

  const cancelRequestId = `review50-cancel-${Date.now().toString(36)}`;
  const cancelJob = await call('startExport', {
    requestId: cancelRequestId,
    expectedResultRevision: after.resultView.resultRevision,
    format: 'png-sequence',
    animation: 'slice',
    frames: 120,
  });
  await sleep(80);
  const cancelResponse = await call('cancelExport', {jobId: cancelJob.jobId});
  let cancelStatus = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    cancelStatus = await call('exportStatus', {jobId: cancelJob.jobId});
    if (['completed', 'succeeded', 'failed', 'cancelled', 'timed_out'].includes(cancelStatus.state)) break;
    await sleep(250);
  }
  let cancelArtifact;
  try {
    cancelArtifact = await call('exportArtifact', {jobId: cancelJob.jobId, offset: 0, length: 65536});
  } catch (error) {
    cancelArtifact = {rejected: true, message: String(error.message)};
  }
  const afterCancel = await snapshot('after-cancel');

  const archive = JSON.parse(readFileSync(casesPath, 'utf8'));
  const positions = archive.cases[0].output.mesh.nodes;
  let xMin = Infinity;
  let xMax = -Infinity;
  for (let index = 0; index < positions.length; index += 3) {
    xMin = Math.min(xMin, positions[index]);
    xMax = Math.max(xMax, positions[index]);
  }
  const compareState = (baseline, current) => ({
    inputRevision: baseline.inputRevision === current.inputRevision,
    caseArchiveRevision: baseline.cases.archiveRevision === current.cases.archiveRevision,
    caseIds: JSON.stringify(baseline.cases.cases.map((entry) => [entry.caseId, entry.revision])) === JSON.stringify(current.cases.cases.map((entry) => [entry.caseId, entry.revision])),
    resultRevision: baseline.resultView.resultRevision === current.resultView.resultRevision,
    resultCamera: JSON.stringify(baseline.resultView.state.camera) === JSON.stringify(current.resultView.state.camera),
    compareRevision: baseline.compareView.revision === current.compareView.revision,
    compareArchive: JSON.stringify(baseline.compareView.archive) === JSON.stringify(current.compareView.archive),
    view: JSON.stringify(baseline.view) === JSON.stringify(current.view),
  });
  const summary = {
    schemaVersion: 1,
    date: new Date().toISOString().slice(0, 10),
    workOrder: 50,
    taskId: 'BROWSEREXPORT1',
    sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
    command: 'QA_ORIGIN=... node scripts/qa-review-50-chrome.mjs; python scripts/qa-review-50-decode.py .qa/review50/artifact.zip',
    origin,
    browser: await cdp.evaluate('navigator.userAgent'),
    browserVersion: await cdp.evaluate('navigator.userAgent.match(/Chrome\\/[\\d.]+/)?.[0] ?? null'),
    browserProduct: cdpVersion.Browser,
    debugPort: Number(process.env.CDP_PORT || 9333),
    sessionScopes: session.scopes,
    case: {caseId: ref.caseId, revision: ref.revision, name: ref.name, viewed: viewed.displayed === true},
    meshXRangeMm: [xMin, xMax],
    before,
    setViewResult,
    afterSetView,
    success: {
      requestId,
      jobId: started.jobId,
      state: status.state,
      bytes: zip.length,
      sha256: sha256(zip),
      artifact: status.artifact ?? null,
    },
    after,
    cancel: {requestId: cancelRequestId, jobId: cancelJob.jobId, cancelResponse, terminal: cancelStatus, artifact: cancelArtifact},
    afterCancel,
    unchanged: {success: compareState(afterSetView, after), cancel: compareState(afterSetView, afterCancel)},
  };
  writeFileSync(path.join(out, 'export-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    success: {state: status.state, bytes: zip.length, sha256: sha256(zip), frames: status.artifact?.manifest?.frameCount, resolution: status.artifact?.manifest?.resolution},
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
