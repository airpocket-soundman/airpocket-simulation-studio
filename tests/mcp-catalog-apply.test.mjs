import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {getProjectRevision} from '../src/project-operations.js';
test('real MCP atomically applies versioned catalog material with attributed applicability and explicit assumptions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-catalog-apply-')),child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0,stderr='';child.stderr.on('data',v=>stderr+=v);
 lines.on('line',line=>{const message=JSON.parse(line);pending.get(message.id)?.(message);});
 const request=(method,params)=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout '+stderr));},10000);pending.set(key,message=>{clearTimeout(timer);pending.delete(key);resolve(message);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 const call=async(name,args)=>{const response=await request('tools/call',{name,arguments:args});assert.equal(response.error,undefined);return response.result;};
 const value=result=>{assert.notEqual(result.isError,true,result.content?.[0]?.text);return result.structuredContent.value;};
 try{
  await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'catalog-apply-test',version:'1'}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const schema=(await request('tools/list')).result.tools.find(t=>t.name==='studio_edit_project').inputSchema;assert.ok(schema.properties.operations.items.properties.method.enum.includes('applyCatalogMaterial'));
  const path=join(dir,'input.json');value(await call('studio_create_builtin_project',{source:{kind:'box',bounds:[0,0,0,10,10,40]},outputPath:path}));
  const input=JSON.parse(await readFile(path,'utf8'));input.analysisIntent={mode:'exploratory'};input.materialProperties={youngModulus:5999e6,poissonRatio:.35};input.inputProvenance={schemaVersion:1,entries:[{pointer:'/materialProperties/youngModulus',value:5999e6,source:{kind:'user-input'},rationale:'Previous material specimen',status:'confirmed',applicability:'Previous material only',assumption:'Previous material only',confirmation:{by:'user',note:'Previous material only'}},{pointer:'/study/gravityEnabled',value:false,source:{kind:'user-input'},rationale:'User disabled gravity',status:'confirmed',applicability:'This study',assumption:null}]};await writeFile(path,JSON.stringify(input));
  const original=await readFile(path,'utf8'),inspection=value(await call('studio_inspect_project',{path})),catalog=value(await call('studio_material_catalog',{id:'rtp-105-cc'}));
  const options={id:'rtp-105-cc',expectedCatalogVersion:catalog.version,poissonRatio:.35,isotropicApproximation:true,allowExperimental:false,applicability:'Room-temperature static exploratory comparison; creep and molding direction omitted.'};
  const operation={method:'applyCatalogMaterial',args:[options]},outputPath=join(dir,'catalog.json'),args={path,outputPath,expectedRevision:inspection.revision,operations:[operation]},applied=value(await call('studio_edit_project',args)),saved=JSON.parse(await readFile(outputPath,'utf8')),material=saved.materialProperties;
  assert.equal(applied.revision,await getProjectRevision(saved));assert.equal(value(await call('studio_inspect_project',{path:outputPath})).revision,applied.revision);assert.notEqual(applied.revision,inspection.revision);
  assert.equal(material.catalogSelection.catalogVersion,catalog.version);assert.equal(material.catalogSelection.applicability,options.applicability);assert.equal(material.catalogSelection.poissonRatioOrigin,'user-assumption');assert.equal(material.youngModulus,5999e6);assert.equal(material.poissonRatio,.35);assert.deepEqual(material.catalogSelection.conditions,catalog.material.conditions);assert.deepEqual(material.catalogSelection.missing,catalog.material.missing);assert.deepEqual(material.catalogSelection.source,catalog.material.source);assert.equal(material.conductivity,undefined);
  assert.deepEqual(saved.analysisIntent,input.analysisIntent);const expectedProvenance=structuredClone(input.inputProvenance);expectedProvenance.entries[0].status='unconfirmed';expectedProvenance.entries[0].assumption=null;delete expectedProvenance.entries[0].confirmation;assert.deepEqual(saved.inputProvenance,expectedProvenance);assert.deepEqual(saved.inputProvenance.entries[1],input.inputProvenance.entries[1]);assert.deepEqual(saved.conditions,input.conditions);assert.equal(await readFile(path,'utf8'),original);
  // Applying catalog data to a project with no provenance never invents confirmation or intent.
  const bare=join(dir,'bare.json'),bareOut=join(dir,'bare-catalog.json');value(await call('studio_create_builtin_project',{source:{kind:'box',bounds:[0,0,0,1,1,1]},outputPath:bare}));const bareRevision=value(await call('studio_inspect_project',{path:bare})).revision;value(await call('studio_edit_project',{...args,path:bare,outputPath:bareOut,expectedRevision:bareRevision}));const bareSaved=JSON.parse(await readFile(bareOut,'utf8'));assert.equal(bareSaved.inputProvenance,undefined);assert.equal(bareSaved.analysisIntent,undefined);
  let n=0;for(const patch of [{options:{expectedCatalogVersion:'stale'}},{expectedRevision:'sha256:'+'0'.repeat(64)},{options:{applicability:undefined}},{options:{id:'sabic-patent-e10',allowExperimental:false}},{operations:[operation,{method:'removeCondition',args:[999]}]}]){
   const failedPath=join(dir,'refused-'+(++n)+'.json'),command={...args,outputPath:failedPath,...patch};delete command.options;if(patch.options)command.operations=[{method:'applyCatalogMaterial',args:[{...options,...patch.options}]}];assert.equal((await call('studio_edit_project',command)).isError,true,JSON.stringify(patch));await assert.rejects(stat(failedPath),{code:'ENOENT'});assert.equal(await readFile(path,'utf8'),original);
  }
  assert.equal((await call('studio_edit_project',args)).isError,true);assert.deepEqual(JSON.parse(await readFile(outputPath,'utf8')),saved);
  assert.equal((await call('studio_edit_project',{...args,outputPath:path})).isError,true);assert.equal(await readFile(path,'utf8'),original);
 }finally{child.kill();lines.close();await rm(dir,{recursive:true,force:true});}
});
