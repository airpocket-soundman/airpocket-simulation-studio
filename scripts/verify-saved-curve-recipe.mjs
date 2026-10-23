// Independent saved-file consumer: uses public fixtures and discovered MCP schema.
// No implementation modules or existing QA helpers are imported.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DOMParser} from '@xmldom/xmldom';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=fileURLToPath(new URL('../',import.meta.url));
const recipeBytes=readFileSync(process.argv[3]??path.join(root,'skills/airpocket-studio/references/increment-curve-loop.md'));
const output=path.resolve(process.argv[2]??'.qa-saved-curve-recipe');
assert.ok(!existsSync(output),'Use a new disposable output directory');mkdirSync(output,{recursive:true});
const read=name=>readFileSync(path.join(root,name));
const save=(name,value)=>writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
const inputs=['public/examples/increment-comparison-a.json','public/examples/increment-comparison-b.json'];
const source=inputs.map(file=>{const bytes=read(file);return {file,bytes:bytes.length,sha256:sha(bytes)};});
const wrapper={bundles:inputs.map(file=>JSON.parse(read(file)))};
save('input.json',wrapper);
const child=spawn(process.execPath,['scripts/studio-mcp.mjs'],{cwd:root,stdio:['pipe','pipe','pipe'],windowsHide:true});
let sequence=0,stderr='';const pending=new Map();
const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
child.stderr.on('data',bytes=>stderr=(stderr+bytes).slice(-4000));
const lines=createInterface({input:child.stdout});
lines.on('line',line=>{const response=JSON.parse(line),wait=pending.get(response.id);if(wait){clearTimeout(wait.timer);pending.delete(response.id);wait.resolve(response);}});
const request=(method,params)=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP response timeout'));},30000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const call=argumentsValue=>request('tools/call',{name:'studio_increment_curve',arguments:argumentsValue});
let report;
try{
 const initialized=await request('initialize',{protocolVersion:'2025-11-25'});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const discovery=await request('tools/list',{}),tool=discovery.result.tools.find(t=>t.name==='studio_increment_curve');
 assert.ok(tool,'Required tool absent from local repository stdio server');
 assert.ok(tool.inputSchema.properties.path);assert.ok(tool.inputSchema.properties.outputPath);
 save('discovery.json',{initialized,tool});
 const inputPath=path.join(output,'input.json'),outputPath=path.join(output,'artifacts.json');
 const firstResponse=await call({path:inputPath,outputPath,offset:0,limit:1});
 const first=firstResponse.result.structuredContent.value;
 assert.equal(first.kind,'increment-curve-comparison');
 assert.deepEqual(first.comparison.units,{extensionMm:'mm',forceN:'N',engineeringStrain:'dimensionless',engineeringStressPa:'Pa'});
 const accumulated=first.pages.map(page=>({curveId:page.curveId,curve:page.curve,steps:[],nextOffset:page.page.offset}));
 let value=first;const requests=[];
 for(;;){
  for(const [i,page] of value.pages.entries()){
   const curve=accumulated[i];assert.equal(page.curveId,curve.curveId);assert.equal(page.curveIndex,i);assert.deepEqual(page.curve,curve.curve);
   if(curve.nextOffset===null)continue;
   assert.equal(page.page.offset,curve.nextOffset);
   curve.steps.push(...page.page.steps);curve.nextOffset=page.page.nextOffset;
  }
  if(accumulated.every(curve=>curve.nextOffset===null))break;
  const offset=Math.min(...accumulated.filter(c=>c.nextOffset!==null).map(c=>c.nextOffset));requests.push(offset);
  value=(await call({path:inputPath,offset,limit:1})).result.structuredContent.value;
 }
 for(const curve of accumulated){
  assert.equal(curve.steps.length,4);assert.equal(new Set(curve.steps.map(s=>s.stepIndex)).size,4);
  const failed=curve.steps.filter(s=>s.status==='failed');assert.equal(failed.length,1);
  for(const row of failed)for(const key of ['extensionMm','tensileForceN','engineeringStressPa','engineeringStrain'])assert.equal(row[key],null);
 }
 assert.equal(accumulated[0].steps.at(-1).tensileForceN,20);assert.equal(accumulated[1].steps.at(-1).tensileForceN,40);
 assert.equal(accumulated[0].steps.at(-1).extensionMm,accumulated[1].steps.at(-1).extensionMm);
 const artifactBytes=readFileSync(outputPath),artifact=JSON.parse(artifactBytes);
 assert.equal(artifactBytes.length,first.outputBytes);assert.equal(sha(artifactBytes),first.outputSha256);
 const artifacts={};
 for(const format of ['csv','json','svg']){
  const bytes=Buffer.from(artifact[format],'utf8'),descriptor=first.artifacts[format];
  assert.equal(bytes.length,descriptor.bytes);assert.equal(sha(bytes),descriptor.sha256);
  const file=path.join(output,'comparison.'+format);writeFileSync(file,bytes);assert.equal(sha(readFileSync(file)),descriptor.sha256);artifacts[format]=descriptor;
 }
 const derived=JSON.parse(artifact.json);assert.equal(derived.kind,'increment-curve-comparison');assert.equal(derived.curves.length,2);
 // Quoted CSV parser supports doubled quotes and CRLF without splitting commas blindly.
 const records=[];let row=[],field='',quoted=false;
 for(let i=0;i<artifact.csv.length;i++){
  const char=artifact.csv[i];
  if(char==='"'){if(quoted&&artifact.csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(char===','&&!quoted){row.push(field);field='';}
  else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&artifact.csv[i+1]==='\n')i++;row.push(field);records.push(row);row=[];field='';}
  else field+=char;
 }
 if(field||row.length){row.push(field);records.push(row);}assert.equal(quoted,false);assert.equal(records.length,9);
 assert.ok(records.every(row=>row.length===records[0].length));
 const doc=new DOMParser().parseFromString(artifact.svg,'image/svg+xml');
 for(const element of doc.getElementsByTagName('*')){
  assert.notEqual(element.localName.toLowerCase(),'script');
  for(const attribute of element.attributes){assert.ok(!/^on/i.test(attribute.name));if(attribute.name!=='xmlns')assert.ok(!/(?:https?:|javascript:|data:|url\s*\()/i.test(attribute.value));}
 }
 const panels=[...doc.getElementsByTagName('g')].filter(e=>e.hasAttribute('data-panel'));assert.equal(panels.length,2);
 for(const panel of panels)for(const curve of accumulated){
  const group=[...panel.getElementsByTagName('g')].find(g=>g.getAttribute('data-curve-id')===curve.curveId);assert.ok(group);
  assert.deepEqual([...group.getElementsByTagName('circle')].map(c=>Number(c.getAttribute('data-step-index'))),[0,1,3]);
  const segments=[...group.getElementsByTagName('path')];assert.equal(segments.length,1);
  for(const segment of segments)assert.deepEqual(segment.getAttribute('data-step-indices').split(',').map(Number),[0,1]);
 }
 save('tampered.json',{...wrapper,svg:'<svg/>'});
 const refused=await call({path:path.join(output,'tampered.json'),outputPath:path.join(output,'must-not-exist.json'),offset:0,limit:1});assert.equal(refused.result.isError,true);assert.equal(existsSync(path.join(output,'must-not-exist.json')),false);
 const overwrite=await call({path:inputPath,outputPath,offset:0,limit:1});assert.equal(overwrite.result.isError,true);assert.equal(sha(readFileSync(outputPath)),first.outputSha256);
 for(const reference of source)assert.equal(sha(read(reference.file)),reference.sha256);
 report={date:'2026-10-23',baseSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),recipe:{file:'skills/airpocket-studio/references/increment-curve-loop.md',bytes:recipeBytes.length,sha256:sha(recipeBytes)},execution:'Independent fresh local repository stdio process; recipe, discovered schema and public A/B only',runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},server:initialized.result,source,requests:{initial:{offset:0,limit:1},followupOffsets:requests},curves:accumulated.map(c=>({id:c.curveId,rows:c.steps.length,failed:c.steps.filter(s=>s.status==='failed').length,inputRevision:c.curve.inputRevision,meshRevision:c.curve.meshRevision,lastForceN:c.steps.at(-1).tensileForceN,lastExtensionMm:c.steps.at(-1).extensionMm})),artifacts,savedFile:{bytes:artifactBytes.length,sha256:sha(artifactBytes)},csvRecords:records.length,svgPanels:panels.map(p=>p.getAttribute('data-panel')),refusals:{tampered:refused.result.content[0].text,existingOutput:overwrite.result.content[0].text},sourceBytesUnchanged:true,limitations:['Synthetic linear reference data; no physical accuracy or plastic-history claim','No browser pairing, downloads or open-project state inspected','Local repository server; registered connector capability not asserted','Recipe not revised during execution']};
}finally{
 child.stdin.end();const timeout=setTimeout(()=>child.kill(),5000);const closed=await exit;clearTimeout(timeout);lines.close();
 if(report){report.processExit=closed;report.stderrBytes=Buffer.byteLength(stderr);assert.equal(closed.code,0);save('report.json',report);console.log(JSON.stringify(report,null,2));}
}
