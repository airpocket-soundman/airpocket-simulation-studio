import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readProgressInsights} from '../scripts/studio-mcp.mjs';
import {estimateProductCompletion} from '../src/product-estimate.js';
import {collectProgressHistory} from '../scripts/progress-history.mjs';
import {validateProgressHistory,MAX_HISTORY_BYTES} from '../src/progress-history.js';
const progressUrl=new URL('../src/progress.json',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='';
 child.stderr.on('data',data=>{stderr=(stderr+data).slice(-4000);});
 const fail=error=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(error);}pending.clear();};
 lines.on('line',line=>{try{const message=JSON.parse(line),request=pending.get(message.id);if(!request)return;pending.delete(message.id);clearTimeout(request.timer);request.resolve(message);}catch(error){fail(error);}});child.on('error',fail);child.on('exit',code=>fail(Error('MCP exited '+code+': '+stderr)));
 const request=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP request timed out'));},120000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 return {request,notify:()=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n'),raw:args=>request('tools/call',{name:'studio_progress',arguments:args}),async call(args){const result=(await this.raw(args)).result;assert.notEqual(result.isError,true,JSON.stringify(result));assert.deepEqual(JSON.parse(result.content[0].text),result.structuredContent.value);return result.structuredContent.value;},async close(){const exited=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);await exited;clearTimeout(timer);lines.close();}};
}
async function historyFixture(bytes,{shallow=false}={}){
 const revision='a'.repeat(40),calls=[];
 const history=await collectProgressHistory({git:async args=>{calls.push(args);if(args[0]==='rev-parse')return Buffer.from(args[1]==='--is-shallow-repository'?String(shallow):revision);if(args[0]==='log')return Buffer.from(revision+'\t2026-10-15T00:00:00Z');if(args[0]==='show')return Buffer.from(bytes);throw Error('Unexpected fixed git command');}});
 assert.ok(calls.every(args=>['rev-parse','log','show'].includes(args[0])));return history;
}
test('real stdio progress keeps default/false shape and exposes opt-in estimates and honest bounded history',async()=>{
 const mcp=server();try{
  await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();const tool=(await mcp.request('tools/list',{})).result.tools.find(tool=>tool.name==='studio_progress');assert.deepEqual(Object.keys(tool.inputSchema.properties),['includeEstimate','includeHistory']);assert.equal(tool.inputSchema.properties.includeHistory.type,'boolean');
  const source=await readFile(progressUrl),progress=JSON.parse(source);assert.deepEqual(await mcp.call({}),progress);assert.deepEqual(await mcp.call({includeEstimate:false,includeHistory:false}),progress);
  const estimate=await mcp.call({includeEstimate:true});assert.deepEqual(estimate.progress,progress);assert.deepEqual(estimate.estimate,estimateProductCompletion(progress));assert.equal(estimate.history,undefined);
  for(const args of [{includeHistory:'true'},{includeEstimate:null},{cwd:'elsewhere'},{executable:'git'},{options:{}}])assert.equal((await mcp.raw(args)).result.isError,true);
  const history=await mcp.call({includeHistory:true});assert.ok(Buffer.byteLength(JSON.stringify(history))<=MAX_HISTORY_BYTES);assert.equal(history.estimate,undefined);
  if(history.history.status==='available'){const content=validateProgressHistory(history.history.content);assert.equal(content.head.progressSha256,hash(source));assert.equal(content.head.progressBytes,source.length);assert.equal(history.history.summary.pointCount,content.points.length);assert.deepEqual(history.history.summary.completeness,content.completeness);}
  else assert.ok(['working-progress-does-not-match-history-head','history-not-available','git-unavailable','history-byte-limit','history-response-byte-limit'].includes(history.history.reason));
 }finally{await mcp.close();}
});
test('host-only injected history preserves source bytes, full content and incomplete scope without fabricating history',async()=>{
 const source=await readFile(progressUrl),original=Buffer.from(source),history=await historyFixture(source,{shallow:true});history.completeness.truncated=true;
 const response=await readProgressInsights({includeEstimate:true,includeHistory:true},{readProgress:async()=>source,collectHistory:async()=>history});assert.deepEqual(source,original);assert.equal(response.history.status,'available');assert.deepEqual(response.history.content,validateProgressHistory(history));assert.equal(response.history.summary.completeness.shallow,true);assert.equal(response.history.summary.completeness.truncated,true);assert.deepEqual(response.estimate,estimateProductCompletion(response.progress));
 const mismatched=await readProgressInsights({includeHistory:true},{readProgress:async()=>Buffer.concat([source,Buffer.from('\n')]),collectHistory:async()=>history});assert.deepEqual(mismatched.history,{status:'unavailable',reason:'working-progress-does-not-match-history-head'});assert.equal(mismatched.history.content,undefined);
 const absent=await readProgressInsights({includeHistory:true},{readProgress:async()=>source,collectHistory:async()=>{throw Error('SECRET private path and credential');}});assert.deepEqual(absent.history,{status:'unavailable',reason:'history-not-available'});assert.ok(!JSON.stringify(absent).includes('SECRET'));
 const noGit=await readProgressInsights({includeHistory:true},{readProgress:async()=>source,collectHistory:async()=>{throw Object.assign(Error('private missing executable path'),{code:'ENOENT'});}});assert.deepEqual(noGit.history,{status:'unavailable',reason:'git-unavailable'});
 let read=false;await assert.rejects(readProgressInsights({get includeHistory(){read=true;return true;}}));assert.equal(read,false);
});
test('oversized valid history becomes an explicit unavailable result below the response budget',async()=>{
 const source=await readFile(progressUrl),history=await historyFixture(source),first=history.points[0],ids=Array.from({length:25},(_,index)=>'A'.repeat(95)+String(index));
 history.points=Array.from({length:1000},(_,index)=>index===0?first:{...structuredClone(first),revision:index.toString(16).padStart(40,'0'),addedCount:25,removedCount:25,added:[...ids],removed:[...ids]});history.completeness={...history.completeness,maxPoints:1000,pointCount:1000,commitsListed:1000};validateProgressHistory(history);
 const response=await readProgressInsights({includeHistory:true},{readProgress:async()=>source,collectHistory:async()=>history});assert.deepEqual(response.history,{status:'unavailable',reason:'history-byte-limit'});assert.ok(Buffer.byteLength(JSON.stringify(response))<=MAX_HISTORY_BYTES);
});
