import {test} from 'node:test';import assert from 'node:assert/strict';
import {inspectThermalInputContract as inspect} from '../src/thermal-input-contract.js';
import {solveThermal} from '../src/thermal-core.js';
import {solveRadiatingSystem} from '../src/thermal-radiation.js';
const condition=(type='temperature',value=20,extra={})=>({type,value,direction:[1,0,0],regions:[{mesh:0,triangles:[0]}],...extra});
const project=(transient=false)=>({study:{kind:'thermal',transient,volumetricSource:0,...(transient?{timeStep:1,steps:10,initialTemperature:20}:{})},materialProperties:{conductivity:2,...(transient?{density:1000,specificHeat:1000}:{})},meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]},{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[condition()]});
const report=(p,options={})=>inspect(p,options,{mode:'quantitative'});
test('steady thermal rejects explicitly invalid solver initial temperatures without changing inputs',()=>{
 for(const value of [-274,NaN,Infinity,'20',null]){
  const p=project();p.study.initialTemperature=value;const before=structuredClone(p);
  assert.throws(()=>solveThermal({},p.materialProperties,{},p.study),/Invalid thermal inputs/);
  for(const mode of ['quantitative','exploratory']){
   const r=inspect(p,{}, {mode}),issue=r.diagnostics.find(d=>d.target==='/study/initialTemperature');
   assert.ok(r.requiredPointers.includes('/study/initialTemperature'));assert.equal(issue.severity,'error');assert.equal(issue.evidence.unit,'degC');assert.equal(issue.requiresUserIntent,true);
  }
  assert.deepEqual(p,before);assert.deepEqual(inspect(p,{}, {mode:'legacy'}).diagnostics,[]);
 }
 for(const value of [-273.15,0,20]){const p=project();p.study.initialTemperature=value;assert.deepEqual(report(p).diagnostics,[]);}
 const omitted=report(project());assert.deepEqual(omitted.diagnostics,[]);assert.ok(!omitted.requiredPointers.includes('/study/initialTemperature'));
});
test('steady and transient contracts enumerate only explicitly used physical inputs without mutation',()=>{for(const transient of [false,true]){const p=project(transient),before=structuredClone(p),r=report(p);assert.equal(r.contract,'thermal-conduction');assert.deepEqual(r.diagnostics,[]);for(const pointer of ['/study/kind','/study/transient','/study/volumetricSource','/materialProperties/conductivity','/conditions/0/type','/conditions/0/value','/conditions/0/regions'])assert.ok(r.requiredPointers.includes(pointer));assert.equal(r.requiredPointers.includes('/study/initialTemperature'),transient);assert.equal(r.requiredPointers.includes('/materialProperties/density'),transient);assert.equal(r.requiredPointers.includes('/materialProperties/specificHeat'),transient);assert.equal(r.requiredPointers.includes('/study/timeStep'),transient);assert.equal(r.requiredPointers.includes('/study/steps'),transient);assert.ok(!r.requiredPointers.includes('/sourceModel'));assert.ok(!r.requiredPointers.includes('/conditions/0/direction'));assert.deepEqual(p,before);assert.equal(r.units.conductivity,'W/(m*K)');assert.equal(r.units.specificHeat,'J/(kg*K)');assert.equal(r.units.initialTemperature,'degC');assert.equal(r.units.ambientTemperature,'degC');}});
test('radiation iteration settings follow solver bounds and runtime precedence without physical evidence',()=>{
 const p=project();p.conditions=[condition('radiation',.8,{ambientTemperature:20})];
 for(const value of [0,61,1.5,null,NaN]){
  assert.throws(()=>solveRadiatingSystem(0,[],[],new Map(),[],[],{maxRadiationIterations:value}),/Invalid radiation iteration limit/);
  p.study.maxRadiationIterations=value;const before=structuredClone(p);
  assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_NUMERICAL_SETTING_INVALID'&&d.target==='/study/maxRadiationIterations'));
  assert.deepEqual(report(p,{maxRadiationIterations:1}).diagnostics,[]);assert.deepEqual(p,before);
  delete p.study.maxRadiationIterations;
  assert.ok(report(p,{maxRadiationIterations:value}).diagnostics.some(d=>d.target==='/options/maxRadiationIterations'));
 }
 for(const value of [1,60,undefined]){const r=report(p,{maxRadiationIterations:value});assert.deepEqual(r.diagnostics,[]);assert.ok(!r.requiredPointers.some(pointer=>pointer.endsWith('/maxRadiationIterations')));}
 p.study.maxRadiationIterations=0;assert.deepEqual(report(p,{maxRadiationIterations:undefined}).diagnostics,[]);
 p.conditions=[condition()];assert.deepEqual(report(p).diagnostics,[]);
});
test('all thermal boundary values, selected geometry, ambient temperatures and paired contacts require evidence',()=>{
 const p=project();p.conditions=[condition(),condition('heatFlux',-10),condition('heatPower',2),condition('convection',100,{ambientTemperature:20,planarRegion:{mesh:0}}),condition('radiation',.8,{ambientTemperature:20,cylindricalRegion:{mesh:0}}),condition('thermalContact',1000,{regions:[{mesh:0,triangles:[0]},{mesh:1,triangles:[0]}]})];
 const r=report(p);assert.deepEqual(r.diagnostics,[]);for(let i=0;i<p.conditions.length;i++)for(const key of ['type','value','regions'])assert.ok(r.requiredPointers.includes('/conditions/'+i+'/'+key));for(const pointer of ['/conditions/3/ambientTemperature','/conditions/4/ambientTemperature','/conditions/3/planarRegion','/conditions/4/cylindricalRegion'])assert.ok(r.requiredPointers.includes(pointer));assert.ok(!r.requiredPointers.includes('/study/maxRadiationIterations'));assert.ok(!r.requiredPointers.includes('/study/initialTemperature'));
 for(const [type,unit]of Object.entries({temperature:'degC',heatFlux:'W/m2',heatPower:'W',convection:'W/(m2*K)',thermalContact:'W/(m2*K)',radiation:'1'})){const missing=project();missing.conditions=[condition(type,undefined)];delete missing.conditions[0].value;const issue=report(missing).diagnostics.find(d=>d.target==='/conditions/0/value');assert.equal(issue.evidence.unit,unit);}
});
test('missing or invalid values and thermal boundary regimes produce stable diagnostics',()=>{
 for(const [mutate,target]of [[p=>delete p.study.transient,'/study/transient'],[p=>p.study.transient='yes','/study/transient'],[p=>delete p.study.volumetricSource,'/study/volumetricSource'],[p=>p.materialProperties.conductivity=0,'/materialProperties/conductivity'],[p=>p.materialProperties.density=-1,'/materialProperties/density'],[p=>p.materialProperties.specificHeat=NaN,'/materialProperties/specificHeat'],[p=>p.study.timeStep=0,'/study/timeStep'],[p=>p.study.steps=101,'/study/steps'],[p=>p.study.initialTemperature=-274,'/study/initialTemperature'],[p=>p.conditions[0].value=-274,'/conditions/0/value'],[p=>p.conditions[0].regions=[],'/conditions/0/regions']]){const p=project(true);mutate(p);assert.ok(report(p).diagnostics.some(issue=>issue.target===target),target);}
 for(const c of [condition('convection',0,{ambientTemperature:20}),condition('convection',1,{ambientTemperature:-274}),condition('radiation',1.1,{ambientTemperature:20}),condition('thermalContact',1),condition('force',1)]){const p=project();p.conditions=[c];assert.ok(report(p).diagnostics.length);}
});
test('steady anchors are explicit and component coverage remains a post-mesh limitation',()=>{const p=project();p.conditions=[condition('heatFlux',2)];assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STEADY_ANCHOR_MISSING'));p.study.transient=true;Object.assign(p.study,{timeStep:1,steps:2,initialTemperature:20});Object.assign(p.materialProperties,{density:1000,specificHeat:1000});assert.ok(!report(p).diagnostics.some(d=>d.code==='THERMAL_STEADY_ANCHOR_MISSING'));p.study.transient=false;p.conditions=[condition('temperature',20,{cadUpdateRequired:true})];assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STEADY_ANCHOR_MISSING'));});
test('runtime physical overrides must match the project values and numerical settings are separate',()=>{const p=project(true);for(const key of ['transient','timeStep','steps','initialTemperature','volumetricSource']){assert.deepEqual(report(p,{[key]:p.study[key]}).diagnostics,[]);assert.ok(report(p,{[key]:key==='transient'?false:p.study[key]+1}).diagnostics.some(d=>d.code==='THERMAL_RUNTIME_OVERRIDE'&&d.target==='/options/'+key));}assert.deepEqual(report(p,{method:'pcg',size:2,maxRadiationIterations:10}).diagnostics,[]);});
test('legacy adds no physical errors and malformed inputs return diagnostics without throwing',()=>{for(const p of [null,{},[],project()])assert.deepEqual(inspect(p,{}, {mode:'legacy'}).diagnostics,[]);assert.deepEqual(inspect(project(),{}, {mode:'legacy'}).requiredPointers,[]);for(const p of [null,[],{}, {study:4,materialProperties:null,conditions:[null]}])assert.ok(report(p).diagnostics.length);assert.ok(inspect(project(),null,{mode:'quantitative'}).diagnostics.length);assert.ok(inspect(project(),{}, {mode:'unknown'}).diagnostics.length);const first=report(project());first.units.conductivity='changed';assert.equal(report(project()).units.conductivity,'W/(m*K)');});
