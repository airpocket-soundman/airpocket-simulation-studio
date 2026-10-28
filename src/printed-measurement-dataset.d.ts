import type {PrintedMeasurementNormalized} from './contracts/printed-measurement-dataset';
export declare const PRINTED_DATASET_LIMITS: Readonly<{bytes: 2000000; specimens: 100; samples: 10000}>;
export declare function importPrintedMeasurementDataset(raw: string): Promise<PrintedMeasurementNormalized>;
/** Validates unknown saved material properties before reading their dataset references. */
export declare function importPrintedEquivalentDatasets(properties: unknown, rawDatasets: string[]): Promise<PrintedMeasurementNormalized[]>;
