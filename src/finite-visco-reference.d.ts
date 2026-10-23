export type ReferenceMatrix3 = readonly [readonly [number,number,number],readonly [number,number,number],readonly [number,number,number]];
export interface FiniteViscoReferenceParameters {readonly bulkModulusPa:number;readonly equilibriumShearModulusPa:number;readonly branchShearModulusPa:number;readonly relaxationTimeSeconds:number;}
declare const issuedState:unique symbol;
/** Frozen in-process issued state; JSON clones/restore are deliberately refused. */
export interface FiniteViscoReferenceState {
 readonly [issuedState]:true;readonly model:'synthetic-green-lagrange-maxwell-reference-v1';readonly schemaVersion:1;
 readonly synthetic:true;readonly provisional:true;readonly calibrated:false;readonly parameterRevision:string;
 readonly timeSeconds:number;readonly step:number;readonly parameters:FiniteViscoReferenceParameters;
 readonly units:{readonly time:'s';readonly stress:'Pa';readonly energyDensity:'J/m3-reference'};
 readonly F:ReferenceMatrix3;readonly E:ReferenceMatrix3;readonly Z:ReferenceMatrix3;
 readonly cumulativeDissipationDensity:number;readonly cumulativeWorkDensity:number;
}
export interface FiniteViscoReferenceObservation {
 readonly model:'synthetic-green-lagrange-maxwell-reference-v1';readonly synthetic:true;readonly provisional:true;readonly calibrated:false;
 readonly stressMeasure:{readonly S:'second-Piola';readonly P:'first-Piola';readonly sigma:'Cauchy'};
 readonly units:{readonly stress:'Pa';readonly energyDensity:'J/m3-reference';readonly dissipationRateDensity:'W/m3-reference'};
 readonly F:ReferenceMatrix3;readonly E:ReferenceMatrix3;readonly J:number;readonly principalStretches:readonly number[];
 readonly S:ReferenceMatrix3;readonly P:ReferenceMatrix3;readonly sigma:ReferenceMatrix3;
 readonly energyDensity:number;readonly dissipationRateDensity:number;
}
export declare const FINITE_VISCO_REFERENCE_LIMITS:Readonly<{steps:4096;bytes:1048576;minStretch:.95;maxStretch:1.05;minJ:.85;maxJ:1.16;minTimeRatio:1e-6;maxTimeRatio:1e6;maxTimeSeconds:1e9}>;
export declare function initFiniteViscoReference(input:{synthetic:true;provisional:true;calibrated:false;parameters:FiniteViscoReferenceParameters}):FiniteViscoReferenceState;
export declare function evaluateFiniteViscoReference(input:{state:FiniteViscoReferenceState;F:ReferenceMatrix3}):FiniteViscoReferenceObservation;
export declare function stepFiniteViscoReference(input:{state:FiniteViscoReferenceState;F:ReferenceMatrix3;dtSeconds:number}):Readonly<{state:FiniteViscoReferenceState;observation:FiniteViscoReferenceObservation;increment:Readonly<{dtSeconds:number;path:'linear-Green-Lagrange';workDensity:number;dissipationDensity:number;energyBalanceErrorDensity:number}>}>;
