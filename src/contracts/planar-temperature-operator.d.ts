import type {PlanarHeatOperatorGeometry} from './planar-heat-operator';
export interface PlanarTemperatureField {units:'degC'|'K';values:Array<{nodeId:number;value:number}>;}
export interface PlanarTemperatureOperator {
 readonly schemaVersion:1;readonly kind:'planar-p1-temperature-l2';readonly solverConnected:false;
 readonly units:Readonly<{length:'mm';mass:'m2';coefficient:'dimensionless'}>;
 readonly sourceGeometryRevision:string;readonly targetGeometryRevision:string;readonly fluxOperatorRevision:string;readonly operatorRevision:string;readonly coveredAreaM2:number;
 readonly sourceWeights:readonly Readonly<{nodeId:number;areaM2:number}>[];readonly targetWeights:readonly Readonly<{nodeId:number;areaM2:number}>[];
 readonly sourceIds:readonly number[];readonly rows:readonly Readonly<{nodeId:number;coefficients:readonly number[]}>[];
 readonly massNormalized:readonly (readonly number[])[];readonly crossNormalized:readonly (readonly number[])[];readonly conditionInfinity:number;
}
export interface AppliedPlanarTemperature {sourceGeometryRevision:string;targetGeometryRevision:string;coveredAreaM2:number;operatorRevision:string;fieldRevision:string;units:'degC'|'K';integralUnits:'degC*m2'|'K*m2';sourceIntegral:number;targetIntegral:number;maxNormalizedResidual:number;values:Array<{nodeId:number;value:number}>;solverConnected:false;}
export declare const PLANAR_TEMPERATURE_OPERATOR_LIMITS:Readonly<{activeNodesPerSide:128;bytes:1048576;conditionInfinity:10000000000}>;
export declare function buildPlanarTemperatureOperator(geometry:PlanarHeatOperatorGeometry):Promise<PlanarTemperatureOperator>;
export declare function serializePlanarTemperatureOperator(operator:PlanarTemperatureOperator):string;
export declare function loadPlanarTemperatureOperator(raw:string,geometry:PlanarHeatOperatorGeometry):Promise<Readonly<{operator:PlanarTemperatureOperator;source:Readonly<{bytes:number;rawIdentity:string}>}>>;
export declare function applyPlanarTemperatureOperator(operator:PlanarTemperatureOperator,geometry:PlanarHeatOperatorGeometry,field:PlanarTemperatureField):Promise<AppliedPlanarTemperature>;
