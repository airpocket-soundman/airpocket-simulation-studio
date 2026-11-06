import type {PrintedIdentificationModel,PrintedIdentificationOptions} from './printed-parameter-identification.js';
export interface PrintedIdentificationExample {raw:string;options:PrintedIdentificationOptions;truth:Record<string,number>;formula:string}
/** Invented synthetic curves and visible toy conditions; never measured/calibrated material data. */
export declare function printedIdentificationExample(model:PrintedIdentificationModel):PrintedIdentificationExample;
