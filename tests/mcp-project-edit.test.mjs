import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {callStudioTool} from '../scripts/studio-mcp.mjs';
import {createStudioApi} from '../src/studio-api.js';

test('MCP setup editing is atomic, revision-checked and cannot overwrite input or existing output',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-edit-'));
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'edited.json');
  const project={version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]};await writeFile(path,JSON.stringify(project));const original=await readFile(path,'utf8');
  const inspection=await callStudioTool('studio_inspect_project',{path});assert.match(inspection.revision,/^sha256:[a-f0-9]{64}$/);
  const args={path,outputPath,expectedRevision:inspection.revision,operations:[{method:'selectTriangles',args:[0,[0]]},{method:'addCondition',args:[{type:'fixed'}]}]};
  const edited=await callStudioTool('studio_edit_project',args);assert.equal(edited.summary.conditionCount,1);assert.equal(edited.previousRevision,inspection.revision);const api=createStudioApi();api.loadProject(JSON.parse(await readFile(outputPath,'utf8')));assert.equal(api.getSummary().conditionCount,1);
  const saved=await readFile(outputPath,'utf8');await assert.rejects(callStudioTool('studio_edit_project',args),/exist/i);assert.equal(await readFile(outputPath,'utf8'),saved);assert.equal(await readFile(path,'utf8'),original);
  await assert.rejects(callStudioTool('studio_edit_project',{...args,outputPath:path}),/arguments/);
  const badPath=join(dir,'bad.json');await assert.rejects(callStudioTool('studio_edit_project',{...args,outputPath:badPath,expectedRevision:edited.revision}),/revision conflict/);await assert.rejects(stat(badPath),{code:'ENOENT'});
  await assert.rejects(callStudioTool('studio_edit_project',{...args,outputPath:badPath,operations:[...args.operations,{method:'removeCondition',args:[99]}]}));await assert.rejects(stat(badPath),{code:'ENOENT'});assert.equal(await readFile(path,'utf8'),original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
