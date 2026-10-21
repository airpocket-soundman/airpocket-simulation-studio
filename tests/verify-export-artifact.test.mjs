import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm, open} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import zlib from 'node:zlib';
import {createVisualExportJobs} from '../src/visual-export-jobs.js';
import {createGifEncoder} from '../src/gif-encoder.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const CLI = join(ROOT, 'scripts', 'verify-export-artifact.mjs');
const revision = 'sha256:' + 'a'.repeat(64);
const sha256Of = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {encoding: 'utf8', timeout: 180000});
  if (result.error) throw result.error;
  return result;
}
function reportOf(result) {
  return JSON.parse(result.stdout.trim());
}

const crcTable = (() => {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'latin1'), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}
// Real, standards-conformant tiny PNG (zlib-compressed IDAT), not a header-only stub.
function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const offset = row + 1 + x * 4;
      raw[offset] = (x * 80) & 255; raw[offset + 1] = (y * 120) & 255; raw[offset + 2] = 128; raw[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
// Real 640x320 GIF via the existing application encoder (src/gif-encoder.js).
async function makeGif(width, height, frames = 24) {
  const encoder = createGifEncoder({width, height, frames});
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { rgba[i * 4] = i & 255; rgba[i * 4 + 1] = (i >> 3) & 255; rgba[i * 4 + 2] = (i >> 6) & 255; rgba[i * 4 + 3] = 255; }
  for (let frame = 0; frame < frames; frame++) await encoder.addFrame(rgba, 4);
  return Buffer.from(await encoder.finish().arrayBuffer());
}

async function terminal(api, job) {
  const deadline = Date.now() + 30000;
  for (;;) {
    const state = api.status({jobId: job.jobId});
    if (state.state !== 'running') return state;
    if (Date.now() > deadline) throw Error('export did not finish in time');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
// Manifests come from the real schemaVersion-1 producers; only the artifact bytes are fixtures.
async function pngManifest(bytes) {
  const api = createVisualExportJobs({render: () => new Blob([bytes], {type: 'image/png'})});
  const job = await api.start({requestId: 'verify-png', expectedResultRevision: revision, format: 'png', view: {result: {field: 'temperature'}}});
  const state = await terminal(api, job);
  assert.equal(state.state, 'completed', state.error);
  return state.artifact.manifest;
}
async function gifManifest(bytes) {
  const snapshot = {
    comparison: {
      cases: [{caseId: 'a', revision, resultRevision: revision, label: 'A'}, {caseId: 'b', revision: 'sha256:' + 'b'.repeat(64), resultRevision: revision, label: 'B'}],
      field: 'temperature', requestedTimeSeconds: 0,
      panels: [{caseId: 'a', time: {timeSeconds: 0, offsetSeconds: 0, frameIndex: 0, timeApplies: true}}, {caseId: 'b', time: {timeSeconds: 0, offsetSeconds: 0, frameIndex: 0, timeApplies: true}}],
      colorRange: {minimum: 0, maximum: 1}, unit: '1',
    },
    view: {resolution: {width: 640, height: 320}, sourceResolution: {width: 1280, height: 640}, deformScale: 1, camera: {position: [5, 5, 5], target: [0, 0, 0], up: [0, 1, 0], fov: 40}},
    context: {},
  };
  const api = createVisualExportJobs({render: () => {}, prepareCompare: async () => snapshot, renderCompare: () => new Blob([bytes], {type: 'image/gif'})});
  const job = await api.startCompare({requestId: 'verify-gif', references: [{caseId: 'a', expectedRevision: revision}, {caseId: 'b', expectedRevision: 'sha256:' + 'b'.repeat(64)}], field: 'temperature', timeSeconds: 0, format: 'gif', seconds: 1});
  const state = await terminal(api, job);
  assert.equal(state.state, 'completed', state.error);
  return state.artifact.manifest;
}
async function writeFixture(dir, name, bytes) {
  const path = join(dir, name);
  await writeFile(path, bytes);
  return path;
}
let tempRoots = [];
async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), 'verify-export-artifact-'));
  tempRoots.push(dir);
  return dir;
}
test.after(async () => {
  for (const dir of tempRoots) await rm(dir, {recursive: true, force: true});
  tempRoots = [];
});

test('valid PNG and GIF read back identity and header while frame count stays unverified', async () => {
  const dir = await workspace();
  const png = makePng(2, 2);
  const pngMeta = await pngManifest(png);
  const pngManifestPath = await writeFixture(dir, 'png.manifest.json', Buffer.from(JSON.stringify(pngMeta)));
  const pngArtifactPath = await writeFixture(dir, 'png.artifact', png);
  const pngRun = runCli(['--manifest', pngManifestPath, '--artifact', pngArtifactPath]);
  assert.equal(pngRun.status, 0, pngRun.stderr);
  const pngReport = reportOf(pngRun);
  assert.equal(pngReport.status, 'verified');
  assert.equal(pngReport.identityVerified, true);
  assert.equal(pngReport.containerHeaderVerified, true);
  assert.equal(pngReport.structureVerified, true);
  assert.equal(pngReport.frameCountVerified, false);
  assert.deepEqual(pngReport.structure, {format: 'png', chunkCount: 3, idatChunkCount: 1, crcVerified: true, iendAtEnd: true});
  assert.equal(pngReport.format, 'png');
  assert.equal(pngReport.container, 'png');
  assert.equal(pngReport.mimeType, 'image/png');
  assert.equal(pngReport.artifactBytes, png.length);
  assert.equal(pngReport.manifestTotalBytes, png.length);
  assert.match(pngReport.sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(pngReport.sha256, 'sha256:' + createHash('sha256').update(png).digest('hex'));
  assert.deepEqual({width: pngReport.width, height: pngReport.height}, {width: 2, height: 2});

  const gif = await makeGif(640, 320);
  const gifMeta = await gifManifest(gif);
  // The real GIF producer writes frameCount 24; this CLI never proves it from the header.
  assert.equal(gifMeta.time.frameCount, 24);
  const gifManifestPath = await writeFixture(dir, 'gif.manifest.json', Buffer.from(JSON.stringify(gifMeta)));
  const gifArtifactPath = await writeFixture(dir, 'gif.artifact', gif);
  const gifRun = runCli(['--manifest', gifManifestPath, '--artifact', gifArtifactPath]);
  assert.equal(gifRun.status, 0, gifRun.stderr);
  const gifReport = reportOf(gifRun);
  assert.equal(gifReport.status, 'verified');
  assert.equal(gifReport.format, 'gif');
  assert.equal(gifReport.container, 'gif');
  assert.equal(gifReport.mimeType, 'image/gif');
  assert.equal(gifReport.identityVerified, true);
  assert.equal(gifReport.containerHeaderVerified, true);
  assert.equal(gifReport.structureVerified, true);
  assert.equal(gifReport.frameCountVerified, false);
  assert.equal(gifReport.header.brand.startsWith('GIF8'), true);
  assert.deepEqual({width: gifReport.width, height: gifReport.height}, {width: 640, height: 320});
  // Structural image descriptors, not drawable or decoded frames.
  assert.deepEqual(gifReport.structure, {format: 'gif', imageDescriptorCount: 24, extensionCount: 25, subBlockCount: gifReport.structure.subBlockCount, globalColorTableBytes: 768, localColorTableCount: 0, trailerAtEnd: true});
  assert.equal(gifReport.structure.subBlockCount > 24, true);
});

test('one-byte change, truncation, SHA change and a width offset are each rejected', async () => {
  const dir = await workspace();
  const png = makePng(2, 2);
  const manifest = await pngManifest(png);
  const manifestPath = await writeFixture(dir, 'manifest.json', Buffer.from(JSON.stringify(manifest)));
  const artifactPath = await writeFixture(dir, 'artifact.png', png);

  const modified = Buffer.from(png);
  modified[modified.length - 1] ^= 0xff;
  const modifiedPath = await writeFixture(dir, 'modified.png', modified);
  let run = runCli(['--manifest', manifestPath, '--artifact', modifiedPath]);
  assert.notEqual(run.status, 0);
  let report = reportOf(run);
  assert.equal(report.status, 'mismatch');
  assert.equal(report.identityVerified, false);

  const truncated = png.subarray(0, png.length - 1);
  const truncatedPath = await writeFixture(dir, 'truncated.png', truncated);
  run = runCli(['--manifest', manifestPath, '--artifact', truncatedPath]);
  assert.notEqual(run.status, 0);
  report = reportOf(run);
  assert.equal(report.status, 'mismatch');
  assert.equal(report.identityVerified, false);

  const badShaPath = await writeFixture(dir, 'bad-sha.json', Buffer.from(JSON.stringify({...manifest, sha256: 'sha256:' + '0'.repeat(64)})));
  run = runCli(['--manifest', badShaPath, '--artifact', artifactPath]);
  assert.notEqual(run.status, 0);
  report = reportOf(run);
  assert.equal(report.status, 'mismatch');
  assert.equal(report.identityVerified, false);

  const wrongWidthPath = await writeFixture(dir, 'wrong-width.json', Buffer.from(JSON.stringify({...manifest, resolution: {width: manifest.resolution.width + 1, height: manifest.resolution.height}})));
  run = runCli(['--manifest', wrongWidthPath, '--artifact', artifactPath]);
  assert.notEqual(run.status, 0);
  report = reportOf(run);
  assert.equal(report.status, 'mismatch');
  assert.equal(report.identityVerified, true);
  assert.equal(report.containerHeaderVerified, false);
});

test('empty, invalid, oversized and unsupported inputs are refused', async () => {
  const dir = await workspace();
  const png = makePng(2, 2);
  const manifest = await pngManifest(png);
  const manifestPath = await writeFixture(dir, 'manifest.json', Buffer.from(JSON.stringify(manifest)));
  const artifactPath = await writeFixture(dir, 'artifact.png', png);

  let run = runCli(['--manifest', manifestPath, '--artifact', await writeFixture(dir, 'empty.bin', Buffer.alloc(0))]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'invalid');

  run = runCli(['--manifest', await writeFixture(dir, 'broken.json', Buffer.from('{ not json')), '--artifact', artifactPath]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'invalid');

  run = runCli(['--manifest', await writeFixture(dir, 'arbitrary.json', Buffer.from(JSON.stringify({hello: 'world'}))), '--artifact', artifactPath]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'invalid');

  const oversizedManifest = Buffer.from(JSON.stringify({...manifest, padding: 'x'.repeat(70000)}));
  assert.equal(oversizedManifest.length > 64 * 1024, true);
  run = runCli(['--manifest', await writeFixture(dir, 'oversized.json', oversizedManifest), '--artifact', artifactPath]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'invalid');

  const hugePath = join(dir, 'huge.bin');
  const handle = await open(hugePath, 'w');
  await handle.truncate(100 * 1024 * 1024 + 1);
  await handle.close();
  run = runCli(['--manifest', manifestPath, '--artifact', hugePath]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'invalid');

  const tinyArtifact = await writeFixture(dir, 'tiny.bin', Buffer.from([1, 2, 3, 4]));
  const webmPath = await writeFixture(dir, 'webm.json', Buffer.from(JSON.stringify({schemaVersion: 1, format: 'webm', container: 'webm', mimeType: 'video/webm;codecs=vp9', sha256: 'sha256:' + 'a'.repeat(64), totalBytes: 4})));
  run = runCli(['--manifest', webmPath, '--artifact', tinyArtifact]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'unsupported');

  const zipPath = await writeFixture(dir, 'sequence.json', Buffer.from(JSON.stringify({schemaVersion: 1, format: 'png-sequence', container: 'zip', mimeType: 'application/zip', sha256: 'sha256:' + 'a'.repeat(64), totalBytes: 4, resolution: {width: 2, height: 2}})));
  run = runCli(['--manifest', zipPath, '--artifact', tinyArtifact]);
  assert.notEqual(run.status, 0);
  assert.equal(reportOf(run).status, 'unsupported');
});

test('report goes only to a new path and never modifies inputs or an existing report', async () => {
  const dir = await workspace();
  const png = makePng(2, 2);
  const manifest = await pngManifest(png);
  const manifestPath = await writeFixture(dir, 'manifest.json', Buffer.from(JSON.stringify(manifest)));
  const artifactPath = await writeFixture(dir, 'artifact.png', png);
  const beforeManifest = await readFile(manifestPath), beforeArtifact = await readFile(artifactPath);

  const reportPath = join(dir, 'report.json');
  let run = runCli(['--manifest', manifestPath, '--artifact', artifactPath, '--report', reportPath]);
  assert.equal(run.status, 0, run.stderr);
  const written = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.deepEqual(written, reportOf(run));
  assert.equal(written.status, 'verified');
  assert.equal(written.frameCountVerified, false);
  assert.match(written.sha256, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual({width: written.width, height: written.height}, {width: 2, height: 2});
  assert.equal(written.artifactBytes, png.length);

  const existingPath = await writeFixture(dir, 'existing.json', Buffer.from('KEEP'));
  run = runCli(['--manifest', manifestPath, '--artifact', artifactPath, '--report', existingPath]);
  assert.notEqual(run.status, 0);
  assert.equal(await readFile(existingPath, 'utf8'), 'KEEP');

  run = runCli(['--manifest', manifestPath, '--artifact', artifactPath, '--report', artifactPath]);
  assert.notEqual(run.status, 0);
  run = runCli(['--manifest', manifestPath, '--artifact', artifactPath, '--report', manifestPath]);
  assert.notEqual(run.status, 0);

  assert.deepEqual(await readFile(manifestPath), beforeManifest);
  assert.deepEqual(await readFile(artifactPath), beforeArtifact);
});

// Each malformed artifact keeps a manifest from the real schemaVersion-1
// producer (the same resolution/format contract) but with totalBytes and
// sha256 recomputed over the malformed bytes. The rejection therefore comes
// from the structure walk, not from identity.
function withRecomputedIdentity(manifest, bytes) {
  return {...manifest, sha256: sha256Of(bytes), totalBytes: bytes.length};
}
async function assertStructureRejected(dir, name, bytes, baseManifest) {
  const manifest = withRecomputedIdentity(baseManifest, bytes);
  assert.equal(manifest.totalBytes, bytes.length, name);
  assert.equal(manifest.sha256, sha256Of(bytes), name);
  const manifestPath = await writeFixture(dir, `${name}.manifest.json`, Buffer.from(JSON.stringify(manifest)));
  const artifactPath = await writeFixture(dir, `${name}.artifact`, bytes);
  const run = runCli(['--manifest', manifestPath, '--artifact', artifactPath]);
  assert.notEqual(run.status, 0, name);
  const report = reportOf(run);
  assert.equal(report.status, 'invalid', `${name}: ${report.reason}`);
  assert.equal(report.identityVerified, true, name);
  assert.equal(report.structureVerified, false, name);
  assert.equal(typeof report.reason, 'string', name);
  return report;
}

test('PNG chunk walk rejects truncation, missing IEND, forged length and bad CRC with recomputed manifests', async () => {
  const dir = await workspace();
  const png = makePng(2, 2);
  const baseManifest = await pngManifest(png);
  const idatStart = 8 + 12 + 13;
  assert.equal(png.readUInt32BE(idatStart), png.length - idatStart - 24);
  const badCrc = Buffer.from(png);
  badCrc[badCrc.length - 13] ^= 0xff;
  const hugeLength = Buffer.from(png);
  hugeLength.writeUInt32BE(0xffffffff, idatStart);

  const cases = [
    ['png-ihdr-mid', png.subarray(0, 20)],
    ['png-idat-mid', png.subarray(0, idatStart + 8 + 10)],
    ['png-iend-missing', png.subarray(0, png.length - 12)],
    ['png-chunk-length-ffffffff', hugeLength],
    ['png-idat-crc', badCrc],
    ['png-trailing-byte', Buffer.concat([png, Buffer.from([0])])],
  ];
  for (const [name, bytes] of cases) await assertStructureRejected(dir, name, bytes, baseManifest);
});

test('GIF block walk rejects color-table/sub-block truncation, missing trailer, unknown markers and trailing bytes', async () => {
  const dir = await workspace();
  const gif = await makeGif(640, 320, 24);
  const baseManifest = await gifManifest(gif);
  const globalColorTableEnd = 13 + 3 * 256;
  assert.equal(gif[globalColorTableEnd], 0x21);
  const unknownMarker = Buffer.from(gif);
  unknownMarker[globalColorTableEnd] = 0x99;

  const cases = [
    ['gif-color-table-mid', gif.subarray(0, globalColorTableEnd - 10)],
    ['gif-subblock-mid', gif.subarray(0, gif.length - 50)],
    ['gif-subblock-short-1', gif.subarray(0, gif.length - 3)],
    ['gif-trailer-missing', gif.subarray(0, gif.length - 1)],
    ['gif-unknown-marker', unknownMarker],
    ['gif-trailing-byte', Buffer.concat([gif, Buffer.from([0])])],
  ];
  for (const [name, bytes] of cases) await assertStructureRejected(dir, name, bytes, baseManifest);
});
