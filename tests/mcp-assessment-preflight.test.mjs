import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createProjectFromBuiltin} from '../src/project-import.js';

function server(){
 const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let next=0,stderr='';
 child.stderr.on('data',data=>{stderr+=data;});
 const fail=error=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();};
 lines.on('line',line=>{try{const message=JSON.parse(line);assert.equal(message.jsonrpc,'2.0');const item=pending.get(message.id);assert.ok(item,'Unexpected protocol response');pending.delete(message.id);clearTimeout(item.timer);item.resolve(message);}catch(error){fail(error);}});
 child.on('error',fail);child.on('exit',code=>fail(Error(`MCP exited ${code}: ${stderr}`)));
 const request=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(`MCP timeout for ${method}: ${stderr}`));},20000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const raw=(name,args)=>request('tools/call',{name,arguments:args});
 return {request,raw,async call(name,args){const response=await raw(name,args);assert.equal(response.error,undefined);assert.notEqual(response.result.isError,true,JSON.stringify(response.result));const value=response.result.structuredContent.value;assert.deepEqual(JSON.parse(response.result.content[0].text),value);return value;},async close(){if(child.exitCode!==null||child.signalCode!==null){lines.close();return;}const exited=new Promise(resolve=>child.once('exit',resolve));child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);await exited;clearTimeout(timer);lines.close();},notify(){child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');}};
}

const fractureOptions={flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack',stressAssumption:'Uniform nominal stress'};
const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic reference',testConditions:'Uniform tensile stress',surfaceCondition:'Specified crack surface'};
const fatigueOptions={};

function project(){
 const value=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}}),positions=value.meshes[0].positions;
 const face=z=>Array.from({length:positions.length/9},(_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(positions[i*9+k]-z)<1e-8));
 value.study={kind:'structural',gravityEnabled:false};
 value.materialProperties={youngModulus:1e9,poissonRatio:0};
 value.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:face(0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:face(40)}]}];
 return value;
}

test('real MCP preflight accepts declared assessment fields and forwards them without changing saved source bytes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-mcp-assessment-preflight-')),mcp=server();
 try{
  await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();
  const listed=await mcp.request('tools/list',{}),tool=listed.result.tools.find(item=>item.name==='studio_preflight_project');
  assert.ok(tool);assert.deepEqual(tool.inputSchema.properties.fractureAssessment.type,'object');assert.deepEqual(tool.inputSchema.properties.fatigueAssessment.type,'object');
  const path=join(dir,'input.json'),saved=project(),original=JSON.stringify(saved);await writeFile(path,original);

  for(const [name,request,code,diagnosticTarget] of [
   ['fracture',{fractureAssessment:{}},'ASSESSMENT_INPUT_REQUIRED','/materialProperties/fractureData'],
   ['fatigue',{fatigueAssessment:fatigueOptions},'ASSESSMENT_INPUT_REQUIRED','/materialProperties/fatigueData'],
  ]){
   const report=await mcp.call('studio_preflight_project',{path,...request});
   assert.equal(report.allowed,false,name);
   assert.ok(report.diagnostics.some(issue=>issue.code===code&&issue.target===diagnosticTarget),JSON.stringify(report.diagnostics));
   if(name==='fracture')assert.ok(report.diagnostics.some(issue=>issue.code==='ASSESSMENT_INPUT_INVALID'&&issue.target==='/options/fractureAssessment'));
   assert.equal(await readFile(path,'utf8'),original);
  }

  const valid={...saved,materialProperties:{...saved.materialProperties,fractureData}};await writeFile(path,JSON.stringify(valid));const validBytes=await readFile(path,'utf8');
  const accepted=await mcp.call('studio_preflight_project',{path,fractureAssessment:fractureOptions});
  assert.equal(accepted.allowed,true,JSON.stringify(accepted.diagnostics));
  assert.equal(accepted.diagnostics.some(issue=>issue.code.startsWith('ASSESSMENT_')),false);
  assert.equal(await readFile(path,'utf8'),validBytes);

  const unrequested=await mcp.call('studio_preflight_project',{path});
  assert.equal(unrequested.allowed,true,JSON.stringify(unrequested.diagnostics));
  assert.equal(unrequested.diagnostics.some(issue=>issue.code.startsWith('ASSESSMENT_')),false);
  assert.equal(await readFile(path,'utf8'),validBytes);
  const unknown=await mcp.raw('studio_preflight_project',{path,unrecognizedAssessment:true});
  assert.equal(unknown.result.isError,true);
 }finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
