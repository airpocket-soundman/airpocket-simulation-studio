import type {ReferenceMatrix3} from './finite-visco-reference';
export interface FiniteViscoFinalSyntheticObservation {
 readonly schemaVersion:1; readonly kind:'finite-visco-final-synthetic-observation';
 readonly model:'synthetic-green-lagrange-maxwell-reference-v1';
 readonly synthetic:true;readonly provisional:true;readonly calibrated:false;
 readonly units:{readonly time:'s';readonly stress:'Pa';readonly energyDensity:'J/m3-reference'};
 readonly historyIdentity:{readonly rawIdentity:string;readonly canonicalIdentity:string};
 readonly parameterRevision:string;readonly timeSeconds:number;
 readonly origin:{readonly kind:'synthetic-reference';readonly description:string};
 readonly values:{readonly S:ReferenceMatrix3;readonly energyDensity:number;readonly cumulativeDissipationDensity:number};
}
interface ComparisonIdentity {
 readonly kind:'finite-visco-final-synthetic-comparison';readonly schemaVersion:1;
 readonly model:'synthetic-green-lagrange-maxwell-reference-v1';readonly synthetic:true;readonly provisional:true;readonly calibrated:false;
 readonly observationRawIdentity:string;readonly historyIdentity:{readonly rawIdentity:string;readonly canonicalIdentity:string};
}
export type FiniteViscoFinalSyntheticComparison = ComparisonIdentity & (
 {readonly completed:false;readonly status:'history-rejected';readonly failure:Readonly<{code:'FINITE_VISCO_HISTORY_PARAMETERS_REJECTED';stepIndex:null;completedSteps:0}|{code:'FINITE_VISCO_HISTORY_STEP_REJECTED';stepIndex:number;completedSteps:number}>} |
 {readonly completed:true;readonly status:'compared';readonly parameterRevision:string;readonly timeSeconds:number;readonly origin:FiniteViscoFinalSyntheticObservation['origin'];
 readonly stress:{readonly measure:'second-Piola';readonly unit:'Pa';readonly signedDifference:ReferenceMatrix3;readonly maxAbsoluteDifference:number};
 readonly energy:{readonly unit:'J/m3-reference';readonly energyDensity:{readonly signedDifference:number;readonly absoluteDifference:number};readonly cumulativeDissipationDensity:{readonly signedDifference:number;readonly absoluteDifference:number}};readonly meaning:string}
);
export declare const FINITE_VISCO_COMPARISON_LIMITS:Readonly<{bytes:1048576;depth:16;values:100000;checkpoints:1}>;
/** Raw UTF8 only; ordinary Uint8Array or primitive string. No state restore, interpolation, fitting or calibration. */
export declare function compareFiniteViscoFinalObservation(historyRaw:string|Uint8Array,observationRaw:string|Uint8Array):Promise<FiniteViscoFinalSyntheticComparison>;
