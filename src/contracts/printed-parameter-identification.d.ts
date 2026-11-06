/** Work order 101: small-strain parameter identification from validator-accepted dataset JSON. Never calibrated. */
export type PrintedIdentificationModel = 'linear-elastic' | 'bilinear-elastic-plastic' | 'sls-relaxation';
export interface PrintedIdentificationCommonOptions { maxStrain: number; minPoints: number; maxRelativeStandardError: number }
/** Model-specific thresholds must be supplied explicitly; unrelated model fields are refused at runtime. */
export type PrintedIdentificationOptions = PrintedIdentificationCommonOptions & (
 | { model: 'linear-elastic'; maxTangentRatio?: never; holdStrainTolerance?: never }
 | { model: 'bilinear-elastic-plastic'; maxTangentRatio: number; holdStrainTolerance?: never }
 | { model: 'sls-relaxation'; holdStrainTolerance: number; maxTangentRatio?: never }
);
export interface PrintedIdentifiedParameter { value: number; standardError: number; relativeStandardError: number }
export type PrintedSpecimenIdentification = { specimen: string; identified: true; points: number; parameters: Record<string, PrintedIdentifiedParameter>; rSquared: number; residualRmsPa: number; [extra: string]: unknown } | { specimen: string; identified: false; reason: string; [extra: string]: unknown };
export interface PrintedIdentificationResult { identificationVersion: 1; model: PrintedIdentificationModel; options: PrintedIdentificationOptions; dataset: { id: string; revision: string; provenance: 'synthetic' | 'measured'; sourceSha256: string }; calibrated: false; accuracyVerified: false; identified: boolean; specimens: PrintedSpecimenIdentification[]; across: Record<string, { mean: number; sampleStandardDeviation: number; specimens: number }> | null }

export declare const PRINTED_IDENTIFICATION_LIMITS: Readonly<{bilinearPoints: 512}>;
export declare const PRINTED_IDENTIFICATION_VERSION: 1;
export declare const PRINTED_IDENTIFICATION_MODELS: readonly ['linear-elastic', 'bilinear-elastic-plastic', 'sls-relaxation'];
/** Validate the original dataset JSON and identify the requested model. Does not calibrate or apply a material. */
export declare function identifyPrintedParameters(rawDatasetJson: string, identificationOptions: PrintedIdentificationOptions): Promise<PrintedIdentificationResult>;
