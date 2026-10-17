import {createIndexedDbStorage,createLocalStorageAdapter} from './measurement-history-storage.js';

// Dedicated origin-local record. Pin the backend after discovery so later quota/errors
// cannot read an older fallback. A disabled, settings-free record is a deletion tombstone.
export function createBrowserComparisonStorage({indexedDB,localStorage}={}){
 let primary,fallback,selected,opening;
 try{primary=createIndexedDbStorage(indexedDB,{databaseName:'airpocket-comparison-settings'});}catch{}
 try{fallback=createLocalStorageAdapter(localStorage,{prefix:'airpocket-comparison-settings:'});}catch{}
 const choose=()=>opening??=Promise.resolve().then(async()=>{
  if(fallback)try{if(await fallback.get('current')!==null)return selected=fallback;}catch{}
  if(primary)try{await primary.get('current');return selected=primary;}catch{}
  if(fallback){await fallback.get('current');return selected=fallback;}
  throw Error('Comparison settings storage unavailable');
 });
 return {async get(){await choose();return selected.get('current');},async set(text){await choose();return selected.set('current',text);}};
}
