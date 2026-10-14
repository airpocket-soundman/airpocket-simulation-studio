import {createHeadlessJobService} from './analysis-job-service.mjs';
import {getProjectRevision,applyProjectOperations} from '../src/project-operations.js';
import {publishJson} from './json-artifacts.mjs';
import {getCapabilities,diagnoseExecution} from '../src/capabilities.js';
// MCP 2025-11-25 stdio transport; stdout contains JSON-RPC messages only.
import {createInterface} from 'node:readline';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {sampleResult} from '../src/probe.js';
import {analyzeProject} from './headless-analysis.mjs';
import {catalogVersion,catalogEntries,catalogEntry} from '../src/material-catalog.js';
const pathSchema={type:'string',minLength:1,description:'Absolute local JSON file path'},object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const jobService=createHeadlessJobService();
const toolList=[
 {name:'studio_edit_project',description:'Atomically apply semantic setup operations to saved JSON and publish a new outputPath. Requires the revision from studio_inspect_project; stale revisions and unsupported methods are rejected. Never alters the input or an open browser. Returns a compact summary, not the full model.',inputSchema:object({path:pathSchema,outputPath:pathSchema,expectedRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},operations:{type:'array',minItems:1,maxItems:100,items:object({method:{enum:['selectTriangles','selectPlanarRegion','selectCylindricalRegion','clearSelection','addCondition','removeCondition','selectCondition','replaceConditionRegion','reapplyConditionRegion','setMaterial','setMaterialProperties','setMaterialPreset','setStudy','setMeshSettings']},args:{type:'array'}},['method','args'])}},['path','outputPath','expectedRevision','operations'])},
 {name:'studio_start_analysis',description:'Start a local CPU analysis job and immediately return its job ID and frozen input revision. Poll studio_job_events for bounded intermediate summaries. requestId makes retries idempotent while the job is retained. Optional includeFields writes provisional mesh/time-field artifacts beside outputPath. Does not change the browser.',inputSchema:object({path:pathSchema,outputPath:pathSchema,requestId:{type:'string',minLength:1,maxLength:200},operation:{enum:['solve','mesh']},size:{type:'number',exclusiveMinimum:0},method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']},adaptive:{type:'boolean'},includeFields:{type:'boolean'}},['path','outputPath','requestId'])},
 {name:'studio_job_status',description:'Get a retained job state, input revision and final artifact summary. Jobs are retained only for this MCP process lifetime.',inputSchema:object({jobId:{type:'string',minLength:1}},['jobId'])},
 {name:'studio_job_events',description:'Read new intermediate events after a sequence cursor (up to 100). Reports truncation if old events were dropped. Events carry job ID, input revision and provisional labels; field artifacts carry hashes. Empty pages are not completion.',inputSchema:object({jobId:{type:'string',minLength:1},afterSequence:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},['jobId'])},
 {name:'studio_cancel_job',description:'Cancel a running CPU Worker and preserve input and prior outputs. Already terminal jobs are unchanged. Final file publication (saving state) cannot be cancelled.',inputSchema:object({jobId:{type:'string',minLength:1}},['jobId'])},
 {name:'studio_release_job',description:'Release terminal job metadata/events and its idempotency key to free the bounded registry. Saved files are retained. A retry with the released request ID may create a new job.',inputSchema:object({jobId:{type:'string',minLength:1}},['jobId'])},
 {name:'studio_capabilities',description:'Read actual target-specific engine capabilities and candidate status without loading solver modules. This is not a complete physical preflight.',inputSchema:object({})},
 {name:'studio_diagnose_execution',description:'Read stable diagnostics for unsupported execution combinations in a saved project. Geometry, units, constraints and material completeness still require full validation.',inputSchema:object({path:pathSchema,method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']},adaptive:{type:'boolean'}},['path'])},
 {name:'studio_material_catalog',description:'Read preinstalled primary-source polymer property data. Filter grades by family, filler and content; experimental formulations are separate. Poisson ratio is unpublished and must be treated as a user assumption, not manufacturer data.',inputSchema:object({id:{type:'string'},family:{type:'string'},filler:{enum:['unfilled','glassFiber','longGlassFiber','glassBead','talc']},contentPercent:{type:'number',minimum:0,maximum:100},search:{type:'string'},includeExperimental:{type:'boolean'}})},
 {name:'studio_progress',description:'Read released and outstanding features, including solver limits.',inputSchema:object({})},
 {name:'studio_inspect_project',description:'Validate a saved project and summarize its geometry, study and conditions.',inputSchema:object({path:pathSchema},['path'])},
 {name:'studio_analyze',description:'Compute a saved project locally with the same CPU Worker as the browser. Writes the full analysis to outputPath and returns a compact summary. Does not alter an open browser project.',inputSchema:object({path:pathSchema,outputPath:pathSchema,operation:{enum:['solve','mesh']},size:{type:'number',exclusiveMinimum:0},method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']}},['path','outputPath'])},
 {name:'studio_probe',description:'Measure a saved analysis at a point in mm. Returns physical units; no extrapolation outside the mesh.',inputSchema:object({path:pathSchema,point:{type:'array',items:{type:'number'},minItems:3,maxItems:3},elementIndex:{type:'integer',minimum:0},modeIndex:{type:'integer',minimum:0}},['path','point'])},
 {name:'studio_validate_cases',description:'Validate saved cases including physical result metadata and return comparison metrics.',inputSchema:object({path:pathSchema},['path'])}
].map(t=>({...t,annotations:{readOnlyHint:!['studio_analyze','studio_start_analysis','studio_cancel_job','studio_release_job','studio_edit_project'].includes(t.name),destructiveHint:false,idempotentHint:!['studio_analyze','studio_release_job','studio_edit_project'].includes(t.name),openWorldHint:false}}));
async function jsonFile(path){if(typeof path!=='string'||!isAbsolute(path))throw Error('An absolute local file path is required');const file=resolve(path);if((await stat(file)).size>100000000)throw Error('JSON file exceeds 100 MB');return JSON.parse(await readFile(file,'utf8'));}
function summary(output){const {mesh,result}=output;return {mesh:mesh.summary,kind:result?.kind,engine:result?.engine,residual:result?.residual,iterations:result?.iterations,maxDisplacementMm:result?.maxDisplacementMm,maxVonMisesPa:result?.maxVonMisesPa,minTemperature:result?.minTemperature,maxTemperature:result?.maxTemperature,maxSpeedMs:result?.maxSpeedMs,reactionDragN:result?.reactionDragN,stokes:result?.stokes,modeFrequenciesHz:result?.modes?.map(m=>m.frequencyHz)};}
export async function callStudioTool(name,args={}){
 const tool=toolList.find(t=>t.name===name);if(!tool)throw Error('Unknown tool: '+name);
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!(key in tool.inputSchema.properties))||tool.inputSchema.required.some(key=>!(key in args)))throw Error('Invalid tool arguments');
 if(name==='studio_edit_project'){
  if(typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||typeof args.path!=='string'||resolve(args.path).toLowerCase()===resolve(args.outputPath).toLowerCase()||!/^sha256:[a-f0-9]{64}$/.test(args.expectedRevision)||!Array.isArray(args.operations)||args.operations.length<1||args.operations.length>100)throw Error('Invalid project edit arguments');
  const result=await applyProjectOperations(await jsonFile(args.path),args.operations,{expectedRevision:args.expectedRevision});const publication=await publishJson(resolve(args.outputPath),result.project);const api=createStudioApi();api.loadProject(result.project);return {schemaVersion:1,previousRevision:result.previousRevision,revision:result.revision,outputPath:resolve(args.outputPath),summary:api.getSummary(),...publication};
 }
 if(name==='studio_start_analysis')return jobService.start(args);
 if(name==='studio_job_status')return jobService.get(args.jobId);
 if(name==='studio_job_events')return jobService.events(args.jobId,{...(args.afterSequence!==undefined?{afterSequence:args.afterSequence}:{}),...(args.limit!==undefined?{limit:args.limit}:{})});
 if(name==='studio_cancel_job')return jobService.cancel(args.jobId);
 if(name==='studio_release_job')return jobService.release(args.jobId);
 if(name==='studio_capabilities')return getCapabilities({target:'node'});
 if(name==='studio_diagnose_execution'){const api=createStudioApi();api.loadProject(await jsonFile(args.path));return diagnoseExecution(api.exportProject(),{...(args.method!==undefined?{method:args.method}:{}),...(args.adaptive!==undefined?{adaptive:args.adaptive}:{})},'node');}
 if(name==='studio_progress')return JSON.parse(await readFile(new URL('../src/progress.json',import.meta.url),'utf8'));
 if(name==='studio_material_catalog'){if(args.id!==undefined)return {version:catalogVersion,material:catalogEntry(args.id)};const materials=catalogEntries(args);return {version:catalogVersion,count:materials.length,materials};}
 if(name==='studio_inspect_project'){const project=await jsonFile(args.path),api=createStudioApi();api.loadProject(project);return {...api.getSummary(),study:api.exportProject().study,revision:await getProjectRevision(project)};}
 if(name==='studio_validate_cases'){const store=createCaseStore();store.import(await jsonFile(args.path));return store.compare();}
 if(name==='studio_probe'){const output=await jsonFile(args.path);const store=createCaseStore();store.add('Probe validation',output);return sampleResult(output.mesh,output.result,args.point,{elementIndex:args.elementIndex,modeIndex:args.modeIndex});}
 if(typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||resolve(args.path)===resolve(args.outputPath))throw Error('Use a distinct absolute analysis outputPath');
 if(args.operation!==undefined&&!['solve','mesh'].includes(args.operation))throw Error('Unknown operation');
 const output=await analyzeProject(await jsonFile(args.path),{...(args.size!==undefined?{size:args.size}:{}),...(args.method!==undefined?{method:args.method}:{})},args.operation==='mesh'?'mesh':'elastic');
 await writeFile(resolve(args.outputPath),JSON.stringify(output)+'\n',{flag:'wx'});return {...summary(output),outputPath:resolve(args.outputPath)};
}
const send=message=>process.stdout.write(JSON.stringify(message)+'\n');
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer();
export function startServer(){
 let initialized=false,ready=false,queue=Promise.resolve();const input=createInterface({input:process.stdin,crlfDelay:Infinity});
 input.on('line',line=>{queue=queue.then(async()=>{
  let message;try{if(line.length>1000000)throw Error();message=JSON.parse(line);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON-RPC message'}});return;}
  const hasId=!!message&&typeof message==='object'&&Object.hasOwn(message,'id');
  if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'){send({jsonrpc:'2.0',id:hasId?message.id:null,error:{code:-32600,message:'Invalid request'}});return;}
  try{
   let result;
   if(message.method==='initialize'){initialized=true;result={protocolVersion:['2025-11-25','2025-06-18','2025-03-26','2024-11-05'].includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'airpocket-simulation-studio',version:'0.43.0'}};}
   else if(message.method==='notifications/initialized'){if(initialized)ready=true;return;}
   else if(message.method==='ping')result={};
   else if(!initialized||!ready)throw Object.assign(Error('Initialize the server first'),{code:-32000});
   else if(message.method==='tools/list')result={tools:toolList};
   else if(message.method==='tools/call'){try{const value=await callStudioTool(message.params?.name,message.params?.arguments);result={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:{value}};}catch(error){result={isError:true,content:[{type:'text',text:error.message}]};}}
   else if(message.method.startsWith('notifications/'))return;
   else throw Object.assign(Error('Method not found'),{code:-32601});
   if(hasId)send({jsonrpc:'2.0',id:message.id,result});
  }catch(error){if(hasId)send({jsonrpc:'2.0',id:message.id,error:{code:error.code||-32603,message:error.message}});}
 }).catch(error=>process.stderr.write(error.message+'\n'));});
 input.on('close',()=>{queue.finally(()=>jobService.close()).catch(error=>process.stderr.write(error.message+'\n'));});
}
