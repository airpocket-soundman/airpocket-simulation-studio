// Shared contract: case / result identity.
// Derived strictly from src/project-revision.js, src/runtime-identity.js, src/case-operations.js
// (list rows) and src/case-comparison.js (compare response). Declaration only.
// Parity with runtime output is checked by tests/contracts.test.mjs.

/** 'sha256:' + 64 lowercase hex of canonicalJson(value) (getProjectRevision). */
export type Revision = `sha256:${string}`;

export interface RuntimeIdentityBuildUnavailable { status: 'unavailable' }
export interface RuntimeIdentityBuildAvailable {
  status: 'available';
  version: string;
  /** 40 lowercase hex. */
  revision: string;
  dirty: boolean;
  sourceFingerprint: Revision;
}
export interface RuntimeIdentityAsset {
  role: 'kernel' | 'gmsh' | 'mfem';
  bytes: number;
  sha256: Revision;
  status: 'observed' | 'declared';
}
/** An absent identity on a record means a legacy record, never the current build. */
export interface RuntimeIdentity {
  schemaVersion: 1;
  target: 'browser' | 'node';
  /** browser => 'web-worker'; node => 'worker-thread' | 'process'. */
  isolation: 'web-worker' | 'worker-thread' | 'process';
  build: RuntimeIdentityBuildUnavailable | RuntimeIdentityBuildAvailable;
  engine: {requestedMethod: string | null; actualEngine: string | null};
  /** <= 16 entries. */
  assets: RuntimeIdentityAsset[];
}

export interface CaseMetric { key: string; unit: string; value: number }

export interface CaseAssessmentSummary { mode: string; provisional: boolean; completePreflight: boolean }

/** One row of case list(). caseId is runtime-only and invalidated by external store changes. */
export interface CaseRow {
  caseId: string;
  revision: Revision;
  name: string;
  kind: string;
  metrics: CaseMetric[];
  runtimeIdentity?: RuntimeIdentity;
  analysisAssessment?: CaseAssessmentSummary;
}

export interface CaseListResponse {
  schemaVersion: 1;
  archiveRevision: Revision;
  cases: CaseRow[];
}

export interface CaseComparisonReference {
  caseId: string;
  expectedRevision: Revision;
  field: string;
  modeIndex?: number;
  frameIndex?: number;
  bodyIndex?: number;
  elementIndex?: number;
}

export interface CaseComparisonRequest {
  /** 1 to 8 references. */
  references: CaseComparisonReference[];
  point?: [number, number, number];
}

export interface CaseComparisonRow {
  reference: {caseId: string; expectedRevision: Revision};
  name: string;
  /** Revision of output.input / of the whole saved output. */
  inputRevision: Revision;
  resultRevision: Revision;
  kind: string;
  selection: {field: string; displayUnit?: string; [key: string]: unknown};
  /** Shapes of these summaries are not yet part of the contract. */
  calculation: unknown;
  mesh: unknown;
  runtimeIdentity?: RuntimeIdentity;
  analysisAssessment?: unknown;
  [pointFields: string]: unknown;
}

export interface CaseComparisonResult {
  comparable: boolean;
  /** Absent when no point was requested. */
  baselineCaseId?: string;
  basis?: string;
  reasons: Array<{code: string; caseId?: string}>;
  deltas: Array<{caseId: string; units: unknown; values: {[key: string]: unknown}; [key: string]: unknown}>;
}

export interface CaseComparisonResponse {
  schemaVersion: 1;
  point?: [number, number, number];
  references: CaseComparisonRow[];
  comparison: CaseComparisonResult;
  bounds: {maxReferences: 8; maxResponseBytes: number};
}
