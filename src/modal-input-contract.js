import {canonicalJson} from './project-revision.js';
import {resolveElasticMaterial} from './material-dependence.js';
import {validateFrame} from './constraints.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),own=(o,k)=>Object.hasOwn(o,k),positive=v=>Number.isFinite(v)&&v>0;
const sameJson=(a,b)=>{if(a===undefined||b===undefined)return false;try{return canonicalJson(a)===canonicalJson(b);}catch{return false;}};
const units={geometry:'mm',youngModulus:'Pa',poissonRatio:'1',density:'kg/m3',displacement:'mm',force:'N',pressure:'Pa',gravity:'m/s2',materialTemperature:'degC',frequency:'Hz'};
/** Pure declaration for the existing CPU lumped-Tet4 modal solver. Numerical
 * extraction/iteration limits require explicit settings, not physical sources.
 * Constraint rank, transfer, mass, convergence and normalization stay post-mesh. */
export function inspectModalInputContract(project,options={}, {mode='legacy'}={}){
 const requiredPointers=[],diagnostics=[],result={contract:'modal-isotropic-structure',requiredPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Specify the intended modal model and record physical sources or explicit exploratory assumptions'],requiresUserIntent:true});
 const require=(pointer,value,valid,message,unit=null,physical=true)=>{if(physical)requiredPointers.push(pointer);if(value===undefined||value===null)add('MODAL_INPUT_REQUIRED',pointer,'Required explicit modal input is missing',{unit});else if(!valid(value))add('MODAL_INPUT_INVALID',pointer,message,{unit});};
 try{
  if(!['quantitative','exploratory'].includes(mode)||!object(project)||!object(options)){add('MODAL_INPUT_INVALID','/','Invalid modal input contract arguments');return result;}
  const s=object(project.study)?project.study:{},m=object(project.materialProperties)?project.materialProperties:{};
  require('/study/kind',s.kind,v=>v==='structural','Modal analysis requires structural study');
  require('/study/modalAnalysis',s.modalAnalysis,v=>v===true,'Explicit modal analysis true required');
  require('/study/gravityEnabled',s.gravityEnabled,v=>v===false,'Modal eigenmodes exclude gravity and prestress');
  require('/study/modeCount',s.modeCount,v=>Number.isInteger(v)&&v>=1&&v<=6,'Requested mode count must be from 1 to 6',null,false);
  require('/study/modalIterations',s.modalIterations,v=>Number.isInteger(v)&&v>=1&&v<=100,'Modal iteration limit must be from 1 to 100',null,false);
  require('/materialProperties/density',m.density,positive,'Density must be positive kg/m3',units.density);
  const table=m.dependence?.elasticTemperatureTable;
  if(table!==undefined)requiredPointers.push('/materialProperties/dependence/elasticTemperatureTable');
  else{
   require('/materialProperties/youngModulus',m.youngModulus,positive,'Young modulus must be positive Pa',units.youngModulus);
   require('/materialProperties/poissonRatio',m.poissonRatio,v=>Number.isFinite(v)&&v>-1&&v<.49,'Poisson ratio must be greater than -1 and below 0.49',units.poissonRatio);
  }
  const usesTemperature=table!==undefined||m.temperatureMin!=null||m.temperatureMax!=null;
  if(usesTemperature)require('/study/materialTemperature',s.materialTemperature,v=>Number.isFinite(v)&&v>=-273.15,'Explicit uniform material evaluation temperature required',units.materialTemperature);
  else if(s.materialTemperature!==undefined)require('/study/materialTemperature',s.materialTemperature,v=>Number.isFinite(v)&&v>=-273.15,'Material temperature must be at least absolute zero',units.materialTemperature);
  for(const key of ['temperatureMin','temperatureMax'])if(m[key]!==undefined)requiredPointers.push('/materialProperties/'+key);
  if(m.dependence!==undefined)requiredPointers.push('/materialProperties/dependence');
  for(const key of ['orthotropic','plasticity','hyperelastic'])if(m[key])add('MODAL_MODEL_UNSUPPORTED','/materialProperties/'+key,'Modal analysis supports linear isotropic elasticity only');
  if(s.thermalStress)add('MODAL_MODEL_UNSUPPORTED','/study/thermalStress','Thermal prestress is not part of this eigenproblem');
  try{if(!usesTemperature||s.materialTemperature!==undefined)resolveElasticMaterial(m,s.materialTemperature??20);}catch(error){add('MODAL_MATERIAL_INVALID','/materialProperties',error.message);}
  if(options.adaptive)add('MODAL_MODEL_UNSUPPORTED','/options/adaptive','Modal adaptive refinement is not implemented');
  if(options.method!==undefined&&!['pcg','pcg-strict','wasm-pcg'].includes(options.method))add('MODAL_MODEL_UNSUPPORTED','/options/method','Modal solving requires an existing CPU solver');
  for(const key of ['kind','modalAnalysis','gravityEnabled','gravity','thermalStress','materialTemperature','modeCount','modalIterations'])if(own(options,key)&&(!own(s,key)||!sameJson(options[key],s[key])))add('MODAL_RUNTIME_OVERRIDE','/options/'+key,'Runtime modal setting differs from the project study; the Worker reads study values',{studyPointer:'/study/'+key});
  for(const key of ['youngModulus','poissonRatio','density','materialProperties','temperature','referenceTemperature','temperatureSource','prestress','fatigueAssessment','fractureAssessment','conditions','boundary','force','pressure','normalTraction','displacement','fixed','forces','displacements','tractions','pressures','loads','supports'])if(own(options,key))add('MODAL_RUNTIME_OVERRIDE','/options/'+key,'This runtime physical input is not supported by modal analysis');
  const conditions=Array.isArray(project.conditions)?project.conditions:[];
  if(!Array.isArray(project.conditions))add('MODAL_INPUT_INVALID','/conditions','Explicit boundary condition array required');
  const regionsValid=v=>Array.isArray(v)&&v.length>0&&v.every(r=>object(r)&&Number.isInteger(r.mesh)&&r.mesh>=0&&project.meshes?.[r.mesh]&&Array.isArray(r.triangles)&&r.triangles.length>0&&r.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<(project.meshes[r.mesh].faceIds?.length??0)));
  const directionValid=(v,type)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)&&(!['force','displacement'].includes(type)||Number.isFinite(Math.hypot(...v))&&Math.hypot(...v)>=(type==='displacement'?1e-12:Number.MIN_VALUE));
  let support=false;
  for(const [index,candidate]of conditions.entries()){
   const c=object(candidate)?candidate:{},base='/conditions/'+index;
   require(base+'/type',c.type,v=>['fixed','displacement','force','pressure','normalTraction'].includes(v),'Boundary must belong to structural analysis');
   require(base+'/value',c.value,v=>Number.isFinite(v)&&(c.type==='fixed'||v===0),'Only homogeneous supports or exactly zero loads are supported',c.type==='displacement'?'mm':c.type==='force'?'N':['pressure','normalTraction'].includes(c.type)?'Pa':null);
   require(base+'/direction',c.direction,v=>directionValid(v,c.type),'Serialized direction must be finite; forces and prescribed directions must be nonzero');
   require(base+'/regions',c.regions,regionsValid,'Nonempty valid structural boundary regions required');
   for(const key of ['frame','planarRegion','cylindricalRegion','sphericalRegion'])if(c[key]!==undefined)requiredPointers.push(base+'/'+key);
   let validFrame=true;
   if(c.type==='displacement'&&c.frame!==undefined)try{
    validateFrame(c.frame);
    if(!directionValid(c.direction,c.type)||c.direction.some((v,k)=>Math.abs(v-c.frame.axes[c.frame.axis][k])>1e-7))throw Error('Constraint direction does not match local frame');
   }catch(error){validFrame=false;add('MODAL_INPUT_INVALID',base+'/frame',error.message);}
   if(['fixed','displacement'].includes(c.type)&&(c.type==='fixed'||c.value===0)&&regionsValid(c.regions)&&!c.cadUpdateRequired&&directionValid(c.direction,c.type)&&validFrame)support=true;
  }
  if(!support)add('MODAL_SUPPORT_MISSING','/conditions','Explicit homogeneous support required; constraint rank and remaining rigid-body modes are checked after meshing');
 }catch{add('MODAL_INPUT_INVALID','/','Malformed modal inputs cannot be inspected');}
 result.requiredPointers=[...new Set(requiredPointers)];return result;
}
