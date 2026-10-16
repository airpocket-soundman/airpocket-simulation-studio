import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installNamedViewUi} from '../src/named-view-ui.js';

test('named view list shows saved thermal seconds and leaves legacy names unchanged',async t=>{
 const previous=globalThis.document,ids=new Map();
 class Element{
  constructor(){this.children=[];this.textContent='';}
  set innerHTML(html){for(const match of html.matchAll(/id="([^"]+)"/g))ids.set(match[1],new Element());}
  after(){}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
 }
 ids.set('result-legend',new Element());
 globalThis.document={createElement:()=>new Element(),getElementById:id=>ids.get(id),addEventListener(){}};
 t.after(()=>{globalThis.document=previous;});
 const views=[{viewId:'legacy',name:'Legacy',revision:'r'},{viewId:'thermal',name:'Heating',revision:'r',thermalTime:{kind:'thermal',timeSeconds:5}},{viewId:'initial',name:'Initial',revision:'r',thermalTime:{kind:'thermal',timeSeconds:0}}];
 const ui=installNamedViewUi({api:{list:async()=>({views})},resultView:{},translate:()=>{}});
 await ui.refresh();
 assert.deepEqual(ids.get('named-view-list').children.map(row=>row.children[0].textContent),['Legacy ','Heating [5 s] ','Initial [0 s] ']);
});
