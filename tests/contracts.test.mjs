import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createAnalysisJobs} from '../src/analysis-jobs.js';
import {normalizeJobError} from '../src/job-event-payload.js';
import {analysisError, createAnalysisFailure} from '../src/analysis-failure.js';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createCaseComparisonApi} from '../src/case-comparison.js';
import {createRuntimeIdentity} from '../src/runtime-identity.js';
import {createStudioApi} from '../src/studio-api.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {validateMaterialProperties} from '../src/materials.js';
import {inspectThermalInputContract} from '../src/thermal-input-contract.js';
import {inspectThermalStressInputContract} from '../src/thermal-stress-input-contract.js';

// Structural parity between the declared interfaces (src/contracts/*.d.ts) and real runtime output:
//  - every declared required field is present at runtime;
//  - runtime top-level keys are declared (interfaces with an index signature instead must stay inside the
//    pinned INDEXED_EXTRAS list below, so new payload fields become a visible, reviewed change);
//  - values of declared fields satisfy their declared type when that type is checkable (string/number/boolean/
//    null/literal unions, aliases of those, template literals such as sha256:..., arrays of them); object,
//    interface and 'unknown' types are NOT checked;
//  - every declared optional field must be observed in at least one parity sample, or be listed in
//    OPTIONAL_NOT_OBSERVED with a reason (a listed field that is observed fails, so the list cannot rot).
const files = ['diagnostics', 'job', 'case', 'project-input', 'index'].map(n => `src/contracts/${n}.d.ts`);
const source = Object.fromEntries(files.map(f => [f, existsSync(f) ? readFileSync(f, 'utf8') : '']));
const all = Object.values(source).join('\n');
const allNoComments = all.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const aliases = new Map();
for (const m of allNoComments.matchAll(/export type (\w+)\s*=\s*([^;]+);/g)) aliases.set(m[1], m[2].trim());

function splitTop(text, sep) {
  const parts = [];
  let cur = '', nest = 0;
  for (const ch of text) {
    if ('{[(<'.includes(ch)) nest++; else if ('}])>'.includes(ch)) nest--;
    if (nest === 0 && ch === sep) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

// true: value satisfies the type; false: provably violates it; null: type not checkable here.
function matches(type, value, depth = 0) {
  if (depth > 8) return null;
  let unknown = false;
  for (let alt of splitTop(type.trim(), '|')) {
    alt = alt.trim();
    if (!alt) continue;
    let r = null, m;
    if (/^'[^']*'$/.test(alt)) r = value === alt.slice(1, -1);
    else if (/^-?\d+(\.\d+)?$/.test(alt)) r = value === Number(alt);
    else if (alt === 'true' || alt === 'false') r = value === (alt === 'true');
    else if (alt === 'null') r = value === null;
    else if (alt === 'string' || alt === 'number' || alt === 'boolean') r = typeof value === alt;
    else if (alt === 'unknown') r = true;
    else if (alt.startsWith('`')) r = typeof value === 'string' && new RegExp('^' + alt.slice(1, -1).replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/\$\{string\}/g, '.*') + '$').test(value);
    else if ((m = /^(.+)\[\]$/.exec(alt) || /^Array<(.+)>$/.exec(alt))) r = Array.isArray(value) && value.every(e => matches(m[1], e, depth + 1) !== false);
    else if (aliases.has(alt)) r = matches(aliases.get(alt), value, depth + 1);
    if (r === true) return true;
    if (r === null) unknown = true;
  }
  return unknown ? null : false;
}

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
    const m = /^(?:readonly )?([A-Za-z_$][\w$]*)(\?)?:\s*(.*)$/.exec(member);
    if (m) fields.set(m[1], {optional: !!m[2], type: m[3].trim(), owner: name});
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

// Interfaces with an index signature: the extra runtime keys that are known and reviewed.
const INDEXED_EXTRAS = {
  JobEvent: ['iteration'],
  CaseComparisonRow: [],
};
// Optional fields never exercised by any parity sample, with the honest reason.
const OPTIONAL_NOT_OBSERVED = {
  'CaseComparisonReference.modeIndex': 'Request-side selector; the sample case has no modal/transient/rigid-body/element result to select, and a hand-built request object is not runtime output.',
  'CaseComparisonReference.frameIndex': 'Request-side selector; no transient result in the sample case.',
  'CaseComparisonReference.bodyIndex': 'Request-side selector; no rigid-body result in the sample case.',
  'CaseComparisonReference.elementIndex': 'Request-side selector; no per-element result in the sample case.',
  'CaseRow.analysisAssessment': 'Needs a saved case that carries an analysisAssessment from a real preflight run; the minimal sample output has none.',
  'JobView.viewOmissions': 'Only produced when a view exceeds its 24 KiB byte budget; exercised in the job-event-payload tests, not in this parity sample.',
};
const observed = new Set(); // 'Owner.field' once seen on any sample
const checked = new Set(); // interfaces that went through assertParity
const extras = new Map(); // indexed interface -> Set of extra keys seen

function assertParity(name, value) {
  const {fields, indexed} = declared(name);
  assert.ok(value && typeof value === 'object', `${name}: runtime value`);
  checked.add(name);
  for (const [key, {optional}] of fields) if (!optional) assert.ok(Object.hasOwn(value, key), `${name}.${key} is declared required but missing at runtime`);
  for (const [key, field] of fields) {
    if (!Object.hasOwn(value, key) || value[key] === undefined) continue;
    observed.add(`${field.owner}.${key}`);
    assert.notEqual(matches(field.type, value[key]), false, `${name}.${key} = ${JSON.stringify(value[key])} violates declared type ${field.type}`);
  }
  for (const key of Object.keys(value)) {
    if (fields.has(key)) continue;
    if (!indexed) assert.fail(`${name}.${key} exists at runtime but is not declared in src/contracts`);
    if (!extras.has(name)) extras.set(name, new Set());
    extras.get(name).add(key);
    assert.ok((INDEXED_EXTRAS[name] || []).includes(key), `${name}.${key} is an undeclared extra key on an index-signature interface; add it to INDEXED_EXTRAS (reviewed) or declare it`);
  }
  return fields;
}

function assertInUnion(typeName, value) {
  assert.ok(aliases.has(typeName), typeName + ' must be a declared type alias');
  assert.equal(matches(typeName, value), true, `${JSON.stringify(value)} is not a member of ${typeName}`);
}

test('contract declaration files exist and export the documented names', () => {
  for (const f of files) assert.ok(existsSync(f), f + ' must exist');
  for (const name of ['AnalysisFailure', 'AnalysisDiagnostic', 'JobErrorRecord', 'JobView', 'JobEvent', 'JobEventsPage', 'JobListPage', 'RuntimeIdentity', 'CaseRow', 'CaseListResponse', 'CaseComparisonReference', 'CaseComparisonResponse', 'SavedProjectBase', 'SavedProject', 'ProjectMesh', 'ProjectCondition', 'MaterialProperties', 'ProjectUnits']) declared(name);
  for (const mod of ['diagnostics', 'job', 'case', 'project-input']) assert.match(source['src/contracts/index.d.ts'], new RegExp(`from './${mod}'`));
});

test('the type matcher accepts members and rejects violations (self-test of the parity harness)', () => {
  assert.equal(matches("'a' | 'b'", 'a'), true);
  assert.equal(matches("'a' | 'b'", 'c'), false);
  assert.equal(matches('string | null', null), true);
  assert.equal(matches('number', '1'), false);
  assert.equal(matches('1', 1), true);
  assert.equal(matches('true', false), false);
  assert.equal(matches('`sha256:${string}`', 'sha256:abc'), true);
  assert.equal(matches('`sha256:${string}`', 'md5:abc'), false);
  assert.equal(matches('string[]', ['a', 1]), false);
  assert.equal(matches('Foo', {}), null);
  assertInUnion('JobState', 'running');
  assert.throws(() => assertInUnion('JobState', 'bogus'));
  assert.throws(() => assertParity('JobReleaseResult', {jobId: 'x', released: false}), /violates declared type/);
  assert.throws(() => assertParity('JobReleaseResult', {jobId: 'x', released: true, extra: 1}), /not declared/);
  assert.throws(() => assertParity('JobReleaseResult', {released: true}), /declared required but missing/);
  assert.throws(() => assertParity('JobEvent', {schemaVersion: 1, jobId: 'j', inputRevision: 'r', sequence: 1, elapsedMs: 0, type: 'state', executionSettled: false, resourceState: 'pending', releaseAllowed: false, surprise: 1}), /undeclared extra key/);
  extras.clear(); // the deliberate violations above must not count as observations
  checked.delete('JobReleaseResult'); observed.delete('JobReleaseResult.jobId'); observed.delete('JobReleaseResult.released');
});

test('contract parity: analysis failure and diagnostic', () => {
  const error = analysisError('ANALYSIS_MESH_FAILED', 'Mesh failed', {stage: 'mesh', target: '/study', evidence: {a: 1}, suggestions: ['retry']});
  const failure = createAnalysisFailure(error);
  assertParity('AnalysisFailure', failure);
  assertParity('AnalysisDiagnostic', failure.diagnostics[0]);
  assert.equal(failure.schemaVersion, 1);
  assert.equal(failure.diagnostics[0].severity, 'error');
  assertInUnion('AnalysisStage', failure.stage);
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
  assertParity('JobView', failed);
  assertParity('JobErrorRecord', failed.error);
  assertParity('AnalysisFailure', failed.error.failure);
  for (const e of manager.events(view.jobId).events) assertParity('JobEvent', e);
  assertParity('JobReleaseResult', manager.release(view.jobId));
  for (const s of [view.state, failed.state]) assertInUnion('JobState', s);
  const second = manager.start({project: {}, inputRevision: 'rev-2'});
  await nextTurn();
  assertParity('JobCancelResult', manager.cancel(second.jobId));
  finish.reject(new Error('late executor failure after cancel'));
  await manager.drain();
  const cancelled = manager.get(second.jobId);
  assertInUnion('JobState', cancelled.state);
  assertParity('JobView', cancelled);
  assertParity('JobErrorRecord', cancelled.executionError);
  for (const e of manager.events(second.jobId).events) assertParity('JobEvent', e);
  const third = manager.start({project: {}, inputRevision: 'rev-3'});
  await nextTurn();
  execution.onEvent({stage: 'iteration', blob: 'x'.repeat(40000)});
  finish.resolve({summary: 'ok', iterations: 3});
  await manager.drain();
  const succeeded = manager.get(third.jobId);
  assert.equal(succeeded.state, 'succeeded');
  assertParity('JobView', succeeded);
  const gap = manager.events(third.jobId).events.find(e => e.payloadOmitted);
  assert.ok(gap, 'an oversize payload must be replaced by a gap event');
  assertParity('JobEvent', gap);
  manager.close();
});

test('contract parity: JobErrorRecord variants produced by normalizeJobError', () => {
  const failure = createAnalysisFailure(analysisError('ANALYSIS_SOLVE_FAILED', 'Solve failed', {stage: 'solve'}));
  const records = [
    normalizeJobError({code: 'JOB_FAILED', sourceCode: 'ANALYSIS_SOLVE_FAILED', message: 'boom', failure}),
    normalizeJobError({code: 'x'.repeat(100), sourceCode: 'y'.repeat(100), message: 'm'.repeat(3000), failure: {bad: 1}}),
    normalizeJobError({failureOmitted: true, failureOmissionReason: 'bytes', codeOmitted: true, sourceCodeOmitted: true, message: 'a', messageTruncated: true, originalMessageLength: 5000}),
    normalizeJobError(null),
  ];
  for (const record of records) assertParity('JobErrorRecord', record);
  assert.equal(records[1].messageTruncated, true);
  assert.equal(records[1].codeOmitted, true);
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

test('contract parity: saved project required envelope', () => {
  const project = createProjectFromBuiltin({source: {kind: 'box', bounds: [0, 0, 0, 1, 1, 1]}});
  assertParity('SavedProjectBase', {version: project.version, meshes: project.meshes, conditions: project.conditions});
});

test('project unit and material fixture examples stay aligned with runtime validators', () => {
  const fixture = readFileSync('tests/fixtures/contracts-types.ts', 'utf8');
  const declaredUnits = declared('ProjectUnits').fields;
  const runtimeUnits = {
    ...inspectThermalInputContract({conditions: [], materialProperties: {}, study: {kind: 'thermal'}}).units,
    ...inspectThermalStressInputContract({conditions: [], materialProperties: {}, study: {kind: 'structural'}}).units,
  };
  for (const [key, symbol] of Object.entries(runtimeUnits)) {
    const declaration = declaredUnits.get(key);
    if (!declaration) continue; // Only the represented subset is claimed here.
    assert.ok(declaration.type.split('|').some(part => part.trim() === `'${symbol}'`), `${key} runtime unit ${symbol} must be represented by ProjectUnits`);
  }

  assert.match(fixture, /youngModulus: 2e11/);
  assert.match(fixture, /poissonRatio: 0\.3/);
  assert.doesNotThrow(() => validateMaterialProperties({youngModulus: 2e11, poissonRatio: 0.3, dependence: {elasticTemperatureTable: [
    {temperature: 20, youngModulus: 2e11, poissonRatio: 0.3},
    {temperature: 100, youngModulus: 1.9e11, poissonRatio: 0.31},
  ]}}));
});

test('contract parity: spherical dimensions come from shared semantic runtime output',()=>{
  const api=createStudioApi();api.loadProject(createProjectFromBuiltin({source:{kind:'sphere',center:[0,0,0],radius:10}}));
  api.selectSphericalRegion(0,{exactCad:true,center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:.01,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90});
  assert.equal(declared('SavedProject').fields.get('sphericalRegion').type,'SphericalRegion');assertParity('SphericalRegion',api.exportProject().sphericalRegion);
  api.addCondition({type:'force',value:1,direction:[1,0,0]});assert.equal(declared('ProjectCondition').fields.get('sphericalRegion').type,'SphericalRegion');assertParity('SphericalRegion',api.exportProject().conditions[0].sphericalRegion);
});

// Must stay last: it summarises what the samples above actually exercised.
test('declared optional fields are exercised by a runtime sample or explicitly listed as not observed', () => {
  const unobserved = [];
  for (const name of checked) {
    for (const [key, field] of declared(name).fields) if (field.optional && !observed.has(`${field.owner}.${key}`)) unobserved.push(`${field.owner}.${key}`);
  }
  const unique = [...new Set(unobserved)].sort();
  const listed = Object.keys(OPTIONAL_NOT_OBSERVED).sort();
  assert.deepEqual(unique, listed, 'optional fields never seen at runtime must be listed (with a reason) in OPTIONAL_NOT_OBSERVED, and listed ones must really be unobserved');
  for (const [field, reason] of Object.entries(OPTIONAL_NOT_OBSERVED)) assert.ok(reason.length >= 10, field);
  for (const [name, keys] of Object.entries(INDEXED_EXTRAS)) for (const key of keys) assert.ok(extras.get(name)?.has(key), `INDEXED_EXTRAS.${name}.${key} was never observed; remove it`);
});
