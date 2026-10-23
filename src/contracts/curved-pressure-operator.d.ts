export interface CurvedPressureOperatorGeometry {lengthUnit:'mm';surface:'open'|'closed';nodes:number[];triangles:[number,number,number][];}
export interface FacetComplexPressure {units:'Pa';values:{real:number;imag:number}[];}
export interface ComplexNodalDisplacement {units:'m';real:number[];imag:number[];}
export interface CurvedPressureTransferOperator {
 readonly schemaVersion:1;readonly kind:'facet-fixed-complex-pressure-operator';readonly geometryRevision:string;readonly operatorRevision:string;readonly nodeCount:number;readonly surface:'open'|'closed';
 readonly units:Readonly<{length:'mm';pressure:'Pa';displacement:'m';force:'N';moment:'Nm';volume:'m3';work:'J';weight:'m2'}>;
 readonly faces:readonly Readonly<{faceIndex:number;nodeIds:readonly [number,number,number];outwardNormal:readonly [number,number,number];areaMm2:number;areaWeightM2:number}>[];
 readonly scope:Readonly<{pressure:'constant-complex-per-oriented-facet';transpose:'same-area-third-weights';normal:'declared-winding-no-auto-flip';solverConnected:false;smoothSurfaceAccuracy:false}>;
}
interface OperatorIdentity {operatorRevision:string;geometryRevision:string;}
export interface AppliedCurvedPressure extends OperatorIdentity {pressureRevision:string;forceReal:number[];forceImag:number[];resultantReal:number[];resultantImag:number[];momentReal:number[];momentImag:number[];totalAreaMm2:number;units:{force:'N';moment:'Nm'};}
export interface AppliedCurvedTranspose extends OperatorIdentity {displacementRevision:string;volumeReal:number[];volumeImag:number[];totalVolumeReal:number;totalVolumeImag:number;unit:'m3';}
export interface CurvedPressureVirtualWork extends OperatorIdentity {pressureRevision:string;displacementRevision:string;nodalWork:{real:number;imag:number};pressureWork:{real:number;imag:number};absoluteErrorJ:number;relativeErrorJ:number;scaleJ:number;unit:'J';}
export declare const CURVED_PRESSURE_OPERATOR_LIMITS:Readonly<{nodes:4096;faces:512;bytes:1048576;coordinateMm:1000000;values:100000;depth:12}>;
export declare function buildCurvedPressureTransferOperator(input:CurvedPressureOperatorGeometry):Promise<CurvedPressureTransferOperator>;
export declare function serializeCurvedPressureTransferOperator(operator:CurvedPressureTransferOperator):string;
export declare function loadCurvedPressureTransferOperator(raw:string,input:CurvedPressureOperatorGeometry):Promise<Readonly<{operator:CurvedPressureTransferOperator;source:Readonly<{bytes:number;rawIdentity:string;meaning:'input-JSON-identity-not-authentication'}>}>>;
export declare function applyCurvedPressureTransferOperator(operator:CurvedPressureTransferOperator,input:CurvedPressureOperatorGeometry,pressure:FacetComplexPressure):Promise<AppliedCurvedPressure>;
export declare function applyCurvedPressureTranspose(operator:CurvedPressureTransferOperator,input:CurvedPressureOperatorGeometry,displacement:ComplexNodalDisplacement):Promise<AppliedCurvedTranspose>;
export declare function evaluateCurvedPressureVirtualWork(operator:CurvedPressureTransferOperator,input:CurvedPressureOperatorGeometry,pressure:FacetComplexPressure,displacement:ComplexNodalDisplacement):Promise<CurvedPressureVirtualWork>;
