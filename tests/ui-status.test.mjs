import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatusUi,STATUS_LABELS} from '../src/ui/status-ui.js';

function setup(localize=t=>'L:'+t){const node={textContent:''};const seen=[];const status=createStatusUi({$:id=>{seen.push(id);return id==='status'?node:null;},localizeStatus:localize});return {status,node,seen};}

test('known messages use the fixed Japanese label without calling the localizer',()=>{
 let called=0;const s=setup(t=>{called++;return t;});
 s.status('Calculation cancelled');
 assert.equal(s.node.textContent,'計算を中止しました。');
 s.status('Solving heat conduction…');
 assert.equal(s.node.textContent,'熱伝導を計算中…');
 assert.equal(called,0);assert.deepEqual(s.seen.filter(id=>id==='status'),['status','status']);
});

test('unknown messages fall back to the injected localizer',()=>{
 const s=setup();s.status('Something else');
 assert.equal(s.node.textContent,'L:Something else');
});

test('label table keeps its 15 entries and is frozen',()=>{
 assert.equal(Object.keys(STATUS_LABELS).length,15);
 assert.ok(Object.isFrozen(STATUS_LABELS));
 for(const [k,v] of Object.entries(STATUS_LABELS)){const s=setup();s.status(k);assert.equal(s.node.textContent,v);}
});

test('custom label table can be injected',()=>{
 const node={textContent:''};
 createStatusUi({$:id=>id==='status'?node:null,localizeStatus:t=>t,labels:{a:'b'}})('a');
 assert.equal(node.textContent,'b');
});

function setupHistory(limit){const nodes={status:{textContent:''},'diagnostics-list':{children:[],replaceChildren(...c){this.children=c;}},'diagnostics-count':{textContent:''}};const status=createStatusUi({$:id=>nodes[id],localizeStatus:t=>t,limit,createElement:()=>({className:'',textContent:''})});return {status,nodes};}

test('history keeps overwritten messages newest-first and marks known warnings',()=>{
 const {status,nodes}=setupHistory();
 status('Constraint directions are nearly parallel');status('Solving linear elasticity…');
 assert.equal(nodes.status.textContent,'構造解析を計算中…');
 assert.deepEqual(nodes['diagnostics-list'].children.map(li=>li.textContent),['構造解析を計算中…','要確認: 拘束方向がほぼ平行です。方向の重複を見直してください。']);
 assert.deepEqual(nodes['diagnostics-list'].children.map(li=>li.className),['','warning']);
 assert.equal(nodes['diagnostics-count'].textContent,'2');
});

test('history collapses repeats and is bounded',()=>{
 const {status,nodes}=setupHistory(3);
 status('a');status('a');assert.equal(nodes['diagnostics-list'].children[0].textContent,'a (×2)');
 for(const t of ['b','c','d','e'])status(t);
 assert.deepEqual(status.history().map(e=>e.text),['e','d','c']);
 status.history()[0].text='x';assert.equal(status.history()[0].text,'e');
});

test('missing history nodes leave the status line working',()=>{
 const s=setup();s.status('Calculation cancelled');assert.equal(s.node.textContent,'計算を中止しました。');
});
