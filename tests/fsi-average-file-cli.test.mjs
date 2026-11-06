import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {Worker} from 'node:worker_threads';
import {mkdtemp,writeFile,readFile,rm,readdir,realpath,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,dirname,basename} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {spawnSync,spawn} from 'node:child_process';
import {writeFsiAverageFiles,parseFsiAverageArgs} from '../scripts/fsi-average-file-service.mjs';
import {runChannelAverageForce} from '../src/fsi-channel-average-force.js';
const cli=fileURLToPath(new URL('../scripts/run-fsi-average.mjs',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const input=()=>({schemaVersion:1,method:'time-averaged-midpoint',fluid:{cellsY:4,height:1,density:1,kinematicViscosity:.1},plate:{mass:.5,stiffness:2},initialDisplacement:.1,dt:.01,steps:2,microsteps:1});
async function setup(t,p=input()){
 const parent=await realpath(tmpdir()),dir=await mkdtemp(join(parent,'fsi-average-file-'));assert.equal(dirname(dir),parent);assert(basename(dir).startsWith('fsi-average-file-'));t.after(()=>rm(dir,{recursive:true,force:true}));const paths={request:join(dir,'request.json'),output:join(dir,'result.json')};await writeFile(paths.request,JSON.stringify(p));return {dir,paths,input:p};
}
function invoke(p){const r=spawnSync(process.execPath,[cli,'--request',p.request,'--output',p.output],{encoding:'utf8',timeout:15000,maxBuffer:65536});assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.stderr,'');return {...r,summary:JSON.parse(r.stdout)};}
async function load(p,summary){const bytes=await readFile(p.output);assert.equal(bytes.length,summary.outputBytes);assert.equal(hash(bytes),summary.outputSha256);return JSON.parse(bytes);}
async function absent(path){await assert.rejects(readFile(path),e=>e.code==='ENOENT');}
const encoded=p=>{const r=runChannelAverageForce(p);r.profile=Array.from(r.profile);return r;};
const immediate=()=>new Promise(resolve=>setImmediate(resolve));

test('real CLI runs actual solver in an exited owned worker; input SHA, array profile, independent scalar oracle and compact summary match',async t=>{
 const {paths,input:p}=await setup(t),before=await readFile(paths.request),r=invoke(paths),a=await load(paths,r.summary);assert.equal(r.status,0);assert.equal(a.worker.executionSettled,true);assert.equal(a.worker.exitCode,0);assert.equal(a.methodVersion,1);assert.equal(a.synthetic,true);assert.equal(a.calibrated,false);assert.equal(a.source.sha256,hash(before));assert.equal(a.source.bytes,before.length);assert(Array.isArray(a.result.profile));assert.deepEqual(a.result,encoded(p));assert.deepEqual(await readFile(paths.request),before);assert(Buffer.byteLength(JSON.stringify(r.summary))<4096);
 // One-step analytic SSP-RK3 diffusion response under a constant wall speed.
 const dy=.25,c=.1/dy**2,h=.01,topResponse=2*c*h-3*c*c*h*h+10*c**3*h**3/3,slope=-.8*(1-topResponse/2),V=-.2/(100+.01-slope);
 assert(Math.abs(a.result.history[1].wallVelocity-V)<1e-14);assert.equal(a.profileRepresentation,'finite-number-array-m/s');
});

test('public service runs from an inline ESM host without inheriting incompatible input-type/eval flags',async t=>{
 const {paths}=await setup(t),url=new URL('../scripts/fsi-average-file-service.mjs',import.meta.url).href,script=`import {writeFsiAverageFiles} from ${JSON.stringify(url)};console.log(JSON.stringify(await writeFsiAverageFiles(${JSON.stringify(paths)})));`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:15000,maxBuffer:65536});assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');const summary=JSON.parse(r.stdout);assert.equal(summary.worker.exitCode,0);await load(paths,summary);
});

test('largest 4097-row history fits a real 4MiB artifact under the same bounded cell work',async t=>{
 const p={...input(),steps:4096,dt:.00001},s=await setup(t,p),summary=await writeFsiAverageFiles(s.paths),a=await load(s.paths,summary);assert.equal(a.result.history.length,4097);assert.equal(a.result.work.cellStepsUpperBound,196608);assert(summary.outputBytes<4194304);assert(summary.outputBytes>3000000);assert.equal(summary.worker.exitCode,0);assert.equal(summary.worker.executionSettled,true);t.diagnostic(JSON.stringify({historyRows:a.result.history.length,artifactBytes:summary.outputBytes,cellSteps:a.result.work.cellStepsUpperBound}));
});

test('strict JSON/version/capacity and path refusals leave inputs and destinations intact without completed files',async t=>{
 const {dir,paths}=await setup(t),normal=await readFile(paths.request,'utf8');
 for(const [i,raw]of [normal.replace('"schemaVersion":1','"schemaVersion":1,"schema\\u0056ersion":1'),normal.replace('"dt":0.01','"dt":1e999'),'['.repeat(8)+'0'+']'.repeat(8),Buffer.from([0xff]),'\ufeff'+normal,normal.padEnd(65537,' '),JSON.stringify({...input(),claimedResult:{private:'do-not-copy'}}),JSON.stringify({...input(),steps:4097})].entries()){
  await writeFile(paths.request,raw);const q={...paths,output:join(dir,'refused'+i+'.json')},r=invoke(q);assert.equal(r.status,1);assert.equal(r.summary.status,'error');assert.equal(JSON.stringify(r.summary).includes('do-not-copy'),false);assert.equal('stack'in r.summary,false);await absent(q.output);assert.deepEqual(await readFile(paths.request),Buffer.from(raw));
  if(i===3){assert.equal(r.summary.code,'PRINTED_IDENTIFICATION_UTF8');assert.equal(r.summary.source.sha256,hash(Buffer.from([0xff])));}
 }
 await writeFile(paths.request,normal);await writeFile(paths.output,'existing');assert.equal(invoke(paths).status,1);assert.equal(await readFile(paths.output,'utf8'),'existing');assert.throws(()=>parseFsiAverageArgs(['--request',paths.request,'--output',paths.request]));assert.throws(()=>parseFsiAverageArgs(['--request',paths.request,'--timeout','1']));
 let getters=0;await assert.rejects(writeFsiAverageFiles({get request(){getters++;return paths.request;},output:join(dir,'getter.json')}));assert.equal(getters,0);await absent(join(dir,'getter.json'));assert.deepEqual((await readdir(dir)).filter(n=>n.endsWith('.tmp')),[]);
});

test('a completion message cannot publish before worker exit, and late messages cannot republish',async t=>{
 const {paths}=await setup(t);let child,created;const ready=new Promise(resolve=>created=resolve),result=encoded(input());
 const pending=writeFsiAverageFiles(paths,{timeoutMs:1000},{createWorker(){child=new EventEmitter();child.terminate=()=>{throw Error('normal completion must not terminate');};created();queueMicrotask(()=>child.emit('message',{type:'completed',result}));return child;}});await ready;await immediate();await absent(paths.output);child.emit('exit',0);const summary=await pending;assert.equal(summary.worker.exitCode,0);const before=await readFile(paths.output);child.emit('message',{type:'completed',result});assert.deepEqual(await readFile(paths.output),before);
});

test('timeout retains ownership until termination resolves and the exit event is observed',async t=>{
 const {paths}=await setup(t);let child,terminateCalled,finish,finished=false;const stopping=new Promise(resolve=>terminateCalled=resolve);
 const pending=writeFsiAverageFiles(paths,{timeoutMs:5},{createWorker(){child=new EventEmitter();child.terminate=()=>{terminateCalled();return new Promise(resolve=>finish=()=>resolve(1));};return child;}}).then(()=>{finished=true;throw Error('unexpected success');},e=>{finished=true;return e;});
 await stopping;assert.equal(finished,false);await absent(paths.output);finish();await immediate();assert.equal(finished,false);child.emit('exit',1);const error=await pending;assert.equal(error.code,'FSI_AVERAGE_FILE_TIMEOUT');assert.equal(finished,true);await absent(paths.output);
});

test('real worker cancellation waits for actual thread exit; pre-aborted calls never spawn',async t=>{
 const {dir,paths}=await setup(t);const controller=new AbortController();let owned,exitSeen=false;
 await assert.rejects(writeFsiAverageFiles(paths,{signal:controller.signal},{createWorker(url,opts){owned=new Worker(url,opts);owned.once('exit',()=>exitSeen=true);setImmediate(()=>controller.abort());return owned;}}),e=>e.code==='FSI_AVERAGE_FILE_CANCELLED');assert.equal(exitSeen,true);assert.equal(owned.threadId,-1);await absent(paths.output);
 let spawns=0;const early=new AbortController();early.abort();await assert.rejects(writeFsiAverageFiles({...paths,output:join(dir,'early.json')},{signal:early.signal},{createWorker(){spawns++;}}));assert.equal(spawns,0);
});

test('actual unexpected worker stdout/stderr is privately drained and refused after owned termination',async t=>{
 const {dir,paths}=await setup(t);for(const stream of ['stdout','stderr']){let owned,exitSeen=false;const q={...paths,output:join(dir,stream+'.json')};await assert.rejects(writeFsiAverageFiles(q,{}, {createWorker(url,opts){assert.equal(opts.stdout,true);assert.equal(opts.stderr,true);owned=new Worker(new URL('./fixtures/fsi-average-worker-output.mjs',import.meta.url),{...opts,workerData:{stream}});owned.once('exit',()=>exitSeen=true);return owned;}}),e=>e.code==='FSI_AVERAGE_FILE_WORKER_OUTPUT');assert.equal(exitSeen,true);assert.equal(owned.threadId,-1);await absent(q.output);}
});

test('dense finite protocol rejects null/sparse/nonnumeric/missing data, invalid work and duplicate null messages',async t=>{
 const {dir,paths}=await setup(t);let getterCalls=0;
 const mutations=[r=>r.profile.fill(null),r=>delete r.profile[0],r=>r.profile[0]='0',r=>delete r.history[1],r=>delete r.history[1].d,r=>r.history[1].d=null,r=>r.history[1].d=NaN,r=>r.work.cellStepsUpperBound=-1,r=>delete r.work.cellStepsUpperBound,r=>r.work.responseSolves=0,r=>Object.defineProperty(r.history[1],'d',{enumerable:true,get(){getterCalls++;return 1;}})];
 for(let i=0;i<mutations.length;i++){const r=encoded(input());mutations[i](r);const q={...paths,output:join(dir,'malformed'+i+'.json')};await assert.rejects(writeFsiAverageFiles(q,{}, {createWorker(){const c=new EventEmitter();c.terminate=async()=>{c.emit('exit',1);return 1;};queueMicrotask(()=>{c.emit('message',{type:'completed',result:r});c.emit('exit',0);});return c;}}),e=>e.code==='FSI_AVERAGE_FILE_RESULT');await absent(q.output);}
 assert.equal(getterCalls,0);let terminated=0;const q={...paths,output:join(dir,'duplicate.json')};await assert.rejects(writeFsiAverageFiles(q,{}, {createWorker(){const c=new EventEmitter();c.terminate=async()=>{terminated++;c.emit('exit',1);return 1;};queueMicrotask(()=>{c.emit('message',null);c.emit('message',{type:'completed',result:encoded(input())});});return c;}}),e=>e.code==='FSI_AVERAGE_FILE_PROTOCOL');assert.equal(terminated,1);await absent(q.output);
});

test('two real CLI publishers have one complete artifact owner and no temporary leftovers',async t=>{
 const {dir,paths}=await setup(t),one=()=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,[cli,'--request',paths.request,'--output',paths.output]);let stdout='',stderr='';c.stdout.on('data',b=>stdout+=b);c.stderr.on('data',b=>stderr+=b);c.once('error',reject);c.once('close',(code,signal)=>resolve({code,signal,stdout,stderr}));});const rows=await Promise.all([one(),one()]);assert.deepEqual(rows.map(r=>r.code).sort(),[0,1]);assert(rows.every(r=>r.signal===null&&r.stderr===''));await load(paths,JSON.parse(rows.find(r=>r.code===0).stdout));assert.match(JSON.parse(rows.find(r=>r.code===1).stdout).code,/OUTPUT_EXISTS$/);assert.deepEqual((await readdir(dir)).filter(n=>n.endsWith('.tmp')),[]);
});

test('saved worker service declarations preserve explicit files, JSON profile and uncalibrated result',()=>{
 const compiler=fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url)),fixture=fileURLToPath(new URL('./fixtures/fsi-average-file-types.ts',import.meta.url));const r=spawnSync(process.execPath,[compiler,'--strict','--noEmit','--skipLibCheck','false','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','',fixture],{encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stdout+r.stderr);
});
