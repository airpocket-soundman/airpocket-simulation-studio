import {identifyPrintedParametersByCondition} from '../src/printed-identification-groups.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createPrintedIdentificationUi} from '../src/ui/printed-identification-ui.js';
import {createPrintedMeasurementUi} from '../src/ui/printed-measurement-ui.js';
import {identifyPrintedParameters} from '../src/printed-parameter-identification.js';
import {syntheticDataset,ramp,linearStress,relaxationCurve,bilinearStress} from './fixtures/printed-identification-synthetic.mjs';
function setup(parent=false,{unsupported=false}={}){
 const make=tag=>{const n={tag,children:[],style:{},value:'',attributes:{},append(...cs){for(const c of cs){c.parent=this;this.children.push(c);}},replaceChildren(...cs){this.children=[];this.text='';this.append(...cs);},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}};Object.defineProperty(n,'textContent',{get(){return(this.text??'')+this.children.map(n=>n.textContent).join('');},set(v){this.text=String(v);this.children=[];}});Object.defineProperty(n,'innerHTML',{set(){throw Error('HTML forbidden');}});return n;};
 let raw=syntheticDataset({curves:ramp(10,.005,linearStress(7e8)),noisePa:0}),language='ja',clock=0;const workers=[],timers=new Map(),host=make('div'),listeners=new Map(),document={createElement:make,createElementNS:(_,t)=>make(t),addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const createWorker=()=>{if(unsupported)throw Error('unsupported');const w={terminated:0,postMessage(data){this.sent=data;this.callback=this.onmessage;},terminate(){this.terminated++;}};workers.push(w);return w;},common={host,document,language:()=>language,setTimer:fn=>{timers.set(++clock,fn);return clock;},clearTimer:id=>timers.delete(id)};
 const measurement=parent?createPrintedMeasurementUi({...common,createIdentificationWorker:createWorker,url:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}}}):null;
 const ui=measurement?.identification??createPrintedIdentificationUi({...common,getRaw:()=>raw,createWorker});if(measurement)measurement.input.value=raw;
 return {ui,measurement,workers,timers,listeners,setRaw(v){raw=v;if(measurement)measurement.input.value=v;},raw:()=>measurement?.input.value??raw,english(){language='en';(measurement??ui).refresh();},async ready(){for(let i=0;i<50&&!workers.at(-1)?.sent;i++)await new Promise(r=>setTimeout(r,1));assert.ok(workers.at(-1)?.sent);},async deliver(mutate=x=>x){const w=workers.at(-1);const {identification:result,grouping}=await identifyPrintedParametersByCondition(w.sent.raw,w.sent.options);w.callback({data:mutate({requestId:w.sent.requestId,ok:true,result,grouping})});return result;}};
}
function options(h,model='linear-elastic'){h.ui.model.value=model;for(const [k,v]of Object.entries({maxStrain:'.08',minPoints:'5',maxRelativeStandardError:'.05',maxTangentRatio:'.5',holdStrainTolerance:'.000001'}))h.ui.inputs[k].value=v;}

test('empty conditions never create a worker; exact analytical modulus is read-only and localized',async()=>{
 const h=setup();assert.equal(await h.ui.identify(),false);assert.equal(h.workers.length,0);options(h);const raw=h.raw(),p=h.ui.identify();await h.ready();await h.deliver();assert.equal(await p,true);assert.equal(h.raw(),raw);assert.equal(h.workers[0].terminated,1);assert.equal(h.timers.size,0);assert.match(h.ui.results.textContent,/700000000/);assert.match(h.ui.results.textContent,/合成データ・実測ではありません/);assert.match(h.ui.panel.textContent,/未校正/);h.english();assert.match(h.ui.panel.textContent,/Uncalibrated/);assert.match(h.ui.results.textContent,/Synthetic data; not a measurement/);assert.equal(h.ui.snapshot().phase,'completed');
});
test('three model options are explicit, model-specific and use the production numerical API',async()=>{
 for(const model of ['linear-elastic','bilinear-elastic-plastic','sls-relaxation']){const h=setup();options(h,model);h.setRaw(syntheticDataset({curves:model==='sls-relaxation'?relaxationCurve():ramp(100,.06,model==='bilinear-elastic-plastic'?bilinearStress():linearStress()),noisePa:0}));const p=h.ui.identify();await h.ready();const sent=h.workers[0].sent.options;assert.equal(Object.keys(sent).length,model==='linear-elastic'?4:5);await h.deliver();assert.equal(await p,true);assert.match(h.ui.results.textContent,model==='sls-relaxation'?/緩和時間 \(s\)/:/ヤング率 \(Pa\)/);}
});
test('input/options ABA, cancellation, clear, disposal and stale callbacks cannot publish',async()=>{
 for(const action of ['raw','option','cancel','clear','destroy']){const h=setup();options(h);const p=h.ui.identify();await h.ready();const old=h.workers[0].callback;if(action==='raw'){const raw=h.raw();h.setRaw('{');h.ui.invalidate();h.setRaw(raw);h.ui.invalidate();}else if(action==='option'){h.ui.inputs.minPoints.value='6';h.ui.inputs.minPoints.oninput();h.ui.inputs.minPoints.value='5';h.ui.inputs.minPoints.oninput();}else h.ui[action].onclick?h.ui[action].onclick():h.ui[action]();assert.equal(await p,false);assert.equal(h.workers[0].terminated,1);assert.equal(h.timers.size,0);old({data:{}});assert.equal(h.ui.results.textContent,'');assert.equal(h.ui.snapshot().sourceSha256,null);}
});
test('watchdog/errors/unsupported and programmatic source/options changes refuse without results',async()=>{
 for(const cause of ['timeout','error','messageerror','raw','option']){const h=setup();options(h);const p=h.ui.identify();await h.ready();const w=h.workers[0];if(cause==='timeout')[...h.timers.values()][0]();else if(cause==='error')w.onerror({preventDefault(){}});else if(cause==='messageerror')w.onmessageerror();else{if(cause==='raw')h.setRaw('{}');else h.ui.inputs.minPoints.value='7';await h.deliver();}assert.equal(await p,false);assert.equal(w.terminated,1);assert.equal(h.ui.results.textContent,'');}
});
test('malformed successful worker results refuse sparse, stale, nonfinite, calibrated or wrong purpose data',async()=>{
 const mutations=[m=>{m.requestId++;},m=>{m.result.dataset.sourceSha256='0'.repeat(64);},m=>{m.result.calibrated=true;},m=>{delete m.result.specimens[0];},m=>{m.result.specimens[0].parameters.youngsModulusPa.value=Infinity;},m=>{m.result.specimens[0].parameters.youngsModulusPa.unit='MPa';},m=>{m.result.options.minPoints=6;},m=>{m.result.model='sls-relaxation';},m=>{m.result.specimens[0].rSquared=NaN;},m=>{m.result.specimens[0].unexpected='bad';},m=>{m.result.specimens=Array(1000000);},m=>{m.result.identified=false;}];
 for(const mutate of mutations){const h=setup();options(h);const p=h.ui.identify();await h.ready();await h.deliver(m=>{mutate(m);return m;});assert.equal(await p,false);assert.equal(h.ui.snapshot().phase,'invalid');assert.equal(h.ui.results.textContent,'');assert.equal(h.workers[0].terminated,1);}
});
test('actual module-worker entry executes all three synthetic models and typed errors without project data',async()=>{
 const source=`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);import(${JSON.stringify(new URL('../src/printed-identification.worker.js',import.meta.url).href)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`;
 for(const model of ['linear-elastic','bilinear-elastic-plastic','sls-relaxation','invalid']){
  const curves=model==='sls-relaxation'?relaxationCurve():ramp(100,.06,model==='bilinear-elastic-plastic'?bilinearStress():linearStress(7e8));
  const request={requestId:3,raw:model==='invalid'?'{':syntheticDataset({curves,noisePa:0}),options:{model:model==='invalid'?'linear-elastic':model,maxStrain:.08,minPoints:5,maxRelativeStandardError:.05,...(model==='bilinear-elastic-plastic'?{maxTangentRatio:.5}:model==='sls-relaxation'?{holdStrainTolerance:1e-6}:{})}};
  const worker=new Worker(source,{eval:true});try{const result=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>m.ready?worker.postMessage(request):resolve(m));});assert.equal(result.requestId,3);if(model==='invalid'){assert.equal(result.ok,false);assert.equal(result.code,'PRINTED_DATASET_INVALID');}else{assert.equal(result.ok,true);assert.equal(result.result.identified,true);assert.equal(result.result.calibrated,false);assert.equal(result.result.model,model);assert.equal(Object.hasOwn(result.result,'project'),false);if(model==='linear-elastic')assert.ok(Math.abs(result.result.specimens[0].parameters.youngsModulusPa.value/7e8-1)<1e-14);}}finally{await worker.terminate();}
 }
});
test('pending SHA has one owned slot through cancellation and cannot restore edited ABA',async()=>{
 const h=setup();options(h);const original=globalThis.crypto.subtle.digest;let release;globalThis.crypto.subtle.digest=()=>new Promise(r=>{release=r;});try{const p=h.ui.identify();assert.equal(h.ui.snapshot().digestPending,true);h.ui.cancel.onclick();assert.equal(h.ui.snapshot().phase,'cancelled');assert.equal(h.ui.run.disabled,true);assert.equal(await h.ui.identify(),false);assert.equal(h.workers.length,0);release(new ArrayBuffer(32));assert.equal(await p,false);assert.equal(h.ui.snapshot().digestPending,false);assert.equal(h.ui.run.disabled,false);}finally{globalThis.crypto.subtle.digest=original;}
});
test('real mounted measurement controller invalidates identification on raw change, reinspection and BFcache',async()=>{
 const h=setup(true);options(h);assert.equal(await h.measurement.inspect(),true);const p=h.ui.identify();await h.ready();await h.deliver();assert.equal(await p,true);assert.equal(h.measurement.snapshot().phase,'valid');h.measurement.input.oninput();assert.equal(h.ui.snapshot().phase,'idle');assert.equal(h.ui.results.textContent,'');options(h);const next=h.ui.identify();await new Promise(r=>setTimeout(r,2));h.measurement.invalidate();assert.equal(await next,false);assert.equal(h.ui.results.textContent,'');h.measurement.destroy();assert.equal(h.ui.snapshot().phase,'closed');assert.equal(h.listeners.size,0);
});


test('UTF8 capacity and unavailable workers refuse; per-specimen 512-point budget refusal is displayed',async()=>{
 const missing=setup(false,{unsupported:true});options(missing);assert.equal(await missing.ui.identify(),false);assert.equal(missing.ui.snapshot().phase,'unsupported');
 const h=setup();options(h);for(const raw of ['x'.repeat(2000001),'温'.repeat(700000)]){h.setRaw(raw);assert.equal(await h.ui.identify(),false);assert.equal(h.workers.length,0);}
 options(h,'bilinear-elastic-plastic');h.setRaw(syntheticDataset({curves:ramp(513,.06,bilinearStress()),noisePa:0}));const p=h.ui.identify();await h.ready();await h.deliver();assert.equal(await p,true);assert.match(h.ui.results.textContent,/上限512点/);assert.match(h.ui.results.textContent,/同定不能/);
});
test('100 specimens keep bounded model-specific coefficient rendering, and reported measurement labels remain unverified',async()=>{
 const h=setup(),d=JSON.parse(syntheticDataset({curves:ramp(10,.005,linearStress()),noisePa:0,specimens:100}));d.provenance='measured';d.id='<script>reported</script>';h.setRaw(JSON.stringify(d));options(h);const p=h.ui.identify();await h.ready();await h.deliver();assert.equal(await p,true);assert.match(h.ui.results.textContent,/実測と申告されたデータ・精度未検証/);assert.match(h.ui.results.textContent,/<script>reported<\/script>/);assert.equal(h.ui.results.children.filter(n=>n.tag==='strong').length,101);assert.equal(h.ui.results.children.some(n=>n.tag==='script'),false);assert.ok(h.ui.results.children.length<450);h.ui.clear.onclick();assert.equal(h.ui.results.textContent,'');assert.equal(h.raw(),JSON.stringify(d));
});


test('model meaning gates reject finite but inconsistent bilinear and held-strain replies',async()=>{
 for(const [model,mutate]of [
 ['bilinear-elastic-plastic',s=>{s.parameters.tangentModulusPa={value:2*s.parameters.youngsModulusPa.value,standardError:0,relativeStandardError:0};}],
 ['bilinear-elastic-plastic',s=>{s.yieldStrain=0;}],
 ['bilinear-elastic-plastic',s=>{s.yieldStrain=.09;}],
 ['bilinear-elastic-plastic',s=>{s.parameters.yieldStressPa.value*=2;s.parameters.yieldStressPa.relativeStandardError=Math.abs(s.parameters.yieldStressPa.standardError/s.parameters.yieldStressPa.value);} ],
 ['sls-relaxation',s=>{s.heldStrain=0;}],['sls-relaxation',s=>{s.heldStrain=.09;}],['linear-elastic',s=>{s.rSquared=1.01;}]
 ]){const h=setup();options(h,model);h.setRaw(syntheticDataset({curves:model==='sls-relaxation'?relaxationCurve():ramp(100,.06,model==='bilinear-elastic-plastic'?bilinearStress():linearStress()),noisePa:0}));const p=h.ui.identify();await h.ready();await h.deliver(m=>{mutate(m.result.specimens[0]);return m;});assert.equal(await p,false);assert.equal(h.ui.snapshot().phase,'invalid');assert.equal(h.ui.results.textContent,'');}
});
test('parent inspection retains one preparation slot through raw/options edit, ABA, invalidation and destruction',async()=>{
 const original=globalThis.crypto.subtle.digest;let release,calls=0;
 globalThis.crypto.subtle.digest=()=>{calls++;return new Promise(r=>{release=r;});};
 try{for(const action of ['edit','bfcache','destroy']){
  const h=setup(true),raw=h.raw(),pending=h.measurement.inspect();assert.equal(h.measurement.snapshot().inspectionPending,true);const before=calls;
  h.setRaw('{');h.measurement.input.oninput();h.setRaw(raw);h.measurement.input.oninput();if(action==='bfcache')h.measurement.invalidate();if(action==='destroy')h.measurement.destroy();
  assert.equal(h.measurement.run.disabled,true);assert.equal(await h.measurement.inspect(),false);assert.equal(calls,before);assert.equal(h.measurement.results.textContent,'');assert.equal(h.measurement.downloads.children.length,0);
  release(new ArrayBuffer(32));assert.equal(await pending,false);assert.equal(h.measurement.snapshot().inspectionPending,false);if(action!=='destroy')assert.equal(h.measurement.run.disabled,false);
 }}finally{globalThis.crypto.subtle.digest=original;}
});


test('explicit example buttons replace only raw/conditions, revoke parent downloads and cancel old workers without auto-run',async()=>{
 const h=setup(true);options(h);assert.equal(await h.measurement.inspect(),true);assert.equal(h.measurement.downloads.children.length,2);const pending=h.ui.identify();await h.ready();const old=h.workers[0].callback,previousRaw=h.raw();
 assert.equal(h.ui.exampleButtons[1].onclick(),true);assert.notEqual(h.raw(),previousRaw);assert.equal(h.ui.model.value,'bilinear-elastic-plastic');assert.equal(h.ui.inputs.maxTangentRatio.value,'0.5');assert.equal(h.ui.inputs.holdStrainTolerance.value,'');assert.equal(await pending,false);assert.equal(h.workers[0].terminated,1);assert.equal(h.workers.length,1);assert.equal(h.measurement.downloads.children.length,0);assert.equal(h.measurement.results.textContent,'');old({data:{}});assert.equal(h.ui.results.textContent,'');
 h.english();assert.match(h.ui.panel.textContent,/Invented algorithm example/);assert.match(h.ui.panel.textContent,/no automatic run/);const toy=h.raw();h.ui.cancel.onclick();assert.equal(h.raw(),toy);h.ui.clear.onclick();assert.equal(h.raw(),toy);assert.equal(h.ui.model.value,'');assert.ok(Object.values(h.ui.inputs).every(input=>input.value===''));
 for(let i=0;i<3;i++){const before=h.workers.length;assert.equal(h.ui.exampleButtons[i].onclick(),true);assert.equal(h.workers.length,before);const p=h.ui.identify();for(let n=0;n<100&&h.workers.length===before;n++)await new Promise(r=>setTimeout(r,1));assert.equal(h.workers.length,before+1);await h.deliver();assert.equal(await p,true);}h.measurement.destroy();
});
test('loading a synthetic example while digest is pending preserves the real preparation slot',async()=>{
 const h=setup(true);options(h);const original=globalThis.crypto.subtle.digest;let release;globalThis.crypto.subtle.digest=()=>new Promise(r=>{release=r;});try{const p=h.ui.identify();h.ui.exampleButtons[2].onclick();assert.equal(h.ui.model.value,'sls-relaxation');assert.equal(h.ui.snapshot().digestPending,true);assert.equal(await h.ui.identify(),false);assert.equal(h.workers.length,0);release(new ArrayBuffer(32));assert.equal(await p,false);assert.equal(h.ui.snapshot().sourceSha256,null);assert.equal(h.ui.run.disabled,false);}finally{globalThis.crypto.subtle.digest=original;}
});


test('condition UI hides mixed global averages and displays exact singleton unknowns and rejection reasons',async()=>{
 const h=setup(),d=JSON.parse(syntheticDataset({curves:ramp(10,.005,linearStress(1e9)),noisePa:0,specimens:4}));d.specimens[1].samples=d.specimens[1].samples.map(([t,f,u])=>[t,3*f,u]);d.specimens[2].buildDirection=[1,0,0];d.specimens[2].samples=d.specimens[2].samples.map(([t,f,u])=>[t,9*f,u]);d.specimens[3].samples=d.specimens[3].samples.slice(0,2);h.setRaw(JSON.stringify(d));options(h);const p=h.ui.identify();await h.ready();await h.deliver();assert.equal(await p,true);assert.match(h.ui.results.textContent,/条件が異なるため全体平均は表示しません/);assert.match(h.ui.results.textContent,/不明（同定できた試験片が1片のみ）/);assert.match(h.ui.results.textContent,/条件内の点数が不足/);assert.match(h.ui.results.textContent,/2000000000/);assert.doesNotMatch(h.ui.results.textContent,/4333333333/);h.english();assert.match(h.ui.results.textContent,/Conditions differ/);assert.match(h.ui.results.textContent,/Unknown \(only one identified specimen\)/);h.ui.cancel.onclick();assert.equal(h.ui.results.textContent,'');
});
test('condition replies reject missing/duplicate members, altered statistics, source/options, sparse groups and false singleton SD',async()=>{
 const mutations=[m=>{m.grouping.dataset.sourceSha256='0'.repeat(64);},m=>{m.grouping.options.minPoints++;},m=>{m.grouping.covarianceAccuracyVerified=true;},m=>{delete m.grouping.groups[0];},m=>{m.grouping.groups[0].members=[];},m=>{m.grouping.groups[0].members.push(m.grouping.groups[0].members[0]);},m=>{m.grouping.groups[0].statistics.youngsModulusPa.mean*=2;},m=>{m.grouping.groups[0].statistics.youngsModulusPa.sampleStandardDeviation=0;},m=>{m.grouping.groups[0].conditions.temperatureC=Infinity;},m=>{m.grouping.mixedConditions=true;}];
 for(const mutate of mutations){const h=setup();options(h);const p=h.ui.identify();await h.ready();await h.deliver(m=>{mutate(m);return m;});assert.equal(await p,false);assert.equal(h.ui.snapshot().phase,'invalid');assert.equal(h.ui.results.textContent,'');}
});


test('every grouped condition and member is bound to normalized source, not just a plausible same-SHA reply',async()=>{
 const mutations=[c=>c.temperatureC=999,c=>c.speedMmPerSecond=.7,c=>c.batch='other-batch',c=>c.dimensionsMm=[2,1,10],c=>c.gaugeLengthMm=9,c=>c.buildDirection=[1,0,0]];
 for(const mutate of mutations){const h=setup();options(h);const p=h.ui.identify();await h.ready();await h.deliver(m=>{mutate(m.grouping.groups[0].conditions);return m;});assert.equal(await p,false);assert.equal(h.ui.snapshot().phase,'invalid');assert.equal(h.ui.results.textContent,'');assert.equal(h.workers[0].terminated,1);}
 // Mutating both identity copies cannot override the original source's metadata.
 const h=setup();options(h);const p=h.ui.identify();await h.ready();await h.deliver(m=>{m.result.dataset.provenance=m.grouping.dataset.provenance='measured';return m;});assert.equal(await p,false);
});
test('member swaps between plausible groups refuse even when each statistic still matches its swapped member',async()=>{
 const h=setup(),d=JSON.parse(syntheticDataset({curves:ramp(10,.005,linearStress()),noisePa:0,specimens:2}));d.specimens[1].temperature=999;h.setRaw(JSON.stringify(d));options(h);const p=h.ui.identify();await h.ready();await h.deliver(m=>{const [a,b]=m.grouping.groups;[a.members,b.members]=[b.members,a.members];[a.statistics,b.statistics]=[b.statistics,a.statistics];return m;});assert.equal(await p,false);assert.equal(h.ui.results.textContent,'');
});
