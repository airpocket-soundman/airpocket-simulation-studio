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

import type {IncrementCurveMcpRequest, IncrementCurveMcpRow} from '../../src/contracts/increment-curve-mcp';
const curveRequest: IncrementCurveMcpRequest = {path: '/absolute/bundle.json', offset: 0, limit: 20};
// @ts-expect-error pagination limit must be numeric
const badCurveRequest: IncrementCurveMcpRequest = {path: '/absolute/bundle.json', limit: '50'};
// @ts-expect-error the bounded curve tool does not expose temperature control
const badCurveControl: IncrementCurveMcpRow['controlledQuantity'] = 'temperature';
void [curveRequest, badCurveRequest, badCurveControl];

import type {IncrementCurveMcpResult} from '../../src/contracts/increment-curve-mcp';
function curveResponseKind(value: IncrementCurveMcpResult) {
 if(value.kind === 'increment-curve-comparison') {
  const offset: number = value.requestedOffset;
  const curves: number = value.pages.length;
  // @ts-expect-error comparison has per-curve pages rather than a single page
  value.page;
  return offset + curves;
 }
 const total: number = value.page.total;
 // @ts-expect-error the single-curve response has no comparison pages
 value.pages;
 return total;
}
void curveResponseKind;

// Exercise the Node-only ACP session API declaration through the normal contract gate.
import './acp-session-types';
import './agent-chat-types';
import './retained-opening-surface-types';
import './finite-visco-observation-comparison-types';

import type {FixedWebmContainer,FixedWebmVerification,ComparisonFixedWebmCapability} from '../../src/contracts/fixed-webm';
const fixedWebmContainer:FixedWebmContainer={width:1280,height:640,seconds:2,packets:[{timestamp:0,duration:41667,type:'key',data:new Uint8Array(1)}]};
const fixedWebmProof:FixedWebmVerification={schemaVersion:1,codec:'vp8',frameCount:48,encodedFrameCount:48,decodedFrameCount:48,terminalTimestamp:1958333,totalDurationMicroseconds:2000000,verification:'strict-webm-demux+video-decoder'};
const fixedWebmCapability:ComparisonFixedWebmCapability={supported:true,recording:'fixed-frame',codec:'vp8',codecSupport:'checked-at-export',maxFrames:120,maxArtifactBytes:33554432};
// @ts-expect-error Delta frames are outside the constrained all-keyframe profile.
const invalidFixedPacket:FixedWebmContainer={width:16,height:16,seconds:1,packets:[{timestamp:0,duration:1,type:'delta',data:new Uint8Array(1)}]};
// @ts-expect-error MediaRecorder realtime must not masquerade as fixed-frame verification.
const invalidFixedProof:FixedWebmVerification={...fixedWebmProof,verification:'realtime'};
void [fixedWebmContainer,fixedWebmProof,fixedWebmCapability,invalidFixedPacket,invalidFixedProof];
// Resolve declarations from the public runtime .js import, not only the type directory.
import {fixedWebmSchedule,muxFixedWebm,demuxFixedWebm,FIXED_WEBM_LIMITS,fixedWebmError} from '../../src/fixed-webm.js';
const fixedRuntimeSchedule:number=fixedWebmSchedule(2)[0].timestamp;
const fixedRuntimeBytes:Uint8Array=muxFixedWebm(fixedWebmContainer);
const fixedRuntimeReload:FixedWebmContainer=demuxFixedWebm(fixedRuntimeBytes);
const fixedRuntimeLimit:120=FIXED_WEBM_LIMITS.frames;
const fixedRuntimeError:string=fixedWebmError('WEBM_FIXED_INVALID','invalid').code;
// @ts-expect-error Runtime imports must reject a string presentation duration.
fixedWebmSchedule('2');
void [fixedRuntimeSchedule,fixedRuntimeReload,fixedRuntimeLimit,fixedRuntimeError];
export {temperatureFixture} from './planar-temperature-operator-types';
export {groupedTemperatureFixture} from './grouped-temperature-operator-types';
import './single-orbit-gif-types';

import {createFiniteHistoryInspector as inspector203,FINITE_HISTORY_INSPECTOR_LIMITS as limits203} from '../../src/ui/finite-history-inspector.js';
import {inspectFiniteHistory as replay203} from '../../src/finite-visco-inspector.worker.js';
const ui203=inspector203({host:document.createElement('div')});const done203:Promise<boolean>=ui203.inspect();const cap203:4096=limits203.steps;
replay203('{}').then(report=>{if(report.completed){const stress203:number=report.summary.finalObservation.S[0][0];void stress203;/* @ts-expect-error issued state never crosses worker report */
report.finalState;} });void done203;void cap203;

import {syntheticFiniteObservationPair as pair204} from '../../src/ui/finite-history-inspector.js';
import {compareFiniteHistoryObservation as compare204} from '../../src/finite-visco-inspector.worker.js';
const p204=pair204();const uiCompare204:Promise<boolean>=ui203.compareObservation();const input204:HTMLTextAreaElement=ui203.observation;
compare204(p204.historyRaw,p204.observationRaw).then(r=>{if(r.completed){const s204:number=r.stress.signedDifference[0][0];void s204;/* @ts-expect-error comparisons never issue state */
r.finalState;}});void uiCompare204;void input204;
export {groupedP1HeatFixture} from './grouped-p1-heat-operator-types';
import './single-stored-time-gif-types';
import './single-deformation-gif-types';
import './single-slice-gif-types';
