import {getProjectRevision,canonicalJson} from './project-revision.js';
import {validateViewSettings} from './view-settings.js';

const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const keys=(v,allowed)=>plain(v)&&Object.keys(v).length===allowed.length&&allowed.every(k=>Object.hasOwn(v,k));
const revision=v=>typeof v==='string'&&/^sha256:[0-9a-f]{64}$/.test(v);
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const resultKeys=['field','modeIndex','frameIndex','deformScale','surface','surfaceWire','volumeWire','section','colorRange','camera'];
const setupKeys=['clipEnabled','flip','axis','position','opacity','meshCount','hiddenParts'];
function resultSettings(s){
 if(!keys(s,resultKeys)||!['displacement','stress','plasticStrain','temperature','heatFlux','instantPressure','pressure','spl','phase','speed','fluidPressure'].includes(s.field)||!Number.isFinite(s.deformScale)||s.deformScale<0)throw Error('Invalid named result settings');
 for(const k of ['surface','surfaceWire','volumeWire','section'])if(typeof s[k]!=='boolean')throw Error('Invalid result layer');
 for(const k of ['modeIndex','frameIndex'])if(s[k]!==null&&(!Number.isSafeInteger(s[k])||s[k]<0))throw Error('Invalid result index');
 if((s.modeIndex!==null&&s.field!=='displacement')||(s.frameIndex!==null&&s.field!=='instantPressure')||(s.field==='instantPressure'&&s.frameIndex===null))throw Error('Result index and field mismatch');
 const c=s.camera;if(!keys(c,['position','target','up','fov'])||![c.position,c.target,c.up].every(vector)||!Number.isFinite(c.fov)||c.fov<=0||c.fov>=180)throw Error('Invalid result camera');
 const d=c.target.map((v,i)=>v-c.position[i]),a=Math.hypot(...d),b=Math.hypot(...c.up),cross=[d[1]*c.up[2]-d[2]*c.up[1],d[2]*c.up[0]-d[0]*c.up[2],d[0]*c.up[1]-d[1]*c.up[0]];
 const crossLength=Math.hypot(...cross);if(!d.every(Number.isFinite)||![a,b,crossLength,a*b].every(Number.isFinite)||a<=1e-9||b<=1e-9||crossLength<=a*b*1e-9)throw Error('Degenerate result camera');
 if(s.colorRange!==null){const r=s.colorRange;if(!keys(r,['field','minimum','maximum'])||r.field!==s.field||!Number.isFinite(r.minimum)||!Number.isFinite(r.maximum)||r.minimum>=r.maximum)throw Error('Invalid result color range');}
 return s;
}
function setupSettings(s){if(!keys(s,setupKeys))throw Error('Invalid setup settings');validateViewSettings(s);if(new Set(s.hiddenParts).size!==s.hiddenParts.length)throw Error('Duplicate hidden part');return s;}
function validName(name){if(typeof name!=='string'||name.length>100||!name.trim()||/[\u0000-\u001f\u007f]/.test(name))throw Error('Invalid named view name');return name.trim();}
function storedThermalTime(current){
 if(current.kind!=='thermal'||current.physicalTimeSeconds===undefined)return undefined;
 if(current.interpolated||current.timeSelection!=='stored-frames-only')throw Error('Named views support stored thermal times only; choose a stored frame before saving');
 return {kind:'thermal',timeSeconds:current.physicalTimeSeconds};
}
function validateThermalTime(time,result){
 if(!keys(time,['kind','timeSeconds'])||time.kind!=='thermal'||!Number.isFinite(time.timeSeconds)||time.timeSeconds<0||!['temperature','heatFlux'].includes(result.field)||result.frameIndex!==null||result.modeIndex!==null)throw Error('Invalid named thermal time');
}
function timedSettings(state,time){const settings=structuredClone(state);if(time){delete settings.frameIndex;settings.timeSeconds=time.timeSeconds;}return settings;}
export function validateNamedViewArchive(input){
 if(!keys(input,['version','views'])||input.version!==1||!Array.isArray(input.views)||input.views.length>16)throw Error('Invalid named view archive');
 const ids=new Set();for(const v of input.views){if(!keys(v,['id','name','resultRevision','result','setup',...(Object.hasOwn(v??{},'thermalTime')?['thermalTime']:[])])||typeof v.id!=='string'||!v.id.length||v.id.length>200||/[\u0000-\u001f\u007f]/.test(v.id)||ids.has(v.id)||!revision(v.resultRevision))throw Error('Invalid or duplicate named view');ids.add(v.id);if(validName(v.name)!==v.name)throw Error('Named view name must be trimmed');resultSettings(v.result);setupSettings(v.setup);if(Object.hasOwn(v,'thermalTime'))validateThermalTime(v.thermalTime,v.result);}
 return structuredClone(input);
}

/** Portable presentation snapshots. Physical results remain in their original archive. */
export function createNamedResultViews({resultView,setupView,isBusy=()=>false,id=()=>crypto.randomUUID(),getTimeView,restoreTimeView}){
 let archive={version:1,views:[]},locked=false;
 const check=guard=>{if(isBusy()||!guard())throw Error('Viewer busy or command expired');};
 const archiveRevision=()=>getProjectRevision(archive);
 const item=async v=>({viewId:v.id,revision:await getProjectRevision(v),name:v.name,resultRevision:v.resultRevision,...(v.thermalTime?{thermalTime:structuredClone(v.thermalTime)}:{})});
 async function listing(){const snapshot=structuredClone(archive);return {schemaVersion:1,archiveRevision:await getProjectRevision(snapshot),views:await Promise.all(snapshot.views.map(item))};}
 async function mutate(guard,action){if(locked)throw Error('Named view operation in progress');check(guard);locked=true;try{return await action();}finally{locked=false;}}
 async function expectedArchive(expected){if(!revision(expected)||expected!==await archiveRevision())throw Error('Named view archive revision conflict');}
 async function selected(viewId,expected){const v=archive.views.find(v=>v.id===viewId);if(!v||!revision(expected)||await getProjectRevision(v)!==expected)throw Error('Named view revision conflict');return structuredClone(v);}
 return Object.freeze({
  // Host-only transaction participant. callback must synchronously validate then
  // atomically replace host state; it must never return a promise or throw after mutation.
  async prepareArchiveReplacement({archive:input,expectedArchiveRevision}={},{guard=()=>true}={}){
   if(locked)throw Error('Named view operation in progress');check(guard);const before=archive,next=validateNamedViewArchive(input);
   if(!revision(expectedArchiveRevision)||await getProjectRevision(before)!==expectedArchiveRevision)throw Error('Named view archive revision conflict');
   const response={schemaVersion:1,archiveRevision:await getProjectRevision(next),views:await Promise.all(next.views.map(item))};
   if(archive!==before)throw Error('Named view archive revision conflict');check(guard);let consumed=false;
   return Object.freeze({commit(callback){if(consumed)throw Error('Named view replacement already committed');if(typeof callback!=='function'||callback.constructor?.name==='AsyncFunction')throw Error('Named view replacement requires a synchronous host callback');if(locked)throw Error('Named view operation in progress');if(archive!==before)throw Error('Named view archive revision conflict');check(guard);locked=true;
    try{const value=callback();if(value&&typeof value.then==='function')throw Error('Named view replacement requires a synchronous host callback');archive=next;consumed=true;return response;}finally{locked=false;}
   }});
  },
  // Host-only synchronous check for multi-archive read transactions.
  matchesArchive:value=>canonicalJson(archive)===canonicalJson(value),
  list:listing,
  async export(){return validateNamedViewArchive(archive);},
  async save({name,expectedResultRevision,expectedArchiveRevision}={},{guard=()=>true}={}){return mutate(guard,async()=>{name=validName(name);await expectedArchive(expectedArchiveRevision);if(archive.views.length>=16)throw Error('Named view limit reached');const current=await resultView.get();if(!revision(expectedResultRevision)||current.resultRevision!==expectedResultRevision)throw Error('Displayed result revision conflict');const thermalTime=storedThermalTime(current),v={id:id(),name,resultRevision:current.resultRevision,result:structuredClone(current.state),setup:structuredClone(setupView.get()),...(thermalTime?{thermalTime}:{})};const next=validateNamedViewArchive({version:1,views:[...archive.views,v]});const summary=await item(v),nextRevision=await getProjectRevision(next),latest=await resultView.get();if(latest.resultRevision!==current.resultRevision||JSON.stringify(latest.state)!==JSON.stringify(current.state)||JSON.stringify(storedThermalTime(latest))!==JSON.stringify(thermalTime)||JSON.stringify(setupView.get())!==JSON.stringify(v.setup))throw Error('Viewer changed during named view snapshot');check(guard);archive=next;return {...summary,archiveRevision:nextRevision};});},
  async remove({viewId,expectedRevision}={},{guard=()=>true}={}){return mutate(guard,async()=>{await selected(viewId,expectedRevision);const next={version:1,views:archive.views.filter(v=>v.id!==viewId)};const nextRevision=await getProjectRevision(next);check(guard);archive=next;return {viewId,removed:true,archiveRevision:nextRevision};});},
  async import({archive:input,expectedArchiveRevision}={},{guard=()=>true}={}){return mutate(guard,async()=>{const next=validateNamedViewArchive(input);await expectedArchive(expectedArchiveRevision);const nextRevision=await getProjectRevision(next);check(guard);archive=next;return {schemaVersion:1,archiveRevision:nextRevision,views:await Promise.all(next.views.map(item))};});},
  async apply({viewId,expectedRevision,expectedResultRevision}={},{guard=()=>true}={}){return mutate(guard,async()=>{
   const v=await selected(viewId,expectedRevision);if(expectedResultRevision!==v.resultRevision)throw Error('Named view result revision conflict');const previous=await resultView.get(),setup=structuredClone(setupView.get());if(previous.resultRevision!==v.resultRevision)throw Error('Displayed result revision conflict');if(setup.meshCount!==v.setup.meshCount)throw Error('Setup mesh count conflict');check(guard);
   if(v.thermalTime&&previous.kind!=='thermal')throw Error('Named thermal time requires a thermal result');
   const interpolated=previous.kind==='thermal'&&previous.interpolated;
   if(v.thermalTime&&interpolated&&(!getTimeView||!restoreTimeView))throw Error('Cannot restore interpolated thermal time with this named view adapter');
   const previousTime=previous.kind==='thermal'&&!interpolated&&previous.timeSelection==='stored-frames-only'?{kind:'thermal',timeSeconds:previous.physicalTimeSeconds}:undefined;
   const savedTime=v.thermalTime&&getTimeView&&restoreTimeView?getTimeView():undefined;
   const result=await resultView.set({expectedResultRevision,settings:timedSettings(v.result,v.thermalTime)},{guard:()=>guard()&&!isBusy()});
   try{check(guard);if(setupView.get().meshCount!==v.setup.meshCount)throw Error('Setup mesh count conflict');setupView.set(structuredClone(v.setup));}
   catch(error){const errors=[error];try{setupView.set(setup);}catch(e){errors.push(e);}try{await resultView.set({expectedResultRevision,settings:timedSettings(previous.state,v.thermalTime?previousTime:undefined)});}catch(e){errors.push(e);}try{if(savedTime!==undefined)restoreTimeView(savedTime);}catch(e){errors.push(e);}if(errors.length>1)throw new AggregateError(errors,'Named view update and restoration failed');throw error;}
   return {...await item(v),resultView:result};
  });}
 });
}
