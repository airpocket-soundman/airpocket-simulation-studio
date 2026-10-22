import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,rm,stat,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readIncrementCurve,INCREMENT_CURVE_MCP_LIMITS} from '../scripts/increment-curve-service.mjs';
import {assertMcpTools} from './fixtures/mcp-tool-contract.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=new URL('../docs/evidence/2026-10-22-resultcurve-export-bundle.json',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');

test('saved-file curve API preserves verified artifacts and input; publications are exclusive and pages are bounded',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-'));
 try{
  const input=await readFile(fixture),path=join(dir,'input.json'),outputPath=join(dir,'artifacts.json');await writeFile(path,input);
  const {createIncrementCurveArtifacts}=await import('../src/increment-curve-export.js');
  const expected=await createIncrementCurveArtifacts(JSON.parse(input));
  const response=await readIncrementCurve({path,outputPath,offset:1,limit:2});
  assert.equal(response.kind,'increment-curve');assert.equal(response.source.sha256,hash(input));assert.equal(response.source.bytes,input.length);
  assert.deepEqual(response.page.steps,expected.curve.steps.slice(1,3));assert.equal(response.page.nextOffset,3);assert.equal(response.page.total,expected.curve.steps.length);
  assert.equal(response.curve.analysis.plasticHistory,false);assert.equal(response.curve.steps,undefined);
  const savedBytes=await readFile(outputPath),saved=JSON.parse(savedBytes);
  for(const format of ['csv','json','svg']){assert.equal(saved[format],expected[format]);assert.equal(response.artifacts[format].sha256,hash(Buffer.from(expected[format])));assert.equal(response.artifacts[format].bytes,Buffer.byteLength(expected[format]));}
  assert.deepEqual(saved.curve,expected.curve);assert.equal(response.outputSha256,hash(savedBytes));assert.equal(response.outputBytes,savedBytes.length);
  assert.ok(Buffer.byteLength(JSON.stringify(response))<=INCREMENT_CURVE_MCP_LIMITS.responseBytes);
  await assert.rejects(readIncrementCurve({path,outputPath}),/already exists/);await assert.rejects(readIncrementCurve({path,outputPath:path}),/distinct/);
  assert.deepEqual(await readFile(path),input);assert.deepEqual(await readFile(outputPath),savedBytes);
  assert.deepEqual((await readdir(dir)).sort(),['artifacts.json','input.json']);
  const empty=await readIncrementCurve({path,offset:expected.curve.steps.length,limit:1});assert.deepEqual(empty.page.steps,[]);assert.equal(empty.page.nextOffset,null);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('curve refusal never publishes output and rejects unknown arguments, unsafe pages, malformed data and overlarge sources',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-refuse-'));
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'output.json');await writeFile(path,await readFile(fixture));
  for(const extra of [{limit:0},{limit:51},{offset:-1},{offset:1.5},{offset:Number.MAX_SAFE_INTEGER+1},{unknown:true},{outputPath:path},{outputPath:'relative.json'}])await assert.rejects(readIncrementCurve({path,outputPath,...extra}));
  const oversized=JSON.parse(await readFile(fixture));oversized.spec.caseIdentity.note='x'.repeat(64500);await writeFile(path,JSON.stringify(oversized));
  await assert.rejects(readIncrementCurve({path,outputPath}),/response exceeds/);await assert.rejects(stat(outputPath),{code:'ENOENT'});
  await writeFile(path,'{"spec":{},"steps":[]}');await assert.rejects(readIncrementCurve({path,outputPath}));await assert.rejects(stat(outputPath),{code:'ENOENT'});
  await writeFile(path,'x'.repeat(INCREMENT_CURVE_MCP_LIMITS.inputBytes+1));await assert.rejects(readIncrementCurve({path,outputPath}),/1 MiB/);await assert.rejects(stat(outputPath),{code:'ENOENT'});
  await mkdir(join(dir,'directory'));await assert.rejects(readIncrementCurve({path:join(dir,'directory'),outputPath}));
  assert.ok(!(await readdir(dir)).some(name=>name.endsWith('.tmp')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('real stdio discovery and curve calls use bounded formal schemas and the same saved-file service',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-stdio-'));
 try{
  const path=join(dir,'source.json'),outputPath=join(dir,'curve.json'),bundle=JSON.parse(await readFile(fixture));bundle.spec.curveId='=SUM(1,2)<script>alert(1)</script>';await writeFile(path,JSON.stringify(bundle));
  const messages=[
   {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},
   {jsonrpc:'2.0',method:'notifications/initialized'},
   {jsonrpc:'2.0',id:2,method:'tools/list'},
   {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path,outputPath,limit:1}}},
   {jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path,limit:51}}},
   {jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path,outputPath}}}
  ];
  const child=spawnSync(process.execPath,['scripts/studio-mcp.mjs'],{cwd:root,input:messages.map(m=>JSON.stringify(m)).join('\n')+'\n',encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
  assert.ifError(child.error);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
  const replies=child.stdout.trim().split('\n').map(line=>JSON.parse(line)),tools=replies.find(m=>m.id===2).result.tools;assertMcpTools(tools);
  const declared=tools.find(t=>t.name==='studio_increment_curve');assert.equal(declared.inputSchema.additionalProperties,false);assert.equal(declared.inputSchema.properties.limit.maximum,50);assert.equal(declared.annotations.readOnlyHint,false);assert.equal(declared.annotations.destructiveHint,false);
  const response=replies.find(m=>m.id===3).result;assert.notEqual(response.isError,true,response.content?.[0]?.text);assert.equal(response.structuredContent.value.page.steps.length,1);assert.ok(Buffer.byteLength(JSON.stringify(response.structuredContent.value))<=65536);
  assert.equal(replies.find(m=>m.id===4).result.isError,true);assert.equal(replies.find(m=>m.id===5).result.isError,true);
  const saved=JSON.parse(await readFile(outputPath));assert.equal(saved.curve.analysis.plasticHistory,false);assert.equal(saved.kind,'increment-curve-artifacts');assert.match(saved.csv,/"'=SUM/);assert.ok(!saved.svg.includes('<script>'));assert.ok(saved.svg.includes('&lt;script&gt;'));
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('published files remain successful and response stays bounded after an injected large cleanup warning',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-warning-'));
 try{
  const path=join(dir,'source.json'),outputPath=join(dir,'artifacts.json');await writeFile(path,await readFile(fixture));
  const {publishJson}=await import('../scripts/json-artifacts.mjs');
  const value=await readIncrementCurve({path,outputPath},{publish:async(...args)=>({...await publishJson(...args),cleanupWarning:{code:'ARTIFACT_TEMP_CLEANUP_FAILED',path:'\u0001'.repeat(100000),message:'\u0002'.repeat(100000)}})});
  assert.equal(value.cleanupWarning.detailsTruncated,true);assert.equal(value.cleanupWarning.pathOmitted,true);assert.equal(value.cleanupWarning.path,undefined);assert.equal(value.cleanupWarning.pathPreview.length,128);assert.equal(value.cleanupWarning.message.length,128);
  assert.ok(Buffer.byteLength(JSON.stringify(value))<=65536);const saved=await readFile(outputPath);assert.equal(value.outputSha256,hash(saved));assert.equal(JSON.parse(saved).kind,'increment-curve-artifacts');
 }finally{await rm(dir,{recursive:true,force:true});}
});
