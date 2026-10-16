// Fixed-frame PNG-sequence export helpers. Pure: no DOM, no clocks. Frame i of N is a function of (i,N) and stored data only.
export const FIXED_FRAME_LIMITS=Object.freeze({minFrames:2,maxFrames:120,defaultFrames:24,maxFrameBytes:4*1024*1024,maxTotalBytes:24*1024*1024});
export const FIXED_FRAME_ANIMATIONS=Object.freeze(['orbit','deformation','time','slice']);
const finite=v=>typeof v==='number'&&Number.isFinite(v);

/** Recorded numbers are rounded to 9 decimals so float noise (e.g. -35.99999999999999 vs -36) never reaches manifest bytes. */
export function roundRecorded(value){const r=Math.round(value*1e9)/1e9;return r===0?0:r;}
/** Orbit camera position from the saved start state only (rotation about +Y, same convention as three.js applyAxisAngle). Pure and rounded. */
export function orbitCameraPosition(position,target,angle){
 const ox=position[0]-target[0],oy=position[1]-target[1],oz=position[2]-target[2],c=Math.cos(angle),s=Math.sin(angle);
 return [ox*c+oz*s+target[0],oy+target[1],-ox*s+oz*c+target[2]].map(roundRecorded);
}

export function validateFrameCount(frames){
 if(!Number.isInteger(frames)||frames<FIXED_FRAME_LIMITS.minFrames||frames>FIXED_FRAME_LIMITS.maxFrames)throw Error(`png-sequence frames must be an integer from ${FIXED_FRAME_LIMITS.minFrames} through ${FIXED_FRAME_LIMITS.maxFrames}`);
 return frames;
}

/** Deterministic schedule. orbit/deformation are cyclic (phase i/N, last frame does not repeat the first); time/slice span the range (phase i/(N-1)).
 * `state` is the shared animationState(kind,phase,opts) function. time maps frames onto stored snapshots and refuses N above their count. */
export function fixedFrameSchedule({animation,frames,state,scale=1,snapshotTimes=[],min=0,max=1}){
 validateFrameCount(frames);
 if(!FIXED_FRAME_ANIMATIONS.includes(animation))throw Error('Invalid animation type');
 if(typeof state!=='function')throw Error('fixedFrameSchedule requires an animation state function');
 if(animation==='time'){
  if(snapshotTimes.length<2||!snapshotTimes.every((time,i)=>finite(time)&&time>=0&&(!i||time>snapshotTimes[i-1])))throw Error('Time frames require increasing stored snapshot times');
  if(frames>snapshotTimes.length)throw Error(`png-sequence frames (${frames}) exceed the ${snapshotTimes.length} stored snapshots`);
 }
 const cyclic=animation==='orbit'||animation==='deformation',out=[];
 for(let i=0;i<frames;i++){
  const phase=cyclic?i/frames:i/(frames-1),s=state(animation,phase,{scale,frames:animation==='time'?snapshotTimes.length:1,min,max});
  const entry={index:i,phase};
  if(animation==='orbit')entry.angleRadians=s.angle;
  else if(animation==='deformation')entry.deformScale=s.deformScale;
  else if(animation==='time'){entry.snapshotIndex=s.frame;entry.physicalTimeSeconds=snapshotTimes[s.frame];}
  else entry.slicePosition=s.position;
  out.push(entry);
 }
 return out;
}

const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export async function sha256Hex(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');}

/** Minimal STORE-only ZIP writer. Fixed DOS timestamp (1980-01-01) keeps output byte-reproducible. Entries: [{name,bytes}]. */
export function buildStoreZip(entries){
 if(!Array.isArray(entries)||!entries.length||entries.length>0xfffe)throw Error('Invalid ZIP entry list');
 const enc=new TextEncoder(),names=new Set(),parts=[],central=[];let offset=0;
 for(const {name,bytes} of entries){
  if(typeof name!=='string'||!name||name.includes('\\')||name.startsWith('/')||name.split('/').some(p=>p===''||p==='.'||p==='..')||names.has(name))throw Error('Invalid or duplicate ZIP entry name');names.add(name);
  if(!(bytes instanceof Uint8Array)||bytes.length>0xfffffffe)throw Error('Invalid ZIP entry bytes');
  const nameBytes=enc.encode(name),crc=crc32(bytes),local=new Uint8Array(30+nameBytes.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,10,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,0,true);lv.setUint16(12,0x21,true);lv.setUint32(14,crc,true);lv.setUint32(18,bytes.length,true);lv.setUint32(22,bytes.length,true);lv.setUint16(26,nameBytes.length,true);lv.setUint16(28,0,true);local.set(nameBytes,30);
  const dir=new Uint8Array(46+nameBytes.length),dv=new DataView(dir.buffer);
  dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,10,true);dv.setUint16(8,0x0800,true);dv.setUint16(10,0,true);dv.setUint16(12,0,true);dv.setUint16(14,0x21,true);dv.setUint32(16,crc,true);dv.setUint32(20,bytes.length,true);dv.setUint32(24,bytes.length,true);dv.setUint16(28,nameBytes.length,true);dv.setUint32(42,offset,true);dir.set(nameBytes,46);
  parts.push(local,bytes);central.push(dir);offset+=local.length+bytes.length;if(offset>0xfffffffe)throw Error('ZIP exceeds the 4 GiB non-ZIP64 limit');
 }
 const size=central.reduce((n,d)=>n+d.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
 ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let pos=0;for(const part of [...parts,...central,end]){out.set(part,pos);pos+=part.length;}return out;
}

/** Reads a STORE ZIP produced by buildStoreZip (verifies CRC). Returns Map name->bytes. */
export function readStoreZip(bytes){
 if(bytes.length<22)throw Error('Invalid ZIP');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;
 if(v.getUint32(end,true)!==0x06054b50)throw Error('Invalid ZIP end record');
 const count=v.getUint16(end+10,true),start=v.getUint32(end+16,true),out=new Map(),dec=new TextDecoder('utf-8',{fatal:true});let p=start;
 for(let i=0;i<count;i++){
  if(v.getUint32(p,true)!==0x02014b50||v.getUint16(p+10,true)!==0)throw Error('Unsupported ZIP entry');
  const crc=v.getUint32(p+16,true),size=v.getUint32(p+24,true),n=v.getUint16(p+28,true),x=v.getUint16(p+30,true),c=v.getUint16(p+32,true),local=v.getUint32(p+42,true),name=dec.decode(bytes.subarray(p+46,p+46+n));
  const begin=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true),data=bytes.subarray(begin,begin+size);
  if(data.length!==size||crc32(data)!==crc)throw Error('ZIP entry CRC or length mismatch: '+name);out.set(name,data);p+=46+n+x+c;
 }
 return out;
}

const RESULT_SETTINGS=['field','modeIndex','frameIndex','timeSeconds','deformScale'];
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(finite)?v.slice():undefined;
/** Bounded subset of the frozen view that is recorded in manifests (same fields as the single-artifact manifest). */
export function pickViewFields(view){
 const result=view?.result&&typeof view.result==='object'?view.result:{},picked={};
 for(const key of RESULT_SETTINGS)if(typeof result[key]==='string'&&result[key].length<=64||finite(result[key]))picked[key]=result[key];
 if(result.camera&&typeof result.camera==='object'){const camera={};for(const key of ['position','target','up'])if(vec(result.camera[key]))camera[key]=vec(result.camera[key]);if(finite(result.camera.fov))camera.fov=result.camera.fov;if(Object.keys(camera).length)picked.camera=camera;}
 return picked;
}
