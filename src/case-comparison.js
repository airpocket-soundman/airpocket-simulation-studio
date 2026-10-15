import {canonicalJson,getProjectRevision} from './project-revision.js';
import {resultFields} from './result-view-api.js';
import {sampleDisplayedResult} from './probe.js';
import {validateRuntimeIdentity} from './runtime-identity.js';

const MAX_BYTES=65536;
const error=(code,message)=>Object.assign(Error(message),{code});
const requestError=message=>error('CASE_COMPARISON_REQUEST_INVALID',message);
const selectorError=message=>error('CASE_COMPARISON_SELECTOR_INVALID',message);
const dataError=(message,cause)=>Object.assign(error('CASE_COMPARISON_DATA_INVALID',message),cause===undefined?{}:{cause});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=Number.isFinite;
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;
const referenceKeys=['caseId','expectedRevision','field','modeIndex','frameIndex','bodyIndex','elementIndex'];
// Only recognized sampling domain errors may make a row unavailable; everything else fails the batch.
const domain={'Probe point is outside the analysis mesh':'outside-mesh','Probe point belongs to multiple bodies; specify bodyIndex':'ambiguous-body'};
const selectorMessages=new Set(['Invalid probe element','Invalid probe body','Unknown vibration mode','Invalid displayed acoustic frame']);
const measuredKeys={displacement:['displacementMm','magnitudeMm'],stress:['vonMisesPa'],plasticStrain:['equivalentPlasticStrain'],temperature:['temperature'],heatFlux:['flux'],instantPressure:['pressurePa'],pressure:['pressureReal','pressureImag','peakPressurePa'],spl:['splDb'],phase:['phase'],speed:['speedMs'],fluidPressure:['pressurePa']};
// Raw units of sampleDisplayedResult values; resultFields units (MPa, %) are display-only.
const rawUnits={displacementMm:'mm',magnitudeMm:'mm',vonMisesPa:'Pa',equivalentPlasticStrain:'1',temperature:'degC',flux:'W/m2',pressurePa:'Pa',pressureReal:'Pa',pressureImag:'Pa',peakPressurePa:'Pa',splDb:'dB',phase:'rad',speedMs:'m/s'};
const validValue=value=>finite(value)||Array.isArray(value)&&value.length===3&&value.every(finite);
const sameTime=(a,b)=>a===b;
const difference=(a,b)=>{const d=a-b;if(!finite(d))throw dataError('Difference is not finite');return d;};

function parse(raw){
 let value;
 try{value=JSON.parse(canonicalJson(raw));}catch{throw requestError('Request must be plain JSON data');}
 if(!plain(value)||Object.keys(value).some(key=>!['references','point'].includes(key)))throw requestError('Supply only references and optional point');
 const {references,point}=value;
 if(!Array.isArray(references)||references.length<1||references.length>8)throw requestError('Supply 1 to 8 references');
 if(point!==undefined&&(!Array.isArray(point)||point.length!==3||!point.every(finite)))throw requestError('point must contain three finite numbers');
 const ids=new Set();
 for(const ref of references){
  if(!plain(ref)||Object.keys(ref).some(key=>!referenceKeys.includes(key)))throw requestError('Invalid reference keys');
  if(typeof ref.caseId!=='string'||!ref.caseId||ref.caseId.length>200||typeof ref.expectedRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(ref.expectedRevision))throw requestError('Supply caseId and expectedRevision from list');
  if(typeof ref.field!=='string'||!ref.field||ref.field.length>50)throw requestError('Each reference needs an explicit field');
  for(const key of ['modeIndex','frameIndex','bodyIndex','elementIndex'])if(ref[key]!==undefined&&!nonnegative(ref[key]))throw requestError(key+' must be a nonnegative integer');
  if(point===undefined&&(ref.bodyIndex!==undefined||ref.elementIndex!==undefined))throw requestError('bodyIndex and elementIndex require point');
  if(ids.has(ref.caseId))throw requestError('Duplicate caseId');
  ids.add(ref.caseId);
 }
 return value;
}

// Never defaults a missing mode/frame: modal and transient results require explicit stored indices.
function select(ref,result){
 const field=resultFields(result).find(f=>f.id===ref.field);
 if(!field)throw selectorError('Field is unavailable for this result');
 const selection={field:field.id,displayUnit:field.unit};
 if(result.kind==='modal'){
  if(ref.modeIndex===undefined)throw selectorError('Specify an explicit stored modeIndex for modal results');
  const mode=Array.isArray(result.modes)?result.modes[ref.modeIndex]:undefined;
  if(!mode)throw selectorError('Unknown stored mode index');
  if(!finite(mode.frequencyHz))throw dataError('Stored mode frequency is corrupt');
  Object.assign(selection,{modeIndex:ref.modeIndex,frequencyHz:mode.frequencyHz,modeInterpretation:'normalized-shape-not-dynamic-response',normalization:'maximum modal displacement = 1 mm'});
 }else if(ref.modeIndex!==undefined)throw selectorError('This result has no stored modes');
 if(result.kind==='acousticTransient'){
  if(ref.frameIndex===undefined)throw selectorError('Specify an explicit stored frameIndex for transient results');
  const frame=Array.isArray(result.snapshots)?result.snapshots[ref.frameIndex]:undefined;
  if(!frame)throw selectorError('Unknown stored frame index');
  if(!finite(frame.time))throw dataError('Stored frame time is corrupt');
  Object.assign(selection,{frameIndex:ref.frameIndex,timeSeconds:frame.time,timeSelection:'stored-frames-only'});
 }else if(ref.frameIndex!==undefined)throw selectorError('This result has no stored time frames');
 if(result.kind==='acoustic'){if(finite(result.frequency))selection.frequencyHz=result.frequency;if(!finite(result.referencePressurePa)||result.referencePressurePa<=0)throw dataError('Stored acoustic reference pressure is corrupt');selection.referencePressurePa=result.referencePressurePa;}
 return selection;
}

// A selected body or element must exist in the stored mesh; only a real selection with an outside point is "unavailable".
function checkBodies(ref,mesh){
 const bodies=mesh.nodeBodies;
 if(bodies!==undefined&&(!Array.isArray(mesh.nodes)||!Array.isArray(bodies)||bodies.length!==mesh.nodes.length/3||!bodies.every(nonnegative)))throw dataError('Stored body identifiers are corrupt');
 if(ref.elementIndex!==undefined&&!(Array.isArray(mesh.tetrahedra)&&ref.elementIndex<mesh.tetrahedra.length))throw selectorError('Unknown stored element index');
 if(ref.bodyIndex===undefined)return;
 if(!bodies)throw selectorError('This stored case has no body metadata; bodyIndex cannot be used');
 if(!bodies.includes(ref.bodyIndex))throw selectorError('Unknown stored body index');
 if(ref.elementIndex!==undefined){const tet=mesh.tetrahedra[ref.elementIndex];if(!Array.isArray(tet)||bodies[tet[0]]!==ref.bodyIndex)throw selectorError('elementIndex does not belong to bodyIndex');}
}

function summarize(output){
 const calculation=output.calculation,options={},mesh=output.mesh;
 if(!plain(calculation))throw dataError('Saved calculation is missing');
 for(const [key,type] of [['method','string'],['size','number'],['adaptive','boolean'],['maxRounds','number']]){
  const value=calculation.options?.[key];
  if(value===undefined)continue;
  if(typeof value!==type||type==='string'&&value.length>50||type==='number'&&!finite(value))throw dataError('Invalid calculation summary');
  options[key]=value;
 }
 // The engine bound matches runtime-identity's actualEngine (200); valid WebGPU adapter names exceed 50.
 for(const [value,max] of [[calculation.operation,50],[output.result.engine,200]])if(value!==undefined&&(typeof value!=='string'||value.length>max))throw dataError('Invalid calculation summary');
 const nodeCount=mesh.summary?.nodeCount,elementCount=mesh.summary?.elementCount;
 if(!nonnegative(nodeCount)||!nonnegative(elementCount)||!Array.isArray(mesh.surface))throw dataError('Invalid mesh summary');
 return {
  calculation:{...(calculation.operation!==undefined?{operation:calculation.operation}:{}),options,...(output.result.engine!==undefined?{engine:output.result.engine}:{})},
  mesh:{nodeCount,elementCount,surfaceFaceCount:mesh.surface.length},
  runtimeIdentity:Object.hasOwn(calculation,'runtimeIdentity')?structuredClone(validateRuntimeIdentity(calculation.runtimeIdentity,{allowUndefined:false})):{recorded:false}
 };
}

function assess(output){
 const value=output.result.analysisAssessment??output.analysisAssessment;
 if(value===undefined||value===null)return {recorded:false};
 if(!plain(value))throw dataError('Invalid analysis assessment');
 const out={recorded:true},known=['mode','provisional','completePreflight'];
 for(const key of known){
  if(value[key]===undefined)continue;
  const type=key==='mode'?'string':'boolean';
  if(typeof value[key]!==type||type==='string'&&value[key].length>100)throw dataError('Invalid analysis assessment');
  out[key]=value[key];
 }
 const omitted=Object.keys(value).filter(key=>!known.includes(key)).sort();
 return {...out,omittedFields:omitted.slice(0,20).map(key=>key.slice(0,60)),omittedFieldCount:omitted.length,omissionReason:'assessment details omitted to keep the response bounded'};
}

function measure(sample,selection,field){
 if(!plain(sample)||!nonnegative(sample.element))throw dataError('Sampled element is corrupt');
 const values={},units={};
 for(const key of measuredKeys[field]){if(!validValue(sample[key]))throw dataError('Sampled field is corrupt');values[key]=sample[key];units[key]=rawUnits[key];}
 if(selection.timeSeconds!==undefined&&sample.time!==selection.timeSeconds)throw dataError('Sampled time does not match the selected stored frame');
 return {element:sample.element,...(nonnegative(sample.bodyIndex)?{bodyIndex:sample.bodyIndex}:{}),values,units};
}

function compareRows(rows,point){
 if(point===undefined)return {comparable:false,reasons:[{code:'no-point-requested'}],deltas:[]};
 const reasons=[],add=(code,caseId)=>reasons.push(caseId===undefined?{code}:{code,caseId}),first=rows[0];
 if(rows.length<2)add('single-reference');
 for(const row of rows)if(row.unavailable)add('point-unavailable',row.reference.caseId);
 for(const row of rows.slice(1)){
  const a=first.selection,b=row.selection,id=row.reference.caseId;
  if(first.kind!==row.kind)add('different-kind',id);
  if(a.field!==b.field)add('different-field',id);
  if(a.displayUnit!==b.displayUnit)add('different-unit',id);
  if((a.timeSeconds!==undefined||b.timeSeconds!==undefined)&&!(a.timeSeconds!==undefined&&b.timeSeconds!==undefined&&sameTime(a.timeSeconds,b.timeSeconds)))add('different-time',id);
  if(first.kind==='acoustic'&&row.kind==='acoustic'){if(a.frequencyHz===undefined||b.frequencyHz===undefined)add('unrecorded-frequency',id);else if(a.frequencyHz!==b.frequencyHz)add('different-frequency',id);if(a.field==='spl'&&b.field==='spl'&&a.referencePressurePa!==b.referencePressurePa)add('different-reference-pressure',id);}
 }
 if(rows.some(row=>row.kind==='modal'))add('normalized-modal-shape');
 const deltas=reasons.length?[]:rows.slice(1).map(row=>({caseId:row.reference.caseId,units:row.measurement.units,values:Object.fromEntries(Object.entries(row.measurement.values).map(([key,value])=>{const base=first.measurement.values[key];return [key,Array.isArray(value)?value.map((v,i)=>difference(v,base[i])):difference(value,base)];}))}));
 return {comparable:!reasons.length,baselineCaseId:first.reference.caseId,basis:'raw stored-field difference (case minus baseline) at the same global point; no time or mode interpolation; equal inputs are not asserted',reasons,deltas};
}

export function createCaseComparisonApi({cases,maxResponseBytes=MAX_BYTES}={}){
 if(!cases||typeof cases.readSource!=='function'||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>MAX_BYTES)throw TypeError('Invalid case comparison adapter');
 const expired=guard=>{if(!guard())throw error('CASE_COMMAND_EXPIRED','Case comparison expired or connection was revoked');};
 async function inspect(ref,point,guard,leases){
  expired(guard);
  const lease=await cases.readSource({caseId:ref.caseId,expectedRevision:ref.expectedRevision},{guard});
  if(!lease||typeof lease.assertCurrent!=='function')throw dataError('Invalid case source lease');
  leases.push(lease);
  expired(guard);lease.assertCurrent();
  const output=lease.output;
  if(lease.caseId!==ref.caseId||lease.revision!==ref.expectedRevision)throw error('CASE_REVISION_CONFLICT','Case lease does not match the requested reference');
  if(!plain(output)||!plain(output.result)||!plain(output.mesh)||!plain(output.input)||typeof lease.name!=='string'||lease.name.length>100)throw dataError('Invalid saved case output');
  const selection=select(ref,output.result),{calculation,mesh,runtimeIdentity}=summarize(output),analysisAssessment=assess(output);
  const [inputRevision,resultRevision]=await Promise.all([getProjectRevision(output.input),getProjectRevision(output)]);
  expired(guard);lease.assertCurrent();
  const row={reference:{caseId:ref.caseId,expectedRevision:ref.expectedRevision},name:lease.name,inputRevision,resultRevision,kind:output.result.kind,selection,calculation,mesh,runtimeIdentity,analysisAssessment};
  if(point===undefined)return row;
  checkBodies(ref,output.mesh);
  let sample;
  try{sample=sampleDisplayedResult(output.mesh,output.result,point,{bodyIndex:ref.bodyIndex,elementIndex:ref.elementIndex},{modeIndex:ref.modeIndex,frameIndex:ref.frameIndex});}
  catch(cause){
   const reason=Object.hasOwn(domain,cause?.message)?domain[cause.message]:undefined;
   if(reason){row.unavailable={reason};return row;}
   if(selectorMessages.has(cause?.message))throw selectorError(cause.message);
   throw dataError('Stored result could not be sampled',cause);
  }
  row.measurement=measure(sample,selection,ref.field);
  return row;
 }
 return Object.freeze({
  async compare(raw,{guard=()=>true}={}){
   if(typeof guard!=='function')throw TypeError('Case comparison guard must be a function');
   expired(guard);
   const request=parse(raw),leases=[],rows=[];
   // readSource leases are exclusive, so references are read one at a time.
   for(const ref of request.references)rows.push(await inspect(ref,request.point,guard,leases));
   const response=JSON.parse(JSON.stringify({schemaVersion:1,...(request.point?{point:request.point}:{}),references:rows,comparison:compareRows(rows,request.point),bounds:{maxReferences:8,maxResponseBytes}}));
   if(new TextEncoder().encode(JSON.stringify(response)).byteLength>maxResponseBytes)throw error('CASE_COMPARISON_RESPONSE_TOO_LARGE','Comparison response exceeds '+maxResponseBytes+' UTF-8 bytes');
   expired(guard);
   for(const lease of leases)lease.assertCurrent();
   return response;
  }
 });
}
