// Shared contract: analysis job status and events.
// Derived strictly from src/analysis-jobs.js (createAnalysisJobs) and src/job-event-payload.js.
// Parity with runtime output is checked by tests/contracts.test.mjs.
import type {JobErrorRecord} from './diagnostics';

export type JobState = 'running' | 'saving' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
export type JobTerminalState = 'succeeded' | 'failed' | 'cancelled' | 'timed_out';
export type JobOperation = 'mesh' | 'elastic';
export type JobOrigin = 'gui' | 'api';
export type JobResourceState = 'pending' | 'settled';
export type JobEventType = 'state' | 'progress' | 'execution-error' | 'resource-state';

export interface JobEventPayloadLimits {
  eventBytes: 32768;
  retainedBytes: 1048576;
  pageBytes: 65536;
  viewBytes: 24576;
  messageChars: 2048;
}

export interface JobEventRetention {
  maxEvents: number;
  maxEventBytes: number;
  maxRetainedBytes: number;
  maxPageBytes: number;
  maxViewBytes: number;
  retainedEvents: number;
  retainedBytes: number;
}

export interface JobViewOmission { field: string; reason: string }

/** Detached, byte-bounded view returned by start/get/list/cancel and embedded in event pages. */
export interface JobView {
  schemaVersion: 1;
  jobId: string;
  inputRevision: string;
  state: JobState;
  executionSettled: boolean;
  resourceState: JobResourceState;
  releaseAllowed: boolean;
  operation: JobOperation;
  origin: JobOrigin;
  startedAt: number;
  updatedAt: number;
  lastSequence: number;
  firstAvailableSequence: number;
  eventRetention: JobEventRetention;
  /** Summarized; absent in list() rows and until the job succeeds. */
  result?: unknown;
  error?: JobErrorRecord;
  /** Set when the executor rejects after cancel/timeout. */
  executionError?: JobErrorRecord;
  viewOmissions?: JobViewOmission[];
}

/** Envelope fields are authoritative; remaining fields are the producer's bounded payload. */
export interface JobEvent {
  schemaVersion: 1;
  jobId: string;
  inputRevision: string;
  sequence: number;
  elapsedMs: number;
  type: JobEventType;
  executionSettled: boolean;
  resourceState: JobResourceState;
  releaseAllowed: boolean;
  /** state / resource-state events. */
  state?: JobState;
  error?: JobErrorRecord;
  executionError?: JobErrorRecord;
  /** Present on replaced events whose payload exceeded a limit. */
  stage?: string;
  provisional?: true;
  payloadOmitted?: true;
  gap?: {reason: string; originalStage?: string};
  [payloadField: string]: unknown;
}

export interface JobEventsPage extends JobView {
  events: JobEvent[];
  truncated: boolean;
  nextSequence: number;
  hasMore: boolean;
  eventPageBytes: number;
}

export interface JobListPage {
  jobs: JobView[];
  total: number;
  nextOffset: number | null;
}

export interface JobCancelResult extends JobView { cancelled: boolean }
export interface JobReleaseResult { jobId: string; released: true }
