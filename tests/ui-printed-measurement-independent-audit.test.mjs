import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createPrintedMeasurementUi,syntheticPrintedMeasurementJson} from '../src/ui/printed-measurement-ui.js';
function harness(failSecond=false){
 class Element {
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};this.value='';}
  append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return (this.text??'')+this.children.map(n=>n.textContent).join('');}
  set innerHTML(_){throw Error('HTML forbidden');}
  setAttribute(k,v){this.attributes[k]=String(v);}
  removeAttribute(k){delete this.attributes[k];}
  remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
 }
 const document={createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),addEventListener(){},removeEventListener(){}};
 const live=new Map(),revoked=[];let count=0;
 const host=new Element('div'),ui=createPrintedMeasurementUi({host,document,url:{createObjectURL(blob){if(failSecond&&count===1)throw Error('unavailable');const key='blob:audit-'+(++count);live.set(key,blob);return key;},revokeObjectURL(key){revoked.push(key);live.delete(key);}}});
 return {ui,live,revoked};
}
const find=(n,tag)=>[...(n.tag===tag?[n]:[]),...n.children.flatMap(c=>find(c,tag))];
test('independent combined 2 MB, 100 specimens and 10000 samples remains bounded across last pages',async()=>{
 const {ui,live}=harness(),d=JSON.parse(syntheticPrintedMeasurementJson());
 d.specimens=Array.from({length:100},(_,i)=>({...d.specimens[0],id:'s'+i,samples:Array.from({length:100},(_,j)=>[j,j,-j/100])}));
 const compact=JSON.stringify(d),raw=compact+' '.repeat(2_000_000-Buffer.byteLength(compact));
 ui.input.value=raw;const start=performance.now();assert.equal(await ui.inspect(),true);const elapsedMs=performance.now()-start;
 assert.equal(ui.snapshot().specimenCount,100);assert.equal(ui.snapshot().chartPoints,100);assert.equal(find(ui.results,'option').length,100);
 assert.equal(find(ui.results,'tbody')[0].children.length,50);find(ui.results,'button').at(-1).onclick();
 assert.equal(ui.snapshot().page,1);assert.equal(find(ui.results,'button').at(-1).disabled,true);assert.equal(find(ui.results,'tbody')[0].children.length,50);
 const select=find(ui.results,'select')[0];select.value='99';select.onchange();assert.equal(ui.snapshot().page,0);assert.equal(ui.snapshot().selectedSpecimenId,'s99');
 assert.equal(ui.snapshot().sourceSha256,createHash('sha256').update(raw).digest('hex'));assert.equal(await live.get(ui.downloads.children[0].href).text(),raw);
 const normalized=JSON.parse(await live.get(ui.downloads.children[1].href).text());assert.equal(normalized.specimens.reduce((n,s)=>n+s.samples.length,0),10000);assert.equal(normalized.accuracyVerified,false);
 console.log(JSON.stringify({combinedCapacityBytes:Buffer.byteLength(raw),specimens:100,samples:10000,renderElapsedMs:elapsedMs,tableRows:50,displayedChartPoints:100}));
 ui.destroy();assert.equal(live.size,0);
});
test('download failure revokes partial URL ownership and leaves validated inspection usable',async()=>{
 const {ui,live,revoked}=harness(true);assert.equal(await ui.example.onclick(),true);assert.equal(ui.snapshot().phase,'valid');assert.equal(ui.snapshot().canDownload,false);assert.equal(live.size,0);assert.equal(revoked.length,1);assert.match(ui.downloads.textContent,/保存リンクを作れません/);ui.destroy();
});
test('programmatic raw replacement without input event cannot publish a pending hash result',async()=>{
 const {ui,live}=harness();ui.input.value=syntheticPrintedMeasurementJson();const pending=ui.inspect();ui.input.value='{}';assert.equal(await pending,false);assert.equal(ui.snapshot().phase,'idle');assert.equal(ui.snapshot().sourceSha256,null);assert.equal(ui.results.children.length,0);assert.equal(live.size,0);ui.destroy();
});
test('bfcache-style invalidation refuses pending work while preserving a usable inspection entry',async()=>{
 const {ui,live}=harness();ui.input.value=syntheticPrintedMeasurementJson();const old=ui.inspect();ui.invalidate();assert.equal(await old,false);assert.equal(ui.snapshot().phase,'idle');assert.equal(live.size,0);assert.equal(await ui.inspect(),true);assert.equal(ui.snapshot().phase,'valid');assert.equal(live.size,2);ui.invalidate();assert.equal(live.size,0);assert.equal(await ui.inspect(),true);ui.destroy();
});
