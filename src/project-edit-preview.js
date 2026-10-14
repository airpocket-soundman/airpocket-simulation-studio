import {canonicalJson} from './project-revision.js';
import {applyProjectOperations} from './project-operations.js';
import {preflightProject} from './analysis-preflight.js';
import {createStudioApi} from './studio-api.js';
import {summarizeProjectChanges as changed} from './project-change-summary.js';

const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const hash=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
// Provenance diagnostics may contain complete current/recorded thermal meshes.
// Preserve decisions and locations while withholding those input payloads.
function compactEvidence(value,depth=0){
 if(Array.isArray(value))return {type:'array',length:value.length,omitted:true};
 if(typeof value==='string')return value.length<=400?value:{type:'string',length:value.length,omitted:true};
 if(plain(value)){
  const entries=Object.entries(value);if(depth>=3)return {type:'object',keyCount:entries.length,omitted:true};
  const out=Object.fromEntries(entries.slice(0,16).map(([key,v])=>[key,compactEvidence(v,depth+1)]));
  if(entries.length>16)out.omittedKeyCount=entries.length-16;return out;
 }
 return value;
}

/** Read-only dry run through the same semantic edit and preflight paths. No
 * solver, file publication or host adapter is invoked. Revisions bind the exact
 * candidate, including normalization; preflight success is not physical proof. */
export async function previewProjectOperations(project,operations,configuration={}, {normalizeProject}={}){
 if(!plain(configuration)||Reflect.ownKeys(configuration).some(key=>typeof key!=='string'||!['expectedRevision','expectedResultingRevision','options','operation','mode','target'].includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(configuration,key),'value')))throw TypeError('Invalid project edit preview configuration');
 const {expectedRevision,expectedResultingRevision,options={},operation='solve',mode,target='browser'}=configuration;
 if(!hash(expectedRevision)||expectedResultingRevision!==undefined&&!hash(expectedResultingRevision)||!plain(options)||!['mesh','solve'].includes(operation)||!['browser','node'].includes(target)||mode!==undefined&&!['legacy','quantitative','exploratory'].includes(mode))throw TypeError('Invalid project edit preview revision, options or context');
 // Detach every mutable input before the first asynchronous revision operation.
 const before=JSON.parse(canonicalJson(project)),commands=JSON.parse(canonicalJson(operations)),settings=JSON.parse(canonicalJson(options));
 const output=await applyProjectOperations(before,commands,{expectedRevision,expectedResultingRevision},{normalizeProject});
 const raw=preflightProject(output.project,settings,{target,operation,mode});
 const preflight={...raw,diagnostics:raw.diagnostics.slice(0,50).map(issue=>({...issue,...(Object.hasOwn(issue,'evidence')?{evidence:compactEvidence(issue.evidence)}:{})})),requiredPointers:raw.requiredPointers.slice(0,100),reportPage:{diagnosticsTotal:raw.diagnostics.length,diagnosticsTruncated:raw.diagnostics.length>50,requiredPointersTotal:raw.requiredPointers.length,requiredPointersTruncated:raw.requiredPointers.length>100}};
 const api=createStudioApi();api.loadProject(output.project);
 const response={schemaVersion:1,previousRevision:output.previousRevision,revision:output.revision,operationCount:commands.length,changedPointers:changed(before,output.project),summary:api.getSummary(),preflight,limitations:['Read-only preview; no live input, file or solver state is changed.','Changed arrays are reported at their whole-array JSON pointer; at most 100 pointers are returned.','Preflight diagnostic evidence arrays, long strings and deep or wide objects are summarized; inspect original input separately when reviewing evidence.','Preflight diagnostics are limited to 50 and required pointers to 100; use the existing preflight API for the complete report.','An allowed preflight does not prove mesh validity, boundary transfer, constraint rank, convergence or physical accuracy.']};
 if(output.normalization)response.normalization=output.normalization;
 if(new TextEncoder().encode(JSON.stringify(response)).length>65536)throw Object.assign(Error('Project edit preview response exceeds 65536 UTF-8 bytes'),{code:'EDIT_PREVIEW_RESPONSE_LIMIT'});
 return response;
}
