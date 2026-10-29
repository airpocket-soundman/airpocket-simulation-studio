import type {FiniteViscoPronySegment} from './finite-visco-prony-uniaxial.js';
import type {Matrix3,FiniteViscoHenckyFlags} from './finite-visco-hencky-multiplicative.js';
import type {FiniteViscoPrfJ2Parameters,FiniteViscoPrfJ2State} from './finite-visco-prf-j2.js';
export interface FiniteViscoDamageParameters extends FiniteViscoPrfJ2Parameters {
 readonly damage:{readonly thresholdEnergyDensity:number;readonly softeningEnergyDensity:number};
}
export interface FiniteViscoDamageState extends FiniteViscoHenckyFlags {
 readonly model:'synthetic-hencky-prony-j2-scalar-damage-v1';readonly Y0:number;readonly Yf:number;readonly effective:FiniteViscoPrfJ2State;
 readonly r:number;readonly d:number;readonly Y:number;readonly damageDissipationDensity:number;readonly viscousDissipationDensity:number;readonly plasticDissipationDensity:number;
}
export interface FiniteViscoDamageStep {
 readonly state:FiniteViscoDamageState;
 readonly observation:{readonly cauchyPa:Matrix3;readonly kirchhoffPa:Matrix3;readonly J:number;readonly damage:number;readonly damageDriverEnergyDensity:number;readonly storedEnergyDensity:number;readonly plasticLogStrain:Matrix3;readonly equivalentPlasticStrain:number};
 readonly increment:{readonly plasticIncrement:number;readonly damageIncrement:number};
}
export interface FiniteViscoDamageRow {
 readonly step:number;readonly segment:number;readonly timeSeconds:number;readonly axialGreenStrain:number;readonly axialStretch:number;readonly lateralStretch:number;readonly J:number;
 readonly sigma11Pa:number;readonly sigma22Pa:number;readonly P11Pa:number;readonly effectiveSigma11Pa:number;readonly damage:number;readonly damageDriverEnergyDensity:number;
 readonly plasticAxialLogStrain:number;readonly equivalentPlasticStrain:number;readonly storedEnergyDensity:number;
 readonly viscousDissipationDensity:number;readonly plasticDissipationDensity:number;readonly damageDissipationDensity:number;
}
export interface FiniteViscoDamageResult extends FiniteViscoHenckyFlags {
 readonly model:'synthetic-hencky-prony-j2-scalar-damage-v1';readonly meaning:'strain-controlled-uniaxial-stress-material-point';readonly kinematics:string;
 readonly damageModel:'isotropic-scalar-strain-equivalence-energy-driven-exponential';readonly regularization:'none-local-material-point-mesh-dependent';
 readonly stressMeasure:{readonly sigma11Pa:'Cauchy';readonly P11Pa:'first-Piola-nominal'};readonly units:{readonly time:'s';readonly stress:'Pa';readonly energyDensity:'J/m3-reference'};
 readonly rows:readonly FiniteViscoDamageRow[];readonly segmentEnds:readonly number[];
 readonly summary:{readonly steps:number;readonly finalTimeSeconds:number;readonly finalDamage:number;readonly peakP11Pa:number;readonly peakAxialGreenStrain:number;readonly storedEnergyDensity:number;readonly viscousDissipationDensity:number;readonly plasticDissipationDensity:number;readonly damageDissipationDensity:number;readonly note:string};
}
export declare const FINITE_VISCO_DAMAGE_LIMITS:Readonly<{minEnergyDensity:number;maxEnergyDensity:number}>;
export declare function initFiniteViscoDamage(input:FiniteViscoHenckyFlags&{readonly parameters:FiniteViscoDamageParameters}):FiniteViscoDamageState;
export declare function stepFiniteViscoDamage(input:{readonly state:FiniteViscoDamageState;readonly F:Matrix3;readonly dtSeconds:number}):FiniteViscoDamageStep;
export declare function runFiniteViscoDamageUniaxial(input:FiniteViscoHenckyFlags&{readonly parameters:FiniteViscoDamageParameters;readonly segments:readonly FiniteViscoPronySegment[]}):FiniteViscoDamageResult;
