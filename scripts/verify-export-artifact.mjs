#!/usr/bin/env node
// Independent readback of a retained visual-export artifact against its
// schemaVersion-1 manifest. It checks identity (exact byte length and SHA-256),
// the container header, and the container's structural boundaries: every PNG
// chunk (length/type/data/CRC-32 per the PNG specification) and every GIF
// block (logical screen descriptor, color tables, extension/image sub-blocks,
// trailer). Structure success is not a pixel decode: it never decodes LZW or
// PNG image data, counts drawable frames, verifies a frame schedule or
// re-derives physical results, and it is not a substitute for the browser
// export tests.
//
// Container contract taken from the real schemaVersion-1 producers in
// src/visual-export-jobs.js (buildManifest / comparisonManifest):
//   format 'png'          -> container 'png'          -> mimeType 'image/png'
//   format 'gif'          -> container 'gif'          -> mimeType 'image/gif'
//   format 'webm'         -> container 'webm'         -> mimeType 'video/webm...'   (unsupported here)
//   format 'png-sequence' -> container 'zip'          -> mimeType 'application/zip' (unsupported here)
// ZIP archives and WebM video are refused as unsupported until a later unit.

import {createHash} from 'node:crypto';
import {lstat, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const MANIFEST_MAX_BYTES = 64 * 1024;
export const ARTIFACT_MAX_BYTES = 100 * 1024 * 1024;
export const FORMAT_CONTRACT = Object.freeze({
  png: {container: 'png', mimeType: 'image/png', supported: true},
  gif: {container: 'gif', mimeType: 'image/gif', supported: true},
  webm: {container: 'webm', supported: false},
  'png-sequence': {container: 'zip', mimeType: 'application/zip', supported: false},
});
export const EXIT_CODES = Object.freeze({verified: 0, mismatch: 1, invalid: 2, unsupported: 3});
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_FIELDS = ['format', 'container', 'mimeType', 'sha256', 'totalBytes'];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

class VerifyError extends Error {
  constructor(status, reason) {
    super(reason);
    this.status = status;
  }
}
class UsageError extends Error {}

const invalid = reason => {
  throw new VerifyError('invalid', reason);
};

function baseReport(manifestPath, artifactPath) {
  return {
    schemaVersion: 1,
    status: 'invalid',
    manifestPath,
    artifactPath,
    identityVerified: false,
    containerHeaderVerified: false,
    structureVerified: false,
    frameCountVerified: false,
  };
}

function failed(report, error) {
  if (error instanceof VerifyError) {
    report.status = error.status;
    report.reason = error.message;
    return report;
  }
  throw error;
}

async function readBoundedRegularFile(path, maxBytes, label) {
  let info;
  try {
    info = await lstat(path);
  } catch {
    invalid(`${label} was not found: ${path}`);
  }
  if (!info.isFile()) invalid(`${label} must be a regular file: ${path}`);
  if (info.size > maxBytes) invalid(`${label} is ${info.size} bytes, over the ${maxBytes} byte limit`);
  return new Uint8Array(await readFile(path));
}

function parseManifestBytes(bytes) {
  if (bytes.length === 0) invalid('manifest file is empty');
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  } catch {
    invalid('manifest is not valid UTF-8 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) invalid('manifest must be a JSON object');
  if (parsed.schemaVersion !== 1) invalid('manifest schemaVersion must be 1');
  for (const field of REQUIRED_FIELDS) {
    if (parsed[field] === undefined) invalid(`manifest is missing required field '${field}'`);
  }
  if (typeof parsed.format !== 'string' || !parsed.format) invalid('manifest format must be a non-empty string');
  if (typeof parsed.container !== 'string' || !parsed.container) invalid('manifest container must be a non-empty string');
  if (typeof parsed.mimeType !== 'string' || !parsed.mimeType) invalid('manifest mimeType must be a non-empty string');
  if (typeof parsed.sha256 !== 'string' || !SHA256.test(parsed.sha256)) invalid("manifest sha256 must be 'sha256:' plus 64 lowercase hex digits");
  if (!Number.isSafeInteger(parsed.totalBytes) || parsed.totalBytes < 0) invalid('manifest totalBytes must be a non-negative safe integer');
  return parsed;
}

function readPngHeader(bytes) {
  if (bytes.length < 24 || !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return undefined;
  if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13) return undefined;
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height) return undefined;
  return {kind: 'png', signature: 'PNG', chunk: 'IHDR', width, height};
}

function readGifHeader(bytes) {
  if (bytes.length < 10) return undefined;
  const brand = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
  if (brand !== 'GIF87a' && brand !== 'GIF89a') return undefined;
  const width = bytes[6] | (bytes[7] << 8), height = bytes[8] | (bytes[9] << 8);
  if (!width || !height) return undefined;
  return {kind: 'gif', brand, width, height};
}

// PNG CRC-32 as specified by the PNG specification (ISO/IEC 15948, 5.5):
// the CRC-32 of the chunk type and data bytes, using the ISO 3309 / ITU-T V.42
// reflected polynomial 0xedb88320 with an initial and final inversion.
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function pngCrc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) crc = PNG_CRC_TABLE[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// Walk the whole PNG chunk sequence. Every declared length is bounds-checked
// against the remaining file bytes before it is used, so a forged 0xffffffff
// length is refused without allocating or scanning. IHDR must be first and
// 13 bytes long, IDAT chunks must exist and be consecutive, IEND must be
// 0 bytes and the final bytes of the file, and each stored CRC must match.
function walkPngChunks(bytes, header) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length, chunkCount = 0, idatChunks = 0, idatClosed = false;
  for (;;) {
    if (offset === bytes.length) invalid('PNG ends without an IEND chunk');
    if (offset + 8 > bytes.length) invalid(`PNG chunk header is truncated at byte ${offset}`);
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (!/^[A-Za-z]{4}$/.test(type)) invalid(`PNG chunk type at byte ${offset} is not four ASCII letters`);
    if (length > 0x7fffffff) invalid(`PNG chunk ${type} declares ${length} data bytes, over the specification maximum of 2147483647`);
    const dataStart = offset + 8, dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) invalid(`PNG chunk ${type} declares ${length} data bytes but only ${Math.max(0, bytes.length - dataStart)} remain, so its data and CRC are truncated`);
    const storedCrc = view.getUint32(dataEnd);
    const computedCrc = pngCrc32(bytes, offset + 4, dataEnd);
    if (storedCrc !== computedCrc) invalid(`PNG chunk ${type} CRC is 0x${storedCrc.toString(16)}, computed 0x${computedCrc.toString(16)}`);
    if (chunkCount === 0) {
      if (type !== 'IHDR') invalid(`PNG first chunk must be IHDR, not ${type}`);
      if (length !== 13) invalid(`PNG IHDR length must be 13, not ${length}`);
      if (view.getUint32(dataStart) !== header.width || view.getUint32(dataStart + 4) !== header.height) invalid('PNG IHDR dimensions differ from the parsed header');
    } else if (type === 'IHDR') {
      invalid(`PNG IHDR must appear only as the first chunk, found again at byte ${offset}`);
    }
    if (type === 'IDAT') {
      if (idatClosed) invalid('PNG IDAT chunks must be consecutive before IEND');
      idatChunks++;
    } else if (idatChunks) {
      idatClosed = true;
    }
    chunkCount++;
    offset = dataEnd + 4;
    if (type === 'IEND') {
      if (length !== 0) invalid(`PNG IEND length must be 0, not ${length}`);
      if (offset !== bytes.length) invalid(`PNG has ${bytes.length - offset} trailing bytes after IEND`);
      break;
    }
  }
  if (!idatChunks) invalid('PNG has no IDAT chunk');
  return {format: 'png', chunkCount, idatChunkCount: idatChunks, crcVerified: true, iendAtEnd: true};
}

// Walk the whole GIF block sequence after the 13-byte logical screen
// descriptor. Sub-block sizes are bounds-checked against the remaining file
// bytes before advancing. The trailer must be the very last byte. LZW data is
// walked as sub-blocks only; it is never decoded.
function walkGifBlocks(bytes) {
  if (bytes.length < 13) invalid(`GIF is ${bytes.length} bytes, shorter than the 13-byte logical screen descriptor`);
  const packed = bytes[10];
  let offset = 13, images = 0, extensions = 0, subBlocks = 0, localColorTables = 0, sawTrailer = false;
  const globalColorTableBytes = packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0;
  if (offset + globalColorTableBytes > bytes.length) invalid(`GIF global color table declares ${globalColorTableBytes} bytes but only ${bytes.length - offset} remain`);
  offset += globalColorTableBytes;
  const walkSubBlocks = label => {
    for (;;) {
      if (offset >= bytes.length) invalid(`GIF ${label} sub-block size is missing at byte ${offset} (truncated before the 0 terminator)`);
      const size = bytes[offset++];
      if (size === 0) return;
      if (offset + size > bytes.length) invalid(`GIF ${label} sub-block declares ${size} bytes but only ${bytes.length - offset} remain`);
      offset += size;
      subBlocks++;
    }
  };
  while (offset < bytes.length) {
    const markerAt = offset, marker = bytes[offset++];
    if (marker === 0x3b) {
      sawTrailer = true;
      if (offset !== bytes.length) invalid(`GIF has ${bytes.length - offset} trailing bytes after the 0x3b trailer at byte ${markerAt}`);
      break;
    }
    if (marker === 0x21) {
      if (offset >= bytes.length) invalid(`GIF extension label is missing after the 0x21 marker at byte ${markerAt}`);
      offset++;
      extensions++;
      walkSubBlocks('extension');
      continue;
    }
    if (marker === 0x2c) {
      if (offset + 9 > bytes.length) invalid(`GIF image descriptor is truncated at byte ${markerAt}`);
      const imagePacked = bytes[offset + 8];
      offset += 9;
      const localBytes = imagePacked & 0x80 ? 3 * (1 << ((imagePacked & 7) + 1)) : 0;
      if (localBytes) localColorTables++;
      if (offset + localBytes > bytes.length) invalid(`GIF local color table declares ${localBytes} bytes but only ${bytes.length - offset} remain`);
      offset += localBytes;
      if (offset >= bytes.length) invalid('GIF LZW minimum code size is missing');
      offset++;
      walkSubBlocks('image data');
      images++;
      continue;
    }
    invalid(`GIF block marker 0x${marker.toString(16).padStart(2, '0')} at byte ${markerAt} is not an extension (0x21), image descriptor (0x2c) or trailer (0x3b)`);
  }
  if (!sawTrailer) invalid('GIF ends without the 0x3b trailer');
  if (!images) invalid('GIF has no image descriptor');
  return {format: 'gif', imageDescriptorCount: images, extensionCount: extensions, subBlockCount: subBlocks, globalColorTableBytes, localColorTableCount: localColorTables, trailerAtEnd: true};
}

/** Read manifest + artifact and compare identity and container header. Never throws for input problems. */
export async function verifyExportArtifact({manifestPath, artifactPath}) {
  const report = baseReport(manifestPath, artifactPath);
  let manifest, contract;
  try {
    manifest = parseManifestBytes(await readBoundedRegularFile(manifestPath, MANIFEST_MAX_BYTES, 'manifest'));
    contract = FORMAT_CONTRACT[manifest.format];
    if (!contract) invalid(`manifest format '${manifest.format}' is not a known schemaVersion 1 export format`);
    if (manifest.container !== contract.container) invalid(`manifest format '${manifest.format}' must use container '${contract.container}', not '${manifest.container}'`);
    if (contract.mimeType && manifest.mimeType !== contract.mimeType) invalid(`manifest format '${manifest.format}' must use mimeType '${contract.mimeType}', not '${manifest.mimeType}'`);
    if (contract.supported) {
      const size = manifest.resolution;
      if (!size || typeof size !== 'object' || Array.isArray(size) || !Number.isSafeInteger(size.width) || size.width < 1 || !Number.isSafeInteger(size.height) || size.height < 1) {
        invalid(`manifest format '${manifest.format}' requires a positive integer resolution {width,height}`);
      }
    }
  } catch (error) {
    return failed(report, error);
  }
  report.format = manifest.format;
  report.container = manifest.container;
  report.mimeType = manifest.mimeType;
  report.manifestSha256 = manifest.sha256;
  report.manifestTotalBytes = manifest.totalBytes;
  if (manifest.resolution) report.manifestResolution = {width: manifest.resolution.width, height: manifest.resolution.height};
  if (!contract.supported) {
    report.status = 'unsupported';
    report.reason = `format '${manifest.format}' in container '${manifest.container}' is not read back by this CLI`;
    return report;
  }

  let bytes;
  try {
    bytes = await readBoundedRegularFile(artifactPath, ARTIFACT_MAX_BYTES, 'artifact');
    if (bytes.length === 0) invalid('artifact file is empty');
  } catch (error) {
    return failed(report, error);
  }

  const actualSha256 = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  report.artifactBytes = bytes.length;
  report.sha256 = actualSha256;
  const sizeMatches = bytes.length === manifest.totalBytes;
  const digestMatches = actualSha256 === manifest.sha256;
  report.identityVerified = sizeMatches && digestMatches;

  const header = manifest.format === 'png' ? readPngHeader(bytes) : readGifHeader(bytes);
  if (!header) return failed(report, new VerifyError('invalid', `artifact does not carry a valid ${manifest.format.toUpperCase()} container header`));
  report.header = header;
  report.width = header.width;
  report.height = header.height;
  report.containerHeaderVerified = header.width === manifest.resolution.width && header.height === manifest.resolution.height;

  if (!report.identityVerified) {
    report.status = 'mismatch';
    report.reason = `artifact identity mismatch (totalBytes ${bytes.length} vs manifest ${manifest.totalBytes}; sha256 ${digestMatches ? 'matches' : 'differs'})`;
    return report;
  }
  if (!report.containerHeaderVerified) {
    report.status = 'mismatch';
    report.reason = `artifact header is ${header.width}x${header.height} but manifest resolution is ${manifest.resolution.width}x${manifest.resolution.height}`;
    return report;
  }
  try {
    report.structure = manifest.format === 'png' ? walkPngChunks(bytes, header) : walkGifBlocks(bytes);
  } catch (error) {
    return failed(report, error);
  }
  report.structureVerified = true;
  report.status = 'verified';
  return report;
}

export function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const equals = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const key = equals >= 0 ? arg.slice(0, equals) : arg;
    if (!['--manifest', '--artifact', '--report'].includes(key)) throw new UsageError(`unknown argument: ${arg}`);
    let value = equals >= 0 ? arg.slice(equals + 1) : undefined;
    if (value === undefined) value = argv[++index];
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${key} requires a value`);
    const name = key.slice(2);
    if (out[name] !== undefined) throw new UsageError(`duplicate argument: ${key}`);
    out[name] = value;
  }
  if (!out.manifest || !out.artifact) throw new UsageError('--manifest and --artifact are required');
  return out;
}

export async function main(argv = process.argv.slice(2), {stdout = process.stdout} = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stdout.write(JSON.stringify({schemaVersion: 1, status: 'invalid', reason: error.message, identityVerified: false, containerHeaderVerified: false, structureVerified: false, frameCountVerified: false}) + '\n');
    return EXIT_CODES.invalid;
  }
  const manifestPath = resolve(args.manifest), artifactPath = resolve(args.artifact);
  const reportPath = args.report === undefined ? undefined : resolve(args.report);
  if (reportPath !== undefined) {
    if (reportPath === manifestPath || reportPath === artifactPath) {
      stdout.write(JSON.stringify({...baseReport(manifestPath, artifactPath), status: 'invalid', reason: '--report must not overwrite the manifest or artifact input'}) + '\n');
      return EXIT_CODES.invalid;
    }
    let exists = false;
    try {
      await lstat(reportPath);
      exists = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        stdout.write(JSON.stringify({...baseReport(manifestPath, artifactPath), status: 'invalid', reason: `--report path is not usable: ${reportPath}`}) + '\n');
        return EXIT_CODES.invalid;
      }
    }
    if (exists) {
      stdout.write(JSON.stringify({...baseReport(manifestPath, artifactPath), status: 'invalid', reason: `--report target already exists and is never overwritten: ${reportPath}`}) + '\n');
      return EXIT_CODES.invalid;
    }
  }
  const report = await verifyExportArtifact({manifestPath, artifactPath});
  let writeFailed = false;
  if (reportPath !== undefined) {
    try {
      await writeFile(reportPath, JSON.stringify(report) + '\n', {encoding: 'utf8', flag: 'wx'});
    } catch (error) {
      report.reportWriteError = String(error?.message || error);
      writeFailed = true;
    }
  }
  stdout.write(JSON.stringify(report) + '\n');
  return writeFailed ? EXIT_CODES.invalid : EXIT_CODES[report.status] ?? EXIT_CODES.invalid;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => {
    process.exitCode = code;
  });
}
