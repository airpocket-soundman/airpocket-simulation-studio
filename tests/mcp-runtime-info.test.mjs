import {getCapabilities,diagnoseExecution} from '../src/capabilities.js';
import {preflightProject} from '../src/analysis-preflight.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BoxGeometry} from 'three';

function project(){
 const g=new BoxGeometry(10,10,40).toNonIndexed();g.translate(5,5,20);const positions=Array.from(g.attributes.position.array);g.dispose();
 const face=z=>Array.from({length:12},(_,i)=>i).filter(i=>[2,5,8].every(k=>positions[9*i+k]===z));
 return {version:1,meshes:[{positions,faceIds:Array.from({length:12},(_,i)=>Math.floor(i/2))}],sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:0},conditions:[{type:'fixed',value:0,direction:[0,0,1],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}]};
}
function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='';
 child.stderr.on('data',data=>{stderr+=data;});
 const fail=error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};
 lines.on('line',line=>{try{const message=JSON.parse(line);assert.equal(message.jsonrpc,'2.0');const item=pending.get(message.id);assert.ok(item,'Unexpected protocol response');pending.delete(message.id);clearTimeout(item.timer);item.resolve(message);}catch(error){fail(error);}});
 child.on('error',fail);child.on('exit',code=>fail(Error(`MCP exited ${code}: ${stderr}`)));
 const request=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(`MCP timeout for ${method}: ${stderr}`));},20000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const raw=(name,args)=>request('tools/call',{name,arguments:args});
 return {request,raw,async call(name,args){const response=await raw(name,args);assert.equal(response.error,undefined);assert.notEqual(response.result.isError,true,JSON.stringify(response.result));const value=response.result.structuredContent.value;assert.deepEqual(JSON.parse(response.result.content[0].text),value);return value;},async close(){if(child.exitCode!==null||child.signalCode!==null){lines.close();return;}const exited=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);await exited;clearTimeout(timer);lines.close();},notify(){child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');}};
}
test('real MCP read-only capability, diagnostic and preflight reports expose actual Node identity without changing static reports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-runtime-info-')),mcp=server();
 try{
  await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();const path=join(dir,'input.json'),input=project(),original=JSON.stringify(input);await writeFile(path,original);
  const capabilities=await mcp.call('studio_capabilities',{}),diagnostic=await mcp.call('studio_diagnose_execution',{path,method:'wasm-pcg',includeFields:true}),preflight=await mcp.call('studio_preflight_project',{path,method:'wasm-pcg',includeFields:true});
  const runtime=capabilities.runtime;assert.deepEqual(diagnostic.runtime,runtime);assert.deepEqual(preflight.runtime,runtime);assert.equal(runtime.node,process.version);assert.equal(runtime.v8,process.versions.v8);assert.equal(runtime.platform,process.platform);assert.equal(runtime.arch,process.arch);assert.equal(runtime.compatibilityVerified,false);assert.equal(runtime.rootFixProven,false);assert.equal(runtime.kind,'node');assert.ok(['observed-risk','not-assessed'].includes(runtime.knownIssueAssessment));assert.deepEqual(Object.keys(runtime).sort(),['schemaVersion','kind','node','v8','platform','arch','knownIssueAssessment','diagnostics','compatibilityVerified','rootFixProven'].sort());for(const forbidden of ['env','pid','execPath','cwd','hostname','username'])assert.equal(runtime[forbidden],undefined);
  const {runtime:capRuntime,...staticCapabilities}=capabilities,{runtime:diagRuntime,...staticDiagnostic}=diagnostic,{runtime:preflightRuntime,...staticPreflight}=preflight;assert.deepEqual(staticCapabilities,getCapabilities({target:'node'}));assert.deepEqual(staticDiagnostic,diagnoseExecution(input,{method:'wasm-pcg',includeFields:true},'node'));assert.deepEqual(staticPreflight,preflightProject(input,{method:'wasm-pcg',includeFields:true},{target:'node'}));
  for(const [tool,args]of [['studio_capabilities',{unknown:true}],['studio_diagnose_execution',{path:'relative.json'}],['studio_preflight_project',{path:'relative.json'}],['studio_diagnose_execution',{path,includeFields:'yes'}],['studio_preflight_project',{path,unknown:true}]])assert.equal((await mcp.raw(tool,args)).result.isError,true);
  const invalid=await mcp.call('studio_preflight_project',{path,includeFields:'yes'});assert.equal(invalid.allowed,false);assert.equal(invalid.selectedObservation.supported,false);assert.deepEqual(invalid.runtime,runtime);assert.equal(await readFile(path,'utf8'),original);
  const actualObserved=process.platform==='win32'&&process.arch==='x64'&&process.version==='v24.11.1'&&process.versions.v8==='13.6.233.10-node.28';assert.equal(runtime.knownIssueAssessment,actualObserved?'observed-risk':'not-assessed');if(actualObserved){assert.equal(runtime.diagnostics.length,1);assert.equal(runtime.diagnostics[0].code,'NODE_WASM_ALLOCATION_FATAL_OBSERVED');}else assert.deepEqual(runtime.diagnostics,[]);
 }finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
