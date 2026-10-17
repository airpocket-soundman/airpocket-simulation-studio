import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BoxGeometry} from 'three';
import {createStudioApi} from '../src/studio-api.js';
import {createBrowserSession} from '../src/browser-session.js';
import {getProjectRevision} from '../src/project-revision.js';
import {preflightMeshBoundaryTransfer} from '../src/mesh-boundary-preflight.js';
import {callStudioTool} from '../scripts/studio-mcp.mjs';

function project(kind='structural'){
 const geometry=new BoxGeometry(10,10,40).toNonIndexed();geometry.translate(5,5,20);const positions=Array.from(geometry.attributes.position.array);geometry.dispose();
 const bottom=Array.from({length:12},(_,index)=>index).filter(index=>[2,5,8].every(axis=>positions[index*9+axis]===0));
 return {version:1,sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]},study:{kind,gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:.25},meshes:[{positions,faceIds:Array.from({length:12},(_,index)=>Math.floor(index/2))}],selection:[[]],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:bottom}]}]};
}
async function waitForJob(jobId){const end=Date.now()+30000;while(Date.now()<end){const job=await callStudioTool('studio_job_status',{jobId});if(job.executionSettled)return job;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Mesh-only MCP job did not settle');}

test('shared boundary-transfer report is read-only, exact-revision-bound, and keeps partial-preflight limits explicit',async()=>{
 const input=project(),revision=await getProjectRevision(input),unloaded=structuredClone(input);unloaded.conditions=[];const output={input:unloaded,mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[]}},job={jobId:'mesh-1',inputRevision:revision,state:'succeeded',executionSettled:true,operation:'mesh'};
 const before=JSON.stringify(input),valid=await preflightMeshBoundaryTransfer({project:unloaded,job:{...job,inputRevision:await getProjectRevision(unloaded)},output,expectedRevision:await getProjectRevision(unloaded)});
 assert.equal(valid.allowed,true);assert.equal(valid.completePreflight,false);assert.deepEqual(valid.reports,[]);assert.doesNotMatch(valid.remainingChecks.join(' '),/Constraint rank and rigid-body modes have not been checked/);assert.match(valid.remainingChecks.join(' '),/physical accuracy/);assert.equal(valid.rigidBody.rigidBodyModesEliminated,false);assert.equal(JSON.stringify(input),before);
 const stale=await preflightMeshBoundaryTransfer({project:input,job,output,expectedRevision:'sha256:'+'0'.repeat(64)});assert.equal(stale.allowed,false);assert.equal(stale.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_STALE_INPUT');
 const pending=await preflightMeshBoundaryTransfer({project:input,job:{...job,state:'running',executionSettled:false},output,expectedRevision:revision});assert.equal(pending.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_JOB_NOT_READY');
 const changingProject=structuredClone(unloaded),projectPromise=preflightMeshBoundaryTransfer({project:changingProject,job:{...job,inputRevision:await getProjectRevision(unloaded)},output,expectedRevision:await getProjectRevision(unloaded)});changingProject.study.gravityEnabled=true;const changedProjectResult=await projectPromise;assert.equal(changedProjectResult.allowed,false);assert.equal(changedProjectResult.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_INPUT_CHANGED');
 const changingMesh=structuredClone(output),meshPromise=preflightMeshBoundaryTransfer({project:unloaded,job:{...job,inputRevision:await getProjectRevision(unloaded)},output:changingMesh,expectedRevision:await getProjectRevision(unloaded)});changingMesh.mesh.nodes.push(12);const changedMeshResult=await meshPromise;assert.equal(changedMeshResult.allowed,false);assert.equal(changedMeshResult.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_INPUT_CHANGED');
 const modal=project();modal.study.modalAnalysis=true;const modalRevision=await getProjectRevision(modal),modalResult=await preflightMeshBoundaryTransfer({project:modal,job:{...job,inputRevision:modalRevision},output:{...output,input:modal},expectedRevision:modalRevision});assert.equal(modalResult.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_MODEL_UNSUPPORTED');
 const transferFailure=await preflightMeshBoundaryTransfer({project:input,job,output:{...output,input,mesh:{nodes:[],surface:[]}},expectedRevision:revision});assert.equal(transferFailure.allowed,false);assert.equal(transferFailure.diagnostics[0].stage,'mesh');assert.equal(transferFailure.diagnostics[0].code,'ANALYSIS_MESH_NODES_INVALID');
});

test('GUI-style input with the default materialTemperature is inspected; a temperature-dependent material is still refused',async()=>{
 // The live page always exports study.materialTemperature (default 20); only a temperature-dependent material makes it relevant.
 const input=project();input.study.materialTemperature=20;const unloaded=structuredClone(input);unloaded.conditions=[];const revision=await getProjectRevision(unloaded),output={input:unloaded,mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[]}},job={jobId:'mesh-gui',inputRevision:revision,state:'succeeded',executionSettled:true,operation:'mesh'};
 const allowed=await preflightMeshBoundaryTransfer({project:unloaded,job,output,expectedRevision:revision});assert.equal(allowed.allowed,true);assert.equal(allowed.completePreflight,false);
 const dependent=structuredClone(unloaded);dependent.materialProperties.dependence={elasticTemperatureTable:[[20,1e9],[80,9e8]]};const depRevision=await getProjectRevision(dependent),refused=await preflightMeshBoundaryTransfer({project:dependent,job:{...job,inputRevision:depRevision},output:{...output,input:dependent},expectedRevision:depRevision});assert.equal(refused.allowed,false);assert.equal(refused.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_MODEL_UNSUPPORTED');
});

test('stdio MCP and live browser contract inspect one successful settled real mesh-only job without changing saved or live input',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'studio-boundary-preflight-')),inputPath=join(directory,'input.json'),outputPath=join(directory,'mesh.json'),input=project(),original=JSON.stringify(input);await writeFile(inputPath,original);
 try{
  const revision=await getProjectRevision(input),contract=await callStudioTool('studio_browser_contracts',{method:'meshBoundaryPreflight'}),declaration=contract.operations[0];assert.equal(declaration.method,'meshBoundaryPreflight');assert.deepEqual(declaration.inputSchema.required,['jobId','inputRevision']);assert.equal(declaration.inputSchema.additionalProperties,false);await assert.rejects(callStudioTool('studio_preflight_mesh_boundaries',{path:inputPath,jobId:'bad',inputRevision:revision,mesh:{}}),/Invalid tool arguments/);
  const started=await callStudioTool('studio_start_analysis',{path:inputPath,outputPath,requestId:'boundary-preflight',operation:'mesh',size:5,method:'wasm-pcg'});const job=await waitForJob(started.jobId);assert.equal(job.state,'succeeded',JSON.stringify(job.error));assert.equal(job.executionSettled,true);assert.equal(job.operation,'mesh');
  const inspected=await callStudioTool('studio_preflight_mesh_boundaries',{path:inputPath,jobId:job.jobId,inputRevision:revision});assert.equal(inspected.allowed,true,JSON.stringify(inspected.diagnostics));assert.equal(inspected.completePreflight,false);assert.equal(inspected.inputRevision,revision);assert.equal(inspected.rigidBody.rigidBodyModesEliminated,true);assert.ok(inspected.reports.length);assert.match(inspected.remainingChecks.join(' '),/physical accuracy/);
  const changed=project();changed.materialProperties.youngModulus*=2;await writeFile(inputPath,JSON.stringify(changed));const stale=await callStudioTool('studio_preflight_mesh_boundaries',{path:inputPath,jobId:job.jobId,inputRevision:revision});assert.equal(stale.allowed,false);assert.equal(stale.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_STALE_INPUT');await writeFile(inputPath,original);
  const saved=JSON.stringify(JSON.parse(await readFile(inputPath,'utf8'))),output=JSON.parse(await readFile(outputPath,'utf8')),studio=createStudioApi();studio.loadProject(input);const session=createBrowserSession({studio,analysis:{getJob:()=>job,getJobResult:()=>output}}),live=await session.call('meshBoundaryPreflight',{jobId:job.jobId,inputRevision:revision});assert.equal(live.allowed,true,JSON.stringify(live.diagnostics));assert.equal(live.completePreflight,false);assert.equal(JSON.stringify(studio.exportProject()),original);assert.equal(JSON.stringify(JSON.parse(await readFile(inputPath,'utf8'))),saved);
  const liveStale=await session.call('meshBoundaryPreflight',{jobId:job.jobId,inputRevision:'sha256:'+'0'.repeat(64)});assert.equal(liveStale.allowed,false);assert.equal(liveStale.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_STALE_INPUT');
  const modal=project();modal.study.modalAnalysis=true;const modalRevision=await getProjectRevision(modal),modalStudio=createStudioApi();modalStudio.loadProject(modal);const modalLive=await createBrowserSession({studio:modalStudio,analysis:{getJob:()=>({...job,inputRevision:modalRevision}),getJobResult:()=>({...output,input:modal})}}).call('meshBoundaryPreflight',{jobId:job.jobId,inputRevision:modalRevision});assert.equal(modalLive.allowed,false);assert.equal(modalLive.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_MODEL_UNSUPPORTED');
  const failedLive=await createBrowserSession({studio,analysis:{getJob:()=>job,getJobResult:()=>({...output,mesh:{nodes:[],surface:[]}})}}).call('meshBoundaryPreflight',{jobId:job.jobId,inputRevision:revision});assert.equal(failedLive.allowed,false);assert.equal(failedLive.diagnostics[0].code,'ANALYSIS_MESH_NODES_INVALID');
  output.mesh.nodes[0]+=0.01;await writeFile(outputPath,JSON.stringify(output)+'\n');const changedMesh=await callStudioTool('studio_preflight_mesh_boundaries',{path:inputPath,jobId:job.jobId,inputRevision:revision});assert.equal(changedMesh.allowed,false);assert.equal(changedMesh.diagnostics[0].code,'ANALYSIS_MESH_PREFLIGHT_OUTPUT_INVALID');assert.equal(JSON.stringify(JSON.parse(await readFile(inputPath,'utf8'))),saved);
 }finally{await rm(directory,{recursive:true,force:true});}
});
