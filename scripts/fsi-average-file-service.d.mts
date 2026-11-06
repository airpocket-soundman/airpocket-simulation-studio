import type {AverageForceResult} from '../src/contracts/fsi-channel-average-force';
export interface FsiAverageFilePaths {request:string;output:string}
export interface FsiAverageFileOptions {signal?:AbortSignal;timeoutMs?:number}
export interface FsiAverageSource {bytes:number;sha256:string}
export type FsiAverageJsonResult=Omit<AverageForceResult,'profile'>&{profile:number[]};
export interface FsiAverageFileSummary {
 schemaVersion:1;kind:'fsi-average-file-summary';status:'completed';methodVersion:1;synthetic:true;calibrated:false;
 source:FsiAverageSource;configurationSha256:string;output:string;outputBytes:number;outputSha256:string;
 worker:{executionSettled:true;exitCode:0};steps:number;
 final:{timeSeconds:number;displacementM:number;velocityMPerS:number;energyDefectJPerM2:number;relativeEnergyDefect:number};
 work:{responseSolves:number;cellStepsUpperBound:number};cleanupWarning?:{code:string};
}
export interface FsiAverageFileArtifact {
 schemaVersion:1;kind:'fsi-average-force-file';methodVersion:1;synthetic:true;calibrated:false;source:FsiAverageSource;
 configurationSha256:string;profileRepresentation:'finite-number-array-m/s';worker:{executionSettled:true;exitCode:0};result:FsiAverageJsonResult;
}
export declare const FSI_AVERAGE_FILE_LIMITS:Readonly<{requestBytes:65536;artifactBytes:4194304;timeoutMs:120000;resultValues:200000}>;
export declare function parseFsiAverageArgs(args:readonly string[]):FsiAverageFilePaths;
/** Timeout covers owned worker execution; cancellation is honored before publication starts. */
export declare function writeFsiAverageFiles(request:FsiAverageFilePaths,options?:FsiAverageFileOptions):Promise<FsiAverageFileSummary>;
export declare function fsiAverageCliError(error:unknown):{schemaVersion:1;kind:'fsi-average-file-summary';status:'error';code:string;source?:FsiAverageSource};
