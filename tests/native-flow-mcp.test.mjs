import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';
import {createNativeFlowMcp} from '../scripts/studio-native-flow-mcp.mjs';
const input={schemaVersion:1,kind:'steady-incompressible-rans-sa',meshUnits:'m',densityKgM3:1.204,dynamicViscosityPaS:.0000181,velocityMps:[-5,0,0],wallMarker:'cow',farfieldMarker:'farfield',maxIterations:100,residualLog10Target:-5,turbulenceModel:'SA',wallTreatment:'standard-wall-function',freestreamNuFactor:10};
const config=root=>({origin:'http://127.0.0.1:5191',approvedInput:input,outputRoot:root,executable:join(root,'not-executed.exe'),meshPath:join(root,'not-read.su2')});
test('native MCP pages preserve units and warnings and refuse unknown paths/fields',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-mcp-')),server=await createNativeFlowMcp(config(root)),id='00000000-0000-0000-0000-000000000001';
 try{
  assert.equal(server.toolList.length,7);await assert.rejects(server.callTool('studio_native_flow_start',{requestId:'x',meshPath:'/outside'}),/arguments/);
  const metadata={inputRevision:'sha256:test',numericallyConverged:false,diagnostics:[{code:'SU2_WALL_MODEL_NOT_CONVERGED'}]},volume={pointCount:2,points:[0,0,0,1,0,0],fields:{Pressure:{values:[-3,2]},Velocity:{values:[-5,0,0,-4,1,0]},Y_Plus:{values:[.1,.9]}}},job={jobId:id,status:'completed',settled:true,resultSha256:'abc',result:{metadata,summary:{provisional:true},volume,surface:volume}};server.host.jobs.set(id,job);
  const pressure=await server.callTool('studio_native_flow_result',{jobId:id,field:'pressure',limit:1});assert.deepEqual(pressure.entries,[-3]);assert.equal(pressure.nextOffset,1);assert.equal(pressure.units,'Pa gauge');assert.equal(pressure.metadata.numericallyConverged,false);assert.equal(pressure.metadata.diagnostics[0].code,'SU2_WALL_MODEL_NOT_CONVERGED');
  assert.deepEqual((await server.callTool('studio_native_flow_result',{jobId:id,field:'velocity',offset:1})).entries,[[-4,1,0]]);
  await assert.rejects(server.callTool('studio_native_flow_result',{jobId:id,field:'pressure',limit:201}),/page/);await assert.rejects(server.callTool('studio_native_flow_result',{jobId:id,field:'shell'}),/field/);await assert.rejects(server.callTool('studio_native_flow_result',{jobId:id,field:'pressure',limit:null}),/page/);
  const yp=await server.callTool('studio_native_flow_result',{jobId:id,field:'yPlus'});assert.equal(yp.domain,'surface');assert.equal(yp.units,'dimensionless');assert.deepEqual(yp.entries,[.1,.9]);await assert.rejects(server.callTool('studio_native_flow_result',{jobId:id,field:'yPlus',domain:'volume'}),/unavailable/);
  job.settled=false;await assert.rejects(server.callTool('studio_native_flow_release',{jobId:id}),/settlement/);job.settled=true;
  assert.equal((await server.callTool('studio_native_flow_release',{jobId:id})).filesDeleted,false);await assert.rejects(server.callTool('studio_native_flow_result',{jobId:id}),/settled/);
 }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
test('standalone and full Studio MCP expose native tools only with startup configuration',async()=>{
 const root=await mkdtemp(join(tmpdir(),'native-mcp-stdio-'));try{
  const path=join(root,'case.json');await writeFile(path,JSON.stringify(config(root)));
  const lines=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'studio_native_flow_capabilities',arguments:{}}}];
  for(const args of [[resolve('scripts/studio-native-flow-mcp.mjs'),path],[resolve('scripts/studio-mcp.mjs'),'--native-flow-config='+path]]){
   const child=spawnSync(process.execPath,args,{input:lines.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);const replies=child.stdout.trim().split('\n').map(x=>JSON.parse(x));assert.equal(replies.find(r=>r.id===2).result.tools.filter(t=>t.name.startsWith('studio_native_flow_')).length,7);assert.deepEqual(replies.find(r=>r.id===3).result.structuredContent.value.input,input);
  }
  const child=spawnSync(process.execPath,[resolve('scripts/studio-mcp.mjs')],{input:lines.slice(0,3).map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);const list=child.stdout.trim().split('\n').map(x=>JSON.parse(x)).find(r=>r.id===2).result.tools;assert.ok(!list.some(t=>t.name.startsWith('studio_native_flow_')));
 }finally{await rm(root,{recursive:true,force:true});}
});

