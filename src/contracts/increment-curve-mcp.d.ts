/** Saved-file tool only; no live browser permission is granted by this contract. */
export interface IncrementCurveMcpRequest {
 path: string;
 outputPath?: string;
 /** Zero-based row offset; runtime checks safe integer and total rows. */
 offset?: number;
 /** Runtime range 1..50; default 20. */
 limit?: number;
}
export interface IncrementCurveArtifactDescriptor {
 bytes: number;
 /** Lowercase raw UTF-8 SHA-256, without a prefix. */
 sha256: string;
 encoding: 'utf-8';
}
export interface IncrementCurveMcpRow {
 stepIndex: number;
 stepId: string;
 controlledQuantity: 'force';
 controlledValue: number;
 controlledUnit: 'N';
 converged: boolean;
 provisional: boolean;
 status: 'converged' | 'failed';
 [key: string]: unknown;
}
/** Serialized tool data value <=64 KiB UTF-8 JSON; duplicated MCP representations and JSON-RPC envelope are separate. */
export interface IncrementCurveMcpSingleResult {
 schemaVersion: 1;
 kind: 'increment-curve';
 source: {path: string; bytes: number; sha256: string; meaning: 'raw-utf8-input-snapshot'};
 curve: {schemaVersion: 1; curveId: string; inputRevision: string; meshRevision: string; analysis: {kind: 'independent-linear-solves'; plasticHistory: false}; [key: string]: unknown};
 page: {offset: number; limit: number; total: number; nextOffset: number | null; steps: IncrementCurveMcpRow[]};
 artifacts: Record<'csv' | 'json' | 'svg', IncrementCurveArtifactDescriptor>;
 /** responseBytes applies to JSON.stringify(this value), not the complete MCP response. */
 limits: {inputBytes: number; responseBytes: number; artifactBytes: number; bundleBytes: number; rows: number};
 limitations: string[];
 outputPath?: string;
 outputBytes?: number;
 outputSha256?: string;
 cleanupWarning?: {code: 'ARTIFACT_TEMP_CLEANUP_FAILED'; path?: string; pathPreview?: string; pathOmitted?: true; message: string; detailsTruncated: boolean};
}


/** Same tool and request arguments, selected by a strict {bundles:[...]} file. */
export interface IncrementCurveMcpComparisonResult extends Omit<IncrementCurveMcpSingleResult, 'kind' | 'curve' | 'page' | 'limits'> {
 kind: 'increment-curve-comparison';
 comparison: {schemaVersion: 1; kind: 'increment-curve-comparison'; analysis: {kind: 'independent-linear-solves'; plasticHistory: false}; units: {extensionMm: 'mm'; forceN: 'N'; engineeringStrain: 'dimensionless'; engineeringStressPa: 'Pa'}};
 requestedOffset: number;
 pages: Array<{curveIndex: number; curveId: string; curve: IncrementCurveMcpSingleResult['curve']; page: IncrementCurveMcpSingleResult['page']}>;
 limits: IncrementCurveMcpSingleResult['limits'] & {perBundleInputBytes: number; curves: number};
}
export type IncrementCurveMcpResult = IncrementCurveMcpSingleResult | IncrementCurveMcpComparisonResult;
