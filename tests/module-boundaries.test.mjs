import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {run, check, collectGraph, parseImports} from '../scripts/check-module-boundaries.mjs';

const layers = (extra = {}) => ({
  layers: {
    domain: {mayImport: [], externals: [], assets: [], dom: false, files: ['core.js']},
    ui: {mayImport: ['domain'], externals: ['three'], assets: [], dom: true, files: ['main.js']},
    ...extra
  },
  allowlist: []
});

function fixture(files, config) {
  const root = mkdtempSync(path.join(tmpdir(), 'boundaries-'));
  mkdirSync(path.join(root, 'src'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, 'src', name)), {recursive: true});
    writeFileSync(path.join(root, 'src', name), text);
  }
  writeFileSync(path.join(root, 'src', 'module-layers.json'), JSON.stringify(config));
  return root;
}

test('the real repository satisfies its module boundaries', () => {
  const result = run();
  assert.deepEqual(result.problems, []);
  assert.ok(result.files > 100 && result.edges > 100);
});

test('every allowlisted violation in the real layer table carries a reason', () => {
  const config = JSON.parse(readFileSync(new URL('../src/module-layers.json', import.meta.url), 'utf8'));
  for (const entry of config.allowlist) assert.ok(entry.reason.length >= 10, entry.from);
});

test('import parser ignores strings that merely contain "from"', () => {
  const text = "import {a} from './a.js';\nexport {b} from './b.js';\nimport './c.js';\nconst x = import('./d.js');\nconst s = \"nothing from './zzz.js' here\";";
  assert.deepEqual(parseImports(text).sort(), ['./a.js', './b.js', './c.js', './d.js']);
});

test('a forbidden upward edge (domain -> ui) is reported', () => {
  const root = fixture({'core.js': "import {x} from './main.js';\nexport const y = x;", 'main.js': 'export const x = 1;'}, layers());
  try {
    const {problems} = run({root});
    assert.equal(problems.length, 1);
    assert.match(problems[0], /forbidden edge: core\.js \[domain\] -> main\.js \[ui\]/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

test('allowed downward edge passes; forbidden external and DOM use in a pure layer fail', () => {
  const ok = fixture({'core.js': 'export const x = 1;', 'main.js': "import {x} from './core.js';\nimport * as T from 'three';\nexport const y = x;"}, layers());
  const bad = fixture({'core.js': "import * as T from 'three';\nexport const el = document.getElementById('a');", 'main.js': 'export const x = 1;'}, layers());
  try {
    assert.deepEqual(run({root: ok}).problems, []);
    const problems = run({root: bad}).problems.join('\n');
    assert.match(problems, /forbidden external import: core\.js \[domain\] imports 'three'/);
    assert.match(problems, /DOM global used in domain layer: core\.js/);
  } finally { rmSync(ok, {recursive: true, force: true}); rmSync(bad, {recursive: true, force: true}); }
});

test('an unclassified new file fails, including files in subdirectories', () => {
  const root = fixture({'core.js': 'export const x = 1;', 'main.js': 'export const y = 2;', 'new-thing.js': 'export const z = 3;', 'sub/deep.js': "import {x} from '../core.js';export const w = x;"}, layers());
  try {
    const problems = run({root}).problems.join('\n');
    assert.match(problems, /unclassified file: src\/new-thing\.js/);
    assert.match(problems, /unclassified file: src\/sub\/deep\.js/);
  } finally { rmSync(root, {recursive: true, force: true}); }
});

test('allowlist entries must be used and justified', () => {
  const graph = {'core.js': {local: [], external: ['three'], assets: [], dom: false}, 'main.js': {local: [], external: [], assets: [], dom: false}};
  const config = layers();
  config.allowlist = [{kind: 'external', from: 'core.js', to: 'three', reason: 'documented pre-existing exception'}, {kind: 'edge', from: 'main.js', to: 'core.js', reason: 'stale entry that matches nothing'}];
  const problems = check(graph, config).problems;
  assert.equal(problems.length, 1);
  assert.match(problems[0], /stale allowlist entry/);
  config.allowlist = [{kind: 'external', from: 'core.js', to: 'three', reason: 'x'}];
  assert.match(check(graph, config).problems.join('\n'), /needs a reason/);
});

test('collectGraph resolves relative imports inside subdirectories', () => {
  const root = fixture({'a.js': 'export const a = 1;', 'sub/b.js': "import {a} from '../a.js';\nimport {c} from './c.js';", 'sub/c.js': 'export const c = 1;'}, layers());
  try {
    const graph = collectGraph(root);
    assert.deepEqual(graph['sub/b.js'].local, ['a.js', 'sub/c.js']);
  } finally { rmSync(root, {recursive: true, force: true}); }
});
