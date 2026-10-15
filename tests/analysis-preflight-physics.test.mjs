import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preflightProject} from '../src/analysis-preflight.js';
import {createStudioApi} from '../src/studio-api.js';
import {inspectUnitMagnitude,UNIT_MAGNITUDE_RULES} from '../src/preflight-unit-magnitude.js';
import {physicsCoverage} from '../src/preflight-physics-coverage.js';
import {callStudioTool} from '../scripts/studio-mcp.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const base=()=>({version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],sourceModel:{kind:'box',bounds:[0,0,0,1,1,1]},conditions:[],analysisIntent:{mode:'quantitative'}});
const regions=[{mesh:0,triangles:[0]}];
function thermal(transient=false){const p=base();p.study={kind:'thermal',transient,volumetricSource:0,...(transient?{timeStep:1,steps:2,initialTemperature:20}:{})};p.materialProperties={conductivity:1,...(transient?{density:1000,specificHeat:1000}:{})};p.conditions=[{type:'temperature',value:60,regions}];return p;}
function acoustic(branch='harmonic'){
 const p=base();p.study={kind:'acoustic',acousticTransient:branch==='transient',sweep:branch==='sweep',exteriorRadiation:false,directivityEnabled:false,frequency:1000,soundSpeed:343,airDensity:1.2,lossFactor:0,referencePressurePa:20e-6};
 if(branch==='sweep')Object.assign(p.study,{sweepStart:500,sweepEnd:1500,sweepCount:3,receiverPoint:[0,0,0]});
 if(branch==='transient'){Object.assign(p.study,{acousticDuration:.004,pulseWidth:.0002,acousticTimeStep:0,dampingRate:0,receiverPoint:[0,0,0]});delete p.study.referencePressurePa;}
 p.conditions=[{type:'acousticPressure',value:1,direction:[0,0,1],regions}];return p;
}
const has=(p,code,target,options)=>preflightProject(p,options??{}, {target:'node'}).diagnostics.some(d=>d.code===code&&(target===undefined||d.target===target));

test('thermal steady and transient: required-input and validity codes are stable',()=>{
 for(const transient of [false,true]){const r=preflightProject(thermal(transient),{}, {target:'node'});assert.equal(r.requiredInputContract,'thermal-conduction');assert.equal(r.completePreflight,false);assert.ok(!r.diagnostics.some(d=>d.code.startsWith('THERMAL_')),String(transient));}
 let p=thermal();delete p.materialProperties.conductivity;assert.ok(has(p,'THERMAL_INPUT_REQUIRED','/materialProperties/conductivity'));
 p=thermal();p.materialProperties.conductivity=-1;assert.ok(has(p,'THERMAL_INPUT_INVALID','/materialProperties/conductivity'));
 p=thermal(true);delete p.study.timeStep;assert.ok(has(p,'THERMAL_INPUT_REQUIRED','/study/timeStep'));
 p=thermal(true);p.study.steps=101;assert.ok(has(p,'THERMAL_INPUT_INVALID','/study/steps'));
 p=thermal(true);delete p.materialProperties.specificHeat;assert.ok(has(p,'THERMAL_INPUT_REQUIRED','/materialProperties/specificHeat'));
 p=thermal();p.conditions[0].type='force';assert.ok(has(p,'THERMAL_CONDITION_DISCIPLINE_MISMATCH','/conditions/0/type'));
 p=thermal();p.conditions=[{type:'heatFlux',value:5,regions}];assert.ok(has(p,'THERMAL_STEADY_ANCHOR_MISSING','/conditions'));
 p=thermal();p.conditions=[{type:'thermalContact',value:100,regions}];assert.ok(has(p,'THERMAL_CONTACT_INVALID','/conditions/0/regions'));
 p=thermal(true);assert.ok(has(p,'THERMAL_RUNTIME_OVERRIDE','/options/timeStep',{timeStep:2}));
});
test('acoustic harmonic, sweep and transient: required-input and branch codes are stable',()=>{
 for(const branch of ['harmonic','sweep','transient']){const r=preflightProject(acoustic(branch),{}, {target:'node'});assert.equal(r.requiredInputContract,'acoustic-wave');assert.equal(r.completePreflight,false);assert.ok(!r.diagnostics.some(d=>d.code.startsWith('ACOUSTIC_')),branch);}
 let p=acoustic();delete p.study.frequency;assert.ok(has(p,'ACOUSTIC_INPUT_REQUIRED','/study/frequency'));
 p=acoustic();p.study.soundSpeed=0;assert.ok(has(p,'ACOUSTIC_INPUT_INVALID','/study/soundSpeed'));
 p=acoustic('sweep');p.study.sweepEnd=100;assert.ok(has(p,'ACOUSTIC_INPUT_INVALID','/study/sweepEnd'));
 p=acoustic('sweep');delete p.study.receiverPoint;assert.ok(has(p,'ACOUSTIC_INPUT_REQUIRED','/study/receiverPoint'));
 p=acoustic('transient');p.study.acousticDuration=.001;assert.ok(has(p,'ACOUSTIC_PULSE_INCOMPLETE','/study/acousticDuration'));
 p=acoustic('transient');p.study.lossFactor=.1;assert.ok(has(p,'ACOUSTIC_BRANCH_INCOMPATIBLE','/study'));
 p=acoustic();p.conditions=[];assert.ok(has(p,'ACOUSTIC_SOURCE_REQUIRED','/conditions'));
 p=acoustic();p.study.exteriorRadiation=true;assert.ok(has(p,'ACOUSTIC_RADIATION_GEOMETRY_INVALID','/sourceModel/enclosure'));
 p=acoustic();assert.ok(has(p,'ACOUSTIC_RUNTIME_OVERRIDE','/options/frequency',{frequency:2000}));
 p=acoustic();assert.ok(has(p,'ACOUSTIC_RUNTIME_OVERRIDE','/options/normalVelocity',{normalVelocity:1}));
});
test('completePreflight stays false and coverage lists remaining checks per physics',()=>{
 for(const [contract,p] of [['thermal-conduction',thermal()],['acoustic-wave',acoustic()]]){
  const r=preflightProject(p,{}, {target:'node'});assert.equal(r.completePreflight,false);assert.equal(r.physicsCoverage.contract,contract);assert.equal(r.physicsCoverage.completePreflight,false);
  assert.ok(r.physicsCoverage.implemented.includes('unit magnitude warning'));assert.ok(r.physicsCoverage.remaining.includes('Mesh quality and element validity after generation'));
 }
 assert.ok(physicsCoverage('acoustic-wave').remaining.includes('Wavelength-per-element resolution after meshing'));
 assert.ok(physicsCoverage('thermal-conduction').remaining.includes('Connected-component anchoring after meshing'));
 assert.deepEqual(physicsCoverage('nope'),{contract:'nope',implemented:[],remaining:physicsCoverage(undefined).remaining,completePreflight:false});
 assert.equal(preflightProject(thermal(),{}, {operation:'mesh'}).physicsCoverage.contract,null);
});
const magnitude=p=>preflightProject(p,{}, {target:'node'}).diagnostics.filter(d=>d.code==='UNIT_MAGNITUDE_SUSPECT');
test('unit magnitude rule table: exact thresholds, warning severity, no conversion',()=>{
 assert.deepEqual(UNIT_MAGNITUDE_RULES.map(r=>[r.pointer,r.unit,r.min,r.max]),[
  ['/materialProperties/youngModulus','Pa',1e5,1e13],['/materialProperties/density','kg/m3',.01,3e4],['/materialProperties/conductivity','W/(m*K)',.005,5000],['/materialProperties/specificHeat','J/(kg*K)',10,3e4],
  ['/study/soundSpeed','m/s',50,2e4],['/study/airDensity','kg/m3',.01,2e4],['/study/frequency','Hz',.1,1e7],['/study/referencePressurePa','Pa',1e-9,1e6]]);
 const e=value=>({materialProperties:{youngModulus:value}});
 for(const value of [210,99999,2e13,-210]){const [d,...rest]=inspectUnitMagnitude(e(value));assert.equal(rest.length,0,String(value));assert.equal(d.code,'UNIT_MAGNITUDE_SUSPECT');assert.equal(d.severity,'warning');assert.equal(d.target,'/materialProperties/youngModulus');assert.equal(d.evidence.unit,'Pa');assert.equal(d.evidence.value,value);assert.deepEqual(d.evidence.plausibleRange,[1e5,1e13]);}
 for(const value of [1e5,2.1e11,1e13,0,1e6])assert.deepEqual(inspectUnitMagnitude(e(value)),[],String(value));
 assert.deepEqual(inspectUnitMagnitude({materialProperties:{youngModulus:'210'}}),[]);assert.deepEqual(inspectUnitMagnitude(null),[]);
 assert.equal(inspectUnitMagnitude({materialProperties:{density:5e4}})[0].target,'/materialProperties/density');
 assert.equal(inspectUnitMagnitude({materialProperties:{conductivity:.001}})[0].target,'/materialProperties/conductivity');
 assert.equal(inspectUnitMagnitude({materialProperties:{specificHeat:1}})[0].target,'/materialProperties/specificHeat');
 assert.equal(inspectUnitMagnitude({study:{soundSpeed:.343}})[0].target,'/study/soundSpeed');
 assert.equal(inspectUnitMagnitude({study:{frequency:.001}})[0].target,'/study/frequency');
 assert.deepEqual(inspectUnitMagnitude({study:{soundSpeed:343,frequency:1000,airDensity:1.2,referencePressurePa:20e-6}}),[]);
 const c=(type,value)=>inspectUnitMagnitude({conditions:[{type,value}]});
 assert.equal(c('force',2e9)[0].target,'/conditions/0/value');assert.deepEqual(c('force',100),[]);assert.equal(c('pressure',1e12).length,1);assert.deepEqual(c('pressure',1e5),[]);
 assert.equal(c('heatFlux',1e10).length,1);assert.equal(c('convection',1e7).length,1);assert.equal(c('acousticPressure',1e8).length,1);assert.deepEqual(c('fixed',1e30),[]);
});
test('unit warnings flow through preflight as warnings without blocking or changing input',()=>{
 const p=thermal();p.materialProperties.conductivity=1e4;const before=structuredClone(p),r=preflightProject(p,{}, {target:'node'});
 const w=r.diagnostics.filter(d=>d.code==='UNIT_MAGNITUDE_SUSPECT');assert.equal(w.length,1);assert.equal(w[0].severity,'warning');assert.equal(w[0].target,'/materialProperties/conductivity');assert.deepEqual(p,before);
 const s=base();s.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions}];s.study={kind:'structural',gravityEnabled:false};s.materialProperties={youngModulus:210,poissonRatio:.3};
 const w2=magnitude(s);assert.equal(w2.length,1);assert.equal(w2[0].target,'/materialProperties/youngModulus');
 assert.equal(preflightProject(s,{}, {operation:'mesh'}).diagnostics.some(d=>d.code==='UNIT_MAGNITUDE_SUSPECT'),false);
 s.materialProperties.youngModulus=2.1e11;assert.equal(magnitude(s).length,0);
 assert.equal(magnitude(thermal()).length,0);
});
test('GUI API, MCP and browser entry points return identical results for the same input',async()=>{
 const p=acoustic();p.study.soundSpeed=.343;p.materialProperties={youngModulus:210};
 const direct=preflightProject(p,{}, {target:'node'}),plain=value=>JSON.parse(JSON.stringify(value));
 const api=createStudioApi();api.loadProject(structuredClone(p));
 assert.deepEqual(plain(api.preflight({}, {target:'node'})),plain(direct));
 const dir=await mkdtemp(join(tmpdir(),'preflight-physics-'));
 try{
  const path=join(dir,'p.json');await writeFile(path,JSON.stringify(p));
  const {runtime,...mcp}=await callStudioTool('studio_preflight_project',{path});
  assert.ok(runtime);assert.deepEqual(plain(mcp),plain(direct));
 }finally{await rm(dir,{recursive:true,force:true});}
 const browser=preflightProject(p,{}, {target:'browser'}),pick=r=>r.diagnostics.filter(d=>d.code==='UNIT_MAGNITUDE_SUSPECT'||d.code.startsWith('ACOUSTIC_'));
 assert.deepEqual(pick(browser),pick(direct));assert.deepEqual(browser.physicsCoverage,direct.physicsCoverage);
 assert.deepEqual(pick(direct).map(d=>d.target).sort(),['/materialProperties/youngModulus','/study/soundSpeed']);
});
