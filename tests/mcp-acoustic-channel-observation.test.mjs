import {createProjectFromBuiltin} from '../src/project-import.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {getObservationProfiles} from '../src/observation-profiles.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

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
test('real MCP harmonic, sweep and channel jobs expose declared recurrence observations without result fields',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-wave-observe-')),mcp=server();try{await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();const profiles=(await mcp.call('studio_capabilities',{})).observation.profiles;
 for(const kind of ['harmonic','sweep','channel']){
  const p=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,2,2,4]}});p.materialProperties={};p.study=kind==='channel'?{kind:'channelFlow',dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500,pressureDropPa:.001,flowAxis:2}:{kind:'acoustic',frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:.01,referencePressurePa:20e-6,...(kind==='sweep'?{sweep:true,sweepStart:500,sweepEnd:1500,sweepCount:2,receiverPoint:[1,1,2]}:{})};p.conditions=kind==='channel'?[]:[{type:'acousticPressure',value:1,direction:[0,0,1],regions:[{mesh:0,triangles:p.meshes[0].faceIds.map((_,i)=>i)}]}];
  const path=join(dir,kind+'.json'),outputPath=join(dir,kind+'-out.json'),original=JSON.stringify(p);await writeFile(path,original);const profile=profiles.find(x=>x.id===(kind==='channel'?'channel-flow':'acoustic-frequency'));
  const job=await mcp.call('studio_start_analysis',{path,outputPath,requestId:kind,includeFields:false,size:1}),deadline=Date.now()+25000;let done;do{done=await mcp.call('studio_job_status',{jobId:job.jobId});assert.ok(Date.now()<deadline);if(!done.executionSettled)await new Promise(r=>setTimeout(r,5));}while(!done.executionSettled);assert.equal(done.state,'succeeded',JSON.stringify(done.error));
  let cursor=0,more;const events=[];do{const page=await mcp.call('studio_job_events',{jobId:job.jobId,afterSequence:cursor,limit:100});assert.equal(page.truncated,false);events.push(...page.events);cursor=page.nextSequence;more=page.hasMore;}while(more);
  const numerical=events.filter(e=>e.stage==='iteration');assert.ok(numerical.length>0,kind);for(const e of numerical){assert.equal(e.solver,kind==='channel'?'pcg':'bicgstab');assert.ok(Number.isFinite(e.residual)&&e.residual>=0);assert.ok(Number.isFinite(e.tolerance)&&e.tolerance>0);assert.equal(typeof e.converged,'boolean');assert.ok(profile.events.some(d=>d.stage===e.stage&&d.solver===e.solver&&d.residualKind===e.residualKind));assert.equal(e.field,undefined);assert.equal(e.displacement,undefined);assert.equal(e.pressure,undefined);assert.equal(e.velocity,undefined);if(kind!=='channel'){assert.equal(e.kind,'acoustic');assert.ok([500,1000,1500].includes(e.frequencyHz));}}
  if(kind==='sweep'){const steps=events.filter(e=>e.stage==='frequency-step');assert.deepEqual(steps.map(e=>[e.phase,e.step,e.steps,e.frequencyHz]),[['start',1,2,500],['complete',1,2,500],['start',2,2,1500],['complete',2,2,1500]]);assert.ok(steps.filter(e=>e.phase==='complete').every(e=>e.converged===true));assert.ok(numerical.some(e=>e.solvePhase==='single'));assert.ok(numerical.some(e=>e.solvePhase==='sweep'));}
  const output=JSON.parse(await readFile(outputPath,'utf8'));assert.ok(Number.isFinite(output.result.residual));const store=createCaseStore();store.add(kind,output);assert.equal(prepareCaseView(store.list()[0]).result.kind,kind==='channel'?'channelFlow':'acoustic');assert.equal((await mcp.call('studio_job_artifacts',{jobId:job.jobId})).total,0);assert.equal(await readFile(path,'utf8'),original);await mcp.call('studio_release_job',{jobId:job.jobId});
 }
 }finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
test('acoustic and channel profiles declare recurrence basis, sweep conditions and no fields',()=>{
 for(const id of ['acoustic-frequency','channel-flow']){const p=getObservationProfiles({target:'node'}).find(p=>p.id===id),event=p.events.find(e=>e.stage==='iteration');assert.equal(event.residualKind,'recurrence-relative');assert.match(event.residualBasis,/no independent true-residual/);assert.deepEqual(p.fields,[]);assert.ok(!p.limitations.includes('No structured numerical iteration events'));}
 const sweep=getObservationProfiles().find(p=>p.id==='acoustic-frequency').events.find(e=>e.stage==='frequency-step');assert.equal(sweep.when,'frequency-sweep');assert.deepEqual(sweep.phases,['start','complete']);assert.ok(sweep.completeMetricsOnly.includes('peakPressurePa'));
});
