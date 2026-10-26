import {extractOpeningLoopCandidates} from './opening-loop-candidates.js';
import {confirmOpeningCandidate} from './opening-candidate-cap.js';
import {canonicalJson} from './project-revision.js';

// The detector itself has no capacity gate. This provider adds a deliberately
// small envelope before invoking its component/loop and quadratic cycle work.
export const RETAINED_OPENING_SURFACE_LIMITS=Object.freeze({nodes:512,triangles:1024,bytes:1048576,values:20000,depth:8,stringLength:256});
function fail(code){throw Object.assign(Error(code),{code});}
const invalid=()=>fail('OPENING_SURFACE_INVALID_INPUT');
const plain=x=>x!==null&&typeof x==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function snapshot(x,depth=0,budget={values:0}){
 if(depth>8||++budget.values>20000)fail('OPENING_SURFACE_GRAPH_LIMIT');
 if(typeof x==='number'){if(!Number.isFinite(x))invalid();return x;}
 if(typeof x==='string'){if(x.length>256)invalid();return x;}
 if(typeof x==='boolean'||x===null)return x;
 if(Array.isArray(x)){
  if(Object.getPrototypeOf(x)!==Array.prototype||x.length>1536||Reflect.ownKeys(x).length!==x.length+1)invalid();
  const out=[];for(let i=0;i<x.length;i++){const d=Object.getOwnPropertyDescriptor(x,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))invalid();out.push(snapshot(d.value,depth+1,budget));}return out;
 }
 if(!plain(x)||Reflect.ownKeys(x).length>16)invalid();const out=Object.create(null);
 for(const key of Reflect.ownKeys(x)){const d=Object.getOwnPropertyDescriptor(x,key);if(typeof key!=='string'||!d.enumerable||!Object.hasOwn(d,'value'))invalid();out[key]=snapshot(d.value,depth+1,budget);}return out;
}
function exact(x,keys){if(!plain(x)||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))invalid();}
function freeze(x){if(x&&typeof x==='object'){for(const value of Object.values(x))freeze(value);Object.freeze(x);}return x;}
function retained(input){
 const value=snapshot(input);exact(value,['units','topologyIntent','sourceIdentity','mesh']);
 if(value.units!=='mm'||value.topologyIntent!=='open-indexed-surface'||typeof value.sourceIdentity!=='string'||!value.sourceIdentity.trim())invalid();
 exact(value.mesh,['nodes','triangles','toleranceMm']);const {nodes,triangles,toleranceMm}=value.mesh;
 if(!Array.isArray(nodes)||!nodes.length||nodes.length%3||nodes.length/3>512||nodes.some(v=>typeof v!=='number'||Math.abs(v)>1e6))invalid();
 if(!Array.isArray(triangles)||!triangles.length||triangles.length>1024)invalid();
 if(typeof toleranceMm!=='number'||toleranceMm<1e-9||toleranceMm>1e3)invalid();
 const json=canonicalJson(value),bytes=new TextEncoder().encode(json);if(bytes.length>1048576)fail('OPENING_SURFACE_BYTE_LIMIT');
 // Preserve unhealthy/closed reports rather than inventing openings or welding IDs.
 const analysis=extractOpeningLoopCandidates(value.mesh);
 return {value:freeze(value),analysis:freeze(analysis),bytes};
}
async function sha(bytes){const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return 'sha256:'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}

/** Caller-supplied indexed surfaces only. No display conversion, CAD inference,
 * persistence, solver or UI connection. Leases are instance-local capabilities. */
export function createRetainedOpeningSurfaceProvider(){
 let generation=0,current=null,disposed=false;const issued=new WeakMap();
 function open(){if(disposed)fail('OPENING_SURFACE_DISPOSED');}
 function advance(){if(generation===Number.MAX_SAFE_INTEGER)fail('OPENING_SURFACE_GENERATION_LIMIT');return ++generation;}
 function revoke(){const next=advance();if(current)issued.delete(current);current=null;return next;}
 function active(lease){open();const data=lease&&typeof lease==='object'?issued.get(lease):undefined;if(!data||current!==lease||lease.generation!==generation)fail('OPENING_SURFACE_STALE_LEASE');return data;}
 return Object.freeze({
  async replace(input){
   open();
   // Malformed input cannot invalidate an existing valid lease. Once validated,
   // a replacement immediately revokes it, including while hashing is pending.
   const data=retained(input),ticket=revoke();let contentRevision;
   try{contentRevision=await sha(data.bytes);}catch{fail('OPENING_SURFACE_HASH_FAILED');}
   if(ticket!==generation)fail('OPENING_SURFACE_REPLACED');
   const lease=freeze({kind:'retained-opening-surface',generation:ticket,contentRevision,sourceIdentity:data.value.sourceIdentity,units:'mm',topologyIntent:'open-indexed-surface',analysis:data.analysis});
   issued.set(lease,{value:data.value,analysis:data.analysis});current=lease;return lease;
  },
  clear(){open();revoke();},
  release(lease){active(lease);revoke();},
  dispose(){if(!disposed){revoke();disposed=true;}},
  current(){return current;},
  confirm(lease,input){
   const data=active(lease),request=snapshot(input);exact(request,['confirmed','capId','candidate','outwardNormal','interiorPointMm','enclosure']);
   // Uses the exact retained node IDs, triangle order and tolerance. The existing
   // confirmation re-extracts and fully compares the supplied candidate.
   const {enclosure,...confirmation}=request;
   const result=confirmOpeningCandidate({mesh:data.value.mesh,meshVersion:lease.generation,enclosure,confirmation:{...confirmation,meshVersion:lease.generation}});
   active(lease);
   return freeze({...result,generation:lease.generation,contentRevision:lease.contentRevision,sourceIdentity:lease.sourceIdentity});
  },
 });
}
