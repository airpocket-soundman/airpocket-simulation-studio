import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile,stat,readdir} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';

const digest=b=>`sha256:${createHash('sha256').update(b).digest('hex')}`;
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function su2Capabilities(){return {schemaVersion:1,solver:'SU2',version:'8.5.0',status:'experimental-native-adapter',browserWasm:false,studies:['steady-incompressible-laminar','steady-incompressible-rans-sa','unsteady-incompressible-rans-sa'],meshFormat:'SU2',meshUnits:'m',fieldUnits:{pressure:'Pa',velocity:'m/s'},intermediate:['residual-log10'],temporalLimits:{maximumTimeSteps:200,maximumSavedFrames:41,maximumInnerIterations:500},wallModelNumerics:{optional:true,maximumIterations:{minimum:200,maximum:2000},relaxationFactor:{minimum:.05,maximum:1},changesPhysicalWallModel:false},temporalResults:'completed-job time-indexed fields; not live intermediate fields',unsupported:['other-turbulence-models','browser-wasm-execution','automatic-cow-meshing'],physicalValidationComplete:false};}
export function buildSu2Config(input){
 if(input?.schemaVersion!==1||!['steady-incompressible-laminar','steady-incompressible-rans-sa','unsteady-incompressible-rans-sa'].includes(input.kind))throw fail('SU2_UNSUPPORTED_STUDY','Explicit steady incompressible laminar schemaVersion 1 input required');
 if(input.meshUnits!=='m')throw fail('SU2_MESH_UNITS','SU2 mesh coordinates must explicitly be metres');
 for(const key of ['densityKgM3','dynamicViscosityPaS'])if(!Number.isFinite(input[key])||input[key]<=0)throw fail('SU2_MATERIAL_REQUIRED',`${key} must be positive`);
 if(!Array.isArray(input.velocityMps)||input.velocityMps.length!==3||!input.velocityMps.every(Number.isFinite)||Math.hypot(...input.velocityMps)===0)throw fail('SU2_VELOCITY_REQUIRED','Explicit nonzero velocityMps vector required');
 for(const key of ['wallMarker','farfieldMarker'])if(typeof input[key]!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(input[key]))throw fail('SU2_BOUNDARY_REQUIRED',`${key} must identify a mesh boundary`);
 if(input.wallMarker===input.farfieldMarker)throw fail('SU2_BOUNDARY_CONFLICT','Wall and farfield must be distinct');
 if(!Number.isInteger(input.maxIterations)||input.maxIterations<1||input.maxIterations>100000)throw fail('SU2_ITERATIONS_REQUIRED','maxIterations must be 1..100000');
 if(!Number.isFinite(input.residualLog10Target)||input.residualLog10Target> -3||input.residualLog10Target< -14)throw fail('SU2_RESIDUAL_REQUIRED','residualLog10Target must be -14..-3');
 const cfl=input.cflNumber??10,mg=input.multigridLevels??0;
 if(!Number.isFinite(cfl)||cfl<=0||cfl>1000||!Number.isInteger(mg)||mg<0||mg>3)throw fail('SU2_NUMERICAL_SETTINGS','Explicit CFL must be >0..1000 and multigridLevels 0..3');
 const transient=input.kind==='unsteady-incompressible-rans-sa';
 if(transient&&input.maxIterations>500)throw fail('SU2_TIME_SETTINGS','At most 500 inner iterations per physical time step');
 if(transient&&(!Number.isFinite(input.timeStepSeconds)||input.timeStepSeconds<=0||input.timeStepSeconds>1||!Number.isInteger(input.timeSteps)||input.timeSteps<2||input.timeSteps>200||!Number.isInteger(input.outputEvery)||input.outputEvery<1||input.outputEvery>input.timeSteps||Math.ceil(input.timeSteps/input.outputEvery)>40))throw fail('SU2_TIME_SETTINGS','Time step >0..1 s, 2..200 steps and at most 40 saved intervals required');
 const rans=input.kind.endsWith('rans-sa'),nuFactor=input.freestreamNuFactor??input.turbulentViscosityRatio;
 if(input.freestreamNuFactor!==undefined&&input.turbulentViscosityRatio!==undefined&&input.freestreamNuFactor!==input.turbulentViscosityRatio)throw fail('SU2_TURBULENCE_CONFLICT','Conflicting freestream nu factors');
 if(rans&&(input.turbulenceModel!=='SA'||input.wallTreatment!=='standard-wall-function'||!Number.isFinite(nuFactor)||nuFactor<=0))throw fail('SU2_TURBULENCE_REQUIRED','SA, standard-wall-function and explicit positive freestreamNuFactor required');
 const wall=input.wallModelNumerics;
 if(wall!==undefined&&(!rans||!wall||typeof wall!=='object'||Array.isArray(wall)||Object.keys(wall).some(k=>!['maximumIterations','relaxationFactor'].includes(k))||!Number.isInteger(wall.maximumIterations)||wall.maximumIterations<200||wall.maximumIterations>2000||!Number.isFinite(wall.relaxationFactor)||wall.relaxationFactor<.05||wall.relaxationFactor>1))throw fail('SU2_WALL_NUMERICS','Wall-model maximumIterations must be 200..2000, relaxationFactor .05..1; SA only');
 let config=`SOLVER= ${rans?'INC_RANS':'INC_NAVIER_STOKES'}\nKIND_TURB_MODEL= ${rans?'SA':'NONE'}${rans?`\nFREESTREAM_NU_FACTOR= ${nuFactor}\nMARKER_WALL_FUNCTIONS= (${input.wallMarker}, STANDARD_WALL_FUNCTION)`:''}\nINC_NONDIM= DIMENSIONAL\nINC_ENERGY_EQUATION= NO\nMATH_PROBLEM= DIRECT\nRESTART_SOL= NO\nINC_DENSITY_INIT= ${input.densityKgM3}\nINC_VELOCITY_INIT= (${input.velocityMps.join(', ')})\nVISCOSITY_MODEL= CONSTANT_VISCOSITY\nMU_CONSTANT= ${input.dynamicViscosityPaS}\nMARKER_HEATFLUX= (${input.wallMarker}, 0.0)\nMARKER_FAR= (${input.farfieldMarker})\nMARKER_PLOTTING= (${input.wallMarker})\nMARKER_MONITORING= (${input.wallMarker})\nNUM_METHOD_GRAD= GREEN_GAUSS\nCFL_NUMBER= ${cfl}\nMGLEVEL= ${mg}\nCONV_NUM_METHOD_FLOW= FDS\nMUSCL_FLOW= YES\nSLOPE_LIMITER_FLOW= NONE\nTIME_DISCRE_FLOW= EULER_IMPLICIT\nITER= ${input.maxIterations}\nCONV_FIELD= RMS_PRESSURE\nCONV_RESIDUAL_MINVAL= ${input.residualLog10Target}\nCONV_STARTITER= 10\nMESH_FILENAME= mesh.su2\nMESH_FORMAT= SU2\nTABULAR_FORMAT= CSV\nCONV_FILENAME= history\nVOLUME_FILENAME= flow\nSURFACE_FILENAME= surface_flow\nRESTART_FILENAME= restart_flow\nOUTPUT_FILES= (PARAVIEW, SURFACE_PARAVIEW)\nOUTPUT_WRT_FREQ= 100\nSCREEN_OUTPUT= (INNER_ITER, RMS_PRESSURE, RMS_VELOCITY-X, DRAG)\n`;
 if(transient)config=config.replace(`ITER= ${input.maxIterations}\n`,`TIME_DOMAIN= YES\nTIME_MARCHING= DUAL_TIME_STEPPING-2ND_ORDER\nTIME_STEP= ${input.timeStepSeconds}\nTIME_ITER= ${input.timeSteps}\nINNER_ITER= ${input.maxIterations}\nMAX_TIME= ${input.timeStepSeconds*input.timeSteps}\n`).replace('CONV_FIELD= RMS_PRESSURE','CONV_FIELD= (RMS_PRESSURE, RMS_VELOCITY-X, RMS_VELOCITY-Y, RMS_VELOCITY-Z, RMS_NU_TILDE)').replace('OUTPUT_WRT_FREQ= 100',`OUTPUT_WRT_FREQ= ${input.outputEvery}`);
 if(wall)config+=`WALLMODEL_MAXITER= ${wall.maximumIterations}\nWALLMODEL_RELFAC= ${wall.relaxationFactor}\n`;
 return config;
}
export function parseSu2History(text){
 const rows=text.trim().split(/\r?\n/);if(rows.length<2)return null;
 const keys=rows[0].split(',').map(s=>s.trim().replaceAll('"',''));
 const cells=rows.at(-1).split(',');if(cells.some(s=>!s.trim()))return null;const values=cells.map(Number);if(values.length!==keys.length||!values.every(Number.isFinite))return null;
 return Object.fromEntries(keys.map((k,i)=>[k,values[i]]));
}
export function assessSu2Run(history,target,log=''){
 const residualChecks=Object.entries(history??{}).filter(([key])=>/^rms\[/.test(key)).map(([name,value])=>({name,value,target,met:Number.isFinite(value)&&value<=target}));
 const wallWarnings=[...log.matchAll(/Computation of wall coefficients \(y\+\) did not converge in (\d+) points/gi)];
 const diagnostics=wallWarnings.length?[{code:'SU2_WALL_MODEL_NOT_CONVERGED',severity:'warning',occurrences:wallWarnings.length,lastAffectedPoints:Number(wallWarnings.at(-1)[1]),maximumAffectedPoints:wallWarnings.reduce((max,m)=>Math.max(max,Number(m[1])),0),message:'Wall-function y+ computation did not converge at some points.',suggestions:['Inspect the wall y+ distribution and near-wall mesh.','Refine or replace the near-wall mesh and verify a supported wall treatment.','Do not use this result as a validated drag or pressure prediction.']}]:[];
 const pressureCriterionMet=residualChecks.some(r=>r.name==='rms[P]'&&r.met),allReportedResidualsMet=residualChecks.length>0&&residualChecks.every(r=>r.met);
 return {pressureCriterionMet,allReportedResidualsMet,numericallyConverged:pressureCriterionMet&&allReportedResidualsMet&&!diagnostics.length,residualChecks,diagnostics,physicalValidationComplete:false};
}
/** New directory per job. No shell, global installation, arbitrary config, or fallback solver. */
export async function runSu2Native({executable,meshPath,outputDirectory,input,timeoutMs=120000,signal,onObservation=()=>{}}){
 const config=buildSu2Config(input);
 for(const path of [executable,meshPath,outputDirectory])if(typeof path!=='string'||!isAbsolute(path))throw fail('SU2_ABSOLUTE_PATH','Absolute executable, mesh and output paths required');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)throw fail('SU2_TIMEOUT_RANGE','timeoutMs must be 1..3600000');
 if(signal?.aborted)throw fail('SU2_CANCELLED','Cancelled before launch');
 await stat(executable);const mesh=await readFile(meshPath);if(mesh.length>100000000)throw fail('SU2_MESH_LIMIT','Mesh exceeds 100 MB');
 const markers=[...mesh.toString('utf8').matchAll(/^\s*MARKER_TAG\s*=\s*(\S+)\s*$/gm)].map(m=>m[1]);
 if(![input.wallMarker,input.farfieldMarker].every(m=>markers.includes(m)))throw fail('SU2_BOUNDARY_MISSING','Declared boundary marker absent from mesh');
 await mkdir(outputDirectory); // Refuse an existing directory, including previous job output.
 await copyFile(meshPath,resolve(outputDirectory,'mesh.su2'));
 await writeFile(resolve(outputDirectory,'input.json'),JSON.stringify(input,null,2));
 await writeFile(resolve(outputDirectory,'case.cfg'),config);
 const inputRevision=digest(Buffer.from(JSON.stringify({input,mesh:digest(mesh),config})));
 let tail='',reason=null,lastObservation='',reading=false,settled=false,logBytes=0;const chunks=[];
 const child=spawn(executable,['case.cfg','-t','1'],{cwd:outputDirectory,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const collect=b=>{tail=(tail+b.toString()).slice(-16384);if(logBytes<32000000){const kept=b.subarray(0,32000000-logBytes);chunks.push(kept);logBytes+=kept.length;}};child.stdout.on('data',collect);child.stderr.on('data',collect);
 const cancel=()=>{reason='SU2_CANCELLED';child.kill();};signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 const timer=setTimeout(()=>{reason='SU2_TIMEOUT';child.kill();},timeoutMs);
 const poll=setInterval(async()=>{if(reading)return;reading=true;try{const summary=parseSu2History(await readFile(resolve(outputDirectory,'history.csv'),'utf8'));const key=JSON.stringify(summary);if(!settled&&summary&&key!==lastObservation){lastObservation=key;onObservation({schemaVersion:1,inputRevision,provisional:true,phase:'iteration',residualKind:'solver-reported-log10',summary});}}catch{}finally{reading=false;}},250);
 let exit;try{exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',(code,signal)=>res({code,signal}));});}finally{settled=true;clearTimeout(timer);clearInterval(poll);signal?.removeEventListener('abort',cancel);}
 await writeFile(resolve(outputDirectory,'solver.log'),Buffer.concat(chunks));
 if(reason||exit.code!==0)throw Object.assign(fail(reason??'SU2_EXECUTION_FAILED','Native SU2 did not complete'),{inputRevision,exit,logTail:tail});
 const history=parseSu2History(await readFile(resolve(outputDirectory,'history.csv'),'utf8'));
 const assessment=assessSu2Run(history,input.residualLog10Target,Buffer.concat(chunks).toString());
 const transient=input.kind==='unsteady-incompressible-rans-sa';
 if(transient&&history?.Time_Iter!==input.timeSteps-1)throw fail('SU2_TIME_INCOMPLETE','Solver did not reach the requested final physical-time index');
 const names=transient?(await readdir(outputDirectory)).filter(n=>/^(flow|surface_flow)_\d+\.vtu$/.test(n)).sort():['flow.vtu','surface_flow.vtu'];
 if(transient&&!names.some(n=>n.startsWith('flow_')))throw fail('SU2_TIME_OUTPUT_MISSING','No time-indexed volume results');
 let totalArtifactBytes=0;for(const name of [...names,'history.csv']){totalArtifactBytes+=(await stat(resolve(outputDirectory,name))).size;if(totalArtifactBytes>256000000)throw fail('SU2_OUTPUT_LIMIT','Registered output exceeds 256 MB');}
 const artifacts=[];for(const name of [...names,'history.csv']){const bytes=await readFile(resolve(outputDirectory,name));artifacts.push({name,bytes:bytes.length,sha256:digest(bytes)});}
 if(transient)assessment.diagnostics.push({code:'SU2_TIME_CONVERGENCE_UNVERIFIED',severity:'warning',message:'Inner convergence across all physical steps has not been certified; this series is provisional.',suggestions:['Inspect residuals at every physical time step.','Refine wall treatment and test smaller time steps before interpreting wake dynamics.']});
 const result={schemaVersion:1,solver:'SU2',expectedVersion:'8.5.0',inputRevision,executionSettled:true,...assessment,...(transient?{numericallyConverged:false}:{}),convergenceCriterion:transient?'All five residual fields are stopping criteria within each physical time step; final assessment alone does not certify earlier steps.':'SU2 stopping criterion: pressure residual only; adapter additionally checks all reported residuals and wall warnings',provisional:true,physicalValidationComplete:false,...(transient?{temporal:{timeStepSeconds:input.timeStepSeconds,requestedSteps:input.timeSteps,outputEvery:input.outputEvery,startup:'uniform-initial-flow',lastTimeIndex:history?.Time_Iter??null,allTimeStepsConverged:false,warning:'Final residual checks do not certify convergence of every physical time step.'}}:{}),history,artifacts};
 await writeFile(resolve(outputDirectory,'result.json'),JSON.stringify(result,null,2));return result;
}
