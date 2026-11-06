import {identifyPrintedParameters, PRINTED_IDENTIFICATION_VERSION, PRINTED_IDENTIFICATION_MODELS, PRINTED_IDENTIFICATION_LIMITS} from '../../src/printed-parameter-identification.js';
import type {PrintedIdentificationOptions, PrintedIdentificationResult} from '../../src/printed-parameter-identification.js';

const thresholds = {maxStrain: .02, minPoints: 3, maxRelativeStandardError: .1};
const linear: PrintedIdentificationOptions = {...thresholds, model: 'linear-elastic'};
const bilinear: PrintedIdentificationOptions = {...thresholds, model: 'bilinear-elastic-plastic', maxTangentRatio: .5};
const relaxation: PrintedIdentificationOptions = {...thresholds, model: 'sls-relaxation', holdStrainTolerance: .001};
const results: Promise<PrintedIdentificationResult>[] = [linear, bilinear, relaxation].map(options => identifyPrintedParameters('{}', options));
const version: 1 = PRINTED_IDENTIFICATION_VERSION;
const model: 'bilinear-elastic-plastic' = PRINTED_IDENTIFICATION_MODELS[1];
const cap: 512 = PRINTED_IDENTIFICATION_LIMITS.bilinearPoints;
void results; void version; void model; void cap;

// @ts-expect-error bilinear identification needs its explicit positive tangent-ratio threshold
const missingTangent: PrintedIdentificationOptions = {...thresholds, model: 'bilinear-elastic-plastic'};
// @ts-expect-error relaxation identification needs its explicit held-strain tolerance
const missingHold: PrintedIdentificationOptions = {...thresholds, model: 'sls-relaxation'};
// @ts-expect-error linear identification must not silently ignore a relaxation-only setting
const foreignSetting: PrintedIdentificationOptions = {...thresholds, model: 'linear-elastic', holdStrainTolerance: .001};
// @ts-expect-error bilinear identification must not accept relaxation-only settings
const combinedModels: PrintedIdentificationOptions = {...thresholds, model: 'bilinear-elastic-plastic', maxTangentRatio: .5, holdStrainTolerance: .001};
// @ts-expect-error raw source JSON is required, rather than a normalized dataset object
identifyPrintedParameters({schemaVersion: 1}, linear);
identifyPrintedParameters('{}', linear).then(report => {
 const calibrated: false = report.calibrated;
 const accuracy: false = report.accuracyVerified;
 const source: string = report.dataset.sourceSha256;
 void calibrated; void accuracy; void source;
 // @ts-expect-error identification never returns an applied material or live project state
 report.appliedMaterial;
});
