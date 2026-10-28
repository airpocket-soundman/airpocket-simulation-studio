// Isolated diagnostic only: never changes solver settings or production launch flags.
import {spawn,execFileSync} from 'node:child_process';
import {inspectWasmRuntimeProvenance} from './wasm-runtime-provenance.mjs';
import {open,readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,isAbsolute,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const targets=Object.freeze({'analysis-jobs':['tests/analysis-job-service.test.mjs'],'analysis-job-store':['tests/analysis-job-store.test.mjs'],'material-catalog':['tests/material-catalog.test.mjs'],'advanced-structural-source':['tests/advanced-structural-source-execution.test.mjs']});
const usage='Usage: node scripts/reproduce-wasm-runtime.mjs <iterations 1..100> <new-output.json> [--target=analysis-jobs|analysis-job-store|material-catalog|advanced-structural-source|full] [--concurrency=1..4] [--runtime=<absolute node executable>] [--wasm-code-gc=default|disabled]';
export function parseReproductionArgs(argv,{defaultRuntime=process.execPath}={}){
 if(!Array.isArray(argv)||argv.some(value=>typeof value!=='string'))throw Error(usage);const [countText,output,...flags]=argv,iterations=Number(countText);
 if(!/^\d+$/.test(countText??'')||!Number.isInteger(iterations)||iterations<1||iterations>100||!output||output.startsWith('--')||output.includes('\0'))throw Error(usage);
 let target='analysis-jobs',concurrency=null,runtime=defaultRuntime;const seen=new Set();
 for(const flag of flags){const match=/^--(target|concurrency|runtime|wasm-code-gc)=(.+)$/.exec(flag);if(!match||seen.has(match[1]))throw Error(usage);seen.add(match[1]);const [,name,value]=match;if(name==='target'){if(value!=='full'&&!Object.hasOwn(targets,value))throw Error(usage);target=value;}else if(name==='concurrency'){if(!/^[1-4]$/.test(value))throw Error(usage);concurrency=Number(value);}else if(name==='wasm-code-gc'){if(!['default','disabled'].includes(value))throw Error(usage);}else runtime=value;}
 if(typeof runtime!=='string'||!isAbsolute(runtime)||runtime.includes('\0'))throw Error('Runtime must be an absolute Node executable path');
 return {iterations,output:resolve(output),target,concurrency,runtime:resolve(runtime),...(seen.has('wasm-code-gc')?{wasmCodeGc:flags.find(f=>f.startsWith('--wasm-code-gc=')).split('=')[1]}:{})};
}
export async function selectReproductionTests(target){if(Object.hasOwn(targets,target))return [...targets[target]];if(target!=='full')throw Error('Unknown diagnostic target');return (await readdir(resolve(root,'tests'),{withFileTypes:true})).filter(entry=>entry.isFile()&&entry.name.endsWith('.test.mjs')).map(entry=>'tests/'+entry.name).sort();}
export async function writeReproductionCheckpoint(file,report){const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');let offset=0;while(offset<bytes.length){const result=await file.write(bytes,offset,bytes.length-offset,offset);if(!result.bytesWritten)throw Error('Diagnostic checkpoint write made no progress');offset+=result.bytesWritten;}await file.truncate(bytes.length);await file.sync();}
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const parentIdentity=()=>({executable:process.execPath,node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch});
export function diagnosticEnvironment(){const env={...process.env};delete env.NODE_OPTIONS;return env;}
export function queryNodeIdentity(runtime){if(typeof runtime!=='string'||!isAbsolute(runtime)||runtime.includes('\0'))throw Error('Runtime must be an absolute Node executable path');const query="JSON.stringify({executable:process.execPath,node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,release:process.release.name})",identity=JSON.parse(execFileSync(runtime,['-p',query],{env:diagnosticEnvironment(),cwd:root,encoding:'utf8',timeout:5000,maxBuffer:1000000,shell:false,windowsHide:true}).trim());if(identity.release!=='node'||!/^v\d+\./.test(identity.node)||typeof identity.v8!=='string'||!isAbsolute(identity.executable))throw Error('Selected runtime did not identify itself as Node');return identity;}
async function sourceFiles(tests){const files=new Set([...tests,'scripts/reproduce-wasm-runtime.mjs','package.json','package-lock.json','scripts/worker-runtime/gmsh/gmsh.mjs','scripts/worker-runtime/mfem/mfem.mjs']);for(const directory of ['src','scripts'])for(const entry of await readdir(resolve(root,directory),{withFileTypes:true}))if(entry.isFile()&&/\.(?:js|mjs|json)$/.test(entry.name))files.add(directory+'/'+entry.name);async function wasm(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())await wasm(path);else if(entry.isFile()&&entry.name.endsWith('.wasm'))files.add(relative(root,path).replaceAll('\\','/'));}}await wasm(resolve(root,'public'));return [...files].sort();}
export function classifyWasmFatal(text){return {wasmAllocationFatal:/jit_page_->allocations_\.erase\(addr\) == 1/.test(text),wasmJitPageFatal:/Check failed: jit_page\.has_value\(\)/.test(text)};}
export function reproductionNodeFlags(config){return config.wasmCodeGc==='disabled'?['--no-wasm-code-gc']:[];}
// cgroup counters describe this job's cgroup, not proof that a particular child was OOM-killed.
export async function readCgroupMemory({platform=process.platform,read=readFile}={}){
 const result={scope:'diagnostic runner cgroup; shared counters are not child attribution',sampledAt:new Date().toISOString(),available:false,files:{}};
 if(platform!=='linux')return {...result,reason:'not-linux'};
 try{
  const membership=await read('/proc/self/cgroup','utf8');if(membership.length>16384)throw Error();
  const entry=membership.split('\n').find(line=>line.startsWith('0::'));if(!entry)throw Error();
  const relativePath=entry.slice(3);if(!relativePath.startsWith('/')||relativePath.split('/').includes('..'))throw Error();
  const directory=resolve('/sys/fs/cgroup','.'+relativePath);
  for(const name of ['memory.events','memory.current','memory.peak','memory.max']){
   try{const raw=(await read(resolve(directory,name),'utf8')).trim();if(raw.length>16384)throw Error();
    if(name==='memory.events'){const entries=raw.split('\n').map(line=>line.trim().split(/\s+/));if(!entries.length||entries.some(e=>e.length!==2||!/^\w+$/.test(e[0])||!/^\d+$/.test(e[1])))throw Error();result.files[name]={available:true,counters:Object.fromEntries(entries)};}
    else {if(!/^(?:\d+|max)$/.test(raw))throw Error();result.files[name]={available:true,value:raw,unit:'bytes'};}
   }catch{result.files[name]={available:false,reason:'unavailable-or-invalid'};}
  }
  result.available=Object.values(result.files).some(value=>value.available);return result;
 }catch{return {...result,reason:'cgroup-v2-unavailable'};}
}
export function reproductionPassed(result){return result.code===0&&result.signal===null&&!result.timedOut&&!result.outputLimited&&!result.error;}
export async function captureReproductionChild(runtime,args,{timeoutMs,outputLimitBytesPerStream,spawnChild=spawn,onChild=()=>{}}){
 return new Promise(resolveResult=>{
  const child=spawnChild(runtime,args,{env:diagnosticEnvironment(),cwd:root,stdio:['ignore','pipe','pipe'],shell:false,windowsHide:true}),parts={stdout:[],stderr:[]},sizes={stdout:0,stderr:0};onChild(child);let timedOut=false,outputLimited=false,error;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{sizes[stream]+=chunk.length;if(sizes[stream]>outputLimitBytesPerStream){outputLimited=true;child.kill();}else parts[stream].push(chunk);});
  child.on('error',value=>{error=value.message;});child.on('close',(code,signal)=>{clearTimeout(timer);onChild(null);const stdout=Buffer.concat(parts.stdout).toString('utf8'),stderr=Buffer.concat(parts.stderr).toString('utf8');resolveResult({code,signal,timedOut,outputLimited,...(error?{error}:{}),...classifyWasmFatal(stdout+stderr),stdout,stderr});});
 });
}
export async function runWasmReproduction(config,{inspectProvenance=inspectWasmRuntimeProvenance}={}){
 const file=await open(config.output,'wx'),runtime=parentIdentity(),report={schemaVersion:1,startedAt:new Date().toISOString(),runtime,parentRuntime:{...runtime},childRuntime:null,targetName:config.target,target:config.target==='full'?'full':targets[config.target][0],targetTests:[],iterationsRequested:config.iterations,concurrency:config.concurrency,timeoutMs:config.target==='full'?600000:30000,outputLimitBytesPerStream:1000000,runtimeRequested:config.runtime,nodeOptionsPresent:!!process.env.NODE_OPTIONS,...(process.env.NODE_OPTIONS?{nodeOptionsSha256:sha256(process.env.NODE_OPTIONS)}:{}),status:'initializing',results:[]};let activeChild=null,interrupted=null;
 const stop=signal=>{interrupted=signal;activeChild?.kill();},onInt=()=>stop('SIGINT'),onTerm=()=>stop('SIGTERM');process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);
 try{
  await writeReproductionCheckpoint(file,report);report.childRuntime=queryNodeIdentity(config.runtime);Object.assign(report,await inspectProvenance({root,runtimeExecutable:config.runtime,actualRuntimeExecutable:report.childRuntime.executable,parentExecutable:process.execPath}));await writeReproductionCheckpoint(file,report);report.targetTests=await selectReproductionTests(config.target);
  report.gitHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:5000,shell:false,windowsHide:true}).trim();report.gitDirtyEntries=execFileSync('git',['status','--porcelain=v1','--untracked-files=all','-z'],{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:1000000,shell:false,windowsHide:true}).split('\0').filter(Boolean);report.sourceSha256={};
  for(const path of await sourceFiles(report.targetTests)){const candidate=resolve(root,path),sameOutput=process.platform==='win32'?candidate.toLowerCase()===config.output.toLowerCase():candidate===config.output;if(!sameOutput)report.sourceSha256[path]=sha256(await readFile(candidate));}report.sourceFingerprint='sha256:'+sha256(JSON.stringify(report.sourceSha256));
  report.flagScope={mode:config.wasmCodeGc??'default',nodeOptions:'removed from diagnostic children',testRunner:'explicit CLI flags',testWorkers:'Node test runner inherits supported execArgv',workerThreads:'inherit execArgv unless overridden',separateProcesses:'not guaranteed;spawned process must explicitly forward flags',rootFixProven:false};report.childArgv=[...reproductionNodeFlags(config),'--test','--test-reporter=tap',...(config.concurrency===null?[]:['--test-concurrency='+config.concurrency]),...report.targetTests];report.status='running';await writeReproductionCheckpoint(file,report);
  for(let iteration=1;iteration<=config.iterations&&!interrupted;iteration++){
   report.activeIteration={iteration,startedAt:new Date().toISOString(),cgroupBefore:await readCgroupMemory()};await writeReproductionCheckpoint(file,report);if(interrupted){delete report.activeIteration;break;}const started=Date.now(),result={iteration,cgroupBefore:report.activeIteration.cgroupBefore,...await captureReproductionChild(config.runtime,report.childArgv,{timeoutMs:report.timeoutMs,outputLimitBytesPerStream:report.outputLimitBytesPerStream,onChild:child=>{activeChild=child;}}),durationMs:Date.now()-started,cgroupAfter:await readCgroupMemory()};
   report.results.push(result);delete report.activeIteration;await writeReproductionCheckpoint(file,report);console.log(JSON.stringify({iteration,code:result.code,signal:result.signal,timedOut:result.timedOut,wasmAllocationFatal:result.wasmAllocationFatal}));if(!reproductionPassed(result))break;
  }
  report.finishedAt=new Date().toISOString();report.allPassed=!interrupted&&report.results.length===config.iterations&&report.results.every(reproductionPassed);report.status=interrupted?'interrupted':report.allPassed?'completed':'failed';if(interrupted)report.interruptedBy=interrupted;await writeReproductionCheckpoint(file,report);if(!report.allPassed)process.exitCode=1;return report;
 }catch(error){report.status='failed';report.finishedAt=new Date().toISOString();report.error=error.message;await writeReproductionCheckpoint(file,report);throw error;}finally{process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);await file.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runWasmReproduction(parseReproductionArgs(process.argv.slice(2)));
