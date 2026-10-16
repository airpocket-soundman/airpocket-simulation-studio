// Mechanical dependency-direction check for src/**/*.js (ES imports, dynamic imports, URL/Worker loading).
// Usage: node scripts/check-module-boundaries.mjs [--graph] [--root <dir>] [--layers <file>]
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Module references are extracted from a token stream, not from regexes over raw text, so comments,
// string/template/regex literal contents and line endings (LF/CRLF) cannot hide or fake an import.
// Recognised references (each produces a graph edge):
//   import x from './a.js' | import './a.js' | export {..} from './a.js' | export * from './a.js'
//   import(`./a.js`) / import('./a.js', {with:{...}})            (string or no-substitution template literal)
//   new URL('./a.worker.js', import.meta.url) | new Worker('./a.js') | new SharedWorker('./a.js')
// A specifier computed at runtime (variable, template with ${}) cannot be resolved and is NOT checked.
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

// Returns {tokens, code}. tokens: {t:'id'|'punct'|'str'|'tpl'|'regex', v, subst?}. `code` is the source with
// comments and the contents of string/template/regex literals blanked (newlines kept); used for global detection.
export function tokenize(src) {
  const tokens = [], stack = [];
  let out = '', i = 0;
  const n = src.length;
  const blank = ch => (ch === '\n' || ch === '\r' ? ch : ' ');
  const idChar = c => /[\w$\u0080-￿]/.test(c);
  // Scans template text from i (just after ` or after the } that closes a substitution). Emits the template
  // token at the closing backtick; on `${` it parks the text so far on the stack and returns to code mode.
  const template = (value, subst) => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { value += src[i + 1] ?? ''; out += '  '; i += 2; continue; }
      if (c === '`') { out += '`'; i++; tokens.push({t: 'tpl', v: value, subst}); return; }
      if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; stack.push({kind: 'tpl', value}); return; }
      value += c; out += blank(c); i++;
    }
    tokens.push({t: 'tpl', v: value, subst});
  };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (/\s/.test(c)) { out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n' && src[i] !== '\r') { out += ' '; i++; } continue; }
    if (c === '/' && d === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += blank(src[i]); i++; }
      if (i < n) { out += '  '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'") {
      let v = ''; out += c; i++;
      while (i < n && src[i] !== c && src[i] !== '\n' && src[i] !== '\r') {
        if (src[i] === '\\') { v += src[i + 1] ?? ''; out += '  '; i += 2; continue; }
        v += src[i]; out += ' '; i++;
      }
      if (src[i] === c) { out += c; i++; }
      tokens.push({t: 'str', v});
      continue;
    }
    if (c === '`') { out += '`'; i++; template('', false); continue; }
    if (c === '{') { stack.push({kind: 'brace'}); tokens.push({t: 'punct', v: c}); out += c; i++; continue; }
    if (c === '}') {
      const frame = stack.pop();
      out += c; i++;
      if (frame && frame.kind === 'tpl') template(frame.value, true);
      else tokens.push({t: 'punct', v: c});
      continue;
    }
    if (c === '/') {
      const p = tokens[tokens.length - 1];
      const regexOk = !p || (p.t === 'punct' && !')]}'.includes(p.v)) || (p.t === 'id' && REGEX_KEYWORDS.has(p.v));
      if (regexOk) {
        out += '/'; i++;
        let inClass = false;
        while (i < n && src[i] !== '\n' && src[i] !== '\r' && (inClass || src[i] !== '/')) {
          if (src[i] === '\\') { out += '  '; i += 2; continue; }
          if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false;
          out += ' '; i++;
        }
        if (src[i] === '/') { out += '/'; i++; }
        while (i < n && idChar(src[i])) { out += src[i]; i++; }
        tokens.push({t: 'regex', v: ''});
        continue;
      }
    }
    if (idChar(c)) {
      let j = i; while (j < n && idChar(src[j])) j++;
      tokens.push({t: 'id', v: src.slice(i, j)}); out += src.slice(i, j); i = j;
      continue;
    }
    tokens.push({t: 'punct', v: c}); out += c; i++;
  }
  return {tokens, code: out};
}

// `kind`: 'static' (import/export-from), 'dynamic' (import(...)) or 'url' (new URL(.., import.meta.url) / new Worker(..)).
export function parseModuleRefs(source) {
  const {tokens} = tokenize(source);
  const refs = [];
  const lit = tk => tk && (tk.t === 'str' || (tk.t === 'tpl' && !tk.subst)) ? tk.v : null;
  const isP = (tk, v) => !!tk && tk.t === 'punct' && tk.v === v;
  const isId = (tk, v) => !!tk && tk.t === 'id' && tk.v === v;
  for (let k = 0; k < tokens.length; k++) {
    const tk = tokens[k];
    if (tk.t !== 'id' || isP(tokens[k - 1], '.')) continue;
    if (tk.v === 'import' || tk.v === 'export') {
      const nx = tokens[k + 1];
      if (tk.v === 'import' && lit(nx) !== null) { refs.push({spec: lit(nx), kind: 'static'}); continue; }
      if (tk.v === 'import' && isP(nx, '(')) {
        const spec = lit(tokens[k + 2]);
        if (spec !== null && (isP(tokens[k + 3], ')') || isP(tokens[k + 3], ','))) refs.push({spec, kind: 'dynamic'});
        continue;
      }
      if (tk.v === 'import' && isP(nx, '.')) continue; // import.meta
      // binding clause: identifiers and `{ } , *` only, up to `from <literal>`
      for (let j = k + 1; j < tokens.length; j++) {
        const t = tokens[j];
        if (isId(t, 'from') && lit(tokens[j + 1]) !== null) { refs.push({spec: lit(tokens[j + 1]), kind: 'static'}); break; }
        if (t.t === 'id' || (t.t === 'punct' && '{},*'.includes(t.v))) continue;
        break;
      }
      continue;
    }
    if (tk.v === 'new') {
      const nx = tokens[k + 1];
      if (isId(nx, 'URL') && isP(tokens[k + 2], '(') && lit(tokens[k + 3]) !== null && isP(tokens[k + 4], ',')
        && isId(tokens[k + 5], 'import') && isP(tokens[k + 6], '.') && isId(tokens[k + 7], 'meta') && isP(tokens[k + 8], '.') && isId(tokens[k + 9], 'url'))
        refs.push({spec: lit(tokens[k + 3]), kind: 'url'});
      else if ((isId(nx, 'Worker') || isId(nx, 'SharedWorker')) && isP(tokens[k + 2], '(') && lit(tokens[k + 3]) !== null)
        refs.push({spec: lit(tokens[k + 3]), kind: 'url'});
    }
  }
  return refs;
}

export function parseImports(source) { return [...new Set(parseModuleRefs(source).map(r => r.spec))]; }

// Browser-global detection runs on `code` (comments and literal contents blanked). Each entry is a named
// hit so the allowlist can excuse one specific global with a specific reason. A local variable called
// `document`, or an object property such as `.location` / `.fetch(`, does not match.
const NOT_MEMBER = String.raw`(?<![.\w$])`;
const DOM_HITS = [
  ['document.*', /\bdocument\.(?:getElementById|querySelector(?:All)?|createElement|createTreeWalker|body|documentElement|addEventListener|title)\b/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['navigator.gpu/serviceWorker', /\bnavigator\.(?:gpu|serviceWorker)\b/],
  ['HTMLElement', /\bHTMLElement\b/],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['window.', new RegExp(NOT_MEMBER + String.raw`window\s*\.`)],
  ['location', new RegExp(NOT_MEMBER + String.raw`location\b(?!\s*:)`)],
  ['history.*', new RegExp(NOT_MEMBER + String.raw`history\s*\.\s*(?:pushState|replaceState|back|forward|go)\b`)],
  ['fetch()', new RegExp(NOT_MEMBER + String.raw`fetch\s*\(`)],
  ['new Worker', /\bnew\s+(?:Shared)?Worker\s*\(/],
];

export function domHits(code) { return DOM_HITS.filter(([, re]) => re.test(code)).map(([name]) => name); }

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
    const text = readFileSync(path.join(srcDir, file), 'utf8'); // LF and CRLF are both handled by the tokenizer
    const local = [], external = [], assets = [], urlLoaded = [];
    for (const {spec: raw, kind} of parseModuleRefs(text)) {
      const spec = raw.replace(/\\/g, '/'); // a Windows-style specifier is resolved as the path it names
      if (spec.startsWith('.')) {
        const clean = spec.replace(/[?#].*$/, '');
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
        if (clean.endsWith('.js') && !resolved.startsWith('..')) { local.push(resolved); if (kind === 'url') urlLoaded.push(resolved); }
        else assets.push(spec);
      } else external.push(spec);
    }
    const hits = domHits(tokenize(text).code);
    const uniq = a => [...new Set(a)].sort();
    nodes[file] = {local: uniq(local), external: uniq(external), assets: uniq(assets), urlLoaded: uniq(urlLoaded), domHits: hits, dom: hits.length > 0};
  }
  return nodes;
}

export function loadLayers(file) { return JSON.parse(readFileSync(file, 'utf8')); }

export function check(graph, config) {
  const problems = [];
  const layerNames = Object.keys(config.layers);
  const fileLayer = new Map();
  for (const [layer, def] of Object.entries(config.layers)) {
    for (const raw of def.files) {
      const f = raw.replace(/\\/g, '/');
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
        problems.push(`forbidden edge${(node.urlLoaded || []).includes(to) ? ' (loaded by URL/Worker)' : ''}: ${file} [${layer}] -> ${to} [${toLayer}] (${layer} may import: ${[layer, ...def.mayImport].join(', ')})`);
    }
    for (const ext of node.external) {
      if (!(def.externals || []).includes(ext) && !allowed('external', file, ext))
        problems.push(`forbidden external import: ${file} [${layer}] imports '${ext}' (allowed externals: ${(def.externals || []).join(', ') || 'none'})`);
    }
    for (const asset of node.assets) {
      if (!(def.assets || []).some(a => a === '*' || a === asset) && !allowed('asset', file, asset))
        problems.push(`forbidden asset/non-js import: ${file} [${layer}] imports '${asset}'`);
    }
    if (!def.dom) {
      const hits = node.domHits ?? (node.dom ? ['*'] : []);
      for (const hit of hits) if (!allowed('dom', file, hit) && !allowed('dom', file, '*'))
        problems.push(`browser/DOM global used in ${layer} layer: ${file} (${hit}); if intentional allowlist it as kind 'dom', to '${hit}', with a reason`);
    }
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
    for (const [f, n] of Object.entries(g)) console.log(`${f}${n.dom ? ' [dom: ' + n.domHits.join(',') + ']' : ''} : ${n.local.join(' ')} | ext: ${n.external.join(' ')} | assets: ${n.assets.join(' ')} | url: ${n.urlLoaded.join(' ')}`);
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
