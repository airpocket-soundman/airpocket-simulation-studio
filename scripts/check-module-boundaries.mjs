// Mechanical dependency-direction check for src/*.js (ES imports).
// Usage: node scripts/check-module-boundaries.mjs [--graph] [--root <dir>] [--layers <file>]
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Static edges only: `import x from './a.js'`, `import './a.js'`, `export ... from './a.js'`
// and dynamic `import('./a.js')` with a literal specifier. The binding clause is restricted to
// identifier/brace/comma/star characters so string literals that merely contain "from" never match.
const CLAUSE = String.raw`[\w$*{}\s,]+?`;
const PATTERNS = [
  new RegExp(String.raw`(?:^|[;}\n])\s*(?:import|export)\s+(?:type\s+)?${CLAUSE}\s*from\s*(['"])([^'"\n]+)\1`, 'g'),
  new RegExp(String.raw`(?:^|[;}\n])\s*import\s*(['"])([^'"\n]+)\1`, 'g'),
  new RegExp(String.raw`\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)`, 'g'),
];

// Pure-core layers must not touch browser globals. Narrow patterns on purpose: a local variable
// called `document` (e.g. a JSON document) must not trigger.
const DOM_PATTERN = /\b(?:document\.(?:getElementById|querySelector(?:All)?|createElement|createTreeWalker|body|documentElement|addEventListener|title)|localStorage|sessionStorage|navigator\.(?:gpu|serviceWorker)|HTMLElement|requestAnimationFrame)\b/;

export function parseImports(source) {
  const specs = new Set();
  for (const re of PATTERNS) { re.lastIndex = 0; let m; while ((m = re.exec(source))) specs.add(m[2]); }
  return [...specs];
}

function listJs(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) out.push(...listJs(path.join(dir, entry.name), prefix + entry.name + '/'));
    else if (entry.name.endsWith('.js')) out.push(prefix + entry.name);
  }
  return out;
}

// Keys are paths relative to src/ using '/', e.g. 'fem-core.js' or 'ui/case-list-ui.js'.
export function collectGraph(root) {
  const srcDir = path.join(root, 'src');
  const files = listJs(srcDir).sort();
  const nodes = {};
  for (const file of files) {
    const text = readFileSync(path.join(srcDir, file), 'utf8');
    const local = [], external = [], assets = [];
    for (const spec of parseImports(text)) {
      if (spec.startsWith('.')) {
        const clean = spec.replace(/\?.*$/, '');
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
        if (clean.endsWith('.js') && !resolved.startsWith('..')) local.push(resolved);
        else assets.push(spec);
      } else external.push(spec);
    }
    nodes[file] = {local: [...new Set(local)].sort(), external: [...new Set(external)].sort(), assets: [...new Set(assets)].sort(), dom: DOM_PATTERN.test(text)};
  }
  return nodes;
}

export function loadLayers(file) { return JSON.parse(readFileSync(file, 'utf8')); }

export function check(graph, config) {
  const problems = [];
  const layerNames = Object.keys(config.layers);
  const fileLayer = new Map();
  for (const [layer, def] of Object.entries(config.layers)) {
    for (const f of def.files) {
      if (fileLayer.has(f)) problems.push(`duplicate classification: ${f} is in both ${fileLayer.get(f)} and ${layer}`);
      fileLayer.set(f, layer);
    }
  }
  const allow = (config.allowlist || []).map(a => ({...a, used: false}));
  const allowed = (kind, from, to) => {
    const hit = allow.find(a => a.kind === kind && a.from === from && a.to === to);
    if (hit) hit.used = true;
    return !!hit;
  };
  for (const f of Object.keys(graph)) if (!fileLayer.has(f)) problems.push(`unclassified file: src/${f} (add it to a layer in src/module-layers.json)`);
  for (const f of fileLayer.keys()) if (!graph[f]) problems.push(`classified but missing file: src/${f}`);
  let edges = 0;
  for (const [file, node] of Object.entries(graph)) {
    const layer = fileLayer.get(file);
    if (!layer) continue;
    const def = config.layers[layer];
    for (const to of node.local) {
      edges++;
      const toLayer = fileLayer.get(to);
      if (!toLayer) { problems.push(`${file} imports unclassified/missing ./${to}`); continue; }
      if (toLayer !== layer && !def.mayImport.includes(toLayer) && !allowed('edge', file, to))
        problems.push(`forbidden edge: ${file} [${layer}] -> ${to} [${toLayer}] (${layer} may import: ${[layer, ...def.mayImport].join(', ')})`);
    }
    for (const ext of node.external) {
      if (!(def.externals || []).includes(ext) && !allowed('external', file, ext))
        problems.push(`forbidden external import: ${file} [${layer}] imports '${ext}' (allowed externals: ${(def.externals || []).join(', ') || 'none'})`);
    }
    for (const asset of node.assets) {
      if (!(def.assets || []).some(a => a === '*' || a === asset) && !allowed('asset', file, asset))
        problems.push(`forbidden asset/non-js import: ${file} [${layer}] imports '${asset}'`);
    }
    if (node.dom && !def.dom && !allowed('dom', file, '*'))
      problems.push(`browser/DOM global used in ${layer} layer: ${file}`);
  }
  for (const a of allow) if (!a.used) problems.push(`stale allowlist entry (violation no longer exists, remove it): ${a.kind} ${a.from} -> ${a.to}`);
  for (const a of allow) if (!a.reason || a.reason.length < 10) problems.push(`allowlist entry needs a reason: ${a.kind} ${a.from} -> ${a.to}`);
  for (const [layer, def] of Object.entries(config.layers)) for (const t of def.mayImport) if (!layerNames.includes(t)) problems.push(`layer ${layer} mayImport unknown layer ${t}`);
  // cycles between layers are rejected structurally: mayImport must form a DAG.
  const visiting = new Set(), done = new Set();
  const visit = l => { if (done.has(l)) return; if (visiting.has(l)) { problems.push(`layer cycle through ${l}`); return; } visiting.add(l); for (const t of config.layers[l]?.mayImport || []) visit(t); visiting.delete(l); done.add(l); };
  layerNames.forEach(visit);
  return {problems, files: Object.keys(graph).length, edges, allowlisted: allow.filter(a => a.used).length};
}

export function run({root = REPO, layersFile = path.join(root, 'src', 'module-layers.json')} = {}) {
  return check(collectGraph(root), loadLayers(layersFile));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const root = opt('--root') ? path.resolve(opt('--root')) : REPO;
  if (args.includes('--graph')) {
    const g = collectGraph(root);
    for (const [f, n] of Object.entries(g)) console.log(`${f}${n.dom ? ' [dom]' : ''} : ${n.local.join(' ')} | ext: ${n.external.join(' ')} | assets: ${n.assets.join(' ')}`);
    process.exit(0);
  }
  const result = run({root, layersFile: opt('--layers') ? path.resolve(opt('--layers')) : path.join(root, 'src', 'module-layers.json')});
  if (result.problems.length) {
    console.error(`module boundary check FAILED (${result.problems.length} problem(s)):`);
    for (const p of result.problems) console.error(' - ' + p);
    process.exit(1);
  }
  console.log(`module boundary check passed: ${result.files} files, ${result.edges} local edges, ${result.allowlisted} allowlisted violation(s)`);
}
