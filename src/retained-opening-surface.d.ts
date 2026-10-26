import type {ConfirmableOpeningCandidate,ConfirmedOpeningCap} from './contracts/opening-candidate-cap';
type DeepReadonly<T> = T extends object ? {readonly [K in keyof T]:DeepReadonly<T[K]>} : T;
declare const openingLease:unique symbol;
export interface RetainedOpeningSurfaceInput {
 readonly units:'mm';readonly topologyIntent:'open-indexed-surface';readonly sourceIdentity:string;
 readonly mesh:{readonly nodes:readonly number[];readonly triangles:readonly (readonly number[])[];readonly toleranceMm:number};
}
export interface RetainedOpeningSurfaceLease {
 readonly [openingLease]:true;
 readonly kind:'retained-opening-surface';readonly generation:number;readonly contentRevision:string;readonly sourceIdentity:string;
 readonly units:'mm';readonly topologyIntent:'open-indexed-surface';
 readonly analysis:DeepReadonly<{status:'checked';toleranceMm:number;nodeCount:number;triangleCount:number;boundaryEdgeCount:number;closedShell:boolean;candidates:ConfirmableOpeningCandidate[];rejected:{code:string;nodeIndices:number[];detail?:unknown}[]}>;
}
export interface RetainedOpeningConfirmation {
 readonly confirmed:true;readonly capId:string;readonly candidate:DeepReadonly<ConfirmableOpeningCandidate>;
 readonly outwardNormal:readonly [number,number,number];readonly interiorPointMm:readonly [number,number,number];
 readonly enclosure:readonly [number,number,number,number,number,number];
}
export interface RetainedOpeningSurfaceProvider {
 replace(input:RetainedOpeningSurfaceInput):Promise<RetainedOpeningSurfaceLease>;
 current():RetainedOpeningSurfaceLease|null;
 clear():void;
 release(lease:RetainedOpeningSurfaceLease):void;
 dispose():void;
 confirm(lease:RetainedOpeningSurfaceLease,input:RetainedOpeningConfirmation):DeepReadonly<ConfirmedOpeningCap & {generation:number;contentRevision:string;sourceIdentity:string}>;
}
export declare const RETAINED_OPENING_SURFACE_LIMITS:Readonly<{nodes:512;triangles:1024;bytes:1048576;values:20000;depth:8;stringLength:256}>;
/** Explicit caller surface only; leases are in-process/provider-specific and not serializable restore tokens. */
export declare function createRetainedOpeningSurfaceProvider():RetainedOpeningSurfaceProvider;
