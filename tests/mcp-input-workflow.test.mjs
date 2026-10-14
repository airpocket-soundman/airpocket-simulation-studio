import {createCaseStore} from '../src/cases.js';
import {validateSavedAssessment} from '../src/analysis-preflight.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {callStudioTool} from '../scripts/studio-mcp.mjs';
const op=(method,...args)=>({method,args});
const read=(p,pointer)=>pointer.slice(1).split('/').reduce((v,key)=>v[key.replace(/~1/g,'/').replace(/~0/g,'~')],p);
async function finished(jobId){const deadline=Date.now()+20_000;while(Date.now()<deadline){const job=await callStudioTool('studio_job_status',{jobId});if(['succeeded','failed','cancelled','timed_out'].includes(job.state))return job;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('MCP job timeout');}

test('MCP creates a project, edits physical setup, blocks unconfirmed quantitative input and preserves exploratory assumptions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-input-workflow-'));let jobId;
 try{
  const initial=join(dir,'initial.json'),configured=join(dir,'configured.json');
  const created=await callStudioTool('studio_create_builtin_project',{source:{kind:'box',bounds:[0,0,0,10,10,40]},outputPath:initial});assert.equal(created.summary.conditionCount,0);assert.equal(created.units.geometry,'mm');
  const result=await callStudioTool('studio_edit_project',{path:initial,outputPath:configured,expectedRevision:created.revision,operations:[op('selectPlanarRegion',0,{axis:2,position:0,min:[0,0],max:[10,10]}),op('addCondition',{type:'fixed'}),op('selectPlanarRegion',0,{axis:2,position:40,min:[0,0],max:[10,10]}),op('addCondition',{type:'force',value:100,direction:[0,0,1]}),op('setMaterialProperties',{youngModulus:1e9,poissonRatio:0}),op('setStudy',{kind:'structural',gravityEnabled:false}),op('setAnalysisIntent',{mode:'quantitative'})]});
  const report=await callStudioTool('studio_preflight_project',{path:configured});assert.equal(report.allowed,false);assert.ok(report.diagnostics.some(d=>d.code==='PROVENANCE_REQUIRED'));assert.equal(report.completePreflight,false);
  const rejectedPath=join(dir,'rejected.json');await assert.rejects(callStudioTool('studio_analyze',{path:configured,outputPath:rejectedPath}),e=>e.code==='ANALYSIS_PREFLIGHT_FAILED'&&e.diagnostics.length>0);await assert.rejects(stat(rejectedPath),{code:'ENOENT'});
  const project=JSON.parse(await readFile(configured,'utf8')),entries=report.requiredPointers.map(pointer=>({pointer,value:read(project,pointer),source:{kind:pointer==='/materialProperties/youngModulus'?'agent-proposal':'user-input'},rationale:'Reference test supplied value',applicability:'This axial bar reference only',assumption:pointer==='/materialProperties/youngModulus'?'Assume 1 GPa for this exploratory reference':null,status:pointer==='/materialProperties/youngModulus'?'unconfirmed':'confirmed'}));
  const exploratory=join(dir,'exploratory.json');await callStudioTool('studio_edit_project',{path:configured,outputPath:exploratory,expectedRevision:result.revision,operations:[op('setInputProvenance',{schemaVersion:1,entries}),op('setAnalysisIntent',{mode:'exploratory'})]});
  const ready=await callStudioTool('studio_preflight_project',{path:exploratory});assert.equal(ready.allowed,true);assert.equal(ready.provisional,true);
  const started=await callStudioTool('studio_start_analysis',{path:exploratory,outputPath:join(dir,'result.json'),requestId:'exploratory-reference',includeFields:true});jobId=started.jobId;
  const job=await finished(jobId);assert.equal(job.state,'succeeded',JSON.stringify(job.error));assert.ok(Math.abs(job.result.maxDisplacementMm-.04)<1e-8);assert.equal(job.result.job.final,true);assert.equal(job.result.job.provisional,true);
  const saved=JSON.parse(await readFile(job.result.outputPath,'utf8'));assert.equal(saved.analysisAssessment.provisional,true);assert.equal(saved.result.analysisAssessment.provisional,true);assert.equal(saved.input.inputProvenance.entries[0].rationale,'Reference test supplied value');
  const store=createCaseStore();store.add('Exploratory bar',saved);const tampered=structuredClone(saved);tampered.result.analysisAssessment.provisional=false;assert.throws(()=>store.add('False confirmation',tampered),/assessment/);assert.equal(store.list().length,1);const stripped=structuredClone(saved);delete stripped.analysisAssessment;delete stripped.result.analysisAssessment;assert.throws(()=>validateSavedAssessment(stripped),/assessment/);
  const events=await callStudioTool('studio_job_events',{jobId,limit:100}),mesh=events.events.find(e=>e.stage==='mesh');assert.ok(mesh.artifact.artifactId);
  const artifact=await callStudioTool('studio_job_artifact',{jobId,artifactId:mesh.artifact.artifactId,limit:2});assert.equal(artifact.page.count,2);assert.equal(artifact.provisional,true);assert.equal(artifact.inputRevision,started.inputRevision);
  const elements=await callStudioTool('studio_job_artifact',{jobId,artifactId:mesh.artifact.artifactId,pageKind:'elements',offset:0,limit:2});assert.equal(elements.page.kind,'elements');assert.equal(elements.page.count,2);assert.deepEqual(elements.page.tetrahedra,saved.mesh.tetrahedra.slice(0,2));
  for(const selector of [{point:[0,0,0]},{bodyIndex:0},{elementIndex:0}])await assert.rejects(callStudioTool('studio_job_artifact',{jobId,artifactId:mesh.artifact.artifactId,pageKind:'elements',limit:1,...selector}),/cannot include measurement selectors/);
  await assert.rejects(callStudioTool('studio_job_artifact',{jobId,artifactId:mesh.artifact.artifactId,pageKind:'faces'}));
  await writeFile(mesh.artifact.path,'tampered');await assert.rejects(callStudioTool('studio_job_artifact',{jobId,artifactId:mesh.artifact.artifactId}),e=>e.code==='INTERMEDIATE_INTEGRITY_FAILED');
 }finally{if(jobId)await callStudioTool('studio_release_job',{jobId});await rm(dir,{recursive:true,force:true});}
});

test('MCP STEP import preserves units/source and refuses existing destinations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-step-tool-'));
 try{const path=new URL('./fixtures/cad-update-reference.step',import.meta.url),outputPath=join(dir,'step.json');const {fileURLToPath}=await import('node:url');const imported=await callStudioTool('studio_import_project',{path:fileURLToPath(path),outputPath});assert.ok(imported.summary.meshCount>0);const saved=JSON.parse(await readFile(outputPath,'utf8'));assert.equal(saved.sourceModel.kind,'step');
  const inspected=await callStudioTool('studio_inspect_project',{path:outputPath,meshIndex:0,faceLimit:50});assert.deepEqual(inspected.geometry.boundsMm.size,[10,10,40]);const faces=inspected.geometry.mesh.facePage.faces,bottom=faces.find(f=>Math.abs(f.boundsMm.max[2])<1e-7),top=faces.find(f=>Math.abs(f.boundsMm.min[2]-40)<1e-7);assert.ok(bottom);assert.ok(top);assert.ok(Math.abs(bottom.areaMm2-100)<1e-8);
  const configured=join(dir,'configured-step.json');await callStudioTool('studio_edit_project',{path:outputPath,outputPath:configured,expectedRevision:inspected.revision,operations:[op('selectCadFace',0,bottom.faceId),op('addCondition',{type:'fixed'}),op('selectCadFace',0,top.faceId),op('addCondition',{type:'force',value:100,direction:[0,0,1]}),op('setMaterialProperties',{youngModulus:1e9,poissonRatio:0}),op('setStudy',{kind:'structural',gravityEnabled:false})]});const analysis=await callStudioTool('studio_analyze',{path:configured,outputPath:join(dir,'step-result.json')});assert.ok(Math.abs(analysis.maxDisplacementMm-.04)<1e-8);
  assert.equal(saved.sourceModel.data,Buffer.from(await readFile(path)).toString('base64'));await assert.rejects(callStudioTool('studio_import_project',{path:fileURLToPath(path),outputPath}),/exist/i);}
 finally{await rm(dir,{recursive:true,force:true});}
});
