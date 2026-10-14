import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectThermalStressInputContract as inspect} from '../src/thermal-stress-input-contract.js';
const project=()=>({study:{kind:'structural',thermalStress:true,temperature:60,referenceTemperature:20,gravityEnabled:false},materialProperties:{youngModulus:1e9,poissonRatio:.3,expansion:1e-5},meshes:[{faceIds:[0]}],conditions:[{type:'fixed',value:0,direction:[0,0,0],regions:[{mesh:0,triangles:[0]}]}]});
const report=(p,options={})=>inspect(p,options,{mode:'quantitative'});
const source=()=>({name:'Saved temperature field',mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]]},temperature:[40,50,60,70]});
const table=()=>({elasticTemperatureTable:[{temperature:0,youngModulus:2e9,poissonRatio:.2},{temperature:100,youngModulus:1e9,poissonRatio:.3}]});
const dependent=()=>{const p=project();p.study.thermalStress=false;p.study.materialTemperature=40;delete p.materialProperties.youngModulus;delete p.materialProperties.poissonRatio;p.materialProperties.dependence=table();return p;};
test('uniform thermal stress declares physical values and all serialized boundaries without changing inputs',()=>{
 const p=project();p.conditions.push({type:'displacement',value:.01,direction:[1,0,0],regions:[{mesh:0,triangles:[0]}],planarRegion:{axis:0},cylindricalRegion:{axis:2}});const before=structuredClone(p),r=report(p);assert.equal(r.contract,'thermal-stress-isotropic-structure');assert.deepEqual(r.diagnostics,[]);assert.deepEqual(p,before);
 for(const pointer of ['/study/kind','/study/gravityEnabled','/study/thermalStress','/study/temperature','/study/referenceTemperature','/materialProperties/expansion','/materialProperties/youngModulus','/materialProperties/poissonRatio'])assert.ok(r.requiredPointers.includes(pointer),pointer);
 for(let i=0;i<2;i++)for(const key of ['type','value','direction','regions'])assert.ok(r.requiredPointers.includes(`/conditions/${i}/${key}`));for(const key of ['planarRegion','cylindricalRegion'])assert.ok(r.requiredPointers.includes('/conditions/1/'+key));assert.ok(!r.requiredPointers.includes('/materialProperties/density'));assert.equal(r.units.expansion,'1/K');assert.equal(r.units.temperature,'degC');
 for(const expansion of [-1e-5,0]){p.materialProperties.expansion=expansion;assert.deepEqual(report(p).diagnostics,[]);}
});
test('strict missing temperatures, expansion, gravity and constants never receive defaults',()=>{
 for(const [group,key]of [['study','temperature'],['study','referenceTemperature'],['study','gravityEnabled'],['materialProperties','expansion'],['materialProperties','youngModulus'],['materialProperties','poissonRatio']]){const p=project();delete p[group][key];assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STRESS_INPUT_REQUIRED'&&d.target===`/${group}/${key}`));}
 const p=project();p.study.gravityEnabled=true;assert.ok(report(p).diagnostics.some(d=>d.target==='/study/gravity'));assert.ok(report(p).diagnostics.some(d=>d.target==='/materialProperties/density'));p.study.gravity=[0,0,-9.81];p.materialProperties.density=1000;assert.deepEqual(report(p).diagnostics,[]);
});
test('direct transferred source records full mesh and field evidence and preserves provisional lineage by clone',()=>{
 const p=project();p.study.temperatureSource=source();p.study.temperatureSource.sourceAssessment={schemaVersion:1,mode:'exploratory',provisional:true,completePreflight:false,remainingChecks:['Physical accuracy']};const before=structuredClone(p),r=report(p);assert.deepEqual(r.diagnostics,[]);for(const key of ['name','mesh','temperature','sourceAssessment'])assert.ok(r.requiredPointers.includes('/study/temperatureSource/'+key));assert.equal(r.inheritedProvisional,true);assert.deepEqual(r.inheritedSourceAssessment,p.study.temperatureSource.sourceAssessment);r.inheritedSourceAssessment.remainingChecks.length=0;assert.deepEqual(p,before);
 delete p.study.temperature;assert.ok(report(p).diagnostics.some(d=>d.target==='/study/temperature')); // saved-project validator still requires this legacy scalar
});
test('case-linked source records exact identity while still validating embedded thermal field',()=>{
 const p=project();p.study.temperatureSource={...source(),caseReference:{schemaVersion:1,caseId:'saved-case',revision:'sha256:'+'a'.repeat(64)}};let r=report(p);assert.deepEqual(r.diagnostics,[]);assert.ok(r.requiredPointers.includes('/study/temperatureSource/caseReference'));assert.ok(r.requiredPointers.includes('/study/temperatureSource/mesh'));assert.ok(r.requiredPointers.includes('/study/temperatureSource/temperature'));
 for(const mutate of [s=>s.caseReference.revision='wrong',s=>s.caseReference.caseId='',s=>s.caseReference.extra=1,s=>s.temperature=[20],s=>s.sourceAssessment={provisional:true}]){const q=structuredClone(p);mutate(q.study.temperatureSource);assert.ok(report(q).diagnostics.length);}
});
test('case identity never substitutes for embedded payload provenance pointers during saved-input replay',()=>{
 const p=project();p.study.temperatureSource={...source(),caseReference:{schemaVersion:1,caseId:'unchanged-case',revision:'sha256:'+'b'.repeat(64)}};
 const pointers=report(p).requiredPointers;for(const key of ['mesh','temperature','caseReference'])assert.ok(pointers.includes('/study/temperatureSource/'+key));
 const before=structuredClone(p.study.temperatureSource);p.study.temperatureSource.temperature[0]+=1;p.study.temperatureSource.mesh.nodes[0]+=.1;assert.deepEqual(p.study.temperatureSource.caseReference,before.caseReference);assert.notDeepEqual(p.study.temperatureSource.temperature,before.temperature);assert.notDeepEqual(p.study.temperatureSource.mesh,before.mesh);assert.deepEqual(report(p).requiredPointers,pointers); // provenance verifier must compare these actual snapshots
});
test('temperature-dependent interpolation accepts actual Worker scope without requiring unused base constants',()=>{
 const p=dependent(),r=report(p);assert.equal(r.contract,'temperature-dependent-isotropic-structure');assert.deepEqual(r.diagnostics,[]);assert.ok(r.requiredPointers.includes('/study/materialTemperature'));assert.ok(r.requiredPointers.includes('/materialProperties/dependence/elasticTemperatureTable'));assert.ok(!r.requiredPointers.includes('/materialProperties/youngModulus'));assert.ok(!r.requiredPointers.includes('/materialProperties/expansion'));
 delete p.study.materialTemperature;assert.ok(report(p).diagnostics.some(d=>d.target==='/study/materialTemperature'));p.study.materialTemperature=101;assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STRESS_MATERIAL_EVALUATION_UNSUPPORTED'));
 const t=project();t.materialProperties.dependence=table();t.study.temperatureSource=source();assert.ok(report(t).diagnostics.some(d=>d.code==='THERMAL_STRESS_MATERIAL_EVALUATION_UNSUPPORTED'));t.study.temperatureSource.temperature=[40,40,40,40];assert.deepEqual(report(t).diagnostics,[]);t.materialProperties.temperatureMax=39;assert.ok(report(t).diagnostics.length);
});
test('static material applicability without a temperature table uses explicit actual evaluation temperature',()=>{
 const p=project();delete p.study.thermalStress;delete p.study.temperature;delete p.study.referenceTemperature;delete p.materialProperties.expansion;p.study.materialTemperature=30;p.materialProperties.temperatureMin=20;p.materialProperties.temperatureMax=40;
 let r=report(p);assert.equal(r.contract,'temperature-dependent-isotropic-structure');assert.deepEqual(r.diagnostics,[]);for(const pointer of ['/study/materialTemperature','/materialProperties/temperatureMin','/materialProperties/temperatureMax','/materialProperties/youngModulus','/materialProperties/poissonRatio'])assert.ok(r.requiredPointers.includes(pointer));assert.ok(!r.requiredPointers.includes('/study/thermalStress'));
 p.study.materialTemperature=41;assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STRESS_MATERIAL_EVALUATION_UNSUPPORTED'));p.study.materialTemperature=30;p.materialProperties.dependence={rateDependent:true};assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STRESS_MATERIAL_EVALUATION_UNSUPPORTED'));p.materialProperties.dependence={rateDependent:false,strainRateMin:0};assert.deepEqual(report(p).diagnostics,[]);assert.ok(report(p).requiredPointers.includes('/materialProperties/dependence/rateDependent'));
});
test('all implemented structural methods and adaptive options remain available; incompatible models are diagnosed',()=>{
 for(const p of [project(),dependent()])for(const method of ['pcg','pcg-strict','wasm-pcg','webgpu-pcg','mfem-wasm'])assert.deepEqual(report(p,{method,adaptive:true,size:2,maxRounds:2}).diagnostics,[]);
 for(const key of ['orthotropic','plasticity','hyperelastic']){const p=project();p.materialProperties[key]={};assert.ok(report(p).diagnostics.some(d=>d.code==='THERMAL_STRESS_MODEL_UNSUPPORTED'));}
 for(const mutate of [p=>p.study.modalAnalysis=true,p=>p.study.kind='thermal',p=>p.materialProperties.expansion=Infinity,p=>p.study.temperature=-274,p=>p.study.referenceTemperature=null,p=>p.conditions=[],p=>p.conditions[0].regions=[]]){const p=project();mutate(p);assert.ok(report(p).diagnostics.length);}
 for(const key of ['fatigueAssessment','fractureAssessment'])assert.ok(report(project(),{[key]:{}}).diagnostics.length);
});
test('runtime physical overrides distinguish unset and null while same saved values and numerical settings remain valid',()=>{
 const p=project();for(const key of ['temperature','referenceTemperature','gravityEnabled','thermalStress']){assert.deepEqual(report(p,{[key]:p.study[key]}).diagnostics,[]);assert.ok(report(p,{[key]:null}).diagnostics.some(d=>d.code==='THERMAL_STRESS_RUNTIME_OVERRIDE'));}
 for(const key of ['temperatureSource','gravity','materialTemperature'])assert.ok(report(p,{[key]:null}).diagnostics.some(d=>d.code==='THERMAL_STRESS_RUNTIME_OVERRIDE'&&d.target==='/options/'+key));
 for(const key of ['boundary','fixed','forces','displacements','tractions','pressures','loads','supports','force','pressure','normalTraction','displacement','prestress','expansionCoefficient'])assert.ok(report(p,{[key]:[]}).diagnostics.some(d=>d.code==='THERMAL_STRESS_RUNTIME_OVERRIDE'));
 assert.deepEqual(report(p,{materialProperties:structuredClone(p.materialProperties),conditions:structuredClone(p.conditions)}).diagnostics,[]);assert.ok(report(p,{expansion:2e-5}).diagnostics.length);
});
test('legacy remains unchanged and malformed contracts return diagnostics without throwing',()=>{
 for(const p of [null,{},project(),dependent()]){assert.deepEqual(inspect(p).diagnostics,[]);assert.deepEqual(inspect(p).requiredPointers,[]);}
 for(const p of [null,[],{}, {study:4,conditions:[null]}])assert.ok(report(p).diagnostics.length);assert.ok(inspect(project(),null,{mode:'quantitative'}).diagnostics.length);assert.ok(inspect(project(),{}, {mode:'invalid'}).diagnostics.length);const r=report(project());r.units.expansion='changed';assert.equal(report(project()).units.expansion,'1/K');
});
