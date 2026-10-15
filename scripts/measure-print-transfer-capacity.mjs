// Node-side capacity/peak-memory measurement of the shared print-transfer module.
// Scope: node; shared module; not browser heap, not network.
// Usage: node scripts/measure-print-transfer-capacity.mjs [--out .qa/print-capacity.json] [--scale 1] [--only name,name] [--sweep bytes,bytes (extra 3MF sizes)]
// Each scenario runs in its own child process (--expose-gc) so peak RSS is per scenario.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import os from 'node:os';
import {DOMParser} from '@xmldom/xmldom';
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {createPrintTransfer} from '../src/print-transfer.js';
import {createPrintOperations} from '../src/print-operations.js';
import {getProjectRevision} from '../src/project-revision.js';

export const SCOPE='node; shared module; not browser heap, not network';
export const LIMITS={chunkBytes:65536,maxImportBytes:50000000,maxGcodeTextChars:25000000,maxSegments:200000,maxExportBytes:100000000,sharedRetentionBytes:100000000,maxTransfers:4};
const CHUNK=LIMITS.chunkBytes;
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const parseXml=text=>new DOMParser({onError:(_l,m)=>{throw Error(m);}}).parseFromString(text,'application/xml');

// ASCII G-code of exactly targetBytes bytes with `segments` deposition moves, padded by comment lines.
export function buildGcode(targetBytes,segments){
 const head=['G21','G90','M83','G0 X0 Y0 Z0.2'],lines=head.slice();
 for(let i=0;i<segments;i++){
  if(i%1000===0){lines.push('; layer_number: '+(i/1000),'G0 Z'+(0.2+0.2*(i/1000)).toFixed(3));}
  lines.push('G1 X'+((i%2)*10)+' Y'+((i/1000|0)%50)+' E0.05 F1800');
 }
 let text=lines.join('\n')+'\n';
 if(text.length>targetBytes)throw Error('target too small for segments');
 const filler='; filler '+'x'.repeat(190)+'\n';
 const room=targetBytes-text.length,full=Math.floor(room/filler.length);
 const parts=[text,filler.repeat(full)];let rest=room-full*filler.length;
 if(rest>0)parts.push(rest>=2?';'+' '.repeat(rest-1):' ');
 text=parts.join('');
 if(text.length!==targetBytes)throw Error('gcode size mismatch '+text.length+' vs '+targetBytes);
 return text;
}
const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r" Target="/3D/m.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
const model='<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>';
// Stored (uncompressed) 3MF whose total archive size is exactly targetBytes.
export function build3mf(targetBytes,gcodeBytes,segments){
 const make=(plate,pad)=>zipSync({'_rels/.rels':strToU8(rels),'3D/m.model':strToU8(model),'Metadata/plate_1.gcode':plate,'Metadata/padding.bin':Uint8Array.from({length:pad},(_,i)=>i%251)},{level:0});
 const probe=make(strToU8('G1'),1000).length,pad=targetBytes-gcodeBytes-(probe-2-1000);
 if(pad<1)throw Error('3MF target too small');
 const out=make(strToU8(buildGcode(gcodeBytes,segments)),pad);
 if(out.length!==targetBytes)throw Error('3mf size mismatch '+out.length+' vs '+targetBytes);
 return out;
}
function harness(){
 let snapshot=null,view={viewId:'plate:0',allLayers:true,layerIndex:0};
 const prints=createPrintOperations({getSnapshot:()=>snapshot,commit:s=>{snapshot=s;},getView:()=>view,setView:s=>view=s,isBusy:()=>false,parseXml});
 return {prints,transfer:createPrintTransfer({prints})};
}
const mem=()=>{const m=process.memoryUsage();return {heapUsed:m.heapUsed,rss:m.rss};};
function sampler(){
 const s={peakHeap:0,peakRss:0,samples:0};
 const take=()=>{const m=mem();s.samples++;if(m.heapUsed>s.peakHeap)s.peakHeap=m.heapUsed;if(m.rss>s.peakRss)s.peakRss=m.rss;};
 const timer=setInterval(take,2);take();
 return {take,stop(){take();clearInterval(timer);return s;}};
}
const tick=()=>new Promise(r=>setImmediate(r));
async function expectReject(fn){try{await fn();}catch(e){return e.message;}return null;}

// spec: {name,kind:'roundtrip',format,bytes,segments,gcodeBytes?}
//     | {name,kind:'refuse',format:'gcode',bytes,segments,expect:regex-source,at:'commit'|'begin'}
//     | {name,kind:'retention'}
export async function runScenario(spec){
 const rec={name:spec.name,kind:spec.kind,format:spec.format??null,requestedBytes:spec.bytes??null,status:'fail'};
 const t0=performance.now();let probe;
 try{
  if(spec.kind==='retention'){
   const {transfer}=harness(),meta=n=>({expectedRevision:null,format:'gcode',filename:'a.gcode',totalBytes:n,sha256:'sha256:'+'0'.repeat(64)});
   const a=transfer.beginImport(meta(50000000)),b=transfer.beginImport(meta(50000000));
   const message=await expectReject(async()=>transfer.beginImport(meta(1)));
   transfer.release({transferId:a.transferId});transfer.release({transferId:b.transferId});transfer.clear();
   rec.refusal={message,matched:/byte budget exceeded/.test(message??'')};rec.status=rec.refusal.matched?'refused-as-expected':'fail';
   rec.wallMs=performance.now()-t0;return rec;
  }
  if(spec.kind==='refuse'&&spec.at==='begin'){
   const {transfer}=harness(),message=await expectReject(async()=>transfer.beginImport({expectedRevision:null,format:spec.format,filename:'over.'+spec.format,totalBytes:spec.bytes,sha256:'sha256:'+'0'.repeat(64)}));
   rec.refusal={message,matched:new RegExp(spec.expect).test(message??'')};rec.status=rec.refusal.matched?'refused-as-expected':'fail';
   rec.wallMs=performance.now()-t0;return rec;
  }
  // payload generation
  const g0=performance.now();let bytes,segments=spec.segments;
  if(spec.format==='gcode')bytes=Buffer.from(buildGcode(spec.bytes,segments),'latin1');
  else bytes=build3mf(spec.bytes,spec.gcodeBytes,segments);
  const input=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.length),inputHash=sha(input);
  rec.generateMs=performance.now()-g0;rec.bytes=input.length;
  if(globalThis.gc){gc();gc();}
  rec.baselineHeapUsedBytes=process.memoryUsage().heapUsed;rec.baselineRssBytes=process.memoryUsage().rss;
  const {prints,transfer}=harness();probe=sampler();
  const phase=async(name,fn)=>{const s=performance.now();const v=await fn();probe.take();rec[name+'Ms']=performance.now()-s;await tick();return v;};
  const entry=transfer.beginImport({expectedRevision:null,format:spec.format,filename:'cap.'+spec.format,totalBytes:input.length,sha256:inputHash});
  rec.chunks=0;
  await phase('upload',async()=>{for(let o=0;o<input.length;o+=CHUNK){transfer.write({transferId:entry.transferId,offset:o,data:Buffer.from(input.subarray(o,o+CHUNK)).toString('base64')});rec.chunks++;if(rec.chunks%64===0){probe.take();await tick();}}});
  if(spec.kind==='refuse'){
   const message=await expectReject(()=>transfer.commit({transferId:entry.transferId}));
   rec.refusal={message,matched:new RegExp(spec.expect).test(message??'')};
   transfer.clear();rec.status=rec.refusal.matched?'refused-as-expected':'fail';
  }else{
   const result=await phase('commit',()=>transfer.commit({transferId:entry.transferId}));
   rec.expectedSegments=segments-1;rec.loaded=result.loaded===true;rec.segments=result.views.filter(v=>v.viewId.startsWith('plate:')).reduce((n,v)=>n+v.segmentCount,0);rec.layers=result.views.find(v=>v.viewId==='plate:0')?.layerCount;
   const exp=await phase('beginExport',()=>transfer.beginExport({expectedRevision:result.revision}));
   rec.exportBytes=exp.totalBytes;rec.exportChunks=0;const parts=[];
   await phase('read',async()=>{let off=0;for(;;){const page=transfer.read({transferId:exp.transferId,offset:off});parts.push(Buffer.from(page.data,'base64'));rec.exportChunks++;if(rec.exportChunks%64===0){probe.take();await tick();}if(page.nextOffset===null)break;off=page.nextOffset;}});
   const restored=Buffer.concat(parts);parts.length=0;
   await phase('verify',async()=>{rec.exportHashMatch=sha(restored)===exp.sha256;rec.revisionMatch=await getProjectRevision(JSON.parse(restored))===result.revision;});
   rec.exportBytesMatch=restored.length===exp.totalBytes;
   transfer.release({transferId:exp.transferId});transfer.clear();
   rec.status=rec.loaded&&rec.exportHashMatch&&rec.revisionMatch&&rec.exportBytesMatch&&rec.segments===segments-1?'pass':'fail';
  }
 }catch(error){rec.error=String(error?.stack??error).slice(0,2000);rec.status='fail';}
 if(probe){const s=probe.stop();rec.peakHeapUsedBytesSampled=s.peakHeap;rec.peakRssBytesSampled=s.peakRss;rec.samples=s.samples;}
 rec.peakRssBytes=process.resourceUsage().maxRSS*1024;
 rec.wallMs=performance.now()-t0;
 return rec;
}

export function defaultSpecs(scale=1,sweep=[]){
 const s=n=>Math.max(1000,Math.floor(n*scale)),seg=n=>Math.max(10,Math.floor(n*scale));
 return [
  {name:'gcode-max-25MB',kind:'roundtrip',format:'gcode',bytes:s(25000000),segments:seg(200000),limit:'effective G-code parser limit 25000000 chars, 200000 segments'},
  {name:'3mf-max-50MB',kind:'roundtrip',format:'3mf',bytes:s(50000000),gcodeBytes:s(24900000),segments:seg(200000),limit:'3MF archive limit 50000000 bytes, plate G-code 200000 segments'},
  {name:'over-gcode-parser-25MB+1',kind:'refuse',format:'gcode',bytes:s(25000000)+1,segments:seg(1000),at:'commit',expect:'25 MB',limit:'G-code text > 25000000 chars'},
  {name:'over-gcode-segments',kind:'refuse',format:'gcode',bytes:seg(200001)*30+1000,segments:seg(200000)+2,at:'commit',expect:'segment limit exceeded',limit:'more than 200000 deposition segments'},
  {name:'over-input-50MB+1',kind:'refuse',format:'3mf',bytes:50000001,at:'begin',expect:'Invalid print import metadata',limit:'totalBytes > 50000000'},
  ...sweep.map(n=>{const g=Math.min(24900000,Math.floor(n/2));return {name:'3mf-sweep-'+n,kind:'roundtrip',format:'3mf',bytes:n,gcodeBytes:g,segments:Math.min(200000,Math.floor(g/150)),limit:'3MF size sweep below the 50000000-byte archive limit'};}),
  {name:'shared-retention-100MB',kind:'retention',limit:'two 50000000-byte transfers fill 100000000 retention budget; a third is refused'}
 ];
}
export function assembleReport(records,{scale=1}={}){
 const passing=records.filter(r=>r.status==='pass'),all=records.every(r=>r.status==='pass'||r.status==='refused-as-expected');
 return {schemaVersion:1,scope:SCOPE,generatedAt:new Date().toISOString(),status:all&&scale===1?'complete':(all?'scaled':'partial'),scale,
  runtime:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model??null,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},
  limits:LIMITS,method:'Each scenario runs in a fresh child process (node --expose-gc). Uses createPrintTransfer + createPrintOperations (same modules the browser/MCP use): beginImport, 64 KiB base64 write chunks, SHA-256 verified commit (parse), beginExport, 64 KiB read chunks, SHA-256 and project-revision comparison. heapUsed high-water is sampled by a 2 ms timer and at phase/chunk boundaries (a lower bound; synchronous parser spans are not sampled). peakRssBytes is the OS process high-water (process.resourceUsage().maxRSS) and includes payload generation.',
  largestPassingBytes:passing.reduce((m,r)=>Math.max(m,r.bytes??0),0),
  largestPassingBytesByFormat:Object.fromEntries(['gcode','3mf'].map(f=>[f,passing.filter(r=>r.format===f).reduce((m,r)=>Math.max(m,r.bytes??0),0)])),
  findings:records.filter(r=>r.status==='fail').map(r=>r.name+' ('+(r.bytes??r.requestedBytes)+' bytes): '+String(r.error??'unexpected result').split(/\r?\n/)[0]),scenarios:records};
}
function child(name,scale,sweep){
 const spec=defaultSpecs(scale,sweep).find(s=>s.name===name);
 return runScenario(spec).then(r=>{process.stdout.write('\n@@RESULT@@'+JSON.stringify({...r,limit:spec.limit})+'\n');});
}
async function main(){
 const argv=process.argv.slice(2),arg=(k,d)=>{const i=argv.indexOf(k);return i<0?d:argv[i+1];};
 const scale=Number(arg('--scale','1'));
 const sweep=arg('--sweep','').split(',').filter(Boolean).map(Number);
 if(argv.includes('--child'))return child(arg('--child'),scale,sweep);
 const out=resolve(arg('--out','.qa/print-capacity.json')),only=arg('--only','')?.split(',').filter(Boolean);
 const self=fileURLToPath(import.meta.url),records=[];
 for(const spec of defaultSpecs(scale,sweep)){
  if(only?.length&&!only.includes(spec.name))continue;
  console.error('running',spec.name);
  const run=spawnSync(process.execPath,['--expose-gc',self,'--child',spec.name,'--scale',String(scale),'--sweep',sweep.join(',')],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:Number(arg('--timeout-ms','600000'))});
  const m=/@@RESULT@@(.*)/.exec(run.stdout??'');
  records.push(m?JSON.parse(m[1]):{name:spec.name,kind:spec.kind,status:'fail',limit:spec.limit,error:'child exited '+(run.status??run.signal)+': '+(run.stderr??'').slice(-1500)});
  console.error(' ->',records.at(-1).status,records.at(-1).wallMs?.toFixed?.(0)+'ms');
 }
 const report=assembleReport(records,{scale});
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log(out+' status='+report.status);
 process.exitCode=report.status==='complete'||report.status==='scaled'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main();
