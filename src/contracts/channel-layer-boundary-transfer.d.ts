import type {LimitedChannelTet4Geometry} from './channel-layer-tet4';
export type ChannelBoundaryId='lower-wall'|'upper-wall'|'inlet'|'outlet'|'side-z-min'|'side-z-max';
export type ChannelFaceTag='lowerWall'|'upperWall'|'xMin'|'xMax'|'zMin'|'zMax';
export interface ChannelBoundaryConditions {
 lowerWall:{type:'no-slip-wall'};upperWall:{type:'no-slip-wall'};
 xMin:{type:'velocity-inlet';velocityMps:[number,number,number]};
 xMax:{type:'pressure-outlet';pressurePa:number};
 zMin:{type:'symmetry'};zMax:{type:'symmetry'};
}
export interface ChannelBoundaryTransferInput {
 mesh:LimitedChannelTet4Geometry;expectedMeshRevision:string;conditions:ChannelBoundaryConditions;
 maxTetEdgeAspectRatio:number;minimumTetVolumeMm3:number;
}
export interface ChannelBoundaryTransfer {
 schemaVersion:1;kind:'limited-channel-boundary-transfer';meshRevision:string;transferRevision:string;
 units:{length:'mm';area:'mm2';volume:'mm3';velocity:'m/s';pressure:'Pa'};
 boundaries:{tag:ChannelFaceTag;boundaryId:ChannelBoundaryId;outwardNormal:number[];wallId:0|1|null;condition:ChannelBoundaryConditions[ChannelFaceTag];faceIds:string[];areaMm2:number}[];
 faces:{faceId:string;boundaryId:ChannelBoundaryId;nodeIds:number[];tetrahedronId:string;outwardNormal:number[];centroidMm:number[];areaMm2:number;wallId:0|1|null}[];
 elements:{tetrahedronId:string;nodeIds:number[];centroidMm:number[];volumeMm3:number;edgeAspectRatio:number;plateDistanceMm:number}[];
 nodePlateDistancesMm:number[];qualityLimits:{maxTetEdgeAspectRatio:number;minimumTetVolumeMm3:number};
 scope:{geometry:'parallel-plate-axis-aligned-Tet4';flowDirection:'+x';solverConnected:false;projectBoundaryApiConnected:false;wallDistanceDefinition:'nearest-y-plate-only';unsupported:string[]};
}
export declare function getChannelLayerMeshRevision(mesh:LimitedChannelTet4Geometry):Promise<string>;
export declare function createChannelLayerBoundaryTransfer(input:ChannelBoundaryTransferInput):Promise<ChannelBoundaryTransfer>;
export declare function validateChannelLayerBoundaryTransfer(input:ChannelBoundaryTransferInput,transfer:ChannelBoundaryTransfer):Promise<ChannelBoundaryTransfer>;
