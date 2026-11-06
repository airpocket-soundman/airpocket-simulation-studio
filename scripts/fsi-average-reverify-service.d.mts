import type {FsiAverageSource,FsiAverageFileOptions} from './fsi-average-file-service.mjs';
export type FsiQuantity='displacementM'|'velocityMPerS'|'arealEnergyJPerM2'|'tractionPa'|'tractionImpulsePaS'|'arealMomentumKgPerMS'|'dimensionless';
export interface FsiReverifyManifest {schemaVersion:1;artifact:{path:string;expectedSHA256:string};tolerances:{relative:number;absolute:Record<FsiQuantity,number>}}
export interface FsiReverifyPaths {request:string;output?:string}
export interface FsiReverifyFinal {timeSeconds:number;displacementM:number;velocityMPerS:number;fluidEnergyJPerM2:number;plateEnergyJPerM2:number;dissipatedJPerM2:number;energyDefectJPerM2:number;relativeEnergyDefect:number}
export interface FsiReverifyReport {
 schemaVersion:1;kind:'fsi-average-reverification';status:'matched'|'mismatch';synthetic:true;calibrated:false;physicalAccuracyVerified:false;authenticationVerified:false;methodVersion:1;
 verificationRequest:FsiAverageSource;artifact:FsiAverageSource;originalRequest:FsiAverageSource;originalSourceRecomputed:false;originalRuntime:'not-recorded';replayRuntime:{node:string;v8:string;platform:string;arch:string};configurationSha256:string;
 comparison:{rule:string;tolerances:FsiReverifyManifest['tolerances'];exactNumericMatch:boolean;groups:Record<FsiQuantity,{unit:string;compared:number;mismatches:number;maximumAbsoluteDifference:number;maximumThreshold:number}>;mismatches:number;firstMismatches:{pointer:string;quantity:FsiQuantity;saved:number;recomputed:number;absoluteDifference:number;threshold:number}[];includesDerivedSummary:true};
 summary:{saved:FsiReverifyFinal;recomputed:FsiReverifyFinal};replay:{worker:{executionSettled:true;exitCode:0};work:{responseSolves:number;cellStepsUpperBound:number}};limitations:string[];
 publication?:{output:string;outputBytes:number;outputSha256:string;cleanupWarning?:{code:string}};
}
export declare const FSI_REVERIFY_LIMITS:Readonly<{requestBytes:65536;artifactBytes:4194304;reportBytes:65536;mismatchPointers:8;relativeTolerance:0.000001;cellSteps:2000000}>;
export declare function parseFsiReverifyArgs(args:readonly string[]):FsiReverifyPaths;
/** A match is only numerical agreement under all explicitly supplied unit-specific tolerances. */
export declare function verifyFsiAverageArtifact(request:FsiReverifyPaths,options?:FsiAverageFileOptions):Promise<FsiReverifyReport>;
export declare function fsiReverifyError(error:unknown):{schemaVersion:1;kind:'fsi-average-reverification';status:'error';code:string};
