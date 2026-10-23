import type {PlanarHeatOperatorGeometry} from './planar-heat-operator';
export type PlanarP1HeatGeometry=PlanarHeatOperatorGeometry;
export interface PlanarP1HeatFlux {units:'W/m2';values:Array<{nodeId:number;value:number}>;}
export interface PlanarP1HeatTransferOperator {
 readonly schemaVersion:1;readonly kind:'planar-p1-heat-transfer';readonly units:Readonly<{length:'mm';flux:'W/m2';load:'W';coefficient:'m2'}>;
 readonly toleranceMm:0.000001;readonly coverageTolerance:0.000001;readonly sourceGeometryRevision:string;readonly targetGeometryRevision:string;readonly operatorRevision:string;readonly coveredAreaM2:number;
 readonly sourceWeights:readonly Readonly<{nodeId:number;areaM2:number}>[];
 readonly rows:readonly Readonly<{nodeId:number;terms:readonly Readonly<{sourceNodeId:number;coefficientM2:number}>[]}>[];
}
export interface AppliedPlanarP1HeatTransfer {operatorRevision:string;fluxRevision:string;sourceGeometryRevision:string;targetGeometryRevision:string;coveredAreaM2:number;sourceW:number;targetW:number;targetOutwardW:number;balanceErrorW:number;nodeHeatW:Map<number,number>;}
export declare const PLANAR_P1_HEAT_OPERATOR_LIMITS:Readonly<{nodes:4096;facesPerSide:512;terms:16384;bytes:1048576;values:200000;depth:20}>;
export declare function buildPlanarP1HeatTransferOperator(geometry:PlanarP1HeatGeometry):Promise<PlanarP1HeatTransferOperator>;
export declare function serializePlanarP1HeatTransferOperator(operator:PlanarP1HeatTransferOperator):string;
export declare function loadPlanarP1HeatTransferOperator(raw:string,geometry:PlanarP1HeatGeometry):Promise<Readonly<{operator:PlanarP1HeatTransferOperator;source:Readonly<{bytes:number;rawIdentity:string;meaning:'input-operator-JSON-identity-not-authentication'}>}>>;
export declare function applyPlanarP1HeatTransferOperator(operator:PlanarP1HeatTransferOperator,geometry:PlanarP1HeatGeometry,flux:PlanarP1HeatFlux):Promise<AppliedPlanarP1HeatTransfer>;
