// Queue/controller fixture only. Codec acceptance has separate browser-adapter
// fakes and an external FFmpeg audit; these bytes do not claim valid VP8 pixels.
import {fixedWebmSchedule,muxFixedWebm} from '../../src/fixed-webm.js';
export function fixedWebmFixture(seconds=2,width=1280,height=640){
 const schedule=fixedWebmSchedule(seconds),packets=schedule.map(p=>({timestamp:p.timestamp,duration:p.duration,type:'key',data:Uint8Array.of(16,0,0,157,1,42,16,0,16,0)}));
 const proof={schemaVersion:1,codec:'vp8',frameCount:schedule.length,encodedFrameCount:schedule.length,decodedFrameCount:schedule.length,terminalTimestamp:schedule.at(-1).timestamp,totalDurationMicroseconds:seconds*1e6,verification:'strict-webm-demux+video-decoder'};
 const timing={schemaVersion:1,entries:schedule.map(p=>({renderIndex:p.index,phase:p.phase,requestedTimeSeconds:p.phase*10,panels:[0,1].map(caseIndex=>({caseIndex,frameIndex:0,timeSeconds:0,offsetSeconds:-p.phase*10}))}))};
 return {blob:new Blob([muxFixedWebm({width,height,seconds,packets})],{type:'video/webm;codecs=vp8'}),context:{getFixedVerification:()=>structuredClone(proof),getTimeFrames:()=>structuredClone(timing)}};
}
