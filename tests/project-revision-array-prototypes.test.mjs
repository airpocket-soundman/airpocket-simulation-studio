import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalJson,getProjectRevision} from '../src/project-revision.js';
test('numeric toJSON and object map prototype spoofs refuse without invoking caller code',async()=>{
 for(const numeric of [true,false]){
  const value=numeric?[999]:[{actual:999}];let called=false;
  Object.setPrototypeOf(value,{__proto__:Array.prototype,get toJSON(){called=true;return ()=>[0];},get map(){called=true;return ()=>({join:()=>'{"actual":0}'});}});
  assert.throws(()=>canonicalJson(value),TypeError);await assert.rejects(getProjectRevision(value),TypeError);assert.equal(called,false);
 }
 class Derived extends Array{}assert.throws(()=>canonicalJson(new Derived(1,2)),TypeError);
});
test('ordinary JSON canonical bytes and SHA stay identical and accessors never execute',async()=>{
 const data={z:[1,-0,1.5],a:[null,true,'x',{b:2,a:1}],empty:[]};const expected='{"a":[null,true,"x",{"a":1,"b":2}],"empty":[],"z":[1,0,1.5]}';
 assert.equal(canonicalJson(data),expected);assert.equal(await getProjectRevision(data),'sha256:'+createHash('sha256').update(expected).digest('hex'));
 const nullRecord=Object.assign(Object.create(null),{b:2,a:[3]});assert.equal(canonicalJson(nullRecord),'{"a":[3],"b":2}');
 let invoked=false;const accessor=[0];Object.defineProperty(accessor,'0',{enumerable:true,get(){invoked=true;return 1;}});assert.throws(()=>canonicalJson(accessor),TypeError);assert.equal(invoked,false);
});
