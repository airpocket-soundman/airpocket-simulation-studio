import type {PrintedIdentificationResult} from '../src/contracts/printed-parameter-identification';
import type {PrintedInputIdentity} from './printed-identification-file-service.mjs';
export interface PrintedBatchPaths {manifest:string;output:string}
export interface PrintedBatchSource {path:string;expectedSHA256:string}
export interface PrintedBatchManifest {schemaVersion:1;entries:readonly {id:string;dataset:PrintedBatchSource;options:PrintedBatchSource}[]}
export interface PrintedBatchEntry {
 id:string;status:'identified'|'refused';inputs:{dataset:{expectedSHA256:string;actual:PrintedInputIdentity|null};options:{expectedSHA256:string;actual:PrintedInputIdentity|null}};
 result:PrintedIdentificationResult|null;refusal:{code:string;stage:'read'|'validation'|'identification'|'fit'|'preflight'}|null;
}
export interface PrintedBatchArtifact {
 schemaVersion:1;kind:'printed-parameter-identification-batch';status:'identified'|'refused';calibrated:false;accuracyVerified:false;
 manifest:PrintedInputIdentity|null;entries:PrintedBatchEntry[];refusal:{code:string;stage:'manifest'|'preflight'|'snapshot'}|null;
}
export interface PrintedBatchSummary {
 schemaVersion:1;kind:'printed-identification-batch-summary';status:'identified'|'refused';calibrated:false;accuracyVerified:false;
 counts:{entries:number;identified:number;refused:number};output:string;outputBytes:number;outputSha256:string;refusalCode?:string;cleanupWarning?:{code:string;path:string;message:string};
}
export declare const PRINTED_IDENTIFICATION_BATCH_LIMITS:Readonly<{entries:8;manifestBytes:131072;totalInputBytes:8388608;artifactBytes:4194304;manifestDepth:8;manifestValues:512}>;
export declare function parsePrintedBatchArgs(args:readonly string[]):PrintedBatchPaths;
export declare function writePrintedIdentificationBatch(request:PrintedBatchPaths):Promise<PrintedBatchSummary>;
export declare function printedBatchCliError(error:unknown):{schemaVersion:1;kind:'printed-identification-batch-summary';status:'error';code:string};
