// Explicit diagnostics only; never changes production or npm-test launch flags.
import {spawn} from 'node:child_process';
import {open,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseReproductionArgs,diagnosticEnvironment,writeReproductionCheckpoint} from './reproduce-wasm-runtime.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function comparisonPlan(argv){const config=parseReproductionArgs(argv);if(config.wasmCodeGc)throw Error('Comparison selects both modes');if(config.target==='full'&&config.iterations!==1)throw Error('Full comparison permits one iteration per mode');if(config.iterations>3)throw Error('Comparison permits at most three iterations per mode');return {config,modes:['default','disabled'].map(mode=>({mode,output:config.output+'.'+mode+'.json',args:['scripts/reproduce-wasm-runtime.mjs',String(config.iterations),config.output+'.'+mode+'.json','--target='+config.target,...(config.concurrency===null?[]:['--concurrency='+config.concurrency]),'--runtime='+config.runtime,'--wasm-code-gc='+mode]}))};}
export function runDiagnosticChild(args,{timeoutMs,signal,spawnChild=spawn,graceMs=2000,closeGraceMs=2000}={}){
 return new Promise(resolveResult=>{
  const child=spawnChild(process.execPath,args,{cwd:root,env:diagnosticEnvironment(),stdio:'ignore',shell:false,windowsHide:true});let timedOut=false,cancelled=false,error,forceTimer,finalTimer,done=false;
  const finish=result=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(forceTimer);clearTimeout(finalTimer);signal?.removeEventListener('abort',abort);resolveResult({timedOut,cancelled,...(error?{error}:{}),...result});};
  const stop=()=>{try{child.kill('SIGTERM');}catch(e){error=e.message;}forceTimer=setTimeout(()=>{try{child.kill('SIGKILL');}catch(e){error=e.message;}finalTimer=setTimeout(()=>finish({code:null,signal:null,cleanupConfirmed:false}),closeGraceMs);},graceMs);};
  const abort=()=>{if(cancelled||timedOut)return;cancelled=true;stop();};
  const timer=setTimeout(()=>{if(cancelled)return;timedOut=true;stop();},timeoutMs);
  child.on('error',e=>{error=e.message;});child.on('close',(code,closedSignal)=>finish({code,signal:closedSignal,cleanupConfirmed:true}));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 });
}
export async function compareWasmRuntime(argv){
 const {config,modes}=comparisonPlan(argv),file=await open(config.output,'wx'),controller=new AbortController(),onSignal=()=>controller.abort();
 const report={schemaVersion:1,status:'running',startedAt:new Date().toISOString(),purpose:'bounded diagnostics;not root-fix/default-migration evidence',nodeOptionsRemoved:true,cleanupScope:'Owned diagnostic runner only;descendant process-tree termination is not proven',results:[]};process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
 try{await writeReproductionCheckpoint(file,report);for(const mode of modes){if(controller.signal.aborted)break;const started=Date.now(),result={mode:mode.mode,...await runDiagnosticChild(mode.args,{signal:controller.signal,timeoutMs:config.iterations*(config.target==='full'?600000:30000)+30000}),durationMs:Date.now()-started,output:mode.output};try{const detail=JSON.parse(await readFile(mode.output,'utf8'));result.status=detail.status;result.fatalSignatures=detail.results?.map(r=>({allocation:r.wasmAllocationFatal,jitPage:r.wasmJitPageFatal}));}catch{result.reportUnavailable=true;}report.results.push(result);await writeReproductionCheckpoint(file,report);if(!result.cleanupConfirmed||result.cancelled)break;}
 report.finishedAt=new Date().toISOString();report.allPassed=report.results.length===2&&report.results.every(r=>r.code===0&&!r.timedOut&&!r.cancelled&&r.cleanupConfirmed&&!r.reportUnavailable);report.status=controller.signal.aborted?'interrupted':report.allPassed?'completed':'failed';await writeReproductionCheckpoint(file,report);if(!report.allPassed)process.exitCode=1;return report;
 }finally{process.off('SIGINT',onSignal);process.off('SIGTERM',onSignal);await file.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await compareWasmRuntime(process.argv.slice(2));
