import {replayFiniteViscoInputHistory} from './finite-visco-history.js';
import {canonicalJson} from './project-revision.js';
export const FINITE_VISCO_COMPARISON_LIMITS=Object.freeze({bytes:1048576,depth:16,values:100000,checkpoints:1});
const MODEL='synthetic-green-lagrange-maxwell-reference-v1';
function fail(code){throw Object.assign(Error(code),{code});}
const invalid=()=>fail('FINITE_VISCO_COMPARISON_INVALID_INPUT');
const plain=x=>x!==null&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function exact(x,keys){if(!plain(x)||Reflect.ownKeys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))invalid();}
// Parse with duplicate-key, depth and value limits before constructing unbounded nested JSON.
function parse(text){let at=0,count=0;const ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){const c=text[at];if(c==='"'){at++;try{const value=JSON.parse(text.slice(start,at));if(value.length>1024)invalid();return value;}catch{invalid();}}if(c==='\\')at++;}invalid();}
 function value(depth){ws();if(depth>16||++count>100000)fail('FINITE_VISCO_COMPARISON_GRAPH_LIMIT');const c=text[at];if(c==='"')return string();if(c==='{'||c==='['){const object=c==='{',out=object?Object.create(null):[],seen=new Set();at++;ws();if(text[at]===(object?'}':']')){at++;return out;}for(;;){ws();if(object){if(text[at]!=='"')invalid();const key=string();if(seen.has(key))fail('FINITE_VISCO_COMPARISON_DUPLICATE_KEY');seen.add(key);if(seen.size>16)invalid();ws();if(text[at++]!==':')invalid();out[key]=value(depth+1);}else{if(out.length>=4096)invalid();out.push(value(depth+1));}ws();if(text[at]===(object?'}':']')){at++;return out;}if(text[at++]!==',')invalid();}}
 const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!match)invalid();at+=match[0].length;const out=JSON.parse(match[0]);if(typeof out==='number'&&(!Number.isFinite(out)||Math.abs(out)>Number.MAX_SAFE_INTEGER))invalid();return out;}
 const result=value(0);ws();if(at!==text.length)invalid();return result;
}
const arrayBufferByteLengthGetter=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength').get;
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype),byteLengthGetter=Object.getOwnPropertyDescriptor(typedPrototype,'byteLength').get,bufferGetter=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get;
function rawSnapshot(raw){let bytes;
 if(typeof raw==='string'){if(raw.length>1048576)fail('FINITE_VISCO_COMPARISON_BYTE_LIMIT');bytes=new TextEncoder().encode(raw);if(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)!==raw)invalid();}
 else{if(!raw||Object.getPrototypeOf(raw)!==Uint8Array.prototype||!ArrayBuffer.isView(raw))invalid();const n=byteLengthGetter.call(raw);if(n>1048576)fail('FINITE_VISCO_COMPARISON_BYTE_LIMIT');const buffer=bufferGetter.call(raw);try{arrayBufferByteLengthGetter.call(buffer);}catch{invalid();}if(Object.getPrototypeOf(buffer)!==ArrayBuffer.prototype)invalid();bytes=new Uint8Array(n);Uint8Array.prototype.set.call(bytes,raw);}
 if(bytes.length>1048576)fail('FINITE_VISCO_COMPARISON_BYTE_LIMIT');return bytes;
}

async function hash(bytes){const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return 'sha256:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
function observation(raw){let value;try{value=parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));}catch(e){if(typeof e?.code==='string'&&e.code.startsWith('FINITE_VISCO_COMPARISON_'))throw e;invalid();}
 exact(value,['schemaVersion','kind','model','synthetic','provisional','calibrated','units','historyIdentity','parameterRevision','timeSeconds','origin','values']);
 if(value.schemaVersion!==1||value.kind!=='finite-visco-final-synthetic-observation'||value.model!==MODEL||value.synthetic!==true||value.provisional!==true||value.calibrated!==false)invalid();
 exact(value.units,['time','stress','energyDensity']);if(value.units.time!=='s'||value.units.stress!=='Pa'||value.units.energyDensity!=='J/m3-reference')invalid();
 exact(value.historyIdentity,['rawIdentity','canonicalIdentity']);for(const x of [value.historyIdentity.rawIdentity,value.historyIdentity.canonicalIdentity,value.parameterRevision])if(typeof x!=='string'||!/^sha256:[a-f0-9]{64}$/.test(x))invalid();
 if(typeof value.timeSeconds!=='number'||!Number.isFinite(value.timeSeconds)||value.timeSeconds<=0)invalid();
 exact(value.origin,['kind','description']);if(value.origin.kind!=='synthetic-reference'||typeof value.origin.description!=='string'||!value.origin.description.trim())invalid();
 exact(value.values,['S','energyDensity','cumulativeDissipationDensity']);const {S,energyDensity,cumulativeDissipationDensity}=value.values;
 if(!Array.isArray(S)||S.length!==3||S.some(r=>!Array.isArray(r)||r.length!==3||r.some(v=>typeof v!=='number'||!Number.isFinite(v))))invalid();
 if([energyDensity,cumulativeDissipationDensity].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))invalid();return value;
}
/** Compare one final synthetic checkpoint only. No fitting, calibration or threshold pass/fail. */
export async function compareFiniteViscoFinalObservation(historyRaw,observationRaw){
 // Both sources are owned before replay/hash can await; no caller memory crosses an await.
 const historyBytes=rawSnapshot(historyRaw),observationBytes=rawSnapshot(observationRaw),observed=observation(observationBytes);
 const replay=await replayFiniteViscoInputHistory(historyBytes),observationRawIdentity=await hash(observationBytes);
 const identity={kind:'finite-visco-final-synthetic-comparison',schemaVersion:1,model:MODEL,synthetic:true,provisional:true,calibrated:false,observationRawIdentity,historyIdentity:{rawIdentity:replay.rawIdentity,canonicalIdentity:replay.canonicalIdentity}};
 if(!replay.completed)return freeze({...identity,completed:false,status:'history-rejected',failure:replay.failure});
 const parameterRevision=await hash(new TextEncoder().encode(canonicalJson(replay.finalState.parameters)));
 if(observed.historyIdentity.rawIdentity!==replay.rawIdentity||observed.historyIdentity.canonicalIdentity!==replay.canonicalIdentity)fail('FINITE_VISCO_COMPARISON_HISTORY_MISMATCH');
 if(observed.parameterRevision!==parameterRevision)fail('FINITE_VISCO_COMPARISON_PARAMETERS_MISMATCH');
 if(observed.timeSeconds!==replay.summary.finalTimeSeconds)fail('FINITE_VISCO_COMPARISON_TIME_MISMATCH');
 const reference=replay.summary.finalObservation,S=observed.values.S.map((row,i)=>row.map((v,j)=>v-reference.S[i][j]));
 const energy=observed.values.energyDensity-reference.energyDensity,dissipation=observed.values.cumulativeDissipationDensity-replay.summary.cumulativeDissipationDensity;
 return freeze({...identity,completed:true,status:'compared',parameterRevision,timeSeconds:replay.summary.finalTimeSeconds,origin:observed.origin,
  stress:{measure:'second-Piola',unit:'Pa',signedDifference:S,maxAbsoluteDifference:Math.max(...S.flat().map(Math.abs))},
  energy:{unit:'J/m3-reference',energyDensity:{signedDifference:energy,absoluteDifference:Math.abs(energy)},cumulativeDissipationDensity:{signedDifference:dissipation,absoluteDifference:Math.abs(dissipation)}},
  meaning:'Observed minus replayed final synthetic values; no tolerance, fit, calibration or physical-accuracy acceptance'});
}
