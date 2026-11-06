import type {PrintedHoldoutResult} from '../src/contracts/printed-parameter-holdout';
export interface PrintedHoldoutPaths {request:string;output:string}
export interface PrintedHoldoutFileSummary {schemaVersion:1;kind:'printed-holdout-cli-summary';status:'compared'|'refused';calibrated:false;accuracyVerified:false;physicalIndependenceVerified:false;output:string;outputBytes:number;outputSha256:string;refusalCode?:string}
export interface PrintedHoldoutArtifact {schemaVersion:1;kind:'printed-holdout-file';status:'compared'|'refused';calibrated:false;accuracyVerified:false;physicalIndependenceVerified:false;inputs:Readonly<Record<'request'|'training'|'validation',{bytes:number;sha256:string}|null>>;result:PrintedHoldoutResult|null;refusal:{code:string;stage:string}|null}
export declare const PRINTED_HOLDOUT_FILE_LIMITS:Readonly<{requestBytes:65536;datasetBytes:2000000;artifactBytes:4194304}>;
export declare function parsePrintedHoldoutArgs(args:readonly string[]):PrintedHoldoutPaths;
export declare function writePrintedHoldoutFiles(request:PrintedHoldoutPaths):Promise<PrintedHoldoutFileSummary>;
export declare function printedHoldoutCliError(error:unknown):{schemaVersion:1;kind:'printed-holdout-cli-summary';status:'error';code:string};
