import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {encodeFiniteViscoInputHistory as encode,replayFiniteViscoInputHistory as replay} from '../src/finite-visco-history.js';
import {initFiniteViscoReference as init,stepFiniteViscoReference as step} from '../src/finite-visco-reference.js';
const I=[[1,0,0],[0,1,0],[0,0,1]],model='synthetic-green-lagrange-maxwell-reference-v1',parameters={bulkModulusPa:2e6,equilibriumShearModulusPa:1e6,branchShearModulusPa:5e5,relaxationTimeSeconds:2};
const shear=e=>{const p=Math.sqrt(1+2*e),m=Math.sqrt(1-2*e);return [[(p+m)/2,(p-m)/2,0],[(p-m)/2,(p+m)/2,0],[0,0,1]];};
const history=()=>({schemaVersion:1,model,kind:'finite-visco-input-history',synthetic:true,provisional:true,calibrated:false,units:{time:'s',deformationGradient:'dimensionless'},parameters:{...parameters},steps:[{F:shear(.005),dtSeconds:1},{F:shear(.005),dtSeconds:2},{F:I,dtSeconds:1},{F:shear(-.003),dtSeconds:.7}]});
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const rejects=(raw,code='FINITE_VISCO_HISTORY_INVALID_INPUT')=>assert.rejects(replay(raw),e=>e.code===code);

test('input-only encoding and replay reproduce every final issued state field from independent direct calls',async()=>{
 const input=history(),before=JSON.stringify(input),saved=await encode(input),result=await replay(saved.json);assert.equal(saved.constitutiveVerified,false);assert.equal(result.completed,true);assert.equal(result.meaning,'input-history-replay-from-I-Z0');let state=init({synthetic:true,provisional:true,calibrated:false,parameters});for(const entry of input.steps)state=step({state,...entry}).state;assert.deepEqual(result.finalState,state);assert.deepEqual(result.summary.finalObservation.F,state.F);assert.equal(result.summary.finalTimeSeconds,4.7);assert.equal(result.canonicalIdentity,saved.canonicalIdentity);assert.equal(result.rawIdentity,sha(saved.json));assert.equal(JSON.stringify(input),before);assert.equal(saved.bytes,Buffer.byteLength(saved.json));assert.equal(result.observations,undefined);assert.equal(JSON.parse(saved.json).finalState,undefined);assert.ok(Object.isFrozen(result.summary.finalObservation.S[0]));
});

test('raw bytes and canonical identity distinguish representation from semantic input order',async()=>{
 const h=history(),a=JSON.stringify(h),reordered={steps:h.steps,parameters:h.parameters,units:h.units,calibrated:false,provisional:true,synthetic:true,kind:h.kind,model,schemaVersion:1},b=JSON.stringify(reordered,null,2),ra=await replay(a),rb=await replay(b);assert.notEqual(ra.rawIdentity,rb.rawIdentity);assert.equal(ra.canonicalIdentity,rb.canonicalIdentity);assert.deepEqual(ra.finalState,rb.finalState);const changed=history();changed.steps[0].dtSeconds=2;assert.notEqual((await replay(JSON.stringify(changed))).canonicalIdentity,ra.canonicalIdentity);
});

test('bytes and input objects snapshot before hash awaits; mutation cannot split identity from replay',async()=>{
 const h=history(),source=new TextEncoder().encode(JSON.stringify(h)),before=source.slice(),pending=replay(source);source.fill(32);const result=await pending;assert.equal(result.rawIdentity,sha(before));assert.equal(result.completed,true);assert.equal(result.summary.finalTimeSeconds,4.7);const input=history(),encoded=encode(input);input.steps[0].F[0][0]=999;input.parameters.bulkModulusPa=0;const saved=await encoded;assert.equal((await replay(saved.json)).completed,true);
});

test('semantic step failures report exact index/completed count and never expose a final state or interpolated rows',async()=>{
 for(const patch of [{dtSeconds:0},{dtSeconds:-1},{dtSeconds:1e-7},{dtSeconds:2e6+1},{F:[[2,0,0],[0,1,0],[0,0,1]]},{F:[[-1,0,0],[0,1,0],[0,0,1]]}]){const h=history();Object.assign(h.steps[2],patch);const raw=JSON.stringify(h),bytes=new TextEncoder().encode(raw),before=bytes.slice(),r=await replay(bytes);assert.equal(r.completed,false);assert.equal(r.failure.code,'FINITE_VISCO_HISTORY_STEP_REJECTED');assert.equal(r.failure.stepIndex,2);assert.equal(r.failure.completedSteps,2);assert.equal(r.finalState,undefined);assert.equal(r.summary,undefined);assert.equal(r.observations,undefined);assert.equal(r.rawIdentity,sha(raw));assert.deepEqual(bytes,before);}
 const h=history();h.parameters.bulkModulusPa=0;const r=await replay(JSON.stringify(h));assert.equal(r.failure.code,'FINITE_VISCO_HISTORY_PARAMETERS_REJECTED');assert.equal(r.failure.stepIndex,null);assert.equal(r.finalState,undefined);
});

test('claimed state, stress, cumulative outputs, versions, flags, units and unknown fields are never imported',async()=>{
 for(const change of [h=>h.state={},h=>h.Z=I,h=>h.steps[0].stress=I,h=>h.steps[0].cumulativeWorkDensity=1,h=>h.finalState={},h=>h.schemaVersion=2,h=>h.model='j2-isotropic',h=>h.synthetic=false,h=>h.provisional=false,h=>h.calibrated=true,h=>h.units.time='ms',h=>h.parameters.extra=1,h=>h.steps[0].timeSeconds=1]){const h=history();change(h);await rejects(JSON.stringify(h));await assert.rejects(encode(h));}
});

test('strict UTF8/JSON refuses nonfinite exponents, huge integers, duplicate keys, trailing syntax and malformed bytes',async()=>{
 const raw=JSON.stringify(history());for(const bad of [raw.replace('"dtSeconds":1','"dtSeconds":1e999'),raw.replace('"dtSeconds":1','"dtSeconds":9007199254740992'),raw+'x',raw.replace('"schemaVersion":1','"schemaVersion":01'),'\ufeff'+raw,'{"x":NaN}'])await rejects(bad);
 await rejects(raw.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'),'FINITE_VISCO_HISTORY_DUPLICATE_KEY');await rejects(new Uint8Array([0xff,0xfe]));await rejects(raw+'\ud800');
});

test('byte boundary accepts exactly 1MiB whitespace-padded valid inputs and refuses one extra byte without changing source',async()=>{
 const raw=JSON.stringify(history()),max=1048576,exact=raw+' '.repeat(max-Buffer.byteLength(raw)),bytes=new TextEncoder().encode(exact),r=await replay(bytes);assert.equal(r.sourceBytes,max);assert.equal(r.rawIdentity,sha(bytes));assert.equal(r.completed,true);await rejects(exact+' ','FINITE_VISCO_HISTORY_BYTE_LIMIT');await rejects(new Uint8Array(max+1),'FINITE_VISCO_HISTORY_BYTE_LIMIT');
});

test('depth/step capacities refuse; maximal 4096 steps return bounded summary instead of an observation history',async()=>{
 await rejects('['.repeat(18)+'0'+']'.repeat(18),'FINITE_VISCO_HISTORY_GRAPH_LIMIT');const h=history();h.steps=Array.from({length:4096},()=>({F:I,dtSeconds:1}));const saved=await encode(h),r=await replay(saved.json);assert.equal(r.completed,true);assert.equal(r.finalState.step,4096);assert.ok(Buffer.byteLength(JSON.stringify(r))<8000);h.steps.push({F:I,dtSeconds:1});await rejects(JSON.stringify(h));await assert.rejects(encode(h));
});

test('ordinary byte views are copied intrinsically and Array/Uint8Array subclasses are rejected without invoking custom iteration',async()=>{
 const raw=JSON.stringify(history()),bytes=new TextEncoder().encode(raw),before=bytes.slice();Object.defineProperty(bytes,Symbol.iterator,{value(){throw Error('must not iterate source');}});Object.defineProperty(bytes,'byteLength',{get(){throw Error('must use intrinsic length');}});assert.equal((await replay(bytes)).completed,true);assert.deepEqual(new Uint8Array(bytes.buffer),before);
 class Bad extends Uint8Array{}await rejects(new Bad(before));await rejects(Array.from(before));await rejects(Buffer.from(before));if(typeof SharedArrayBuffer!=='undefined')await rejects(new Uint8Array(new SharedArrayBuffer(before.length)));
});

test('encoding rejects accessors, sparse/decorated/subclass arrays, cycles, nonfinite objects and excess graph without side effects',async()=>{
 class Bad extends Array{}const tests=[h=>h.steps=new Bad(...h.steps),h=>delete h.steps[0].F[0][1],h=>h.steps[0].F[0].extra=1,h=>h.self=h,h=>h.steps[0].F[0][0]=Infinity,h=>h.parameters.bulkModulusPa=NaN];for(const change of tests){const h=history();change(h);await assert.rejects(encode(h));}let touched=false;const h=history();Object.defineProperty(h.parameters,'bulkModulusPa',{enumerable:true,get(){touched=true;throw Error('must not read');}});await assert.rejects(encode(h));assert.equal(touched,false);
});

test('implicit cumulative time is checked at the actual rejected step and oversized encoded bytes/graphs refuse',async()=>{
 const h=history();h.steps=Array.from({length:501},()=>({F:I,dtSeconds:2e6}));const r=await replay(JSON.stringify(h));assert.equal(r.completed,false);assert.equal(r.failure.stepIndex,500);assert.equal(r.failure.completedSteps,500);assert.equal(r.finalState,undefined);
 const graph={...history(),extra:Array.from({length:101},()=>Array(1000).fill(0))};await rejects(JSON.stringify(graph),'FINITE_VISCO_HISTORY_GRAPH_LIMIT');await assert.rejects(encode(graph),e=>e.code==='FINITE_VISCO_HISTORY_GRAPH_LIMIT');
 const huge=history();huge.steps=Array.from({length:4096},()=>({F:Array.from({length:3},()=>Array(3).fill(-1.2345678901234567e-300)),dtSeconds:1.2345678901234567e-100}));assert.ok(Buffer.byteLength(JSON.stringify(huge))>1048576);await assert.rejects(encode(huge),e=>e.code==='FINITE_VISCO_HISTORY_BYTE_LIMIT');
});

test('real runtime import type fixtures distinguish failed replays and input-only readonly contracts',async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--strict','--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--types','','tests/fixtures/finite-visco-history-types.ts'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:30000,maxBuffer:65536});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});

test('saved public input bytes replay with independently sorted canonical SHA and unchanged source bytes',async()=>{
 const {readFile}=await import('node:fs/promises'),raw=await readFile(new URL('../public/examples/finite-visco-input-history.json',import.meta.url)),source=new Uint8Array(raw),before=source.slice(),h=JSON.parse(raw),sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;
 const r=await replay(source);assert.equal(r.completed,true);assert.equal(r.rawIdentity,sha(raw));assert.equal(r.canonicalIdentity,sha(JSON.stringify(sort(h))));assert.deepEqual(source,before);let expected=init({synthetic:true,provisional:true,calibrated:false,parameters:h.parameters});for(const entry of h.steps)expected=step({state:expected,...entry}).state;assert.deepEqual(r.finalState,expected);
});

test('shared buffer brand cannot impersonate ArrayBuffer through its prototype or own properties',async()=>{
 const raw=JSON.stringify(history()),source=new TextEncoder().encode(raw),shared=new SharedArrayBuffer(source.length),view=new Uint8Array(shared);view.set(source);
 Object.setPrototypeOf(shared,ArrayBuffer.prototype);
 Object.defineProperty(shared,'byteLength',{get(){throw Error('must not invoke caller byteLength');}});
 const before=new Uint8Array(source);await rejects(view);assert.deepEqual(new Uint8Array(shared),before);
 // A regular buffer subview must retain its offset/length and remain unchanged.
 const backing=new ArrayBuffer(source.length+8),all=new Uint8Array(backing);all.fill(33);const regular=new Uint8Array(backing,4,source.length);regular.set(source);const original=all.slice();
 Object.defineProperty(backing,'byteLength',{get(){throw Error('must use intrinsic buffer brand');}});
 const result=await replay(regular);assert.equal(result.completed,true);assert.equal(result.sourceBytes,source.length);assert.equal(result.rawIdentity,sha(source));assert.deepEqual(all,original);
});
