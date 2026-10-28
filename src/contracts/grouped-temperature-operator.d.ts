import type {PlanarHeatOperatorGeometry} from './planar-heat-operator';
import type {PlanarTemperatureField} from './planar-temperature-operator';
export interface TemperatureFacetGroup {groupId:string;sourceFaceIds:number[];targetFaceIds:number[];}
export interface GroupedTemperatureGeometry extends PlanarHeatOperatorGeometry {groups:TemperatureFacetGroup[];}
export type GroupedTemperatureField=PlanarTemperatureField;
export interface GroupedTemperatureOperator {
 readonly schemaVersion:1;readonly kind:'grouped-planar-p1-temperature-l2';readonly solverConnected:false;
 readonly units:Readonly<{length:'mm';mass:'m2';coefficient:'dimensionless'}>;
 readonly geometryRevision:string;readonly operatorRevision:string;readonly coveredAreaM2:number;readonly conditionInfinity:number;
 readonly groups:readonly Readonly<{groupId:string;sourceFaceIds:readonly number[];targetFaceIds:readonly number[];operatorRevision:string;coveredAreaM2:number}>[];
 readonly sourceIds:readonly number[];readonly sourceWeights:readonly Readonly<{nodeId:number;areaM2:number}>[];readonly targetWeights:readonly Readonly<{nodeId:number;areaM2:number}>[];
 readonly massNormalized:readonly (readonly number[])[];readonly crossNormalized:readonly (readonly number[])[];
 readonly rows:readonly Readonly<{nodeId:number;coefficients:readonly number[]}>[];
}
export interface AppliedGroupedTemperature {operatorRevision:string;geometryRevision:string;fieldRevision:string;coveredAreaM2:number;units:'degC'|'K';integralUnits:'degC*m2'|'K*m2';sourceIntegral:number;targetIntegral:number;maxNormalizedResidual:number;values:Array<{nodeId:number;value:number}>;solverConnected:false;}
export declare const GROUPED_TEMPERATURE_OPERATOR_LIMITS:Readonly<{groups:8;activeNodesPerSide:128;nodes:4096;facesPerSide:512;bytes:1048576;conditionInfinity:10000000000;intersectionToleranceMm:0.000001}>;
export declare function buildGroupedTemperatureOperator(geometry:GroupedTemperatureGeometry):Promise<GroupedTemperatureOperator>;
export declare function serializeGroupedTemperatureOperator(operator:GroupedTemperatureOperator):string;
export declare function loadGroupedTemperatureOperator(raw:string,geometry:GroupedTemperatureGeometry):Promise<Readonly<{operator:GroupedTemperatureOperator;source:Readonly<{bytes:number;rawIdentity:string;meaning:'input-operator-JSON-identity-not-authentication'}>}>>;
export declare function applyGroupedTemperatureOperator(operator:GroupedTemperatureOperator,geometry:GroupedTemperatureGeometry,field:GroupedTemperatureField):Promise<AppliedGroupedTemperature>;
