import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrowserBridge} from './browser-bridge.mjs';
import {startMcpStdio} from './mcp-stdio.mjs';
import {browserMethods} from '../src/browser-operation-names.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';

const object=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
export async function createBrowserMcp({origin,...bridgeOptions}={}){
 const bridge=await createBrowserBridge({origin,...bridgeOptions});
 const toolList=[
  {name:'studio_browser_contracts',description:'Discover bounded browser operation contracts. Declarations grant no permission and do not prove adapter availability.',inputSchema:object({method:{enum:Object.keys(browserMethods)},scope:{enum:['inspect','edit','analyze','view']},offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:10}}),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_browser_sessions',description:'List explicitly paired browser sessions and granted scopes.',inputSchema:object({}),annotations:{readOnlyHint:true,openWorldHint:false}},
  {name:'studio_browser_call',description:'Invoke a named operation in a paired browser within granted scopes. Discover its arguments with studio_browser_contracts. A timeout may follow a mutation; inspect before retrying.',inputSchema:object({sessionId:{type:'string',minLength:1},method:{enum:Object.keys(browserMethods)},args:{type:'object'}},['sessionId','method']),annotations:{readOnlyHint:false,openWorldHint:false}}
 ];
 async function callTool(name,args={}){
  const tool=toolList.find(t=>t.name===name);
  if(!tool)throw Error('Unknown tool: '+name);
  if(!args||typeof args!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(args))||Reflect.ownKeys(args).some(key=>typeof key!=='string'||!Object.hasOwn(tool.inputSchema.properties,key)||!Object.hasOwn(Object.getOwnPropertyDescriptor(args,key),'value'))||tool.inputSchema.required.some(key=>!Object.hasOwn(args,key)))throw Error('Invalid tool arguments');
  if(name==='studio_browser_contracts')return getBrowserOperationContracts(args);
  if(name==='studio_browser_sessions')return {sessions:bridge.list()};
  if(typeof args.sessionId!=='string'||!args.sessionId||typeof args.method!=='string'||!Object.hasOwn(browserMethods,args.method)||args.args!==undefined&&(!args.args||typeof args.args!=='object'||Array.isArray(args.args)))throw Error('Invalid browser operation');
  return bridge.call(args.sessionId,args.method,args.args??{},browserMethods[args.method]);
 }
 return {toolList,callTool,bridge,close:()=>bridge.close()};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length!==1||!args[0].startsWith('--browser-origin=')||!args[0].slice(17))throw Error('Use exactly --browser-origin=<exact browser origin>');
 const server=await createBrowserMcp({origin:args[0].slice('--browser-origin='.length)});
 process.stderr.write('Browser connector: '+JSON.stringify({endpoint:server.bridge.endpoint,origin:server.bridge.origin,pairingToken:server.bridge.pairingToken})+'\n');
 startMcpStdio({tools:server.toolList,callTool:server.callTool,close:server.close,name:'airpocket-studio-browser'});
}
