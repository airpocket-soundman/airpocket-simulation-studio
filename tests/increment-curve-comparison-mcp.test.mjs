import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readIncrementCurve,INCREMENT_CURVE_MCP_LIMITS,INCREMENT_CURVE_MCP_COMPARISON_LIMITS} from '../scripts/increment-curve-service.mjs';
import {assertMcpTools} from './fixtures/mcp-tool-contract.mjs';

const fixture=new URL('../docs/evidence/2026-10-22-resultcurve-export-bundle.json',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
async function comparisonInput(count=2){
 const base=JSON.parse(await readFile(fixture));
 return {bundles:Array.from({length:count},(_,index)=>{const bundle=structuredClone(base);bundle.spec.curveId='comparison-'+index;return bundle;})};
}

test('comparison saved-file route preserves pure artifacts and returns independently clamped tagged pages',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-compare-'));
 try{
  const bundle=await comparisonInput();bundle.bundles[0].steps=bundle.bundles[0].steps.slice(0,2);
  const path=join(dir,'input.json'),outputPath=join(dir,'output.json'),input=Buffer.from(JSON.stringify(bundle));await writeFile(path,input);
  const {createIncrementCurveComparison}=await import('../src/increment-curve-comparison.js');const expected=await createIncrementCurveComparison(bundle);
  const value=await readIncrementCurve({path,outputPath,offset:4,limit:1});
  assert.deepEqual(value.comparison.units,{extensionMm:'mm',forceN:'N',engineeringStrain:'dimensionless',engineeringStressPa:'Pa'});assert.equal(value.kind,'increment-curve-comparison');assert.equal(value.curve,undefined);assert.equal(value.page,undefined);assert.equal(value.requestedOffset,4);assert.equal(value.pages.length,2);
  assert.deepEqual(value.pages[0].page,{offset:2,limit:1,total:2,nextOffset:null,steps:[]});
  assert.equal(value.pages[1].page.offset,4);assert.equal(value.pages[1].page.nextOffset,5);assert.deepEqual(value.pages[1].page.steps,expected.comparison.curves[1].steps.slice(4,5));
  for(const [i,page]of value.pages.entries()){assert.equal(page.curveIndex,i);assert.equal(page.curveId,expected.comparison.curves[i].curveId);assert.equal(page.curve.inputRevision,expected.comparison.curves[i].inputRevision);assert.equal(page.curve.analysis.plasticHistory,false);}
  const savedBytes=await readFile(outputPath),saved=JSON.parse(savedBytes);assert.equal(saved.kind,'increment-curve-comparison-artifacts');assert.deepEqual(saved.comparison,expected.comparison);
  for(const format of ['csv','json','svg']){assert.equal(saved[format],expected[format]);assert.equal(value.artifacts[format].sha256,hash(Buffer.from(expected[format])));}
  assert.equal(value.outputSha256,hash(savedBytes));assert.equal(value.source.sha256,hash(input));assert.ok(Buffer.byteLength(JSON.stringify(value))<=65536);
  await assert.rejects(readIncrementCurve({path,outputPath}),/already exists/);await assert.rejects(readIncrementCurve({path,outputPath:path}),/distinct/);assert.deepEqual(await readFile(path),input);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('four-curve input may exceed the single limit while single input and unknown wrapper keys retain strict refusal',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-compare-limits-'));
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'output.json'),bundle=await comparisonInput(4),json=JSON.stringify(bundle),bytes=Buffer.from(json+' '.repeat(Math.max(0,INCREMENT_CURVE_MCP_LIMITS.inputBytes+1-Buffer.byteLength(json))));
  assert.ok(bytes.length>INCREMENT_CURVE_MCP_LIMITS.inputBytes);assert.ok(bytes.length<INCREMENT_CURVE_MCP_COMPARISON_LIMITS.inputBytes);await writeFile(path,bytes);
  const value=await readIncrementCurve({path,offset:Number.MAX_SAFE_INTEGER,limit:50});assert.equal(value.pages.length,4);assert.ok(value.pages.every(p=>p.page.offset===p.page.total&&p.page.steps.length===0&&p.page.nextOffset===null));
  await writeFile(path,JSON.stringify(bundle.bundles[0]));await assert.rejects(readIncrementCurve({path,offset:999}),/offset exceeds/);
  await writeFile(path,JSON.stringify(bundle.bundles[0])+' '.repeat(INCREMENT_CURVE_MCP_LIMITS.inputBytes));await assert.rejects(readIncrementCurve({path,outputPath}),/1 MiB/);await assert.rejects(stat(outputPath),{code:'ENOENT'});
  for(const bad of [{bundles:bundle.bundles.slice(0,1)},{bundles:[...bundle.bundles,bundle.bundles[0]]},{...bundle,svg:'self reported'},{bundles:[bundle.bundles[0],bundle.bundles[0]]}]){await writeFile(path,JSON.stringify(bad));await assert.rejects(readIncrementCurve({path,outputPath}));await assert.rejects(stat(outputPath),{code:'ENOENT'});}
  await writeFile(path,' '.repeat(INCREMENT_CURVE_MCP_COMPARISON_LIMITS.inputBytes+1));await assert.rejects(readIncrementCurve({path,outputPath}),/2 MiB/);await assert.rejects(stat(outputPath),{code:'ENOENT'});
  for(const [i,b]of bundle.bundles.entries())b.spec.caseIdentity.note=String(i).repeat(30000);
  await writeFile(path,JSON.stringify(bundle));await assert.rejects(readIncrementCurve({path,outputPath,limit:1}),/response exceeds/);await assert.rejects(stat(outputPath),{code:'ENOENT'});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('real stdio keeps the existing tool list and routes comparison with no browser method or argument expansion',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'studio-curve-compare-stdio-'));
 try{
  const path=join(dir,'input.json');await writeFile(path,JSON.stringify(await comparisonInput()));
  const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path,limit:1}}},{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path,unknown:true}}}];
  const child=spawnSync(process.execPath,['scripts/studio-mcp.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),input:messages.map(m=>JSON.stringify(m)).join('\n')+'\n',encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
  const replies=child.stdout.trim().split('\n').map(line=>JSON.parse(line));assertMcpTools(replies.find(m=>m.id===2).result.tools);
  const response=replies.find(m=>m.id===3).result;const valueBytes=Buffer.byteLength(JSON.stringify(response.structuredContent.value),'utf8'),rawResponseLine=child.stdout.trim().split('\n').find(line=>JSON.parse(line).id===3);assert.ok(valueBytes<=65536,'bound applies to the serialized tool data value');assert.ok(Buffer.byteLength(rawResponseLine,'utf8')>valueBytes,'raw JSON-RPC response contains duplicate representations and envelope bytes');assert.deepEqual(JSON.parse(response.content[0].text),response.structuredContent.value);assert.notEqual(response.isError,true,response.content?.[0]?.text);assert.equal(response.structuredContent.value.kind,'increment-curve-comparison');assert.equal(response.structuredContent.value.pages.length,2);assert.ok(response.structuredContent.value.pages.every(p=>p.page.steps.length===1));assert.equal(replies.find(m=>m.id===4).result.isError,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
