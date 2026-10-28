import type {ReferenceMatrix3,FiniteViscoReferenceParameters,FiniteViscoReferenceState,FiniteViscoReferenceObservation} from './finite-visco-reference';
export interface FiniteViscoInputHistory {
 readonly schemaVersion:1;readonly model:'synthetic-green-lagrange-maxwell-reference-v1';readonly kind:'finite-visco-input-history';
 readonly synthetic:true;readonly provisional:true;readonly calibrated:false;
 readonly units:{readonly time:'s';readonly deformationGradient:'dimensionless'};
 readonly parameters:FiniteViscoReferenceParameters;
 readonly steps:readonly Readonly<{F:ReferenceMatrix3;dtSeconds:number}>[];
}
interface ReplayIdentity {readonly sourceBytes:number;readonly rawIdentity:string;readonly canonicalIdentity:string;readonly model:'synthetic-green-lagrange-maxwell-reference-v1';readonly synthetic:true;readonly provisional:true;readonly calibrated:false;readonly meaning:'input-history-replay-from-I-Z0';readonly stepCount:number;}
export type FiniteViscoHistoryReplay = ReplayIdentity & (
 {readonly completed:false;readonly status:'failed';readonly failure:Readonly<{code:'FINITE_VISCO_HISTORY_PARAMETERS_REJECTED';stepIndex:null;completedSteps:0}|{code:'FINITE_VISCO_HISTORY_STEP_REJECTED';stepIndex:number;completedSteps:number}>} |
 {readonly completed:true;readonly status:'completed';readonly finalState:FiniteViscoReferenceState;readonly summary:Readonly<{finalTimeSeconds:number;cumulativeWorkDensity:number;cumulativeDissipationDensity:number;energyDensity:number;finalObservation:FiniteViscoReferenceObservation;units:Readonly<{time:'s';stress:'Pa';energyDensity:'J/m3-reference'}>}>}
);
export declare const FINITE_VISCO_HISTORY_LIMITS:Readonly<{bytes:1048576;steps:4096;depth:16;values:100000;stringLength:1024}>;
/** Canonical input serialization only; constitutiveVerified is always false. */
export declare function encodeFiniteViscoInputHistory(input:FiniteViscoInputHistory):Promise<Readonly<{kind:'finite-visco-input-history-encoding';json:string;bytes:number;canonicalIdentity:string;constitutiveVerified:false}>>;
/** Ordinary Uint8Array or primitive string only. Buffer/subclasses/shared buffers are rejected at runtime. */
export declare function replayFiniteViscoInputHistory(raw:string|Uint8Array):Promise<FiniteViscoHistoryReplay>;
