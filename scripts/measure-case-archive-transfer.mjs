// Deterministic Node benchmark of the case-archive transfer path (shared modules only;
// no browser, no network). Reports per-chunk export-read / import-write time, caseList and
// caseSave time as the store grows, and commit time. Single machine, n=1 per run: a measurement, not a guarantee.
// Usage: node scripts/measure-case-archive-transfer.mjs [--cases 4] [--size 1.0] [--out .qa/case-archive-transfer-performance.json]
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {analyzeProject} from './headless-analysis.mjs';
import {KIND_BUILDERS} from './measure-case-bundle-capacity.mjs';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createCaseArchiveTransfer} from '../src/case-archive-transfer.js';
import {getProjectRevision} from '../src/project-revision.js';

const now=()=>performance.now(),round=v=>Math.round(v*100)/100,CHUNK=65536;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
/** Build a host with the same shared modules the page wires in src/main.js. */
export function createHost(){
 const store=createCaseStore(),display={value:null};let n=0;
 const operations=createCaseOperations({store,getAnalysis:()=>display.value,id:()=>'case-'+(++n)});
 return {store,display,operations,transfer:createCaseArchiveTransfer({cases:operations,id:()=>'transfer-'+(++n)})};
}
export async function solveCase(size){
 const {project}=KIND_BUILDERS.elastic.build();
 const output=await analyzeProject(project,{size});
 // Wall-clock solve time is the only run-to-run difference; pin it so archive bytes/hash are reproducible.
 if(output.result?.performance?.solveMs!==undefined)output.result.performance.solveMs=1;
 // The runtime identity fingerprints the source tree, so it changes with every source edit; pin it for stable goldens.
 const build=output.calculation?.runtimeIdentity?.build;if(build?.sourceFingerprint)build.sourceFingerprint='sha256:'+'1'.repeat(64);
 return output;
}
export function quartiles(times){
 const q=Math.max(1,Math.floor(times.length/4));
 return {firstQuarterMeanMs:round(mean(times.slice(0,q))),lastQuarterMeanMs:round(mean(times.slice(-q))),firstMs:round(times[0]),middleMs:round(times[Math.floor(times.length/2)]),lastMs:round(times.at(-1)),meanMs:round(mean(times)),totalMs:round(times.reduce((s,v)=>s+v,0)),count:times.length};
}
// CPU time (user+system of this process) is reported next to wall time because wall time is noisy on a shared machine.
const cpu=()=>{const u=process.cpuUsage();return (u.user+u.system)/1000;};
export async function fillStore(host,output,count,timings){
 host.display.value=output;const revision=await getProjectRevision(JSON.parse(JSON.stringify(output)));
 for(let i=0;i<count;i++){
  let t=now(),c=cpu();await host.operations.saveCurrent({name:`large case ${i+1}`,expectedResultRevision:revision});const saveMs=now()-t,saveCpuMs=cpu()-c;
  t=now();c=cpu();await host.operations.list();const listMs=now()-t,listCpuMs=cpu()-c;
  timings?.push({casesAfterSave:i+1,saveMs:round(saveMs),saveCpuMs:round(saveCpuMs),listMs:round(listMs),listCpuMs:round(listCpuMs)});
 }
}
/** Export every chunk then import into a fresh host; returns bytes, hash and per-chunk timings. */
export async function roundTrip(source,destination){
 const r={};let t=now();
 let c=cpu();const begun=await source.transfer.beginExport();r.beginExportMs=round(now()-t);r.beginExportCpuMs=round(cpu()-c);
 const readTimes=[],pieces=[];let offset=0;
 do{t=now();const page=source.transfer.read({transferId:begun.transferId,offset});readTimes.push(now()-t);pieces.push(Buffer.from(page.data,'base64'));offset=page.nextOffset;}while(offset!==null);
 const bytes=Buffer.concat(pieces),sha256='sha256:'+createHash('sha256').update(bytes).digest('hex');
 if(sha256!==begun.sha256||bytes.length!==begun.totalBytes)throw Error('Export does not match its declared hash');
 source.transfer.release({transferId:begun.transferId});
 const {archiveRevision}=await destination.operations.list();
 t=now();const begin=destination.transfer.beginImport({expectedArchiveRevision:archiveRevision,totalBytes:bytes.length,sha256});r.beginImportMs=round(now()-t);
 const writeTimes=[];
 for(let o=0;o<bytes.length;o+=CHUNK){const data=bytes.subarray(o,o+CHUNK).toString('base64');t=now();destination.transfer.write({transferId:begin.transferId,offset:o,data});writeTimes.push(now()-t);}
 t=now();c=cpu();const result=await destination.transfer.commit({transferId:begin.transferId});r.commitMs=round(now()-t);r.commitCpuMs=round(cpu()-c);
 destination.transfer.release({transferId:begin.transferId});
 return {...r,bytes,sha256,archiveRevision:begun.archiveRevision,restoredRevision:result.archiveRevision,chunkCount:readTimes.length,readTimes,writeTimes,read:quartiles(readTimes),write:quartiles(writeTimes)};
}
async function main(){
 const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
 const cases=Number(arg('cases',4)),size=Number(arg('size',1.0)),out=arg('out','.qa/case-archive-transfer-performance.json');
 const started=now(),report={task:'case-archive-transfer-performance',scope:'node; shared modules; not browser UI, not network, not connector polling',node:process.version,platform:`${process.platform} ${process.arch}`,meshSizeMm:size,cases};
 let t=now();const output=await solveCase(size);report.solveMs=round(now()-t);report.singleOutputBytes=Buffer.byteLength(JSON.stringify(output));
 const source=createHost(),growth=[];t=now();await fillStore(source,output,cases,growth);report.fillMs=round(now()-t);report.storeGrowth=growth;
 const destination=createHost(),trip=await roundTrip(source,destination);
 report.archiveBytes=trip.bytes.length;report.archiveSha256=trip.sha256;report.archiveRevision=trip.archiveRevision;report.restoredRevisionMatches=trip.restoredRevision===trip.archiveRevision;report.chunkCount=trip.chunkCount;
 report.beginExportMs=trip.beginExportMs;report.beginExportCpuMs=trip.beginExportCpuMs;report.commitCpuMs=trip.commitCpuMs;report.beginImportMs=trip.beginImportMs;report.commitMs=trip.commitMs;report.exportRead=trip.read;report.importWrite=trip.write;
 report.perChunkSamples={readMs:trip.readTimes.filter((_,i)=>i%Math.max(1,Math.floor(trip.chunkCount/20))===0).map(round),writeMs:trip.writeTimes.filter((_,i)=>i%Math.max(1,Math.floor(trip.chunkCount/20))===0).map(round)};
 report.totalMs=round(now()-started);
 const path=resolve(out);await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify({...report,storeGrowth:undefined,perChunkSamples:undefined,storeGrowthSummary:growth},null,1));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
