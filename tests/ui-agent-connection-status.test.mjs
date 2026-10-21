import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentConnectionStatusUi,connectionStatusFromEvent,acpStatusFromProbe,CONNECTION_UI_STATES,ACP_UI_STATES,CONNECTION_SCOPES,AGENT_CONNECTION_STATUS_TRANSLATIONS} from '../src/ui/agent-connection-status-ui.js';

// Small fake DOM: the status module must stay free of imports, timers and storage.
function el(tag,writes){
 const node={tag,children:[],style:{},attributes:{},_text:'',append(...children){for(const child of children){this.children.push(child);child.parent=this;}},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},focus(){this.focused=true;}};
 Object.defineProperty(node,'textContent',{get(){return this._text;},set(value){writes.count++;this._text=value;}});
 return node;
}
const all=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.flatMap(child=>all(child,tag))];
const textOf=node=>[node._text,...node.children.map(textOf)].join(' ');
function find(node,id){if(node.id===id)return node;for(const child of node.children){const hit=find(child,id);if(hit)return hit;}return null;}
function setup(language='ja'){
 const writes={count:0},listeners={},translations={};let current=language;
 // Keep real handler references so teardown removal can be asserted.
 const doc={createElement:tag=>el(tag,writes),addEventListener:(type,handler)=>{(listeners[type]??=[]).push(handler);},removeEventListener:(type,handler)=>{listeners[type]=(listeners[type]??[]).filter(entry=>entry!==handler);}};
 const host=el('div',writes);
 const ui=createAgentConnectionStatusUi({host,document:doc,language:()=>current,translate:map=>Object.assign(translations,map),errorMessage:(message,lang)=>lang==='en'?'EN:'+message:'JA:'+message});
 return {host,doc,listeners,translations,writes,ui,find:id=>find(host,id),setLanguage:value=>{current=value;}};
}
const panelText=host=>textOf(host);

test('the panel starts disconnected with the connector method, an unavailable ACP lane and a polite live region',()=>{
 const f=setup();
 assert.equal(f.ui.state().connection.state,'disconnected');
 assert.equal(f.find('agent-connection-phase').textContent,'未接続');
 assert.match(f.find('agent-connection-method').textContent,/ローカル接続プログラム/);
 assert.match(f.find('agent-connection-next').textContent,/「選んだ操作を許可して接続」/);
 assert.equal(f.find('agent-connection-scopes').textContent,'許可済みの操作はまだありません。');
 for(const label of Object.values({inspect:'入力・結果の確認',edit:'入力・保存ケースの編集',analyze:'計算・結果の表示と保存',view:'表示・画像動画出力'}))assert.match(f.find('agent-connection-scopes-denied').textContent,new RegExp(label));
 const live=f.find('agent-connection-status-live');
 assert.equal(live.attributes.role,'status');assert.equal(live.attributes['aria-live'],'polite');
 assert.equal(live.attributes['aria-label'],'接続状態の通知');
 assert.match(f.find('agent-connection-acp').textContent,/AIエージェント連携（ACP）: 未対応/);
 assert.match(f.find('agent-connection-acp').textContent,/会話・認証・モデル選択はまだ実装していません/);
 assert.equal(f.translations['接続状態'],'Connection status');
 assert.deepEqual(CONNECTION_UI_STATES,['disconnected','connecting','connected','expired','failed']);
 assert.deepEqual(ACP_UI_STATES,['unavailable','initializing','initialized','stopping','stopped','failed']);
 assert.deepEqual(CONNECTION_SCOPES,['inspect','edit','analyze','view']);
});

test('a click-time connecting lasts ten seconds and only a connected event with a session identity becomes connected',t=>{
 const f=setup();
 t.mock.timers.enable({apis:['setTimeout','Date']});
 const mockSetTimeout=globalThis.setTimeout;let scheduled=0;globalThis.setTimeout=(...args)=>{scheduled++;return mockSetTimeout(...args);};
 try{
  f.ui.report({state:'connecting'});
  const before=f.writes.count;
  t.mock.timers.tick(10000);
  assert.equal(f.ui.state().connection.state,'connecting');
  assert.equal(f.find('agent-connection-phase').textContent,'接続しています…');
  assert.equal(f.writes.count,before,'elapsed time must not rewrite the status as connected');
  assert.equal(scheduled,0,'the status module must not schedule a success timer');
  f.ui.report({state:'connected'});
  assert.equal(f.ui.state().connection.state,'failed','a connected event without a session identity must not become connected');
  assert.match(f.find('agent-connection-next').textContent,/セッション識別子がありません/);
  f.ui.report({state:'connecting'});
  f.ui.report({state:'connected',sessionId:'session-1',scopes:['inspect']});
  assert.equal(f.ui.state().connection.state,'connected');
  assert.equal(f.find('agent-connection-phase').textContent,'接続中');
 }finally{globalThis.setTimeout=mockSetTimeout;t.mock.timers.reset();}
});

test('expired reconnects to connected and a failed attempt disconnects, once each',()=>{
 const f=setup();
 f.ui.report({state:'connecting'});f.ui.report({state:'expired'});
 assert.equal(f.ui.state().connection.state,'expired');
 assert.match(f.find('agent-connection-next').textContent,/「接続を解除」/);
 f.ui.report({state:'connecting'});f.ui.report({state:'connected',sessionId:'session-2',scopes:['inspect','edit']});
 assert.equal(f.ui.state().connection.state,'connected');
 f.ui.report({state:'disconnected',message:'Browser bridge refused (403)'});
 assert.equal(f.ui.state().connection.state,'failed');
 assert.match(f.find('agent-connection-phase').textContent,/Browser bridge refused \(403\)/);
 assert.match(f.find('agent-connection-next').textContent,/「接続を診断」/);
 f.ui.report({state:'disconnected'});
 assert.equal(f.ui.state().connection.state,'disconnected');
 assert.equal(f.find('agent-connection-phase').textContent,'未接続');
});

test('only the scopes of the current session are permitted; the panel adds no token or scope control',()=>{
 const f=setup();
 f.ui.report({state:'connected',sessionId:'session-3',scopes:['inspect']});
 assert.equal(f.find('agent-connection-scopes').textContent,'入力・結果の確認');
 const denied=f.find('agent-connection-scopes-denied').textContent;
 for(const label of ['入力・保存ケースの編集','計算・結果の表示と保存','表示・画像動画出力'])assert.match(denied,new RegExp(label));
 assert.ok(!denied.includes('入力・結果の確認'));
 assert.deepEqual(f.ui.state().connection.scopes,['inspect']);
 assert.match(panelText(f.host),/許可範囲は接続時に選んだ4項目だけです/);
 assert.equal(all(f.host,'input').length,0,'the status panel must not add an input, token field or scope checkbox');
 assert.equal(all(f.host,'button').length,0,'the status panel must not duplicate the connect/disconnect/diagnose controls');
 f.ui.report({state:'connected',sessionId:'session-3',scopes:['inspect',['edit']],extra:'edit'});
 assert.deepEqual(f.ui.state().connection.scopes,['inspect'],'malformed scope values are dropped, not permitted');
});

test('the ACP lane is separate and an initialized probe is never converted to a connected session',()=>{
 const f=setup();
 assert.equal(f.ui.state().acp.state,'unavailable');
 for(const [probe,label] of [[{state:'initializing'},'初期化中'],[{state:'initialized'},'初期化済み・会話/認証未確認'],[{state:'stopping'},'停止中'],[{state:'stopped'},'停止済み'],[{state:'failed'},'初期化に失敗']]){
  assert.equal(f.ui.setAcp(probe),true);
  assert.equal(f.ui.state().acp.state,probe.state);
  assert.match(f.find('agent-connection-acp').textContent,new RegExp(label.replace(/[/]/g,'\\/')));
  assert.equal(f.ui.state().connection.state,'disconnected','ACP state must not change the connector state');
  assert.equal(f.find('agent-connection-phase').textContent,'未接続');
 }
 assert.equal(f.ui.setAcp({state:'ready'}),false,'an unsupported ACP state is ignored');
 assert.equal(f.ui.state().acp.state,'failed');
 assert.equal(f.ui.setAcp(null),true);
 assert.equal(f.ui.state().acp.state,'unavailable');
 assert.equal(acpStatusFromProbe({state:'initialized'}).conversationVerified,false);
 assert.equal(acpStatusFromProbe({state:'initialized'}).authenticated,false);
});

test('the dictionary drives headings, states, actions and the live label in English and back in Japanese',()=>{
 const f=setup('ja');
 const jaLabels=[f.find('agent-connection-status-heading').textContent,f.find('agent-connection-method').textContent,f.find('agent-connection-next').textContent,f.find('agent-connection-status-live').attributes['aria-label']];
 f.setLanguage('en');
 assert.equal(f.listeners['studio-language'].length,1,'the panel subscribes to the language event once');
 f.listeners['studio-language'][0]();
 assert.equal(f.find('agent-connection-status-heading').textContent,'Connection status');
 assert.equal(f.find('agent-connection-phase').textContent,'Disconnected');
 assert.match(f.find('agent-connection-method').textContent,/Local connector/);
 assert.match(f.find('agent-connection-next').textContent,/Allow selected operations and connect/);
 assert.match(f.find('agent-connection-scopes-denied').textContent,/Inspect input and results/);
 assert.match(f.find('agent-connection-acp').textContent,/AI agent connection \(ACP\): Not supported/);
 // The live aria-label stays the JP source in every language: installLanguage's scanner owns
 // attribute translation (see tests/ui-agent-connection-status-scanner.test.mjs for the real scan).
 assert.equal(f.find('agent-connection-status-live').attributes['aria-label'],'接続状態の通知');
 f.setLanguage('ja');
 f.listeners['studio-language'][0]();
 const back=[f.find('agent-connection-status-heading').textContent,f.find('agent-connection-method').textContent,f.find('agent-connection-next').textContent,f.find('agent-connection-status-live').attributes['aria-label']];
 assert.deepEqual(back,jaLabels);
});

test('failures keep a bounded reason and never surface a token, a token URL or a non-string message',()=>{
 const f=setup();
 f.ui.report({state:'disconnected',message:'x'.repeat(3000)});
 assert.match(f.find('agent-connection-phase').textContent,/JA:x{10}/);
 assert.ok(f.find('agent-connection-phase').textContent.length<2100,'the injected formatter result stays bounded');
 f.ui.report({state:'disconnected',message:{token:'secret-token',endpoint:'http://127.0.0.1:1/?token=secret-token'}});
 assert.equal(f.ui.state().connection.message,'');
 assert.equal(f.ui.state().connection.state,'failed');
 assert.ok(!panelText(f.host).includes('secret-token'));
 f.ui.report({state:'connected',sessionId:'session-4',scopes:['inspect'],token:'secret-token',endpoint:'http://127.0.0.1:1/?token=secret-token'});
 assert.ok(!panelText(f.host).includes('secret-token'));
 assert.ok(!JSON.stringify(f.ui.state()).includes('secret-token'));
 assert.ok(!JSON.stringify(f.ui.state()).includes('127.0.0.1'));
 assert.equal(connectionStatusFromEvent({state:'connected',sessionId:'session-5',scopes:['view','inspect']}).scopes.join(','),'inspect,view');
});

test('the status module itself opens no timer, storage or network call',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/ui/agent-connection-status-ui.js',import.meta.url),'utf8');
 for(const forbidden of ['localStorage','sessionStorage','setTimeout','setInterval','requestAnimationFrame','fetch(','new Worker','XMLHttpRequest','document.cookie'])assert.ok(!source.includes(forbidden),'the status module must not use '+forbidden);
 const dictionary=Object.entries(AGENT_CONNECTION_STATUS_TRANSLATIONS).flat().join(' ');
 for(const secret of ['接続コード','http://','https://'])assert.ok(!dictionary.includes(secret),'the status dictionary must not name '+secret);
});

test('unknown events are ignored, repeated states are not rewritten and teardown silences every later event',()=>{
 const f=setup();
 f.ui.report({state:'connected',sessionId:'session-6',scopes:['inspect']});
 const settled=f.writes.count;
 assert.equal(f.ui.report({state:'connected',sessionId:'session-6',scopes:['inspect']}),false);
 assert.equal(f.writes.count,settled,'an identical state must not rewrite the DOM');
 assert.equal(f.ui.report({state:'teleported'}),false);
 assert.equal(f.ui.report(null),true);
 assert.equal(f.ui.state().connection.state,'disconnected');
 assert.equal(f.ui.report(undefined),false);
 assert.equal(f.ui.report('connected'),false,'a non-object event is ignored');
 assert.equal(connectionStatusFromEvent('connected'),null);
 f.ui.report({state:'connecting'});
 const before=f.writes.count;
 assert.equal(f.ui.teardown(),true);
 assert.equal(f.listeners['studio-language'].length,0,'teardown must remove the language listener');
 f.listeners['studio-language']=[];
 const frozen=f.ui.state();
 assert.equal(f.ui.report({state:'connected',sessionId:'session-7',scopes:['inspect']}),false);
 assert.equal(f.ui.setAcp({state:'initialized'}),false);
 assert.equal(f.ui.refresh(),false);
 assert.equal(f.writes.count,before,'no DOM write may happen after teardown');
 assert.deepEqual(f.ui.state(),frozen);
});
