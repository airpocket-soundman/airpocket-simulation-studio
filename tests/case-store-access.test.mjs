import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCaseStore} from '../src/cases.js';
import {createCaseListUi} from '../src/ui/case-list-ui.js';

const source=readFileSync(new URL('./case-operations-cost.test.mjs',import.meta.url),'utf8');
const output=new Function(source.slice(source.indexOf('const output=('),source.indexOf('\nfunction host'))+';return output;')();
const filled=()=>{const s=createCaseStore();s.add('A',output(1,0));s.add('B',output(2,0));s.add('C',output(3,0));return s;};

test('at(i) equals list()[i] for every index form, count/names equal the list, and at() returns an independent clone',()=>{
 const s=filled(),all=s.list();
 for(const i of [0,1,2,'0','1','2',3,-1,1.5,NaN,'01','x',undefined,null,'-1',' 1'])assert.deepEqual(s.at(i),all[i],'index '+String(i));
 assert.equal(s.count(),all.length);assert.deepEqual(s.names(),all.map(c=>c.name));
 const c=s.at(0);c.name='changed';c.output.result.kind='x';assert.equal(s.at(0).name,'A');assert.deepEqual(s.at(0),all[0]);
 assert.notEqual(s.at(0),s.at(0));
});
test('case list UI with a real store: lazy restore equals the rendered snapshot and a replaced record is refused',()=>{
 const make=()=>{const nodes={};const e=tag=>({tag,children:[],textContent:'',value:'',append(...c){this.children.push(...c);},replaceChildren(...c){this.children=[...c];}});return {$:id=>nodes[id]||=e(id),doc:{createElement:e}};};
 const store=filled(),{$,doc}=make(),restored=[],statuses=[];
 const ui=createCaseListUi({$,document:doc,store,status:t=>statuses.push(t),viewCase:()=>{},restoreCaseInput:c=>restored.push(c),getLastAnalysis:()=>null,env:{}});
 ui.renderCases();const items=$('case-list').children;assert.deepEqual(items.map(i=>i.children[0].textContent),['A','B','C']);
 const before=store.list();items[1].children[3].onclick();assert.deepEqual(restored,[before[1]]);
 store.rename(1,'B2');const n=restored.length;items[1].children[3].onclick();assert.equal(restored.length,n);assert.deepEqual(statuses,['Unknown case']);
 ui.renderCases();$('case-list').children[1].children[3].onclick();assert.equal(restored.at(-1).name,'B2');
});
