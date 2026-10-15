// Shared contract: analysis failure / diagnostic metadata.
// Derived strictly from src/analysis-failure.js (validateDiagnostic / validateFailure) and
// src/job-event-payload.js (normalizeJobError). Declaration only; no compiler is part of the build.
// Parity with runtime output is checked by tests/contracts.test.mjs.

export type AnalysisStage =
  | 'preparation' | 'mesh' | 'boundary-transfer' | 'constraints' | 'temperature-transfer'
  | 'material-evaluation' | 'solve' | 'postprocess' | 'unknown';

/** JSON-safe evidence: depth <= 4, <= 16 keys per object/array, strings <= 400 chars, <= 256 nodes. */
export type AnalysisEvidence = { [key: string]: AnalysisEvidenceValue };
export type AnalysisEvidenceValue = null | boolean | number | string | AnalysisEvidenceValue[] | AnalysisEvidence;

export interface AnalysisDiagnostic {
  /** /^ANALYSIS_[A-Z0-9_]+$/, <= 96 chars. */
  code: string;
  severity: 'error';
  stage: AnalysisStage;
  /** <= 300 chars; defaults to '/'. */
  target: string;
  /** <= 2000 chars. */
  message: string;
  evidence: AnalysisEvidence;
  /** <= 6 entries, each <= 300 chars. */
  suggestions: string[];
  requiresUserIntent: boolean;
}

/** Serialized form is <= 16384 bytes. diagnostics[0] repeats code/stage/message. */
export interface AnalysisFailure {
  schemaVersion: 1;
  code: string;
  stage: AnalysisStage;
  message: string;
  /** 1 to 8 entries. */
  diagnostics: AnalysisDiagnostic[];
}

export type JobErrorOmissionReason =
  | 'bytes' | 'structure-limit' | 'non-finite' | 'cycle' | 'accessor' | 'unsupported-type' | 'view-bytes';

/** Bounded error record carried by job views and events (normalizeJobError). */
export interface JobErrorRecord {
  /** e.g. JOB_TIMEOUT, JOB_CANCELLED, JOB_FAILED, JOB_EXECUTION_REJECTED_AFTER_TERMINAL. */
  code?: string;
  sourceCode?: string;
  codeOmitted?: true;
  sourceCodeOmitted?: true;
  message: string;
  messageUnavailable?: true;
  messageTruncated?: true;
  originalMessageLength?: number;
  failure?: AnalysisFailure;
  failureOmitted?: true;
  failureOmissionReason?: JobErrorOmissionReason;
}
