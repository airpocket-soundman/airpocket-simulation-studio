import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import {createStudioApi} from '../src/studio-api.js';
import {validatePlanarRegion,planarRegionFromEuler,planarCorners,planarCoordinates} from '../src/planar-region.js';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const spec={axis:2,position:40,min:[-1,-1],max:[1,1],rotationDegrees:[0,0,45]};
function project(){const geometry=new BoxGeometry(20,20,40).toNonIndexed();geometry.translate(0,0,20);const positions=Array.from(geometry.attributes.position.array);geometry.dispose();return {version:1,sourceModel:{kind:'box',bounds:[-10,-10,0,20,20,40]},meshes:[{positions,faceIds:Array.from({length:positions.length/9},(_,i)=>Math.floor(i/2))}],conditions:[],study:{kind:'structural'},materialProperties:{youngModulus:1e9,poissonRatio:0}};}

test('explicit planar rotation requires its matching frame and failed API edits preserve all input state',()=>{
 const api=createStudioApi();api.loadProject(project());api.selectTriangles(0,[0]);const before=api.exportProject();
 for(const descriptor of [spec,{...spec,rotationDegrees:[0,0,0]},{...spec,frame:null},{...spec,rotationDegrees:null}]){assert.throws(()=>validatePlanarRegion(descriptor),/matching saved frame/);assert.throws(()=>api.selectPlanarRegion(0,descriptor),/matching saved frame/);assert.deepEqual(api.exportProject(),before);}
 const rotated=planarRegionFromEuler(2,40,[0,0,45],[-1,-1],[1,1]),bad=structuredClone(rotated);bad.frame.u=[1,0,0];assert.throws(()=>api.selectPlanarRegion(0,bad));assert.deepEqual(api.exportProject(),before);
 api.selectPlanarRegion(0,rotated);assert.deepEqual(api.exportProject().planarRegion,{...rotated,mesh:0});
 const corners=planarCorners(rotated);assert.ok(Math.abs(corners[0][0])<1e-12);assert.ok(Math.abs(corners[0][1]+Math.sqrt(2))<1e-12);assert.ok(corners.every(p=>Math.abs(planarCoordinates(rotated,p).distance)<1e-12));
 const axis={axis:2,position:40,min:[-1,-1],max:[1,1]};assert.equal(validatePlanarRegion(axis),axis);const frameOnly={frame:rotated.frame,min:rotated.min,max:rotated.max};assert.equal(validatePlanarRegion(frameOnly),frameOnly);
});

test('actual MCP refuses silently ignored planar rotation atomically, while GUI rotation previews and commits unchanged',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'planar-rotation-')),child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let serial=0,stderr='';child.stderr.on('data',data=>stderr+=data);lines.on('line',line=>{const response=JSON.parse(line);pending.get(response.id)?.(response);});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP timeout '+stderr));},10000);pending.set(id,response=>{clearTimeout(timer);pending.delete(id);resolve(response);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const call=async(name,args)=>(await rpc('tools/call',{name,arguments:args})).result;
 try{
  await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const api=createStudioApi();api.loadProject(project());const original=JSON.stringify(api.exportProject()),path=join(directory,'input.json'),outputPath=join(directory,'output.json');await writeFile(path,original);
  const expectedRevision=(await call('studio_inspect_project',{path})).structuredContent.value.revision,operations=[{method:'selectPlanarRegion',args:[0,spec]}];
  for(const name of ['studio_preview_edit','studio_edit_project']){const response=await call(name,{path,expectedRevision,operations,...(name==='studio_edit_project'?{outputPath}:{})});assert.equal(response.isError,true);assert.match(response.content[0].text,/matching saved frame/);assert.equal(await readFile(path,'utf8'),original);assert.deepEqual(await readdir(directory),['input.json']);}
  const rotated=planarRegionFromEuler(2,40,[0,0,45],[-1,-1],[1,1]);operations[0].args[1]=rotated;
  const preview=await call('studio_preview_edit',{path,expectedRevision,operations});assert.notEqual(preview.isError,true,preview.content?.[0]?.text);
  const applied=await call('studio_edit_project',{path,outputPath,expectedRevision,expectedResultingRevision:preview.structuredContent.value.revision,operations});assert.notEqual(applied.isError,true,applied.content?.[0]?.text);const saved=JSON.parse(await readFile(outputPath,'utf8'));assert.deepEqual(saved.planarRegion,JSON.parse(JSON.stringify({...rotated,mesh:0})));assert.equal(await readFile(path,'utf8'),original);
 }finally{child.kill();lines.close();await rm(directory,{recursive:true,force:true});}
});
