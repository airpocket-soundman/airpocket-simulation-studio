import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeFlowHost} from './native-flow-host.mjs';
import {startMcpStdio} from './mcp-stdio.mjs';

const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const jobId={type:'string',pattern:'^[a-f0-9-]{36}$'};
const error=(code,message)=>Object.assign(Error(message),{code});
export async function createNativeFlowMcp(config){
 const host=await createNativeFlowHost(config);
 const toolList=[
  {name:'studio_native_flow_capabilities',description:'Inspect the approved fixed native SU2 case, input units and limits. Does not run or change physics. Not a browser-WASM engine.',inputSchema:object({}),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_native_flow_connection',description:'Get the temporary loopback endpoint/code for explicitly connecting Studio to this same native host. Keep the code private. Does not connect a browser or grant existing browser-MCP permissions.',inputSchema:object({}),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_native_flow_start',description:'Run the startup-approved mesh/input in a new native SU2 process. Inspect capabilities and confirm the physical case first. Identical retained requestId retries return the same job. No paths or physical edits are accepted.',inputSchema:object({requestId:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,100}$'}},['requestId']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
  {name:'studio_native_flow_status',description:'Get native job state, latest provisional residual observation, settlement and final diagnostics. completed is not physical accuracy or complete numerical convergence.',inputSchema:object({jobId},['jobId']),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_native_flow_result',description:'Read a completed registered native result: compact summary/diagnostics by default, or <=200 entries of one field. Coordinates are metres, pressure Pa gauge and velocity m/s. File hashes describe publication; this reads retained memory, not disk revalidation. Preserve provisional flags and wall warnings.',inputSchema:object({jobId,domain:{enum:['volume','surface']},field:{enum:['pressure','velocity','coordinates','connectivity','offsets','types']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:200}},['jobId']),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_native_flow_cancel',description:'Request cancellation of a native job; poll status until executionSettled before release.',inputSchema:object({jobId},['jobId']),annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
  {name:'studio_native_flow_release',description:'Release a terminal settled native job from memory. Keeps output files; removes retained requestId deduplication, so a released requestId may run again.',inputSchema:object({jobId},['jobId']),annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}}
 ];
 async function request(path,method='GET',body){
  const response=await fetch(host.endpoint+path,{method,headers:{Origin:config.origin,Authorization:`Bearer ${host.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
  const value=await response.json();if(!response.ok)throw error('NATIVE_FLOW_REQUEST_REFUSED',value.error??'Native request refused');return value;
 }
 async function dispatchTool(name,args={}){
  const tool=toolList.find(t=>t.name===name);if(!tool)throw error('NATIVE_FLOW_UNKNOWN_TOOL','Unknown native flow tool');
  if(!args||typeof args!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(args))||Reflect.ownKeys(args).some(k=>typeof k!=='string'||!Object.hasOwn(tool.inputSchema.properties,k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,k),'value'))||tool.inputSchema.required.some(k=>!Object.hasOwn(args,k)))throw error('NATIVE_FLOW_ARGUMENTS','Invalid native arguments');
  if(args.jobId!==undefined&&(typeof args.jobId!=='string'||!/^[a-f0-9-]{36}$/.test(args.jobId)))throw error('NATIVE_FLOW_JOB_ID','Invalid native job ID');
  if(name==='studio_native_flow_connection')return {endpoint:host.endpoint,connectionCode:host.token,origin:config.origin,temporary:true,grantsExistingBrowserScopes:false};
  if(name==='studio_native_flow_capabilities')return request('/capabilities');
  if(name==='studio_native_flow_start'){
   if(typeof args.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(args.requestId))throw error('NATIVE_FLOW_REQUEST_ID','Invalid requestId');
   return request('/jobs','POST',{requestId:args.requestId});
  }
  if(name==='studio_native_flow_status')return request(`/jobs/${args.jobId}`);
  if(name==='studio_native_flow_cancel')return request(`/jobs/${args.jobId}/cancel`,'POST',{});
  if(name==='studio_native_flow_release')return request(`/jobs/${args.jobId}/release`,'POST',{});
  const job=host.jobs.get(args.jobId);if(!job||job.status!=='completed'||!job.settled)throw error('NATIVE_FLOW_RESULT_UNAVAILABLE','Completed settled native result required');
  const common={jobId:args.jobId,inputRevision:job.result.metadata.inputRevision,resultSha256:job.resultSha256,metadata:job.result.metadata,summary:job.result.summary,provisional:true};
  if(args.field===undefined){if(['domain','offset','limit'].some(k=>args[k]!==undefined))throw error('NATIVE_FLOW_FIELD_REQUIRED','Page arguments require a field');return common;}
  const domain=args.domain===undefined?'volume':args.domain;if(!['volume','surface'].includes(domain)||!['pressure','velocity','coordinates','connectivity','offsets','types'].includes(args.field))throw error('NATIVE_FLOW_FIELD','Unsupported native field/domain');
  const offset=args.offset===undefined?0:args.offset,limit=args.limit===undefined?50:args.limit;if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw error('NATIVE_FLOW_PAGE','Invalid native result page');
  const data=job.result[domain],field=args.field,components=['velocity','coordinates'].includes(field)?3:1;
  const values=field==='pressure'?data.fields.Pressure.values:field==='velocity'?data.fields.Velocity.values:field==='coordinates'?data.points:data[field],totalEntries=values.length/components;
  if(offset>totalEntries)throw error('NATIVE_FLOW_PAGE','Offset beyond native field');const end=Math.min(offset+limit,totalEntries),entries=[];for(let i=offset;i<end;i++)entries.push(components===1?values[i]:values.slice(i*components,(i+1)*components));
  const result={...common,domain,field,units:{pressure:'Pa gauge',velocity:'m/s',coordinates:'m',connectivity:'zero-based point index',offsets:'connectivity entry offset',types:'VTK cell type'}[field],components,totalEntries,offset,nextOffset:end<totalEntries?end:null,entries};
  if(Buffer.byteLength(JSON.stringify(result))>65536)throw error('NATIVE_FLOW_RESPONSE_LIMIT','Native response exceeds 64 KiB');return result;
 }
 async function callTool(name,args){const value=await dispatchTool(name,args);if(Buffer.byteLength(JSON.stringify(value))>65536)throw error('NATIVE_FLOW_RESPONSE_LIMIT','Native MCP response exceeds 64 KiB');return value;}
 return {toolList,callTool,close:()=>host.close(),host};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error('Usage: node scripts/studio-native-flow-mcp.mjs approved-case.json');
 const server=await createNativeFlowMcp(JSON.parse(await readFile(resolve(process.argv[2]),'utf8')));
 startMcpStdio({tools:server.toolList,callTool:server.callTool,close:server.close,name:'airpocket-studio-native-flow'});
}
