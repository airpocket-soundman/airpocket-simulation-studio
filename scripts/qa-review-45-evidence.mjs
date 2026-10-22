// Verify the real branded-Chrome hidden-tab evidence for work order 45.
// Exits non-zero when a required check fails. The stop-timeout run is clearly fault injection.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const summary = JSON.parse(readFileSync(path.join(ROOT, '.qa/review45/qa-summary.json'), 'utf8'));
const find = (kind) => summary.runs.find((run) => run.kind === kind);
const hidden = find('hidden-mid-recording');
const hiddenStart = find('hidden-at-start');
const cancel = find('explicit-cancel');
const success = find('foreground-success');
const timeout = find('stop-timeout-fault-injection');
const video = readFileSync(path.join(ROOT, '.qa/review45', success.artifact.file));
const ended = (run) => (run.after.streams ?? []).flat().every((track) => track.readyState === 'ended');
const inactive = (run) => (run.after.recorders ?? []).every((recorder) => recorder.state === 'inactive');
const checks = {
  sourceFrozen: summary.sourceSha === '070ec8f885f0e15c889cacaed3c151292c1cc506',
  brandedChrome: summary.browserProduct === 'Chrome/155.0.8059.86',
  ownedOrigin: summary.origin === 'http://127.0.0.1:5199',
  scopes: summary.sessionScopes.includes('inspect') && summary.sessionScopes.includes('view'),
  realVisibility: hidden.before.visibility === 'visible' && hidden.before.hidden === false
    && hidden.hiddenAt.visibility === 'hidden' && hidden.hiddenAt.hidden === true
    && hidden.after.visibilityEvents.some((event) => event.state === 'hidden' && event.hidden === true)
    && hidden.after.visibilityEvents.some((event) => event.state === 'visible' && event.hidden === false)
    && summary.realVisibilityMethod.includes('Page.bringToFront'),
  hiddenStopped: hidden.error.startsWith('Video creation stopped because this page moved to the background')
    && hidden.settleMs <= 5000
    && hidden.hiddenAt.recorders.every((state) => state === 'inactive')
    && hidden.hiddenAt.streams.flat().every((state) => state === 'ended')
    && inactive(hidden) && ended(hidden),
  hiddenNoArtifact: hidden.after.downloadHidden === true && hidden.after.previewHidden === true
    && hidden.after.startDisabled === false && hidden.after.cancelDisabled === true,
  hiddenStateRestored: Object.values(hidden.unchanged).every(Boolean),
  backgroundAtStart: hiddenStart.error.startsWith('Video creation stopped because this page moved to the background')
    && hiddenStart.startedAt.visibility === 'hidden' && hiddenStart.startedAt.hidden === true
    && hiddenStart.settleMs <= 5000 && hiddenStart.after.downloadHidden === true
    && hiddenStart.after.startDisabled === false && (hiddenStart.after.recorders ?? []).length === 0
    && (hiddenStart.after.streams ?? []).length === 0,
  explicitCancel: cancel.error === 'Video creation cancelled.' && cancel.settleMs <= 5000
    && inactive(cancel) && ended(cancel) && cancel.after.downloadHidden === true
    && cancel.after.previewHidden === true && cancel.after.startDisabled === false
    && Object.values(cancel.unchanged).every(Boolean),
  stopDeadline: timeout.error.startsWith('Video creation stopped because recording did not finish')
    && timeout.settleMs <= 5000 && inactive(timeout) && ended(timeout)
    && timeout.after.downloadHidden === true && timeout.after.startDisabled === false,
  foregroundSuccess: success.settled.status.startsWith('Video ready')
    && success.settled.downloadHidden === false && success.settled.previewHidden === false
    && inactive(success) && ended(success) && Object.values(success.unchanged).every(Boolean),
  artifact: video.length === success.artifact.bytes && video.length > 0
    && video[0] === 0x1a && video[1] === 0x45 && video[2] === 0xdf && video[3] === 0xa3
    && /^video\/webm/.test(success.artifact.mime)
    && createHash('sha256').update(video).digest('hex') === success.artifact.sha256,
};
const passed = Object.values(checks).every(Boolean);
const evidence = {
  schemaVersion: 1,
  date: '2026-10-22',
  taskId: 'EXPORTBACKGROUND1',
  workOrder: 45,
  status: passed ? 'passed' : 'failed',
  parentTaskReleased: false,
  note: 'Only the real hidden-tab termination/cleanup QA requested by follow-up 45 is claimed. The parent EXPORTBACKGROUND1 status is unchanged.',
  sourceSha: summary.sourceSha,
  environment: {
    browserProduct: summary.browserProduct,
    origin: summary.origin,
    scopes: summary.sessionScopes,
    engine: 'real branded Chrome via CDP and formal stdio MCP',
    visibilityMethod: summary.realVisibilityMethod,
  },
  cases: summary.cases,
  commands: [
    '$env:QA_ORIGIN="http://127.0.0.1:5199"; node scripts/qa-review-45-chrome.mjs',
    'node scripts/qa-review-45-evidence.mjs',
  ],
  runs: summary.runs.map((run) => ({
    kind: run.kind,
    settleMs: run.settleMs ?? null,
    error: run.error ?? null,
    before: run.before ?? run.startedAt ?? null,
    started: run.started ?? null,
    hiddenAt: run.hiddenAt ?? null,
    after: run.after ?? null,
    unchanged: run.unchanged ?? null,
    artifact: run.artifact ?? null,
  })),
  timingNote: 'hidden-mid-recording settleMs starts at the post-switch hiddenAt snapshot, not the visibility event. Event-to-settled is separately derived below.',
  hiddenEventToSettledMs: hidden.settled.t - hidden.after.visibilityEvents.find((event) => event.state === 'hidden').t,
  artifact: {
    file: `docs/evidence/review45-real-chrome/${success.artifact.file}`,
    bytes: success.artifact.bytes,
    sha256: success.artifact.sha256,
    mime: success.artifact.mime,
    note: 'Synthetic foreground success sample from the two exported synthetic acoustic cases; not user data.',
  },
  cleanup: {pageClosed: null, mcpClosed: null, note: 'Historical closure flags were written before finally; actual closure was not independently verified.'},
  checks,
  limitations: [
    'Page and MCP closure were attempted after the summary was written, but not independently verified; cleanup is not an acceptance assertion.',
    'The hidden state was created by CDP Page.bringToFront selecting another real tab. The page observed its own document.visibilityState/visibilitychange; no DOM event was dispatched by the test.',
    'This verifies the installed Chrome 155 on Windows. It does not claim Electron, Firefox, Safari or mobile behaviour.',
    'The stop-timeout run is a controlled fault injection that drops onstop; it is not a hidden-tab result.',
    'An explicit recording session-expiry path was not exercised. Full input/cases/compare/result restoration was checked for hidden interruption; foreground success checked input/cases/compare/result, while explicit cancel checked input/compare. Hidden-at-start and stop-timeout checked UI/resource recovery only.',
    'The foreground WebM is a short synthetic sample; this is not a claim of visual fidelity or production encoding quality.',
    'The parent EXPORTBACKGROUND1 status in src/progress.json is unchanged and no release/merge action is part of this record.',
  ],
};
writeFileSync(path.join(ROOT, 'docs/evidence/2026-10-22-review45-real-chrome.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({status: evidence.status, checks, timings: {hiddenMs: hidden.settleMs, hiddenAtStartMs: hiddenStart.settleMs, cancelMs: cancel.settleMs, successMs: success.settleMs, stopDeadlineMs: timeout.settleMs}, artifact: evidence.artifact, hidden: {before: hidden.before.visibility, at: hidden.hiddenAt.visibility, events: hidden.after.visibilityEvents, error: hidden.error}}, null, 2));
if (!passed) process.exitCode = 1;
