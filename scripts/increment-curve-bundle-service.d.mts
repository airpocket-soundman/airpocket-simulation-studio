interface CurveBundleRequestBase {
 synthetic: true; curveId: string; caseIdentity: Record<string,unknown>;
 rowIdentity: {materialKey:string; geometryKey:string; gaugeKey:string};
 boundsMm: [number,number,number,number,number,number]; meshSizeMm:number;
 youngModulusPa:number; poissonRatio:number; axis:[number,number,number];
 initialGaugeLengthMm:number; initialAreaMm2:number;
}
export type IncrementCurveBundleRequest = CurveBundleRequestBase & (
 {controlledQuantity?:'force'; loadsN:number[]; displacementsMm?:never} |
 {controlledQuantity:'displacement'; displacementsMm:number[]; loadsN?:never}
);
export interface IncrementCurveBundleGenerated {
 bundle: {spec:Record<string,unknown>; steps:Array<{stepId:string; controlledQuantity:'force'|'displacement'; controlledValue:number; converged:boolean; provisional:boolean; output?:Record<string,unknown>}>};
 curve: {steps:import('../src/contracts/increment-curve-mcp').IncrementCurveMcpRow[]; [key:string]:unknown};
 csv:string; json:string; svg:string;
 failures:Array<{stepIndex:number; stepId:string; loadN?:number; displacementMm?:number; message:string}>;
}
export declare const INCREMENT_CURVE_BUNDLE_LIMITS:Readonly<{requestBytes:65536; requestValues:100000; depth:24; loads:128; nodes:20000; elements:30000; boundsMm:1000000}>;
export declare function createIncrementCurveBundle(request:IncrementCurveBundleRequest,options?:{initialize?:unknown; solve?:(mesh:unknown,properties:unknown,boundary:unknown)=>unknown}):Promise<IncrementCurveBundleGenerated>;
export declare function writeIncrementCurveBundle(args:{requestPath:string; outputPath:string}):Promise<Record<string,unknown>>;
export declare function parseIncrementCurveBundleArgs(argv:string[]):{requestPath:string;outputPath:string};
