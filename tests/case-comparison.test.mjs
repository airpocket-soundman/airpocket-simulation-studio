import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseComparisonApi} from '../src/case-comparison.js';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {canonicalJson} from '../src/project-revision.js';

const hex='0123456789abcdef',P=[.1,.1,.1];
const coded=code=>Object.assign(Error(code),{code});
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' != '+b);
const nodesA=[0,0,0,1,0,0,0,1,0,0,0,1],nodesB=[...nodesA,1,1,1];
const mesh=(nodes,tetrahedra)=>({nodes,tetrahedra,surface:[{nodes:[0,1,2]}],summary:{nodeCount:nodes.length/3,elementCount:tetrahedra.length}});
const meshA=()=>mesh(nodesA,[[0,1,2,3]]),meshB=()=>mesh(nodesB,[[0,1,2,3],[1,2,3,4]]);
const base=(m,result,extra={})=>({input:{study:{}},calculation:{operation:'elastic',options:{method:'pcg',size:1,adaptive:false,maxRounds:1}},mesh:m,result,...extra});
const thermal=(m,temperature,extra)=>base(m,{kind:'thermal',temperature,flux:m.tetrahedra.map(()=>[1,2,3])},extra);
const elastic=()=>base(meshA(),{kind:'elastic',displacement:Array(12).fill(0),magnitudes:[0,0,0,0],vonMises:[5]});
const modal=frequencyHz=>base(meshA(),{kind:'modal',modes:[{frequencyHz,displacement:Array(12).fill(0),magnitudes:[1,0,0,0],residual:0}]});
const transient=()=>base(meshA(),{kind:'acousticTransient',time:1,pressure:[0,0,0,0],snapshots:[{time:0,pressure:[0,0,0,0]},{time:.5,pressure:[1,2,3,4]}]});

function fixture(outputs,{onRead}={}){
 const ids=Object.keys(outputs),state={stale:new Set(),expired:false},calls=[];
 const revisions=Object.fromEntries(ids.map((id,i)=>[id,'sha256:'+hex[i+1].repeat(64)]));
 const frozen=Object.fromEntries(ids.map(id=>[id,deepFreeze(structuredClone(outputs[id]))]));
 return {calls,state,
  ref:(id,field,extra={})=>({caseId:id,expectedRevision:revisions[id],field,...extra}),
  cases:{async readSource(reference){
   calls.push(reference.caseId);onRead?.(reference.caseId,state);
   if(!(reference.caseId in frozen))throw coded('CASE_UNKNOWN');
   if(reference.expectedRevision!==revisions[reference.caseId])throw coded('CASE_REVISION_CONFLICT');
   return {caseId:reference.caseId,revision:revisions[reference.caseId],name:'case '+reference.caseId,output:frozen[reference.caseId],assertCurrent(){if(state.stale.has(reference.caseId))throw coded('CASE_REVISION_CONFLICT');}};
  }}};
}
async function duringHash(action,run){
 const subtle=globalThis.crypto.subtle,digest=subtle.digest.bind(subtle);let hashed=false;
 subtle.digest=(...args)=>{hashed=true;action();return digest(...args);};
 try{await run();}finally{delete subtle.digest;}
 return hashed;
}
const codes=out=>out.comparison.reasons.map(r=>r.code);

test('thermal stored frame comparison samples the chosen physical time and preserves final defaults',async()=>{
 const a=thermal(meshA(),[100,101,102,103]),b=thermal(meshB(),[200,202,204,206,210]);
 a.result.transient=b.result.transient=true;
 a.result.snapshots=[{time:0,temperature:[0,1,2,3]},{time:2,temperature:[10,11,12,13]}];
 b.result.snapshots=[{time:0,temperature:[0,2,4,6,10]},{time:1,temperature:[20,22,24,26,30]},{time:2,temperature:[30,32,34,36,40]}];
 const f=fixture({a,b}),api=createCaseComparisonApi({cases:f.cases}),run=(ai,bi)=>api.compare({references:[f.ref('a','temperature',{frameIndex:ai}),f.ref('b','temperature',{frameIndex:bi})],point:P});
 const out=await run(1,2);assert.equal(out.comparison.comparable,true);
 assert.deepEqual(out.references[0].selection,{field:'temperature',displayUnit:'degC',frameIndex:1,timeSeconds:2,timeSelection:'stored-frames-only'});
 close(out.references[0].measurement.values.temperature,10.6);close(out.references[1].measurement.values.temperature,31.2);close(out.comparison.deltas[0].values.temperature,20.6);
 assert.deepEqual(codes(await run(1,1)),['different-time']);
 const mixed=await api.compare({references:[f.ref('a','temperature'),f.ref('b','temperature',{frameIndex:2})],point:P});assert.deepEqual(codes(mixed),['different-time']);
 const final=await api.compare({references:[f.ref('a','temperature')],point:P});close(final.references[0].measurement.values.temperature,100.6);assert.equal(final.references[0].selection.timeSeconds,undefined);
 const flux=await api.compare({references:[f.ref('a','heatFlux')],point:P});assert.deepEqual(flux.references[0].measurement.values.flux,[1,2,3]);
 for(const frameIndex of [0,1,99])await assert.rejects(api.compare({references:[f.ref('a','heatFlux',{frameIndex})],point:P}),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 const steady=structuredClone(a);steady.result.transient=false;const steadyFixture=fixture({a:steady});await assert.rejects(createCaseComparisonApi({cases:steadyFixture.cases}).compare({references:[steadyFixture.ref('a','temperature',{frameIndex:0})],point:P}),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 for(const patch of [{temperature:[1,2]},{temperature:[0,1,2,'3']},{time:-1},{time:null}]){const corrupt=structuredClone(a);Object.assign(corrupt.result.snapshots[0],patch);const bad=fixture({a:corrupt}),badApi=createCaseComparisonApi({cases:bad.cases});for(const point of [undefined,P])await assert.rejects(badApi.compare({references:[bad.ref('a','temperature',{frameIndex:0})],...(point?{point}:{})}),{code:'CASE_COMPARISON_DATA_INVALID'});}
});

test('same global point is sampled independently in distinct meshes',async()=>{
 const f=fixture({a:thermal(meshA(),[0,1,2,3]),b:thermal(meshB(),[0,2,4,6,10])});
 const api=createCaseComparisonApi({cases:f.cases});
 const out=await api.compare({references:[f.ref('a','temperature'),f.ref('b','temperature')],point:P});
 const [a,b]=out.references;
 close(a.measurement.values.temperature,.6);close(b.measurement.values.temperature,1.2);
 assert.equal(out.comparison.comparable,true);
 close(out.comparison.deltas[0].values.temperature,.6);
 assert.deepEqual(a.mesh,{nodeCount:4,elementCount:1,surfaceFaceCount:1});
 assert.deepEqual(b.mesh,{nodeCount:5,elementCount:2,surfaceFaceCount:1});
 assert.match(a.inputRevision,/^sha256:[a-f0-9]{64}$/);
 assert.match(a.resultRevision,/^sha256:[a-f0-9]{64}$/);
 assert.notEqual(a.inputRevision,a.resultRevision);
 assert.deepEqual(a.reference,f.ref('a','temperature',{}).caseId&&{caseId:'a',expectedRevision:'sha256:'+'1'.repeat(64)});
 assert.equal(a.selection.displayUnit,'degC');assert.equal(a.selection.unit,undefined);
 assert.deepEqual(a.measurement.units,{temperature:'degC'});assert.deepEqual(out.comparison.deltas[0].units,{temperature:'degC'});
 // The centroid of mesh B's second element lies outside mesh A: unavailable, no deltas.
 const edge=await api.compare({references:[f.ref('a','temperature'),f.ref('b','temperature')],point:[.5,.5,.5]});
 assert.deepEqual(edge.references[0].unavailable,{reason:'outside-mesh'});
 assert.equal(edge.references[1].measurement.element,1);
 close(edge.references[1].measurement.values.temperature,5.5);
 assert.equal(edge.comparison.comparable,false);assert.deepEqual(edge.comparison.deltas,[]);
 assert.ok(codes(edge).includes('point-unavailable'));
});

test('corrupt fields and invalid sampling selectors fail the whole batch',async()=>{
 const f=fixture({a:thermal(meshA(),[0,1,2,3]),bad:thermal(meshA(),[0,1,2])});
 const api=createCaseComparisonApi({cases:f.cases});
 await assert.rejects(api.compare({references:[f.ref('a','temperature'),f.ref('bad','temperature')],point:P}),{code:'CASE_COMPARISON_DATA_INVALID'});
 await assert.rejects(api.compare({references:[f.ref('a','temperature',{bodyIndex:0})],point:P}),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await assert.rejects(api.compare({references:[f.ref('a','temperature',{elementIndex:7})],point:P}),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await assert.rejects(api.compare({references:[f.ref('a','temperature'),{caseId:'zzz',expectedRevision:'sha256:'+'f'.repeat(64),field:'temperature'}]}),{code:'CASE_UNKNOWN'});
 await assert.rejects(api.compare({references:[{...f.ref('a','temperature'),expectedRevision:'sha256:'+'f'.repeat(64)}]}),{code:'CASE_REVISION_CONFLICT'});
});

test('strict request validation happens before any case is read',async()=>{
 const f=fixture({a:thermal(meshA(),[0,1,2,3]),b:thermal(meshA(),[0,1,2,3])});
 const api=createCaseComparisonApi({cases:f.cases}),ok=f.ref('a','temperature');
 const many=Array.from({length:9},(_,i)=>({caseId:'x'+i,expectedRevision:ok.expectedRevision,field:'temperature'}));
 const bad=[null,[],{},{references:[]},{references:many},{references:[ok],extra:1},{references:[ok,ok]},{references:[{caseId:'a',expectedRevision:ok.expectedRevision}]},{references:[{...ok,field:undefined}]},{references:[{...ok,mode:0}]},{references:[{...ok,expectedRevision:'sha256:x'}]},{references:[{...ok,modeIndex:-1}]},{references:[{...ok,frameIndex:1.5}]},{references:[ok],point:[0,0]},{references:[ok],point:[0,0,NaN]},{references:[ok],point:[0,0,Infinity]},{references:[ok],point:'abc'},{references:[{...ok,bodyIndex:0}]},{references:[{...ok,elementIndex:0}]}];
 for(const request of bad)await assert.rejects(api.compare(request),{code:'CASE_COMPARISON_REQUEST_INVALID'},JSON.stringify(request));
 assert.deepEqual(f.calls,[]);
 assert.throws(()=>createCaseComparisonApi({cases:f.cases,maxResponseBytes:70000}),TypeError);
});

test('mode and frame indices are explicit and never defaulted',async()=>{
 const f=fixture({a:thermal(meshA(),[0,1,2,3]),m:modal(100),t:transient()});
 const api=createCaseComparisonApi({cases:f.cases}),a=f.ref('a','temperature');
 const rejects=ref=>assert.rejects(api.compare({references:[ref],point:P}),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await rejects(f.ref('m','displacement'));
 await rejects(f.ref('m','displacement',{modeIndex:5}));
 await rejects(f.ref('a','temperature',{modeIndex:0}));
 await rejects(f.ref('t','instantPressure'));
 await rejects(f.ref('t','instantPressure',{frameIndex:9}));
 await rejects(f.ref('a','temperature',{frameIndex:0}));
 await rejects(f.ref('a','displacement'));
 const out=await api.compare({references:[f.ref('m','displacement',{modeIndex:0}),f.ref('t','instantPressure',{frameIndex:1})],point:P});
 assert.deepEqual(out.references[0].selection,{field:'displacement',displayUnit:'mm',modeIndex:0,frequencyHz:100,modeInterpretation:'normalized-shape-not-dynamic-response',normalization:'maximum modal displacement = 1 mm'});
 assert.deepEqual(out.references[0].measurement.units,{displacementMm:'mm',magnitudeMm:'mm'});
 // A single normalized modal shape never yields deltas either.
 const single=await api.compare({references:[f.ref('m','displacement',{modeIndex:0})],point:P});
 assert.equal(single.comparison.comparable,false);assert.deepEqual(single.comparison.deltas,[]);assert.ok(codes(single).includes('normalized-modal-shape'));
 assert.equal(out.references[1].selection.timeSeconds,.5);
 assert.equal(out.references[1].selection.timeSelection,'stored-frames-only');
 close(out.references[1].measurement.values.pressurePa,1.6);
});

test('different kinds, fields, times and normalized modes never produce deltas',async()=>{
 const f=fixture({a:thermal(meshA(),[0,1,2,3]),e:elastic(),t1:transient(),t2:transient(),m1:modal(100),m2:modal(150)});
 const api=createCaseComparisonApi({cases:f.cases});
 const run=refs=>api.compare({references:refs,point:P});
 let out=await run([f.ref('a','temperature'),f.ref('e','displacement')]);
 assert.equal(out.comparison.comparable,false);assert.deepEqual(out.comparison.deltas,[]);
 for(const code of ['different-kind','different-field','different-unit'])assert.ok(codes(out).includes(code),code);
 out=await run([f.ref('t1','instantPressure',{frameIndex:0}),f.ref('t2','instantPressure',{frameIndex:1})]);
 assert.deepEqual(codes(out),['different-time']);assert.deepEqual(out.comparison.deltas,[]);
 out=await run([f.ref('t1','instantPressure',{frameIndex:1}),f.ref('t2','instantPressure',{frameIndex:1})]);
 assert.equal(out.comparison.comparable,true);close(out.comparison.deltas[0].values.pressurePa,0);
 out=await run([f.ref('m1','displacement',{modeIndex:0}),f.ref('m2','displacement',{modeIndex:0})]);
 assert.ok(codes(out).includes('normalized-modal-shape'));assert.deepEqual(out.comparison.deltas,[]);
 assert.equal(out.references[1].selection.frequencyHz,150);
 out=await api.compare({references:[f.ref('a','temperature'),f.ref('a'.repeat(1),'temperature')].slice(0,1)});
 assert.deepEqual(out.comparison,{comparable:false,reasons:[{code:'no-point-requested'}],deltas:[]});
 assert.equal(out.references[0].measurement,undefined);
});

test('stale leases and expired guards abort during and after asynchronous hashing',async()=>{
 let f=fixture({a:thermal(meshA(),[0,1,2,3])});
 let api=createCaseComparisonApi({cases:f.cases});
 let hashed=await duringHash(()=>f.state.stale.add('a'),()=>assert.rejects(api.compare({references:[f.ref('a','temperature')],point:P}),{code:'CASE_REVISION_CONFLICT'}));
 assert.ok(hashed);
 f=fixture({a:thermal(meshA(),[0,1,2,3])});api=createCaseComparisonApi({cases:f.cases});
 hashed=await duringHash(()=>{f.state.expired=true;},()=>assert.rejects(api.compare({references:[f.ref('a','temperature')],point:P},{guard:()=>!f.state.expired}),{code:'CASE_COMMAND_EXPIRED'}));
 assert.ok(hashed);
 // A later read invalidating an earlier lease is caught by the final all-lease check.
 f=fixture({a:thermal(meshA(),[0,1,2,3]),b:thermal(meshA(),[0,1,2,3])},{onRead:(id,state)=>{if(id==='b')state.stale.add('a');}});
 api=createCaseComparisonApi({cases:f.cases});
 await assert.rejects(api.compare({references:[f.ref('a','temperature'),f.ref('b','temperature')],point:P}),{code:'CASE_REVISION_CONFLICT'});
 assert.deepEqual(f.calls,['a','b']);
 await assert.rejects(api.compare({references:[f.ref('a','temperature')]},{guard:()=>false}),{code:'CASE_COMMAND_EXPIRED'});
 assert.deepEqual(f.calls,['a','b']);
});

test('legacy metadata is marked unrecorded and provisional assessments keep explicit omissions',async()=>{
 const assessment={mode:'screening',provisional:true,completePreflight:false,findings:[{detail:'x'.repeat(50000)}],details:{}};
 const f=fixture({a:thermal(meshA(),[0,1,2,3]),b:thermal(meshA(),[0,1,2,3],{analysisAssessment:assessment})});
 const out=await createCaseComparisonApi({cases:f.cases}).compare({references:[f.ref('a','temperature'),f.ref('b','temperature')]});
 const [a,b]=out.references;
 assert.deepEqual(a.runtimeIdentity,{recorded:false});
 assert.deepEqual(a.analysisAssessment,{recorded:false});
 assert.equal(b.analysisAssessment.provisional,true);assert.equal(b.analysisAssessment.completePreflight,false);assert.equal(b.analysisAssessment.mode,'screening');
 assert.deepEqual(b.analysisAssessment.omittedFields,['details','findings']);assert.equal(b.analysisAssessment.omittedFieldCount,2);
 assert.ok(!JSON.stringify(out).includes('xxxxxxxxxx'));
 assert.deepEqual(a.calculation.options,{method:'pcg',size:1,adaptive:false,maxRounds:1});
});

const plastic=(kappa,vonMises)=>base(meshA(),{kind:'elastic',displacement:Array(12).fill(0),magnitudes:[0,0,0,0],vonMises:[vonMises],plasticity:{equivalentPlasticStrain:[kappa]}});
test('plastic strain keeps raw dimensionless units while the display unit stays separate',async()=>{
 const f=fixture({a:plastic(.003,3e8),b:plastic(.001,2.5e8)});
 const api=createCaseComparisonApi({cases:f.cases});
 let out=await api.compare({references:[f.ref('a','plasticStrain'),f.ref('b','plasticStrain')],point:P});
 assert.equal(out.references[0].measurement.values.equivalentPlasticStrain,.003);
 assert.deepEqual(out.references[0].measurement.units,{equivalentPlasticStrain:'1'});
 assert.equal(out.references[0].selection.displayUnit,'%');
 assert.deepEqual(out.comparison.deltas[0].units,{equivalentPlasticStrain:'1'});close(out.comparison.deltas[0].values.equivalentPlasticStrain,-.002);
 out=await api.compare({references:[f.ref('a','stress'),f.ref('b','stress')],point:P});
 assert.equal(out.references[0].measurement.values.vonMisesPa,3e8);assert.equal(out.references[0].selection.displayUnit,'MPa');
 assert.deepEqual(out.comparison.deltas[0],{caseId:'b',units:{vonMisesPa:'Pa'},values:{vonMisesPa:-5e7}});
 out=await api.compare({references:[f.ref('a','stress'),f.ref('b','plasticStrain')],point:P});
 assert.equal(out.comparison.comparable,false);assert.deepEqual(out.comparison.deltas,[]);assert.ok(codes(out).includes('different-field'));
});

// Real path: createCaseStore -> createCaseOperations.readSource -> prepareCaseView, including JSON reload.
const bodyMesh=()=>({nodes:[0,0,0,1,0,0,0,1,0,0,0,1,10,0,0,11,0,0,10,1,0,10,0,1],tetrahedra:[[0,1,2,3],[4,5,6,7]],surface:[{nodes:[0,1,2]}],nodeBodies:[0,0,0,0,1,1,1,1]});
const realOutput=({vonMises,mesh=bodyMesh(),method='pcg',engine,runtimeIdentity,gpu,name})=>{
 const e=mesh.tetrahedra.length;
 const calculation={operation:'elastic',options:{size:5,method,adaptive:false,maxRounds:3}};
 if(runtimeIdentity)calculation.runtimeIdentity=runtimeIdentity;
 const result={kind:'elastic',maxDisplacementMm:.04,maxVonMisesPa:Math.max(...vonMises),displacement:Array(mesh.nodes.length).fill(0),magnitudes:Array(mesh.nodes.length/3).fill(0),vonMises};
 if(engine)result.engine=engine;if(gpu)result.gpu=gpu;
 return {input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],...(name?{name}:{})},calculation,mesh,result};
};
function real(outputs,{reload=false}={}){
 let store=createCaseStore();
 for(const [name,output] of Object.entries(outputs))store.add(name,output);
 if(reload){const archive=JSON.parse(JSON.stringify(store.export()));store=createCaseStore();store.import(archive);}
 const hostCalls=[];let sequence=0;
 const ops=createCaseOperations({store,id:()=>'id'+ ++sequence,view:i=>hostCalls.push(['view',i]),loadProject:p=>hostCalls.push(['load',p]),getAnalysis:()=>{hostCalls.push(['analysis']);return undefined;}});
 return {store,ops,hostCalls,api:createCaseComparisonApi({cases:ops}),
  async refs(field,extra={}){return (await ops.list()).cases.map(row=>({caseId:row.caseId,expectedRevision:row.revision,field,...(typeof extra==='function'?extra(row):extra)}));}};
}
const GPU={used:true,totalMs:80,setupMs:10,gpuPhaseMs:50,cpuCorrectionMs:20,gpuIterations:30,cpuCorrectionIterations:5,approximateResidual:1e-5,initialExactResidual:1e-5,verifiedResidual:1e-9};
const longEngine='WebGPU PCG / ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Laptop GPU (0x00002757) Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.15.5222)';

test('real saved cases report raw Pa stress with display unit separate, deltas in Pa, and survive JSON reload',async()=>{
 for(const reload of [false,true]){
  const h=real({A:realOutput({vonMises:[2e6,3e6]}),B:realOutput({vonMises:[5e6,1e6]})},{reload});
  const point=[.25,.25,.25],refs=await h.refs('stress');
  const before=canonicalJson(h.store.export()),list=canonicalJson(await h.ops.list());
  const out=await h.api.compare({references:refs,point});
  const [a,b]=out.references;
  assert.deepEqual(a.measurement.values,{vonMisesPa:2e6});assert.deepEqual(b.measurement.values,{vonMisesPa:5e6});
  assert.deepEqual(a.measurement.units,{vonMisesPa:'Pa'});assert.equal(a.selection.displayUnit,'MPa');
  assert.equal(out.comparison.comparable,true);
  assert.deepEqual(out.comparison.deltas,[{caseId:refs[1].caseId,units:{vonMisesPa:'Pa'},values:{vonMisesPa:3e6}}]);
  assert.equal(a.measurement.bodyIndex,0);assert.equal(a.measurement.element,0);
  // case revision, input revision and result revision are all distinct and the case revision is the listed one.
  assert.equal(a.reference.expectedRevision,refs[0].expectedRevision);
  assert.equal(new Set([a.reference.expectedRevision,a.inputRevision,a.resultRevision]).size,3);
  assert.deepEqual(a.mesh,{nodeCount:8,elementCount:2,surfaceFaceCount:1});
  assert.deepEqual(a.calculation,{operation:'elastic',options:{method:'pcg',size:5,adaptive:false,maxRounds:3}});
  assert.deepEqual(a.runtimeIdentity,{recorded:false});assert.deepEqual(a.analysisAssessment,{recorded:false});
  assert.equal(a.name,'A');
  // Body 1 element at the translated tetrahedron.
  const second=await h.api.compare({references:await h.refs('stress',{bodyIndex:1}),point:[10.25,.25,.25]});
  assert.deepEqual(second.references.map(r=>r.measurement.values.vonMisesPa),[3e6,1e6]);
  assert.equal(second.comparison.deltas[0].values.vonMisesPa,-2e6);
  assert.ok(new TextEncoder().encode(JSON.stringify(out)).byteLength<=65536);
  // Neither the store, the case IDs/revisions, nor the host view/input/analysis was touched.
  assert.equal(canonicalJson(h.store.export()),before);assert.equal(canonicalJson(await h.ops.list()),list);assert.deepEqual(h.hostCalls,[]);
 }
});

test('real cases: unknown body or element is a selector error, a real body with an outside point is unavailable',async()=>{
 const h=real({A:realOutput({vonMises:[2e6,3e6]}),B:realOutput({vonMises:[5e6,1e6]})});
 const run=(extra,point=[.25,.25,.25])=>async()=>h.api.compare({references:await h.refs('stress',extra),point});
 await assert.rejects(run({bodyIndex:7})(),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await assert.rejects(run({bodyIndex:2})(),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await assert.rejects(run({bodyIndex:7},[10.25,.25,.25])(),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await assert.rejects(run({elementIndex:2})(),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 await assert.rejects(run({bodyIndex:0,elementIndex:1})(),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 // Valid body 1, but the point lies in body 0: explicit unavailable reason, no deltas, not a failure.
 const out=await run({bodyIndex:1})();
 assert.deepEqual(out.references.map(r=>r.unavailable),[{reason:'outside-mesh'},{reason:'outside-mesh'}]);
 assert.equal(out.comparison.comparable,false);assert.deepEqual(out.comparison.deltas,[]);assert.ok(codes(out).includes('point-unavailable'));
 // Valid element, point outside that element: unavailable as well.
 const element=await run({elementIndex:1})();
 assert.equal(element.references[0].unavailable.reason,'outside-mesh');
 // A point outside the whole mesh.
 const outside=await run({},[50,50,50])();assert.equal(outside.references[0].unavailable.reason,'outside-mesh');
 // Cases without stored body metadata reject bodyIndex rather than ignoring it.
 const legacyMesh=bodyMesh();delete legacyMesh.nodeBodies;
 const legacy=real({A:realOutput({vonMises:[1,2],mesh:legacyMesh})});
 await assert.rejects(async()=>legacy.api.compare({references:await legacy.refs('stress',{bodyIndex:0}),point:[.25,.25,.25]}),{code:'CASE_COMPARISON_SELECTOR_INVALID'});
 const noBody=await legacy.api.compare({references:await legacy.refs('stress'),point:[.25,.25,.25]});
 assert.equal(noBody.references[0].measurement.bodyIndex,undefined);
});

test('real GPU case with a valid engine name longer than 50 characters is accepted and retained',async()=>{
 assert.ok(longEngine.length>50&&longEngine.length<=200);
 const runtimeIdentity={schemaVersion:1,target:'browser',isolation:'web-worker',build:{status:'unavailable'},engine:{requestedMethod:'webgpu-pcg',actualEngine:longEngine},assets:[]};
 const gpu={...GPU,adapter:{description:'test adapter',isFallbackAdapter:false}};
 const h=real({GPU:realOutput({vonMises:[2e6,3e6],method:'webgpu-pcg',engine:longEngine,runtimeIdentity,gpu}),CPU:realOutput({vonMises:[1e6,1e6]})},{reload:true});
 const out=await h.api.compare({references:await h.refs('stress'),point:[.25,.25,.25]});
 assert.equal(out.references[0].calculation.engine,longEngine);
 assert.deepEqual(out.references[0].runtimeIdentity,runtimeIdentity);
 assert.equal(out.references[0].calculation.options.method,'webgpu-pcg');
 assert.equal(out.references[1].calculation.engine,undefined);
 assert.equal(out.comparison.deltas[0].values.vonMisesPa,-1e6);
 // Engine strings beyond the shared 200-character bound are corrupt data, not silently truncated.
 const tooLong=fixture({a:{...thermal(meshA(),[0,1,2,3]),result:{...thermal(meshA(),[0,1,2,3]).result,engine:'x'.repeat(201)}}});
 await assert.rejects(createCaseComparisonApi({cases:tooLong.cases}).compare({references:[tooLong.ref('a','temperature')]}),{code:'CASE_COMPARISON_DATA_INVALID'});
});

test('real case leases: external edits and revoked guards abort before any result is returned',async()=>{
 // Edit the collection while compare hashes its own output: the final all-lease check must fail.
 let h=real({A:realOutput({vonMises:[1,2]}),B:realOutput({vonMises:[3,4]})}),armed=false,done=false;
 const refs=await h.refs('stress');
 const api=createCaseComparisonApi({cases:{async readSource(...args){const lease=await h.ops.readSource(...args);armed=true;return lease;}}});
 const hashed=await duringHash(()=>{if(armed&&!done){done=true;h.store.remove(1);}},()=>assert.rejects(api.compare({references:[refs[0]],point:[.25,.25,.25]}),{code:'CASE_REVISION_CONFLICT'}));
 assert.ok(hashed&&done);assert.equal(h.store.list().length,1);
 // Stale expected revision and unknown ID fail the batch.
 h=real({A:realOutput({vonMises:[1,2]}),B:realOutput({vonMises:[3,4]})});
 const rows=await h.refs('stress');
 await assert.rejects(h.api.compare({references:[{...rows[0],expectedRevision:'sha256:'+'0'.repeat(64)}]}),{code:'CASE_REVISION_CONFLICT'});
 await assert.rejects(h.api.compare({references:[{...rows[0],caseId:'missing'}]}),{code:'CASE_UNKNOWN'});
 // A guard revoked during the first source read.
 let valid=true;
 await assert.rejects(duringHash(()=>{valid=false;},()=>h.api.compare({references:rows,point:[.25,.25,.25]},{guard:()=>valid})),{code:'CASE_COMMAND_EXPIRED'});
 // Renaming a case invalidates its old revision reference.
 await h.ops.rename({caseId:rows[0].caseId,expectedRevision:rows[0].expectedRevision,name:'Renamed'});
 await assert.rejects(h.api.compare({references:[rows[0]]}),{code:'CASE_REVISION_CONFLICT'});
});

test('corrupt stored cases fail the batch instead of becoming missing fields',async()=>{
 const h=real({A:realOutput({vonMises:[1,2]}),B:realOutput({vonMises:[3,4]})});
 // The store accepts these archives; prepareCaseView / the comparison must reject them when read.
 let archive=h.store.export();archive.cases[1].output.result.vonMises.pop();h.store.import(archive);
 await assert.rejects(async()=>h.api.compare({references:await h.refs('stress'),point:[.25,.25,.25]}),/Invalid saved result fields/);
 archive=real({A:realOutput({vonMises:[1,2]}),B:realOutput({vonMises:[3,4]})}).store.export();
 archive.cases[1].output.mesh.nodeBodies.pop();h.store.import(archive);
 await assert.rejects(async()=>h.api.compare({references:await h.refs('stress'),point:[.25,.25,.25]}),{code:'CASE_COMPARISON_DATA_INVALID'});
 await assert.rejects(async()=>h.api.compare({references:await h.refs('stress',{bodyIndex:0}),point:[.25,.25,.25]}),{code:'CASE_COMPARISON_DATA_INVALID'});
});

test('requests and sources are not mutated and responses stay bounded',async()=>{
 const outputs=Object.fromEntries(Array.from({length:8},(_,i)=>['t'+i,thermal(meshA(),[0,1,2,3])]));
 const before=JSON.stringify(outputs),f=fixture(outputs),api=createCaseComparisonApi({cases:f.cases});
 const request=deepFreeze({references:Object.keys(outputs).map(id=>f.ref(id,'temperature')),point:[.1,.1,.1]});
 const out=await api.compare(request);
 const text=JSON.stringify(out),bytes=new TextEncoder().encode(text).byteLength;
 assert.equal(out.references.length,8);assert.ok(bytes<=65536);
 assert.ok(!text.includes('"nodes"')&&!text.includes('"tetrahedra"')&&!text.includes('"surface"'));
 assert.equal(JSON.stringify(outputs),before);
 assert.deepEqual(f.calls,Object.keys(outputs));
 const small=createCaseComparisonApi({cases:f.cases,maxResponseBytes:500});
 await assert.rejects(small.compare(request),{code:'CASE_COMPARISON_RESPONSE_TOO_LARGE'});
});

test('SPL comparisons require the same pressure reference, while raw Pa does not',async()=>{
 const acoustic=(referencePressurePa,pressure)=>base(meshA(),{kind:'acoustic',frequency:1000,referencePressurePa,real:Array(4).fill(pressure),imag:Array(4).fill(0)});
 const f=fixture({A:acoustic(2e-5,1),B:acoustic(4e-5,1),C:acoustic(2e-5,2)}),api=createCaseComparisonApi({cases:f.cases});
 const spl=await api.compare({references:[f.ref('A','spl'),f.ref('B','spl')],point:P});assert.equal(spl.comparison.comparable,false);assert.ok(spl.comparison.reasons.some(x=>x.code==='different-reference-pressure'));assert.deepEqual(spl.comparison.deltas,[]);assert.equal(spl.references[1].selection.referencePressurePa,4e-5);
 const same=await api.compare({references:[f.ref('A','spl'),f.ref('C','spl')],point:P});assert.equal(same.comparison.comparable,true);close(same.comparison.deltas[0].values.splDb,20*Math.log10(2));
 const raw=await api.compare({references:[f.ref('A','pressure'),f.ref('B','pressure')],point:P});assert.equal(raw.comparison.comparable,true);assert.equal(raw.comparison.deltas[0].values.peakPressurePa,0);
});
test('different stored frame instants never silently align through an implicit time tolerance',async()=>{
 const a=transient(),b=transient();a.result.snapshots[1].time=1;b.result.snapshots[1].time=1+5e-11;
 const f=fixture({A:a,B:b}),api=createCaseComparisonApi({cases:f.cases}),refs=[f.ref('A','instantPressure',{frameIndex:1}),f.ref('B','instantPressure',{frameIndex:1})];
 const r=await api.compare({references:refs,point:P});assert.equal(r.comparison.comparable,false);assert.ok(r.comparison.reasons.some(x=>x.code==='different-time'));assert.deepEqual(r.comparison.deltas,[]);
 const exact=await api.compare({references:refs.map(ref=>({...ref,frameIndex:0})),point:P});assert.equal(exact.comparison.comparable,true);
});
