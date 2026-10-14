// Transportable failure metadata is deliberately separate from legacy messages.
// Never serialize Error objects, stacks, causes, accessors or arbitrary payloads.
const limits={message:2000,target:300,code:96,suggestions:6,suggestion:300,diagnostics:8,bytes:16384,evidenceDepth:4,evidenceKeys:16,evidenceArray:16,evidenceString:400,evidenceNodes:256};
const stages=new Set(['preparation','mesh','boundary-transfer','constraints','temperature-transfer','material-evaluation','solve','postprocess','unknown']);
const fallbackCodes={preparation:'ANALYSIS_PREPARATION_FAILED',mesh:'ANALYSIS_MESH_FAILED','boundary-transfer':'ANALYSIS_BOUNDARY_TRANSFER_FAILED',constraints:'ANALYSIS_CONSTRAINTS_FAILED','temperature-transfer':'ANALYSIS_TEMPERATURE_TRANSFER_FAILED','material-evaluation':'ANALYSIS_MATERIAL_EVALUATION_FAILED',solve:'ANALYSIS_SOLVE_FAILED',postprocess:'ANALYSIS_POSTPROCESS_FAILED',unknown:'ANALYSIS_FAILED'};
const plain=v=>v!==null&&typeof v==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const data=(o,key)=>{try{if(o===null||!['object','function'].includes(typeof o))return undefined;const d=Object.getOwnPropertyDescriptor(o,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
const codeValid=v=>typeof v==='string'&&v.length<=limits.code&&/^ANALYSIS_[A-Z0-9_]+$/.test(v);
const bounded=(v,n,fallback='')=>typeof v==='string'?v.slice(0,n):fallback;
const stageOf=v=>stages.has(v)?v:'unknown';
const safeKey=k=>!['stack','cause','__proto__','constructor','prototype'].includes(k)&&k.length<=80;
function evidenceCopy(value,{validate=false}={}){
 let remaining=limits.evidenceNodes;
 function copy(v,depth){
  if(--remaining<0)throw Error('Evidence exceeds node limit');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(Number.isFinite(v))return v;throw Error('Nonfinite evidence');}
  if(typeof v==='string'){if(validate&&v.length>limits.evidenceString)throw Error('Oversized evidence string');return v.slice(0,limits.evidenceString);}
  if(depth>=limits.evidenceDepth)throw Error('Deep evidence');
  if(Array.isArray(v)){
   if(validate&&v.length>limits.evidenceArray)throw Error('Oversized evidence array');
   const out=[];for(let i=0;i<Math.min(v.length,limits.evidenceArray);i++){const item=data(v,String(i));if(item===undefined){if(validate)throw Error('Invalid evidence array');out.push(null);continue;}try{out.push(copy(item,depth+1));}catch(error){if(validate)throw error;out.push(null);}}
   if(validate&&Reflect.ownKeys(v).length!==v.length+1)throw Error('Decorated evidence array');return out;
  }
  if(!plain(v))throw Error('Non-JSON evidence');
  const names=Reflect.ownKeys(v);if(validate&&names.length>limits.evidenceKeys)throw Error('Oversized evidence object');
  const out={};let count=0;for(const key of names){if(typeof key!=='string'||!safeKey(key)){if(validate)throw Error('Unsafe evidence key');continue;}if(count>=limits.evidenceKeys)break;const descriptor=Object.getOwnPropertyDescriptor(v,key);if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value')){if(validate)throw Error('Evidence accessor');continue;}try{out[key]=copy(descriptor.value,depth+1);count++;}catch(error){if(validate)throw error;}}
  return out;
 }
 if(!plain(value)){if(validate)throw Error('Evidence must be a JSON object');return {};}
 return copy(value,0);
}
function exactRecord(v,keys){if(!plain(v))return false;const names=Reflect.ownKeys(v);return names.length===keys.length&&names.every(k=>typeof k==='string'&&keys.includes(k)&&Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));}
function validateDiagnostic(v){
 if(!exactRecord(v,['code','severity','stage','target','message','evidence','suggestions','requiresUserIntent'])||!codeValid(v.code)||v.severity!=='error'||!stages.has(v.stage)||typeof v.target!=='string'||v.target.length>limits.target||typeof v.message!=='string'||v.message.length>limits.message||typeof v.requiresUserIntent!=='boolean'||!Array.isArray(v.suggestions)||v.suggestions.length>limits.suggestions||Reflect.ownKeys(v.suggestions).length!==v.suggestions.length+1)throw Error('Invalid analysis diagnostic');
 const suggestions=[];for(let i=0;i<v.suggestions.length;i++){const s=data(v.suggestions,String(i));if(typeof s!=='string'||s.length>limits.suggestion)throw Error('Invalid analysis suggestion');suggestions.push(s);}
 return {code:v.code,severity:'error',stage:v.stage,target:v.target,message:v.message,evidence:evidenceCopy(v.evidence,{validate:true}),suggestions,requiresUserIntent:v.requiresUserIntent};
}
function byteSize(v){return new TextEncoder().encode(JSON.stringify(v)).byteLength;}
function validateFailure(v){
 try{
  if(!exactRecord(v,['schemaVersion','code','stage','message','diagnostics'])||v.schemaVersion!==1||!codeValid(v.code)||!stages.has(v.stage)||typeof v.message!=='string'||v.message.length>limits.message||!Array.isArray(v.diagnostics)||v.diagnostics.length<1||v.diagnostics.length>limits.diagnostics||Reflect.ownKeys(v.diagnostics).length!==v.diagnostics.length+1)return null;
  const diagnostics=[];for(let i=0;i<v.diagnostics.length;i++)diagnostics.push(validateDiagnostic(data(v.diagnostics,String(i))));
  if(diagnostics[0].code!==v.code||diagnostics[0].stage!==v.stage||diagnostics[0].message!==v.message)return null;
  const out={schemaVersion:1,code:v.code,stage:v.stage,message:v.message,diagnostics};return byteSize(out)<=limits.bytes?out:null;
 }catch{return null;}
}
function diagnostic(code,message,{stage='unknown',target='/',evidence={},suggestions=[],requiresUserIntent=true}={}){
 let cleanEvidence;try{cleanEvidence=evidenceCopy(evidence);}catch{cleanEvidence={};}
 const cleanSuggestions=[];if(Array.isArray(suggestions))for(let i=0;i<Math.min(suggestions.length,limits.suggestions);i++){const value=data(suggestions,String(i));if(typeof value==='string')cleanSuggestions.push(value.slice(0,limits.suggestion));}
 return {code:codeValid(code)?code:fallbackCodes[stageOf(stage)],severity:'error',stage:stageOf(stage),target:bounded(target,limits.target,'/'),message:bounded(message,limits.message,'Analysis failed'),evidence:cleanEvidence,suggestions:cleanSuggestions,requiresUserIntent:typeof requiresUserIntent==='boolean'?requiresUserIntent:true};
}
function fromDiagnostic(d){let out={schemaVersion:1,code:d.code,stage:d.stage,message:d.message,diagnostics:[d]};if(byteSize(out)>limits.bytes)out={...out,diagnostics:[{...d,evidence:{}}]};if(byteSize(out)>limits.bytes)out={...out,diagnostics:[{...out.diagnostics[0],suggestions:[]}]};return out;}
export function analysisError(code,message,options={}){
 const error=new Error(message);error.analysisDiagnostic=diagnostic(code,error.message,options);return error;
}
/** Validated detached metadata only. Aggregate cleanup errors retain the first
 * available primary diagnostic, without relabelling cleanup as a solver cause. */
export function getAnalysisFailure(error){
 function find(value,depth){
  if(depth>3)return null;
  const failure=validateFailure(data(value,'analysisFailure'));if(failure)return failure;
  try{const tagged=validateDiagnostic(data(value,'analysisDiagnostic'));const out=fromDiagnostic(tagged);if(validateFailure(out))return out;}catch{}
  const errors=data(value,'errors');if(Array.isArray(errors))for(let i=0;i<Math.min(errors.length,8);i++){const found=find(data(errors,String(i)),depth+1);if(found)return found;}
  return null;
 }
 try{return find(error,0);}catch{return null;}
}
export function createAnalysisFailure(error,{stage='unknown'}={}){
 const existing=getAnalysisFailure(error);if(existing)return existing;
 const message=typeof error==='string'?error:data(error,'message');return fromDiagnostic(diagnostic(fallbackCodes[stageOf(stage)],message,{stage:stageOf(stage)}));
}
export function restoreAnalysisError(legacyMessage,failure){
 const error=new Error(legacyMessage),validated=validateFailure(failure);if(validated){error.analysisFailure=validated;error.code=validated.code;}return error;
}
