import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installComparisonSettingsPersistenceUi} from '../src/ui/comparison-settings-persistence-ui.js';
function setup(){
 let language='ja';const handlers=new Map(),nodes=new Map(),document={createElement(){return {children:[],append(...children){this.children.push(...children);for(const child of children)if(child.id)nodes.set(child.id,child);},setAttribute(){}};},addEventListener(name,handler){handlers.set(name,handler);}},anchor=document.createElement('div');
 let state={enabled:false,hasCandidate:false,error:null};const calls=[];
 const persistence={getState:()=>state,async setEnabled(enabled){calls.push(['enabled',enabled]);state={...state,enabled};},async restore(){calls.push(['restore']);},async remove(){calls.push(['remove']);state={enabled:false,hasCandidate:false,error:null};}};
 const ui=installComparisonSettingsPersistenceUi({document,anchor,persistence,translate:()=>{},language:()=>language});
 function find(element,id){return element.id===id?element:element.children?.map(child=>find(child,id)).find(Boolean);}
 return {ui,calls,anchor,get:id=>find(anchor,id),language:value=>{language=value;handlers.get('studio-language')();},state:value=>{state=value;ui.refresh();}};
}
test('automatic saving is explicit opt-in and candidate restoration requires a separate click',async()=>{
 const h=setup(),enabled=h.get('compare-persistence-enabled');assert.equal(enabled.checked,false);assert.equal(h.get('compare-persistence-restore').disabled,true);assert.deepEqual(h.calls,[]);
 enabled.checked=true;await enabled.onchange();assert.deepEqual(h.calls,[['enabled',true]]);assert.equal(enabled.checked,true);
 h.state({enabled:true,hasCandidate:true,error:null});assert.equal(h.calls.length,1);assert.equal(h.get('compare-persistence-restore').disabled,false);await h.get('compare-persistence-restore').onclick();assert.deepEqual(h.calls.at(-1),['restore']);
 await h.get('compare-persistence-remove').onclick();assert.equal(enabled.checked,false);assert.equal(h.get('compare-persistence-restore').disabled,true);
});
test('corrupt stored settings can be cleared and failure uses plain language without changing other controls',async()=>{
 const h=setup(),manual={disabled:false};h.anchor.append(manual);h.state({enabled:false,hasCandidate:false,error:'Invalid JSON payload'});
 assert.equal(h.get('compare-persistence-remove').disabled,false);assert.match(h.get('compare-persistence-status').textContent,/手動の設定ファイル/);assert.doesNotMatch(h.get('compare-persistence-status').textContent,/JSON payload/);assert.equal(manual.disabled,false);
 await h.get('compare-persistence-remove').onclick();assert.equal(h.get('compare-persistence-remove').disabled,true);assert.equal(manual.disabled,false);
});

test('language changes refresh candidate and error wording without saving or applying anything',()=>{
 const h=setup();h.state({enabled:true,hasCandidate:true,error:null});h.language('en');assert.match(h.get('compare-persistence-status').textContent,/Saved comparison settings are available/);assert.deepEqual(h.calls,[]);
 h.state({enabled:true,hasCandidate:true,error:'Quota'});assert.match(h.get('compare-persistence-status').textContent,/Browser storage or restoration failed/);h.language('ja');assert.match(h.get('compare-persistence-status').textContent,/手動の設定ファイル/);assert.deepEqual(h.calls,[]);
});
