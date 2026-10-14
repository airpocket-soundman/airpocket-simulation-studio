import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fetchPublishedProgress as fetchProgress,MAX_PUBLISHED_PROGRESS_BYTES} from '../src/published-progress.js';
const encode=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
const progress=(date='2026-10-15T00:00:00Z')=>({version:1,updatedAt:date,release:{version:'v0.43',date:'2026-10-14',description:'公開履歴'},tasks:[{id:'A',title:'入力検査',detail:'Reference',category:'API',status:'checking'}],solvers:[['Airpocket','構造','対応済み']]});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=(bytes,extra={})=>({schema:1,version:'0.43.0',revision:'a'.repeat(40),dirty:false,files:{'progress.json':{bytes:bytes.length,sha256:hash(bytes)}},...extra});
function fixture(p=progress(),patch={}){const bytes=p instanceof Uint8Array?p:encode(p),m=manifest(bytes,patch),calls=[];let manifestReads=0;const fetcher=async(url,options)=>{calls.push({url,options});const u=new URL(url);if(u.pathname==='/app/runtime-manifest.json'){manifestReads++;return new Response(JSON.stringify(m));}if(u.pathname==='/app/progress.json')return new Response(bytes);throw Error('Unexpected source: '+url);};return {bytes,m,calls,fetcher,get manifestReads(){return manifestReads;}};}
const read=h=>fetchProgress({baseUrl:'https://example.test/app/',fetcher:h.fetcher,nonce:'test'});
test('verified progress uses same-origin bytes, clean manifest revision and a second stable manifest without repository fallback',async()=>{
 const h=fixture(),r=await read(h);assert.equal(r.verified,true);assert.equal(r.revision,'a'.repeat(40));assert.equal(r.applicationVersion,'0.43.0');assert.equal(r.progressBytes,h.bytes.length);assert.equal(r.progressSha256,hash(h.bytes));assert.deepEqual(r.progress,progress());assert.equal(h.calls.length,3);assert.equal(h.manifestReads,2);for(const call of h.calls){assert.equal(new URL(call.url).origin,'https://example.test');assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.ok(call.options.signal instanceof AbortSignal);}assert.notEqual(h.calls[0].url,h.calls[2].url);assert.equal(new URL(h.calls[1].url).searchParams.get('sha'),hash(h.bytes));
 r.progress.tasks[0].title='Modified';assert.equal((await read(h)).progress.tasks[0].title,'入力検査');
});
test('old manifest with new progress, changed lengths, or changed final publication never returns an adopted snapshot',async()=>{
 for(const kind of ['hash','length','changed']){
  const h=fixture(),old=h.fetcher;let reads=0;h.fetcher=async(url,opts)=>{const u=new URL(url);if(u.pathname.endsWith('progress.json')&&kind==='hash')return new Response(encode({...progress(),release:{...progress().release,version:'v0.44'}}));if(u.pathname.endsWith('progress.json')&&kind==='length')return new Response(h.bytes.subarray(0,h.bytes.length-1));if(u.pathname.endsWith('runtime-manifest.json')&&kind==='changed'&&++reads===2)return new Response(JSON.stringify({...h.m,revision:'b'.repeat(40)}));return old(url,opts);};
  await assert.rejects(read(h),e=>['PUBLISHED_PROGRESS_INTEGRITY','PUBLISHED_PROGRESS_CHANGED','PUBLISHED_PROGRESS_SIZE'].includes(e.code));
 }
});
test('invalid manifest, dirty builds and missing local development manifest fail closed without fetching raw main',async()=>{
 for(const patch of [{dirty:true},{revision:'wrong'},{version:'bad'},{schema:2},{files:{}},{files:{'progress.json':{bytes:MAX_PUBLISHED_PROGRESS_BYTES+1,sha256:'a'.repeat(64)}}}]){const h=fixture(progress(),patch);await assert.rejects(read(h),{code:'PUBLISHED_PROGRESS_MANIFEST'});assert.equal(h.calls.length,1);}
 const calls=[];await assert.rejects(fetchProgress({baseUrl:'http://127.0.0.1:5173/',fetcher:async url=>{calls.push(url);return new Response('missing',{status:404});}}),{code:'PUBLISHED_PROGRESS_NOT_FOUND'});assert.equal(calls.length,1);assert.equal(new URL(calls[0]).hostname,'127.0.0.1');
});
test('invalid UTF-8, JSON and presentation metadata do not replace previous verified progress',async()=>{
 let shown=(await read(fixture())).progress;
 for(const bad of [new Uint8Array([0xff]),encode('{'),{...progress(),tasks:null},{...progress(),release:{}},{...progress(),solvers:[42]},{...progress(),tasks:[{...progress().tasks[0],evidence:{not:'text'}}]}]){const previous=structuredClone(shown);try{shown=(await read(fixture(bad))).progress;assert.fail('Invalid snapshot adopted');}catch(e){assert.ok(['PUBLISHED_PROGRESS_JSON','PUBLISHED_PROGRESS_INVALID'].includes(e.code));}assert.deepEqual(shown,previous);}
});
test('stream and declared-size limits stop oversized responses and cancel pending bodies',async()=>{
 let cancelled=0;const oversize=new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));},cancel(){cancelled++;}});await assert.rejects(fetchProgress({baseUrl:'https://example.test/',fetcher:async()=>new Response(oversize)}),{code:'PUBLISHED_PROGRESS_SIZE'});assert.equal(cancelled,1);
 const headerBody=new ReadableStream({cancel(){cancelled++;}});await assert.rejects(fetchProgress({baseUrl:'https://example.test/',fetcher:async()=>new Response(headerBody,{headers:{'Content-Length':'65537'}})}),{code:'PUBLISHED_PROGRESS_SIZE'});assert.equal(cancelled,2);
 const h=fixture();h.m.files['progress.json'].bytes=2;await assert.rejects(read(h),{code:'PUBLISHED_PROGRESS_SIZE'});
});
test('verified older publication remains valid for rollback instead of selecting the newest timestamp',async()=>{
 const newer=await read(fixture()),h=fixture(progress('2026-10-14T00:00:00Z'),{revision:'b'.repeat(40)}),older=await read(h);assert.ok(Date.parse(older.progress.updatedAt)<Date.parse(newer.progress.updatedAt));assert.equal(older.revision,'b'.repeat(40));assert.equal(older.verified,true);
});
test('transport failures, absent streams and invalid configuration reject with no success object',async()=>{
 await assert.rejects(fetchProgress({baseUrl:'https://example.test/',fetcher:async()=>{throw Error('network down');}}),/network down/);
 await assert.rejects(fetchProgress({baseUrl:'https://example.test/',fetcher:async()=>({ok:true,headers:new Headers(),body:null})}),{code:'PUBLISHED_PROGRESS_BODY'});
 for(const patch of [{baseUrl:'file:///tmp/'},{baseUrl:'https://user:pass@example.test/'},{timeoutMs:0},{timeoutMs:30001},{fetcher:4}])await assert.rejects(fetchProgress({baseUrl:'https://example.test/',...patch}),TypeError);
});
