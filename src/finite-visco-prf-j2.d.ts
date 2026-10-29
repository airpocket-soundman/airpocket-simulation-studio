import type {FiniteViscoPronySegment} from './finite-visco-prony-uniaxial.js';
import type {Matrix3,FiniteViscoHenckyFlags,FiniteViscoHenckyState} from './finite-visco-hencky-multiplicative.js';
export interface FiniteViscoPrfJ2Parameters {
 readonly bulkModulusPa:number;readonly equilibriumShearModulusPa:number;
 readonly branches:readonly {readonly shearModulusPa:number;readonly relaxationTimeSeconds:number}[];
 readonly plasticity:{readonly yieldStressPa:number;readonly hardeningModulusPa:number};
}
export interface FiniteViscoPrfJ2State extends FiniteViscoHenckyFlags {
 readonly model:'synthetic-hencky-prony-parallel-j2-v1';readonly parameters:{readonly sy:number;readonly H:number;readonly mu:number};
 readonly F:Matrix3;readonly visco:FiniteViscoHenckyState;readonly bp:Matrix3;readonly kappa:number;readonly timeSeconds:number;
 readonly viscousDissipationDensity:number;readonly plasticDissipationDensity:number;
}
export interface FiniteViscoPrfJ2Step {
 readonly state:FiniteViscoPrfJ2State;
 readonly observation:{readonly cauchyPa:Matrix3;readonly kirchhoffPa:Matrix3;readonly J:number;readonly storedEnergyDensity:number;readonly plasticLogStrain:Matrix3;readonly equivalentPlasticStrain:number};
 readonly increment:{readonly plasticIncrement:number};
}
export interface FiniteViscoPrfJ2Row {
 readonly step:number;readonly segment:number;readonly timeSeconds:number;readonly axialGreenStrain:number;readonly axialStretch:number;readonly lateralStretch:number;
 readonly J:number;readonly sigma11Pa:number;readonly sigma22Pa:number;readonly P11Pa:number;readonly plasticAxialLogStrain:number;readonly equivalentPlasticStrain:number;
 readonly storedEnergyDensity:number;readonly viscousDissipationDensity:number;readonly plasticDissipationDensity:number;
}
export interface FiniteViscoPrfJ2Result extends FiniteViscoHenckyFlags {
 readonly model:'synthetic-hencky-prony-parallel-j2-v1';readonly meaning:'strain-controlled-uniaxial-stress-material-point';readonly kinematics:'viscous-F=FeFv-parallel-plastic-F=FeFp-hencky-exponential-return';
 readonly stressMeasure:{readonly sigma11Pa:'Cauchy';readonly P11Pa:'first-Piola-nominal'};
 readonly units:{readonly time:'s';readonly stress:'Pa';readonly energyDensity:'J/m3-reference'};
 readonly rows:readonly FiniteViscoPrfJ2Row[];readonly segmentEnds:readonly number[];
 readonly summary:{readonly steps:number;readonly finalTimeSeconds:number;readonly viscousDissipationDensity:number;readonly plasticDissipationDensity:number;readonly storedEnergyDensity:number;readonly equivalentPlasticStrain:number;readonly permanentPlasticAxialLogStrain:number;readonly note:string};
}
export declare const FINITE_VISCO_PRF_J2_LIMITS:Readonly<{branches:8;segments:64;steps:4096;minStretch:number;maxStretch:number;minJ:number;maxJ:number;minYieldStressPa:number;maxYieldStressPa:number;maxHardeningRatio:number}>;
export declare function initFiniteViscoPrfJ2(input:FiniteViscoHenckyFlags&{readonly parameters:FiniteViscoPrfJ2Parameters}):FiniteViscoPrfJ2State;
export declare function stepFiniteViscoPrfJ2(input:{readonly state:FiniteViscoPrfJ2State;readonly F:Matrix3;readonly dtSeconds:number}):FiniteViscoPrfJ2Step;
export declare function runFiniteViscoPrfJ2Uniaxial(input:FiniteViscoHenckyFlags&{readonly parameters:FiniteViscoPrfJ2Parameters;readonly segments:readonly FiniteViscoPronySegment[]}):FiniteViscoPrfJ2Result;
