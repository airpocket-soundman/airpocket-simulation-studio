import {sampleResult} from '../src/probe.js';
import {createProjectFromBuiltin} from '../src/project-import.js';
import {preflightProject,validateSavedAssessment} from '../src/analysis-preflight.js';
import {buildTemperatureCaseSource} from '../src/case-source-operations.js';
import {createInputProvenance} from '../src/input-provenance.js';
import {createCaseStore} from '../src/cases.js';
import {prepareCaseView} from '../src/case-view.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
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
function models(){
 const base=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,2,2,4]}}),all=base.meshes[0].faceIds.map((_,i)=>i);
 const harmonic=structuredClone(base);harmonic.materialProperties={};harmonic.study={kind:'acoustic',acousticTransient:false,sweep:false,exteriorRadiation:false,directivityEnabled:false,frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0,referencePressurePa:20e-6};harmonic.conditions=[{type:'acousticPressure',value:1,direction:[0,0,1],regions:[{mesh:0,triangles:all}]}];
 const transient=structuredClone(harmonic);transient.study={...harmonic.study,acousticTransient:true,acousticDuration:.0025,pulseWidth:.0002,dampingRate:0,acousticTimeStep:0,receiverPoint:[1,1,2]};
 const channel=structuredClone(base);channel.materialProperties={};channel.conditions=[];channel.study={kind:'channelFlow',dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500,pressureDropPa:.001,flowAxis:2};
 const stokes=structuredClone(base);stokes.materialProperties={};stokes.conditions=[];stokes.sourceModel={kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:1},enclosure:[-3,-3,-3,6,6,6]};stokes.study={kind:'creepingFlow',dynamicViscosity:.01,fluidDensity:1.2,freeStreamVelocity:[.0001,0,0],referenceLengthMm:2,stokesVelocityElement:'P1'};
 return {harmonic,transient,channel,stokes};
}
function documented(p,mode='exploratory'){
 p.analysisIntent={mode};p.inputProvenance=createInputProvenance(preflightProject(p).requiredPointers.map(pointer=>({pointer,value:pointer.slice(1).split('/').reduce((value,key)=>value[key],p),source:{kind:'agent-proposal'},rationale:'Explicit virtual reference inputs',status:'unconfirmed',assumption:'Virtual pipeline reference; not measured or user-confirmed',applicability:'Limited acoustic or fluid model'})));return p;
}
test('real MCP acoustic and fluid evidence survives execution, field access and saved-case validation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-wave-fluid-evidence-')),mcp=server();try{await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();for(const [name,raw]of Object.entries(models())){
  const missing=structuredClone(raw);missing.analysisIntent={mode:'exploratory'};assert.equal(preflightProject(missing).allowed,false);
  const p=documented(raw),path=join(dir,name+'.json'),outputPath=join(dir,name+'-output.json'),original=JSON.stringify(p);await writeFile(path,original);
  const report=await mcp.call('studio_preflight_project',{path});assert.equal(report.allowed,true,JSON.stringify(report.diagnostics));assert.equal(report.provisional,true);assert.equal(report.completePreflight,false);
  const started=await mcp.call('studio_start_analysis',{path,outputPath,requestId:name,includeFields:true,size:2}),deadline=Date.now()+30000;let done;do{done=await mcp.call('studio_job_status',{jobId:started.jobId});assert.ok(Date.now()<deadline);if(!done.executionSettled)await new Promise(resolve=>setTimeout(resolve,10));}while(!done.executionSettled);assert.equal(done.state,'succeeded',JSON.stringify(done.error));
  const output=JSON.parse(await readFile(outputPath,'utf8'));assert.equal(output.analysisAssessment.provisional,true);assert.equal(validateSavedAssessment(output),true);const store=createCaseStore();store.add(name,output);const restored=createCaseStore();restored.import(JSON.parse(JSON.stringify(store.export())));assert.equal(prepareCaseView(restored.list()[0]).result.kind,output.result.kind);
  const point=name==='stokes'?[2,0,0]:[1,1,2],final=await mcp.call('studio_probe',{path:outputPath,point});assert.equal(final.analysisAssessment.provisional,true);
  if(name==='harmonic'){const legacy=structuredClone(output);delete legacy.analysisAssessment;delete legacy.result.analysisAssessment;delete legacy.input.analysisIntent;delete legacy.input.inputProvenance;delete legacy.job;const legacyPath=join(dir,'old-harmonic.json');await writeFile(legacyPath,JSON.stringify(legacy));assert.equal(Object.hasOwn(await mcp.call('studio_probe',{path:legacyPath,point}),'analysisAssessment'),false);const tampered=structuredClone(output);tampered.result.analysisAssessment.provisional=false;const tamperedPath=join(dir,'altered-assessment.json');await writeFile(tamperedPath,JSON.stringify(tampered));assert.equal((await mcp.raw('studio_probe',{path:tamperedPath,point})).result.isError,true);}
  if(name==='transient'){
   const artifacts=(await mcp.call('studio_job_artifacts',{jobId:started.jobId,limit:100})).artifacts.filter(a=>a.kind==='acousticTransient');assert.ok(artifacts.length);
   for(const artifact of artifacts){const field=await mcp.call('studio_job_artifact',{jobId:started.jobId,artifactId:artifact.artifactId,point});const frame=output.result.snapshots.find(snapshot=>snapshot.time===field.field.time);assert.ok(frame,'Every retained field must match a complete saved result frame');const sample=sampleResult(output.mesh,{...output.result,...frame},point);assert.equal(field.measurement.time,sample.time);assert.ok(Math.abs(field.measurement.value-sample.pressurePa)<1e-10,JSON.stringify({field:field.measurement,matchingFrame:sample}));}
   // Queue retention must not truncate or replace the complete final solve output.
   const directFinal=sampleResult(output.mesh,output.result,point),lastFrame=output.result.snapshots.at(-1);assert.equal(final.time,output.result.duration);assert.equal(final.pressurePa,directFinal.pressurePa);assert.equal(lastFrame.time,output.result.time);assert.deepEqual(lastFrame.pressure,output.result.pressure);
   const queue=done.result.intermediateQueue;assert.ok(queue);assert.equal(queue.latestPolicy,'last-accepted-snapshot');assert.ok(queue.peakEvents<=queue.maxEvents&&queue.peakBytes<=queue.maxBytes);
   if(queue.dropped){assert.ok(queue.droppedFields>0);const events=[];let cursor=0,hasMore;do{const page=await mcp.call('studio_job_events',{jobId:started.jobId,afterSequence:cursor,limit:100});assert.equal(page.truncated,false);events.push(...page.events);cursor=page.nextSequence;hasMore=page.hasMore;}while(hasMore);const notice=events.filter(event=>event.stage==='observation-queue-limit').at(-1);assert.ok(notice);assert.equal(notice.observationQueue.dropped,queue.dropped);assert.ok(report.selectedObservation.profile.events.some(event=>event.stage===notice.stage&&event.when==='pending-payload-limit'));}
   assert.deepEqual(JSON.parse(await readFile(outputPath,'utf8')),output);
  }
  assert.equal(await readFile(path,'utf8'),original);await mcp.call('studio_release_job',{jobId:started.jobId});
  const stale=structuredClone(p),pointer=report.requiredPointers.find(v=>v==='/study/soundSpeed'||v==='/study/dynamicViscosity');const key=pointer.split('/').at(-1);stale.study[key]*=2;const stalePath=join(dir,name+'-stale.json');await writeFile(stalePath,JSON.stringify(stale));const refused=await mcp.call('studio_preflight_project',{path:stalePath});assert.equal(refused.allowed,false);assert.ok(refused.diagnostics.some(d=>d.code==='PROVENANCE_STALE'&&d.target===pointer));const denied=await mcp.raw('studio_analyze',{path:stalePath,outputPath:join(dir,name+'-denied.json'),size:2});assert.equal(denied.result.isError,true);
 }}finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
