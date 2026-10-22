// Merge and verify the real-Chrome comparison GIF evidence for work order 51.
// Exits non-zero when a required check fails; missing values stay explicit.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const summary = JSON.parse(readFileSync(path.join(ROOT, '.qa/review51/export-summary.json'), 'utf8'));
const decoded = JSON.parse(readFileSync(path.join(ROOT, '.qa/review51/decode.json'), 'utf8'));
const archive = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/review51-real-archives/cases.json'), 'utf8'));
const [first, second] = archive.cases;
const firstResult = first.output.result;
const secondResult = second.output.result;
const manifest = summary.success.artifact.manifest;
const comparison = manifest.comparison;
const time = manifest.time;
const gifAnimation = comparison.gifAnimation;
const storedValues = archive.cases.flatMap((entry) => entry.output.result.snapshots
  .filter((frame) => frame.time >= time.requestedRangeSeconds.start && frame.time <= time.requestedRangeSeconds.end)
  .flatMap((frame) => frame.pressure));
const storedMinimum = Math.min(...storedValues);
const storedMaximum = Math.max(...storedValues);
const delayTotalMs = decoded.checks.totalDurationMs;
const nearest = (times, value) => times.reduce((best, current, index) => Math.abs(current - value) < Math.abs(times[best] - value) ? index : best, 0);
const sameCamera = (a, b) => Boolean(a && b && ['position', 'target', 'up'].every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key])) && a.fov === b.fov);
const phaseSamples = [0, 12, 23].map((index) => {
  const phase = index / 23;
  const timeSeconds = phase === 1 ? time.requestedRangeSeconds.end : time.requestedRangeSeconds.start + (time.requestedRangeSeconds.end - time.requestedRangeSeconds.start) * phase;
  return {
    frame: index,
    phase,
    requestedTimeSeconds: timeSeconds,
    panelFrames: archive.cases.map((entry) => {
      const frames = entry.output.result.snapshots;
      const frameIndex = nearest(frames.map((frame) => frame.time), timeSeconds);
      return {frameIndex, timeSeconds: frames[frameIndex].time, offsetSeconds: frames[frameIndex].time - timeSeconds};
    }),
  };
});
const checks = {
  sourceTreeUnchanged: summary.sourceSha === '070ec8f885f0e15c889cacaed3c151292c1cc506',
  brandedChrome: String(summary.browserProduct).startsWith('Chrome/155.') && String(summary.browser).includes('Chrome/155.'),
  formalStdioPairing: summary.sessionScopes.join(',') === 'inspect,view',
  twoAcousticCases: archive.cases.length === 2 && summary.cases.length === 2,
  caseRevisions: JSON.stringify(comparison.cases.map((entry) => entry.revision)) === JSON.stringify(summary.cases.map((entry) => entry.revision)),
  studyValues: archive.cases.every((entry) => entry.output.input.study.soundSpeed === 343
    && entry.output.input.study.airDensity === 1.2
    && entry.output.input.study.frequency === 4000
    && entry.output.input.study.pulseWidth === 0.0001
    && entry.output.input.study.acousticDuration === 0.0012),
  sourceAmplitudes: first.output.input.conditions[0].value === 1 && second.output.input.conditions[0].value === 2,
  amplitudeRatio: Math.abs(secondResult.maxPressurePa / firstResult.maxPressurePa - 2) < 1e-12
    && Math.abs(secondResult.receiverPeakPa / firstResult.receiverPeakPa - 2) < 1e-12,
  storedSnapshots: firstResult.snapshots.length === 24 && secondResult.snapshots.length === 24
    && firstResult.snapshots[0].time === 0 && firstResult.snapshots.at(-1).time === 0.0012
    && secondResult.snapshots[0].time === 0 && secondResult.snapshots.at(-1).time === 0.0012,
  comparisonField: comparison.field === 'instantPressure' && manifest.comparison.unit === 'Pa',
  commonColorRange: comparison.colorRange.minimum === storedMinimum && comparison.colorRange.maximum === storedMaximum
    && storedMinimum === -3.4066020347578125 && storedMaximum === 3.532363432716448,
  gifManifest: gifAnimation.frames === 24 && gifAnimation.width === 640 && gifAnimation.height === 320
    && gifAnimation.loop === 0 && gifAnimation.palette === 'RGB332' && gifAnimation.colors === 256
    && gifAnimation.phasePolicy === 'i/23',
  timeManifest: time.animation === 'time' && time.durationSeconds === 2 && time.timeBasis === 'display time'
    && time.recording === 'fixed-frame' && time.realtime === false && time.frameCount === 24
    && time.frameCountGuaranteed === true && time.phasePolicy === 'i/23' && time.camera === 'fixed'
    && time.frameSelection === 'nearest-stored-frames-only' && time.loop === 'infinite'
    && time.requestedRangeSeconds.start === 0 && time.requestedRangeSeconds.end === 0.0012,
  comparisonTimeManifest: comparison.timeAnimation.interpolated === false
    && comparison.timeAnimation.camera === 'fixed'
    && comparison.timeAnimation.timeSelection === 'nearest-stored-frames-only'
    && comparison.timeAnimation.startTimeSeconds === 0
    && comparison.timeAnimation.endTimeSeconds === 0.0012
    && comparison.timeAnimation.initial && comparison.timeAnimation.initial.panels.every((panel) => panel.frameIndex === 0 && panel.timeSeconds === 0 && panel.offsetSeconds === 0)
    && comparison.timeAnimation.final && comparison.timeAnimation.final.panels.every((panel) => panel.frameIndex === 23 && panel.timeSeconds === 0.0012 && panel.offsetSeconds === 0)
    && comparison.timeAnimation.selectedFrameCounts.every((count) => count === 24),
  gifBytes: decoded.bytes === summary.success.bytes && decoded.bytes === manifest.totalBytes,
  gifSha: decoded.sha256 === summary.success.sha256 && decoded.sha256 === manifest.sha256.replace(/^sha256:/, ''),
  decodedFrames: decoded.checks.frameCount === true && decoded.checks.allFrames640x320 === true
    && decoded.checks.allFramesDifferFromPrevious === true && decoded.checks.loop === true,
  gifDelays: decoded.checks.delaysMatchManifest === true && decoded.checks.delayCentiseconds.every((delay) => delay === 8 || delay === 9)
    && delayTotalMs === 2000 && time.delayCentiseconds.reduce((sum, value) => sum + value, 0) === 200,
  phaseEndpoints: comparison.timeAnimation.initial.panels.every((panel) => panel.timeSeconds === 0)
    && comparison.timeAnimation.final.panels.every((panel) => panel.timeSeconds === 0.0012)
    && decoded.checks.frameCount === true,
  panelPixels: decoded.checks['frame0PanelHashes'].panelsDiffer && decoded.checks['frame12PanelHashes'].panelsDiffer
    && decoded.checks['frame23PanelHashes'].panelsDiffer
    && decoded.checks['pixelDiffFrame0To12'].changedPixels > 0 && decoded.checks['pixelDiffFrame0To23'].changedPixels > 0,
  cameraFixed: sameCamera(manifest.view.camera, summary.success.request.camera)
    && comparison.timeAnimation.camera === 'fixed'
    && sameCamera(summary.baseline.compareView.archive.settings.camera, summary.success.request.camera),
  refusals: summary.attempts.every((attempt) => attempt.refused === true)
    && summary.attempts.some((attempt) => attempt.name === 'stale-case-revision' && attempt.code === 'CASE_REVISION_CONFLICT')
    && summary.attempts.some((attempt) => attempt.name === 'single-time')
    && summary.attempts.some((attempt) => attempt.name === 'reversed-range')
    && summary.attempts.some((attempt) => attempt.name === 'outside-range')
    && summary.attempts.some((attempt) => attempt.name === 'stale-comparison-view-revision'),
  successStateRestored: Object.values(summary.unchanged.success).every(Boolean),
  refusalStateRestored: Object.values(summary.unchanged.refusals).every(Boolean),
  cancelStateRestored: Object.values(summary.unchanged.cancel).every(Boolean),
  cancelledWithoutArtifact: summary.cancel.terminal.state === 'cancelled' && summary.cancel.artifact.rejected === true,
};
const passed = Object.values(checks).every(Boolean);
const evidence = {
  schemaVersion: 1,
  date: '2026-10-22',
  taskId: 'VIEWCOMPARE',
  workOrder: 51,
  status: passed ? 'passed' : 'failed',
  parentTaskReleased: false,
  note: 'This record closes only the requested real-Chrome comparison GIF follow-up; the parent VIEWCOMPARE task remains unreleased.',
  sourceSha: summary.sourceSha,
  environment: {
    browser: summary.browser,
    browserProduct: summary.browserProduct,
    browserVersion: summary.browserVersion,
    debugPort: summary.debugPort,
    origin: summary.origin,
    pairing: 'formal stdio MCP with inspect+view only',
  },
  commands: [
    'node scripts/qa-review-51-chrome.mjs',
    'python scripts/qa-review-51-decode.py .qa/review51/artifact.gif .qa/review51/export-summary.json',
    'node scripts/qa-review-51-evidence.mjs',
  ],
  cases: summary.cases.map((entry, index) => ({
    ...entry,
    study: archive.cases[index].output.input.study,
    sourceAmplitudePa: archive.cases[index].output.input.conditions[0].value,
    storedSnapshotCount: archive.cases[index].output.result.snapshots.length,
    maxPressurePa: archive.cases[index].output.result.maxPressurePa,
    receiverPeakPa: archive.cases[index].output.result.receiverPeakPa,
    mesh: {nodeCount: archive.cases[index].output.mesh.nodes.length / 3, size: archive.cases[index].output.mesh.size},
  })),
  comparison: {
    field: comparison.field,
    unit: comparison.unit,
    colorRange: comparison.colorRange,
    gifAnimation,
    timeAnimation: comparison.timeAnimation,
    camera: manifest.view.camera,
    requestedCamera: summary.success.request.camera,
  },
  artifact: {
    mimeType: manifest.mimeType,
    bytes: manifest.totalBytes,
    sha256: manifest.sha256,
    resolution: manifest.resolution,
    durationSeconds: time.durationSeconds,
    timeBasis: time.timeBasis,
    realtime: time.realtime,
    requestedRangeSeconds: time.requestedRangeSeconds,
    frameSelection: time.frameSelection,
    loop: time.loop,
    delaysCentiseconds: time.delayCentiseconds,
    delayTotalMs,
  },
  decode: {
    format: decoded.format,
    width: decoded.width,
    height: decoded.height,
    frameCount: decoded.frameCount,
    loop: decoded.loop,
    frames: decoded.frames.map(({index, durationMs, width, height, pixelSha256}) => ({index, durationMs, width, height, pixelSha256})),
    checks: decoded.checks,
  },
  phaseSamples,
  refusals: summary.attempts,
  cancellation: {state: summary.cancel.terminal.state, artifact: summary.cancel.artifact},
  restoration: summary.unchanged,
  checks,
  limitations: [
    'The saved case stores 24 of the 25 requested snapshots because of the snapshot budget warning; the GIF uses those 24 stored frames and synthesizes no additional frame.',
    'The manifest itemizes panel times at the first and last frame; intermediate panel times are not separately exported, while the 24 frame hashes differ and the i/23 nearest-only policy is recorded. The implementation tests cover each intermediate phase.',
    'The GIF is lossy RGB332. Pixel comparisons are qualitative; pressure values and the common range come from the saved fields and the manifest.',
    'The parent VIEWCOMPARE status in src/progress.json was not changed.',
  ],
};
writeFileSync(path.join(ROOT, 'docs/evidence/2026-10-22-review51-real-chrome.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({status: evidence.status, checks, artifact: {bytes: evidence.artifact.bytes, sha256: evidence.artifact.sha256, frames: evidence.decode.frameCount, totalMs: delayTotalMs}, phaseSamples}, null, 2));
if (!passed) process.exitCode = 1;
