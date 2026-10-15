import {transferConditions} from './boundaries.js';
import {getProjectRevision,canonicalJson} from './project-revision.js';
import {getAnalysisFailure,analysisError} from './analysis-failure.js';

const unsupported=(project)=>{
 const study=project.study??{},material=project.materialProperties??{};
 return (study.kind!==undefined&&study.kind!=='structural')||study.modalAnalysis===true||study.thermalStress===true||study.materialTemperature!==undefined||Boolean(material.orthotropic||material.plasticity||material.hyperelastic||material.dependence?.elasticTemperatureTable);
};
const rejected=(code,message,target,evidence={})=>({schemaVersion:1,allowed:false,completePreflight:false,diagnostics:[{code,severity:'error',stage:'boundary-transfer',target,message,evidence,suggestions:['Inspect the exact saved input and retained mesh-only job, then retry with a successful settled job for the current revision'],requiresUserIntent:true}],reports:[],remainingChecks:['Constraint rank and rigid-body modes have not been checked.','Solver convergence and physical accuracy have not been checked.']});

/** Inspect selected-condition transfer against a retained, successful mesh-only output.
 * This is intentionally read-only and never invokes a mesher or solver. */
export async function preflightMeshBoundaryTransfer({project,job,output,expectedRevision}={}){
 let projectBytes,outputBytes,projectSnapshot,outputSnapshot;
 try{projectBytes=canonicalJson(project);projectSnapshot=JSON.parse(projectBytes);}catch{return rejected('ANALYSIS_MESH_PREFLIGHT_INPUT_INVALID','Saved input is not valid revisioned project data','/');}
 try{if(output!==undefined&&output!==null){outputBytes=canonicalJson({input:output.input,mesh:output.mesh});outputSnapshot=JSON.parse(outputBytes);}}catch{return rejected('ANALYSIS_MESH_PREFLIGHT_OUTPUT_INVALID','Retained mesh output is not valid revisioned JSON data','/job');}
 let revision;
 try{revision=await getProjectRevision(projectSnapshot);}catch{return rejected('ANALYSIS_MESH_PREFLIGHT_INPUT_INVALID','Saved input is not valid revisioned project data','/');}
 const unchanged=()=>{try{return canonicalJson(project)===projectBytes&&(output===undefined||output===null||canonicalJson({input:output.input,mesh:output.mesh})===outputBytes);}catch{return false;}};
 if(!unchanged())return rejected('ANALYSIS_MESH_PREFLIGHT_INPUT_CHANGED','Input or retained mesh changed during boundary-transfer inspection','/');
 if(typeof expectedRevision!=='string'||revision!==expectedRevision)return rejected('ANALYSIS_MESH_PREFLIGHT_STALE_INPUT','Saved input revision does not match the requested exact revision','/',{expectedRevision:typeof expectedRevision==='string'?expectedRevision:null,currentRevision:revision});
 if(!job||job.state!=='succeeded'||job.executionSettled!==true||job.operation!=='mesh')return rejected('ANALYSIS_MESH_PREFLIGHT_JOB_NOT_READY','A successful, execution-settled mesh-only job is required','/job',{state:job?.state??null,executionSettled:job?.executionSettled??null,operation:job?.operation??null});
 if(job.inputRevision!==revision)return rejected('ANALYSIS_MESH_PREFLIGHT_JOB_STALE','Retained mesh job was produced from a different input revision','/job',{jobRevision:job.inputRevision??null,currentRevision:revision});
 if(!outputSnapshot?.input||!outputSnapshot?.mesh)return rejected('ANALYSIS_MESH_PREFLIGHT_OUTPUT_INVALID','Retained mesh output does not contain a valid input and mesh','/job');
 let outputRevision;try{outputRevision=await getProjectRevision(outputSnapshot.input);}catch{return rejected('ANALYSIS_MESH_PREFLIGHT_OUTPUT_INVALID','Retained mesh output input is invalid','/job');}
 if(!unchanged())return rejected('ANALYSIS_MESH_PREFLIGHT_INPUT_CHANGED','Input or retained mesh changed during boundary-transfer inspection','/');
 if(outputRevision!==revision)return rejected('ANALYSIS_MESH_PREFLIGHT_JOB_STALE','Retained mesh was produced from a different input revision','/job',{jobRevision:job.inputRevision,currentRevision:revision,outputRevision});
 if(unsupported(projectSnapshot))return rejected('ANALYSIS_MESH_PREFLIGHT_MODEL_UNSUPPORTED','Boundary-transfer inspection is limited to static linear structural inputs','/study',{kind:projectSnapshot.study?.kind??'structural'});
 try{
  const transferred=transferConditions(projectSnapshot,outputSnapshot.mesh);
  if(!unchanged())return rejected('ANALYSIS_MESH_PREFLIGHT_INPUT_CHANGED','Input or retained mesh changed during boundary-transfer inspection','/');
  return {schemaVersion:1,allowed:true,completePreflight:false,inputRevision:revision,jobId:job.jobId,reports:transferred.reports.map(({conditionIndex,type,originalAreaMm2,mappedAreaMm2,relativeAreaError,maxProjectionDistanceMm,approximation})=>({conditionIndex,type,originalAreaMm2,mappedAreaMm2,relativeAreaError,maxProjectionDistanceMm,approximation})),diagnostics:[],remainingChecks:['Constraint rank and rigid-body modes have not been checked.','Solver convergence and physical accuracy have not been checked.']};
 }catch(error){
  const failure=getAnalysisFailure(error);if(failure)return {...rejected(failure.code,failure.message,failure.diagnostics[0].target,failure.diagnostics[0].evidence),diagnostics:failure.diagnostics};
  const diagnostic=analysisError('ANALYSIS_MESH_PREFLIGHT_FAILED','Boundary transfer inspection failed',{stage:'boundary-transfer',target:'/conditions',evidence:{}});
  return {...rejected(diagnostic.analysisDiagnostic.code,diagnostic.message,'/conditions'),diagnostics:[diagnostic.analysisDiagnostic]};
 }
}
