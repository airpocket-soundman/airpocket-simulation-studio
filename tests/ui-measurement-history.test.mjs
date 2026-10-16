import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMeasurementHistory,validateMeasurementArchive} from '../src/measurement-history.js';
import {installMeasurementHistoryUi,describeMeasurement} from '../src/ui/measurement-history-ui.js';
import {createBrowserMeasurementStorage} from '../src/ui/measurement-history-storage.js';

const revA='sha256:'+'a'.repeat(64),revB='sha256:'+'b'.repeat(64);
function fakeEl(tag){const e={tag,children:[],textContent:'',value:'',disabled:false,append(...c){this.children.push(...c);},replaceChildren(...c){this.children=[...c];},after(n){this.next=n;},click(){this.clicked=true;}};return e;}
function fakeDoc(){const listeners={};return {createElement:fakeEl,addEventListener:(n,f)=>(listeners[n]||=[]).push(f),emit:n=>Promise.all((listeners[n]||[]).map(f=>f()))};}
function fakeStorage({fail=false}={}){const map=new Map(),s={map,fail,async get(k){if(s.fail)throw Error('boom');return map.has(k)?map.get(k):null;},async set(k,v){if(s.fail)throw Error('boom');map.set(k,v);},async remove(k){if(s.fail)throw Error('boom');map.delete(k);},async keys(){if(s.fail)throw Error('boom');return [...map.keys()];}};return s;}
const sampleFor=revision=>({schemaVersion:1,resultRevision:revision,kind:'thermal',display:{field:'temperature',modeIndex:null,frameIndex:null},point:[.25,.25,.25],element:0,weights:[.25,.25,.25,.25],temperature:35,flux:[1,2,3],analysisAssessment:{schemaVersion:1,mode:'exploratory',provisional:true,completePreflight:false,remainingChecks:['x']}});
function setup({storage=fakeStorage(),language='ja',revision=revA,idPrefix='m'}={}){
 const state={revision,language,n:0},doc=fakeDoc();
 const resultView={async probe({expectedResultRevision,point,options={}}){if(expectedResultRevision!==state.revision)throw Error('Displayed result revision conflict');return {...sampleFor(state.revision),point:[...point],...(options.elementIndex!==undefined?{element:options.elementIndex}:{})};},async get(){if(state.revision===null)throw Error('Run an analysis first');return {resultRevision:state.revision,kind:'thermal',state:{field:'temperature',modeIndex:null,frameIndex:null}};}};
 const history=createMeasurementHistory({resultView,id:()=>idPrefix+(++state.n)});
 const api=Object.freeze({list:history.list,get:history.get,save:history.save,remove:history.remove,exportArchive:history.exportArchive,importArchive:history.importArchive});
 const downloads=[],urls=[];
 const anchor=fakeEl('anchor');
 const ui=installMeasurementHistoryUi({document:doc,anchor,api,resultView,storage,translate:()=>{},language:()=>state.language,env:{URL:{createObjectURL:b=>{urls.push(b);return 'blob:x';},revokeObjectURL:()=>{}},Blob:class{constructor(p,o){this.parts=p;this.type=o.type;}}}});
 const nodes={};(function walk(n){if(!n||typeof n!=='object')return;if(n.id)nodes[n.id]=n;for(const c of n.children||[])walk(c);})(anchor.next);
 return {state,doc,api,history,resultView,ui,anchor,nodes,storage,urls,ids:()=>nodes,settle:async()=>{await ui.ready;await new Promise(r=>setTimeout(r,5));},list:()=>nodes['measurement-history-list'].children.filter(c=>c.tag==='article')};
}
async function saveProbe(s,name='P'){s.nodes['measurement-history-name'].value=name;s.ui.setProbe([1,2,3],{elementIndex:2,bodyIndex:undefined});await s.nodes['measurement-history-save'].onclick();}

test('panel is created with the documented element ids after the anchor',async()=>{
 const s=setup();await s.settle();
 assert.equal(s.anchor.next.id,'measurement-history');
 for(const id of ['measurement-history-name','measurement-history-save','measurement-history-export','measurement-history-import','measurement-history-clear','measurement-history-note','measurement-history-status','measurement-history-list','measurement-history-other'])assert.ok(s.nodes[id],id);
 assert.match(s.nodes['measurement-history-note'].textContent,/このブラウザ/);
});
test('add, list and remove entries for the displayed result',async()=>{
 const s=setup();await s.settle();
 await saveProbe(s,'Pt 1');
 assert.equal(s.list().length,1);assert.match(s.list()[0].children[1].textContent,/35\.000 °C|35\.000 °C/.source?/°C/:/°C/);
 assert.equal((await s.api.list()).count,1);assert.equal((await s.api.exportArchive()).archive.measurements[0].options.elementIndex,2);
 assert.equal('bodyIndex' in (await s.api.exportArchive()).archive.measurements[0].options,false);
 await s.list()[0].children[2].onclick();
 assert.equal(s.list().length,0);assert.equal((await s.api.list()).count,0);
 assert.equal(JSON.stringify([...s.storage.map.keys()]).includes('archive:'),false);
});
test('saving without a probe or with a stale probe is refused with a localized message',async()=>{
 const s=setup({language:'en'});await s.settle();
 await s.nodes['measurement-history-save'].onclick();assert.match(s.nodes['measurement-history-status'].textContent,/Probe a point/);
 s.ui.setProbe([1,2,3],{});await s.settle();s.state.revision=revB;
 await s.nodes['measurement-history-save'].onclick();assert.match(s.nodes['measurement-history-status'].textContent,/different result/);
 assert.equal((await s.api.list()).count,0);
 s.state.language='ja';await s.doc.emit('studio-language');await s.settle();
 await s.nodes['measurement-history-save'].onclick();assert.match(s.nodes['measurement-history-status'].textContent,/先に結果上の点/);
});
test('entries bound to other results are counted but not listed',async()=>{
 const s=setup();await s.settle();await saveProbe(s,'A');
 s.state.revision=revB;await s.ui.refresh();await s.settle();
 assert.equal(s.list().length,0);assert.match(s.nodes['measurement-history-other'].textContent,/1件/);
 await saveProbe(s,'B');assert.equal(s.list().length,1);assert.equal(s.list()[0].children[0].textContent,'B');
 assert.equal((await s.api.list()).count,2);assert.match(s.nodes['measurement-history-other'].textContent,/1件/);
 s.state.revision=null;await s.ui.refresh();await s.settle();assert.equal(s.nodes['measurement-history-save'].disabled,true);assert.match(s.nodes['measurement-history-other'].textContent,/2件/);
});
test('automatic persistence is keyed by result revision and restored through the validator',async()=>{
 const storage=fakeStorage(),s=setup({storage});await s.settle();await saveProbe(s,'Keep');
 assert.ok(storage.map.has('archive:'+revA));assert.deepEqual(JSON.parse(storage.map.get('index')),[revA]);
 const stored=JSON.parse(storage.map.get('archive:'+revA));assert.doesNotThrow(()=>validateMeasurementArchive(stored));assert.equal(stored.measurements.length,1);
 // a new page load with the same result restores the entry
 const t=setup({storage,idPrefix:'n'});await t.settle();
 assert.equal(t.list().length,1);assert.equal(t.list()[0].children[0].textContent,'Keep');
 // a different result does not show it and does not wipe it
 const u=setup({storage,revision:revB,idPrefix:'o'});await u.settle();assert.equal(u.list().length,0);assert.ok(storage.map.has('archive:'+revA));
 assert.ok(!JSON.stringify([...storage.map.values()]).match(/password|token|secret/i));
});
test('corrupt or mismatched stored data is ignored and removed',async()=>{
 for(const bad of ['{not json','{"version":2,"measurements":[]}',JSON.stringify({version:1,measurements:[{id:'x'}]}),JSON.stringify({version:1,measurements:[{id:'z',name:'n',resultRevision:revB,point:[0,0,0],options:{},evidence:sampleFor(revB)}]})]){
  const storage=fakeStorage();storage.map.set('archive:'+revA,bad);
  const s=setup({storage});await s.settle();assert.equal(s.list().length,0);assert.equal((await s.api.list()).count,0);assert.equal(storage.map.has('archive:'+revA),false);
 }
});
test('storage failure is tolerated and reported without breaking the page',async()=>{
 const storage=fakeStorage({fail:true}),s=setup({storage});await s.settle();
 await saveProbe(s,'Still works');assert.equal(s.list().length,1);assert.equal((await s.api.list()).count,1);
 assert.match(s.nodes['measurement-history-note'].textContent,/失敗/);
 const none=setup({storage:null});await none.settle();await saveProbe(none,'No storage');assert.equal(none.list().length,1);assert.match(none.nodes['measurement-history-note'].textContent,/使えません/);
 const adapter=createBrowserMeasurementStorage({indexedDB:undefined,localStorage:undefined});await assert.rejects(adapter.get('x'));
 const throwing=createBrowserMeasurementStorage({indexedDB:{open(){throw Error('denied');}},localStorage:{getItem(){throw Error('denied');}}});await assert.rejects(throwing.get('x'));
});
test('localStorage fallback adapter round trips behind the same interface',async()=>{
 const m=new Map(),ls={getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),get length(){return m.size;},key:i=>[...m.keys()][i]};
 const a=createBrowserMeasurementStorage({indexedDB:undefined,localStorage:ls});await a.set('archive:1','v');assert.equal(await a.get('archive:1'),'v');assert.deepEqual(await a.keys(),['archive:1']);await a.remove('archive:1');assert.equal(await a.get('archive:1'),null);
 assert.ok([...m.keys()].every(k=>k.startsWith('airpocket-measurement-history:')));
});
test('caps: 100 entries per result and stored groups never exceed the archive validator budget',async()=>{
 const storage=fakeStorage(),s=setup({storage});await s.settle();
 for(let i=0;i<100;i++){s.ui.setProbe([i,0,0],{});await s.settle();s.nodes['measurement-history-name'].value='P'+i;await s.nodes['measurement-history-save'].onclick();}
 assert.equal((await s.api.list()).count,100);
 s.ui.setProbe([0,0,1],{});await s.settle();await s.nodes['measurement-history-save'].onclick();
 assert.match(s.nodes['measurement-history-status'].textContent,/limit/);assert.equal((await s.api.list()).count,100);
 const stored=JSON.parse(storage.map.get('archive:'+revA));assert.equal(stored.measurements.length,100);assert.ok(new TextEncoder().encode(storage.map.get('archive:'+revA)).length<=300000);
 // stored data beyond the cap is rejected wholesale
 const over=setup({storage:(()=>{const st=fakeStorage();st.map.set('archive:'+revA,JSON.stringify({version:1,measurements:[...stored.measurements,{...stored.measurements[0],id:'extra'}]}));return st;})()});await over.settle();assert.equal((await over.api.list()).count,0);
});
test('revision index is bounded and clear-all removes history and saved copies',async()=>{
 const storage=fakeStorage(),s=setup({storage});await s.settle();
 for(let i=0;i<22;i++){s.state.revision='sha256:'+String(i).padStart(64,'0');await s.ui.refresh();await saveProbe(s,'R'+i);}
 assert.equal(JSON.parse(storage.map.get('index')).length,20);assert.equal([...storage.map.keys()].filter(k=>k.startsWith('archive:')).length,20);
 await s.nodes['measurement-history-clear'].onclick();
 assert.equal((await s.api.list()).count,0);assert.equal(storage.map.size,0);
});
test('export and import round trip through the real validators (also rejects tampering)',async()=>{
 const s=setup();await s.settle();await saveProbe(s,'RT');
 await s.nodes['measurement-history-export'].onclick();
 assert.equal(s.urls.length,1);const text=s.urls[0].parts[0];assert.doesNotThrow(()=>validateMeasurementArchive(JSON.parse(text)));
 await s.nodes['measurement-history-clear'].onclick();assert.equal((await s.api.list()).count,0);
 const target={files:[{size:text.length,text:async()=>text}],value:'x'};
 await s.nodes['measurement-history-import'].onchange({target});
 assert.equal(s.list().length,1);assert.equal(target.value,'');assert.deepEqual((await s.api.exportArchive()).archive,JSON.parse(text));
 const tampered=JSON.parse(text);tampered.measurements[0].evidence.temperature=Infinity;tampered.measurements[0].evidence.point=[9,9,9];
 await s.nodes['measurement-history-import'].onchange({target:{files:[{size:10,text:async()=>JSON.stringify(tampered)}],value:''}});
 assert.equal((await s.api.list()).count,1,'rejected import leaves the archive untouched');assert.ok(s.nodes['measurement-history-status'].textContent.length>0);
 await s.nodes['measurement-history-import'].onchange({target:{files:[{size:2000000,text:async()=>'{}'}],value:''}});assert.match(s.nodes['measurement-history-status'].textContent,/exceeds/);
 await s.nodes['measurement-history-import'].onchange({target:{files:[{size:3,text:async()=>'not'}],value:''}});assert.ok(s.nodes['measurement-history-status'].textContent.length>0);
});
test('imported entries for other results are persisted under their own revision',async()=>{
 const storage=fakeStorage(),a=setup({storage});await a.settle();
 const other={version:1,measurements:[{id:'imp-1',name:'Imp',resultRevision:revB,point:[0,0,0],options:{},evidence:{...sampleFor(revB),point:[0,0,0]}}]};
 await a.nodes['measurement-history-import'].onchange({target:{files:[{size:5,text:async()=>JSON.stringify(other)}],value:''}});
 assert.equal(a.list().length,0);assert.match(a.nodes['measurement-history-other'].textContent,/1件/);assert.ok(storage.map.has('archive:'+revB));
 const b=setup({storage,revision:revB,idPrefix:'q'});await b.settle();assert.equal(b.list().length,1);assert.equal(b.list()[0].children[0].textContent,'Imp');
});
test('describeMeasurement formats every kind with unit and context',()=>{
 const base=(kind,display,extra)=>({evidence:{kind,display:{modeIndex:null,frameIndex:null,...display},...extra}});
 assert.deepEqual(describeMeasurement(base('elastic',{field:'stress'},{vonMisesPa:2e6})),{field:'stress',value:'2.0000',unit:'MPa',context:''});
 assert.equal(describeMeasurement(base('modal',{field:'displacement',modeIndex:1},{frequencyHz:50})).context,'mode 1');
 assert.match(describeMeasurement(base('acousticTransient',{field:'instantPressure',frameIndex:3,physicalTimeSeconds:.001},{pressurePa:5})).context,/frame 3 \(1\.000 ms\)/);
 assert.equal(describeMeasurement(base('acoustic',{field:'spl'},{splDb:60})).unit,'dB');
 assert.equal(describeMeasurement(base('stokes',{field:'speed'},{speedMs:.5})).unit,'m/s');
 assert.equal(describeMeasurement(base('thermal',{field:'heatFlux'},{flux:[3,4,0]})).value,'5.0000');
 assert.equal(describeMeasurement(base('thermal',{field:'temperature',storedFrameIndex:5,physicalTimeSeconds:5},{temperature:25})).context,'frame 5 (5 s)');
 assert.equal(describeMeasurement(base('thermal',{field:'temperature',storedFrameIndex:10,physicalTimeSeconds:10},{temperature:30})).context,'frame 10 (10 s)');
});
