import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createHost,solveCase,roundTrip,quartiles} from '../scripts/measure-case-archive-transfer.mjs';
import {canonicalJson,getProjectRevision} from '../src/project-revision.js';

// Verbatim copy of the pre-optimisation implementation (git history of src/project-revision.js). The comparisons below
// are platform independent: they never pin hashes of solver output, only equality with this reference on the same input.
const plain=value=>value!==null&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
function oldCanonicalJson(value,seen=new Set()) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(typeof value!=='object'||(!Array.isArray(value)&&!plain(value)))throw new TypeError('Project operations require JSON data.');
  if(seen.has(value))throw new TypeError('Cyclic JSON data is not supported.');
  seen.add(value);
  let result;
  if(Array.isArray(value)) {
    if(Reflect.ownKeys(value).length!==value.length+1||Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).some(d=>!d||!d.enumerable||!('value' in d)))throw new TypeError('Sparse, decorated or accessor arrays are not supported.');
    result='['+value.map(item=>oldCanonicalJson(item,seen)).join(',')+']';
  } else {
    if(Reflect.ownKeys(value).some(key=>typeof key!=='string'||!Object.getOwnPropertyDescriptor(value,key).enumerable||!('value' in Object.getOwnPropertyDescriptor(value,key))))throw new TypeError('Only plain JSON properties are supported.');
    result='{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+oldCanonicalJson(value[key],seen)).join(',')+'}';
  }
  seen.delete(value);return result;
}
const oldRevision=value=>'sha256:'+createHash('sha256').update(oldCanonicalJson(value)).digest('hex');

test('canonicalJson equals the reference implementation, including rejected inputs',()=>{
 const shared={a:[1,2,3]},hole=[1,,3],decorated=Object.assign([1,2],{extra:1}),accessor=[1],cyclic=[];
 Object.defineProperty(accessor,0,{get:()=>1,enumerable:true});cyclic.push(cyclic);
 const good=[null,true,'é"\n',0,-0,1e21,1.5e-7,[],{},[1.25,-0,3,1e300,5e-324],[[1,2],[3]],[1,'a',null,{z:1,a:[0.1,0.2]}],{b:[1,2,3],a:{y:[],x:[-0,1]},'':1,'a b':2,10:3,2:4},{x:shared,y:shared},Object.create(null),Array.from({length:5000},(_,i)=>Math.sin(i)*1e5)];
 for(const value of good)assert.equal(canonicalJson(value),oldCanonicalJson(value));
 for(const value of [hole,decorated,accessor,cyclic,[NaN],[1,Infinity],{a:undefined},{a:()=>1},[1,undefined],new Date(0),{[Symbol('s')]:1},Object.defineProperty({},'k',{get:()=>1,enumerable:true}),Object.defineProperty({},'k',{value:1,enumerable:false}),Object.defineProperty([1],'x',{value:1,enumerable:false})]){
  let expected;try{oldCanonicalJson(value);expected=null;}catch(e){expected=e.message;}
  assert.notEqual(expected,null);assert.throws(()=>canonicalJson(value),{message:expected});
 }
 // A memo must not change output.
 const memo=new Map(),nested={cases:[{n:[1,2]},{n:[3]}],version:1};
 assert.equal(canonicalJson(nested,new Set(),memo),oldCanonicalJson(nested));
 assert.equal(canonicalJson(nested.cases[0],new Set(),memo),oldCanonicalJson(nested.cases[0]));
});

test('case archive transfer keeps bytes, hashes and revisions and per-chunk cost does not grow',{timeout:90000},async()=>{
 const output=await solveCase(2),source=createHost(),saves=[];
 source.display.value=output;
 const revision=await getProjectRevision(JSON.parse(JSON.stringify(output)));
 for(let i=0;i<4;i++)saves.push(await source.operations.saveCurrent({name:`large case ${i+1}`,expectedResultRevision:revision}));
 const list=await source.operations.list(),archive=source.store.export();
 assert.equal(list.archiveRevision,oldRevision(archive));
 assert.deepEqual(list.cases.map(c=>c.revision),archive.cases.map(oldRevision));
 assert.deepEqual(saves.map(s=>s.revision),list.cases.map(c=>c.revision));
 const destination=createHost(),trip=await roundTrip(source,destination);
 assert.equal(trip.archiveRevision,list.archiveRevision);
 assert.equal(trip.restoredRevision,list.archiveRevision);
 assert.equal(trip.sha256,'sha256:'+createHash('sha256').update(JSON.stringify(archive)).digest('hex'));
 assert.equal(trip.bytes.toString(),JSON.stringify(archive));
 assert.deepEqual((await destination.operations.list()).cases.map(c=>c.revision),list.cases.map(c=>c.revision));
 // Per-chunk cost must not depend on how much has already been staged/read. Generous factor and absolute floor for loaded CI.
 for(const [label,times] of [['write',trip.writeTimes],['read',trip.readTimes]]){
  assert.ok(times.length>=60,`${label}: enough chunks`);
  const {firstQuarterMeanMs:first,lastQuarterMeanMs:last}=quartiles(times);
  assert.ok(last<=Math.max(5*first,25),`${label}: last-quarter mean ${last} ms vs first-quarter mean ${first} ms`);
 }
});
