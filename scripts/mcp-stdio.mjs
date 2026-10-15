import {createInterface} from 'node:readline';
import {getAnalysisFailure} from '../src/analysis-failure.js';
export function startMcpStdio({tools,callTool,close=async()=>{},name='airpocket-simulation-studio',version='0.44.0',stdin=process.stdin,stdout=process.stdout,stderr=process.stderr}){
 const send=message=>stdout.write(JSON.stringify(message)+'\n');
 let initialized=false,ready=false,queue=Promise.resolve();const input=createInterface({input:stdin,crlfDelay:Infinity});
 input.on('line',line=>{queue=queue.then(async()=>{
  let message;try{if(line.length>1000000)throw Error();message=JSON.parse(line);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON-RPC message'}});return;}
  const hasId=!!message&&typeof message==='object'&&Object.hasOwn(message,'id');
  if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string'){send({jsonrpc:'2.0',id:hasId?message.id:null,error:{code:-32600,message:'Invalid request'}});return;}
  try{
   let result;
   if(message.method==='initialize'){initialized=true;result={protocolVersion:['2025-11-25','2025-06-18','2025-03-26','2024-11-05'].includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name,version}};}
   else if(message.method==='notifications/initialized'){if(initialized)ready=true;return;}
   else if(message.method==='ping')result={};
   else if(!initialized||!ready)throw Object.assign(Error('Initialize the server first'),{code:-32000});
   else if(message.method==='tools/list')result={tools};
   else if(message.method==='tools/call'){try{const value=await callTool(message.params?.name,message.params?.arguments);result={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:{value}};}catch(error){const failure=getAnalysisFailure(error),code=error.code??failure?.code;result={isError:true,content:[{type:'text',text:error.message}],...(code?{structuredContent:{error:{code,message:error.message,...(typeof error.delivered==='boolean'?{delivered:error.delivered}:{}),...(error.diagnostics?{diagnostics:error.diagnostics}:{}),...(failure?{failure}:{})}}}:{})};}}
   else if(message.method.startsWith('notifications/'))return;
   else throw Object.assign(Error('Method not found'),{code:-32601});
   if(hasId)send({jsonrpc:'2.0',id:message.id,result});
  }catch(error){if(hasId)send({jsonrpc:'2.0',id:message.id,error:{code:error.code||-32603,message:error.message}});}
 }).catch(error=>stderr.write(error.message+'\n'));});
 input.on('close',()=>{queue.finally(async()=>{await close();}).catch(error=>stderr.write(error.message+'\n'));});
}
