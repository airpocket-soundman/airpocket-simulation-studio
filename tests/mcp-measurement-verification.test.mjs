import {createMeasurementHistory} from '../src/measurement-history.js';
import {createResultViewApi} from '../src/result-view-api.js';
import {prepareCaseView} from '../src/case-view.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {getProjectRevision} from '../src/project-revision.js';
const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[]},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[0]}});
test('real MCP recomputes saved measurement evidence and rejects tampering without changing either source file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-case-bundle-')),child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let id=0,stderr='';child.stderr.on('data',v=>stderr+=v);
 lines.on('line',line=>{const message=JSON.parse(line);pending.get(message.id)?.(message);});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('MCP timeout '+stderr));},10000);pending.set(key,message=>{clearTimeout(timer);pending.delete(key);resolve(message);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
 const call=async args=>{const response=await rpc('tools/call',{name:'studio_verify_measurements',arguments:args});assert.equal(response.error,undefined);return response.result;},value=result=>{assert.notEqual(result.isError,true,result.content?.[0]?.text);return result.structuredContent.value;};
 try{
  await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');const tools=(await rpc('tools/list',{})).result.tools;assert.equal(tools.length,29);assert.equal(tools.find(t=>t.name==='studio_verify_measurements').annotations.readOnlyHint,true);
  const raw=output(),cases={version:1,cases:[{name:'Synthetic reference',output:raw}]},analysis=prepareCaseView(cases.cases[0]),state={field:'stress',modeIndex:null,frameIndex:null,deformScale:1,surface:true,surfaceWire:false,volumeWire:false,section:false,colorRange:null,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40}},resultView=createResultViewApi({getAnalysis:()=>analysis,get:()=>state,set(){}}),history=createMeasurementHistory({resultView});
  await history.save({name:'日本語の点測定',expectedResultRevision:(await resultView.get()).resultRevision,expectedArchiveRevision:(await history.list()).archiveRevision,point:[.1,.1,.1]});const measurements=(await history.exportArchive()).archive;
  const casesPath=join(dir,'cases.json'),measurementsPath=join(dir,'measurements.json'),caseBytes=JSON.stringify(cases),measurementBytes=JSON.stringify(measurements);await writeFile(casesPath,caseBytes);await writeFile(measurementsPath,measurementBytes);const before=await readdir(dir),proof=value(await call({casesPath,measurementsPath}));
  assert.equal(proof.verified,true);assert.equal(proof.physicalAccuracyVerified,false);assert.equal(proof.verification,'recomputed-from-saved-results');assert.equal(proof.caseCount,1);assert.equal(proof.measurementCount,1);assert.equal(proof.matches[0].measurementId,measurements.measurements[0].id);assert.deepEqual(proof.matches[0].caseIndexes,[0]);assert.equal(proof.matches[0].evidence,undefined);assert.equal(proof.measurements,undefined);assert.ok(JSON.stringify(proof).length<2000);assert.deepEqual(await readdir(dir),before);assert.equal(await readFile(casesPath,'utf8'),caseBytes);assert.equal(await readFile(measurementsPath,'utf8'),measurementBytes);assert.equal((await history.get({measurementId:measurements.measurements[0].id})).independentlyVerified,false);
  const rawRevision=await getProjectRevision(raw),changes=[archive=>archive.measurements[0].evidence.vonMisesPa=42,archive=>{const record=archive.measurements[0];record.resultRevision='sha256:'+'0'.repeat(64);record.evidence.resultRevision=record.resultRevision;},archive=>archive.measurements[0].evidence.display.field='temperature',archive=>archive.measurements[0].evidence.weights=[.25,.25,.25,.25],archive=>{const record=archive.measurements[0];record.resultRevision=rawRevision;record.evidence.resultRevision=record.resultRevision;}];
  for(let index=0;index<changes.length;index++){const bad=structuredClone(measurements);changes[index](bad);const path=join(dir,'bad-'+index+'.json'),bytes=JSON.stringify(bad);await writeFile(path,bytes);assert.equal((await call({casesPath,measurementsPath:path})).isError,true,'corruption '+index);assert.equal(await readFile(path,'utf8'),bytes);assert.equal(await readFile(casesPath,'utf8'),caseBytes);}
  assert.equal((await call({casesPath:'relative.json',measurementsPath})).isError,true);assert.equal((await call({casesPath,measurementsPath,outputPath:join(dir,'forbidden.json')})).isError,true);assert.equal(await readFile(measurementsPath,'utf8'),measurementBytes);
 }finally{child.kill();lines.close();await rm(dir,{recursive:true,force:true});}
});
