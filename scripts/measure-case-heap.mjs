// Retained-heap measurement of the case store (Node, shared modules). Run with --expose-gc:
//   node --expose-gc scripts/measure-case-heap.mjs [--cases 8] [--size 1.0] [--out .qa/case-heap.json]
// For N=1..cases it saves the same solved case, forces GC and reports used/total heap and RSS, then
// does an export/import round trip and reports the heap after the transfer buffers are released.
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import v8 from 'node:v8';
import {createHost,solveCase} from './measure-case-archive-transfer.mjs';
import {getProjectRevision} from '../src/project-revision.js';
const MB=v=>Math.round(v/1048576*10)/10;
export function sample(){
 if(typeof globalThis.gc!=='function')throw Error('Run with node --expose-gc');
 globalThis.gc();globalThis.gc();
 const m=process.memoryUsage(),h=v8.getHeapStatistics();
 return {heapUsedMB:MB(m.heapUsed),externalMB:MB(m.external+m.arrayBuffers*0),rssMB:MB(m.rss),heapLimitMB:MB(h.heap_size_limit)};
}
async function main(){
 const arg=(n,f)=>{const i=process.argv.indexOf('--'+n);return i<0?f:process.argv[i+1];};
 const cases=Number(arg('cases',8)),size=Number(arg('size',1.0)),out=arg('out','.qa/case-heap.json');
 const output=await solveCase(size),oneBytes=Buffer.byteLength(JSON.stringify(output));
 const revision=await getProjectRevision(JSON.parse(JSON.stringify(output)));
 const report={task:'case-heap',node:process.version,meshSizeMm:size,singleOutputBytes:oneBytes,baseline:sample(),afterSave:[]};
 const host=createHost();host.display.value=output;let peak=0;
 for(let i=0;i<cases;i++){
  try{await host.operations.saveCurrent({name:'c'+(i+1),expectedResultRevision:revision});}catch(e){report.afterSave.push({cases:i+1,error:e.code??e.message});break;}
  await host.operations.list();peak=Math.max(peak,process.memoryUsage().rss);
  const s=sample();report.afterSave.push({cases:i+1,...s,retainedPerCaseMB:MB((s.heapUsedMB-report.baseline.heapUsedMB)*1048576/(i+1))});
 }
 const n=report.afterSave.filter(x=>!x.error).length;
 if(n){
  const t=host.transfer,begun=await t.beginExport();let offset=0;const dest=createHost();const pieces=[];
  do{const p=t.read({transferId:begun.transferId,offset});pieces.push(Buffer.from(p.data,'base64'));offset=p.nextOffset;}while(offset!==null);
  t.release({transferId:begun.transferId});
  const bytes=Buffer.concat(pieces);pieces.length=0;
  const {archiveRevision}=await dest.operations.list();
  const b=dest.transfer.beginImport({expectedArchiveRevision:archiveRevision,totalBytes:bytes.length,sha256:begun.sha256});
  for(let o=0;o<bytes.length;o+=65536)dest.transfer.write({transferId:b.transferId,offset:o,data:bytes.subarray(o,o+65536).toString('base64')});
  await dest.transfer.commit({transferId:b.transferId});dest.transfer.release({transferId:b.transferId});
  peak=Math.max(peak,process.memoryUsage().rss);
  report.afterRoundTripBothStores=sample();
 }
 report.peakRssMB=MB(peak);
 const path=resolve(out);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify(report,null,1));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
