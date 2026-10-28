import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {planRuntimeAssets, planPaths, KERNEL_METHODS} from '../src/runtime-asset-plan.js';
import {measureRuntimeAssets} from '../scripts/measure-runtime-assets.mjs';

test('plan fetches only the WASM a request needs', () => {
  assert.deepEqual(planPaths(planRuntimeAssets({operation: 'mesh'})), ['gmsh/gmsh.mjs', 'gmsh/gmsh-core.wasm']);
  assert.deepEqual(planRuntimeAssets({method: 'js-pcg'}).map(a => a.role), ['gmsh']);
  assert.deepEqual(planRuntimeAssets({method: 'wasm-pcg'}).map(a => a.role), ['gmsh', 'kernel']);
  assert.deepEqual(planRuntimeAssets({method: 'mfem-wasm'}).map(a => a.role), ['gmsh', 'mfem', 'kernel']);
  assert.throws(() => planRuntimeAssets({operation: ''}), TypeError);
  assert.throws(() => planRuntimeAssets({method: 3}), TypeError);
});

test('plan stays in step with the worker loads', async () => {
  const worker = await readFile(new URL('../src/analysis.worker.js', import.meta.url), 'utf8');
  assert.ok(worker.includes(`[${KERNEL_METHODS.map(m => `'${m}'`).join(',')}].includes(data.options.method)`));
  assert.ok(worker.includes(`data.options.method==='mfem-wasm'`));
  for (const p of ["'gmsh/gmsh.mjs'", "'mfem/mfem.mjs'", "kernel:'fem-kernel.wasm'", "gmsh:'gmsh/gmsh-core.wasm'", "mfem:'mfem/mfem.wasm'"]) assert.ok(worker.includes(p), p);
});

test('measurement sums planned bytes and reports missing assets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'p2-assets-'));
  await mkdir(path.join(root, 'gmsh'));
  await writeFile(path.join(root, 'gmsh/gmsh.mjs'), 'x'.repeat(10));
  await writeFile(path.join(root, 'gmsh/gmsh-core.wasm'), new Uint8Array(100));
  await writeFile(path.join(root, 'fem-kernel.wasm'), new Uint8Array(7));
  const {scenarios, files} = await measureRuntimeAssets(root);
  const by = id => scenarios.find(s => s.id === id);
  assert.equal(by('mesh-only').totalBytes, 110);
  assert.equal(by('solve-wasm-pcg').totalBytes, 117);
  assert.equal(by('solve-mfem-wasm').totalBytes, null);
  assert.deepEqual(by('solve-mfem-wasm').missing, ['mfem/mfem.mjs', 'mfem/mfem.wasm']);
  assert.equal(files.filter(f => f.path === 'gmsh/gmsh-core.wasm').length, 1);
  assert.match(files[0].sha256, /^sha256:[0-9a-f]{64}$/);
});
