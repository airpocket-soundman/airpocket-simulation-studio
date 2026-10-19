import {canonicalJson,getProjectRevision} from './project-revision.js';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const roots={project:'',study:'/study',material:'/materialProperties',conditions:'/conditions',provenance:'/inputProvenance',selection:'/selection',source:'/sourceModel',meshes:'/meshes',meshSettings:'/meshSettings',units:'/units',intent:'/analysisIntent'};
const fail=(code,message)=>Object.assign(new TypeError(message),{code});
const argument=message=>fail('INPUT_INSPECTION_ARGUMENT_INVALID',message);
const escape=v=>v.replace(/~/g,'~0').replace(/\//g,'~1');
const materialUnits={youngModulus:'Pa',poissonRatio:'1',density:'kg/m3',strength:'Pa',conductivity:'W/(m*K)',specificHeat:'J/(kg*K)',expansion:'1/K',temperatureMin:'degC',temperatureMax:'degC'};
const studyUnits={thermalSnapshotCount:'count',thermalSnapshotBudgetBytes:'byte',acousticSnapshotCount:'count',acousticSnapshotBudgetBytes:'byte',temperature:'degC',referenceTemperature:'degC',materialTemperature:'degC',gravity:'m/s2',initialTemperature:'degC',timeStep:'s',volumetricSource:'W/m3',frequency:'Hz',soundSpeed:'m/s',airDensity:'kg/m3',lossFactor:'1',referencePressurePa:'Pa',acousticDuration:'s',pulseWidth:'s',acousticTimeStep:'s',dampingRate:'1/s',directivityDistanceMm:'mm',freeStreamVelocity:'m/s',referenceLengthMm:'mm',pressureDropPa:'Pa',dynamicViscosity:'Pa*s',fluidDensity:'kg/m3',fluidSoundSpeed:'m/s'};
function tokens(pointer){
 if(typeof pointer!=='string'||pointer.length>2048||pointer!==''&&!pointer.startsWith('/')||/~(?:[^01]|$)/.test(pointer))throw argument('Use an absolute JSON Pointer with ~0/~1 escapes (maximum 2048 characters)');
 return pointer===''?[]:pointer.slice(1).split('/').map(v=>v.replace(/~1/g,'/').replace(/~0/g,'~'));
}
function locate(project,path){let value=project;for(const key of path){if(Array.isArray(value)){if(!/^(0|[1-9]\d*)$/.test(key)||!Number.isSafeInteger(Number(key))||Number(key)>=value.length)return {exists:false};}else if(!plain(value)||!Object.hasOwn(value,key))return {exists:false};value=value[key];}return {exists:true,value};}
function unitFor(path,project,allowProvenance=true){
 const [root,key,third,fourth]=path;
 if(root==='materialProperties'){
  if(path.length===2)return materialUnits[key];
  if(key==='orthotropic'){if(['youngModuliPa','shearModuliPa'].includes(third))return 'Pa';if(['poissonRatios','axes'].includes(third))return '1';}
  if(key==='plasticity'&&['yieldStress','hardeningModulus'].includes(third)||key==='hyperelastic'&&['shearModulus','bulkModulus'].includes(third))return 'Pa';
  if(key==='dependence'){if(['strainRateMin','strainRateMax'].includes(third))return '1/s';if(third==='axes')return '1';if(third==='elasticTemperatureTable')return {temperature:'degC',youngModulus:'Pa',poissonRatio:'1'}[path[4]];}
  if(key==='fatigueData'){if(['ultimateStrengthPa','yieldStressPa'].includes(third)||third==='snCurve'&&path[4]==='stressAmplitudePa')return 'Pa';if(third==='snCurve'&&path[4]==='cycles')return 'cycles';if(third==='stressRatio')return '1';}
  if(key==='fractureData'){if(third==='toughnessRangePaSqrtM')return 'Pa sqrt(m)';if(third==='temperatureRangeC')return 'degC';}
 }
 if(root==='study'){
  if(path.length===2||path.length===3&&/^(0|[1-9]\d*)$/.test(third))return studyUnits[key];
  if(['temperatureSource','vibrationSource'].includes(key)){
   if(third==='mesh'&&fourth==='nodes'||key==='vibrationSource'&&['bounds','displacement','amplitudeMm'].includes(third))return 'mm';
   if(key==='temperatureSource'&&third==='temperature')return 'degC';if(third==='frequencyHz')return 'Hz';if(third==='phaseDeg')return 'deg';
  }
 }
 if(root==='conditions'){
  const c=project.conditions?.[key];if(third==='value')return {fixed:'mm',displacement:'mm',force:'N',pressure:'Pa',normalTraction:'Pa',temperature:'degC',heatFlux:'W/m2',heatPower:'W',convection:'W/(m2*K)',radiation:'1',thermalContact:'W/(m2*K)',acousticPressure:'Pa',acousticImpedance:'Pa*s/m'}[c?.type];
  if(third==='sphericalRegion'){if(['center','radius'].includes(fourth))return 'mm';if(['axis','reference'].includes(fourth))return '1';if(['latitudeMin','latitudeMax','startDegrees','sweepDegrees'].includes(fourth))return 'deg';}if(third==='direction')return '1';if(third==='ambientTemperature')return 'degC';if(third==='reactance')return 'Pa*s/m';if(third==='frame')return fourth==='origin'?'mm':fourth==='axes'?'1':undefined;
 }
 if(root==='meshes'&&third==='positions')return 'mm';
 const indices=parts=>parts.every(part=>/^(0|[1-9]\d*)$/.test(part));
 if(root==='sourceModel'&&['bounds','boxes','center','radius','outerRadius','innerRadius','length','seedPoint'].includes(key)&&indices(path.slice(2)))return 'mm';
 if(root==='sourceModel'&&key==='openingCaps'&&/^(0|[1-9]\d*)$/.test(third)&&['point','normal'].includes(fourth)&&indices(path.slice(4)))return fourth==='point'?'mm':'1';
 if(root==='sourceModel'&&key==='enclosure'&&(Array.isArray(project.sourceModel?.enclosure)&&indices(path.slice(2))||['center','radius'].includes(third)&&indices(path.slice(3))))return 'mm';
 if(root==='sourceModel'&&key==='solid'&&['bounds','boxes','center','radius','outerRadius','innerRadius','length'].includes(third)&&indices(path.slice(3)))return 'mm';
 if(root==='meshSettings'&&key==='refinements'&&['center','size','radius'].includes(fourth))return 'mm';
 if(allowProvenance&&root==='inputProvenance'&&key==='entries'&&fourth==='value'){
  const reference=project.inputProvenance?.entries?.[third]?.pointer;if(typeof reference==='string')try{return unitFor([...tokens(reference),...path.slice(4)],project,false);}catch{}
 }
 return undefined;
}
/** Read saved values, not inferred physics. All nested arrays/objects are content
 * descriptors until their exact pointer is explicitly selected for a small page.
 * Hashes identify canonical JSON values, not original file bytes. */
export async function inspectProjectInput(project,args={}){
 if(!plain(args)||Reflect.ownKeys(args).some(key=>typeof key!=='string'||!['section','pointer','expectedRevision','offset','limit'].includes(key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value')))throw argument('Invalid input inspection query');
 const {section='project',pointer:requested,expectedRevision,offset=0,limit=20}=args;
 if(typeof section!=='string'||!Object.hasOwn(roots,section)||expectedRevision!==undefined&&(typeof expectedRevision!=='string'||!/^sha256:[a-f0-9]{64}$/.test(expectedRevision))||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200)throw argument('Invalid section, revision or page');
 const pointer=requested===undefined?roots[section]:requested,path=tokens(pointer),base=roots[section];
 if(base&&pointer!==base&&!pointer.startsWith(base+'/'))throw argument('Pointer must be inside the requested input section');
 // Canonical validation and snapshots occur before the first asynchronous hash.
 const snapshot=JSON.parse(canonicalJson(project));if(!plain(snapshot))throw argument('Input inspection requires a project object');
 const revision=await getProjectRevision(snapshot);
 if(expectedRevision!==undefined&&expectedRevision!==revision)throw fail('INPUT_INSPECTION_REVISION_CONFLICT','Input revision differs from the inspected version');
 const found=locate(snapshot,path),units={},response={schemaVersion:1,revision,section,pointer,exists:found.exists,units,limitations:['Read-only saved-input inspection; values and source labels are not physical validation or source authentication.','Hashes cover canonical JSON values, not original source-file bytes.','Nested objects/arrays and large strings are omitted from descriptors; select their absolute JSON Pointer for a bounded page.','Object pages contain at most 50 members; array/string pages at most 200 entries/UTF-16 code units; total response at most 65536 UTF-8 bytes.','Only known application input units are stated; no missing values, unknown units or physical settings are inferred.']};
 if(!found.exists){if(offset!==0)throw fail('INPUT_INSPECTION_PAGE_INVALID','Missing input has no pages');return response;}
 async function describe(value,p){
  const parts=tokens(p),type=value===null?'null':Array.isArray(value)?'array':typeof value,unit=['number','array'].includes(type)?unitFor(parts,snapshot):undefined,out={pointer:p,type,...(unit?{unit}:{})};if(unit)units[p]=unit;
  if(type==='array'||type==='object'){Object.assign(out,type==='array'?{length:value.length}:{keyCount:Object.keys(value).length},{omitted:true,sha256:await getProjectRevision(value),hashBasis:'canonical-json'});}
  else if(type==='string'){
   const sourceBytes=parts[0]==='sourceModel'&&parts.at(-1)==='data';out.length=value.length;
   if(value.length>400||sourceBytes)Object.assign(out,{omitted:true,sha256:await getProjectRevision(value),hashBasis:'canonical-json'});else out.value=value;
  }else out.value=value;
  return out;
 }
 const value=found.value;response.descriptor=await describe(value,pointer);
 if(Array.isArray(value)||plain(value)){
  const keys=Array.isArray(value)?Array.from({length:Math.min(limit,Math.max(0,value.length-offset))},(_,i)=>String(offset+i)):Object.keys(value).sort().slice(offset,offset+limit),total=Array.isArray(value)?value.length:Object.keys(value).length;
  if(!Array.isArray(value)&&limit>50||offset>total)throw fail('INPUT_INSPECTION_PAGE_INVALID','Invalid input page; objects allow at most 50 members');
  response.page={offset,limit,total,nextOffset:offset+keys.length<total?offset+keys.length:null,entries:await Promise.all(keys.map(key=>describe(value[key],pointer+'/'+escape(key))))};
 }else if(typeof value==='string'&&response.descriptor.omitted){
  if(offset>value.length)throw fail('INPUT_INSPECTION_PAGE_INVALID','String offset exceeds its length');
  response.page={offset,limit,total:value.length,nextOffset:offset+limit<value.length?offset+limit:null,text:value.slice(offset,offset+limit),encoding:'utf-16-code-units'};
 }else if(offset!==0)throw fail('INPUT_INSPECTION_PAGE_INVALID','Scalar input has no pages');
 if(new TextEncoder().encode(JSON.stringify(response)).length>65536)throw fail('INPUT_INSPECTION_RESPONSE_LIMIT','Input inspection response exceeds 65536 UTF-8 bytes; request fewer entries');
 return response;
}
