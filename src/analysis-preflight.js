import {inspectAcousticInputContract} from './acoustic-input-contract.js';
import {inspectFluidInputContract} from './fluid-input-contract.js';
import {inspectThermalInputContract} from './thermal-input-contract.js';
import {resolveObservationProfile} from './observation-profiles.js';
import {diagnoseExecution,getCapabilities} from './capabilities.js';
import {validateProject} from './regions.js';
import {validateMaterialProperties} from './materials.js';
import {requireResolvedCadConditions} from './cad-update-state.js';
import {inspectInputProvenance} from './input-provenance.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const units={geometry:'mm',displacement:'mm',youngModulus:'Pa',force:'N',pressure:'Pa',density:'kg/m3',gravity:'m/s2',poissonRatio:'1'};
/** No mutation or solver initialization. Strict required-input/provenance contract
 * covers static isotropic linear structure and explicit thermal, acoustic and limited fluid inputs. A successful report
 * still requires boundary transfer, rigid-body and mesh-quality checks after meshing.
 * Legacy projects need no new provenance, but still need actual material values.
 */
export function preflightProject(project,options={}, {target='browser',operation='solve',mode}={}){
 if(!object(project)||!object(options)||!['browser','node'].includes(target)||!['solve','mesh'].includes(operation))throw TypeError('Invalid preflight arguments');
 const diagnostics=[],requiredPointers=[];
 const selectedObservation=resolveObservationProfile(project,options,target,operation);
 const add=(code,targetPath,message,evidence,suggestions,severity='error')=>diagnostics.push({code,severity,target:targetPath,message,evidence,suggestions,requiresUserIntent:true});
 const selectedMode=mode??project.analysisIntent?.mode??(project.inputProvenance===undefined?'legacy':'quantitative');
 const validMode=['legacy','quantitative','exploratory'].includes(selectedMode);
 if(!validMode||project.analysisIntent!==undefined&&(!object(project.analysisIntent)||!['quantitative','exploratory'].includes(project.analysisIntent.mode)))add('ANALYSIS_INTENT_INVALID','/analysisIntent','Invalid analysis intent',{intent:project.analysisIntent,mode:selectedMode},['Choose quantitative or exploratory mode']);
 const effectiveMode=validMode?selectedMode:'quantitative';
 const thermalContract=operation==='solve'&&project.study?.kind==='thermal'&&effectiveMode!=='legacy'?inspectThermalInputContract(project,options,{mode:effectiveMode}):null;
 const acousticContract=operation==='solve'&&project.study?.kind==='acoustic'&&effectiveMode!=='legacy'?inspectAcousticInputContract(project,options,{mode:effectiveMode}):null;
 const fluidContract=operation==='solve'&&['channelFlow','creepingFlow'].includes(project.study?.kind)&&effectiveMode!=='legacy'?inspectFluidInputContract(project,options,{mode:effectiveMode}):null;
 const physicalContract=thermalContract??acousticContract??fluidContract;
 const inputUnits={...units,...(physicalContract?.units??{})};
 try{diagnostics.push(...diagnoseExecution(operation==='mesh'?{study:{kind:'structural'}}:project,options,target).diagnostics);}catch(error){add('EXECUTION_OPTIONS_INVALID','/options','Invalid execution options',{message:error.message},['Use the selected target capability contract']);}
 try{validateProject(project);}catch(error){add('PROJECT_INVALID','/','Project validation failed',{message:error.message},['Repair the indicated saved input; preserve intended physics']);}
 try{validateMaterialProperties(project.materialProperties??{});}catch(error){add('MATERIAL_INVALID','/materialProperties','Material validation failed',{message:error.message},['Correct material values and their documented applicable ranges']);}
 if(operation==='solve')try{requireResolvedCadConditions(project);}catch(error){add('CAD_REGIONS_UNRESOLVED','/conditions','CAD regions require resolution',{message:error.message},['Reselect or explicitly reapply the affected regions']);}
 if(!object(project.sourceModel))add('SOURCE_MODEL_REQUIRED','/sourceModel','Original solid source is required for meshing',{available:false},['Reload the original STEP/STL source or provide a supported solid definition']);
 if(project.units!==undefined){
  if(!object(project.units))add('INPUT_UNITS_INVALID','/units','Expected a unit map',{units:project.units},['Use the documented fixed input units']);
  else for(const [key,unit] of Object.entries(inputUnits))if(project.units[key]!==undefined&&project.units[key]!==unit)add('INPUT_UNIT_MISMATCH','/units/'+key,'Input unit differs from the solver contract',{actual:project.units[key],expected:unit},['Convert the value and record the conversion before using '+unit]);
 }
 if(options.size!==undefined&&(!Number.isFinite(options.size)||options.size<=0))add('MESH_SIZE_INVALID','/options/size','Mesh size must be positive millimetres',{value:options.size,unit:'mm'},['Provide a positive mesh size in mm']);
 const study=object(project.study)?project.study:{},material=object(project.materialProperties)?project.materialProperties:{},conditions=Array.isArray(project.conditions)?project.conditions:[];
 const inheritedProvisional=operation==='solve'&&((study.kind==='structural'&&study.thermalStress===true&&study.temperatureSource?.sourceAssessment?.provisional===true)||(study.kind==='acoustic'&&study.vibrationSource?.sourceAssessment?.provisional===true));
 const supported=(study.kind??'structural')==='structural'&&!study.modalAnalysis&&!study.thermalStress&&!material.orthotropic&&!material.plasticity&&!material.hyperelastic&&!material.dependence?.elasticTemperatureTable;
 if(operation==='solve'&&supported){
  const usesGravity=study.gravityEnabled!==false&&(effectiveMode==='legacy'?Array.isArray(study.gravity)&&study.gravity.some(v=>v!==0):study.gravityEnabled===true);
  requiredPointers.push('/study/kind','/study/gravityEnabled','/materialProperties/youngModulus','/materialProperties/poissonRatio');
  if(usesGravity){requiredPointers.push('/study/gravity','/materialProperties/density');}
  conditions.forEach((condition,index)=>{
   const base='/conditions/'+index;
   // Supports are physical intent too; all serialized boundary definitions need evidence.
   for(const key of ['type','value','direction','regions'])requiredPointers.push(base+'/'+key);
   for(const key of ['frame','planarRegion','cylindricalRegion'])if(condition?.[key]!==undefined)requiredPointers.push(base+'/'+key);
   if(!['fixed','displacement','force','pressure','normalTraction'].includes(condition?.type))add('CONDITION_DISCIPLINE_MISMATCH',base+'/type','Boundary condition is not structural',{type:condition?.type},['Use conditions belonging to the intended structural study']);
  });
  if(!conditions.some(condition=>['fixed','displacement'].includes(condition?.type)&&!condition.cadUpdateRequired&&condition.regions?.length))add('STRUCTURAL_SUPPORT_MISSING','/conditions','No fixed or displacement support was specified',{supportCount:0},['Specify intended supports; do not add artificial constraints only to make the solve converge']);
  for(const key of ['youngModulus','poissonRatio',...(usesGravity?['density']:[])])if(material[key]===undefined||material[key]===null)add('MATERIAL_REQUIRED','/materialProperties/'+key,'Required explicit material value is missing',{key,unit:units[key]},['Obtain the material value and its source, or record an explicit exploratory assumption']);
  if(effectiveMode!=='legacy'&&typeof study.gravityEnabled!=='boolean')add('GRAVITY_INTENT_REQUIRED','/study/gravityEnabled','Explicit gravity setting required',{value:study.gravityEnabled??null},['Record whether gravity is included in the intended physical model']);
 }else if(physicalContract){requiredPointers.push(...physicalContract.requiredPointers);diagnostics.push(...physicalContract.diagnostics);}
 else if(operation==='solve')add('PREFLIGHT_CONTRACT_LIMITED','/study','Required-input provenance contract is not implemented for this study/material combination',{kind:study.kind??'structural'},['Use the documented study-specific validation; extend the provenance contract before a quantitative or exploratory run'],effectiveMode==='legacy'?'warning':'error');
 let provenance;
 try{provenance=inspectInputProvenance(project,project.inputProvenance,{mode:effectiveMode,requiredPointers:effectiveMode==='legacy'?[]:requiredPointers});diagnostics.push(...provenance.diagnostics);}catch(error){add('PROVENANCE_INVALID','/inputProvenance','Provenance could not be inspected',{message:error.message},['Use JSON input and repair the provenance contract']);}
 return {schemaVersion:1,target,operation,selectedObservation,mode:effectiveMode,allowed:!diagnostics.some(issue=>issue.severity==='error'),provisional:inheritedProvisional||(provenance?.provisional??false),completePreflight:false,requiredInputContract:operation==='mesh'?'mesh-only':physicalContract?physicalContract.contract:supported?'static-isotropic-linear-structure':'unsupported',requiredPointers,units:{...getCapabilities({target}).units,...inputUnits},diagnostics,remainingChecks:['Mesh quality and element validity after generation','Boundary-region transfer and constraint rank/rigid-body modes after meshing','Source applicability, convergence, mesh dependence and physical accuracy']};
}

export function requireAnalysisPreflight(project,options={},runtime={}){
 const report=preflightProject(project,options,runtime);
 if(!report.allowed)throw Object.assign(Error('Analysis preflight failed: '+report.diagnostics.filter(d=>d.severity==='error').slice(0,20).map(d=>d.code+': '+(d.evidence?.message??d.message??'')).join('; ')),{code:'ANALYSIS_PREFLIGHT_FAILED',diagnostics:report.diagnostics});
 return {schemaVersion:1,mode:report.mode,provisional:report.provisional,completePreflight:false,remainingChecks:report.remainingChecks};
}

export function validateSavedAssessment(output){
 const input=output?.input,top=output?.analysisAssessment,result=output?.result?.analysisAssessment;
 const study=input?.study,hasSourceAssessment=(study?.kind==='structural'&&study.thermalStress===true&&study.temperatureSource?.sourceAssessment!==undefined)||(study?.kind==='acoustic'&&study.vibrationSource?.sourceAssessment!==undefined);
 if(top===undefined&&result===undefined&&input?.analysisIntent===undefined&&input?.inputProvenance===undefined&&!hasSourceAssessment)return true;
 const options=output?.calculation?.options??{},expected=requireAnalysisPreflight(input,options,{target:options.method==='webgpu-pcg'?'browser':'node'});
 for(const assessment of [top,result])if(!assessment||assessment.schemaVersion!==1||assessment.mode!==expected.mode||assessment.provisional!==expected.provisional||assessment.completePreflight!==false||JSON.stringify(assessment.remainingChecks)!==JSON.stringify(expected.remainingChecks))throw Error('Saved analysis assessment does not match its input');
 if(output.job&&(output.job.final!==true||output.job.provisional!==expected.provisional))throw Error('Saved job assessment does not match its input');
 return true;
}
