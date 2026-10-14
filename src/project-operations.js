import {canonicalJson as canonical,getProjectRevision} from './project-revision.js';
export {getProjectRevision} from './project-revision.js';
import {createStudioApi} from './studio-api.js';

const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const integer=value=>Number.isInteger(value)&&value>=0;
const object=plain;
const string=value=>typeof value==='string';
const selectors={
  selectTriangles:[integer,value=>Array.isArray(value)&&value.every(integer),object],selectCadFace:[integer,integer],
  selectPlanarRegion:[integer,object],selectCylindricalRegion:[integer,object],
  clearSelection:[],addCondition:[object],removeCondition:[integer],selectCondition:[integer],
  replaceConditionRegion:[integer],reapplyConditionRegion:[integer],
  applyCatalogMaterial:[object],setMaterial:[string],setMaterialProperties:[object],setMaterialPreset:[string,object],
  setStudy:[object],setMeshSettings:[object],setInputProvenance:[object],setAnalysisIntent:[object]
};

/** Apply {method, args} commands atomically to saved project JSON.
 * expectedRevision refers to the exact input, before loadProject normalization.
 * No persistence, solving, or externally visible mutation occurs here.
 */
export async function applyProjectOperations(project,operations,{expectedRevision}={}) {
  // Snapshot before the first await so callers cannot change data mid-transaction.
  canonical(project);canonical(operations);
  project=structuredClone(project);operations=structuredClone(operations);
  const previousRevision=await getProjectRevision(project);
  if(expectedRevision!==undefined&&typeof expectedRevision!=='string')throw new TypeError('expectedRevision must be a string.');
  if(expectedRevision!==undefined&&expectedRevision!==previousRevision)throw Error('Project revision conflict.');
  if(!Array.isArray(operations))throw new TypeError('operations must be an array.');
  // Validate the complete command envelope before running any command.
  for(const operation of operations) {
    if(!plain(operation)||Object.keys(operation).some(key=>!['method','args'].includes(key))||!Object.hasOwn(operation,'method')||!Object.hasOwn(operation,'args')||typeof operation.method!=='string'||!Object.hasOwn(selectors,operation.method)||!Array.isArray(operation.args))throw new TypeError('Unsupported project operation; use {method, args}.');
    const checks=selectors[operation.method],minimum=operation.method==='selectTriangles'?2:checks.length;
    if(operation.args.length<minimum||operation.args.length>checks.length||!operation.args.every((arg,index)=>checks[index](arg)))throw new TypeError('Invalid arguments for '+operation.method+'.');
    if(operation.method==='selectTriangles'&&operation.args[2]&&Object.entries(operation.args[2]).some(([key,value])=>!['replace','erase'].includes(key)||typeof value!=='boolean'))throw new TypeError('Invalid triangle selection options.');
  }
  const api=createStudioApi();api.loadProject(project);
  const results=operations.map(({method,args})=>api[method](...structuredClone(args)));
  const output=api.exportProject();
  return {schemaVersion:1,project:output,previousRevision,revision:await getProjectRevision(output),results};
}
