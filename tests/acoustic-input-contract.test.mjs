import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveAcoustic} from '../src/acoustic-core.js';
import {solveAcousticTransient} from '../src/acoustic-transient.js';
import {inspectAcousticInputContract} from '../src/acoustic-input-contract.js';
const inspect=(p,options={})=>inspectAcousticInputContract(p,options,{mode:'quantitative'}),has=(r,code)=>r.diagnostics.some(d=>d.code===code);
function project(){return {study:{kind:'acoustic',acousticTransient:false,sweep:false,exteriorRadiation:false,directivityEnabled:false,frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0,referencePressurePa:20e-6},meshes:[{faceIds:[0]}],conditions:[{type:'acousticPressure',value:1,regions:[{mesh:0,triangles:[0]}]}]};}
function transient(){const p=project();p.study={...p.study,acousticTransient:true,acousticDuration:.004,pulseWidth:.0002,acousticTimeStep:0,dampingRate:0,receiverPoint:[0,0,0]};delete p.study.referencePressurePa;return p;}
test('legacy inspection remains empty and explicit harmonic inputs are observed without mutation',()=>{assert.deepEqual(inspectAcousticInputContract({},{}).requiredPointers,[]);assert.deepEqual(inspectAcousticInputContract({},{}).diagnostics,[]);const p=project(),before=structuredClone(p),r=inspect(p);assert.equal(r.contract,'acoustic-wave');assert.deepEqual(r.diagnostics,[]);for(const pointer of ['/study/frequency','/study/lossFactor','/study/referencePressurePa','/study/acousticTransient','/conditions/0/type','/conditions/0/value','/conditions/0/regions'])assert.ok(r.requiredPointers.includes(pointer));assert.equal(r.units.impedance,'Pa*s/m');for(const key of ['acousticDuration','pulseWidth','acousticTimeStep'])assert.equal(r.units[key],'s');assert.deepEqual(p,before);});
test('physical defaults are never invented and malformed boundaries are diagnosed',()=>{for(const key of ['acousticTransient','sweep','exteriorRadiation','directivityEnabled','frequency','soundSpeed','airDensity','lossFactor','referencePressurePa']){const p=project();delete p.study[key];assert.ok(has(inspect(p),'ACOUSTIC_INPUT_REQUIRED'),key);}for(const mutate of [p=>p.conditions[0].regions=[],p=>p.conditions[0].value=NaN,p=>p.study.frequency=0,p=>p.study.acousticTransient='false']){const p=project();mutate(p);assert.ok(has(inspect(p),'ACOUSTIC_INPUT_INVALID'));}const p=project();p.conditions[0].type='force';assert.ok(has(inspect(p),'ACOUSTIC_SOURCE_REQUIRED'));assert.ok(has(inspect(p),'ACOUSTIC_INPUT_INVALID'));});
test('transient pressure pulse inputs are explicit and branch incompatibilities fail',()=>{const p=transient();assert.deepEqual(inspect(p).diagnostics,[]);for(const key of ['acousticDuration','pulseWidth','acousticTimeStep','dampingRate','receiverPoint']){const q=structuredClone(p);delete q.study[key];assert.ok(has(inspect(q),'ACOUSTIC_INPUT_REQUIRED'),key);}for(const mutate of [q=>q.study.lossFactor=.1,q=>q.study.sweep=true,q=>q.study.directivityEnabled=true]){const q=structuredClone(p);mutate(q);assert.ok(has(inspect(q),'ACOUSTIC_BRANCH_INCOMPATIBLE'));}p.study.acousticDuration=.001;assert.ok(has(inspect(p),'ACOUSTIC_PULSE_INCOMPLETE'));});
test('sweep, far field and spherical exterior geometry require their complete declarations',()=>{const p=project();Object.assign(p.study,{sweep:true,sweepStart:100,sweepEnd:2000,sweepCount:5,receiverPoint:[0,0,0],exteriorRadiation:true,directivityEnabled:true,directivityAxis:2,directivityPoints:36,directivityDistanceMm:1000});p.sourceModel={kind:'fluidDomain',solid:{kind:'box',bounds:[0,0,0,1,1,1]},enclosure:{kind:'sphere',center:[0,0,0],radius:3}};assert.deepEqual(inspect(p).diagnostics,[]);for(const pointer of ['/study/sweepStart','/study/sweepEnd','/study/sweepCount','/study/receiverPoint','/study/directivityAxis','/study/directivityPoints','/study/directivityDistanceMm','/sourceModel/enclosure'])assert.ok(inspect(p).requiredPointers.includes(pointer));p.sourceModel.enclosure=[-1,-1,-1,3,3,3];assert.ok(has(inspect(p),'ACOUSTIC_RADIATION_GEOMETRY_INVALID'));});
test('constant and tabulated impedance require evidence and obey transient and frequency restrictions',()=>{const p=project();p.conditions.push({type:'acousticImpedance',value:400,reactance:0,regions:[{mesh:0,triangles:[0]}],impedanceTable:[[500,400,0],[2000,500,10]]});let r=inspect(p);assert.deepEqual(r.diagnostics,[]);assert.ok(r.requiredPointers.includes('/conditions/1/reactance'));assert.ok(r.requiredPointers.includes('/conditions/1/impedanceTable'));p.study.frequency=3000;assert.ok(has(inspect(p),'ACOUSTIC_IMPEDANCE_INVALID'));const q=transient();q.conditions.push(p.conditions[1]);assert.ok(has(inspect(q),'ACOUSTIC_IMPEDANCE_INVALID'));delete q.conditions[1].impedanceTable;assert.deepEqual(inspect(q).diagnostics,[]);delete q.conditions[1].reactance;assert.ok(has(inspect(q),'ACOUSTIC_INPUT_REQUIRED'));});
function modal(){const p=project();p.conditions=[];p.sourceModel={kind:'fluidDomain',solid:{kind:'box',bounds:[0,0,0,1,1,1]},enclosure:{kind:'sphere',center:[.5,.5,.5],radius:3}};p.study.exteriorRadiation=true;p.study.vibrationSource={name:'Saved mode',modeIndex:0,frequencyHz:1000,amplitudeMm:.001,phaseDeg:0,bounds:[0,0,0,1,1,1],mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},displacement:[1,0,0,1,0,0,1,0,0,1,0,0]};return p;}
test('direct modal fields require mesh and displacement evidence; saved references require identity evidence',()=>{const p=modal();let r=inspect(p);assert.deepEqual(r.diagnostics,[]);assert.ok(r.requiredPointers.includes('/study/vibrationSource/mesh'));assert.ok(r.requiredPointers.includes('/study/vibrationSource/displacement'));p.study.vibrationSource.caseReference={schemaVersion:1,caseId:'saved',revision:'sha256:'+'a'.repeat(64)};p.study.vibrationSource.sourceAssessment={schemaVersion:1,mode:'exploratory',provisional:true,completePreflight:false,remainingChecks:['Mesh dependence']};r=inspect(p);assert.deepEqual(r.diagnostics,[]);assert.ok(r.requiredPointers.includes('/study/vibrationSource/caseReference'));assert.ok(r.requiredPointers.includes('/study/vibrationSource/sourceAssessment'));assert.ok(!r.requiredPointers.includes('/study/vibrationSource/displacement'));p.study.vibrationSource.caseReference.revision='bad';assert.ok(has(inspect(p),'ACOUSTIC_INPUT_INVALID'));p.study.frequency=999;assert.ok(has(inspect(p),'ACOUSTIC_VIBRATION_INVALID'));});
test('runtime physics accepts same values but rejects changed and silently ignored options',()=>{const p=project();assert.deepEqual(inspect(p,{frequency:1000,soundSpeed:343,method:'wasm-pcg',size:1}).diagnostics,[]);for(const options of [{frequency:999},{receiverPoint:[0,0,0]},{initialPressure:[1,2,3]},{radiationBoundary:{}},{normalVelocity:[]}])assert.ok(has(inspect(p,options),'ACOUSTIC_RUNTIME_OVERRIDE'));assert.equal(inspectAcousticInputContract(null,{}, {mode:'quantitative'}).diagnostics[0].code,'ACOUSTIC_INPUT_INVALID');});

test('explicit transient step counts above the existing solver limit fail before meshing',()=>{
 const p=transient();p.study.acousticTimeStep=p.study.acousticDuration/60001;
 const before=structuredClone(p),r=inspect(p),diagnostic=r.diagnostics.find(d=>d.code==='ACOUSTIC_WORKLOAD_UNSUPPORTED');
 assert.equal(diagnostic.target,'/study/acousticTimeStep');assert.equal(diagnostic.evidence.maximumSteps,60000);assert.ok(diagnostic.evidence.steps>60000);assert.deepEqual(p,before);
 const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]};
 assert.throws(()=>solveAcousticTransient(mesh,{acousticPressures:[[0,1]]},p.study),/Transient acoustic workload limit exceeded/);
 p.study.acousticTimeStep=p.study.acousticDuration/60000;assert.deepEqual(inspect(p).diagnostics,[]);
 p.study.acousticTimeStep=0;assert.deepEqual(inspect(p).diagnostics,[]);
 assert.deepEqual(inspectAcousticInputContract(before).diagnostics,[]);
});

test('overflowing explicit transient step counts retain JSON-safe diagnostic evidence',()=>{
 const p=transient();p.study.acousticTimeStep=Number.MIN_VALUE;
 assert.ok(Number.isFinite(p.study.acousticDuration));assert.ok(Number.isFinite(p.study.acousticTimeStep));
 assert.equal(p.study.acousticDuration/p.study.acousticTimeStep,Infinity);
 const r=inspect(p),diagnostic=r.diagnostics.find(d=>d.code==='ACOUSTIC_WORKLOAD_UNSUPPORTED');
 assert.deepEqual(diagnostic.evidence,{stepCountOverflow:true,maximumSteps:60000});
 assert.deepEqual(JSON.parse(JSON.stringify(r)),r);
});

test('harmonic numerical range checks agree with existing wave and squared-wave-number solver refusals',()=>{
 const mesh={size:0,nodes:[],tetrahedra:[]},boundary={acousticPressures:[[0,1]]};
 for(const patch of [{frequency:Number.MAX_VALUE},{frequency:1e160},{soundSpeed:Number.MIN_VALUE},{lossFactor:Number.MAX_VALUE}]){
  const p=project();Object.assign(p.study,patch);const before=structuredClone(p),r=inspect(p);
  assert.ok(r.diagnostics.some(d=>d.code==='ACOUSTIC_NUMERICAL_RANGE_UNSUPPORTED'),JSON.stringify(patch));
  assert.throws(()=>solveAcoustic(mesh,boundary,p.study),/numerical limits/);assert.deepEqual(p,before);assert.deepEqual(JSON.parse(JSON.stringify(r)),r);
 }
 const p=project();Object.assign(p.study,{sweep:true,sweepStart:1000,sweepEnd:1e160,sweepCount:2,receiverPoint:[0,0,0]});
 assert.ok(inspect(p).diagnostics.some(d=>d.code==='ACOUSTIC_NUMERICAL_RANGE_UNSUPPORTED'&&d.target==='/study/sweepEnd'));
 p.study.sweepCount=1;assert.deepEqual(inspect(p).diagnostics,[]);
 p.study.sweepCount=2;p.study.sweepEnd=2000;assert.deepEqual(inspect(p).diagnostics,[]);
 p.study.sweep=false;p.study.frequency=1e150;assert.deepEqual(inspect(p).diagnostics,[]);
 assert.deepEqual(inspectAcousticInputContract(p).diagnostics,[]);
});
