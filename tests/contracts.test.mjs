import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAnalysisJobs} from '../src/analysis-jobs.js';
import {analysisError, createAnalysisFailure} from '../src/analysis-failure.js';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createCaseComparisonApi} from '../src/case-comparison.js';
import {createRuntimeIdentity} from '../src/runtime-identity.js';

// Cheap structural parity: the declared (non-optional) fields of an interface must all be present in
// real runtime output, and runtime output must not carry top-level fields the contract does not declare
// (unless the interface has an index signature).
const files = ['diagnostics', 'job', 'case', 'index'].map(n => `src/contracts/${n}.d.ts`);
const source = Object.fromEntries(files.map(f => [f, existsSync(f) ? readFileSync(f, 'utf8') : '']));
const all = Object.values(source).join('\n');

function declared(name, seen = new Set()) {
  const match = new RegExp(`export interface ${name}(?:\\s+extends\\s+([\\w<>, ]+?))?\\s*\\{`).exec(all);
  assert.ok(match, `interface ${name} must be declared in src/contracts`);
  let depth = 1, i = match.index + match[0].length;
  const start = i;
  for (; i < all.length && depth; i++) { if (all[i] === '{') depth++; else if (all[i] === '}') depth--; }
  const body = all.slice(start, i - 1);
  const fields = new Map();
  let indexed = false;
  // Split into top-level members (separated by ';' or newline outside any bracket), comments removed.
  const members = [];
  let current = '', nest = 0;
  for (const ch of body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) {
    if ('{[(<'.includes(ch)) nest++;
    else if ('}])>'.includes(ch)) nest--;
    if (nest === 0 && (ch === ';' || ch === '\n')) { members.push(current.trim()); current = ''; } else current += ch;
  }
  members.push(current.trim());
  for (const member of members) {
    const m = /^(?:readonly )?([A-Za-z_$][\w$]*)(\?)?:/.exec(member);
    if (m) fields.set(m[1], {optional: !!m[2]});
    else if (/^\[\w+: string\]/.test(member)) indexed = true;
  }
  if (match[1] && !seen.has(match[1])) {
    seen.add(match[1]);
    for (const base of match[1].split(',').map(s => s.trim())) {
      if (base.startsWith('Omit<')) continue;
      const parent = declared(base, seen);
      for (const [k, v] of parent.fields) if (!fields.has(k)) fields.set(k, v);
      indexed ||= parent.indexed;
    }
  }
  return {fields, indexed};
}

function assertParity(name, value) {
  const {fields, indexed} = declared(name);
  assert.ok(value && typeof value === 'object', `${name}: runtime value`);
  for (const [key, {optional}] of fields) if (!optional) assert.ok(Object.hasOwn(value, key), `${name}.${key} is declared required but missing at runtime`);
  if (!indexed) for (const key of Object.keys(value)) assert.ok(fields.has(key), `${name}.${key} exists at runtime but is not declared in src/contracts`);
  return fields;
}

test('contract declaration files exist and export the documented names', () => {
  for (const f of files) assert.ok(existsSync(f), f + ' must exist');
  for (const name of ['AnalysisFailure', 'AnalysisDiagnostic', 'JobErrorRecord', 'JobView', 'JobEvent', 'JobEventsPage', 'JobListPage', 'RuntimeIdentity', 'CaseRow', 'CaseListResponse', 'CaseComparisonReference', 'CaseComparisonResponse']) declared(name);
  for (const mod of ['diagnostics', 'job', 'case']) assert.match(source['src/contracts/index.d.ts'], new RegExp(`from './${mod}'`));
});

test('contract parity: analysis failure and diagnostic', () => {
  const error = analysisError('ANALYSIS_MESH_FAILED', 'Mesh failed', {stage: 'mesh', target: '/study', evidence: {a: 1}, suggestions: ['retry']});
  const failure = createAnalysisFailure(error);
  assertParity('AnalysisFailure', failure);
  assertParity('AnalysisDiagnostic', failure.diagnostics[0]);
  assert.equal(failure.schemaVersion, 1);
  assert.equal(failure.diagnostics[0].severity, 'error');
  assert.match(source['src/contracts/diagnostics.d.ts'], new RegExp(`'${failure.stage}'`));
});

test('contract parity: job view, events, pages and error record', async () => {
  let execution, finish;
  const manager = createAnalysisJobs({execute: input => { execution = input; return new Promise((resolve, reject) => { finish = {resolve, reject}; }); }});
  const view = manager.start({project: {}, inputRevision: 'rev-1', requestId: 'r1'});
  assertParity('JobView', view);
  await nextTurn();
  execution.onEvent({stage: 'iteration', iteration: 1});
  const page = manager.events(view.jobId);
  assertParity('JobEventsPage', page);
  assertParity('JobEvent', page.events[0]);
  assertParity('JobEvent', page.events.find(e => e.type === 'progress'));
  assertParity('JobListPage', manager.list());
  assertParity('JobView', manager.list().jobs[0]);
  assertParity('JobEventRetention', view.eventRetention);
  finish.reject(analysisError('ANALYSIS_SOLVE_FAILED', 'Solve failed', {stage: 'solve'}));
  await manager.drain();
  const failed = manager.get(view.jobId);
  assert.equal(failed.state, 'failed');
  assertParity('JobErrorRecord', failed.error);
  assertParity('AnalysisFailure', failed.error.failure);
  assertParity('JobReleaseResult', manager.release(view.jobId));
  const states = source['src/contracts/job.d.ts'];
  for (const s of [view.state, failed.state]) assert.ok(states.includes(`'${s}'`), s);
  const second = manager.start({project: {}, inputRevision: 'rev-2'});
  await nextTurn();
  assertParity('JobCancelResult', manager.cancel(second.jobId));
  finish.resolve({ignored: true});
  await manager.drain();
  manager.close();
});

const caseOutput = () => ({input: {version: 1, meshes: [{positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], faceIds: [0]}], conditions: []}, calculation: {operation: 'elastic', options: {size: 5, method: 'pcg', adaptive: false, maxRounds: 3}}, mesh: {nodes: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], tetrahedra: [[0, 1, 2, 3]], surface: [{nodes: [0, 1, 2]}]}, result: {kind: 'elastic', maxDisplacementMm: .04, maxVonMisesPa: 1e6, displacement: Array(12).fill(0), magnitudes: Array(4).fill(0), vonMises: [0]}});

test('contract parity: runtime identity, case rows and comparison response', async () => {
  const store = createCaseStore(), recorded = caseOutput();
  recorded.calculation.runtimeIdentity = createRuntimeIdentity({target: 'node', isolation: 'process', requestedMethod: 'pcg', actualEngine: 'pcg'});
  store.add('A', recorded); store.add('B', caseOutput());
  let n = 0;
  const api = createCaseOperations({store, id: () => String(++n)});
  const list = await api.list();
  assertParity('CaseListResponse', list);
  for (const row of list.cases) assertParity('CaseRow', row);
  assertParity('RuntimeIdentity', list.cases[0].runtimeIdentity);
  assertParity('CaseMetric', list.cases[0].metrics[0]);
  const comparison = createCaseComparisonApi({cases: api});
  const reference = row => ({caseId: row.caseId, expectedRevision: row.revision, field: 'displacement'});
  const response = await comparison.compare({references: list.cases.map(reference)});
  assertParity('CaseComparisonResponse', response);
  assertParity('CaseComparisonRow', response.references[0]);
  assertParity('CaseComparisonReference', {...reference(list.cases[0])});
  assertParity('CaseComparisonResult', response.comparison);
  const sampled = await comparison.compare({references: list.cases.map(reference), point: [.1, .1, .1]});
  assertParity('CaseComparisonResult', sampled.comparison);
  assertParity('CaseComparisonResponse', sampled);
  assert.match(list.archiveRevision, /^sha256:[a-f0-9]{64}$/);
});
