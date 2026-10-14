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
test('real MCP observation profiles match actual CPU, thermal, acoustic, channel-flow and MFEM job events',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-observation-profiles-')),mcp=server();
 try{
  await mcp.request('initialize',{protocolVersion:'2025-11-25'});mcp.notify();const capabilities=await mcp.call('studio_capabilities',{}),profiles=capabilities.observation.profiles;assert.ok(Array.isArray(profiles)&&profiles.length>0);assert.equal(new Set(profiles.map(profile=>profile.id)).size,profiles.length);
  const structural=project(),steady=project();steady.study={kind:'thermal',transient:false};steady.materialProperties={conductivity:1,density:1000,specificHeat:1000};steady.conditions=steady.conditions.map((c,i)=>({...c,type:'temperature',value:i?20:100}));const transient=structuredClone(steady);transient.study={kind:'thermal',transient:true,timeStep:1,steps:2,initialTemperature:20};const acoustic=project();acoustic.study={kind:'acoustic',acousticTransient:true,frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0,pulseWidth:.0002,acousticDuration:.0025,receiverPoint:[5,5,20]};acoustic.materialProperties={};acoustic.conditions=[{...acoustic.conditions[0],type:'acousticPressure',value:1}];
  const harmonic=structuredClone(acoustic);harmonic.study={kind:'acoustic',frequency:2000,soundSpeed:343,airDensity:1.2,lossFactor:.01};harmonic.conditions=[{...structural.conditions[0],type:'acousticPressure',value:1},{...structural.conditions[1],type:'acousticPressure',value:0}];const flow=project();flow.study={kind:'channelFlow',dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1500,pressureDropPa:.01,flowAxis:2};flow.materialProperties={};flow.conditions=[];
  const expected=[['linear',structural,'iteration',null],['steady-heat',steady,'time-step','thermal'],['transient-heat',transient,'time-step','thermal'],['transient-acoustic',acoustic,'time-step','acousticTransient'],['harmonic-acoustic',harmonic,null,null],['channel-flow',flow,null,null],['native-mfem',structural,null,null,'mfem-wasm']];
  for(const [name,input,stage,fieldKind,method='wasm-pcg']of expected){
   const path=join(dir,name+'.json'),outputPath=join(dir,name+'-result.json');await writeFile(path,JSON.stringify(input));const diagnostic=await mcp.call('studio_diagnose_execution',{path,method,includeFields:true}),preflight=await mcp.call('studio_preflight_project',{path,method,includeFields:true}),selected=diagnostic.selectedObservation;assert.ok(selected,name);assert.equal(selected.supported,true);assert.equal(selected.declarationOnly,true);assert.equal(selected.physicalAccuracyVerified,false);assert.equal(selected.fieldRetention.requested,true);assert.equal(preflight.selectedObservation.profileId,selected.profileId);assert.deepEqual(selected.profile,profiles.find(profile=>profile.id===selected.profileId));
   if(stage)assert.ok(selected.profile.events.some(event=>event.stage===stage));else assert.ok(selected.profile.events.every(event=>['preparation','mesh','progress'].includes(event.stage)),name);if(fieldKind)assert.ok(selected.profile.fields.some(field=>field.kind===fieldKind));else assert.deepEqual(selected.profile.fields,[]);
   const started=await mcp.call('studio_start_analysis',{path,outputPath,requestId:name,includeFields:true,size:5,method});const deadline=Date.now()+20000;let done;do{done=await mcp.call('studio_job_status',{jobId:started.jobId});assert.ok(Date.now()<deadline);if(!done.executionSettled)await new Promise(resolve=>setTimeout(resolve,5));}while(!done.executionSettled);assert.equal(done.state,'succeeded',name+': '+JSON.stringify(done.error));
   const events=[];let cursor=0,more;do{const page=await mcp.call('studio_job_events',{jobId:started.jobId,afterSequence:cursor,limit:100});events.push(...page.events);cursor=page.nextSequence;more=page.hasMore;}while(more);const observations=events.filter(event=>event.type==='progress');if(stage)assert.ok(observations.some(event=>event.stage===stage),name);else assert.ok(observations.every(event=>['preparation','mesh','progress'].includes(event.stage)),name);
   for(const event of observations){const declarations=selected.profile.events.filter(declaration=>declaration.stage===event.stage);assert.ok(declarations.length>0,name+' undeclared stage '+event.stage);if(event.solver!==undefined)assert.ok(declarations.some(declaration=>declaration.solver===event.solver));if(event.artifact&&event.artifact.kind!=='mesh')assert.ok(selected.profile.fields.some(field=>field.kind===event.artifact.kind));}
   const artifacts=(await mcp.call('studio_job_artifacts',{jobId:started.jobId})).artifacts,fields=artifacts.filter(artifact=>artifact.kind!=='mesh');if(fieldKind){assert.ok(fields.length>0);for(const artifact of fields){assert.equal(artifact.kind,fieldKind);const actual=await mcp.call('studio_job_artifact',{jobId:started.jobId,artifactId:artifact.artifactId});assert.ok(selected.profile.fields.some(field=>field.kind===actual.field.kind&&field.name===actual.field.name&&field.unit===actual.field.unit));}if(name==='steady-heat'){assert.equal(fields.length,1);assert.equal(observations.find(event=>event.stage==='time-step').time,0);}if(name==='transient-heat')assert.equal(fields.length,2);}else assert.equal(fields.length,0);
   await mcp.call('studio_release_job',{jobId:started.jobId});
  }
 }finally{await mcp.close();await rm(dir,{recursive:true,force:true});}
});
