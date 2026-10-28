// P2: per-request WASM transfer size and local read time from the built asset folder.
// Usage: node scripts/measure-runtime-assets.mjs [--root public] [--out file.json]
// Local file reads only; network transfer, compile and cache behaviour are not measured here.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {planRuntimeAssets, planPaths} from '../src/runtime-asset-plan.js';

export const SCENARIOS = Object.freeze([
  {id: 'mesh-only', operation: 'mesh'},
  {id: 'solve-js-pcg', operation: 'solve', method: 'js-pcg'},
  {id: 'solve-wasm-pcg', operation: 'solve', method: 'wasm-pcg'},
  {id: 'solve-mfem-wasm', operation: 'solve', method: 'mfem-wasm'},
]);

export async function measureRuntimeAssets(root) {
  const files = new Map();
  const file = async rel => {
    if (files.has(rel)) return files.get(rel);
    const start = performance.now();
    let entry;
    try {
      const bytes = await readFile(path.join(root, rel));
      entry = {path: rel, status: 'present', bytes: bytes.byteLength, sha256: 'sha256:' + createHash('sha256').update(bytes).digest('hex'), readMs: +(performance.now() - start).toFixed(3)};
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      entry = {path: rel, status: 'missing'};
    }
    files.set(rel, entry);
    return entry;
  };
  const scenarios = [];
  for (const s of SCENARIOS) {
    const paths = planPaths(planRuntimeAssets(s)), entries = [];
    for (const rel of paths) entries.push(await file(rel));
    const missing = entries.filter(e => e.status === 'missing').map(e => e.path);
    scenarios.push({...s, roles: planRuntimeAssets(s).map(a => a.role), paths, missing, totalBytes: missing.length ? null : entries.reduce((n, e) => n + e.bytes, 0)});
  }
  return {files: [...files.values()], scenarios};
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opt = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
  const root = path.resolve(opt('--root') ?? 'public');
  const result = await measureRuntimeAssets(root);
  const text = JSON.stringify(result, null, 2) + '\n';
  if (opt('--out')) await writeFile(opt('--out'), text); else process.stdout.write(text);
}
