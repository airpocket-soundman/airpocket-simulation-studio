export function fixedCodecEnv(mode='success'){
 const stats={inputClosed:0,decodedClosed:0,codecClosed:0,encoded:[],proofs:0,flushStarted:false};
 class VideoFrame{constructor(canvas,options){Object.assign(this,options);this.width=canvas.width;this.height=canvas.height;}close(){stats.inputClosed++;}}
 class EncodedVideoChunk{constructor(packet){Object.assign(this,packet);}}
 class VideoEncoder{
  static async isConfigSupported(){return {supported:mode!=='unsupported'};}
  constructor(callbacks){this.callbacks=callbacks;this.state='configured';this.encodeQueueSize=0;}
  configure(config){stats.width=config.width;stats.height=config.height;}
  encode(frame){stats.encoded.push({timestamp:frame.timestamp,duration:frame.duration});stats.onEncode?.(frame);if(mode==='missing-last'&&frame.timestamp>950000)return;
   const chunk={timestamp:mode==='future'&&frame.timestamp===0?41667:frame.timestamp,duration:frame.duration,type:'key',byteLength:1,copyTo:out=>{out[0]=0;}};this.callbacks.output(chunk);if(mode==='duplicate')this.callbacks.output(chunk);
  }
  flush(){stats.flushStarted=true;return mode==='flush-hang'?new Promise(()=>{}):Promise.resolve();}
  close(){this.state='closed';stats.codecClosed++;}
 }
 class VideoDecoder{
  static async isConfigSupported(){return {supported:true};}
  constructor(callbacks){this.callbacks=callbacks;this.state='configured';this.decodeQueueSize=0;}
  configure(){}
  decode(packet){if(mode==='decode-missing-last'&&packet.timestamp>950000)return;this.callbacks.output({timestamp:packet.timestamp,codedWidth:stats.width,codedHeight:stats.height,close(){stats.decodedClosed++;}});}
  flush(){return Promise.resolve();}
  close(){this.state='closed';stats.codecClosed++;}
 }
 return {stats,env:{VideoEncoder,VideoDecoder,VideoFrame,EncodedVideoChunk,document:{hidden:false,addEventListener(){},removeEventListener(){}},yieldControl:()=>Promise.resolve()}};
}
