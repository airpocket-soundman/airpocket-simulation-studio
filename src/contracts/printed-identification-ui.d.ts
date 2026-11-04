import type {PrintedIdentificationOptions,PrintedIdentificationResult} from './printed-parameter-identification.js';
/** Private worker protocol; it carries no project or material mutation method. */
export interface PrintedIdentificationWorkerRequest {requestId:number;raw:string;options:PrintedIdentificationOptions}
export type PrintedIdentificationWorkerResponse={requestId:number;ok:true;result:PrintedIdentificationResult}|{requestId:number;ok:false;code:'PRINTED_DATASET_INVALID'|'PRINTED_IDENTIFICATION_INVALID'};
export interface PrintedIdentificationUi {
 panel:HTMLDetailsElement;model:HTMLSelectElement;inputs:Record<'maxStrain'|'minPoints'|'maxRelativeStandardError'|'maxTangentRatio'|'holdStrainTolerance',HTMLInputElement>;run:HTMLButtonElement;cancel:HTMLButtonElement;clear:HTMLButtonElement;status:HTMLParagraphElement;results:HTMLDivElement;
 identify():Promise<boolean>;invalidate():void;refresh():void;destroy():void;
 snapshot():{phase:'idle'|'pending'|'invalid'|'timeout'|'cancelled'|'completed'|'unsupported'|'closed';workerActive:boolean;digestPending:boolean;sourceSha256:string|null};
}
export declare const PRINTED_IDENTIFICATION_UI_LIMITS:Readonly<{workerMilliseconds:10000;responseBytes:262144}>;
export declare function createPrintedIdentificationUi(options:{host:HTMLElement;document?:Document;language?:()=>string;getRaw:()=>string;createWorker?:()=>Worker;setTimer?:typeof setTimeout;clearTimer?:typeof clearTimeout}):PrintedIdentificationUi;
