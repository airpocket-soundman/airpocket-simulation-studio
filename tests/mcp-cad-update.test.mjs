import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,stat,readdir,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import {importProjectFile} from '../scripts/import-project.mjs';
import {createStudioApi} from '../src/studio-api.js';
import {getProjectRevision} from '../src/project-operations.js';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {preflightProject} from '../src/analysis-preflight.js';
import {createInputProvenance} from '../src/input-provenance.js';

test('real MCP previews and exclusively applies revisioned STEP updates with bounded reports',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-cad-update-')),child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0;
 lines.on('line',line=>{const m=JSON.parse(line);pending.get(m.id)?.(m);});
 const request=(method,params)=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout'));},30000);pending.set(key,m=>{clearTimeout(timer);pending.delete(key);resolve(m);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 const call=async(name,args)=>{const r=await request('tools/call',{name,arguments:args});assert.equal(r.error,undefined);return r.result;};
 const value=r=>{assert.notEqual(r.isError,true,r.content?.[0]?.text);return r.structuredContent.value;};
 try{
  await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'cad-update-test',version:'1'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const tools=(await request('tools/list')).result.tools;assert.equal(tools.find(t=>t.name==='studio_preview_cad_update').annotations.readOnlyHint,true);assert.equal(tools.find(t=>t.name==='studio_apply_cad_update').annotations.readOnlyHint,false);
  const stepPath=fileURLToPath(new URL('./fixtures/cad-update-reference.step',import.meta.url)),imported=await importProjectFile(stepPath),studio=createStudioApi();studio.loadProject(imported);
  for(const [position,type] of [[0,'fixed'],[40,'force']]){studio.selectPlanarRegion(0,{axis:2,position,min:[0,0],max:[10,10]});studio.addCondition({type,value:type==='force'?100:0,direction:[0,0,1]});}
  studio.setMaterialProperties({youngModulus:1e9,poissonRatio:0});studio.setStudy({kind:'structural',gravityEnabled:false});
  const input=JSON.parse(JSON.stringify(studio.exportProject()));input.inputProvenance={schemaVersion:1,entries:[{pointer:'/materialProperties/youngModulus',value:1e9,source:{kind:'agent-proposal'},rationale:'Synthetic reference',applicability:'Original CAD only',status:'confirmed',assumption:'Nominal modulus',confirmation:{by:'user',note:'Old CAD only'}}]};
  const path=join(dir,'input.json'),replacementPath=join(dir,'replacement.json'),outputPath=join(dir,'updated.json'),original=JSON.stringify(input);await writeFile(path,original);
  const replacement=structuredClone(imported);replacement.meshes.forEach(mesh=>mesh.faceIds=mesh.faceIds.map(id=>id+100));await writeFile(replacementPath,JSON.stringify(replacement));
  const expectedRevision=await getProjectRevision(input),args={path,replacementPath,expectedRevision},before=await readdir(dir),preview=value(await call('studio_preview_cad_update',{...args,limit:1}));assert.equal(preview.matched,2);assert.equal(preview.pending,0);assert.equal(preview.reports.length,1);assert.equal(preview.reportCount,2);assert.equal(preview.project,undefined);assert.equal(preview.reports[0].regions,undefined);assert.deepEqual(await readdir(dir),before);assert.equal(await readFile(path,'utf8'),original);
  const sparse=structuredClone(input);delete sparse.selection;const sparsePath=join(dir,'without-selection.json'),sparseOutput=join(dir,'without-selection-updated.json');await writeFile(sparsePath,JSON.stringify(sparse));
  const sparseInspection=value(await call('studio_inspect_project',{path:sparsePath}));assert.equal(sparseInspection.revision,await getProjectRevision(sparse));
  const sparsePreview=value(await call('studio_preview_cad_update',{...args,path:sparsePath,expectedRevision:sparseInspection.revision}));assert.equal(sparsePreview.matched,2);
  const sparseApplied=value(await call('studio_apply_cad_update',{...args,path:sparsePath,outputPath:sparseOutput,expectedRevision:sparseInspection.revision,expectedReplacementRevision:sparsePreview.replacementRevision}));assert.equal(sparseApplied.revision,await getProjectRevision(JSON.parse(await readFile(sparseOutput,'utf8'))));assert.equal(JSON.parse(await readFile(sparsePath,'utf8')).selection,undefined);
  const page=value(await call('studio_preview_cad_update',{...args,offset:1,limit:1}));assert.equal(page.reports[0].index,1);
  for(const extra of [{limit:51},{offset:-1},{limit:1.5},{limit:0}])assert.equal((await call('studio_preview_cad_update',{...args,...extra})).isError,true);
  const direct=value(await call('studio_preview_cad_update',{...args,replacementPath:stepPath}));assert.equal(direct.matched,2);assert.equal(direct.replacementRevision,await getProjectRevision(imported));
  const directPath=join(dir,'direct.json');value(await call('studio_apply_cad_update',{...args,replacementPath:stepPath,outputPath:directPath,expectedReplacementRevision:direct.replacementRevision}));
  const directProject=JSON.parse(await readFile(directPath,'utf8'));assert.equal(directProject.inputProvenance.entries[0].status,'unconfirmed');assert.equal(directProject.inputProvenance.entries[0].confirmation,undefined);
  const quantitative=preflightProject(directProject,{size:4},{target:'node',mode:'quantitative'});assert.equal(quantitative.allowed,false);assert.ok(quantitative.diagnostics.some(d=>d.code==='INPUT_UNCONFIRMED'));await assert.rejects(analyzeProject(directProject,{size:4}),error=>error.code==='ANALYSIS_PREFLIGHT_FAILED');
  directProject.analysisIntent={mode:'exploratory'};
  const required=preflightProject(directProject,{size:4},{target:'node'}).requiredPointers;
  directProject.inputProvenance=createInputProvenance(required.map(pointer=>({pointer,value:pointer.slice(1).split('/').reduce((value,key)=>value[key.replace(/~1/g,'/').replace(/~0/g,'~')],directProject),source:{kind:'agent-proposal'},status:'unconfirmed',rationale:'Synthetic axial bar regression fixture',applicability:'This synthetic 10 x 10 x 40 mm STEP reference only',assumption:'Explicit synthetic regression assumption; no material or boundary value is human-confirmed'})));
  const exploratory=preflightProject(directProject,{size:4},{target:'node'});assert.equal(exploratory.allowed,true,JSON.stringify(exploratory.diagnostics));assert.equal(exploratory.provisional,true);assert.ok(directProject.inputProvenance.entries.every(entry=>entry.status==='unconfirmed'&&entry.confirmation===undefined));
  const solved=await analyzeProject(directProject,{size:4});assert.ok(Math.abs(solved.result.maxDisplacementMm/.04-1)<1e-7);assert.equal(solved.analysisAssessment.provisional,true);assert.equal(solved.result.analysisAssessment.provisional,true);
  const apply={...args,outputPath,expectedReplacementRevision:preview.replacementRevision},applied=value(await call('studio_apply_cad_update',apply)),saved=JSON.parse(await readFile(outputPath,'utf8'));assert.equal(applied.revision,await getProjectRevision(saved));assert.deepEqual(saved.materialProperties,input.materialProperties);assert.deepEqual(saved.study,input.study);assert.equal(saved.inputProvenance.entries[0].status,'unconfirmed');assert.equal(saved.inputProvenance.entries[0].confirmation,undefined);assert.ok(saved.meshes[0].faceIds.every(id=>id>=100));assert.equal(saved.conditions.length,2);assert.equal(await readFile(path,'utf8'),original);
  for(const update of [{},{outputPath:path},{outputPath:replacementPath},{outputPath:join(dir,'stale.json'),expectedRevision:'sha256:'+'0'.repeat(64)},{outputPath:join(dir,'stale-replacement.json'),expectedReplacementRevision:'sha256:'+'0'.repeat(64)}])assert.equal((await call('studio_apply_cad_update',{...apply,...update})).isError,true);
  await assert.rejects(stat(join(dir,'stale.json')),{code:'ENOENT'});await assert.rejects(stat(join(dir,'stale-replacement.json')),{code:'ENOENT'});
  assert.equal((await call('studio_preview_cad_update',{...args,replacementPath:'relative.step'})).isError,true);
  const nonStep=join(dir,'builtin.json');await writeFile(nonStep,JSON.stringify({...replacement,sourceModel:{kind:'box',bounds:[0,0,0,10,10,40]}}));assert.equal((await call('studio_preview_cad_update',{...args,replacementPath:nonStep})).isError,true);
  const alias=join(dir,'alias.json');await link(path,alias);assert.equal((await call('studio_preview_cad_update',{...args,replacementPath:alias})).isError,true);
  const moved=structuredClone(replacement);moved.meshes[0].positions=moved.meshes[0].positions.map((v,i)=>i%3===2&&v===40?50:v);await writeFile(replacementPath,JSON.stringify(moved));assert.equal((await call('studio_apply_cad_update',{...apply,outputPath:join(dir,'old-review.json')})).isError,true);
  const changed=value(await call('studio_preview_cad_update',args));assert.ok(changed.pending>0);const changedPath=join(dir,'pending.json');value(await call('studio_apply_cad_update',{...apply,outputPath:changedPath,expectedReplacementRevision:changed.replacementRevision}));const unresolved=JSON.parse(await readFile(changedPath,'utf8'));await assert.rejects(analyzeProject(unresolved,{size:4}),/Resolve CAD/);
 }finally{child.kill();lines.close();await rm(dir,{recursive:true,force:true});}
});
