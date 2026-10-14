import {canonicalJson} from './project-revision.js';
import {validateMaterialProperties} from './materials.js';
import {resolveElasticMaterial} from './material-dependence.js';
import {validateTemperatureSource} from './temperature-transfer.js';
import {validateFrame} from './constraints.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),own=(v,k)=>Object.hasOwn(v,k),vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite),temperature=v=>Number.isFinite(v)&&v>=-273.15;
const equal=(a,b)=>{if(a===undefined||b===undefined)return false;try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}};
const units={geometry:'mm',youngModulus:'Pa',poissonRatio:'1',expansion:'1/K',temperature:'degC',referenceTemperature:'degC',materialTemperature:'degC',temperatureMin:'degC',temperatureMax:'degC',density:'kg/m3',gravity:'m/s2',displacement:'mm',force:'N',pressure:'Pa'};
/** Existing static isotropic structure, including uniform temperature-dependent
 * elasticity and saved thermal fields. Source evidence is not authentication;
 * transfer coverage, body matching, constraint rank and accuracy stay post-mesh. */
export function inspectThermalStressInputContract(project,options={}, {mode='legacy'}={}){
 let active=false;try{active=project?.study?.thermalStress===true;}catch{}
 const requiredPointers=[],diagnostics=[],result={contract:active?'thermal-stress-isotropic-structure':'temperature-dependent-isotropic-structure',requiredPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Declare the intended structural temperature and material inputs with physical sources or explicit exploratory assumptions'],requiresUserIntent:true});
 const required=(pointer,value,valid,message,unit=null)=>{requiredPointers.push(pointer);if(value===undefined||value===null)add('THERMAL_STRESS_INPUT_REQUIRED',pointer,'Required explicit structural temperature input is missing',{unit});else if(!valid(value))add('THERMAL_STRESS_INPUT_INVALID',pointer,message,{unit});};
 try{
  if(!['quantitative','exploratory'].includes(mode)||!object(project)||!object(options)){add('THERMAL_STRESS_INPUT_INVALID','/','Invalid structural temperature contract arguments');return result;}
  const s=object(project.study)?project.study:{},m=object(project.materialProperties)?project.materialProperties:{},table=m.dependence?.elasticTemperatureTable;
  required('/study/kind',s.kind,v=>v==='structural','Structural study required');
  required('/study/gravityEnabled',s.gravityEnabled,v=>typeof v==='boolean','Explicit gravity intent required');
  if(own(s,'thermalStress'))required('/study/thermalStress',s.thermalStress,v=>typeof v==='boolean','Thermal stress flag must be boolean');
  if(s.modalAnalysis)add('THERMAL_STRESS_MODEL_UNSUPPORTED','/study/modalAnalysis','This contract covers static structural calculations');
  for(const key of ['orthotropic','plasticity','hyperelastic'])if(m[key])add('THERMAL_STRESS_MODEL_UNSUPPORTED','/materialProperties/'+key,'This contract covers linear isotropic structure');
  if(table!==undefined)required('/materialProperties/dependence/elasticTemperatureTable',table,Array.isArray,'Registered elastic temperature table required');
  else{
   required('/materialProperties/youngModulus',m.youngModulus,v=>Number.isFinite(v)&&v>0,'Positive Young modulus required',units.youngModulus);
   required('/materialProperties/poissonRatio',m.poissonRatio,v=>Number.isFinite(v)&&v>-1&&v<.49,'Poisson ratio must be above -1 and below 0.49',units.poissonRatio);
  }
  if(m.dependence!==undefined){if(object(m.dependence))for(const key of Object.keys(m.dependence))requiredPointers.push('/materialProperties/dependence/'+key);else requiredPointers.push('/materialProperties/dependence');}
  for(const key of ['temperatureMin','temperatureMax'])if(m[key]!==undefined)requiredPointers.push('/materialProperties/'+key);
  try{validateMaterialProperties(m);}catch(error){add('THERMAL_STRESS_MATERIAL_INVALID','/materialProperties',error.message);}
  let evaluationTemperature;
  if(active){
   required('/study/temperature',s.temperature,temperature,'Explicit temperature required by the saved structural project contract',units.temperature);
   required('/study/referenceTemperature',s.referenceTemperature,temperature,'Stress-free reference temperature must be explicit',units.referenceTemperature);
   required('/materialProperties/expansion',m.expansion,Number.isFinite,'Explicit finite thermal expansion coefficient required',units.expansion);
   evaluationTemperature=s.temperature;
   if(s.temperatureSource!==undefined){
    const source=s.temperatureSource,base='/study/temperatureSource';
    required(base+'/name',source?.name,v=>typeof v==='string'&&v.trim().length>0,'Name identifying the saved thermal field required');
    if(source?.caseReference!==undefined)required(base+'/caseReference',source.caseReference,v=>object(v)&&Object.keys(v).length===3&&v.schemaVersion===1&&typeof v.caseId==='string'&&v.caseId.trim().length>0&&typeof v.revision==='string'&&/^sha256:[a-f0-9]{64}$/.test(v.revision),'Valid saved thermal case identity required');
    requiredPointers.push(base+'/mesh',base+'/temperature');
    try{validateTemperatureSource(source);evaluationTemperature=source.temperature;}catch(error){add('THERMAL_STRESS_SOURCE_INVALID',base,error.message);evaluationTemperature=undefined;}
    if(source?.sourceAssessment!==undefined){requiredPointers.push(base+'/sourceAssessment');try{validateTemperatureSource(source);result.inheritedSourceAssessment=structuredClone(source.sourceAssessment);result.inheritedProvisional=source.sourceAssessment.provisional;}catch{}}
    // Saved-input replay cannot authenticate the referenced case. Always bind
    // evidence to the embedded mesh and values too, so payload edits are stale.
    // This duplicates potentially large arrays in physical provenance JSON.
   }
  }else{
   required('/study/materialTemperature',s.materialTemperature,temperature,'Uniform material evaluation temperature must be explicit',units.materialTemperature);
   evaluationTemperature=s.materialTemperature;
  }
  if(evaluationTemperature!==undefined&&evaluationTemperature!==null)try{resolveElasticMaterial(m,evaluationTemperature);}catch(error){add('THERMAL_STRESS_MATERIAL_EVALUATION_UNSUPPORTED','/materialProperties',error.message);}
  if(s.gravityEnabled===true){required('/study/gravity',s.gravity,vector,'Finite explicit gravity three-vector required',units.gravity);required('/materialProperties/density',m.density,v=>Number.isFinite(v)&&v>0,'Gravity requires positive density',units.density);}
  if(options.method!==undefined&&!['pcg','pcg-strict','wasm-pcg','webgpu-pcg','mfem-wasm'].includes(options.method))add('THERMAL_STRESS_EXECUTION_UNSUPPORTED','/options/method','Use an implemented structural solver');
  const regions=v=>Array.isArray(v)&&v.length>0&&v.every(r=>object(r)&&Number.isInteger(r.mesh)&&r.mesh>=0&&Array.isArray(project.meshes)&&object(project.meshes[r.mesh])&&Array.isArray(r.triangles)&&r.triangles.length>0&&r.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<(project.meshes[r.mesh].faceIds?.length??0)));
  if(!Array.isArray(project.conditions))add('THERMAL_STRESS_INPUT_REQUIRED','/conditions','Explicit structural conditions array required');
  let supported=false;
  for(const [index,candidate]of (Array.isArray(project.conditions)?project.conditions:[]).entries()){
   const c=object(candidate)?candidate:{},base='/conditions/'+index;
   required(base+'/type',c.type,v=>['fixed','displacement','force','pressure','normalTraction'].includes(v),'Structural boundary type required');
   required(base+'/value',c.value,Number.isFinite,'Finite boundary value required',{fixed:'mm',displacement:'mm',force:'N',pressure:'Pa',normalTraction:'Pa'}[c.type]??null);
   required(base+'/direction',c.direction,v=>vector(v)&&(!['force','displacement'].includes(c.type)||Number.isFinite(Math.hypot(...v))&&Math.hypot(...v)>=(c.type==='displacement'?1e-12:Number.MIN_VALUE)),'Finite explicit structural direction required','1');
   required(base+'/regions',c.regions,regions,'Nonempty valid structural regions required');
   for(const key of ['frame','planarRegion','cylindricalRegion'])if(c[key]!==undefined)requiredPointers.push(base+'/'+key);
   if(c.type==='displacement'&&c.frame!==undefined)try{validateFrame(c.frame);if(!vector(c.direction)||c.direction.some((v,k)=>Math.abs(v-c.frame.axes[c.frame.axis][k])>1e-7))throw Error('Constraint direction does not match local frame');}catch(error){add('THERMAL_STRESS_INPUT_INVALID',base+'/frame',error.message);}
   if(['fixed','displacement'].includes(c.type)&&regions(c.regions)&&!c.cadUpdateRequired&&Number.isFinite(c.value)&&vector(c.direction)&&(c.type==='fixed'||Math.hypot(...c.direction)>=1e-12))supported=true;
  }
  if(!supported)add('STRUCTURAL_SUPPORT_MISSING','/conditions','Valid fixed or displacement support required; rank remains a post-mesh check');
  for(const key of ['kind','gravityEnabled','gravity','thermalStress','modalAnalysis','temperature','referenceTemperature','materialTemperature','temperatureSource'])if(own(options,key)&&(!own(s,key)||!equal(options[key],s[key])))add('THERMAL_STRESS_RUNTIME_OVERRIDE','/options/'+key,'Runtime physical input differs from the provenance-bearing study and is ignored by this structural Worker',{studyPointer:'/study/'+key});
  for(const key of ['youngModulus','poissonRatio','expansion','density','dependence','temperatureMin','temperatureMax','materialProperties','conditions']){const expected=key==='materialProperties'?m:key==='conditions'?project.conditions:m[key];if(own(options,key)&&!equal(options[key],expected))add('THERMAL_STRESS_RUNTIME_OVERRIDE','/options/'+key,'Runtime physical input differs from the saved project; update its provenance-bearing input');}
  for(const key of ['boundary','fixed','forces','displacements','tractions','pressures','loads','supports','force','pressure','normalTraction','displacement','prestress','expansionCoefficient'])if(own(options,key))add('THERMAL_STRESS_RUNTIME_OVERRIDE','/options/'+key,'This physical runtime field is not implemented; edit project material, study or conditions');
  if(active)for(const key of ['fatigueAssessment','fractureAssessment'])if(own(options,key))add('THERMAL_STRESS_MODEL_UNSUPPORTED','/options/'+key,'Failure assessments do not support thermal stress');
 }catch{add('THERMAL_STRESS_INPUT_INVALID','/','Malformed structural temperature inputs cannot be inspected');}
 result.requiredPointers=[...new Set(requiredPointers)];return result;
}
