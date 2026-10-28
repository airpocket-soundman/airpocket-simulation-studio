/** Work order 86: link from dataset specimens to specimen plans re-read from 3MF. Separate input; dataset contract unchanged. */
export interface PrintedSpecimenLink { datasetSpecimenId: string; specimenId: string; specimenVersion: number; planSha256: string }
export interface PrintedSpecimenLinkTolerance { dimensionMm: number }
export type PrintedSpecimenLinkFindingCode = 'link-without-dataset-specimen' | 'dataset-specimen-unlinked' | 'specimen-plan-missing' | 'plan-hash-mismatch' | 'cross-section-mismatch' | 'parallel-length-mismatch' | 'gauge-exceeds-parallel-section' | 'build-direction-mismatch';
export interface PrintedSpecimenLinkResult { linkVersion: 1; compatible: boolean; printVerified: false; findings: Array<{code: PrintedSpecimenLinkFindingCode; specimen: string}> }
