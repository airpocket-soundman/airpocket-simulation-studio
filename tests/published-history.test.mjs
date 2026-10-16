import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fetchPublishedProgress,MAX_PUBLISHED_HISTORY_BYTES} from '../src/published-progress.js';
import {HISTORY_PATH} from '../src/progress-history.js';
import {statusNames} from '../src/progress.js';
import {validateRuntimeManifest} from '../scripts/runtime-manifest.mjs';

const encode=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const REVISION='a'.repeat(40);
const progress={version:1,updatedAt:'2026-10-15T00:00:00Z',release:{version:'v0.43',date:'2026-10-14',description:'公開履歴'},tasks:[{id:'A',title:'入力検査',detail:'Reference',category:'API',status:'checking'}],solvers:[['Airpocket','構造','対応済み']]};
const historyFor=(progressBytes,patch={})=>({schemaVersion:1,kind:'progress-history',path:HISTORY_PATH,statuses:[...statusNames],head:{revision:REVISION,progressSha256:hash(progressBytes),progressBytes:progressBytes.length},
 completeness:{shallow:false,truncated:false,maxPoints:1000,commitsListed:1,pointCount:1,skippedCount:0,timestampRegressions:0},
 points:[{revision:'b'.repeat(40),committedAt:'2026-10-14T00:00:00Z',total:1,counts:{queued:0,building:0,checking:1,fixing:0,ready:0,released:0},addedCount:null,removedCount:null,added:[],removed:[]}],skipped:[],...patch});
/** A publication server. `serveHistory` can replace the bytes actually served for the history file. */
function publication({history,historyBytes,manifestHistory='auto',serveHistory,manifestPatch={}}={}){
 const progressBytes=encode(progress),h=historyBytes??encode(history??historyFor(progressBytes)),calls=[];
 const files={'progress.json':{bytes:progressBytes.length,sha256:hash(progressBytes)}};
 if(manifestHistory==='auto')files['progress-history.json']={bytes:h.length,sha256:hash(h)};else if(manifestHistory)files['progress-history.json']=manifestHistory;
 const manifest={schema:1,version:'0.43.0',revision:REVISION,dirty:false,files,...manifestPatch};let manifestReads=0;
 const fetcher=async(url,options)=>{calls.push({url,options});const u=new URL(url);
  if(u.pathname==='/app/runtime-manifest.json'){manifestReads++;return new Response(JSON.stringify(typeof manifestPatch.after==='function'&&manifestReads===2?manifestPatch.after(manifest):manifest));}
  if(u.pathname==='/app/progress.json')return new Response(progressBytes);
  if(u.pathname==='/app/progress-history.json'){const body=serveHistory?serveHistory(h):h;if(body instanceof Error)throw body;return new Response(body);}
  throw Error('Unexpected source '+url);};
 return {fetcher,calls,manifest,progressBytes,historyBytes:h};
}
const read=(p,extra={})=>fetchPublishedProgress({baseUrl:'https://example.test/app/',fetcher:p.fetcher,nonce:'n',includeHistory:true,...extra});

test('history is read inside the same manifest bracket and bound to the verified candidate and progress bytes',async()=>{
 const p=publication(),r=await read(p);
 assert.equal(r.verified,true);assert.equal(r.history.status,'verified');assert.equal(r.history.history.head.revision,r.revision);assert.equal(r.history.history.head.progressSha256,r.progressSha256);assert.equal(r.history.historySha256,hash(p.historyBytes));
 assert.deepEqual(p.calls.map(c=>new URL(c.url).pathname),['/app/runtime-manifest.json','/app/progress.json','/app/progress-history.json','/app/runtime-manifest.json']);
 const historyCall=p.calls[2];assert.equal(new URL(historyCall.url).searchParams.get('sha'),hash(p.historyBytes));
 for(const c of p.calls){assert.equal(new URL(c.url).origin,'https://example.test');assert.equal(c.options.cache,'no-store');assert.equal(c.options.credentials,'omit');assert.equal(c.options.redirect,'error');assert.ok(c.options.signal instanceof AbortSignal);}
 r.history.history.points[0].counts.checking=9;assert.equal((await read(publication())).history.history.points[0].counts.checking,1);
});
test('without includeHistory nothing about history is requested or returned',async()=>{
 const p=publication(),r=await fetchPublishedProgress({baseUrl:'https://example.test/app/',fetcher:p.fetcher,nonce:'n'});
 assert.equal(p.calls.length,3);assert.equal('history' in r,false);assert.equal(r.verified,true);
});
test('manifests published before the history artifact stay valid and report it absent while progress still verifies',async()=>{
 const p=publication({manifestHistory:null}),r=await read(p);
 assert.equal(r.verified,true);assert.deepEqual(r.history,{status:'unavailable',code:'PUBLISHED_HISTORY_ABSENT'});assert.equal(p.calls.length,3);
});
test('a history that fails integrity, schema, candidate or transport checks is unavailable but never disturbs verified progress',async()=>{
 const good=publication();const tampered=Uint8Array.from(good.historyBytes);tampered[tampered.length-3]^=1;
 const cases={
  PUBLISHED_HISTORY_INTEGRITY:publication({serveHistory:()=>tampered}),
  PUBLISHED_HISTORY_INVALID:publication({history:{...historyFor(good.progressBytes),kind:'other'}}),
  PUBLISHED_PROGRESS_JSON:publication({historyBytes:encode('{')}),
  PUBLISHED_HISTORY_MISMATCH:publication({history:(()=>{const h=historyFor(good.progressBytes);h.head.revision='c'.repeat(40);return h;})()}),
  PUBLISHED_HISTORY_MISMATCH_hash:publication({history:(()=>{const h=historyFor(good.progressBytes);h.head.progressSha256='d'.repeat(64);return h;})()}),
  PUBLISHED_HISTORY_MISMATCH_bytes:publication({history:(()=>{const h=historyFor(good.progressBytes);h.head.progressBytes+=1;return h;})()}),
  PUBLISHED_PROGRESS_SIZE:publication({serveHistory:bytes=>new Uint8Array([...bytes,32])}),
  PUBLISHED_HISTORY_FAILED:publication({serveHistory:()=>Error('network down')})
 };
 for(const [expected,p] of Object.entries(cases)){
  const r=await read(p);assert.equal(r.verified,true,expected);assert.equal(r.progress.tasks[0].id,'A',expected);
  assert.equal(r.history.status,'unavailable',expected);assert.equal(r.history.code,expected.replace(/_(hash|bytes)$/,''),expected);assert.equal('history' in r.history,false);
 }
});
test('the history identity belongs to the manifest: invalid records fail closed and a changed history record rejects the whole publication',async()=>{
 for(const record of [{bytes:0,sha256:'a'.repeat(64)},{bytes:MAX_PUBLISHED_HISTORY_BYTES+1,sha256:'a'.repeat(64)},{bytes:10,sha256:'xyz'},{bytes:'10',sha256:'a'.repeat(64)},{sha256:'a'.repeat(64)}])await assert.rejects(read(publication({manifestHistory:record})),{code:'PUBLISHED_PROGRESS_MANIFEST'});
 const swapped=publication({manifestPatch:{after:m=>({...m,files:{...m.files,'progress-history.json':{...m.files['progress-history.json'],sha256:'e'.repeat(64)}}})}});
 await assert.rejects(read(swapped),{code:'PUBLISHED_PROGRESS_CHANGED'});
});
test('runtime manifest validation knows the history artifact path and still rejects look-alikes',()=>{
 const paths=['index.html','development.html','progress.json','coi-serviceworker.js','fem-kernel.wasm','gmsh/gmsh.mjs','gmsh/gmsh-core.mjs','gmsh/gmsh-core.wasm','gmsh/gmsh-descriptor.mjs','gmsh/runtime.mjs','mfem/mfem.mjs','mfem/mfem.wasm','cad/occt-import-js.js','cad/occt-import-js.wasm','assets/analysis.worker-AbCd.js','assets/cad.worker-EfGh.js'];
 const manifest=(extra=[])=>({schema:1,version:'0.43.0',revision:REVISION,dirty:false,files:Object.fromEntries([...paths,...extra].map(p=>[p,{bytes:100,sha256:'b'.repeat(64)}])),runtime:{analysisWorker:paths.at(-2),cadWorker:paths.at(-1)}});
 validateRuntimeManifest(manifest());validateRuntimeManifest(manifest(['progress-history.json']));
 for(const bad of ['assets/progress-history.json','../progress-history.json','progress-history.json.map','Progress-History.json','progress-history.jsonl','dist/progress-history.json'])assert.throws(()=>validateRuntimeManifest(manifest([bad])),/Invalid runtime asset/,bad);
});
