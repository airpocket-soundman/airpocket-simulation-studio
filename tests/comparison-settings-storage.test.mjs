import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserComparisonStorage} from '../src/ui/comparison-settings-storage.js';
function local(){const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
function idb(){const data=new Map(),names=[];let failWrite=false;
 const request=value=>{const req={};queueMicrotask(()=>{req.result=value;if(failWrite&&value==='write'){req.error=Error('Quota');req.onerror();}else req.onsuccess();});return req;};
 const store={get:key=>request(data.get(key)),put(value,key){if(!failWrite)data.set(key,value);return request('write');}};
 return {data,names,fail:()=>{failWrite=true;},open(name){names.push(name);const req={};queueMicrotask(()=>{req.result={createObjectStore(){},transaction:()=>({objectStore:()=>store})};req.onupgradeneeded?.();req.onsuccess();});return req;}};
}
test('preferred IndexedDB is namespaced and backend remains pinned after later quota failure',async()=>{
 const db=idb(),ls=local(),storage=createBrowserComparisonStorage({indexedDB:db,localStorage:ls});assert.equal(await storage.get(),null);await storage.set('first');assert.deepEqual(db.names,['airpocket-comparison-settings']);db.fail();await assert.rejects(storage.set('second'),/Quota/);assert.equal(await storage.get(),'first');assert.equal(ls.data.size,0);
});
test('fallback remains authoritative after database recovery and settings-free tombstone prevents resurrection',async()=>{
 const ls=local(),fallback=createBrowserComparisonStorage({indexedDB:{open(){throw Error('Blocked');}},localStorage:ls});await fallback.set('saved');assert.equal(ls.data.get('airpocket-comparison-settings:current'),'saved');
 const recovered=idb();recovered.data.set('current','old-primary');const storage=createBrowserComparisonStorage({indexedDB:recovered,localStorage:ls});assert.equal(await storage.get(),'saved');const tombstone='{"version":1,"enabled":false,"archive":null}';await storage.set(tombstone);
 const reloaded=createBrowserComparisonStorage({indexedDB:recovered,localStorage:ls});assert.equal(await reloaded.get(),tombstone);assert.equal(recovered.names.length,0);
});
test('denied storage rejects operations rather than leaking into measurement-history keys',async()=>{
 const storage=createBrowserComparisonStorage({localStorage:{getItem(){throw Error('Denied');}}});await assert.rejects(storage.get());await assert.rejects(storage.set('x'));
});
