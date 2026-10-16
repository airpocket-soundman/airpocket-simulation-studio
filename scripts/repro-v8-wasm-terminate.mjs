// Standalone diagnostic (no dependencies). Stresses the pattern reported in nodejs/node#66366:
// wasm instantiated on the main thread and in worker_threads (optionally with SHARED memory),
// tier-up triggered by a hot loop, then worker.terminate() at randomised short delays.
// It never changes solver settings or production flags; a cell with zero crashes means
// "not reproduced in N iterations", never "fixed".
//
// Single cell : node scripts/repro-v8-wasm-terminate.mjs --children=2 --iterations=50 [--shared=1] [--module=tiny|kernel] [--flags="--no-wasm-code-gc"] [--seed=1]
// Matrix      : node scripts/repro-v8-wasm-terminate.mjs --matrix --cell-seconds=60 --output=<new.json>
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';
const self=fileURLToPath(import.meta.url),root=resolve(dirname(self),'..');
// (module (import env.cb (i32)->i32) (import env.mem (memory 1 1 [shared])) (func hot(n)->i32: loop calling cb and storing to memory)), assembled with wabt.
const TINY={shared:'AGFzbQEAAAABBgFgAX8BfwIWAgNlbnYCY2IAAANlbnYDbWVtAgMBAQMCAQAHBwEDaG90AAEKKQEnAQJ/A0AgAiABEABqIQJBACACNgIAIAFBAWohASABIABJDQALIAIL',plain:'AGFzbQEAAAABBgFgAX8BfwIWAgNlbnYCY2IAAANlbnYDbWVtAgEBAQMCAQAHBwEDaG90AAEKKQEnAQJ/A0AgAiABEABqIQJBACACNgIAIAFBAWohASABIABJDQALIAIL'};
const sha256=b=>createHash('sha256').update(b).digest('hex');
const rng=seed=>{let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};};
function parse(argv){const o={};for(const a of argv){const m=/^--([\w-]+)(?:=(.*))?$/.exec(a);if(!m)throw Error('bad arg '+a);o[m[1]]=m[2]??'1';}return o;}
const kernelBytes=()=>readFileSync(resolve(root,'public/fem-kernel.wasm'));
function stubImports(module){const imports={};for(const d of WebAssembly.Module.imports(module)){imports[d.module]??={};imports[d.module][d.name]=d.kind==='function'?()=>0:d.kind==='memory'?new WebAssembly.Memory({initial:256,maximum:65536}):d.kind==='table'?new WebAssembly.Table({initial:1024,element:'anyfunc'}):0;}return imports;}
function instantiate(cfg,memory){
 if(cfg.module==='kernel'){const m=new WebAssembly.Module(kernelBytes());return {hot:null,instance:new WebAssembly.Instance(m,stubImports(m))};}
 const m=new WebAssembly.Module(Buffer.from(cfg.shared?TINY.shared:TINY.plain,'base64'));
 const instance=new WebAssembly.Instance(m,{env:{cb:x=>x&7,mem:memory}});return {instance,hot:instance.exports.hot};
}
if(!isMainThread){ // worker body: instantiate, then spin until terminated
 const {cfg}=workerData,memory=workerData.memory??new WebAssembly.Memory({initial:1,maximum:1}),{hot}=instantiate(cfg,memory);parentPort.postMessage('ready');
 if(hot)for(;;)hot(200000);else for(;;)new WebAssembly.Module(kernelBytes());
}else if(process.argv[2]==='--child'){ // child process: N iterations
 const cfg=JSON.parse(process.argv[3]);const rand=rng(cfg.seed);let done=0;
 const mk=()=>cfg.shared?new WebAssembly.Memory({initial:1,maximum:1,shared:true}):new WebAssembly.Memory({initial:1,maximum:1});
 const memory=mk(),main=instantiate(cfg,memory);
 for(let i=0;i<cfg.iterations;i++){
  if(cfg.deadline&&Date.now()>cfg.deadline)break;
  const workers=[];for(let w=0;w<cfg.workers;w++){const wk=new Worker(self,{workerData:{cfg,memory:cfg.shared?memory:null}});wk.on('error',()=>{});workers.push(wk);}
  const exited=Promise.all(workers.map(w=>new Promise(r=>w.once('exit',r))));
  if(main.hot)main.hot(100000+Math.floor(rand()*400000)); // tier-up pressure on the main thread too
  await new Promise(r=>setTimeout(r,Math.floor(rand()*cfg.maxDelayMs)));
  await Promise.all(workers.map(w=>w.terminate()));await exited;done++;
 }
 process.stdout.write('CHILD_DONE '+done+'\n');
}else{ // orchestrator
 const a=parse(process.argv.slice(2));
 const sig=/Fatal error|Check failed|allocations_\.erase|UnregisterWasmAllocation|# Fatal|FATAL/;
 async function runCell(cell){
  const cfg={shared:cell.shared?1:0,module:cell.module||'tiny',iterations:cell.iterations,workers:cell.workers||2,maxDelayMs:cell.maxDelayMs||25,seed:cell.seed||1,deadline:cell.seconds?Date.now()+cell.seconds*1000:0};
  const flags=(cell.flags||'').split(/\s+/).filter(Boolean),t0=Date.now(),results=[];
  await Promise.all(Array.from({length:cell.children},(_,k)=>new Promise(res=>{
   const c=spawn(process.execPath,[...flags,self,'--child',JSON.stringify({...cfg,seed:cfg.seed+k*7919})],{stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',err='';
   c.stdout.on('data',d=>{out+=d;});c.stderr.on('data',d=>{if(err.length<20000)err+=d;});
   const kill=setTimeout(()=>c.kill(),(cell.seconds||120)*1000+30000);
   c.on('close',(code,signal)=>{clearTimeout(kill);const m=/CHILD_DONE (\d+)/.exec(out);results.push({code,signal,iterationsDone:m?Number(m[1]):0,fatal:sig.test(err+out),stderr:err.slice(0,1500)});res();});
  })));
  const harnessErrors=results.filter(r=>r.code===1&&!r.signal&&!r.fatal),crashes=results.filter(r=>(r.code!==0||r.signal||r.fatal)&&!harnessErrors.includes(r)),total=results.reduce((s,r)=>s+r.iterationsDone,0);
  return {cell:{shared:!!cfg.shared,module:cfg.module,flags:cell.flags||'',children:cell.children,workersPerIteration:cfg.workers,maxDelayMs:cfg.maxDelayMs,iterationsPerChild:cell.iterations>1e6?null:cell.iterations,secondsBudget:cell.seconds||null},childrenRun:results.length,iterationsCompleted:total,crashes:crashes.length,harnessErrors:harnessErrors.length,harnessErrorStderr:harnessErrors[0]?.stderr??null,signatures:[...new Set(crashes.map(r=>(r.stderr.split(/\r?\n/).find(l=>sig.test(l))||('exit code '+r.code+' signal '+r.signal)).trim()))],firstCrashStderr:crashes[0]?.stderr??null,exitCodes:[...new Set(results.map(r=>r.code))],durationMs:Date.now()-t0,verdict:crashes.length?'REPRODUCED':harnessErrors.length?'harness-error':'not reproduced in '+total+' iterations'};
 }
 if(a.matrix){
  if(!a.output||existsSync(a.output))throw Error('--output=<new file> required');
  const secs=Number(a['cell-seconds']||60),kids=Math.max(1,os.cpus().length-1),cells=[];
  const add=(shared,flags,module='tiny')=>cells.push({shared,flags,module,children:kids,iterations:1e9,seconds:secs});
  add(0,'');add(1,'');add(1,'--no-wasm-code-gc');add(1,'--liftoff-only');add(1,'--no-wasm-tier-up');add(0,'--no-wasm-code-gc');add(0,'','kernel');
  const res=[];for(const c of cells){const r=await runCell(c);console.log(JSON.stringify({shared:r.cell.shared,module:r.cell.module,flags:r.cell.flags,crashes:r.crashes,iterations:r.iterationsCompleted}));res.push(r);}
  const files=['scripts/repro-v8-wasm-terminate.mjs','public/fem-kernel.wasm'].filter(f=>existsSync(resolve(root,f)));
  writeFileSync(a.output,JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,cpu:{model:os.cpus()[0]?.model,count:os.cpus().length},cellSeconds:secs,sha256:Object.fromEntries(files.map(f=>[f,sha256(readFileSync(resolve(root,f)))])),matrix:res},null,2)+'\n',{flag:'wx'});
 }else{
  const r=await runCell({shared:a.shared==='1',module:a.module,flags:a.flags,children:Number(a.children||1),iterations:Number(a.iterations||3),workers:Number(a.workers||2),maxDelayMs:Number(a['max-delay-ms']||25),seed:Number(a.seed||1)});
  console.log(JSON.stringify({schemaVersion:1,node:process.version,...r}));if(r.crashes||r.harnessErrors)process.exitCode=1;
 }
}
