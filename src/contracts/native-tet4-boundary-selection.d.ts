/** Explicit prepared mesh, global forces in N, no CAD or face-load mapping. */
export interface NativeTet4BoundarySelectionRequest {
 input: object;
 mesh: {nodes:number[];tets:[number,number,number,number][]};
 fixedNodeSets: Array<{id:string;nodeIds:number[]}>;
 nodalLoads: Array<{nodeId:number;forceN:[number,number,number]}>;
}
export interface SelectedNativeTet4Record {
 schemaVersion:2;kind:'prepared-isotropic-tet4';units:'mm-Pa-N';
 sourceInputRevision:string;meshRevision:string;youngPa:number;poissonRatio:number;
 nodes:number[];tets:[number,number,number,number][];fixedNodes:number[];forces:number[];
}
export declare function createNativeTet4RecordFromBoundarySelections(request:NativeTet4BoundarySelectionRequest):Promise<SelectedNativeTet4Record>;
