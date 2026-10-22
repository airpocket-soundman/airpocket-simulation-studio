import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createIncrementCurveUi,INCREMENT_CURVE_UI_MAX_BYTES} from '../src/ui/increment-curve.js';
import {syntheticIncrementUiBundle as bundle} from './fixtures/increment-ui-reference.mjs';

function element(tag){return {tag,children:[],style:{},attributes:{},value:'',textContent:'',append(...children){this.children.push(...children);},after(node){this.afterNode=node;},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];delete this[key];},focus(){this.focused=true;},remove(){this.removed=true;}};}
const find=(node,id)=>node.id===id?node:node.children?.map(n=>find(n,id)).find(Boolean);
function setup(){
 let language='ja',next=0;const created=new Map(),revoked=[],events={};
 const document={createElement:element,addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const ui=createIncrementCurveUi({anchor:element('div'),document,language:()=>language,env:{URL:{createObjectURL:blob=>{const key='blob:curve-'+ ++next;created.set(key,blob);return key;},revokeObjectURL:key=>revoked.push(key)}}});
 return {ui,created,revoked,get:id=>find(ui.host,'increment-curve-'+id),english(){language='en';events['studio-language']();}};
}


test('real service DOM integration derives SVG and three matching artifacts, preserves source and invalidates stale downloads',async()=>{
 const h=setup(),b=bundle(),before=structuredClone(b);h.get('input').value=JSON.stringify(b);
 const curve=await h.get('run').onclick();assert.ok(curve, h.get('status').textContent);assert.equal(curve.steps.length,4);assert.equal(curve.steps[2].status,'failed');
 assert.equal(h.get('preview').hidden,false);assert.equal(h.get('preview').src,h.get('svg').href);assert.equal(h.get('run').type,'button');
 assert.match(h.get('status').textContent,/失敗による空白: 1/);assert.equal(h.get('downloads').style.flexWrap,'wrap');
 for(const kind of ['csv','json','svg']){assert.equal(h.get(kind).hidden,false);assert.equal(h.get(kind).download,'increment-curve.'+kind);assert.ok(h.created.has(h.get(kind).href));}
 assert.match(await h.created.get(h.get('svg').href).text(),/<svg/);assert.deepEqual(JSON.parse(await h.created.get(h.get('json').href).text()),curve);
 assert.deepEqual(b,before);const text=h.get('input').value;h.english();assert.equal(h.get('input').value,text);assert.match(h.get('status').textContent,/failed gaps: 1/);assert.match(h.get('run').textContent,/Validate/);
 h.get('input').value='{}';h.get('input').oninput();assert.equal(h.revoked.length,3);assert.equal(h.get('preview').hidden,true);for(const kind of ['csv','json','svg'])assert.equal(h.get(kind).href,undefined);
 assert.equal(await h.get('run').onclick(),null);assert.equal(h.get('input').focused,true);assert.equal(h.get('input').attributes['aria-errormessage'],h.get('status').id);
});

test('bundled solver sample is available through a native download link and validates through file selection',async()=>{
 const h=setup(),text=readFileSync(new URL('../public/examples/increment-curve-reference.json',import.meta.url),'utf8');
 assert.equal(h.get('sample').href,'./examples/increment-curve-reference.json');assert.equal(h.get('sample').download,'increment-curve-reference.json');
 const links=[];const walk=node=>{if(node.tag==='a')links.push(node);for(const child of node.children??[])walk(child);};walk(h.ui.host);
 assert.equal(links.length,5);assert.ok(links.every(link=>link.style.color==='#67e8d9'&&link.style.textDecoration==='underline'));
 h.get('file').files=[{size:new TextEncoder().encode(text).length,text:async()=>text}];await h.get('file').onchange();assert.equal(h.get('preview').hidden,true);
 const curve=await h.get('run').onclick();assert.ok(curve,h.get('status').textContent);assert.equal(curve.steps.length,4);assert.equal(curve.steps[2].status,'failed');
});

test('self-reported curve/SVG, malformed JSON and UTF8 oversized input produce no artifact',async()=>{
 const h=setup();for(const text of [JSON.stringify({...bundle(),curve:{steps:[{extensionMm:99}]},svg:'<svg onload="alert(1)"/>'}),'{',JSON.stringify({text:'あ'.repeat(INCREMENT_CURVE_UI_MAX_BYTES/2)})]){h.get('input').value=text;assert.equal(await h.ui.validate(),null);assert.equal(h.created.size,0);assert.equal(h.get('preview').hidden,true);assert.equal(h.get('input').attributes['aria-invalid'],'true');}
});

test('input edits during asynchronous service validation discard its late artifacts',async()=>{
 const h=setup();h.get('input').value=JSON.stringify(bundle());const pending=h.ui.validate();h.get('input').value='new input';h.get('input').oninput();assert.equal(await pending,null);assert.equal(h.get('input').value,'new input');assert.equal(h.created.size,0);assert.equal(h.get('run').disabled,false);
});

test('file read is bounded before text(), clears prior data and cannot overwrite a later edit; destroy revokes URLs',async()=>{
 const h=setup();h.get('input').value=JSON.stringify(bundle());await h.ui.validate();let reads=0;
 h.get('file').files=[{size:INCREMENT_CURVE_UI_MAX_BYTES+1,text:async()=>{reads++;return '{}';}}];await h.get('file').onchange();assert.equal(reads,0);assert.equal(h.get('input').value,'');assert.equal(h.get('file').focused,true);assert.equal(h.revoked.length,3);
 let resolve;h.get('file').files=[{size:2,text:()=>new Promise(r=>resolve=r)}];const pending=h.get('file').onchange();assert.equal(h.get('run').disabled,true);h.get('input').value='manually edited';h.get('input').oninput();resolve('{}');await pending;assert.equal(h.get('input').value,'manually edited');
 h.get('input').value=JSON.stringify(bundle());await h.ui.validate();h.ui.destroy();assert.equal(h.revoked.length,6);assert.equal(h.ui.host.removed,true);
});
