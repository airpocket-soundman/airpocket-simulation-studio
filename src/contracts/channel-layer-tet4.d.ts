export interface ChannelLayerTet4Input {
 plan: object;
 lengthMm: number;
 widthMm: number;
 maxAspectRatio: number;
 minimumCellHeightMm: number;
}
export interface LimitedChannelTet4Geometry {
 lengthMm: number;
 widthMm: number;
 gapMm: number;
 nodes: number[];
 tetrahedra: [number, number, number, number][];
}
export interface ChannelLayerTet4Inspection {
 totalVolumeMm3: number;
 expectedVolumeMm3: number;
 relativeVolumeError: number;
 internalFaceCount: number;
 boundaryFaces: {nodes: [number, number, number]; tag: 'lowerWall'|'upperWall'|'xMin'|'xMax'|'zMin'|'zMax'; wallId: 0|1|null; areaMm2: number}[];
 areasMm2: Record<'lowerWall'|'upperWall'|'xMin'|'xMax'|'zMin'|'zMax', number>;
}
export interface ChannelLayerTet4 extends LimitedChannelTet4Geometry {
 units: 'mm';
 output: 'limited-channel-tet4';
 inspection: ChannelLayerTet4Inspection;
 scope: {solverConnected: false; gmshConnected: false; unsupported: string[]};
}
export declare function createChannelLayerTet4(input: ChannelLayerTet4Input): ChannelLayerTet4;
export declare function inspectChannelLayerTet4(mesh: LimitedChannelTet4Geometry): ChannelLayerTet4Inspection;
