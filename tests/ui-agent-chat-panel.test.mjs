import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentChatPanel} from '../src/ui/agent-chat-panel.js';
function setup(){
 const make=tag=>{const node={tag,children:[],style:{},attributes:{},value:'',append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},focus(){this.focused=true;},remove(){this.removed=true;}};let text='';Object.defineProperty(node,'textContent',{get:()=>text,set:v=>{text=v;node.children=[];}});Object.defineProperty(node,'innerHTML',{set(){throw Error('HTML insertion forbidden');}});return node;};
 let language='ja';const listeners=new Map(),document={createElement:make,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)},host=make('div');const ui=createAgentChatPanel({host,document,language:()=>language});
 return {ui,host,listeners,english(){language='en';listeners.get('studio-language')();}};
}
const provider=prompt=>({describe:()=>({state:'ready'}),prompt,cancel:async()=>{}});
test('explicit provider controls send/stop; textarea stays plain text and locale preserves draft/history',async()=>{
 const h=setup(),ui=h.ui;assert.equal(ui.send.disabled,true);assert.match(ui.status.textContent,/未接続/);assert.equal(ui.status.attributes['aria-live'],'polite');assert.equal(ui.send.type,'button');assert.equal(ui.input.style.width,'100%');
 ui.setProvider(provider(async text=>({text:'<script>'+text+'</script>',cancelled:false})));ui.input.value='日本語';await ui.send.onclick();assert.equal(ui.input.value,'');assert.equal(ui.history.children[1].textContent,'応答: <script>日本語</script>');
 ui.input.value='draft';h.english();assert.equal(ui.send.textContent,'Send');assert.equal(ui.input.value,'draft');assert.match(ui.history.children[1].textContent,/Assistant: <script>/);assert.match(ui.status.textContent,/Provider ready/);
 ui.destroy();assert.equal(h.listeners.size,0);assert.equal(h.host.children[0].removed,true);
});
test('invalid input focuses error control and late answer preserves a newer draft',async()=>{
 const {ui}=setup();let resolve;ui.setProvider(provider(()=>new Promise(r=>resolve=r)));ui.input.value=' ';await ui.send.onclick();assert.equal(ui.input.attributes['aria-invalid'],'true');assert.equal(ui.input.focused,true);ui.input.value='first';ui.input.oninput();const pending=ui.send.onclick();assert.equal(ui.send.disabled,true);assert.equal(ui.stop.disabled,false);ui.input.value='second draft';resolve({text:'answer',cancelled:false});await pending;assert.equal(ui.input.value,'second draft');assert.equal(ui.input.attributes['aria-invalid'],undefined);ui.destroy();
});
test('session changes and destruction do not render old answers or clear new drafts',async()=>{
 const {ui}=setup();let resolve;ui.setProvider(provider(()=>new Promise(r=>resolve=r)));ui.input.value='old';const pending=ui.send.onclick();ui.setProvider(provider(async()=>({text:'new',cancelled:false})));ui.input.value='new draft';resolve({text:'old secret',cancelled:false});await pending;assert.equal(ui.history.children.length,0);assert.equal(ui.input.value,'new draft');ui.destroy();
});
test('edited draft ABA survives completion and destroyed snapshot releases old history',async()=>{
 const {ui}=setup();let resolve;ui.setProvider(provider(()=>new Promise(r=>resolve=r)));ui.input.value='first';const pending=ui.send.onclick();ui.input.value='changed';ui.input.oninput();ui.input.value='first';ui.input.oninput();resolve({text:'answer',cancelled:false});await pending;assert.equal(ui.input.value,'first');assert.equal(ui.snapshot().messages.length,2);ui.destroy();assert.equal(ui.snapshot().phase,'closed');assert.equal(ui.snapshot().canSend,false);assert.deepEqual(ui.snapshot().messages,[]);
});
test('without a provider the panel is disabled and states a bilingual refusal reason',()=>{
 const h=setup(),ui=h.ui;assert.equal(ui.send.disabled,true);assert.equal(ui.stop.disabled,true);assert.equal(ui.input.disabled,true);assert.equal(ui.reason.hidden,false);assert.match(ui.reason.textContent,/送信できません/);
 h.english();assert.match(ui.reason.textContent,/Sending refused: no conversation session provider/);assert.match(ui.status.textContent,/Unavailable/);
 ui.setProvider(provider(async()=>({text:'',cancelled:false})));assert.equal(ui.input.disabled,false);assert.equal(ui.reason.hidden,true);assert.equal(ui.snapshot().productionTransport,false);ui.destroy();
});
