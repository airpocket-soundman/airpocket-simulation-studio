import {canonicalJson,getProjectRevision} from './project-revision.js';
import {createProjectFromBuiltin} from './project-import.js';
import {createStudioApi} from './studio-api.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const snapshot=studio=>JSON.parse(JSON.stringify(studio.exportProject()));
/** loadProject must synchronously validate and atomically commit its input. The
 * normalizeProject is a trusted synchronous pure host hook, never a wire option.
 * The candidate is prepared without touching result, case, measurement or print stores. */
export function createBuiltinProjectOperations({studio,isBusy=()=>false,normalizeProject=project=>project}={}){
 if(typeof studio?.exportProject!=='function'||typeof studio?.loadProject!=='function'||typeof isBusy!=='function'||typeof normalizeProject!=='function')throw TypeError('Built-in project creation requires a studio adapter');let locked=false;
 const check=guard=>{if(typeof guard!=='function'||!guard())throw Error('Project creation permission expired');if(isBusy())throw Error('Studio is busy');};
 return Object.freeze({
 async create(args={}, {guard=()=>true}={}){
  if(locked)throw Error('Built-in project creation in progress');check(guard);locked=true;
  try{
   if(!plain(args))throw Error('Invalid built-in project request');const command=JSON.parse(canonicalJson(args));if(Object.keys(command).some(key=>!['expectedRevision','source','name'].includes(key))||!Object.hasOwn(command,'source')||!revision(command.expectedRevision))throw Error('Invalid built-in project request');
   const before=snapshot(studio),serialized=canonicalJson(before),previousRevision=await getProjectRevision(before);check(guard);if(previousRevision!==command.expectedRevision)throw Error('Project revision conflict');if(canonicalJson(snapshot(studio))!==serialized)throw Error('Project changed during built-in creation');
   const candidate=createProjectFromBuiltin({source:command.source,...(Object.hasOwn(command,'name')?{name:command.name}:{})});if(normalizeProject.constructor?.name==='AsyncFunction')throw Error('Project normalization must be synchronous');const prepared=normalizeProject(structuredClone(candidate));if(prepared&&typeof prepared.then==='function'){Promise.resolve(prepared).catch(()=>{});throw Error('Project normalization must be synchronous');}const normalizedCandidate=JSON.parse(canonicalJson(prepared)),validation=createStudioApi();validation.loadProject(normalizedCandidate);const normalized=validation.exportProject(),response={schemaVersion:1,previousRevision,revision:await getProjectRevision(normalized),summary:validation.getSummary(),units:{geometry:'mm'}};
   check(guard);if(canonicalJson(snapshot(studio))!==serialized)throw Error('Project changed during built-in creation');studio.loadProject(normalized);return response;
  }finally{locked=false;}
 }
 });
}
