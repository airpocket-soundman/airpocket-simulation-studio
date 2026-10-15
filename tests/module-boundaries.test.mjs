import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {run, check, collectGraph, parseImports, parseModuleRefs, tokenize, domHits, loadLayers} from '../scripts/check-module-boundaries.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const layersPath = path.join(repoRoot, 'src', 'module-layers.json');

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

const withFixture = (files, config, fn) => {
  const root = fixture(files, config);
  try { return fn(root); } finally { rmSync(root, {recursive: true, force: true}); }
};

test('the real repository satisfies its module boundaries and the graph is what the table says it is', () => {
  const config = loadLayers(layersPath);
  const graph = collectGraph(repoRoot);
  const result = check(graph, config);
  assert.deepEqual(result.problems, []);
  // Every classified file exists in the graph and vice versa (no silent drift in either direction).
  const classified = Object.values(config.layers).flatMap(l => l.files).sort();
  assert.deepEqual(Object.keys(graph).sort(), classified);
  assert.equal(result.files, classified.length);
  assert.equal(result.edges, Object.values(graph).reduce((n, node) => n + node.local.length, 0));
  // Every allowlist entry is exercised (check also reports stale ones) and counted.
  assert.equal(result.allowlisted, config.allowlist.length);
  // Known real edges, one per recognised syntax, must be present: guards against the parser going blind.
  assert.ok(graph['studio-api.js'].local.length > 0);
  assert.ok(graph['analysis-client.js'].local.includes('analysis.worker.js'), 'new Worker(new URL(...)) must create an edge');
  assert.ok(graph['analysis-client.js'].urlLoaded.includes('analysis.worker.js'));
  assert.ok(graph['main.js'].local.includes('cad.worker.js'), 'worker started from main.js must create an edge');
  assert.ok(graph['solver-adapters/index.js'].local.length > 0, 'subdirectory file edges must resolve');
  assert.ok(graph['project-import.js'].external.includes('three'));
  assert.ok(!graph['analysis-client.js'].domHits.includes('location'), 'analysis-client.js must not use the location global (baseUrl is injected)');
  assert.ok(graph['main.js'].domHits.length > 0);
  for (const [name, def] of Object.entries(config.layers)) assert.ok(def.files.length > 0, name);
});

test('independent oracle: every relative .js string literal in src is a recognised module reference', () => {
  const srcDir = path.join(repoRoot, 'src');
  const walk = (dir, prefix = '') => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), prefix + e.name + '/') : e.name.endsWith('.js') ? [prefix + e.name] : []);
  const unexplained = [];
  for (const file of walk(srcDir)) {
    const text = readFileSync(path.join(srcDir, file), 'utf8');
    const refs = new Set(parseModuleRefs(text).map(r => r.spec));
    for (const tk of tokenize(text).tokens) if (tk.t === 'str' && /^\.{1,2}\/[^\s'"]*\.js(\?.*)?$/.test(tk.v) && !refs.has(tk.v)) unexplained.push(file + ': ' + tk.v);
  }
  assert.deepEqual(unexplained, []);
});

test('mutating the real graph is detected, and every allowlist entry is load-bearing', () => {
  const config = loadLayers(layersPath);
  const base = collectGraph(repoRoot);
  const clone = () => structuredClone(base);
  const g1 = clone(); g1['fem-core.js'].local.push('main.js');
  assert.match(check(g1, config).problems.join('\n'), /forbidden edge: fem-core\.js \[domain\] -> main\.js \[ui\]/);
  const g2 = clone(); g2['fem-core.js'].external.push('three');
  assert.match(check(g2, config).problems.join('\n'), /forbidden external import: fem-core\.js/);
  const g3 = clone(); g3['fem-core.js'].domHits = ['window.'];
  assert.match(check(g3, config).problems.join('\n'), /DOM global used in domain layer: fem-core\.js \(window\.\)/);
  const g4 = clone(); g4['fem-core.js'].local.push('analysis.worker.js'); g4['fem-core.js'].urlLoaded = ['analysis.worker.js'];
  assert.match(check(g4, config).problems.join('\n'), /forbidden edge \(loaded by URL\/Worker\): fem-core\.js/);
  for (let i = 0; i < config.allowlist.length; i++) {
    const trimmed = {...config, allowlist: config.allowlist.filter((_, j) => j !== i)};
    assert.ok(check(base, trimmed).problems.length > 0, 'allowlist entry is not load-bearing: ' + JSON.stringify(config.allowlist[i]));
  }
});

test('every allowlisted violation in the real layer table carries a specific reason', () => {
  const config = loadLayers(layersPath);
  for (const entry of config.allowlist) assert.ok(entry.reason.length >= 40, entry.from + ' -> ' + entry.to);
});

test('import parser ignores strings that merely contain "from"', () => {
  const text = "import {a} from './a.js';\nexport {b} from './b.js';\nimport './c.js';\nconst x = import('./d.js');\nconst s = \"nothing from './zzz.js' here\";";
  assert.deepEqual(parseImports(text).sort(), ['./a.js', './b.js', './c.js', './d.js']);
});

test('probe 1: static imports after block comments, statements and on one line are found', () => {
  const text = [
    "/* c */ import x from './a.js';",
    "foo(); import y from './b.js'; import './c.js'",
    "let z = 1; export {q} from './d.js'; export * from './e.js'; /* x */ export * as ns from './f.js';",
    "const o = {a: 1} /* m */ ; import w, {v as u} from './g.js';",
    "import * as all from './h.js'"
  ].join('\n');
  assert.deepEqual(parseImports(text).sort(), ['./a.js', './b.js', './c.js', './d.js', './e.js', './f.js', './g.js', './h.js']);
});

test('probe 2: dynamic import with template literal or options argument, and static import from a template', () => {
  const text = [
    'const a = import(`./t.js`);',
    "const b = import('./o.js', {with: {type: 'json'}});",
    'import x from `./u.js`;',
    'const c = await import("./v.js" );',
    'const d = import(`./${name}.js`);',
    'const e = import(name);'
  ].join('\n');
  const refs = parseModuleRefs(text);
  assert.deepEqual(refs.map(r => r.spec).sort(), ['./o.js', './t.js', './u.js', './v.js']);
  assert.equal(refs.find(r => r.spec === './t.js').kind, 'dynamic');
  assert.equal(refs.find(r => r.spec === './u.js').kind, 'static');
});

test('commented-out or quoted import text creates no edge; import.meta and member import are not imports', () => {
  const text = [
    "// import x from './no1.js';",
    "/* import './no2.js'; */",
    "const s = \"import x from './no3.js'\"; const t = 'import(\\'./no4.js\\')';",
    "const tpl = `import './no5.js' ${1 + 1} import('./no6.js')`;",
    "const r = /import 'x'/.test(s) ? 1 : 2; const q = a / b / c;",
    "const meta = import.meta.url; obj.import('./no7.js');",
    "import {real} from './yes.js';"
  ].join('\n');
  assert.deepEqual(parseImports(text), ['./yes.js']);
});

test('a real import inside a template substitution is still found', () => {
  assert.deepEqual(parseImports('const m = `x ${await import("./inner.js")} y`;\nimport "./after.js";').sort(), ['./after.js', './inner.js']);
});

test('probe 3: Worker / URL loading creates edges, so worker and asset loading cannot escape layer checks', () => {
  const text = [
    "const w = new Worker(new URL('./analysis.worker.js', import.meta.url), {type: 'module'});",
    "const a = new URL('./model.wasm', import.meta.url);",
    "const s = new SharedWorker('./shared.js');",
    "const notEdge = new URL('./x.js', base);"
  ].join('\n');
  const refs = parseModuleRefs(text);
  assert.deepEqual(refs.map(r => r.spec).sort(), ['./analysis.worker.js', './model.wasm', './shared.js']);
  assert.ok(refs.every(r => r.kind === 'url'));
  const config = layers({worker: {mayImport: [], externals: [], assets: [], dom: false, files: ['job.worker.js']}});
  withFixture({'core.js': "export const w = new Worker(new URL('./job.worker.js', import.meta.url));", 'job.worker.js': 'self.onmessage = () => {};', 'main.js': 'export const x = 1;'}, config, root => {
    const problems = run({root}).problems.join('\n');
    assert.match(problems, /forbidden edge \(loaded by URL\/Worker\): core\.js \[domain\] -> job\.worker\.js \[worker\]/);
    assert.match(problems, /DOM global used in domain layer: core\.js \(new Worker\)/);
  });
  // a non-js asset loaded by URL is subject to the asset rule
  withFixture({'core.js': "export const a = new URL('./m.wasm', import.meta.url);", 'main.js': 'export const x = 1;'}, layers(), root => {
    assert.match(run({root}).problems.join('\n'), /forbidden asset\/non-js import: core\.js \[domain\] imports '\.\/m\.wasm'/);
  });
});

test('probe 4: window./location/fetch/Worker/history are detected; members, comments, strings and keys are not', () => {
  assert.deepEqual(domHits(tokenize("const u = location.href; window.foo(); const r = await fetch(u); history.pushState({}, ''); new Worker('./w.js');").code).sort(), ['fetch()', 'history.*', 'location', 'new Worker', 'window.']);
  assert.deepEqual(domHits(tokenize("x.location = 1; api.fetch(1); o.history.push(1); const s = 'window.x location fetch(1)'; // window. location\n/* fetch(1) */ const document = {a: 1}; const o = {location: 1};").code), []);
  withFixture({'core.js': "export const f = () => fetch('/x');", 'main.js': 'export const l = location.href;'}, layers(), root => {
    assert.match(run({root}).problems.join('\n'), /DOM global used in domain layer: core\.js \(fetch\(\)\)/);
  });
});

test('a dom allowlist entry excuses exactly one named global with a reason and goes stale when fixed', () => {
  const graph = {'core.js': {local: [], external: [], assets: [], domHits: ['location', 'fetch()'], dom: true}, 'main.js': {local: [], external: [], assets: [], domHits: [], dom: false}};
  const config = layers();
  config.allowlist = [{kind: 'dom', from: 'core.js', to: 'location', reason: 'documented: resolves asset base URL'}];
  const problems = check(graph, config).problems;
  assert.equal(problems.length, 1);
  assert.match(problems[0], /core\.js \(fetch\(\)\)/);
  graph['core.js'].domHits = ['fetch()'];
  assert.match(check(graph, config).problems.join('\n'), /stale allowlist entry.*dom core\.js -> location/s);
});

test('CRLF, CR-only line ends and a UTF-8 BOM parse identically to LF', () => {
  const lf = "import {a} from './a.js';\n// c\nexport {b} from './b.js';\nconst x = import('./c.js');\nconst y = 1; // import './no.js'\nimport './d.js'\n";
  const want = ['./a.js', './b.js', './c.js', './d.js'];
  for (const text of [lf, lf.replace(/\n/g, '\r\n'), lf.replace(/\n/g, '\r'), '﻿' + lf]) assert.deepEqual(parseImports(text).sort(), want);
  withFixture({'core.js': 'export const x = 1;', 'main.js': lf.replace(/\.\/[a-d]\.js/g, './core.js').replace(/\n/g, '\r\n')}, layers(), root => {
    assert.deepEqual(collectGraph(root)['main.js'].local, ['core.js']);
    assert.deepEqual(run({root}).problems, []);
  });
});

test('Windows-style paths: backslash specifiers and backslash entries in the layer table resolve like POSIX ones', () => {
  const config = layers();
  config.layers.domain.files = ['core.js', 'sub\\inner.js'];
  withFixture({'core.js': 'export const x = 1;', 'sub/inner.js': "import {x} from '..\\\\core.js'; export const y = x;", 'main.js': "import {y} from '.\\\\sub\\\\inner.js'; export const z = y;"}, config, root => {
    const graph = collectGraph(root);
    assert.deepEqual(graph['main.js'].local, ['sub/inner.js']);
    assert.deepEqual(graph['sub/inner.js'].local, ['core.js']);
    assert.deepEqual(run({root}).problems, []);
  });
  // and the edge is still policed: a backslash path cannot smuggle a forbidden edge
  const strict = layers();
  withFixture({'core.js': "import {z} from '.\\\\main.js'; export const x = z;", 'main.js': 'export const z = 1;'}, strict, root => {
    assert.match(run({root}).problems.join('\n'), /forbidden edge: core\.js \[domain\] -> main\.js \[ui\]/);
  });
});

test('a forbidden upward edge (domain -> ui) is reported', () => {
  withFixture({'core.js': "import {x} from './main.js';\nexport const y = x;", 'main.js': 'export const x = 1;'}, layers(), root => {
    const {problems} = run({root});
    assert.equal(problems.length, 1);
    assert.match(problems[0], /forbidden edge: core\.js \[domain\] -> main\.js \[ui\]/);
  });
});

test('allowed downward edge passes; forbidden external and DOM use in a pure layer fail', () => {
  withFixture({'core.js': 'export const x = 1;', 'main.js': "import {x} from './core.js';\nimport * as T from 'three';\nexport const y = x;"}, layers(), root => {
    assert.deepEqual(run({root}).problems, []);
  });
  withFixture({'core.js': "import * as T from 'three';\nexport const el = document.getElementById('a');", 'main.js': 'export const x = 1;'}, layers(), root => {
    const problems = run({root}).problems.join('\n');
    assert.match(problems, /forbidden external import: core\.js \[domain\] imports 'three'/);
    assert.match(problems, /DOM global used in domain layer: core\.js/);
  });
});

test('an unclassified new file fails, including files in subdirectories', () => {
  withFixture({'core.js': 'export const x = 1;', 'main.js': 'export const y = 2;', 'new-thing.js': 'export const z = 3;', 'sub/deep.js': "import {x} from '../core.js';export const w = x;"}, layers(), root => {
    const problems = run({root}).problems.join('\n');
    assert.match(problems, /unclassified file: src\/new-thing\.js/);
    assert.match(problems, /unclassified file: src\/sub\/deep\.js/);
  });
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
  withFixture({'a.js': 'export const a = 1;', 'sub/b.js': "import {a} from '../a.js';\nimport {c} from './c.js';", 'sub/c.js': 'export const c = 1;'}, layers(), root => {
    assert.deepEqual(collectGraph(root)['sub/b.js'].local, ['a.js', 'sub/c.js']);
  });
});
