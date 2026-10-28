export interface FiniteViscoPronyBranch {readonly shearModulusPa:number;readonly relaxationTimeSeconds:number;}
export interface FiniteViscoPronyParameters {readonly bulkModulusPa:number;readonly equilibriumShearModulusPa:number;readonly branches:readonly FiniteViscoPronyBranch[];}
export interface FiniteViscoPronySegment {readonly toAxialGreenStrain:number;readonly durationSeconds:number;readonly steps:number;}
export interface FiniteViscoPronyInput {readonly synthetic:true;readonly provisional:true;readonly calibrated:false;readonly parameters:FiniteViscoPronyParameters;readonly segments:readonly FiniteViscoPronySegment[];}
export interface FiniteViscoPronyRow {
 readonly step:number;readonly segment:number;readonly timeSeconds:number;readonly axialGreenStrain:number;readonly lateralGreenStrain:number;
 readonly axialStretch:number;readonly lateralStretch:number;readonly J:number;readonly areaRatio:number;
 readonly S11Pa:number;readonly S22Pa:number;readonly P11Pa:number;readonly sigma11Pa:number;
 readonly energyDensity:number;readonly cumulativeWorkDensity:number;readonly cumulativeDissipationDensity:number;readonly energyBalanceErrorDensity:number;
}
export interface FiniteViscoPronyResult {
 readonly model:'synthetic-green-lagrange-prony-uniaxial-v1';readonly synthetic:true;readonly provisional:true;readonly calibrated:false;
 readonly meaning:'strain-controlled-uniaxial-stress-material-point';readonly path:'linear-Green-Lagrange-per-step';
 readonly stressMeasure:{readonly S11Pa:'second-Piola';readonly P11Pa:'first-Piola-nominal';readonly sigma11Pa:'Cauchy'};
 readonly units:{readonly time:'s';readonly stress:'Pa';readonly energyDensity:'J/m3-reference'};
 readonly parameters:FiniteViscoPronyParameters;readonly rows:readonly FiniteViscoPronyRow[];readonly segmentEnds:readonly number[];
 readonly summary:{readonly steps:number;readonly finalTimeSeconds:number;readonly workDensity:number;readonly dissipationDensity:number;readonly storedEnergyDensity:number;readonly maxP11Pa:number;readonly minP11Pa:number;readonly permanentPlasticStrain:null;readonly note:string};
}
export declare const FINITE_VISCO_PRONY_LIMITS:Readonly<{branches:8;segments:64;steps:4096;minStretch:number;maxStretch:number;minJ:number;maxJ:number;minTimeRatio:number;maxTimeRatio:number;maxTimeSeconds:number}>;
export declare function runFiniteViscoPronyUniaxial(input:FiniteViscoPronyInput):FiniteViscoPronyResult;
