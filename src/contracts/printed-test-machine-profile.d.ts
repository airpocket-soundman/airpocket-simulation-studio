export interface PrintedMachineProfileInput {
 schemaVersion: 1; id: string; revision: string; origin: 'diy' | 'vendor'; provenance: 'synthetic' | 'declared';
 units: {force: 'N' | 'kN'; length: 'mm' | 'm'; speed: 'mm/s' | 'm/s'};
 frame: {hardwareRevision: string; softwareRevision: string; modes: Array<'tension' | 'compression'>};
 loadCell: {ratedCapacity: number; model: string | null};
 displacementSources: Array<{id: string; kind: 'crosshead' | 'gauge'}>;
 fixtures: Array<{id: string; mode: 'tension' | 'compression'}>;
 limits: {enforcedBy: 'device'; force: number; stroke: number; speed: number};
 compliance: {status: 'unmeasured' | 'reported'; value: number | null; evidence: string | null};
 calibration: {status: 'unverified' | 'reported'; forceEvidence: string | null; displacementEvidence: string | null};
}
export interface PrintedMachineProfileNormalized {
 profileVersion: 1; id: string; revision: string; origin: 'diy' | 'vendor'; provenance: 'synthetic' | 'declared'; accuracyVerified: false;
 hardwareRevision: string; softwareRevision: string; modes: Array<'tension' | 'compression'>;
 ratedCapacityN: number; loadCellModel: string | null;
 displacementSources: PrintedMachineProfileInput['displacementSources']; fixtures: PrintedMachineProfileInput['fixtures'];
 limits: {forceN: number; strokeMm: number; speedMmPerSecond: number};
 compliance: {status: 'unmeasured' | 'reported'; mmPerN: number | null; evidence: string | null};
 calibration: PrintedMachineProfileInput['calibration'];
}
export type PrintedMachineFindingCode = 'instrument-id-mismatch' | 'hardware-revision-mismatch' | 'software-revision-mismatch' | 'dataset-calibration-without-profile-calibration' | 'no-gauge-displacement-source' | 'speed-above-device-limit' | 'force-above-device-stop' | 'tension-not-offered' | 'compression-not-offered';
export interface PrintedMachineDatasetCheck {compatible: boolean; accuracyVerified: false; findings: Array<{code: PrintedMachineFindingCode; specimen?: string}>}
export declare const PRINTED_MACHINE_PROFILE_VERSION: 1;
export declare function validatePrintedMachineProfile(profile: unknown): PrintedMachineProfileNormalized;
export declare function checkDatasetAgainstMachineProfile(profile: PrintedMachineProfileNormalized, dataset: import('./printed-measurement-dataset.js').PrintedMeasurementNormalized): PrintedMachineDatasetCheck;
