import type {PrintedIdentificationOptions,PrintedIdentificationModel,PrintedIdentifiedParameter} from './printed-parameter-identification.js';
export interface PrintedHoldoutPair {readonly trainingSpecimenId:string;readonly validationSpecimenId:string}
export interface PrintedHoldoutInput {
 readonly rawTraining:string;readonly rawValidation:string;readonly options:PrintedIdentificationOptions;readonly specimenPairs:readonly PrintedHoldoutPair[];
}
export interface PrintedHoldoutSource {readonly id:string;readonly revision:string;readonly provenance:'synthetic'|'measured';readonly sourceSha256:string;readonly specimens:number;readonly samples:number}
export interface PrintedHoldoutSample {readonly timeSeconds:number;readonly engineeringStrain:number;readonly observedStressPa:number;readonly predictedStressPa:number;readonly residualPa:number}
export interface PrintedHoldoutMetrics {readonly count:number;readonly biasPa:number;readonly meanAbsoluteErrorPa:number;readonly rootMeanSquareErrorPa:number;readonly maximumAbsoluteErrorPa:number}
export type PrintedHoldoutPairResult = PrintedHoldoutPair & (
 | {readonly status:'compared';readonly trainingPoints:number;readonly parameters:Readonly<Record<string,Readonly<PrintedIdentifiedParameter>>>;readonly metrics:PrintedHoldoutMetrics;readonly samples:readonly PrintedHoldoutSample[]}
 | {readonly status:'refused';readonly reason:'training-not-identified'|'nonfinite-prediction-or-error'|'nonfinite-error-statistics';readonly identificationReason?:string}
);
/** Compared means errors were computed, never that accuracy passed. All sources remain uncalibrated and physically unverified. */
export interface PrintedHoldoutResult {
 readonly holdoutVersion:1;readonly model:PrintedIdentificationModel;readonly options:Readonly<PrintedIdentificationOptions>;
 readonly training:PrintedHoldoutSource;readonly validation:PrintedHoldoutSource;
 readonly independence:'declared-only';readonly physicalIndependenceVerified:false;readonly calibrated:false;readonly accuracyVerified:false;
 readonly recordedConditions:'exact-normalized-match-including-batch';readonly residualConvention:'prediction-minus-observation';
 readonly protocol:'declared-ideal-step-at-first-held-sample'|'strictly-increasing-nonnegative-loading';readonly extrapolation:false;
 readonly summary:{readonly pairs:number;readonly compared:number;readonly refused:number};readonly pairs:readonly PrintedHoldoutPairResult[];
}
export declare const PRINTED_HOLDOUT_LIMITS:Readonly<{datasetBytes:2000000;pairs:100;totalSamples:10000;resultBytes:4000000}>;
/** Complete one-to-one disjoint specimen mapping, matching recorded conditions, no extrapolation or validation refit. */
export declare function comparePrintedHoldoutPrediction(input:PrintedHoldoutInput):Promise<PrintedHoldoutResult>;
