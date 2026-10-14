import {createPrintOperations} from '../src/print-operations.js';
import {parsePrint3mf} from '../src/print-3mf.js';
import {parsePrintGcode} from '../src/print-gcode.js';
import {DOMParser as NodeDOMParser} from '@xmldom/xmldom';
import {createCadUpdateOperations} from '../src/cad-update-operations.js';
import {inspectProjectGeometry} from '../src/geometry-inspection.js';
import {createBrowserBridge} from './browser-bridge.mjs';
import {browserMethods} from '../src/browser-session.js';
import {importProjectFile,createProjectFromBuiltin} from './import-project.mjs';
import {preflightProject} from '../src/analysis-preflight.js';
import {createHeadlessJobService,summarizeAnalysis} from './analysis-job-service.mjs';
import {getProjectRevision,applyProjectOperations} from '../src/project-operations.js';
import {publishJson} from './json-artifacts.mjs';
import {createResultAssessmentApi} from '../src/result-assessment-api.js';
import {getCapabilities,diagnoseExecution} from '../src/capabilities.js';
// MCP 2025-11-25 stdio transport; stdout contains JSON-RPC messages only.
import {createInterface} from 'node:readline';
import {readFile,writeFile,stat,realpath,lstat} from 'node:fs/promises';
import {resolve,isAbsolute,extname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStudioApi} from '../src/studio-api.js';
import {createCaseStore} from '../src/cases.js';
import {sampleResult} from '../src/probe.js';
import {analyzeProject} from './headless-analysis.mjs';
import {catalogVersion,catalogEntries,catalogEntry} from '../src/material-catalog.js';
const pathSchema={type:'string',minLength:1,description:'Absolute local JSON file path'},object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const jobService=createHeadlessJobService();
let browserBridge;
const toolList=[
 {name:'studio_import_print',description:'Read a local 3MF or linear G-code file up to 50,000,000 bytes and exclusively publish a distinct new parsed print JSON. Interprets geometry and possible deposition paths without sending commands to hardware or inferring strength. Returns compact revisioned metadata, not geometry arrays.',inputSchema:object({path:pathSchema,outputPath:pathSchema},['path','outputPath'])},
 {name:'studio_inspect_print',description:'Validate a saved parsed print JSON and return compact metadata or a bounded segments/triangles page (maximum 200). Coordinates use mm; layerIndex is a zero-based layer filter. Optional exact revision prevents stale reads.',inputSchema:object({path:pathSchema,expectedRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},viewId:{type:'string'},kind:{enum:['segments','triangles']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:200},layerIndex:{type:'integer',minimum:0}},['path'])},
 {name:'studio_preview_cad_update',description:'Preview STEP CAD replacement without modifying files. Requires the current project revision. Replacement is an absolute STEP/STP (OCCT normalizes to mm) or saved STEP project JSON. Returns replacement revision and bounded condition reports (maximum 50), never full geometry.',inputSchema:object({path:pathSchema,replacementPath:pathSchema,expectedRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:50}},['path','replacementPath','expectedRevision'])},
 {name:'studio_apply_cad_update',description:'Apply a reviewed STEP CAD replacement using exact input and replacement revisions, preserving physical setup and requiring confirmation of old provenance. Unmatched conditions remain pending and block analysis. Exclusively publishes a distinct new JSON; never overwrites input, replacement or an existing output.',inputSchema:object({path:pathSchema,replacementPath:pathSchema,outputPath:pathSchema,expectedRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},expectedReplacementRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'}},['path','replacementPath','outputPath','expectedRevision','expectedReplacementRevision'])},
 {name:'studio_assess_result',description:'Evaluate fatigue or Mode-I fracture screening from a saved structural elastic analysis using its recorded material evidence and explicit options. Requires the exact result revision; publishes a distinct new analysis JSON without overwriting files. Does not infer missing material data or claim failure probability.',inputSchema:object({path:pathSchema,outputPath:pathSchema,expectedResultRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},kind:{enum:['fatigue','fracture']},options:{type:'object'}},['path','outputPath','expectedResultRevision','kind','options'])},
 {name:'studio_assessment',description:'Read validated fatigue/fracture screening metadata (or available:false with its result revision before evaluation) and a bounded element page (default 50, maximum 200) from a saved analysis. Optional exact result revision prevents reading a different version. Does not write files.',inputSchema:object({path:pathSchema,kind:{enum:['fatigue','fracture']},expectedResultRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:0,maximum:200}},['path','kind'])},
 {name:'studio_import_project',description:'Import STEP/STP with real OCCT unit normalization to mm, or outward closed convex STL with explicit scaleToMm, and publish a new project JSON. Preserves source bytes and CAD face mappings. Never replaces source or an existing output.',inputSchema:object({path:pathSchema,outputPath:pathSchema,scaleToMm:{type:'number',exclusiveMinimum:0},name:{type:'string',minLength:1}},['path','outputPath'])},
 {name:'studio_create_builtin_project',description:'Create a new project with an explicit built-in source: box(bounds), boxes(boxes), fixed cylinder(kind only), sphere(center/radius), tube(center/axis/innerRadius/outerRadius/length), using mm. No material values or boundary conditions are invented.',inputSchema:object({source:{type:'object'},outputPath:pathSchema,name:{type:'string',minLength:1}},['source','outputPath'])},
 {name:'studio_preflight_project',description:'Inspect physical input, unit, execution and provenance diagnostics without running solvers. Strict quantitative/exploratory provenance currently covers static isotropic linear structure. Returns required input pointers and remaining mesh/constraint/accuracy checks; allowed is not a physical accuracy guarantee.',inputSchema:object({path:pathSchema,method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']},operation:{enum:['solve','mesh']},mode:{enum:['legacy','quantitative','exploratory']}},['path'])},
 {name:'studio_job_artifact',description:'Read a registered provisional mesh/time-field artifact by jobId and artifactId. Verifies hashes and input/mesh identity; returns compact statistics, optional point interpolation or a bounded node/value page (limit <= 200, default summary only). Does not accept arbitrary file paths or treat intermediate values as final.',inputSchema:object({jobId:{type:'string',minLength:1},artifactId:{type:'string',minLength:1},point:{type:'array',items:{type:'number'},minItems:3,maxItems:3},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:0,maximum:200}},['jobId','artifactId'])},
 {name:'studio_edit_project',description:'Atomically apply semantic setup operations to saved JSON and publish a new outputPath. Requires the revision from studio_inspect_project; stale revisions and unsupported methods are rejected. Never alters the input or an open browser. Returns a compact summary, not the full model.',inputSchema:object({path:pathSchema,outputPath:pathSchema,expectedRevision:{type:'string',pattern:'^sha256:[a-f0-9]{64}$'},operations:{type:'array',minItems:1,maxItems:100,items:object({method:{enum:['selectTriangles','selectCadFace','selectPlanarRegion','selectCylindricalRegion','clearSelection','addCondition','removeCondition','selectCondition','replaceConditionRegion','reapplyConditionRegion','setMaterial','setMaterialProperties','setMaterialPreset','applyCatalogMaterial','setStudy','setMeshSettings','setInputProvenance','setAnalysisIntent']},args:{type:'array'}},['method','args'])}},['path','outputPath','expectedRevision','operations'])},
 {name:'studio_start_analysis',description:'Start a local CPU analysis job and immediately return its job ID and frozen input revision. Poll studio_job_events for bounded intermediate summaries. requestId makes retries idempotent while the job is retained. Optional includeFields writes provisional mesh/time-field artifacts beside outputPath. Does not change the browser.',inputSchema:object({path:pathSchema,outputPath:pathSchema,requestId:{type:'string',minLength:1,maxLength:200},operation:{enum:['solve','mesh']},size:{type:'number',exclusiveMinimum:0},method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']},adaptive:{type:'boolean'},includeFields:{type:'boolean'}},['path','outputPath','requestId'])},
 {name:'studio_job_status',description:'Get a retained job state, input revision and final artifact summary. Jobs are retained only for this MCP process lifetime.',inputSchema:object({jobId:{type:'string',minLength:1}},['jobId'])},
 {name:'studio_job_events',description:'Read new intermediate events after a sequence cursor (up to 100). Reports truncation if old events were dropped. Events carry job ID, input revision and provisional labels; field artifacts carry hashes. Empty pages are not completion.',inputSchema:object({jobId:{type:'string',minLength:1},afterSequence:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}},['jobId'])},
 {name:'studio_cancel_job',description:'Cancel a running CPU Worker and preserve input and prior outputs. Already terminal jobs are unchanged. Final file publication (saving state) cannot be cancelled.',inputSchema:object({jobId:{type:'string',minLength:1}},['jobId'])},
 {name:'studio_release_job',description:'Release terminal job metadata/events and its idempotency key to free the bounded registry. Saved files are retained. A retry with the released request ID may create a new job.',inputSchema:object({jobId:{type:'string',minLength:1}},['jobId'])},
 {name:'studio_capabilities',description:'Read actual target-specific engine capabilities and candidate status without loading solver modules. This is not a complete physical preflight.',inputSchema:object({})},
 {name:'studio_diagnose_execution',description:'Read stable diagnostics for unsupported execution combinations in a saved project. Geometry, units, constraints and material completeness still require full validation.',inputSchema:object({path:pathSchema,method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']},adaptive:{type:'boolean'}},['path'])},
 {name:'studio_material_catalog',description:'Read preinstalled primary-source polymer property data. Filter grades by family, filler and content; experimental formulations are separate. Poisson ratio is unpublished and must be treated as a user assumption, not manufacturer data.',inputSchema:object({id:{type:'string'},family:{type:'string'},filler:{enum:['unfilled','glassFiber','longGlassFiber','glassBead','talc']},contentPercent:{type:'number',minimum:0,maximum:100},search:{type:'string'},includeExperimental:{type:'boolean'}})},
 {name:'studio_progress',description:'Read released and outstanding features, including solver limits.',inputSchema:object({})},
 {name:'studio_inspect_project',description:'Validate saved input and return a compact mm geometry summary, study, conditions and revision. Optional meshIndex returns paginated observed face geometry (at most 50); face IDs belong to a display-mesh revision, not persistent CAD identities.',inputSchema:object({path:pathSchema,meshIndex:{type:'integer',minimum:0},faceOffset:{type:'integer',minimum:0},faceLimit:{type:'integer',minimum:1,maximum:50}},['path'])},
 {name:'studio_analyze',description:'Compute a saved project locally with the same CPU Worker as the browser. Writes the full analysis to outputPath and returns a compact summary. Does not alter an open browser project.',inputSchema:object({path:pathSchema,outputPath:pathSchema,operation:{enum:['solve','mesh']},size:{type:'number',exclusiveMinimum:0},method:{enum:['wasm-pcg','pcg','pcg-strict','mfem-wasm']}},['path','outputPath'])},
 {name:'studio_probe',description:'Measure a saved analysis at a point in mm. Returns physical units; no extrapolation outside the mesh.',inputSchema:object({path:pathSchema,point:{type:'array',items:{type:'number'},minItems:3,maxItems:3},elementIndex:{type:'integer',minimum:0},modeIndex:{type:'integer',minimum:0}},['path','point'])},
 {name:'studio_validate_cases',description:'Validate saved cases including physical result metadata and return comparison metrics.',inputSchema:object({path:pathSchema},['path'])}
].map(t=>({...t,annotations:{readOnlyHint:!['studio_import_print','studio_apply_cad_update','studio_assess_result','studio_analyze','studio_start_analysis','studio_cancel_job','studio_release_job','studio_edit_project','studio_import_project','studio_create_builtin_project'].includes(t.name),destructiveHint:false,idempotentHint:!['studio_import_print','studio_apply_cad_update','studio_assess_result','studio_analyze','studio_release_job','studio_edit_project','studio_import_project','studio_create_builtin_project'].includes(t.name),openWorldHint:false}}));
async function jsonFile(path){if(typeof path!=='string'||!isAbsolute(path))throw Error('An absolute local file path is required');const file=resolve(path);if((await stat(file)).size>100000000)throw Error('JSON file exceeds 100 MB');return JSON.parse(await readFile(file,'utf8'));}
const summary=summarizeAnalysis;
export async function callStudioTool(name,args={}){
 const tool=toolList.find(t=>t.name===name);if(!tool)throw Error('Unknown tool: '+name);
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!(key in tool.inputSchema.properties))||tool.inputSchema.required.some(key=>!(key in args)))throw Error('Invalid tool arguments');
 if(name==='studio_import_print'){
  if(typeof args.path!=='string'||!isAbsolute(args.path)||typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||resolve(args.path).toLowerCase()===resolve(args.outputPath).toLowerCase())throw Error('Use distinct absolute print input and output paths');
  const input=resolve(args.path),info=await stat(input),extension=extname(input).toLowerCase();
  if(!info.isFile()||info.size>50000000)throw Error('Print input must be a file up to 50,000,000 bytes');
  if(!['.3mf','.gcode'].includes(extension))throw Error('Print import requires .3mf or .gcode');
  try{await lstat(resolve(args.outputPath));throw Error('Print output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  const bytes=await readFile(input);if(bytes.length>50000000)throw Error('Print input exceeds 50,000,000 bytes');
  const data=extension==='.3mf'?parsePrint3mf(bytes,{parseXml:text=>new NodeDOMParser({onError:(_level,message)=>{throw Error(message);}}).parseFromString(text,'application/xml')}):parsePrintGcode(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const snapshot={version:1,filename:basename(input),data},api=createPrintOperations({getSnapshot:()=>snapshot,getView:()=>({viewId:snapshot.data.geometries?.length?'geometry':'plate:0',allLayers:true,layerIndex:0}),isBusy:()=>false});
  const inspection=await api.inspect(),publication=await publishJson(resolve(args.outputPath),snapshot);return {...inspection,outputPath:resolve(args.outputPath),...publication};
 }
 if(name==='studio_inspect_print'){
  const snapshot=await jsonFile(args.path),api=createPrintOperations({getSnapshot:()=>snapshot,getView:()=>({viewId:snapshot.data.geometries?.length?'geometry':'plate:0',allLayers:true,layerIndex:0}),isBusy:()=>false}),command=Object.fromEntries(Object.entries(args).filter(([key])=>key!=='path'));
  const inspection=await api.inspect();if(args.expectedRevision!==undefined&&args.expectedRevision!==inspection.revision)throw Error('Print revision conflict');
  if(args.kind===undefined){if(['viewId','offset','limit','layerIndex'].some(key=>args[key]!==undefined))throw Error('Print page arguments require kind');return inspection;}
  return api.get({...command,expectedRevision:inspection.revision});
 }
 if(name==='studio_browser_sessions')return {sessions:browserBridge.list()};
 if(name==='studio_browser_call'){if(!Object.hasOwn(browserMethods,args.method)||typeof args.sessionId!=='string')throw Error('Invalid browser operation');return browserBridge.call(args.sessionId,args.method,args.args||{},browserMethods[args.method]);}
 if(name==='studio_preview_cad_update'||name==='studio_apply_cad_update'){
  for(const key of ['path','replacementPath',...(name==='studio_apply_cad_update'?['outputPath']:[])])if(typeof args[key]!=='string'||!isAbsolute(args[key]))throw Error('Use distinct absolute CAD update paths');
  const inputPath=resolve(args.path),replacementPath=resolve(args.replacementPath),inputStat=await stat(inputPath),replacementStat=await stat(replacementPath);
  if((await realpath(inputPath)).toLowerCase()===(await realpath(replacementPath)).toLowerCase()||(inputStat.ino===replacementStat.ino&&inputStat.dev===replacementStat.dev))throw Error('CAD input and replacement paths must be distinct, including aliases');
  if(name==='studio_apply_cad_update'){
   if([inputPath,replacementPath].some(path=>path.toLowerCase()===resolve(args.outputPath).toLowerCase()))throw Error('CAD output must be distinct from input and replacement');
   try{await lstat(resolve(args.outputPath));throw Error('CAD output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const extension=extname(replacementPath).toLowerCase();
  if(!['.step','.stp','.json'].includes(extension))throw Error('CAD replacement requires STEP/STP or a saved STEP project JSON');
  const replacement=extension==='.json'?await jsonFile(replacementPath):await importProjectFile(replacementPath);
  if(replacement.sourceModel?.kind!=='step')throw Error('CAD replacement requires a STEP project');
  // Inspect revisions describe the saved JSON exactly. Validation must not add
  // optional defaults (such as selection) before checking that input revision.
  let current=await jsonFile(inputPath);const validatorStudio=createStudioApi();validatorStudio.loadProject(current);
  const studio={exportProject:()=>structuredClone(current),loadProject(next){validatorStudio.loadProject(next);current=validatorStudio.exportProject();}};
  const operations=createCadUpdateOperations({studio,isBusy:()=>false});
  const command={expectedRevision:args.expectedRevision,replacement};
  if(name==='studio_preview_cad_update')return operations.preview({...command,...(args.offset!==undefined?{offset:args.offset}:{}),...(args.limit!==undefined?{limit:args.limit}:{})});
  const response=await operations.apply({...command,expectedReplacementRevision:args.expectedReplacementRevision});
  const publication=await publishJson(resolve(args.outputPath),studio.exportProject());return {...response,outputPath:resolve(args.outputPath),...publication};
 }
 if(name==='studio_assess_result'||name==='studio_assessment'){
  if(name==='studio_assess_result'&&!Object.hasOwn(args,'options'))throw Error('Explicit assessment options are required');
  if(name==='studio_assess_result'&&(typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||typeof args.path!=='string'||resolve(args.path).toLowerCase()===resolve(args.outputPath).toLowerCase()))throw Error('Use distinct absolute assessment input and output paths');
  let output=await jsonFile(args.path);const store=createCaseStore();store.add('Assessment validation',output);
  const api=createResultAssessmentApi({getAnalysis:()=>output,commit:next=>{output=next;}});
  const command=Object.fromEntries(Object.entries(args).filter(([key])=>!['path','outputPath'].includes(key)));
  if(name==='studio_assessment')return api.get(command);
  const response=await api.evaluate(command),publication=await publishJson(resolve(args.outputPath),output);
  return {...response,outputPath:resolve(args.outputPath),...publication};
 }
 if(['studio_import_project','studio_create_builtin_project'].includes(name)){
  if(typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||args.name!==undefined&&(typeof args.name!=='string'||!args.name.trim()))throw Error('Invalid project import destination or name');
  if(name==='studio_import_project'&&(typeof args.path!=='string'||!isAbsolute(args.path)||resolve(args.path).toLowerCase()===resolve(args.outputPath).toLowerCase()))throw Error('Use distinct absolute input and output paths');
  const project=name==='studio_import_project'?await importProjectFile(args.path,{...(args.scaleToMm!==undefined?{scaleToMm:args.scaleToMm}:{}),...(args.name!==undefined?{name:args.name}:{})}):createProjectFromBuiltin({source:args.source,...(args.name!==undefined?{name:args.name}:{})});
  const publication=await publishJson(resolve(args.outputPath),project),api=createStudioApi();api.loadProject(project);return {schemaVersion:1,outputPath:resolve(args.outputPath),revision:await getProjectRevision(project),summary:api.getSummary(),units:{geometry:'mm'},...publication};
 }
 if(name==='studio_preflight_project')return preflightProject(await jsonFile(args.path),{...(args.method!==undefined?{method:args.method}:{})},{target:'node',...(args.operation!==undefined?{operation:args.operation}:{}),...(args.mode!==undefined?{mode:args.mode}:{})});
 if(name==='studio_job_artifact')return jobService.artifact(args.jobId,args.artifactId,{...(args.point!==undefined?{point:args.point}:{}),...(args.offset!==undefined?{offset:args.offset}:{}),...(args.limit!==undefined?{limit:args.limit}:{})});
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
 if(name==='studio_inspect_project'){const project=await jsonFile(args.path),api=createStudioApi();api.loadProject(project);return {...api.getSummary(),study:api.exportProject().study,revision:await getProjectRevision(project),geometry:await inspectProjectGeometry(project,{...(args.meshIndex!==undefined?{meshIndex:args.meshIndex}:{}),...(args.faceOffset!==undefined?{faceOffset:args.faceOffset}:{}),...(args.faceLimit!==undefined?{faceLimit:args.faceLimit}:{})})};}
 if(name==='studio_validate_cases'){const store=createCaseStore();store.import(await jsonFile(args.path));return store.compare();}
 if(name==='studio_probe'){const output=await jsonFile(args.path);const store=createCaseStore();store.add('Probe validation',output);return sampleResult(output.mesh,output.result,args.point,{elementIndex:args.elementIndex,modeIndex:args.modeIndex});}
 if(typeof args.outputPath!=='string'||!isAbsolute(args.outputPath)||resolve(args.path)===resolve(args.outputPath))throw Error('Use a distinct absolute analysis outputPath');
 if(args.operation!==undefined&&!['solve','mesh'].includes(args.operation))throw Error('Unknown operation');
 const output=await analyzeProject(await jsonFile(args.path),{...(args.size!==undefined?{size:args.size}:{}),...(args.method!==undefined?{method:args.method}:{})},args.operation==='mesh'?'mesh':'elastic');
 await writeFile(resolve(args.outputPath),JSON.stringify(output)+'\n',{flag:'wx'});return {...summary(output),outputPath:resolve(args.outputPath)};
}
const send=message=>process.stdout.write(JSON.stringify(message)+'\n');
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const originArg=process.argv.slice(2).find(arg=>arg.startsWith('--browser-origin='));
 if(originArg){browserBridge=await createBrowserBridge({origin:originArg.slice('--browser-origin='.length)});toolList.push(
  {name:'studio_browser_sessions',description:'List browser sessions explicitly paired with this temporary loopback connector, including granted scopes. No filesystem or shell is exposed through the browser transport.',inputSchema:object({}),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_browser_call',description:'Invoke a named semantic operation in a paired browser. inspect returns its current input revision; edit requires expectedRevision. startJob requires inputRevision and requestId; includeFields:true retains bounded browser-memory fields readable through jobArtifact. Poll jobStatus/jobEvents, then showJob only if its frozen input still matches. Visual exports use startExport/exportStatus/exportArtifact/cancelExport/releaseExport with bounded base64 pages; exportCapabilities reports format support. Named views use namedViewList/Save/Apply/Remove/Export/Import and require exact result revisions on restoration. Case archives use caseArchiveExport/Read/Import/Write/Commit/Release with bounded base64 pages, full hashes and archive revision checks. Respect user-granted scopes; commands time out, so inspect state before retrying mutations. Browser closure/disconnect cancels connection-owned jobs.',inputSchema:object({sessionId:{type:'string'},method:{enum:Object.keys(browserMethods)},args:{type:'object'}},['sessionId','method']),annotations:{readOnlyHint:false,openWorldHint:false}}
 );process.stderr.write('Browser connector: '+JSON.stringify({endpoint:browserBridge.endpoint,origin:browserBridge.origin,pairingToken:browserBridge.pairingToken})+'\n');}
 startServer();
}
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
   else if(message.method==='tools/call'){try{const value=await callStudioTool(message.params?.name,message.params?.arguments);result={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:{value}};}catch(error){result={isError:true,content:[{type:'text',text:error.message}],...(error.code?{structuredContent:{error:{code:error.code,message:error.message,...(error.diagnostics?{diagnostics:error.diagnostics}:{})}}}:{})};}}
   else if(message.method.startsWith('notifications/'))return;
   else throw Object.assign(Error('Method not found'),{code:-32601});
   if(hasId)send({jsonrpc:'2.0',id:message.id,result});
  }catch(error){if(hasId)send({jsonrpc:'2.0',id:message.id,error:{code:error.code||-32603,message:error.message}});}
 }).catch(error=>process.stderr.write(error.message+'\n'));});
 input.on('close',()=>{queue.finally(async()=>{jobService.close();await browserBridge?.close();}).catch(error=>process.stderr.write(error.message+'\n'));});
}
