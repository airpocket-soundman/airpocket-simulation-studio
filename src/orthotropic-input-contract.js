import {validateOrthotropic} from './orthotropic-material.js';
import {validateMaterialProperties} from './materials.js';
import {validateFrame} from './constraints.js';
import {resolveElasticMaterial} from './material-dependence.js';
import {canonicalJson} from './project-revision.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k),vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const units={geometry:'mm',youngModuliPa:'Pa',shearModuliPa:'Pa',poissonRatios:'1',axes:'1',displacement:'mm',force:'N',pressure:'Pa',density:'kg/m3',gravity:'m/s2',materialTemperature:'degC',strainRateMin:'1/s',strainRateMax:'1/s'};
/** Pure pre-mesh declaration for the existing static CPU orthotropic solver.
 * Constraint rank, boundary transfer and physical accuracy remain post-mesh checks. */
export function inspectOrthotropicInputContract(project,options={}, {mode='legacy'}={}){
 const requiredPointers=[],diagnostics=[],result={contract:'static-orthotropic-linear-structure',requiredPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Provide the intended orthotropic physical inputs and record their source or explicit exploratory assumption'],requiresUserIntent:true});
 const required=(pointer,value,valid,message,unit=null)=>{requiredPointers.push(pointer);if(value===undefined||value===null)add('ORTHOTROPIC_INPUT_REQUIRED',pointer,'Required explicit orthotropic input is missing',{unit});else if(!valid(value))add('ORTHOTROPIC_INPUT_INVALID',pointer,message,{unit});};
 try{
  if(!['quantitative','exploratory'].includes(mode)||!object(project)||!object(options)){add('ORTHOTROPIC_INPUT_INVALID','/','Invalid orthotropic input contract arguments');return result;}
  const study=object(project.study)?project.study:{},material=object(project.materialProperties)?project.materialProperties:{},data=object(material.orthotropic)?material.orthotropic:{};
  required('/study/kind',study.kind,v=>v==='structural','Orthotropic elasticity requires structural study');
  required('/study/gravityEnabled',study.gravityEnabled,v=>typeof v==='boolean','Explicit gravity intent required');
  for(const key of ['modalAnalysis','thermalStress'])if(own(study,key)){requiredPointers.push('/study/'+key);if(typeof study[key]!=='boolean'||study[key])add('ORTHOTROPIC_STUDY_UNSUPPORTED','/study/'+key,'Only static structure without thermal stress is supported');}
  for(const key of ['model','youngModuliPa','poissonRatios','shearModuliPa','axes','source','testConditions'])required('/materialProperties/orthotropic/'+key,data[key],v=>key==='model'?v==='linear-orthotropic':['source','testConditions'].includes(key)?typeof v==='string'&&v.trim().length>0:key==='axes'?Array.isArray(v)&&v.length===3&&v.every(vector):vector(v),'Invalid explicit orthotropic material value',units[key]??null);
  if(material.dependence!==undefined){
   if(!object(material.dependence))requiredPointers.push('/materialProperties/dependence');
   else for(const key of Object.keys(material.dependence))requiredPointers.push('/materialProperties/dependence/'+key);
  }
  if(options.method!==undefined&&!['pcg','pcg-strict','wasm-pcg'].includes(options.method))add('ORTHOTROPIC_EXECUTION_UNSUPPORTED','/options/method','Orthotropic elasticity requires an existing CPU PCG solver');
  if(material.orthotropic!==undefined)try{validateOrthotropic(material.orthotropic);validateMaterialProperties(material);}catch(error){add('ORTHOTROPIC_MATERIAL_INVALID','/materialProperties/orthotropic',error.message);}
  if(study.gravityEnabled===true){required('/study/gravity',study.gravity,vector,'Gravity must be an explicit finite three-vector',units.gravity);required('/materialProperties/density',material.density,v=>Number.isFinite(v)&&v>0,'Gravity requires positive explicit density',units.density);}
  if(material.temperatureMin!==undefined||material.temperatureMax!==undefined||own(study,'materialTemperature')||own(options,'materialTemperature'))required('/study/materialTemperature',study.materialTemperature,v=>Number.isFinite(v)&&v>=-273.15&&(material.temperatureMin===undefined||v>=material.temperatureMin-1e-6)&&(material.temperatureMax===undefined||v<=material.temperatureMax+1e-6),'Material temperature must be explicit and within registered limits',units.materialTemperature);
  for(const key of ['temperatureMin','temperatureMax'])if(material[key]!==undefined)requiredPointers.push('/materialProperties/'+key);
  // Mirror the Worker's actual material resolution, including its 20 degC
  // evaluation seed. No value is inserted into the project or provenance;
  // applicable temperature limits above still require explicit intent.
  if(material.orthotropic!==undefined)try{resolveElasticMaterial(material,study.materialTemperature??20);}catch(error){add('ORTHOTROPIC_MATERIAL_EVALUATION_UNSUPPORTED','/materialProperties',error.message);}
  const regions=v=>Array.isArray(v)&&v.length>0&&v.every(r=>object(r)&&Number.isInteger(r.mesh)&&r.mesh>=0&&Array.isArray(project.meshes)&&object(project.meshes[r.mesh])&&Array.isArray(r.triangles)&&r.triangles.length>0&&r.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<(project.meshes[r.mesh].faceIds?.length??0)));
  if(!Array.isArray(project.conditions))add('ORTHOTROPIC_INPUT_REQUIRED','/conditions','An explicit structural condition array is required');
  let supported=false;
  (Array.isArray(project.conditions)?project.conditions:[]).forEach((condition,index)=>{
   const c=object(condition)?condition:{},base='/conditions/'+index;
   required(base+'/type',c.type,v=>['fixed','displacement','force','pressure','normalTraction'].includes(v),'Boundary must belong to structural analysis');
   required(base+'/value',c.value,Number.isFinite,'Boundary value must be finite',{fixed:'mm',displacement:'mm',force:'N',pressure:'Pa',normalTraction:'Pa'}[c.type]??null);
   required(base+'/direction',c.direction,v=>vector(v)&&(!['force','displacement'].includes(c.type)||Math.hypot(...v)>=(c.type==='displacement'?1e-12:Number.MIN_VALUE)),'Explicit finite boundary direction required','1');
   required(base+'/regions',c.regions,regions,'Explicit nonempty valid structural regions required');
   for(const key of ['frame','planarRegion','cylindricalRegion'])if(c[key]!==undefined)requiredPointers.push(base+'/'+key);
   let validFrame=true;
   if(c.type==='displacement'&&c.frame!==undefined)try{validateFrame(c.frame);if(!vector(c.direction)||c.direction.some((v,k)=>Math.abs(v-c.frame.axes[c.frame.axis][k])>1e-7))throw Error('Constraint direction does not match local frame');}catch(error){validFrame=false;add('ORTHOTROPIC_INPUT_INVALID',base+'/frame',error.message);}
   if(['fixed','displacement'].includes(c.type)&&regions(c.regions)&&!c.cadUpdateRequired&&Number.isFinite(c.value)&&vector(c.direction)&&(c.type==='fixed'||Math.hypot(...c.direction)>=1e-12)&&validFrame)supported=true;
  });
  if(!supported)add('STRUCTURAL_SUPPORT_MISSING','/conditions','No valid fixed or displacement support specified; rigid-body rank remains a post-mesh check');
  const equal=(a,b)=>{if(a===undefined||b===undefined)return a===b;try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}};
  for(const key of ['kind','gravityEnabled','gravity','materialTemperature','modalAnalysis','thermalStress','referenceTemperature','temperature','temperatureSource'])if(own(options,key)&&!equal(options[key],study[key]))add('ORTHOTROPIC_RUNTIME_OVERRIDE','/options/'+key,'Runtime physical option differs from the provenance-bearing study and is ignored by this structural Worker',{studyPointer:'/study/'+key});
  for(const key of ['youngModuliPa','shearModuliPa','poissonRatios','axes'])if(own(options,key)&&!equal(options[key],data[key]))add('ORTHOTROPIC_RUNTIME_OVERRIDE','/options/'+key,'Runtime orthotropic constants are ignored; update the provenance-bearing material input',{projectPointer:'/materialProperties/orthotropic/'+key});
  for(const key of ['orthotropic','density','youngModulus','poissonRatio','materialProperties','force','pressure','normalTraction','displacement','conditions'])if(own(options,key)&&!equal(options[key],key==='materialProperties'?material:key==='conditions'?project.conditions:material[key]))add('ORTHOTROPIC_RUNTIME_OVERRIDE','/options/'+key,'Runtime material or boundary value is not an implemented physical override',{projectPointer:key==='conditions'?'/conditions':'/materialProperties/'+key});
  // These are solver-level boundary records, not accepted Worker overrides.
  // Even empty runtime records must not silently claim to remove saved loads.
  for(const key of ['boundary','fixed','forces','displacements','tractions','pressures','loads','supports'])if(own(options,key))add('ORTHOTROPIC_RUNTIME_OVERRIDE','/options/'+key,'Runtime boundary records are ignored; edit the provenance-bearing project conditions',{projectPointer:'/conditions'});
 }catch{add('ORTHOTROPIC_INPUT_INVALID','/','Malformed orthotropic input cannot be inspected');}
 return result;
}
