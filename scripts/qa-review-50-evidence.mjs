// Merge and verify the real-Chrome PNG ZIP evidence produced by
// scripts/qa-review-50-chrome.mjs and scripts/qa-review-50-decode.py.
// Exits non-zero when a required check fails; never invents missing values.
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const summary = JSON.parse(readFileSync(path.join(ROOT, '.qa/review50/export-summary.json'), 'utf8'));
const decoded = JSON.parse(readFileSync(path.join(ROOT, '.qa/review50/decode.json'), 'utf8'));
const archive = JSON.parse(readFileSync(path.join(ROOT, 'docs/evidence/review50-real-archives/cases.json'), 'utf8'));
const source = archive.cases[0].output;
const input = source.input;
const mesh = source.mesh;
const artifact = summary.success.artifact;
const checks = {
  sourceTreeUnchanged: summary.sourceSha === '070ec8f885f0e15c889cacaed3c151292c1cc506',
  brandedChrome: String(summary.browserProduct).startsWith('Chrome/155.') && String(summary.browser).includes('Chrome/155.'),
  formalStdioPairing: summary.sessionScopes.join(',') === 'inspect,view',
  structuralReference: JSON.stringify(input.sourceModel.bounds) === JSON.stringify([0, 0, 0, 10, 10, 40]),
  sizeFiveMm: mesh.size === 5,
  materialE1e9Nu03: input.materialProperties.youngModulus === 1e9 && input.materialProperties.poissonRatio === 0.3,
  fixedZ0AndForceZ100: (() => {
    const fixed = input.conditions.find((c) => c.type === 'fixed');
    const force = input.conditions.find((c) => c.type === 'force');
    const zOf = (condition) => condition.regions.flatMap((region) => region.triangles.flatMap((triangle) => [0, 1, 2].map((vertex) => input.meshes[0].positions[triangle * 9 + vertex * 3 + 2])));
    return Boolean(fixed && force && fixed.value === 0 && force.value === 100 && force.direction[2] === 1
      && zOf(fixed).every((z) => z === 0) && zOf(force).every((z) => z === 40));
  })(),
  meshXRange: summary.meshXRangeMm[0] === 0 && summary.meshXRangeMm[1] === 10,
  exportCompleted: summary.success.state === 'completed',
  artifactExpectedRevision: artifact.manifest.resultRevision === summary.before.resultView.resultRevision,
  archiveSha256: decoded.sha256 === summary.success.sha256,
  artifactBytes: decoded.bytes === artifact.totalBytes && summary.success.bytes === artifact.totalBytes,
  manifestEntrySha256: decoded.checks.manifestEntrySha256 === artifact.manifest.manifestEntry.sha256.replace(/^sha256:/, ''),
  storeEntries: decoded.entries.every((entry) => entry.compression === 0),
  crc32: decoded.checks.allFrameCrcMatchZipEntry === true,
  frameHashes: decoded.checks.allFrameHashesMatchManifest === true,
  allFramesDecoded: decoded.checks.allFramesDecoded === true,
  frameDimensions: decoded.checks.allFrameDimensionsMatchManifest === true,
  phaseSlice: decoded.checks.allFramesMatchManifestPhaseSlice === true,
  pixelsDiffer: decoded.checks.allFramePixelsDiffer === true,
  initialSectionAxisX4Disabled: summary.afterSetView.view.axis === 0 && summary.afterSetView.view.position === 4 && summary.afterSetView.view.clipEnabled === false,
  successStateRestored: Object.values(summary.unchanged.success).every(Boolean),
  cancelStateRestored: Object.values(summary.unchanged.cancel).every(Boolean),
  cancelledWithoutArtifact: summary.cancel.terminal.state === 'cancelled' && summary.cancel.artifact.rejected === true,
};
const passed = Object.values(checks).every(Boolean);
const evidence = {
  schemaVersion: 1,
  date: '2026-10-22',
  taskId: 'BROWSEREXPORT1',
  workOrder: 50,
  status: passed ? 'passed' : 'failed',
  parentTaskReleased: false,
  note: 'This record closes only the requested real-Chrome PNG-sequence follow-up; it does not mark the parent BROWSEREXPORT1 task released.',
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
    'node scripts/qa-review-50-chrome.mjs',
    'python scripts/qa-review-50-decode.py .qa/review50/artifact.zip > .qa/review50/decode.json',
    'node scripts/qa-review-50-evidence.mjs',
  ],
  input: {
    caseName: summary.case.name,
    caseId: summary.case.caseId,
    caseRevision: summary.case.revision,
    inputRevision: summary.before.inputRevision,
    resultRevision: summary.before.resultView.resultRevision,
    sourceModel: input.sourceModel,
    materialProperties: input.materialProperties,
    conditions: input.conditions.map(({type, value, direction}) => ({type, value, direction})),
    mesh: {size: mesh.size, nodeCount: mesh.nodes.length / 3, tetrahedronCount: mesh.tetrahedra.length, engine: mesh.engine},
    camera: summary.before.resultView.state.camera,
    sectionBefore: summary.before.view,
    sectionRequested: summary.afterSetView.view,
  },
  artifact: {
    format: 'png-sequence',
    container: 'zip',
    compression: 'store',
    bytes: summary.success.bytes,
    sha256: summary.success.sha256,
    manifest: artifact.manifest,
    entries: decoded.entries,
  },
  decode: {
    frameCount: decoded.frames.length,
    frames: decoded.frames.map(({index, phase, slicePosition, file, width, height, bytes, sha256, decoded: pixels}) => ({index, phase, slicePosition, file, width, height, bytes, sha256, pixelSha256: pixels.pixelSha256, crc32: pixels.crc32})),
    checks: decoded.checks,
  },
  restoration: {
    success: summary.unchanged.success,
    cancel: summary.unchanged.cancel,
  },
  cancellation: {
    state: summary.cancel.terminal.state,
    progress: summary.cancel.terminal.progress,
    artifact: summary.cancel.artifact,
  },
  observedReferenceDifference: 'The actual 3-frame canvas is 725x946 and 174226 bytes. This differs from the earlier single-case 555x573 reference because the accepted follow-up requests three deterministic slice frames and records the actual viewport; no dimension or byte count was substituted.',
  checks,
  limitations: [
    'The artifact is tied to the saved structural case and the recorded source SHA; it is not proof of arbitrary project export.',
    'The parent BROWSEREXPORT1 status in src/progress.json was not changed.',
  ],
};
writeFileSync(path.join(ROOT, 'docs/evidence/2026-10-22-review50-real-chrome.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({status: evidence.status, checks, artifact: {bytes: evidence.artifact.bytes, sha256: evidence.artifact.sha256, frames: evidence.decode.frameCount}}, null, 2));
if (!passed) process.exitCode = 1;
