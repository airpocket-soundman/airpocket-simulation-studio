// Isolated diagnostic only: never changes solver settings or production launch flags.
import {spawn,execFileSync} from 'node:child_process';
import {open,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),target='tests/analysis-job-service.test.mjs';
const [countText,output,...extra]=process.argv.slice(2),iterations=Number(countText);
if(extra.length||!/^\d+$/.test(countText??'')||!Number.isInteger(iterations)||iterations<1||iterations>100||!output)throw Error('Usage: node scripts/reproduce-wasm-runtime.mjs <iterations 1..100> <new-output.json>');
const destination=resolve(output),file=await open(destination,'wx');
try{
 const sources=['scripts/headless-analysis.mjs','scripts/headless-worker.mjs','scripts/analysis-job-service.mjs','src/analysis-jobs.js',target],sourceSha256={};
 for(const path of sources)sourceSha256[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
 const report={schemaVersion:1,startedAt:new Date().toISOString(),runtime:{executable:process.execPath,node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:5000}).trim(),sourceSha256,target,iterationsRequested:iterations,timeoutMs:30000,outputLimitBytesPerStream:1000000,results:[]};
 for(let iteration=1;iteration<=iterations;iteration++){
  const started=Date.now(),result=await new Promise(resolveResult=>{
   const child=spawn(process.execPath,['--test',target],{cwd:root,stdio:['ignore','pipe','pipe']}),parts={stdout:[],stderr:[]},sizes={stdout:0,stderr:0};let timedOut=false,outputLimited=false,error;
   const timer=setTimeout(()=>{timedOut=true;child.kill();},report.timeoutMs);
   for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{sizes[stream]+=chunk.length;if(sizes[stream]>report.outputLimitBytesPerStream){outputLimited=true;child.kill();}else parts[stream].push(chunk);});
   child.on('error',value=>{error=value.message;});child.on('close',(code,signal)=>{clearTimeout(timer);const stdout=Buffer.concat(parts.stdout).toString('utf8'),stderr=Buffer.concat(parts.stderr).toString('utf8');resolveResult({iteration,code,signal,durationMs:Date.now()-started,timedOut,outputLimited,...(error?{error}:{}),wasmAllocationFatal:/jit_page_->allocations_\.erase\(addr\) == 1/.test(stdout+stderr),stdout,stderr});});
  });
  report.results.push(result);console.log(JSON.stringify({iteration,code:result.code,timedOut:result.timedOut,wasmAllocationFatal:result.wasmAllocationFatal}));
  if(result.code!==0||result.timedOut||result.outputLimited||result.error)break;
 }
 report.finishedAt=new Date().toISOString();report.allPassed=report.results.length===iterations&&report.results.every(r=>r.code===0&&!r.timedOut&&!r.outputLimited&&!r.error);
 await file.writeFile(JSON.stringify(report,null,2)+'\n');if(!report.allPassed)process.exitCode=1;
}finally{await file.close();}
