import {validateMaterialProperties} from './materials.js';
import {resolveElasticMaterial} from './material-dependence.js';
import {validateFrame} from './constraints.js';
import {validatePlasticLoadFractions} from './regions.js';
import {canonicalJson} from './project-revision.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k),vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const units={geometry:'mm',youngModulus:'Pa',poissonRatio:'1',yieldStress:'Pa',hardeningModulus:'Pa',shearModulus:'Pa',bulkModulus:'Pa',testCurve:'stretch (1), nominal stress (Pa)',plasticLoadFractions:'1',displacement:'mm',force:'N',pressure:'Pa',density:'kg/m3',gravity:'m/s2',materialTemperature:'degC',strainRateMin:'1/s',strainRateMax:'1/s'};
/** Declaration only: does not establish convergence, small strain validity,
 * positive Jacobians, boundary transfer, constraint rank or mesh sufficiency. */
export function inspectNonlinearInputContract(project,options={}, {mode='legacy'}={}){
 let plastic=false;try{plastic=project?.materialProperties?.plasticity!==undefined;}catch{}
 const requiredPointers=[],numericalPointers=[],diagnostics=[],result={contract:plastic?'small-strain-j2-structure':'finite-strain-neo-hookean-structure',requiredPointers,numericalPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Provide the intended nonlinear physical input with its source or explicit exploratory assumption; numerical convergence settings are not material evidence'],requiresUserIntent:true});
 const required=(pointer,value,valid,message,unit=null)=>{requiredPointers.push(pointer);if(value===undefined||value===null)add('NONLINEAR_INPUT_REQUIRED',pointer,'Required explicit nonlinear input is missing',{unit});else if(!valid(value))add('NONLINEAR_INPUT_INVALID',pointer,message,{unit});};
 const integer=(v,max)=>Number.isInteger(v)&&v>=1&&v<=max;
 try{
  if(!['quantitative','exploratory'].includes(mode)||!object(project)||!object(options)){add('NONLINEAR_INPUT_INVALID','/','Invalid nonlinear input contract arguments');return result;}
  const study=object(project.study)?project.study:{},material=object(project.materialProperties)?project.materialProperties:{},model=plastic?'plasticity':'hyperelastic',data=object(material[model])?material[model]:{};
  required('/study/kind',study.kind,v=>v==='structural','Nonlinear elasticity requires structural study');
  required('/study/gravityEnabled',study.gravityEnabled,v=>typeof v==='boolean','Explicit gravity intent required');
  for(const key of ['modalAnalysis','thermalStress'])if(own(study,key)){requiredPointers.push('/study/'+key);if(study[key]!==false)add('NONLINEAR_STUDY_UNSUPPORTED','/study/'+key,'Nonlinear Worker supports static structure without thermal stress');}
  if(options.method!==undefined&&!['pcg','pcg-strict','wasm-pcg'].includes(options.method)||options.adaptive!==undefined&&typeof options.adaptive!=='boolean'||options.adaptive===true)add('NONLINEAR_EXECUTION_UNSUPPORTED','/options','Nonlinear structure supports CPU PCG without adaptive refinement');
  for(const key of ['fatigueAssessment','fractureAssessment'])if(own(options,key))add('NONLINEAR_MODEL_UNSUPPORTED','/options/'+key,'Failure screening requires linear elasticity and cannot be applied after a nonlinear solve');
  required('/materialProperties/'+model+'/model',data.model,v=>v===(plastic?'j2-isotropic':'neo-hookean-log'),'Explicit supported nonlinear constitutive model required');
  for(const key of plastic?['yieldStress','hardeningModulus']:['shearModulus','bulkModulus'])required('/materialProperties/'+model+'/'+key,data[key],v=>Number.isFinite(v)&&v>0,'Nonlinear modulus/stress must be positive Pa','Pa');
  required('/materialProperties/'+model+'/testConditions',data.testConditions,v=>typeof v==='string'&&v.trim().length>0&&v.length<=10000,'Explicit material test conditions required');
  if(plastic){required('/materialProperties/youngModulus',material.youngModulus,v=>Number.isFinite(v)&&v>0,'J2 requires positive elastic Young modulus','Pa');required('/materialProperties/poissonRatio',material.poissonRatio,v=>Number.isFinite(v)&&v>-1&&v<.49,'J2 requires -1 < Poisson ratio < 0.49','1');}
  else if(own(data,'testCurve'))required('/materialProperties/hyperelastic/testCurve',data.testCurve,Array.isArray,'Registered calibration curve must be valid','stretch (1), nominal stress (Pa)');
  try{validateMaterialProperties(material);resolveElasticMaterial(material,study.materialTemperature??20);}catch(error){add('NONLINEAR_MATERIAL_UNSUPPORTED','/materialProperties',error.message);}
  // Some core-only aliases are not accepted by validateMaterialProperties but
  // are nevertheless interpreted by the J2 solver; do not allow them to bypass intent.
  if(plastic&&(material.rateDependent||material.directionality==='orthotropic'||material.elasticTemperatureTable!==undefined))add('NONLINEAR_MATERIAL_UNSUPPORTED','/materialProperties','J2 supports rate-independent isotropic elasticity without a temperature table');
  if(material.dependence!==undefined){if(!object(material.dependence))requiredPointers.push('/materialProperties/dependence');else for(const key of Object.keys(material.dependence))requiredPointers.push('/materialProperties/dependence/'+key);}
  if(study.gravityEnabled===true){required('/study/gravity',study.gravity,vector,'Gravity must be an explicit finite three-vector',units.gravity);required('/materialProperties/density',material.density,v=>Number.isFinite(v)&&v>0,'Gravity requires positive explicit density',units.density);}
  if(material.temperatureMin!==undefined||material.temperatureMax!==undefined||own(study,'materialTemperature')||own(options,'materialTemperature'))required('/study/materialTemperature',study.materialTemperature,v=>Number.isFinite(v)&&v>=-273.15&&(material.temperatureMin==null||v>=material.temperatureMin-1e-6)&&(material.temperatureMax==null||v<=material.temperatureMax+1e-6),'Material temperature must be explicit and within registered applicability','degC');
  for(const key of ['temperatureMin','temperatureMax'])if(material[key]!==undefined)requiredPointers.push('/materialProperties/'+key);
  if(plastic){
   if(own(study,'plasticLoadFractions')){required('/study/plasticLoadFractions',study.plasticLoadFractions,Array.isArray,'Explicit J2 normalized load history required','1');try{validatePlasticLoadFractions(study);}catch(error){add('NONLINEAR_LOAD_HISTORY_INVALID','/study/plasticLoadFractions',error.message);}if(own(study,'nonlinearLoadSteps')){requiredPointers.push('/study/nonlinearLoadSteps');if(!integer(study.nonlinearLoadSteps,30))add('NONLINEAR_INPUT_INVALID','/study/nonlinearLoadSteps','J2 load steps must be 1 to 30');}}
   else required('/study/nonlinearLoadSteps',study.nonlinearLoadSteps,v=>integer(v,30),'Explicit J2 monotonic loading steps 1 to 30 are required to define the physical loading path');
  }else{
   if(own(study,'plasticLoadFractions'))add('NONLINEAR_LOAD_HISTORY_INVALID','/study/plasticLoadFractions','Plastic loading history cannot be used for Neo-Hookean structure');
   if(own(study,'nonlinearLoadSteps')){numericalPointers.push('/study/nonlinearLoadSteps');if(!integer(study.nonlinearLoadSteps,30))add('NONLINEAR_NUMERICAL_SETTING_INVALID','/study/nonlinearLoadSteps','Load increments must be 1 to 30');}
  }
  if(own(study,'maxNewtonIterations')){numericalPointers.push('/study/maxNewtonIterations');if(!integer(study.maxNewtonIterations,50))add('NONLINEAR_NUMERICAL_SETTING_INVALID','/study/maxNewtonIterations','Newton iteration limit must be 1 to 50');}
  const regions=v=>Array.isArray(v)&&v.length>0&&v.every(r=>object(r)&&Number.isInteger(r.mesh)&&r.mesh>=0&&Array.isArray(project.meshes)&&object(project.meshes[r.mesh])&&Array.isArray(r.triangles)&&r.triangles.length>0&&r.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<(project.meshes[r.mesh].faceIds?.length??0)));
  if(!Array.isArray(project.conditions))add('NONLINEAR_INPUT_REQUIRED','/conditions','Explicit structural condition array required');let support=false;
  (Array.isArray(project.conditions)?project.conditions:[]).forEach((condition,index)=>{
   const c=object(condition)?condition:{},base='/conditions/'+index,allowed=plastic?['fixed','displacement','force','pressure','normalTraction']:['fixed','displacement','force'];
   required(base+'/type',c.type,v=>allowed.includes(v),'Unsupported nonlinear boundary; Neo-Hookean accepts dead force, fixed and displacement only');
   required(base+'/value',c.value,Number.isFinite,'Boundary value must be finite',{fixed:'mm',displacement:'mm',force:'N',pressure:'Pa',normalTraction:'Pa'}[c.type]??null);
   required(base+'/direction',c.direction,v=>vector(v)&&(!['force','displacement'].includes(c.type)||Math.hypot(...v)>=(c.type==='displacement'?1e-12:Number.MIN_VALUE)),'Explicit finite boundary direction required','1');
   required(base+'/regions',c.regions,regions,'Explicit nonempty valid structural regions required');
   for(const key of ['frame','planarRegion','cylindricalRegion'])if(c[key]!==undefined)requiredPointers.push(base+'/'+key);
   let validFrame=true;if(c.type==='displacement'&&c.frame!==undefined)try{validateFrame(c.frame);if(!vector(c.direction)||c.direction.some((v,k)=>Math.abs(v-c.frame.axes[c.frame.axis][k])>1e-7))throw Error('Constraint direction does not match local frame');}catch(error){validFrame=false;add('NONLINEAR_INPUT_INVALID',base+'/frame',error.message);}
   if(['fixed','displacement'].includes(c.type)&&regions(c.regions)&&!c.cadUpdateRequired&&Number.isFinite(c.value)&&vector(c.direction)&&validFrame&&(c.type==='fixed'||Math.hypot(...c.direction)>=1e-12))support=true;
  });
  if(!support)add('STRUCTURAL_SUPPORT_MISSING','/conditions','No valid fixed/displacement support; rigid-body rank remains a post-mesh check');
  const equal=(a,b)=>{if(a===undefined||b===undefined)return a===b;try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}};
  for(const key of ['kind','gravityEnabled','gravity','materialTemperature','modalAnalysis','thermalStress','referenceTemperature','temperature','temperatureSource','plasticLoadFractions','nonlinearLoadSteps','maxNewtonIterations'])if(own(options,key)&&(options[key]===undefined||options[key]===null||!equal(options[key],study[key])))add('NONLINEAR_RUNTIME_OVERRIDE','/options/'+key,'Runtime option is ignored by this Worker; use the explicit project study',{studyPointer:'/study/'+key});
  for(const key of ['plasticity','hyperelastic','orthotropic','density','youngModulus','poissonRatio','dependence','materialProperties','conditions'])if(own(options,key)&&(options[key]===undefined||options[key]===null||!equal(options[key],key==='materialProperties'?material:key==='conditions'?project.conditions:material[key])))add('NONLINEAR_RUNTIME_OVERRIDE','/options/'+key,'Runtime material/boundary input is ignored; update the project',{projectPointer:key==='conditions'?'/conditions':'/materialProperties/'+key});
  for(const key of ['boundary','fixed','forces','displacements','tractions','pressures','loads','supports','force','pressure','normalTraction','displacement','loadFractions','loadSteps','yieldStress','hardeningModulus','shearModulus','bulkModulus','rateDependent','directionality','elasticTemperatureTable'])if(own(options,key))add('NONLINEAR_RUNTIME_OVERRIDE','/options/'+key,'Solver-level physical override is not forwarded by the Worker; update the project study/material/conditions');
 }catch{add('NONLINEAR_INPUT_INVALID','/','Malformed nonlinear input cannot be inspected');}
 return result;
}
