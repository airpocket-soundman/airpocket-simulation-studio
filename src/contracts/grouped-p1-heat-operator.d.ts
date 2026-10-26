import type {GroupedTemperatureGeometry} from './grouped-temperature-operator';
import type {PlanarP1HeatTransferOperator} from './planar-p1-heat-operator';
export type GroupedP1HeatGeometry=GroupedTemperatureGeometry;
export interface GroupedP1HeatFlux {units:'W/m2';groups:Array<{groupId:string;values:Array<{nodeId:number;value:number}>}>;}
export interface GroupedP1HeatTransferOperator {
 readonly schemaVersion:1;readonly kind:'grouped-planar-p1-heat-transfer';readonly solverConnected:false;
 readonly units:Readonly<{length:'mm';flux:'W/m2';load:'W';coefficient:'m2'}>;
 readonly sourceValuePolicy:'group-local-outward-P1';readonly targetLoadPolicy:'global-node-sum';
 readonly geometryRevision:string;readonly operatorRevision:string;readonly coveredAreaM2:number;readonly termCount:number;readonly targetNodeIds:readonly number[];
 readonly groups:readonly Readonly<{groupId:string;sourceFaceIds:readonly number[];targetFaceIds:readonly number[];operator:PlanarP1HeatTransferOperator}>[];
}
export interface GroupedP1HeatRate {groupId:string;coveredAreaM2:number;fluxRevision:string;sourceOutwardW:number;targetLoadW:number;targetOutwardW:number;closureErrorW:number;}
export interface AppliedGroupedP1HeatTransfer {operatorRevision:string;geometryRevision:string;fluxRevision:string;coveredAreaM2:number;sourceOutwardW:number;targetLoadW:number;targetOutwardW:number;closureErrorW:number;groups:GroupedP1HeatRate[];nodeHeatW:Map<number,number>;solverConnected:false;}
export declare const GROUPED_P1_HEAT_OPERATOR_LIMITS:Readonly<{groups:8;activeNodesPerSide:128;nodes:4096;facesPerSide:512;terms:16384;sourceValues:1024;bytes:1048576;intersectionToleranceMm:0.000001}>;
export declare function buildGroupedP1HeatTransferOperator(geometry:GroupedP1HeatGeometry):Promise<GroupedP1HeatTransferOperator>;
export declare function serializeGroupedP1HeatTransferOperator(operator:GroupedP1HeatTransferOperator):string;
export declare function loadGroupedP1HeatTransferOperator(raw:string,geometry:GroupedP1HeatGeometry):Promise<Readonly<{operator:GroupedP1HeatTransferOperator;source:Readonly<{bytes:number;rawIdentity:string;meaning:'input-operator-JSON-identity-not-authentication'}>}>>;
export declare function applyGroupedP1HeatTransferOperator(operator:GroupedP1HeatTransferOperator,geometry:GroupedP1HeatGeometry,field:GroupedP1HeatFlux):Promise<AppliedGroupedP1HeatTransfer>;
