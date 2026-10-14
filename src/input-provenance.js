// Pure JSON contract. Host integration chooses study-specific required pointers;
// this module does not infer physics requirements or verify source truth.
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const text=value=>typeof value==='string'&&value.trim().length>0;
function json(value){
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){if(Object.keys(value).length!==value.length)throw Error('Expected JSON data');for(const item of value)json(item);return;}
 if(!plain(value))throw Error('Expected JSON data');
 for(const key of Reflect.ownKeys(value)){if(typeof key!=='string'||!Object.getOwnPropertyDescriptor(value,key).enumerable||!('value' in Object.getOwnPropertyDescriptor(value,key)))throw Error('Expected JSON data');json(value[key]);}
}
function tokens(pointer){
 if(typeof pointer!=='string'||!pointer.startsWith('/')||/~(?![01])/u.test(pointer))throw Error('Expected non-root JSON pointer');
 return pointer.slice(1).split('/').map(part=>part.replace(/~1/g,'/').replace(/~0/g,'~'));
}
function read(project,pointer){
 let value=project;
 for(const token of tokens(pointer)){
  if(value===null||typeof value!=='object'||!own(value,token)||Array.isArray(value)&&!/^(0|[1-9][0-9]*)$/.test(token))return {exists:false};
  value=value[token];
 }
 return {exists:true,value};
}
function equal(a,b){
 if(a===b)return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>own(b,key)&&equal(a[key],b[key]));
}

/** schemaVersion:1, entries:[{pointer,value,source:{kind,reference?,revision?},
 * rationale,assumption:null|string,status:'confirmed'|'unconfirmed',applicability,
 * confirmation?:{by:'user',note}}]. value is the exact input snapshot, not confidence.
 */
export function createInputProvenance(entries=[]){
 const document={schemaVersion:1,entries};validateInputProvenance(document);return structuredClone(document);
}
export function validateInputProvenance(document){
 json(document);
 if(!plain(document)||document.schemaVersion!==1||!Array.isArray(document.entries))throw Error('Invalid input provenance document');
 const seen=new Set();
 for(const entry of document.entries){
  if(!plain(entry))throw Error('Invalid provenance entry');tokens(entry.pointer);
  if(seen.has(entry.pointer))throw Error('Duplicate provenance pointer');seen.add(entry.pointer);
  if(!own(entry,'value')||!plain(entry.source)||!['user-input','measured-document','cad','agent-proposal'].includes(entry.source.kind)||!text(entry.rationale)||!text(entry.applicability)||!['confirmed','unconfirmed'].includes(entry.status)||!(entry.assumption===null||text(entry.assumption)))throw Error('Invalid provenance entry');
  if(['measured-document','cad'].includes(entry.source.kind)&&(!text(entry.source.reference)||!text(entry.source.revision)))throw Error('Source reference and revision required');
  if(entry.confirmation!==undefined&&(!plain(entry.confirmation)||entry.confirmation.by!=='user'||!text(entry.confirmation.note)))throw Error('Invalid provenance confirmation');
 }
 return true;
}
const diagnostic=(code,target,evidence,suggestions)=>({code,severity:'error',target,evidence,suggestions,requiresUserIntent:true});

/** Legacy mode preserves old projects without metadata. quantitative/exploratory
 * are explicit new inspection modes, never implied by loading an old project.
 * requiredPointers must come from the selected study's physical-input contract.
 */
export function inspectInputProvenance(project,document,{mode='legacy',requiredPointers=[]}={}){
 if(!['legacy','quantitative','exploratory'].includes(mode)||!Array.isArray(requiredPointers))throw Error('Invalid provenance inspection options');
 json(project);for(const pointer of requiredPointers)tokens(pointer);
 const diagnostics=[],add=(...args)=>diagnostics.push(diagnostic(...args));
 if(document===undefined&&mode==='legacy')return {schemaVersion:1,mode,metadataAvailable:false,allowed:true,provisional:false,diagnostics};
 try{if(document!==undefined)validateInputProvenance(document);}catch(error){add('PROVENANCE_INVALID','/inputProvenance',{message:error.message},['Repair provenance schema without changing physical inputs']);return {schemaVersion:1,mode,metadataAvailable:true,allowed:false,provisional:false,diagnostics};}
 const entries=new Map((document?.entries??[]).map(entry=>[entry.pointer,entry]));
 let provisional=false;
 // Stale evidence is never silently accepted, even for optional recorded inputs.
 for(const entry of entries.values()){
  const current=read(project,entry.pointer);
  if(!current.exists||!equal(current.value,entry.value))add('PROVENANCE_STALE',entry.pointer,{recordedValue:entry.value,...current},['Review changed input and replace its provenance snapshot']);
 }
 for(const pointer of new Set(requiredPointers)){
  const current=read(project,pointer),entry=entries.get(pointer);
  if(!current.exists||current.value===null){add('INPUT_REQUIRED',pointer,{exists:current.exists},['Supply the required physical input from the user or a documented source']);continue;}
  if(!entry){add('PROVENANCE_REQUIRED',pointer,{value:current.value},['Record source, rationale, applicability and confirmation for this required input']);continue;}
  const confirmed=entry.status==='confirmed'&&(entry.source.kind!=='agent-proposal'||entry.confirmation?.by==='user');
  if(!confirmed){
   if(mode==='exploratory'&&text(entry.assumption)){provisional=true;continue;}
   add('INPUT_UNCONFIRMED',pointer,{status:entry.status,sourceKind:entry.source.kind,assumption:entry.assumption},['Confirm the physical input using user information or source evidence','For an exploratory run, explicitly record the assumption and select exploratory mode']);
  }
  if(entry.assumption!==null)provisional=true;
 }
 return {schemaVersion:1,mode,metadataAvailable:document!==undefined,allowed:diagnostics.length===0,provisional,diagnostics};
}
