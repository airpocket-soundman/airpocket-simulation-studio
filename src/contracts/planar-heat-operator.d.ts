export interface PlanarHeatOperatorGeometry {
 units:'mm';mesh:{nodes:number[]};sourceFaces:Array<{nodes:[number,number,number]}>;targetFaces:Array<{nodes:[number,number,number]}>;
}
export interface PlanarHeatTransferOperator {
 readonly schemaVersion:1;readonly kind:'planar-affine-heat-transfer';
 readonly units:Readonly<{length:'mm';flux:'W/m2';gradient:'W/m3';load:'W'}>;
 readonly basis:readonly ['1','x_m','y_m','z_m'];readonly toleranceMm:0.000001;readonly coverageTolerance:0.000001;
 readonly sourceGeometryRevision:string;readonly targetGeometryRevision:string;readonly operatorRevision:string;readonly coveredAreaM2:number;
 readonly sourceCoefficients:readonly number[];readonly rows:readonly Readonly<{nodeId:number;coefficients:readonly number[]}>[];
}
export interface AppliedPlanarHeatOperator {
 operatorRevision:string;coveredAreaM2:number;sourceW:number;targetW:number;targetOutwardW:number;balanceErrorW:number;nodeHeatW:Map<number,number>;
}
export type PlanarAffineFlux=number|{base:number;gradient?:[number,number,number]};
export declare const PLANAR_HEAT_OPERATOR_LIMITS:Readonly<{nodes:4096;facesPerSide:512;bytes:1048576;coordinateMm:1000000}>;
export declare function buildPlanarHeatTransferOperator(geometry:PlanarHeatOperatorGeometry):Promise<PlanarHeatTransferOperator>;
export declare function serializePlanarHeatTransferOperator(operator:PlanarHeatTransferOperator):string;
export declare function loadPlanarHeatTransferOperator(raw:string,geometry:PlanarHeatOperatorGeometry):Promise<PlanarHeatTransferOperator>;
export declare function applyPlanarHeatTransferOperator(operator:PlanarHeatTransferOperator,geometry:PlanarHeatOperatorGeometry,flux:PlanarAffineFlux):Promise<AppliedPlanarHeatOperator>;
