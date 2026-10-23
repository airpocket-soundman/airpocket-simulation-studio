import {initFiniteViscoReference,stepFiniteViscoReference} from './finite-visco-reference.js';
import {canonicalJson} from './project-revision.js';
export const FINITE_VISCO_HISTORY_LIMITS=Object.freeze({bytes:1048576,steps:4096,depth:16,values:100000,stringLength:1024});
const MODEL='synthetic-green-lagrange-maxwell-reference-v1';
function fail(code){const e=new Error(code);e.code=code;throw e;}
const invalid=()=>fail('FINITE_VISCO_HISTORY_INVALID_INPUT');
const plain=x=>x!==null&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function exact(x,keys){if(!plain(x)||Reflect.ownKeys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k))||Reflect.ownKeys(x).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value')))invalid();}
function snapshot(value,depth=0,budget={count:0}){
 if(depth>16||++budget.count>100000)fail('FINITE_VISCO_HISTORY_GRAPH_LIMIT');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)invalid();return value;}
 if(typeof value==='string'){if(value.length>1024)invalid();return value;}
 if(Array.isArray(value)){
  if(Object.getPrototypeOf(value)!==Array.prototype||value.length>4096||Reflect.ownKeys(value).length!==value.length+1)invalid();const copy=[];
  for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))invalid();copy.push(snapshot(d.value,depth+1,budget));}return copy;
 }
 if(!plain(value)||Reflect.ownKeys(value).length>16)invalid();const copy=Object.create(null);
 for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||key.length>1024||!d.enumerable||!Object.hasOwn(d,'value'))invalid();copy[key]=snapshot(d.value,depth+1,budget);}return copy;
}
function validate(history){
 exact(history,['schemaVersion','model','kind','synthetic','provisional','calibrated','units','parameters','steps']);
 if(history.schemaVersion!==1||history.model!==MODEL||history.kind!=='finite-visco-input-history'||history.synthetic!==true||history.provisional!==true||history.calibrated!==false)invalid();
 exact(history.units,['time','deformationGradient']);if(history.units.time!=='s'||history.units.deformationGradient!=='dimensionless')invalid();
 exact(history.parameters,['bulkModulusPa','equilibriumShearModulusPa','branchShearModulusPa','relaxationTimeSeconds']);
 if(!Array.isArray(history.steps)||history.steps.length<1||history.steps.length>4096)invalid();
 for(const entry of history.steps){exact(entry,['F','dtSeconds']);if(typeof entry.dtSeconds!=='number'||!Number.isFinite(entry.dtSeconds))invalid();if(!Array.isArray(entry.F)||entry.F.length!==3||entry.F.some(row=>!Array.isArray(row)||row.length!==3||row.some(v=>typeof v!=='number'||!Number.isFinite(v))))invalid();}
 return history;
}
// Parse with duplicate-key, depth and value limits before constructing unbounded nested JSON.
function parse(text){let at=0,count=0;const ws=()=>{while(/[\x20\t\r\n]/.test(text[at]??'!'))at++;};
 function string(){const start=at++;for(;at<text.length;at++){const c=text[at];if(c==='"'){at++;try{const value=JSON.parse(text.slice(start,at));if(value.length>1024)invalid();return value;}catch{invalid();}}if(c==='\\')at++;}invalid();}
 function value(depth){ws();if(depth>16||++count>100000)fail('FINITE_VISCO_HISTORY_GRAPH_LIMIT');const c=text[at];if(c==='"')return string();if(c==='{'||c==='['){const object=c==='{',out=object?Object.create(null):[],seen=new Set();at++;ws();if(text[at]===(object?'}':']')){at++;return out;}for(;;){ws();if(object){if(text[at]!=='"')invalid();const key=string();if(seen.has(key))fail('FINITE_VISCO_HISTORY_DUPLICATE_KEY');seen.add(key);if(seen.size>16)invalid();ws();if(text[at++]!==':')invalid();out[key]=value(depth+1);}else{if(out.length>=4096)invalid();out.push(value(depth+1));}ws();if(text[at]===(object?'}':']')){at++;return out;}if(text[at++]!==',')invalid();}}
 const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));if(!match)invalid();at+=match[0].length;const out=JSON.parse(match[0]);if(typeof out==='number'&&(!Number.isFinite(out)||Math.abs(out)>Number.MAX_SAFE_INTEGER))invalid();return out;}
 const result=value(0);ws();if(at!==text.length)invalid();return validate(result);
}
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype),byteLengthGetter=Object.getOwnPropertyDescriptor(typedPrototype,'byteLength').get,bufferGetter=Object.getOwnPropertyDescriptor(typedPrototype,'buffer').get;
function rawSnapshot(raw){let bytes;
 if(typeof raw==='string'){if(raw.length>1048576)fail('FINITE_VISCO_HISTORY_BYTE_LIMIT');bytes=new TextEncoder().encode(raw);if(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)!==raw)invalid();}
 else{if(!raw||Object.getPrototypeOf(raw)!==Uint8Array.prototype||!ArrayBuffer.isView(raw))invalid();const n=byteLengthGetter.call(raw);if(n>1048576)fail('FINITE_VISCO_HISTORY_BYTE_LIMIT');const buffer=bufferGetter.call(raw);if(Object.getPrototypeOf(buffer)!==ArrayBuffer.prototype)invalid();bytes=new Uint8Array(n);Uint8Array.prototype.set.call(bytes,raw);}
 if(bytes.length>1048576)fail('FINITE_VISCO_HISTORY_BYTE_LIMIT');return bytes;
}
async function hash(bytes){const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return 'sha256:'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
/** Encode only explicit input history. This is not constitutive acceptance or state serialization. */
export async function encodeFiniteViscoInputHistory(input){const history=validate(snapshot(input)),json=canonicalJson(history)+'\n',bytes=new TextEncoder().encode(json);if(bytes.length>1048576)fail('FINITE_VISCO_HISTORY_BYTE_LIMIT');const canonicalIdentity=await hash(new TextEncoder().encode(json.slice(0,-1)));return freeze({kind:'finite-visco-input-history-encoding',json,bytes:bytes.length,canonicalIdentity,constitutiveVerified:false});}
/** Replay a bounded raw-byte snapshot from I/Z0. Never trusts claimed output/state fields. */
export async function replayFiniteViscoInputHistory(raw){const bytes=rawSnapshot(raw);let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{invalid();}const history=parse(text),canonical=canonicalJson(history),[rawIdentity,canonicalIdentity]=await Promise.all([hash(bytes),hash(new TextEncoder().encode(canonical))]);const identity={sourceBytes:bytes.length,rawIdentity,canonicalIdentity,model:MODEL,synthetic:true,provisional:true,calibrated:false,meaning:'input-history-replay-from-I-Z0',stepCount:history.steps.length};let state;
 try{state=initFiniteViscoReference({synthetic:true,provisional:true,calibrated:false,parameters:history.parameters});}catch{return freeze({...identity,completed:false,status:'failed',failure:{code:'FINITE_VISCO_HISTORY_PARAMETERS_REJECTED',stepIndex:null,completedSteps:0}});}
 for(let index=0;index<history.steps.length;index++){
  let result;try{result=stepFiniteViscoReference({state,...history.steps[index]});}catch{return freeze({...identity,completed:false,status:'failed',failure:{code:'FINITE_VISCO_HISTORY_STEP_REJECTED',stepIndex:index,completedSteps:index}});}
  state=result.state;
  if(index===history.steps.length-1)return freeze({...identity,completed:true,status:'completed',finalState:state,summary:{finalTimeSeconds:state.timeSeconds,cumulativeWorkDensity:state.cumulativeWorkDensity,cumulativeDissipationDensity:state.cumulativeDissipationDensity,energyDensity:result.observation.energyDensity,finalObservation:result.observation,units:{time:'s',stress:'Pa',energyDensity:'J/m3-reference'}}});
 }
 fail('FINITE_VISCO_HISTORY_INVALID_INPUT');
}
