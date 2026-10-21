import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentConnectionStatusUi} from '../src/ui/agent-connection-status-ui.js';

// Regression for PR #145: the live region's aria-label used to be written already translated
// (English on an EN start). installLanguage's scanner then kept that English string as the
// attribute's source and restored it after every later scan, so JP -> next scan went back to
// English. This file runs the real installLanguage/scan path against a small DOM, not a
// dictionary-only stub.

// ---------------------------------------------------------------------------
// Minimal DOM: elements, text nodes, a TreeWalker, document events and a
// MutationObserver whose pending records are flushed like the browser's
// microtask delivery. Only the surface used by i18n.js and the status module.
// ---------------------------------------------------------------------------
function createDom(){
  const listeners=new Map();
  let observer=null;
  const counts={text:0,attribute:0};
  const Queue=Symbol('mutations');

  class TextNode{
    constructor(data){this.nodeType=3;this[Queue]=[];this.parentNode=null;this._data=String(data);}
    get nodeValue(){return this._data;}
    set nodeValue(value){
      this._data=String(value);counts.text++;
      if(observer?.active)observer.records.push({type:'characterData',target:this});
    }
    get textContent(){return this._data;}
    set textContent(value){this.nodeValue=value;}
    get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
  }

  class Element{
    constructor(localName){
      this.nodeType=1;this.localName=localName;this.tagName=localName.toUpperCase();
      this.childNodes=[];this.attributes={};this.dataset={};this.parentNode=null;this.className='';this.lang='';
    }
    get children(){return this.childNodes.filter(node=>node.nodeType===1);}
    get textContent(){return this.childNodes.map(node=>node.textContent).join('');}
    set textContent(value){
      this.childNodes=[];counts.text++;
      if(observer?.active)observer.records.push({type:'childList',target:this});
      if(value!==undefined&&value!==null&&String(value)!=='')this.append(new TextNode(value));
    }
    append(...nodes){
      for(const node of nodes){node.parentNode=this;this.childNodes.push(node);}
      if(observer?.active)observer.records.push({type:'childList',target:this});
    }
    setAttribute(name,value){
      counts.attribute++;this.attributes[name]=String(value);
      if(name==='id')this.id=String(value);
      if(name==='class')this.className=String(value);
    }
    getAttribute(name){return Object.hasOwn(this.attributes,name)?this.attributes[name]:null;}
    hasAttribute(name){return Object.hasOwn(this.attributes,name);}
    removeAttribute(name){delete this.attributes[name];}
    matches(selector){
      return selector.split(',').some(part=>{
        const token=part.trim();
        if(!token)return false;
        if(token.startsWith('#'))return this.id===token.slice(1);
        if(token.startsWith('.'))return this.className.split(/\s+/).includes(token.slice(1));
        if(token.startsWith('[')){
          const inner=token.slice(1,-1);
          const [name,rawValue]=inner.split('=');
          if(rawValue===undefined)return this.hasAttribute(name)||Object.hasOwn(this.dataset,name);
          return this.getAttribute(name)===rawValue.replace(/^["']|["']$/g,'');
        }
        return this.localName===token.toLowerCase();
      });
    }
    closest(selector){
      let node=this;
      while(node?.nodeType===1){if(node.matches(selector))return node;node=node.parentNode;}
      return null;
    }
    *descendants(){
      for(const child of this.childNodes){yield child;}
      for(const child of this.childNodes)if(child.nodeType===1)yield* child.descendants();
    }
    querySelectorAll(selector){return [...this.descendants()].filter(node=>node.nodeType===1&&node.matches(selector));}
  }

  const documentElement=new Element('html');
  const body=new Element('body');
  documentElement.append(body);

  const document={
    nodeType:9,documentElement,body,title:'',hidden:false,
    createElement:tag=>new Element(tag),
    createTextNode:text=>new TextNode(text),
    querySelectorAll:selector=>documentElement.querySelectorAll(selector),
    createTreeWalker(root,whatToShow){
      const nodes=[...root.descendants()].filter(node=>(whatToShow&4?node.nodeType===3:true));
      let index=0;
      return {nextNode:()=>nodes[index++]??null};
    },
    addEventListener(type,handler){(listeners.get(type)??listeners.set(type,new Set()).get(type)).add(handler);},
    removeEventListener(type,handler){listeners.get(type)?.delete(handler);},
    dispatchEvent(event){for(const handler of [...(listeners.get(event.type)??[])])handler(event);return true;},
    listenerCount:type=>listeners.get(type)?.size??0
  };

  class MutationObserver{
    constructor(callback){this.callback=callback;this.records=[];this.active=false;this.target=null;}
    observe(target){this.target=target;this.active=true;observer=this;}
    disconnect(){this.active=false;this.records=[];if(observer===this)observer=null;}
    takeRecords(){return this.records.splice(0,this.records.length);}
  }

  function flush(){
    if(!observer?.active||!observer.records.length)return false;
    const records=observer.takeRecords();
    observer.callback(records);
    return true;
  }
  // The browser delivers the observer callback in a microtask, so a scan may
  // itself queue no further records. Flush a bounded number of passes.
  function flushAll(){let scans=0;while(flush()){if(++scans>5)throw Error('scan did not settle');}return scans;}

  const find=id=>[...documentElement.descendants()].find(node=>node.nodeType===1&&node.id===id)??null;
  return {document,MutationObserver,flushAll,counts,Element,TextNode,find};
}

// ---------------------------------------------------------------------------
// Real i18n module instance (fresh per test via a unique query) + status panel.
// ---------------------------------------------------------------------------
let moduleId=0;
async function harness(startLanguage){
  const {document,MutationObserver,flushAll,counts,find}=createDom();
  globalThis.document=document;
  globalThis.MutationObserver=MutationObserver;
  globalThis.NodeFilter={SHOW_TEXT:4};
  globalThis.Event=class Event{constructor(type){this.type=type;}};
  globalThis.history={replaceState(){}};
  globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  globalThis.location={search:'?lang='+startLanguage,href:'http://127.0.0.1:5173/?lang='+startLanguage};
  const i18n=await import('../src/i18n.js?scanner-'+startLanguage+'-'+moduleId++);
  const host=document.createElement('div');
  document.body.append(host);
  // Real boot order (src/main.js): installLanguage() runs before the status panel exists.
  i18n.installLanguage();
  const ui=createAgentConnectionStatusUi({host,document,language:()=>i18n.language,translate:i18n.addTranslations,errorMessage:message=>typeof message==='string'?message:''});
  flushAll();
  const bar=document.querySelectorAll('.language-switch')[0];
  const click=code=>{
    const anchor=[...bar.children].find(child=>child.lang===code);
    assert.ok(anchor,'language switch '+code+' must exist');
    anchor.onclick({preventDefault(){}});
    return flushAll();
  };
  return {document,i18n,host,ui,bar,click,flushAll,counts,find};
}

const textOf=(node)=>node.textContent;

test('EN start: a real rescan keeps the live aria-label in each language',async()=>{
  const f=await harness('en');
  assert.equal(f.i18n.language,'en');
  f.ui.report({state:'connected',sessionId:'synthetic-session-40',scopes:['inspect']});
  f.flushAll();
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'Connection status notifications');
  assert.equal(textOf(f.find('agent-connection-status-live')),'Connected.');

  f.click('ja');
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'接続状態の通知','JP must survive the scan caused by the panel rewrite');
  assert.equal(textOf(f.find('agent-connection-status-live')),'接続しました。');

  f.click('en');
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'Connection status notifications');
  assert.equal(textOf(f.find('agent-connection-status-live')),'Connected.');

  f.click('ja');
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'接続状態の通知');
  assert.equal(textOf(f.find('agent-connection-status-live')),'接続しました。');
});

test('EN start: headings, state, next action, scopes and ACP note follow the same language',async()=>{
  const f=await harness('en');
  f.ui.report({state:'connected',sessionId:'synthetic-session-40',scopes:['inspect']});
  f.flushAll();
  const expected={
    en:{
      heading:'Connection status',
      method:'Local connector (loopback HTTP on this device only)',
      phase:'Connected',
      next:'Use “Disconnect” above when finished.',
      permitted:'Inspect input and results',
      denied:['Edit inputs and saved cases','Calculate and show/save results','View settings and media export'],
      acp:'AI agent connection (ACP): Not supported (the initialization probe is not installed yet) ACP state is separate from the connector connection. Conversation, authentication and model selection are not implemented yet.'
    },
    ja:{
      heading:'接続状態',
      method:'ローカル接続プログラム（この端末のループバックHTTPのみ）',
      phase:'接続中',
      next:'終えるときは上の「接続を解除」で切断してください。',
      permitted:'入力・結果の確認',
      denied:['入力・保存ケースの編集','計算・結果の表示と保存','表示・画像動画出力'],
      acp:'AIエージェント連携（ACP）: 未対応（初期化probeはまだ導入されていません） ACPの状態は接続方式とは別です。会話・認証・モデル選択はまだ実装していません。'
    }
  };
  const check=async expectedLanguage=>{
    for(const code of [expectedLanguage])assert.equal(f.i18n.language,code);
    const wanted=expected[expectedLanguage];
    assert.equal(textOf(f.find('agent-connection-status-heading')),wanted.heading);
    assert.equal(textOf(f.find('agent-connection-method')),wanted.method);
    assert.equal(textOf(f.find('agent-connection-phase')),wanted.phase);
    assert.equal(textOf(f.find('agent-connection-next')),wanted.next);
    assert.equal(textOf(f.find('agent-connection-scopes')),wanted.permitted);
    const denied=textOf(f.find('agent-connection-scopes-denied'));
    for(const label of wanted.denied)assert.ok(denied.includes(label),label+' must stay untranslated in '+expectedLanguage);
    assert.ok(!denied.includes(wanted.permitted),'inspect must never appear in the not-permitted list');
    assert.equal(textOf(f.find('agent-connection-acp')),wanted.acp);
    const state=f.ui.state();
    assert.deepEqual(state.connection,{state:'connected',sessionId:'synthetic-session-40',scopes:['inspect'],message:'',reason:null},'a locale change must not change scope, session or state');
    assert.equal(state.acp.state,'unavailable','ACP must not become connected');
  };
  await check('en');
  f.click('ja');
  await check('ja');
  f.click('en');
  await check('en');
});

test('JP start: EN and back keeps the panel and the live aria-label in the active language',async()=>{
  const f=await harness('ja');
  assert.equal(f.i18n.language,'ja');
  f.ui.report({state:'connected',sessionId:'synthetic-session-40',scopes:['inspect']});
  f.flushAll();
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'接続状態の通知');
  assert.equal(textOf(f.find('agent-connection-status-heading')),'接続状態');
  f.click('en');
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'Connection status notifications');
  assert.equal(textOf(f.find('agent-connection-status-heading')),'Connection status');
  assert.equal(textOf(f.find('agent-connection-next')),'Use “Disconnect” above when finished.');
  f.click('ja');
  assert.equal(f.find('agent-connection-status-live').getAttribute('aria-label'),'接続状態の通知');
  assert.equal(textOf(f.find('agent-connection-status-heading')),'接続状態');
  assert.equal(textOf(f.find('agent-connection-next')),'終えるときは上の「接続を解除」で切断してください。');
  assert.deepEqual(f.ui.state().connection.scopes,['inspect']);
  assert.equal(f.ui.state().connection.sessionId,'synthetic-session-40');
});

test('connecting, failed and disconnected round-trip the locale and keep their state',async()=>{
  const f=await harness('en');
  const live=()=>f.find('agent-connection-status-live');
  const phase=()=>f.find('agent-connection-phase');
  f.ui.report({state:'connecting'});
  f.flushAll();
  assert.equal(textOf(phase()),'Connecting…');
  f.click('ja');
  assert.equal(textOf(phase()),'接続しています…');
  assert.equal(live().getAttribute('aria-label'),'接続状態の通知');
  assert.equal(textOf(live()),'接続しています。');
  f.click('en');
  assert.equal(textOf(phase()),'Connecting…');
  assert.equal(live().getAttribute('aria-label'),'Connection status notifications');

  f.ui.report({state:'disconnected',message:'Browser bridge refused (403)'});
  f.flushAll();
  assert.equal(textOf(phase()),'The connection failed — Browser bridge refused (403)');
  f.click('ja');
  assert.equal(textOf(phase()),'接続に失敗しました — Browser bridge refused (403)');
  assert.equal(f.ui.state().connection.state,'failed');
  f.click('en');
  assert.equal(textOf(f.find('agent-connection-next')),'Review the endpoint with “Diagnose connection” above, recheck the connector startup and local-network permission, then connect again.');

  f.ui.report({state:'disconnected'});
  f.flushAll();
  assert.equal(textOf(phase()),'Disconnected');
  f.click('ja');
  assert.equal(textOf(phase()),'未接続');
  assert.equal(live().getAttribute('aria-label'),'接続状態の通知');
  assert.equal(textOf(live()),'接続を解除しました。');
  assert.deepEqual(f.ui.state().connection.scopes,[]);
});

test('the scan settles without a redraw loop and teardown removes the language listener',async()=>{
  const f=await harness('en');
  f.ui.report({state:'connected',sessionId:'synthetic-session-40',scopes:['inspect']});
  f.flushAll();
  const writes=f.counts.text+f.counts.attribute;
  assert.equal(f.flushAll(),0,'no observer records may remain once the scan settles');
  assert.equal(f.counts.text+f.counts.attribute,writes,'a settled panel is not rewritten');
  assert.equal(f.ui.refresh(),false,'refresh must not rewrite an unchanged panel');
  assert.equal(f.document.listenerCount('studio-language'),1,'the panel subscribes once to the language event');
  f.ui.teardown();
  assert.equal(f.document.listenerCount('studio-language'),0,'teardown must remove the real language listener');
  assert.equal(f.ui.report({state:'failed'}),false);
  assert.equal(f.ui.setAcp({state:'initialized'}),false);
});
