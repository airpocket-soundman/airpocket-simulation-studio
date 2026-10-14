import {canonicalJson,getProjectRevision} from './project-revision.js';
import {createProjectFromStl,MAX_IMPORT_BYTES} from './project-import.js';
import {createStudioApi} from './studio-api.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const snapshot=studio=>JSON.parse(canonicalJson(studio.exportProject()));
const aborted=signal=>{if(signal?.aborted)throw Error('Input import aborted');};
/** parseStep is a trusted host provider returning an existing-factory normalized
 * project. Its output is validated, but byte-to-CAD engineering correspondence
 * is not independently established here. loadProject must commit synchronously
 * and atomically. normalizeProject is a trusted synchronous host-only hook. */
export function createInputImportOperations({studio,parseStep,normalizeProject=project=>project,isBusy=()=>false}={}){
 if(typeof studio?.exportProject!=='function'||typeof studio?.loadProject!=='function'||parseStep!==undefined&&typeof parseStep!=='function'||typeof normalizeProject!=='function'||typeof isBusy!=='function')throw TypeError('Input import requires a studio adapter');
 let locked=false;
 const check=(guard,signal)=>{aborted(signal);if(typeof guard!=='function'||!guard())throw Error('Input import permission expired');if(isBusy())throw Error('Studio is busy');aborted(signal);};
 return Object.freeze({
  isBusy:()=>locked||isBusy(),
  async import(args,{guard=()=>true,signal}={}){
   if(locked)throw Error('Input import in progress');check(guard,signal);locked=true;
   try{
    if(!plain(args))throw Error('Invalid input import request');
    const descriptors=Object.getOwnPropertyDescriptors(args);
    if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!['expectedRevision','format','bytes','name','scaleToMm'].includes(key)||!Object.hasOwn(descriptors[key],'value')))throw Error('Invalid input import request');
    const supplied=descriptors.bytes?.value,view=supplied instanceof ArrayBuffer?new Uint8Array(supplied):supplied instanceof Uint8Array?supplied:null;
    if(!view||!view.byteLength||view.byteLength>MAX_IMPORT_BYTES)throw Error('Import requires nonempty bytes (maximum 50 MB)');
    const bytes=view.slice(),metadata=Object.fromEntries(Object.entries(descriptors).filter(([key])=>key!=='bytes').map(([key,d])=>[key,d.value])),command=JSON.parse(canonicalJson(metadata));
    if(!revision(command.expectedRevision)||!['step','stl'].includes(command.format)||Object.hasOwn(command,'name')&&(typeof command.name!=='string'||!command.name.trim()))throw Error('Invalid input import request');
    if(command.format==='step'&&Object.hasOwn(command,'scaleToMm'))throw Error('STEP scaleToMm is not accepted');
    if(command.format==='stl'&&(!Number.isFinite(command.scaleToMm)||command.scaleToMm<=0))throw Error('STL requires a positive explicit scaleToMm');
    if(command.format==='step'&&!parseStep)throw Error('STEP import provider unavailable');
    const before=snapshot(studio),serialized=canonicalJson(before),previousRevision=await getProjectRevision(before);
    check(guard,signal);if(previousRevision!==command.expectedRevision)throw Error('Project revision conflict');if(canonicalJson(snapshot(studio))!==serialized)throw Error('Project changed during input import');
    const options=Object.hasOwn(command,'name')?{name:command.name}:{};
    const candidate=command.format==='step'?await parseStep(bytes,options,{signal}):createProjectFromStl({bytes,scaleToMm:command.scaleToMm,...options});
    check(guard,signal);
    if(normalizeProject.constructor?.name==='AsyncFunction')throw Error('Project normalization must be synchronous');
    const prepared=normalizeProject(structuredClone(candidate));if(prepared&&typeof prepared.then==='function'){Promise.resolve(prepared).catch(()=>{});throw Error('Project normalization must be synchronous');}
    const validation=createStudioApi();validation.loadProject(JSON.parse(canonicalJson(prepared)));const normalized=validation.exportProject();
    const response={schemaVersion:1,previousRevision,revision:await getProjectRevision(normalized),summary:validation.getSummary(),units:{geometry:'mm'}};
    check(guard,signal);if(canonicalJson(snapshot(studio))!==serialized)throw Error('Project changed during input import');
    studio.loadProject(normalized);return response;
   }finally{locked=false;}
  }
 });
}
