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

export function summarizeAnalysis({mesh,result}){
 return {mesh:mesh.summary,kind:result?.kind,engine:result?.engine,residual:result?.residual,iterations:result?.iterations,maxDisplacementMm:result?.maxDisplacementMm,maxVonMisesPa:result?.maxVonMisesPa,minTemperature:result?.minTemperature,maxTemperature:result?.maxTemperature,maxSpeedMs:result?.maxSpeedMs,reactionDragN:result?.reactionDragN,stokes:result?.stokes,modeFrequenciesHz:result?.modes?.map(m=>m.frequencyHz),analysisAssessment:result?.analysisAssessment};
}
export function createHeadlessJobService({timeoutMs=120000,maxJobs=32,maxEvents=256,maxArtifactBytes=64_000_000,maxPendingObservationEvents=observationQueueDefaults.maxEvents,maxPendingObservationBytes=observationQueueDefaults.maxBytes,isolation='worker',createProcessWorker}={}){
 validateObservationQueueLimits(maxPendingObservationEvents,maxPendingObservationBytes);
 if(!['worker','process'].includes(isolation)||createProcessWorker!==undefined&&typeof createProcessWorker!=='function')throw Error('Invalid analysis isolation configuration');
 if(createProcessWorker!==undefined&&isolation!=='process')throw Error('Process worker factory requires process isolation');
 const destinations=new Map(),artifacts=new Map();
 const jobs=createAnalysisJobs({id:randomUUID,timeoutMs,maxJobs,maxEvents,execute:async({project,options,operation,context,inputRevision,jobId,signal,onEvent,beginCommit})=>{
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
   const publication=await publishJson(outputPath,{...output,job});
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
 return Object.freeze({
  async start({path,outputPath,requestId,operation='solve',size=5,method='wasm-pcg',adaptive=false,includeFields=false}={}){
   const pathKey=value=>process.platform==='win32'?resolve(value).toLowerCase():resolve(value);
   if(typeof path!=='string'||!isAbsolute(path)||typeof outputPath!=='string'||!isAbsolute(outputPath)||pathKey(path)===pathKey(outputPath))throw Error('Use distinct absolute input and output paths');
   if(typeof requestId!=='string'||!requestId||requestId.length>200||!['solve','mesh'].includes(operation)||!Number.isFinite(size)||size<=0||!['wasm-pcg','pcg','pcg-strict','mfem-wasm'].includes(method)||typeof adaptive!=='boolean'||typeof includeFields!=='boolean')throw Error('Invalid analysis job arguments');
   if((await stat(path)).size>100_000_000)throw Error('JSON file exceeds 100 MB');
   const api=createStudioApi();api.loadProject(JSON.parse(await readFile(path,'utf8')));
   const project=api.exportProject();
   return jobs.start({project,operation:operation==='mesh'?'mesh':'elastic',options:{size,method,adaptive},inputRevision:await getProjectRevision(project),requestId,context:{outputPath:resolve(outputPath),includeFields}});
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
  release(jobId){const result=jobs.release(jobId);artifacts.delete(jobId);return result;},close:jobs.close,async closeAsync(){jobs.close();return jobs.drain();}
 });
}
