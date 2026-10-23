// Mini DOM adapted from the existing real connection-status scanner fixture.
// Translation, source memory, language switching and scanning use src/i18n.js.
export function createI18nScannerDom(){
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
      this.childNodes=[];this.attributes={};this.dataset={};this.style={};this.parentNode=null;this.className='';this.lang='';this.value='';this.checked=false;
    }
    get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
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
    replaceChildren(...nodes){for(const old of this.childNodes)old.parentNode=null;this.childNodes=[];this.append(...nodes);}
    focus(){document.activeElement=this;}
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
