import type {AnalysisDiagnostic} from '../../src/contracts/diagnostics';
import type {JobView} from '../../src/contracts/job';
import type {CaseRow, Revision} from '../../src/contracts/case';

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

void [job, row, diagnostic, badState, badRevision, badSeverity, missingRequiredDiagnosticField, undefinedRequiredDiagnosticField];
