import {constants} from 'node:fs';import {open,lstat} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {samePrintedFile} from './printed-identification-file-io.mjs';
import {inspectChannelAverageForceInput} from '../src/fsi-channel-average-force.js';
const prefix='FSI_AVERAGE_REVERIFY_',fail=code=>{throw Object.assign(Error(prefix+code),{code:prefix+code});};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
export const BASE_HISTORY_FIELDS=Object.freeze(['t','d','v','fluidEnergy','plateEnergy','dissipated','interfaceWork','energyDefectJPerM2','energyDefect']);
export const STEP_HISTORY_FIELDS=Object.freeze(['wallVelocity','forceOnPlate','forceOnFluid','interfaceImpulse','bottomImpulse','stepDissipated','stepInterfaceWork','fluidEnergyDefectJPerM2','plateEnergyDefectJPerM2','momentumDefectKgPerMS','forceResidualPa','scaledForceResidual']);
export function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==keys.length||keys.some(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return !d?.enumerable||!Object.hasOwn(d,'value');}))fail('SHAPE');}
// Kept separate from the existing 2MB dataset reader: only this artifact format
// admits up to 4MiB. At most limit+1 bytes can be allocated/read despite FD races.
export async function readFsiArtifactBytes(source){
 const limit=4194304;if(source.stat.size>BigInt(limit))fail('BYTE_LIMIT');
 const same=(a,b)=>samePrintedFile(a,b)&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
 const file=await open(source.path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{const before=await file.stat({bigint:true});if(!before.isFile()||!same(before,source.stat))fail('INPUT_CHANGED');if(before.size>BigInt(limit))fail('BYTE_LIMIT');
  const bytes=Buffer.alloc(limit+1);let size=0;while(size<bytes.length){const {bytesRead}=await file.read(bytes,size,Math.min(65536,bytes.length-size),null);if(!bytesRead)break;size+=bytesRead;}if(size>limit)fail('BYTE_LIMIT');
  const after=await file.stat({bigint:true}),path=await lstat(source.path,{bigint:true});if(!path.isFile()||!same(before,after)||!same(after,path)||BigInt(size)!==after.size)fail('INPUT_CHANGED');
  const snapshot=bytes.subarray(0,size);return {bytes:snapshot,identity:{bytes:size,sha256:sha256(snapshot)}};
 }finally{await file.close();}
}
export function decodeFsiUtf8(bytes){let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('UTF8');}if(text.charCodeAt(0)===0xfeff)fail('UTF8');return text;}
export function parseFsiBoundedJson(text,artifact=false){
 let at=0,count=0;const maximum=artifact?200000:512,depthLimit=artifact?12:8,arrayLimit=artifact?4097:8,stringLimit=artifact?256:4096;
 const invalid=()=>fail('JSON'),ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){if(text[at]==='"'){at++;try{const s=JSON.parse(text.slice(start,at));if(s.length>stringLimit)invalid();return s;}catch{invalid();}}if(text[at]==='\\')at++;}invalid();}
 function value(depth){if(depth>depthLimit||++count>maximum)invalid();ws();const c=text[at];if(c==='"')return string();
  if(c==='{'||c==='['){const obj=c==='{',out=obj?{}:[],seen=new Set();at++;ws();if(text[at]===(obj?'}':']')){at++;return out;}for(;;){ws();if(obj){if(text[at]!=='"')invalid();const k=string();if(seen.has(k)||seen.size>=32)invalid();seen.add(k);ws();if(text[at++]!==':')invalid();Object.defineProperty(out,k,{value:value(depth+1),enumerable:true,configurable:true,writable:true});}else{if(out.length>=arrayLimit)invalid();out.push(value(depth+1));}ws();if(text[at]===(obj?'}':']')){at++;return out;}if(text[at++]!==',')invalid();}}
  const m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!m)invalid();at+=m[0].length;const v=JSON.parse(m[0]);if(typeof v==='number'&&!Number.isFinite(v))invalid();return v;
 }
 const out=value(0);ws();if(at!==text.length)invalid();return out;
}
export function inspectFsiArtifact(a){
 exact(a,['schemaVersion','kind','methodVersion','synthetic','calibrated','source','configurationSha256','profileRepresentation','worker','result']);
 if(a.schemaVersion!==1||a.kind!=='fsi-average-force-file'||a.methodVersion!==1||a.synthetic!==true||a.calibrated!==false||a.profileRepresentation!=='finite-number-array-m/s')fail('VERSION');
 exact(a.source,['bytes','sha256']);if(!Number.isSafeInteger(a.source.bytes)||a.source.bytes<1||a.source.bytes>65536||typeof a.source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.source.sha256))fail('SOURCE');
 exact(a.worker,['executionSettled','exitCode']);if(a.worker.executionSettled!==true||a.worker.exitCode!==0)fail('UNSETTLED');
 const r=a.result;exact(r,['schemaVersion','method','synthetic','calibrated','input','history','profile','initialEnergy','maxXSpread','work']);
 if(r.schemaVersion!==1||r.method!=='time-averaged-midpoint'||r.synthetic!==true||r.calibrated!==false)fail('VERSION');
 const admitted=inspectChannelAverageForceInput(r.input);if(canonical(admitted.input)!==canonical(r.input)||a.configurationSha256!==sha256(canonical(r.input)))fail('CONFIGURATION');
 exact(r.work,['responseSolves','cellStepsUpperBound']);if(r.work.responseSolves!==admitted.work.responseSolves||r.work.cellStepsUpperBound!==admitted.work.cellStepsUpperBound)fail('WORK');
 if(!Number.isFinite(r.initialEnergy)||r.initialEnergy<0||!Number.isFinite(r.maxXSpread)||r.maxXSpread<0||!Array.isArray(r.profile)||r.profile.length!==r.input.fluid.cellsY||Reflect.ownKeys(r.profile).length!==r.profile.length+1||!Array.isArray(r.history)||r.history.length!==r.input.steps+1)fail('SHAPE');
 for(let i=0;i<r.profile.length;i++){const d=Object.getOwnPropertyDescriptor(r.profile,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')||!Number.isFinite(d.value))fail('SHAPE');}
 for(let i=0;i<r.history.length;i++){const h=r.history[i],keys=i?[...BASE_HISTORY_FIELDS,...STEP_HISTORY_FIELDS]:BASE_HISTORY_FIELDS;exact(h,keys);if(keys.some(k=>!Number.isFinite(h[k]))||h.t!==i*r.input.dt)fail('HISTORY');}
 return admitted;
}
