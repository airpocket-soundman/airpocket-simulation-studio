/** Opt-in saved-file profile. Omitting elementOrder preserves the Tet4 startup identity. */
export interface NativeTet10JobOptions {elementOrder:2;method:'pcg-strict';adaptive:false;size:number}
export interface Tet10NativeResult {
 kind:'elastic-tet10';elementOrder:2;representation:'straight-affine-Tet10-native-v1';provisional:true;
 displacement:number[];magnitudes:number[];
 gaussPoints:{element:number;volumeMm3:number;xMm:number[];stress:number[];vonMisesPa:number}[];
 maxDisplacementMm:number;maxVonMisesPa:number;appliedForceN:number[];
 viewSupported:false;pointSupported:false;compareSupported:false;
 units:{coordinates:'mm';displacement:'mm';force:'N';stress:'Pa';volume:'mm3'};
}
export interface Tet10NativeMesh {nodes:number[];tetrahedra:number[][];surface:{nodes:number[]}[];elementOrder:2;elementType:'Tet10';geometry:'straight-affine';cornerNodeCount:number}
