/** Synthetic SI tangential, x-uniform laminar verification; no ALE/general FSI. */
export interface AverageForceInput {
 schemaVersion:1;method:'time-averaged-midpoint';
 fluid:{cellsY:number;height:number;density:number;kinematicViscosity:number;cellsX?:number;length?:number};
 /** Areal mass kg/m² and stiffness N/m³. Initial plate velocity is zero. */
 plate:{mass:number;stiffness:number};initialDisplacement:number;initialProfile?:readonly number[];
 /** Seconds, macrostep count, and explicit microsteps per macrostep. */
 dt:number;steps:number;microsteps:number;
}
export interface AverageForceHistory {
 t:number;d:number;v:number;fluidEnergy:number;plateEnergy:number;dissipated:number;interfaceWork:number;
 /** Absolute J/m² and dimensionless defect/E0 (zero only for equilibrium when E0=0). */
 energyDefectJPerM2:number;energyDefect:number;
 wallVelocity?:number;forceOnPlate?:number;forceOnFluid?:number;interfaceImpulse?:number;bottomImpulse?:number;
 stepDissipated?:number;stepInterfaceWork?:number;fluidEnergyDefectJPerM2?:number;plateEnergyDefectJPerM2?:number;
 /** Areal momentum defect kg/(m s), not force or total momentum. */
 momentumDefectKgPerMS?:number;forceResidualPa?:number;scaledForceResidual?:number;
}
export interface AverageForceResult {
 schemaVersion:1;method:'time-averaged-midpoint';synthetic:true;calibrated:false;
 /** Save/reload input only; output profiles/histories cannot restore a state. */
 input:Readonly<AverageForceInput>;history:AverageForceHistory[];profile:Float64Array;initialEnergy:number;maxXSpread:number;
 work:{responseSolves:number;cellStepsUpperBound:number};
}
export declare const AVERAGE_FORCE_LIMITS:Readonly<{steps:4096;microsteps:4096;cellSteps:2000000}>;
export declare function runChannelAverageForce(input:AverageForceInput):AverageForceResult;
/** Validates capacity and owns initial data; performs no fluid advance. */
export declare function inspectChannelAverageForceInput(input:AverageForceInput):{input:Readonly<AverageForceInput>;work:{responseSolves:number;cellStepsUpperBound:number}};
