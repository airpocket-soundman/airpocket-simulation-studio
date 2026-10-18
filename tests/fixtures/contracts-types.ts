import type {AnalysisDiagnostic} from '../../src/contracts/diagnostics';
import type {JobView} from '../../src/contracts/job';
import type {CaseRow, Revision} from '../../src/contracts/case';
import type {ProjectCondition, ProjectSource, ProjectUnits, SavedProject} from '../../src/contracts/project-input';
import type {MaterialDependence} from '../../src/contracts/project-input';

const revision: Revision = `sha256:${'a'.repeat(64)}`;

const job: JobView = {
  schemaVersion: 1,
  jobId: 'job-1',
  inputRevision: revision,
  state: 'running',
  executionSettled: false,
  resourceState: 'pending',
  releaseAllowed: false,
  operation: 'mesh',
  origin: 'api',
  startedAt: 1,
  updatedAt: 1,
  lastSequence: 0,
  firstAvailableSequence: 1,
  eventRetention: {
    maxEvents: 100,
    maxEventBytes: 1000,
    maxRetainedBytes: 10000,
    maxPageBytes: 1000,
    maxViewBytes: 500,
    retainedEvents: 0,
    retainedBytes: 0,
  },
};

const row: CaseRow = {
  caseId: 'case-1',
  revision,
  name: 'Baseline',
  kind: 'elastic',
  metrics: [{key: 'mass', unit: 'kg', value: 1}],
};

const diagnostic: AnalysisDiagnostic = {
  code: 'ANALYSIS_FAILED',
  severity: 'error',
  stage: 'solve',
  target: '/',
  message: 'Solver failed',
  evidence: {iterations: 1},
  suggestions: [],
  requiresUserIntent: false,
};

const savedProject: SavedProject = {
  version: 1,
  name: 'Cantilever reference',
  material: '金属',
  materialProperties: {
    youngModulus: 2e11,
    poissonRatio: 0.3,
    dependence: {elasticTemperatureTable: [
      {temperature: 20, youngModulus: 2e11, poissonRatio: 0.3},
      {temperature: 100, youngModulus: 1.9e11, poissonRatio: 0.31},
    ]},
  },
  study: {kind: 'structural', gravityEnabled: false, gravity: [0, 0, -9.80665]},
  sourceModel: {kind: 'box', bounds: [0, 0, 0, 10, 10, 40]},
  meshes: [{positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], faceIds: [7], kind: 'cad'}],
  conditions: [{type: 'fixed', value: 0, direction: [1, 0, 0], regions: [{mesh: 0, triangles: [0]}]}],
  selection: [[0]],
  units: {geometry: 'mm', youngModulus: 'Pa', poissonRatio: '1'},
  analysisIntent: {mode: 'quantitative'},
  inputProvenance: {schemaVersion: 1, entries: [{
    pointer: '/materialProperties/youngModulus', value: 2e11,
    source: {kind: 'measured-document', reference: 'material-test', revision: 'rev-1'},
    rationale: 'Measured input', assumption: null, applicability: 'Room temperature', status: 'confirmed',
  }]},
  meshSettings: {refinements: [{center: [5, 5, 20], size: 2, radius: 4}]},
};

// @ts-expect-error unknown job state must be rejected
const badState: JobView['state'] = 'queued';
// @ts-expect-error Revision must carry the sha256 prefix
const badRevision: Revision = 'revision-1';
// @ts-expect-error diagnostics only allow severity 'error'
const badSeverity: AnalysisDiagnostic['severity'] = 'warning';
// @ts-expect-error requiresUserIntent is a required diagnostic field
const missingRequiredDiagnosticField: AnalysisDiagnostic = {
  code: 'ANALYSIS_FAILED', severity: 'error', stage: 'solve', target: '/',
  message: 'Solver failed', evidence: {}, suggestions: [],
};
// @ts-expect-error requiresUserIntent must be a boolean
const undefinedRequiredDiagnosticField: AnalysisDiagnostic = {...diagnostic, requiresUserIntent: undefined};
// @ts-expect-error project version is fixed by the saved project contract
const badProjectVersion: SavedProject['version'] = 2;
// @ts-expect-error a source model must use a saved-project source kind
const badSource: ProjectSource = {kind: 'torus'};
// @ts-expect-error fluid-domain validation rejects STL excluded solids
const badFluidDomainStl: ProjectSource = {kind: 'fluidDomain', solid: {kind: 'stl', positions: []}, enclosure: [0, 0, 0, 1, 1, 1]};
// @ts-expect-error validateMaterialDependence rejects unknown keys
const badMaterialDependence: MaterialDependence = {elasticTemperatureTable: [], temperatureOffset: 10};
// @ts-expect-error condition types are restricted to saved boundary types
const badCondition: ProjectCondition['type'] = 'heatFluxDensity';
// @ts-expect-error project units are paired with their documented symbols
const badUnit: ProjectUnits['geometry'] = 'm';

void [job, row, diagnostic, savedProject, badState, badRevision, badSeverity, missingRequiredDiagnosticField, undefinedRequiredDiagnosticField, badProjectVersion, badSource, badFluidDomainStl, badMaterialDependence, badCondition, badUnit];

const cappedFluidSource: ProjectSource = {kind: 'fluidDomain', solid: {kind: 'cylinder'}, mode: 'internal', enclosure: [-20, -40, -20, 40, 80, 40], seedPoint: [0, 0, 0], portPlanes: [], openingCaps: [{id: 'inlet', point: [0, -10, 0], normal: [0, -1, 0]}]};
// @ts-expect-error cap normals must have exactly three coordinates.
const badCapNormal: ProjectSource = {kind: 'fluidDomain', solid: {kind: 'cylinder'}, enclosure: [-20, -40, -20, 40, 80, 40], openingCaps: [{id: 'inlet', point: [0, -10, 0], normal: [0, -1]}]};
void [cappedFluidSource, badCapNormal];
