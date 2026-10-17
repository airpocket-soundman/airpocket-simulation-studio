import {createJobObservationQueue,validateObservationQueueLimits,observationQueueDefaults} from '../src/job-observation-queue.js';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,isAbsolute,join} from 'node:path';
import {createAnalysisJobs} from '../src/analysis-jobs.js';
import {createStudioApi} from '../src/studio-api.js';
import {analyzeProject} from './headless-analysis.mjs';
import {publishJson} from './json-artifacts.mjs';
import {getProjectRevision} from '../src/project-revision.js';
import {inspectIntermediate} from '../src/intermediate-results.js';
import {createJobStore,restoredJobView} from './analysis-job-store.mjs';

export function summarizeAnalysis({mesh,result}){
 return {mesh:mesh.summary,kind:result?.kind,engine:result?.engine,residual:result?.residual,iterations:result?.iterations,maxDisplacementMm:result?.maxDisplacementMm,maxVonMisesPa:result?.maxVonMisesPa,minTemperature:result?.minTemperature,maxTemperature:result?.maxTemperature,maxSpeedMs:result?.maxSpeedMs,reactionDragN:result?.reactionDragN,stokes:result?.stokes,modeFrequenciesHz:result?.modes?.map(m=>m.frequencyHz),analysisAssessment:result?.analysisAssessment};
}
export function createHeadlessJobService({timeoutMs=120000,maxJobs=32,maxEvents=256,maxArtifactBytes=64_000_000,maxPendingObservationEvents=observationQueueDefaults.maxEvents,maxPendingObservationBytes=observationQueueDefaults.maxBytes,isolation='worker',createProcessWorker,jobStore}={}){
 validateObservationQueueLimits(maxPendingObservationEvents,maxPendingObservationBytes);
 if(!['worker','process'].includes(isolation)||createProcessWorker!==undefined&&typeof createProcessWorker!=='function')throw Error('Invalid analysis isolation configuration');
 if(createProcessWorker!==undefined&&isolation!=='process')throw Error('Process worker factory requires process isolation');
 if(jobStore!==undefined&&(typeof jobStore!=='string'||!jobStore))throw Error('Invalid job store configuration');
 const store=jobStore===undefined?undefined:createJobStore(jobStore,{onDiagnostic:entry=>process.stderr.write('Job store: '+JSON.stringify(entry)+'\n')}),restored=store?store.load():new Map();
 const destinations=new Map(),artifacts=new Map(),outputPaths=new Map();
 const jobs=createAnalysisJobs({id:randomUUID,timeoutMs,maxJobs,maxEvents,...(store?{onRecord:store.persist}:{}),execute:async({project,options,operation,context,inputRevision,jobId,signal,onEvent,beginCommit})=>{
  const {outputPath,includeFields}=context,key=process.platform==='win32'?outputPath.toLowerCase():outputPath;
  if(destinations.has(key))throw Error('Analysis output is already reserved by another job');
  destinations.set(key,jobId);
  let artifactDirectory,artifactBytes=0,artifactSequence=0,meshArtifact,writeError,artifactLimitReported=false;
  const records=new Map();artifacts.set(jobId,records);
  try{
   try{await stat(outputPath);throw Error('Analysis output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
   if(signal.aborted)throw Error('Calculation cancelled');
   if(includeFields){artifactDirectory=outputPath+'.intermediate';await mkdir(artifactDirectory);}
   const queue=createJobObservationQueue({maxEvents:maxPendingObservationEvents,maxBytes:maxPendingObservationBytes,isActive:()=>!signal.aborted&&!writeError,consume:async(event,metadata)=>{
     if(signal.aborted||writeError)return;
     const {mesh,field,...summary}=event;
     if(mesh)meshArtifact=undefined; // A remesh invalidates the prior mesh reference.
     if(includeFields&&(mesh||field)){
      const value={schemaVersion:1,jobId,inputRevision,provisional:true,...(mesh?{mesh}:{field}),...(field&&meshArtifact?{meshArtifact}:{}),stage:event.stage,...(event.time!==undefined?{time:event.time,timeUnit:event.timeUnit}:{}),converged:event.converged};
      const json=JSON.stringify(value)+'\n',bytes=Buffer.byteLength(json);
      if(artifactBytes+bytes<=maxArtifactBytes&&(!field||meshArtifact)){
       const path=join(artifactDirectory,String(++artifactSequence).padStart(4,'0')+'.json');
       await writeFile(path,json,{flag:'wx'});artifactBytes+=bytes;
       const artifact={artifactId:String(artifactSequence).padStart(4,'0'),path,bytes,sha256:createHash('sha256').update(json).digest('hex'),kind:mesh?'mesh':field.kind,provisional:true};
       records.set(artifact.artifactId,{...artifact,meshArtifactId:mesh?artifact.artifactId:meshArtifact.artifactId});
       if(mesh)meshArtifact=artifact;
       summary.artifact=artifact;
      }else if(!artifactLimitReported){artifactLimitReported=true;onEvent({stage:'observation-limit',provisional:true,message:'Intermediate field storage limit reached; summaries continue',limitBytes:maxArtifactBytes});}
     }
     onEvent({...summary,...metadata});
    },onError:error=>{writeError??=error;},onSummary:(event,metadata)=>onEvent({...event,...metadata}),onDrop:(event,metadata)=>{const {mesh,field,...summary}=event;onEvent({stage:'observation-queue-limit',provisional:true,observationQueue:metadata});onEvent({...summary,observationSequence:metadata.observationSequence,observationQueue:{dropped:true,reason:metadata.reason}});}});
   const closeQueue=()=>queue.close();signal.addEventListener('abort',closeQueue,{once:true});
   const observe=event=>{if(includeFields)queue.push(event);else{const {mesh,field,...summary}=event;onEvent(summary);}};
   try{
   const output=await analyzeProject(project,options,operation,{signal,observe:true,observeFields:includeFields,onEvent:observe,isolation,...(createProcessWorker?{createProcessWorker}:{})});
   await queue.drain();if(writeError)throw writeError;if(signal.aborted)throw Error('Calculation cancelled');
   beginCommit();
   const job={schemaVersion:1,jobId,inputRevision,final:true,provisional:output.analysisAssessment.provisional};
   const publication=await publishJson(outputPath,{...output,job},{includeIntegrity:true});
   return {...summarizeAnalysis(output),intermediateQueue:queue.snapshot(),...publication,outputPath,...(artifactDirectory?{artifactDirectory,intermediateBytes:artifactBytes,intermediateStorageLimited:artifactLimitReported}:{}),job};
   }finally{queue.close();await queue.drain();signal.removeEventListener('abort',closeQueue);}
  }finally{destinations.delete(key);}
 }});
 async function readArtifact(jobId,artifactId){
  const job=jobs.get(jobId),record=artifacts.get(jobId)?.get(artifactId);
  if(!record)throw Error('Unknown intermediate artifact for this job');
  const invalid=()=>Object.assign(Error('Intermediate artifact integrity check failed'),{code:'INTERMEDIATE_INTEGRITY_FAILED'});
  if((await stat(record.path)).size!==record.bytes)throw invalid();
  const bytes=await readFile(record.path);
  if(bytes.length!==record.bytes||createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw invalid();
  const snapshot=JSON.parse(bytes.toString('utf8'));
  if(snapshot.schemaVersion!==1||snapshot.jobId!==jobId||snapshot.inputRevision!==job.inputRevision||snapshot.provisional!==true)throw invalid();
  return {job,record,snapshot};
 }
 const service={
  async start({path,outputPath,requestId,operation='solve',size=5,method='wasm-pcg',adaptive=false,includeFields=false}={}){
   const pathKey=value=>process.platform==='win32'?resolve(value).toLowerCase():resolve(value);
   if(typeof path!=='string'||!isAbsolute(path)||typeof outputPath!=='string'||!isAbsolute(outputPath)||pathKey(path)===pathKey(outputPath))throw Error('Use distinct absolute input and output paths');
   if(typeof requestId!=='string'||!requestId||requestId.length>200||!['solve','mesh'].includes(operation)||!Number.isFinite(size)||size<=0||!['wasm-pcg','pcg','pcg-strict','mfem-wasm'].includes(method)||typeof adaptive!=='boolean'||typeof includeFields!=='boolean')throw Error('Invalid analysis job arguments');
   // Restored metadata cannot establish payload equivalence. Never replay its retained request ID.
   const prior=[...restored.values()].find(record=>record.requestId===requestId);
   if(prior)throw Object.assign(Error('Request ID belongs to restored job '+prior.jobId+'. Inspect that job before explicitly releasing it or choosing a new request ID; restored results are metadata only.'),{code:'ANALYSIS_JOB_REQUEST_RESTORED'});
   if((await stat(path)).size>100_000_000)throw Error('JSON file exceeds 100 MB');
   const api=createStudioApi();api.loadProject(JSON.parse(await readFile(path,'utf8')));
   const project=api.exportProject();
   const resolvedOutput=resolve(outputPath),job=jobs.start({project,operation:operation==='mesh'?'mesh':'elastic',options:{size,method,adaptive},inputRevision:await getProjectRevision(project),requestId,context:{outputPath:resolvedOutput,includeFields}});outputPaths.set(job.jobId,resolvedOutput);return job;
  },
  listArtifacts(jobId,args={}){
   const job=jobs.get(jobId);if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['offset','limit'].includes(key)))throw Error('Invalid artifact catalog page');
   const {offset=0,limit=50}=args,records=[...(artifacts.get(jobId)?.values()??[])];
   if(!Number.isSafeInteger(offset)||offset<0||offset>records.length||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid artifact catalog page');
   return {schemaVersion:1,jobId,inputRevision:job.inputRevision,jobState:job.state,provisional:true,artifacts:structuredClone(records.slice(offset,offset+limit)),total:records.length,nextOffset:offset+limit<records.length?offset+limit:null};
  },
  async artifact(jobId,artifactId,options={}){
   const {job,record,snapshot}=await readArtifact(jobId,artifactId),meshRecord=record.kind==='mesh'?{record,snapshot}:await readArtifact(jobId,record.meshArtifactId);
   if(!meshRecord.snapshot.mesh||snapshot.field&&(snapshot.meshArtifact?.artifactId!==meshRecord.record.artifactId||snapshot.meshArtifact?.sha256!==meshRecord.record.sha256))throw Error('Intermediate field mesh reference is inconsistent');
   const inspected=inspectIntermediate(snapshot,meshRecord.snapshot.mesh,options);jobs.get(jobId);
   return {schemaVersion:1,jobId,inputRevision:job.inputRevision,jobState:job.state,artifactId,artifact:{...record},...inspected};
  },
  get:jobs.get,events:jobs.events,cancel:jobs.cancel,drain:jobs.drain,
  async meshOutput(jobId){const job=jobs.get(jobId),path=outputPaths.get(jobId);if(!path||job.state!=='succeeded'||job.executionSettled!==true||job.operation!=='mesh')throw Error('A successful, settled retained mesh-only job is required');if((await stat(path)).size>100_000_000)throw Error('Mesh output exceeds 100 MB');const bytes=await readFile(path);if(bytes.length!==job.result?.outputBytes||createHash('sha256').update(bytes).digest('hex')!==job.result?.outputSha256)throw Object.assign(Error('Mesh output integrity check failed'),{code:'ANALYSIS_MESH_PREFLIGHT_OUTPUT_INTEGRITY'});const output=JSON.parse(bytes.toString('utf8'));if(output.job?.jobId!==jobId||output.job?.inputRevision!==job.inputRevision)throw Object.assign(Error('Mesh output identity does not match its retained job'),{code:'ANALYSIS_MESH_PREFLIGHT_OUTPUT_INTEGRITY'});return output;},
  release(jobId){const result=jobs.release(jobId);artifacts.delete(jobId);outputPaths.delete(jobId);return result;},close:jobs.close,async closeAsync(){jobs.close();return jobs.drain();}
 };
if(!store)return Object.freeze(service);
 // Opt-in restart recovery: restored records are metadata only (no result, events or artifacts).
 const restoredView=jobId=>restored.has(jobId)?restoredJobView(restored.get(jobId)):undefined;
 return Object.freeze({...service,
  jobStoreDiagnostics:()=>structuredClone(store.diagnostics),
  get:jobId=>restoredView(jobId)??service.get(jobId),
  events(jobId,{afterSequence=0,limit=50}={}){const view=restoredView(jobId);if(!view)return service.events(jobId,{afterSequence,limit});if(!Number.isSafeInteger(afterSequence)||afterSequence!==0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid job event cursor or limit');return {...view,events:[],truncated:false,nextSequence:0,hasMore:false,eventPageBytes:0};},
  cancel(jobId){const view=restoredView(jobId);return view?{...view,cancelled:false}:service.cancel(jobId);},
  listArtifacts(jobId,args={}){const view=restoredView(jobId);if(!view)return service.listArtifacts(jobId,args);return {schemaVersion:1,jobId,inputRevision:view.inputRevision,jobState:view.state,provisional:true,artifacts:[],total:0,nextOffset:null};},
  async artifact(jobId,artifactId,options){if(restored.has(jobId))throw Error('Intermediate artifacts are not restored after a restart');return service.artifact(jobId,artifactId,options);},
  async meshOutput(jobId){if(restored.has(jobId))throw Error('A successful, settled retained mesh-only job is required');return service.meshOutput(jobId);},
  release(jobId){if(restored.has(jobId)){restored.delete(jobId);store.remove(jobId);return {jobId,released:true};}const result=service.release(jobId);store.remove(jobId);return result;}
 });
}
