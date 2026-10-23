export interface FixedWebmFrame {index:number; phase:number; timestamp:number; duration:number}
export interface FixedWebmPacket {timestamp:number; duration:number; type:'key'; data:Uint8Array}
export interface FixedWebmContainer {width:number; height:number; seconds:number; packets:FixedWebmPacket[]}
export interface FixedWebmVerification {
 schemaVersion:1; codec:'vp8'; frameCount:number; encodedFrameCount:number; decodedFrameCount:number;
 terminalTimestamp:number; totalDurationMicroseconds:number; verification:'strict-webm-demux+video-decoder';
}
export interface ComparisonFixedWebmCapability {
 supported:boolean; recording:'fixed-frame'; codec:'vp8'; codecSupport:'checked-at-export';
 maxFrames:120; maxArtifactBytes:number; code?:'WEBM_FIXED_UNSUPPORTED'; reason?:string;
}
export type FixedWebmFailureCode='WEBM_FIXED_INVALID'|'WEBM_FIXED_UNSUPPORTED'|'WEBM_FIXED_CODEC_FAILURE'|'WEBM_FIXED_OUTPUT_MISMATCH'|'WEBM_FIXED_CANCELLED'|'WEBM_FIXED_TIMEOUT'|'WEBM_ENDPOINT_UNVERIFIED';
/** Integer microseconds; phase is physical selection, not timestamp/duration. N=min(seconds*24,120). */
export declare function fixedWebmSchedule(seconds:number):FixedWebmFrame[];
/** VP8-only keyframe container profile. Codec payload validity is verified by the browser decoder, not this pure parser. */
export declare function muxFixedWebm(value:FixedWebmContainer):Uint8Array;
export declare function demuxFixedWebm(bytes:Uint8Array):FixedWebmContainer;
