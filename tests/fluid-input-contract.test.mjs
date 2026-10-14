import {test} from 'node:test';import assert from 'node:assert/strict';
import {inspectFluidInputContract as inspect} from '../src/fluid-input-contract.js';
const channel=()=>({study:{kind:'channelFlow',dynamicViscosity:.001,fluidDensity:1000,fluidSoundSpeed:1480,pressureDropPa:.01,flowAxis:1},sourceModel:{kind:'box',bounds:[0,0,0,10,40,10]},conditions:[]});
const stokes=()=>({study:{kind:'creepingFlow',dynamicViscosity:1,fluidDensity:1000,freeStreamVelocity:[.001,0,0],referenceLengthMm:10,stokesVelocityElement:'P1'},sourceModel:{kind:'fluidDomain',solid:{kind:'sphere',center:[0,0,0],radius:5},enclosure:[-20,-20,-20,40,40,40]},conditions:[]});
const report=(p,options={})=>inspect(p,options,{mode:'quantitative'});
test('existing builtin straight channels declare explicit physical inputs and fixed cylinder scope',()=>{
 for(const source of [{kind:'box',bounds:[0,0,0,10,40,10]},{kind:'cylinder'}]){const p=channel();p.sourceModel=source;const before=structuredClone(p),r=report(p);assert.equal(r.contract,'fully-developed-channel-flow');assert.deepEqual(r.diagnostics,[]);for(const pointer of ['/study/kind','/study/dynamicViscosity','/study/fluidDensity','/study/fluidSoundSpeed','/study/pressureDropPa','/study/flowAxis','/conditions','/sourceModel/kind'])assert.ok(r.requiredPointers.includes(pointer));assert.deepEqual(p,before);}
 const cylinder=channel();cylinder.sourceModel={kind:'cylinder'};cylinder.study.flowAxis=0;assert.ok(report(cylinder).diagnostics.some(d=>d.code==='FLUID_DOMAIN_UNSUPPORTED'));
});
test('internal channel includes explicit enclosure seed and paired axis ports but does not assert CAD channel validation',()=>{
 const p=channel();p.sourceModel={kind:'fluidDomain',mode:'internal',solid:{kind:'tube',center:[0,0,0],axis:1,outerRadius:12,innerRadius:8,length:60},enclosure:[-12,-30,-12,24,60,24],seedPoint:[0,0,0],portPlanes:[1,4]};const r=report(p);assert.deepEqual(r.diagnostics,[]);for(const pointer of ['/sourceModel/enclosure','/sourceModel/seedPoint','/sourceModel/portPlanes','/sourceModel/solid/kind','/sourceModel/solid/innerRadius','/sourceModel/solid/axis'])assert.ok(r.requiredPointers.includes(pointer));
 p.sourceModel.portPlanes=[0,3];assert.ok(report(p).diagnostics.some(d=>d.code==='FLUID_DOMAIN_UNSUPPORTED'));
 p.sourceModel.portPlanes=[];assert.ok(report(p).diagnostics.some(d=>d.target==='/sourceModel/portPlanes'));
});
test('external creeping flow covers P1 and P2 with explicit scale and low Reynolds checks',()=>{
 for(const element of ['P1','P2']){const p=stokes();p.study.stokesVelocityElement=element;const r=report(p);assert.equal(r.contract,'external-creeping-stokes-flow');assert.deepEqual(r.diagnostics,[]);for(const key of ['freeStreamVelocity','referenceLengthMm','stokesVelocityElement'])assert.ok(r.requiredPointers.includes('/study/'+key));assert.ok(r.requiredPointers.includes('/sourceModel/solid/radius'));assert.ok(!r.requiredPointers.includes('/sourceModel/solid/data'));}
 const p=stokes();p.sourceModel.solid={kind:'step',data:'QUJD'};assert.deepEqual(report(p).diagnostics,[]);assert.ok(!report(p).requiredPointers.includes('/sourceModel/solid/data'));
 p.study.referenceLengthMm=1000;assert.ok(report(p).diagnostics.some(d=>d.code==='FLUID_REGIME_UNSUPPORTED'));
});
test('missing invalid and unsupported regimes report stable diagnostics without inferring values',()=>{
 for(const [mutate,target]of [[p=>delete p.study.dynamicViscosity,'/study/dynamicViscosity'],[p=>p.study.fluidDensity=0,'/study/fluidDensity'],[p=>p.study.freeStreamVelocity=[0,0,0],'/study/freeStreamVelocity'],[p=>delete p.study.referenceLengthMm,'/study/referenceLengthMm'],[p=>delete p.study.stokesVelocityElement,'/study/stokesVelocityElement'],[p=>p.conditions=[{type:'force'}],'/conditions']]){const p=stokes();mutate(p);assert.ok(report(p).diagnostics.some(d=>d.target===target));}
 const internal=stokes();internal.sourceModel.mode='internal';internal.sourceModel.seedPoint=[0,0,0];internal.sourceModel.portPlanes=[0,3];assert.ok(report(internal).diagnostics.some(d=>d.code==='FLUID_DOMAIN_UNSUPPORTED'));
 const sphere=stokes();sphere.sourceModel.enclosure={kind:'sphere',center:[0,0,0],radius:20};assert.ok(report(sphere).diagnostics.some(d=>d.target==='/sourceModel/enclosure'));
 const exterior=channel();exterior.sourceModel=stokes().sourceModel;assert.ok(report(exterior).diagnostics.some(d=>d.code==='FLUID_DOMAIN_UNSUPPORTED'));
 for(const value of [0,NaN,Infinity]){const p=channel();p.study.fluidSoundSpeed=value;assert.ok(report(p).diagnostics.length);}
});
test('physical runtime keys cannot silently differ and equal vectors are accepted by value',()=>{
 const p=stokes();for(const key of ['dynamicViscosity','fluidDensity','freeStreamVelocity','referenceLengthMm','stokesVelocityElement']){const equal=structuredClone(p.study[key]);assert.deepEqual(report(p,{[key]:equal}).diagnostics,[]);const different=Array.isArray(equal)?equal.map(v=>v+1):typeof equal==='number'?equal+1:'P2';assert.ok(report(p,{[key]:different}).diagnostics.some(d=>d.code==='FLUID_RUNTIME_OVERRIDE'));}
 assert.deepEqual(report(p,{method:'pcg',size:2}).diagnostics,[]);const c=channel();for(const key of ['fluidSoundSpeed','pressureDropPa','flowAxis'])assert.ok(report(c,{[key]:c.study[key]+1}).diagnostics.some(d=>d.code==='FLUID_RUNTIME_OVERRIDE'));
});
test('legacy remains unchanged and malformed projects do not throw or leak unit mutations',()=>{
 for(const p of [null,[],{},channel()]){assert.deepEqual(inspect(p).diagnostics,[]);assert.deepEqual(inspect(p).requiredPointers,[]);}
 for(const p of [null,[],{}, {study:null,sourceModel:null,conditions:[null]}])assert.ok(report(p).diagnostics.length);
 assert.ok(inspect(channel(),null,{mode:'quantitative'}).diagnostics.length);const r=report(channel());assert.equal(r.units.dynamicViscosity,'Pa*s');assert.equal(r.units.freeStreamVelocity,'m/s');r.units.dynamicViscosity='bad';assert.equal(report(channel()).units.dynamicViscosity,'Pa*s');
});
