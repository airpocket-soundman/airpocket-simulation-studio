import type {ChannelBoundaryTransferInput,ChannelBoundaryTransfer,ChannelBoundaryId} from './channel-layer-boundary-transfer';
export declare const CHANNEL_NODE_VELOCITY_POLICY:'wall-over-inlet-at-shared-nodes';
export declare const CHANNEL_NODE_POLICY_LIMITS:Readonly<{nodes:number;bytes:1000000}>;
export interface ChannelNodeVelocityPolicyOptions {
 input:ChannelBoundaryTransferInput;transfer:ChannelBoundaryTransfer;policy:typeof CHANNEL_NODE_VELOCITY_POLICY;
}
export interface ChannelNodeVelocityPolicy {
 schemaVersion:1;kind:'limited-channel-node-velocity-policy';meshRevision:string;transferRevision:string;policyRevision:string;
 policy:typeof CHANNEL_NODE_VELOCITY_POLICY;units:{velocity:'m/s';pressure:'Pa'};
 nodes:{nodeId:number;boundaryIds:ChannelBoundaryId[];/** null explicitly means unconstrained, not zero. */velocityMps:[number|null,number|null,number|null];componentSources:['wall'|'inlet'|'symmetry'|null,'wall'|'inlet'|'symmetry'|null,'wall'|'inlet'|'symmetry'|null]}[];
 overriddenInletNodeIds:number[];outletFaceConditions:{faceId:string;pressurePa:number}[];
 scope:{geometry:'parallel-plate-axis-aligned-Tet4';symmetry:'z-component-only';pressure:'face-only-no-nodal-assignment';nullMeaning:'unconstrained-component';solverConnected:false;projectBoundaryApiConnected:false};
}
export declare function createChannelNodeVelocityPolicy(options:ChannelNodeVelocityPolicyOptions):Promise<ChannelNodeVelocityPolicy>;
export declare function validateChannelNodeVelocityPolicy(options:ChannelNodeVelocityPolicyOptions,received:ChannelNodeVelocityPolicy):Promise<ChannelNodeVelocityPolicy>;
