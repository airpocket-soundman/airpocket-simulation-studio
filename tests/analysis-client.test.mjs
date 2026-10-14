import {test} from 'node:test';import assert from 'node:assert/strict';import {createAnalysisClient} from '../src/analysis-client.js';
function harness(extra={}){const workers=[],project={sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},name:'original',version:1,study:{kind:'structural',gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:0},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:[0]}]}]},progress=[];const api=createAnalysisClient(()=>project,v=>progress.push(v),{createWorker:()=>{const w={terminated:0,terminate(){this.terminated++;},postMessage(v){this.input=v;},send(data){this.onmessage({data});}};workers.push(w);return w;},isIsolated:()=>true,baseUrl:()=>'/test/',...extra});return {api,workers,project,progress};}
test('uncloneable settings never leak a worker; nested settings are frozen at calculation start',async()=>{
 const h=harness();await assert.rejects(h.api.analyze({callback:()=>{}}));assert.ok(h.workers.every(w=>w.terminated===1));
 const options={size:2,refinements:[{center:[1,2,3],radius:5,size:1}]},promise=h.api.analyze(options),w=h.workers.at(-1);options.refinements[0].center[0]=99;w.send({result:{}});const result=await promise;assert.equal(result.calculation.options.refinements[0].center[0],1);assert.equal(w.input.options.refinements[0].center[0],1);
});
test('analysis cancellation permits restart and stale worker messages cannot finish another run',async()=>{const h=harness(),p=h.api.analyze();const cancelled=assert.rejects(p,/cancelled/);await assert.rejects(h.api.analyze(),/already running/);h.api.cancel();await cancelled;assert.equal(h.workers[0].terminated,1);const next=h.api.generateMesh({size:2});h.workers[0].send({result:{wrong:true}});h.workers[1].send({progress:'meshing'});h.project.name='edited';h.workers[1].send({result:{mesh:{nodes:[]}}});const r=await next;assert.equal(r.input.name,'original');assert.deepEqual(r.calculation,{operation:'mesh',options:{size:2,method:'wasm-pcg',adaptive:false,maxRounds:3}});assert.deepEqual(h.progress,['meshing']);assert.equal(h.workers[1].input.options.size,2);assert.equal(h.workers[1].terminated,1);});
test('timeouts, nonconvergence and memory/start failures release worker resources',async()=>{const h=harness({timeoutMs:15});await assert.rejects(h.api.analyze(),/exceeded/);assert.equal(h.workers[0].terminated,1);const p=h.api.analyze();h.workers[1].send({error:'Solver did not converge'});await assert.rejects(p,/did not converge/);assert.equal(h.workers[1].terminated,1);const q=h.api.analyze();h.workers[2].onerror({message:'Out of memory'});await assert.rejects(q,/Out of memory/);assert.equal(h.workers[2].terminated,1);const bad=harness({createWorker:()=>({terminate(){},postMessage(){throw Error('Cannot allocate memory');}})});await assert.rejects(bad.api.analyze(),/allocate/);await assert.rejects(bad.api.analyze(),/allocate/);await assert.rejects(harness({isIsolated:()=>false}).api.analyze(),/isolation/);});

test('browser job API shares the lifecycle and freezes input, retains compact observations and ignores cancelled replies',async()=>{
 const h=harness(),job=h.api.startJob({inputRevision:'browser:1',requestId:'first'});
 h.project.name='edited';await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.workers[0].input.project.name,'original');assert.equal(h.workers[0].input.observe,true);
 h.workers[0].send({event:{stage:'mesh',metrics:{nodeCount:4},mesh:{nodes:[1,2,3]}}});
 h.workers[0].send({event:{stage:'time-step',provisional:true,field:{kind:'thermal',time:1,temperature:[20,30,40,50]}}});
 const events=h.api.jobEvents(job.jobId).events;assert.equal(events.find(e=>e.stage==='mesh').meshAvailable,false);const field=events.find(e=>e.stage==='time-step');assert.equal(field.fieldAvailable,false);assert.equal(field.fieldSummary.nodeCount,4);assert.equal(field.field,undefined);assert.equal(field.inputRevision,'browser:1');
 h.workers[0].send({result:{mesh:{summary:{nodeCount:4}},result:{kind:'thermal',temperature:[20,30,40,50]}}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(h.api.getJob(job.jobId).state,'succeeded');const result=h.api.getJobResult(job.jobId);result.result.temperature[0]=999;assert.equal(h.api.getJobResult(job.jobId).result.temperature[0],20);
 h.api.releaseJob(job.jobId);assert.throws(()=>h.api.getJob(job.jobId),/Unknown job/);
 const next=h.api.startJob({inputRevision:'browser:2'});await new Promise(resolve=>setImmediate(resolve));h.api.cancel();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.api.getJob(next.jobId).state,'cancelled');h.workers[1].send({result:{wrong:true}});assert.equal(h.api.getJob(next.jobId).state,'cancelled');assert.throws(()=>h.api.getJobResult(next.jobId),/not available/);h.api.closeJobs();
});

test('browser jobs retain optional time fields, expose artifact probes, and report malformed observations without losing final output',async()=>{
 const h=harness(),job=h.api.startJob({inputRevision:'browser:fields',requestId:'fields',includeFields:true});await new Promise(resolve=>setImmediate(resolve));
 const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],summary:{nodeCount:4}};
 h.workers[0].send({event:{stage:'mesh',mesh}});
 h.workers[0].send({event:{stage:'time-step',field:{kind:'thermal',time:1,temperature:[20,30,40,50],units:{temperature:'degC'}}}});
 h.workers[0].send({event:{stage:'time-step',field:{kind:'thermal',time:2,temperature:[20],units:{temperature:'degC'}}}});
 h.workers[0].send({result:{mesh,result:{kind:'thermal',temperature:[20,30,40,50]}}});
 for(let n=0;n<100&&h.api.getJob(job.jobId).state==='running';n++)await new Promise(resolve=>setTimeout(resolve,2));
 assert.equal(h.api.getJob(job.jobId).state,'succeeded');const events=h.api.jobEvents(job.jobId).events,frame=events.find(e=>e.fieldAvailable);assert.ok(frame.artifact);assert.equal(frame.field,undefined);assert.ok(events.some(e=>e.stage==='observation-error'));
 const point=await h.api.getJobArtifact(job.jobId,frame.artifact.artifactId,{point:[.25,.25,.25]});assert.equal(point.measurement.value,35);assert.equal(h.api.getJob(job.jobId).result.intermediate.retainedArtifacts,2);
 h.api.releaseJob(job.jobId);await assert.rejects(async()=>h.api.getJobArtifact(job.jobId,frame.artifact.artifactId),/Unknown job/);h.api.closeJobs();
});
