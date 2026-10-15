// Browser storage adapter for the measurement history panel.
// Interface (all async): get(key)->string|null, set(key,string), remove(key), keys()->string[].
// IndexedDB is preferred, localStorage is the fallback; every failure surfaces as a rejected
// promise so callers can ignore it. Storage is per-origin by construction and holds only
// measurement archives (no credentials, no tokens).
const DB_NAME='airpocket-measurement-history',STORE='kv',LS_PREFIX='airpocket-measurement-history:';
function idbRequest(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('IndexedDB request failed'));});}
export function createIndexedDbStorage(indexedDB){
 if(!indexedDB||typeof indexedDB.open!=='function')throw Error('IndexedDB unavailable');
 let opened;
 const open=()=>opened||=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{request.result.createObjectStore(STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('IndexedDB open failed'));request.onblocked=()=>reject(Error('IndexedDB blocked'));}).catch(error=>{opened=undefined;throw error;});
 const store=async mode=>(await open()).transaction(STORE,mode).objectStore(STORE);
 return Object.freeze({kind:'indexeddb',
  async get(key){const value=await idbRequest((await store('readonly')).get(key));return typeof value==='string'?value:null;},
  async set(key,value){await idbRequest((await store('readwrite')).put(value,key));},
  async remove(key){await idbRequest((await store('readwrite')).delete(key));},
  async keys(){return (await idbRequest((await store('readonly')).getAllKeys())).filter(key=>typeof key==='string');}});
}
export function createLocalStorageAdapter(localStorage){
 if(!localStorage)throw Error('localStorage unavailable');
 return Object.freeze({kind:'localstorage',
  async get(key){return localStorage.getItem(LS_PREFIX+key);},
  async set(key,value){localStorage.setItem(LS_PREFIX+key,value);},
  async remove(key){localStorage.removeItem(LS_PREFIX+key);},
  async keys(){const out=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(typeof k==='string'&&k.startsWith(LS_PREFIX))out.push(k.slice(LS_PREFIX.length));}return out;}});
}
// Never throws: returns an adapter whose operations reject when no storage is usable.
export function createBrowserMeasurementStorage({indexedDB,localStorage}={}){
 const candidates=[];
 try{candidates.push(createIndexedDbStorage(indexedDB));}catch{}
 try{candidates.push(createLocalStorageAdapter(localStorage));}catch{}
 const call=async(method,args)=>{let last=Error('Browser storage unavailable');for(const adapter of candidates){try{return await adapter[method](...args);}catch(error){last=error;}}throw last;};
 return Object.freeze({kind:candidates.map(a=>a.kind).join('+')||'none',get:(...a)=>call('get',a),set:(...a)=>call('set',a),remove:(...a)=>call('remove',a),keys:(...a)=>call('keys',a)});
}
