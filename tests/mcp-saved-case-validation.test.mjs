import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const output=()=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],study:{kind:'thermal'},materialProperties:{conductivity:1}},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'thermal',engine:'Recorded thermal engine',minTemperature:20,maxTemperature:50,temperature:[20,30,40,50],flux:[[1,2,3]]}});
const identity=()=>({schemaVersion:1,target:'node',isolation:'worker-thread',build:{status:'unavailable'},engine:{requestedMethod:'pcg',actualEngine:'Recorded thermal engine'},assets:[]});

test('real MCP validates every saved case through the actual restore checks while preserving legacy comparison shape and all source bytes',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'saved-case-validation-')),child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{stdio:['pipe','pipe','pipe']}),lines=createInterface({input:child.stdout}),pending=new Map();let serial=0,stderr='';child.stderr.on('data',data=>stderr+=data);
 lines.on('line',line=>{const response=JSON.parse(line);pending.get(response.id)?.(response);});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP timeout: '+stderr));},10000);pending.set(id,response=>{clearTimeout(timer);pending.delete(id);resolve(response);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const inspect=async archive=>{const path=join(directory,`case-${serial}.json`),bytes=JSON.stringify(archive);await writeFile(path,bytes);const response=await rpc('tools/call',{name:'studio_validate_cases',arguments:{path}});assert.equal(response.error,undefined);assert.equal(await readFile(path,'utf8'),bytes);return response.result;};
 try{
  await rpc('initialize',{protocolVersion:'2025-11-25'});child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const valid=output(),archive={version:1,cases:[{name:'Valid legacy thermal',output:valid}]},result=await inspect(archive);
  assert.notEqual(result.isError,true,result.content?.[0]?.text);assert.deepEqual(result.structuredContent.value,[{name:'Valid legacy thermal',kind:'thermal',metrics:[{key:'minTemperature',unit:'°C',value:20},{key:'maxTemperature',unit:'°C',value:50}]}]);
  valid.calculation.runtimeIdentity=identity();assert.notEqual((await inspect(archive)).isError,true);
  const mutations=[o=>o.result.temperature.pop(),o=>o.result.flux[0].pop(),o=>o.mesh.tetrahedra[0]=[0,1,2,99],o=>o.mesh.tetrahedra[0]=[0,0,1,2],o=>o.mesh.surface[0].nodes[0]=99,o=>o.mesh.surface=[],o=>delete o.mesh,o=>o.calculation.runtimeIdentity=null,o=>o.calculation.runtimeIdentity.schemaVersion=2,o=>o.calculation.runtimeIdentity.engine.actualEngine='Different engine',o=>o.calculation.runtimeIdentity.engine.requestedMethod='wasm-pcg'];
  for(const [index,mutate]of mutations.entries()){
   const bad=structuredClone(valid);mutate(bad);const response=await inspect({version:1,cases:[...archive.cases,{name:`Invalid second case ${index}`,output:bad}]});assert.equal(response.isError,true,`corruption ${index}`);assert.equal(response.structuredContent?.value,undefined);
  }
  assert.notEqual((await inspect(archive)).isError,true);assert.deepEqual((await inspect({version:1,cases:[]})).structuredContent.value,[]);
  assert.equal((await readdir(directory)).length,15);
 }finally{child.kill();lines.close();await rm(directory,{recursive:true,force:true});}
});
