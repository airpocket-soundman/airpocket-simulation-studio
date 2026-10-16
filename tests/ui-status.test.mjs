import test from 'node:test';
import assert from 'node:assert/strict';
import {createStatusUi,STATUS_LABELS} from '../src/ui/status-ui.js';

function setup(localize=t=>'L:'+t){const node={textContent:''};const seen=[];const status=createStatusUi({$:id=>{seen.push(id);return node;},localizeStatus:localize});return {status,node,seen};}

test('known messages use the fixed Japanese label without calling the localizer',()=>{
 let called=0;const s=setup(t=>{called++;return t;});
 s.status('Calculation cancelled');
 assert.equal(s.node.textContent,'計算を中止しました。');
 s.status('Solving heat conduction…');
 assert.equal(s.node.textContent,'熱伝導を計算中…');
 assert.equal(called,0);assert.deepEqual(s.seen,['status','status']);
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
 createStatusUi({$:()=>node,localizeStatus:t=>t,labels:{a:'b'}})('a');
 assert.equal(node.textContent,'b');
});
