import {canonicalJson} from './project-revision.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const escape=value=>value.replace(/~/g,'~0').replace(/\//g,'~1');
export function summarizeProjectChanges(before,after){
 const pointers=[];let total=0;
 const add=pointer=>{total++;if(pointers.length<100)pointers.push(pointer);};
 function visit(a,b,pointer){
  if(a===b)return;
  if(Array.isArray(a)||Array.isArray(b)){if(canonicalJson(a)!==canonicalJson(b))add(pointer);return;}
  if(plain(a)&&plain(b))for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
   const path=pointer+'/'+escape(key);if(!Object.hasOwn(a,key)||!Object.hasOwn(b,key))add(path);else visit(a[key],b[key],path);
  }else add(pointer);
 }
 visit(before,after,'');return {pointers,total,truncated:total>100,maxPointers:100};
}
