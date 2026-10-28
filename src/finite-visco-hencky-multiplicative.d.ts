import type {FiniteViscoPronyParameters,FiniteViscoPronySegment} from './finite-visco-prony-uniaxial.js';
export type Matrix3=readonly [readonly [number,number,number],readonly [number,number,number],readonly [number,number,number]];
export interface FiniteViscoHenckyFlags {readonly synthetic:true;readonly provisional:true;readonly calibrated:false;}
export interface FiniteViscoHenckyState extends FiniteViscoHenckyFlags {
 readonly model:'synthetic-hencky-multiplicative-prony-v1';readonly parameters:FiniteViscoPronyParameters;
 readonly F:Matrix3;readonly be:readonly Matrix3[];readonly timeSeconds:number;readonly cumulativeDissipationDensity:number;
}
export interface FiniteViscoHenckyStep {
 readonly state:FiniteViscoHenckyState;
 readonly observation:{readonly cauchyPa:Matrix3;readonly kirchhoffPa:Matrix3;readonly J:number;readonly storedEnergyDensity:number};
 readonly increment:{readonly dissipationDensity:number};
}
export interface FiniteViscoHenckyRow {
 readonly step:number;readonly segment:number;readonly timeSeconds:number;readonly axialGreenStrain:number;readonly axialStretch:number;readonly lateralStretch:number;
 readonly J:number;readonly areaRatio:number;readonly sigma11Pa:number;readonly sigma22Pa:number;readonly P11Pa:number;readonly S11Pa:number;
 readonly storedEnergyDensity:number;readonly cumulativeDissipationDensity:number;
}
export interface FiniteViscoHenckyResult extends FiniteViscoHenckyFlags {
 readonly model:'synthetic-hencky-multiplicative-prony-v1';readonly meaning:'strain-controlled-uniaxial-stress-material-point';readonly kinematics:'multiplicative-F=FeFv-hencky-exponential-return';
 readonly stressMeasure:{readonly sigma11Pa:'Cauchy';readonly P11Pa:'first-Piola-nominal';readonly S11Pa:'second-Piola'};
 readonly units:{readonly time:'s';readonly stress:'Pa';readonly energyDensity:'J/m3-reference'};
 readonly parameters:FiniteViscoPronyParameters;readonly rows:readonly FiniteViscoHenckyRow[];readonly segmentEnds:readonly number[];
 readonly summary:{readonly steps:number;readonly finalTimeSeconds:number;readonly dissipationDensity:number;readonly storedEnergyDensity:number;readonly maxP11Pa:number;readonly minP11Pa:number;readonly permanentPlasticStrain:null;readonly note:string};
}
export declare const FINITE_VISCO_HENCKY_LIMITS:Readonly<{branches:8;segments:64;steps:4096;minStretch:number;maxStretch:number;minJ:number;maxJ:number;minTimeRatio:number;maxTimeRatio:number;maxTimeSeconds:number}>;
export declare function initFiniteViscoHencky(input:FiniteViscoHenckyFlags&{readonly parameters:FiniteViscoPronyParameters}):FiniteViscoHenckyState;
export declare function stepFiniteViscoHencky(input:{readonly state:FiniteViscoHenckyState;readonly F:Matrix3;readonly dtSeconds:number}):FiniteViscoHenckyStep;
export declare function runFiniteViscoHenckyUniaxial(input:FiniteViscoHenckyFlags&{readonly parameters:FiniteViscoPronyParameters;readonly segments:readonly FiniteViscoPronySegment[]}):FiniteViscoHenckyResult;
