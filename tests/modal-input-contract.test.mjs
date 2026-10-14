import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectModalInputContract as inspect} from '../src/modal-input-contract.js';
const condition=(type='fixed',value=0,extra={})=>({type,value,direction:[0,0,1],regions:[{mesh:0,triangles:[0]}],...extra});
const project=()=>({study:{kind:'structural',modalAnalysis:true,gravityEnabled:false,modeCount:2,modalIterations:60},materialProperties:{youngModulus:1e9,poissonRatio:.3,density:1000},meshes:[{faceIds:[0]}],conditions:[condition()]});
const report=(p,options={})=>inspect(p,options,{mode:'quantitative'});
test('modal physical sources and all serialized supports are declared without numerical provenance or mutation',()=>{
 const p=project();p.conditions.push(condition('displacement',0,{frame:{axis:2},planarRegion:{mesh:0},cylindricalRegion:{mesh:0}}));const before=structuredClone(p),r=report(p);
 assert.equal(r.contract,'modal-isotropic-structure');assert.deepEqual(r.diagnostics,[]);assert.deepEqual(p,before);
 for(const pointer of ['/study/kind','/study/modalAnalysis','/study/gravityEnabled','/materialProperties/youngModulus','/materialProperties/poissonRatio','/materialProperties/density'])assert.ok(r.requiredPointers.includes(pointer),pointer);
 for(let i=0;i<2;i++)for(const key of ['type','value','direction','regions'])assert.ok(r.requiredPointers.includes(`/conditions/${i}/${key}`));
 for(const key of ['frame','planarRegion','cylindricalRegion'])assert.ok(r.requiredPointers.includes('/conditions/1/'+key));
 for(const key of ['modeCount','modalIterations'])assert.ok(!r.requiredPointers.includes('/study/'+key));assert.equal(r.units.youngModulus,'Pa');assert.equal(r.units.density,'kg/m3');assert.equal(r.units.frequency,'Hz');
});
test('required settings are never supplied from defaults and core numerical bounds are exact',()=>{
 for(const [section,key]of [['study','kind'],['study','modalAnalysis'],['study','gravityEnabled'],['study','modeCount'],['study','modalIterations'],['materialProperties','density'],['materialProperties','youngModulus'],['materialProperties','poissonRatio']]){const p=project();delete p[section][key];assert.ok(report(p).diagnostics.some(d=>d.code==='MODAL_INPUT_REQUIRED'&&d.target===`/${section}/${key}`));}
 for(const [key,values]of Object.entries({modeCount:[0,7,1.5],modalIterations:[0,101,Infinity]}))for(const value of values){const p=project();p.study[key]=value;assert.ok(report(p).diagnostics.some(d=>d.target==='/study/'+key));}
 for(const [modeCount,modalIterations]of [[1,1],[6,100]]){const p=project();Object.assign(p.study,{modeCount,modalIterations});assert.deepEqual(report(p).diagnostics,[]);}
});
test('existing CPU scope, homogeneous supports and exact zero loads follow the solver',()=>{
 for(const key of ['orthotropic','plasticity','hyperelastic']){const p=project();p.materialProperties[key]={};assert.ok(report(p).diagnostics.some(d=>d.code==='MODAL_MODEL_UNSUPPORTED'));}
 for(const method of ['pcg','pcg-strict','wasm-pcg'])assert.deepEqual(report(project(),{method}).diagnostics,[]);
 for(const options of [{method:'webgpu-pcg'},{method:'mfem-wasm'},{adaptive:true},{fatigueAssessment:{}},{fractureAssessment:{}}])assert.ok(report(project(),options).diagnostics.length);
 for(const type of ['displacement','force','pressure','normalTraction']){const p=project();p.conditions.push(condition(type,1));assert.ok(report(p).diagnostics.some(d=>d.target==='/conditions/1/value'));p.conditions[1].value=0;assert.deepEqual(report(p).diagnostics,[]);}
 const p=project();p.conditions[0].direction=[0,0,0];p.conditions[0].value=5;assert.deepEqual(report(p).diagnostics,[]); // fixed fields are serialized but ignored by the solver
 p.conditions=[];assert.ok(report(p).diagnostics.some(d=>d.code==='MODAL_SUPPORT_MISSING'));p.conditions=[condition('fixed',0,{cadUpdateRequired:true})];assert.ok(report(p).diagnostics.some(d=>d.code==='MODAL_SUPPORT_MISSING'));
});
test('runtime physical values must match their project and unsupported runtime data is not silently ignored',()=>{
 const p=project();for(const key of ['kind','modalAnalysis','gravityEnabled','modeCount','modalIterations']){assert.deepEqual(report(p,{[key]:p.study[key]}).diagnostics,[]);assert.ok(report(p,{[key]:'different'}).diagnostics.some(d=>d.code==='MODAL_RUNTIME_OVERRIDE'&&d.target==='/options/'+key));}
 for(const key of ['youngModulus','poissonRatio','density','materialProperties','temperature','referenceTemperature','temperatureSource','prestress'])assert.ok(report(p,{[key]:0}).diagnostics.some(d=>d.code==='MODAL_RUNTIME_OVERRIDE'));
});
test('ignored boundary runtime inputs and absent-versus-null physical settings are diagnosed explicitly',()=>{
 const p=project(),before=structuredClone(p);
 for(const key of ['conditions','boundary','force','pressure','normalTraction','displacement','fixed','forces','displacements','tractions','pressures','loads','supports'])for(const value of [null,0,[],{}])assert.ok(report(p,{[key]:value}).diagnostics.some(d=>d.code==='MODAL_RUNTIME_OVERRIDE'&&d.target==='/options/'+key),key);
 for(const key of ['materialTemperature','gravity','thermalStress'])for(const value of [null,undefined,0])assert.ok(report(p,{[key]:value}).diagnostics.some(d=>d.code==='MODAL_RUNTIME_OVERRIDE'&&d.target==='/options/'+key),key);
 for(const [key,value]of Object.entries({materialTemperature:20,gravity:[0,0,0],thermalStress:false})){const explicit=project();explicit.study[key]=value;assert.deepEqual(report(explicit,{[key]:structuredClone(value)}).diagnostics,[]);}
 assert.deepEqual(report(p,{size:2,method:'wasm-pcg',adaptive:false}).diagnostics,[]);assert.deepEqual(p,before);
});
test('supported temperature interpolation uses actual table and explicit temperature without base constants',()=>{
 const p=project();delete p.materialProperties.youngModulus;delete p.materialProperties.poissonRatio;p.materialProperties.dependence={elasticTemperatureTable:[{temperature:0,youngModulus:2e9,poissonRatio:.2},{temperature:100,youngModulus:1e9,poissonRatio:.3}]};p.study.materialTemperature=30;p.materialProperties.temperatureMin=0;p.materialProperties.temperatureMax=100;
 const r=report(p);assert.deepEqual(r.diagnostics,[]);for(const pointer of ['/materialProperties/dependence','/materialProperties/dependence/elasticTemperatureTable','/study/materialTemperature','/materialProperties/temperatureMin','/materialProperties/temperatureMax'])assert.ok(r.requiredPointers.includes(pointer));assert.ok(!r.requiredPointers.includes('/materialProperties/youngModulus'));
 delete p.study.materialTemperature;assert.ok(report(p).diagnostics.some(d=>d.target==='/study/materialTemperature'));p.study.materialTemperature=101;assert.ok(report(p).diagnostics.some(d=>d.code==='MODAL_MATERIAL_INVALID'));p.study.materialTemperature=30;p.materialProperties.dependence.rateDependent=true;assert.ok(report(p).diagnostics.some(d=>d.code==='MODAL_MATERIAL_INVALID'));
});
test('malformed boundaries, material values and branch intent return actionable diagnostics',()=>{
 for(const mutate of [p=>p.study.kind='thermal',p=>p.study.modalAnalysis=false,p=>p.study.gravityEnabled=true,p=>p.study.thermalStress=true,p=>p.materialProperties.density=0,p=>p.materialProperties.youngModulus=Infinity,p=>p.materialProperties.poissonRatio=.49,p=>p.conditions[0].regions=[],p=>p.conditions[0].regions[0].triangles=[1],p=>p.conditions[0].direction=null,p=>p.conditions=[condition('temperature',0)],p=>p.conditions=null]){const p=project();mutate(p);assert.ok(report(p).diagnostics.length);}
 for(const p of [null,[],{}, {study:3,conditions:[null]}])assert.ok(report(p).diagnostics.length);assert.ok(inspect(project(),null,{mode:'quantitative'}).diagnostics.length);assert.ok(inspect(project(),{}, {mode:'unknown'}).diagnostics.length);
});
test('legacy stays unchanged and returned metadata cannot alter later inspections',()=>{
 for(const p of [null,{},project()]){const r=inspect(p);assert.deepEqual(r.diagnostics,[]);assert.deepEqual(r.requiredPointers,[]);}
 const r=report(project());r.units.density='changed';r.requiredPointers.push('changed');assert.equal(report(project()).units.density,'kg/m3');assert.ok(!report(project()).requiredPointers.includes('changed'));
});
