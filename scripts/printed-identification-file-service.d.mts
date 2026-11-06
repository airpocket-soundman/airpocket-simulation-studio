import type {PrintedIdentificationResult} from '../src/contracts/printed-parameter-identification';
export interface PrintedIdentificationFilePaths {dataset:string;options:string;output:string}
export interface PrintedInputIdentity {bytes:number;sha256:string}
export interface PrintedInputSnapshot {text:string;identity:PrintedInputIdentity}
export interface PrintedIdentificationFileArtifact {
 schemaVersion:1;kind:'printed-parameter-identification-file';status:'identified'|'refused';calibrated:false;accuracyVerified:false;
 inputs:{dataset:PrintedInputIdentity|null;options:PrintedInputIdentity|null};result:PrintedIdentificationResult|null;
 refusal:{code:string;stage:'read'|'validation'|'identification'|'fit'}|null;
}
export interface PrintedIdentificationFileSummary {
 schemaVersion:1;kind:'printed-identification-cli-summary';status:'identified'|'refused';identified:boolean;calibrated:false;accuracyVerified:false;
 output:string;outputBytes:number;outputSha256:string;refusalCode?:string;cleanupWarning?:{code:string;path:string;message:string};
}
export declare const PRINTED_IDENTIFICATION_FILE_LIMITS:Readonly<{datasetBytes:2000000;optionsBytes:16384;artifactBytes:524288;pathCharacters:4096;pathSegments:256}>;
export declare function parsePrintedIdentificationArgs(args:readonly string[]):PrintedIdentificationFilePaths;
export declare function writePrintedIdentificationFiles(request:PrintedIdentificationFilePaths):Promise<PrintedIdentificationFileSummary>;
/** Internal read-only evaluator shared by the single-file and bounded batch writers. */
export declare function evaluatePrintedIdentificationSnapshots(dataset:PrintedInputSnapshot,options:PrintedInputSnapshot):Promise<{result:PrintedIdentificationResult|null;refusal:PrintedIdentificationFileArtifact['refusal']}>;
export declare function printedIdentificationCliError(error:unknown):{schemaVersion:1;kind:'printed-identification-cli-summary';status:'error';code:string};
