import {canonicalJson} from './project-revision.js';
import {validateComparisonViewSettings} from './comparison-view-settings.js';
const LIMIT=131072;
function record(raw){
 const value=typeof raw==='string'?JSON.parse(raw):JSON.parse(canonicalJson(raw));
 if(!value||value.version!==1||typeof value.enabled!=='boolean'||Object.keys(value).sort().join(',')!=='archive,enabled,version')throw Error('Invalid saved comparison settings');
 if(value.archive!==null)value.archive=validateComparisonViewSettings(value.archive);
 if(new TextEncoder().encode(canonicalJson(value)).length>LIMIT)throw Error('Saved comparison settings exceed 128 KiB');return value;
}

/** One opt-in portable preset. Loading never applies it or changes saved cases. */
export function createComparisonSettingsPersistence({api,storage,onChange=()=>{}}){
 let value={version:1,enabled:false,archive:null},error=null,generation=0,queue=Promise.resolve(),restoring=false,diskPromise,forgotten=false;
 const state=()=>({enabled:value.enabled,hasCandidate:value.archive!==null,error});
 const emit=()=>{onChange(state());return state();};
 const enqueue=work=>{const next=queue.then(work);queue=next.catch(()=>{});return next;};
 const readDisk=()=>diskPromise??=Promise.resolve().then(async()=>{const text=await storage.get();if(text===null)return {version:1,enabled:false,archive:null};if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('Invalid saved comparison settings');return record(text);});
 const write=async next=>{await storage.set(canonicalJson(record(next)));diskPromise=Promise.resolve(structuredClone(next));};
 const failed=err=>{error=err.message??String(err);return emit();};
 return {
  getState:state,
  async load(){if(forgotten)return state();const epoch=++generation;try{const stored=await readDisk();if(epoch!==generation)return state();value=structuredClone(stored);error=null;return emit();}catch(err){if(epoch===generation)return failed(err);return state();}},
  setEnabled(enabled){if(typeof enabled!=='boolean')return Promise.reject(Error('Invalid automatic saving choice'));++generation;value={...value,enabled};error=null;emit();return enqueue(async()=>{try{if(!forgotten&&!value.archive)try{const stored=await readDisk();if(!forgotten&&!value.archive&&stored.archive)value={...value,archive:structuredClone(stored.archive)};}catch{}await write(value);return emit();}catch(err){return failed(err);}});},
  saveCurrent(){if(!value.enabled||restoring)return Promise.resolve(state());const epoch=++generation;return enqueue(async()=>{if(epoch!==generation||!value.enabled)return state();try{const current=await api.get();if(epoch!==generation||!value.enabled)return state();if(!current.archive)return state();const next={version:1,enabled:true,archive:validateComparisonViewSettings(current.archive)};await write(next);if(epoch!==generation)return state();value=next;error=null;return emit();}catch(err){if(epoch===generation)return failed(err);return state();}});},
  async restore(){if(restoring)return state();const epoch=++generation;if(!value.archive)return state();const archive=structuredClone(value.archive);restoring=true;try{const current=await api.get();if(epoch!==generation)return state();await api.set({archive,expectedRevision:current.revision},{guard:()=>epoch===generation});if(epoch!==generation)return state();error=null;return emit();}catch(err){if(epoch===generation)return failed(err);return state();}finally{restoring=false;}},
  remove(){++generation;forgotten=true;value={version:1,enabled:false,archive:null};error=null;emit();return enqueue(async()=>{try{await write(value);return emit();}catch(err){return failed(err);}});}
 };
}
