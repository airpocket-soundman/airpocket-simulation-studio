/** Standalone PRINT2 import contract; does not add solver/project schema fields. */
export interface PrintedMeasurementInput {
 schemaVersion: 1; id: string; revision: string; provenance: 'synthetic' | 'measured';
 units: {length: 'mm' | 'm'; force: 'N' | 'kN'; time: 's'; temperature: 'degC'; speed: 'mm/s' | 'm/s'};
 instrument: {id: string; hardwareRevision: string; softwareRevision: string};
 calibration: {status: 'unverified' | 'reported'; forceEvidence: string | null; displacementEvidence: string | null; dimensionEvidence: string | null};
 specimens: Array<{id: string; dimensions: [number,number,number]; gaugeLength: number; buildDirection: [number,number,number]; batch: string; temperature: number; speed: number; displacementKind: 'gauge'; samples: Array<[number,number,number]>}>;
}
export interface PrintedMeasurementNormalized {
 normalizationVersion: 1; id: string; revision: string; provenance: 'synthetic' | 'measured'; sourceSha256: string; rawJson: string; accuracyVerified: false;
 instrument: PrintedMeasurementInput['instrument']; calibration: PrintedMeasurementInput['calibration'];
 specimens: Array<{id: string; dimensionsMm: number[]; gaugeLengthMm: number; buildDirection: number[]; batch: string; temperatureC: number; speedMmPerSecond: number; samples: Array<{timeS: number; forceN: number; displacementMm: number; engineeringStressPa: number; engineeringStrain: number}>}>;
}
