import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildCurvedPressureTransferOperator as build,applyCurvedPressureTransferOperator as apply,applyCurvedPressureTranspose as transpose,evaluateCurvedPressureVirtualWork as work,serializeCurvedPressureTransferOperator as serialize,loadCurvedPressureTransferOperator as load} from '../src/curved-pressure-operator.js';

test('independent facet, conjugate-work, rigid-transform and zero-resultant oracles',async()=>{
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-20+Math.max(Math.abs(a),Math.abs(b))*1e-12,`${a} != ${b}`),matrix=(a,b)=>a.forEach((v,i)=>close(v,b[i]));
const g={lengthUnit:'mm',surface:'open',nodes:[0,0,0,2,0,0,0,3,0],triangles:[[0,1,2]]},p={units:'Pa',values:[{real:2,imag:3}]},u={units:'m',real:[0,0,.001,0,0,.002,0,0,.004],imag:[0,0,-.001,0,0,.003,0,0,.002]},before=JSON.stringify({g,p,u});
const op=await build(g),f=await apply(op,g,p),v=await transpose(op,g,u),w=await work(op,g,p,u);matrix(f.forceReal,[0,0,-2e-6,0,0,-2e-6,0,0,-2e-6]);matrix(f.forceImag,[0,0,-3e-6,0,0,-3e-6,0,0,-3e-6]);matrix(f.momentReal,[-6e-9,4e-9,0]);matrix(f.momentImag,[-9e-9,6e-9,0]);close(v.totalVolumeReal,7e-9);close(v.totalVolumeImag,4e-9);close(w.nodalWork.real,-26e-9);close(w.nodalWork.imag,-13e-9);assert.equal(JSON.stringify({g,p,u}),before);assert.ok(Object.isFrozen(op.faces[0].nodeIds));const restored=await load(serialize(op),g);assert.deepEqual(restored.operator,op);
// Rotate 90 degrees around x; independent component permutation/signs only.
const rot=a=>[a[0],-a[2],a[1]],vectors=a=>Array.from({length:a.length/3},(_,i)=>rot(a.slice(i*3,i*3+3))).flat(),rg={...g,nodes:vectors(g.nodes)},ru={units:'m',real:vectors(u.real),imag:vectors(u.imag)},ro=await build(rg),rf=await apply(ro,rg,p),rw=await work(ro,rg,p,ru);matrix(rf.forceReal,vectors(f.forceReal));matrix(rf.momentReal,rot(f.momentReal));close(rw.nodalWork.real,w.nodalWork.real);close(rw.nodalWork.imag,w.nodalWork.imag);
const shifted={...g,nodes:g.nodes.map((x,i)=>x+[10,-20,30][i%3])},sf=await apply(await build(shifted),shifted,p);matrix(sf.momentReal,[114e-9,64e-9,0]);matrix(sf.momentImag,[171e-9,96e-9,0]);
const t={lengthUnit:'mm',surface:'closed',nodes:[0,0,0,1,0,0,0,1,0,0,0,1],triangles:[[1,2,3],[0,3,2],[0,1,3],[0,2,1]]},tp={units:'Pa',values:t.triangles.map(()=>({real:2,imag:3}))},tu={units:'m',real:t.nodes.map(x=>x*1e-5),imag:t.nodes.map(x=>x*2e-5)},to=await build(t),tf=await apply(to,t,tp),tw=await work(to,t,tp,tu);matrix(tf.resultantReal,[0,0,0]);matrix(tf.momentReal,[0,0,0]);matrix(tf.forceReal,[1/3e6,1/3e6,1/3e6,-1/3e6,0,0,0,-1/3e6,0,0,0,-1/3e6]);close(tw.nodalWork.real,-40e-12);close(tw.nodalWork.imag,5e-12);
// Snapshot both payloads before the first await; no issued object spoofing.
const mg=structuredClone(g),mp=structuredClone(p),pending=apply(op,mg,mp);mg.nodes[0]=99;mp.values[0].real=99;assert.deepEqual(await pending,f);await assert.rejects(apply(JSON.parse(serialize(op)),g,p));
console.log(JSON.stringify({singleFacet:true,conjugateWork:true,rotation:true,translationMoment:true,closedZeroResultantNonzeroLoads:true,roundTrip:true,asyncSnapshot:true,passed:true}));

});

test('independent self-rehashed tamper, capacity, plain-data and geometry identity refusal',async()=>{
const g=()=>({lengthUnit:'mm',surface:'open',nodes:[0,0,0,2,0,0,0,3,0],triangles:[[0,1,2]]}),geometry=g(),op=await build(geometry),raw=serialize(op),canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
for(const change of [x=>x.faces[0].areaWeightM2*=2,x=>x.faces[0].outwardNormal[2]=-1,x=>x.faces[0].nodeIds.reverse(),x=>x.scope.solverConnected=true,x=>x.units.displacement='mm']){const record=JSON.parse(raw);change(record);const {operatorRevision,...payload}=record;record.operatorRevision='sha256:'+createHash('sha256').update(canonical(payload)).digest('hex');await assert.rejects(load(canonical(record),geometry));}
let accessed=0;const bad=g();Object.defineProperty(bad.nodes,'0',{enumerable:true,get(){accessed++;return 0;}});await assert.rejects(build(bad));assert.equal(accessed,0);
const subclass=g();Object.setPrototypeOf(subclass.triangles,{__proto__:Array.prototype,map(){throw Error('must not invoke map');}});await assert.rejects(build(subclass));
for(const bad of [{...g(),nodes:Array(3*4097).fill(0)},{...g(),triangles:Array.from({length:513},()=>[0,1,2])},{...g(),nodes:[0,0,0,Infinity,0,0,0,3,0]},{...g(),triangles:[[0,0,2]]},{...g(),triangles:[[0,1,2],[2,1,0]]},{...g(),lengthUnit:'m'}])await assert.rejects(build(bad));
const reversed=g();reversed.triangles[0].reverse();await assert.rejects(apply(op,reversed,{units:'Pa',values:[{real:2,imag:3}]}));await assert.rejects(load(raw+' '.repeat(1048576),geometry));const before=JSON.stringify(geometry);await assert.rejects(apply(op,geometry,{units:'kPa',values:[{real:2,imag:3}]}));assert.equal(JSON.stringify(geometry),before);

});
