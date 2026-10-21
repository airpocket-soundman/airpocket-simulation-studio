import test from 'node:test';import assert from 'node:assert/strict';
// This file runs the real i18n installLanguage() scanner, not a translation callback stub.
// The mini DOM only supplies nodes/attributes and a manual MutationObserver flush; the
// original-text tracking, dictionary lookup and language switch stay in src/i18n.js.
class TextNode{constructor(value){this.nodeType=3;this.nodeValue=String(value);this.parentElement=null;}}
class Element{
 constructor(tag){this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes=Object.create(null);this.dataset={};this.style={};this.parentElement=null;this.focused=false;this.onclick=null;}
 get children(){return this.childNodes.filter(node=>node.nodeType===1);}
 get textContent(){return this.childNodes.map(node=>node.nodeType===3?node.nodeValue:node.textContent).join('');}
 set textContent(value){for(const node of this.childNodes)node.parentElement=null;this.childNodes=[];this.append(String(value));}
 append(...nodes){for(const node of nodes){const child=typeof node==='string'?new TextNode(node):node;child.parentElement=this;this.childNodes.push(child);}}
 replaceChildren(...nodes){for(const node of this.childNodes)node.parentElement=null;this.childNodes=[];this.append(...nodes);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 hasAttribute(key){return key in this.attributes;}
 removeAttribute(key){delete this.attributes[key];}
 set id(value){this.attributes.id=value;}
 get id(){return this.attributes.id;}
 set className(value){this.attributes.class=value;}
 get className(){return this.attributes.class??'';}
 closest(selector){for(let node=this;node;node=node.parentElement)if(matches(node,selector))return node;return null;}
 focus(){this.focused=true;}
}
function matches(node,selector){if(!node.tagName)return false;return selector.split(',').some(raw=>{const part=raw.trim();if(part.startsWith('#'))return node.attributes.id===part.slice(1);if(part.startsWith('.'))return node.className.split(/\s+/).includes(part.slice(1));if(part.startsWith('['))return part.slice(1,-1) in node.attributes;return node.tagName===part.toUpperCase();});}
function walk(node,visit){visit(node);for(const child of node.childNodes??[])walk(child,visit);}
const documentElement=new Element('html'),body=new Element('body'),observers=[];
const document={title:'',documentElement,body,createElement:tag=>new Element(tag),
 querySelectorAll(selector){const found=[];walk(body,node=>{if(node.nodeType===1&&matches(node,selector))found.push(node);});return found;},
 createTreeWalker(root,whatToShow){const nodes=[];walk(root,node=>{if(node!==root&&node.nodeType===3&&whatToShow===NodeFilter.SHOW_TEXT)nodes.push(node);});let index=0;return{nextNode:()=>nodes[index++]??null};},
 dispatchEvent(){}};
globalThis.location={search:'?lang=en',href:'http://127.0.0.1/?lang=en'};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.history={replaceState(){}};
globalThis.document=document;
globalThis.NodeFilter={SHOW_TEXT:4};
globalThis.MutationObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}};
const flush=()=>{for(const observer of observers)observer.callback();};
const i18n=await import('../src/i18n.js');
const {createSphericalRegionUi}=await import('../src/ui/spherical-region-ui.js');
const spec={exactCad:true,center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:.01,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90};
const find=(element,id)=>element.attributes.id===id?element:element.children.map(child=>find(child,id)).find(Boolean);
const statusOf=host=>find(host,'spherical-region-status').textContent;
let switches;
function setup(onSelect=async()=>{}){const host=new Element('div');document.body.append(host);const calls=[];createSphericalRegionUi({host,document,language:()=>i18n.language,translate:i18n.addTranslations,onSelect:(mesh,value)=>{calls.push({mesh,spec:value});return onSelect(mesh,value);}});return{host,calls};}
const switchTo=code=>switches.children.find(anchor=>anchor.lang===code).onclick({preventDefault(){}});
const selectIn=host=>find(host,'spherical-select');
test('real scanner: the EN success status is generated from the JP source and survives JP then EN again',async()=>{
 i18n.installLanguage();switches=document.body.children.find(element=>element.className==='language-switch');
 const f=setup(),label=find(f.host,'spherical-radius');
 await selectIn(f.host).onclick();flush();
 assert.equal(i18n.language,'en');
 assert.equal(statusOf(f.host),'Spherical region selected.');
 assert.equal(label.attributes['aria-label'],'Radius (mm)');
 switchTo('ja');
 assert.equal(i18n.language,'ja');
 assert.equal(statusOf(f.host),'球面の数値領域を選択しました。');
 assert.equal(label.attributes['aria-label'],'半径（mm）');
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],{mesh:0,spec});
 switchTo('en');
 assert.equal(statusOf(f.host),'Spherical region selected.');
 assert.equal(label.attributes['aria-label'],'Radius (mm)');
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],{mesh:0,spec});
});
test('real scanner: the failure sentence is translated but the raw error text is not',async()=>{
 if(i18n.language!=='en')switchTo('en');
 const f=setup(async()=>{throw Error('synthetic selection failure');});
 await selectIn(f.host).onclick();flush();
 assert.equal(statusOf(f.host),'Selection failed. The draft was retained. synthetic selection failure');
 switchTo('ja');
 assert.equal(statusOf(f.host),'選択に失敗しました。入力は保持しています。 synthetic selection failure');
 switchTo('en');
 assert.equal(statusOf(f.host),'Selection failed. The draft was retained. synthetic selection failure');
 assert.equal(f.calls.length,1);
});
test('real scanner: a blank radius keeps the draft, focus and aria error through locale switches',async()=>{
 if(i18n.language!=='en')switchTo('en');
 const f=setup(),radius=find(f.host,'spherical-radius');radius.value='';
 await selectIn(f.host).onclick();flush();
 const english='Enter every field as a non-blank finite number.';
 assert.equal(statusOf(f.host),english);
 assert.equal(radius.value,'');assert.equal(radius.attributes['aria-invalid'],'true');
 assert.equal(radius.attributes['aria-errormessage'],'spherical-region-status');assert.equal(radius.focused,true);
 switchTo('ja');
 assert.equal(statusOf(f.host),'全ての項目を空欄でない有限の数値で入力してください。');
 switchTo('en');
 assert.equal(statusOf(f.host),english);
 assert.equal(radius.value,'');assert.equal(radius.attributes['aria-invalid'],'true');assert.equal(radius.focused,true);
 assert.equal(f.calls.length,0);
});
