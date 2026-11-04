/** Synthetic SI tangential-wall verification kernel, not a general FSI solver. */
export interface ShearFluidParameters {cellsY:number;height:number;density:number;kinematicViscosity:number;cellsX?:number;length?:number}
export interface ShearPlate {mass:number;stiffness:number}
declare const issuedFluid:unique symbol;
export interface ShearPlateFluid {
 readonly [issuedFluid]:true;
 readonly cellsY:number;readonly hy:number;readonly mu:number;readonly density:number;readonly kinematicViscosity:number;readonly stableDt:number;
 /** Save these parameters and call channelShearFluid again; serialized methods/state are not reloadable. */
 readonly parameters:Readonly<Required<ShearFluidParameters>>;
 shearOnPlate(profile:readonly number[]|Float64Array,velocity:number):number;
 kineticEnergy(profile:readonly number[]|Float64Array):number;
 dissipation(profile:readonly number[]|Float64Array,velocity:number):number;
 advance(profile:readonly number[]|Float64Array,velocity:number,dt:number):{profile:Float64Array;xSpread:number;substeps:number};
}
export interface ShearHistoryEntry {
 t:number;d:number;v:number;fluidEnergy:number;plateEnergy:number;dissipated:number;
 /** Dimensionless defect/E0; exactly zero for zero-energy equilibrium. */
 energyDefect:number;
 /** Absolute mechanical-energy plus dissipated-energy defect, J/m^2. */
 energyDefectJPerM2:number;
 forceOnPlate?:number;forceOnFluid?:number;
}
export interface ShearCoupledOptions {
 fluid:ShearPlateFluid;plate:ShearPlate;initialDisplacement?:number;initialProfile?:readonly number[]|Float64Array;dt:number;steps:number;
 tolerance?:number;maxIterations?:number;relaxation?:'none'|'constant'|'aitken';omega0?:number;divergenceWindow?:number;
}
export type ShearCoupledResult={converged:true;history:ShearHistoryEntry[];iterations:number[];profile:Float64Array;maxXSpread:number;initialEnergy:number}
 |{converged:false;failedStep:number;reason:string;residuals:number[];history:ShearHistoryEntry[];iterations:number[]};
export declare const SHEAR_PLATE_LIMITS:Readonly<{cellsX:256;cellsY:512;coupledSteps:20000;iterations:200;fluidSubsteps:20000;fluidWork:20000000;referenceSteps:500000;referenceWork:10000000}>;
export declare function channelShearFluid(parameters:ShearFluidParameters):ShearPlateFluid;
/** converged means interface fixed-point convergence only, not temporal/physical accuracy. */
export declare function runShearPlateCoupled(options:ShearCoupledOptions):ShearCoupledResult;
export declare function shearPlateMonolithicReference(options:{fluid:ShearPlateFluid;plate:ShearPlate;initialDisplacement?:number;initialProfile?:readonly number[]|Float64Array;endTime:number;h:number}):{samples:{t:number;d:number;v:number}[];dt:number;profile:Float64Array};
