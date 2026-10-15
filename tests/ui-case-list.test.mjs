import test from 'node:test';
import assert from 'node:assert/strict';
import {createCaseListUi} from '../src/ui/case-list-ui.js';

function el(tag){const e={tag,children:[],textContent:'',value:'',append(...c){this.children.push(...c);},replaceChildren(...c){this.children=[...c];},click(){this.onclick?.();}};return e;}
function setup({lastAnalysis={result:{kind:'elastic'}}}={}){
 const nodes={};const $=id=>nodes[id]||=el(id);
 const doc={createElement:el};
 const cases=[{name:'A',kind:'elastic',output:{input:'in-A'}},{name:'M',kind:'modal',output:{input:'in-M'}},{name:'T',kind:'thermal',output:{input:'in-T'}}];
 const calls=[];
 const store={
  list:()=>cases,
  compare:()=>cases.map(c=>({name:c.name,kind:c.kind,metrics:[{key:'maxDisplacementMm',value:1.5,unit:'mm'},{key:'maxPressurePa',value:2,unit:'Pa'},{key:'custom',value:3,unit:'u'}]})),
  add:(n,o)=>{calls.push(['add',n,o]);cases.push({name:n,kind:'elastic',output:o});return {name:n};},
  import:v=>calls.push(['import',v]),remove:i=>{calls.push(['remove',i]);cases.splice(i,1);},export:()=>({cases:cases.length}),
 };
 const statuses=[];
 const urls=[],downloads=[];
 const realCreate=doc.createElement;doc.createElement=t=>{const e=realCreate(t);if(t==='a')e.click=()=>downloads.push({href:e.href,download:e.download});return e;};
 const ui=createCaseListUi({$,document:doc,store,status:t=>statuses.push(t),viewCase:i=>calls.push(['view',i]),restoreCaseInput:c=>calls.push(['restore',c.name]),getLastAnalysis:()=>lastAnalysis,
  env:{URL:{createObjectURL:b=>{urls.push(['create',b]);return 'blob:x';},revokeObjectURL:u=>urls.push(['revoke',u])},Blob:class{constructor(p,o){this.parts=p;this.type=o.type;}},setTimeout:(f,ms)=>{urls.push(['timer',ms]);f();}}});
 return {ui,$,nodes,cases,calls,statuses,urls,downloads};
}

test('renderCases fills lists, selects and per-case buttons with labels',()=>{
 const s=setup();s.ui.renderCases();
 assert.deepEqual(s.$('vibration-case').children.map(o=>[o.value,o.textContent]),[[1,'M']]);
 assert.deepEqual(s.$('thermal-case').children.map(o=>[o.value,o.textContent]),[[2,'T']]);
 const items=s.$('case-list').children;assert.equal(items.length,3);
 const [title,summary,...buttons]=items[0].children;
 assert.equal(title.textContent,'A');
 assert.equal(summary.textContent,'構造 · 最大変位: 1.5000 mm / 最大音圧: 2.0000 Pa / custom: 3.0000 u');
 assert.deepEqual(buttons.map(b=>b.textContent),['保存結果を3D表示','入力を複製して復元','削除']);
 assert.match(items[2].children[1].textContent,/^熱 /);
});

test('stokes pressure label differs and button actions delegate with error routing',()=>{
 const s=setup();s.cases[0].kind='stokes';s.ui.renderCases();
 assert.match(s.$('case-list').children[0].children[1].textContent,/最大圧力: 2\.0000 Pa/);
 const [, , view,restore,remove]=s.$('case-list').children[0].children;
 view.onclick();restore.onclick();assert.deepEqual(s.calls,[['view',0],['restore','A']]);
 remove.onclick();assert.deepEqual(s.calls.at(-1),['remove',0]);assert.equal(s.$('case-list').children.length,2);
 const bad=setup();const badUi=createCaseListUi({$:bad.$,document:{createElement:el},store:{list:()=>[bad.cases[0]],compare:()=>[{kind:'elastic',metrics:[]}],export:()=>({})},status:t=>bad.statuses.push(t),viewCase:()=>{throw Error('busy');},restoreCaseInput(){},getLastAnalysis:()=>null});
 badUi.renderCases();bad.$('case-list').children[0].children[2].onclick();assert.deepEqual(bad.statuses,['busy']);
});

test('caseApi is frozen, spreads store, and re-renders after add/import/remove',()=>{
 const s=setup();const api=s.ui.caseApi;
 assert.ok(Object.isFrozen(api));assert.equal(api.list,s.cases&&api.list);assert.equal(typeof api.export,'function');
 api.add('B',{x:1});assert.equal(s.$('case-list').children.length,4);
 api.import({v:1});assert.deepEqual(s.calls.at(-1),['import',{v:1}]);
 api.remove(0);assert.equal(s.$('case-list').children.length,3);
 api.view(2);assert.deepEqual(s.calls.at(-1),['view',2]);
});

test('case-add requires a result and passes the name',()=>{
 const s=setup({lastAnalysis:null});s.$('case-add').onclick();assert.deepEqual(s.statuses,['Run an analysis first']);
 const ok=setup();ok.$('case-name').value='Run';ok.$('case-add').onclick();assert.deepEqual(ok.calls[0],['add','Run',{result:{kind:'elastic'}}]);assert.equal(ok.statuses.length,0);
});

test('export downloads json then revokes; text-show fills textarea',()=>{
 const s=setup();s.$('case-export').onclick();
 assert.deepEqual(s.downloads,[{href:'blob:x',download:'simulation-cases.json'}]);
 assert.deepEqual(s.urls.map(u=>u[0]),['create','timer','revoke']);assert.equal(s.urls[0][1].type,'application/json');
 s.$('case-text-show').onclick();assert.equal(s.$('case-text').value,'{"cases":3}');
});

test('case-import validates size, parses file, always clears input',async()=>{
 const s=setup();const input={value:'f'};
 await s.$('case-import').onchange({target:{files:[],value:'f'}});
 const e1={target:{files:[{size:100000001,text:async()=>'{}'}],value:'f'}};await s.$('case-import').onchange(e1);
 assert.deepEqual(s.statuses,['Case archive exceeds 100 MB']);assert.equal(e1.target.value,'');
 const e2={target:{files:[{size:5,text:async()=>'{"a":1}'}],value:'f'}};await s.$('case-import').onchange(e2);
 assert.deepEqual(s.calls.at(-1),['import',{a:1}]);assert.equal(e2.target.value,'');
 const e3={target:{files:[{size:5,text:async()=>'nope'}],value:'f'}};await s.$('case-import').onchange(e3);assert.equal(s.statuses.length,2);
});
