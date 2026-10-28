import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createIncrementCurveComparisonUi,INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES} from '../src/ui/increment-curve-comparison.js';
import {syntheticIncrementUiBundle} from './fixtures/increment-ui-reference.mjs';

function element(tag){return {tag,children:[],style:{},attributes:{},value:'',textContent:'',append(...children){this.children.push(...children);},after(node){this.afterNode=node;},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];delete this[key];},focus(){this.focused=true;},remove(){this.removed=true;}};}
const find=(node,id)=>node.id===id?node:node.children?.map(n=>find(n,id)).find(Boolean);
function setup(){
 let language='ja',next=0;const blobs=new Map(),revoked=[],events={};
 const document={createElement:element,addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const ui=createIncrementCurveComparisonUi({anchor:element('div'),document,language:()=>language,env:{URL:{createObjectURL:blob=>{const key='blob:comparison-'+ ++next;blobs.set(key,blob);return key;},revokeObjectURL:key=>revoked.push(key)}}});
 return {ui,blobs,revoked,get:id=>find(ui.host,'increment-comparison-'+id),english(){language='en';events['studio-language']();}};
}
const pair=()=>({bundles:[syntheticIncrementUiBundle({curveId:'tet-a'}),syntheticIncrementUiBundle({curveId:'tet-b',loads:[0,20,30,40],youngModulus:2e9})]});
const file=(text,size=new TextEncoder().encode(text).length)=>({size,text:async()=>text});

test('DOM comparison uses the real strict service, separates two curves, exposes consistent artifacts and keeps raw sources intact',async()=>{
 const h=setup(),source=pair(),before=structuredClone(source);h.get('input').value=JSON.stringify(source);
 const comparison=await h.get('run').onclick();assert.ok(comparison,h.get('status').textContent);assert.equal(comparison.curves.length,2);assert.equal(comparison.analysis.plasticHistory,false);
 assert.equal(h.get('preview').hidden,false);assert.equal(h.get('preview').src,h.get('svg').href);
 assert.equal(h.get('open').href,h.get('svg').href);assert.equal(h.get('open').hidden,false);assert.equal(h.get('open').target,'_blank');assert.equal(h.get('open').rel,'noopener');assert.equal(h.get('open').download,undefined);
 const saved=JSON.parse(await h.blobs.get(h.get('json').href).text());assert.deepEqual(saved,comparison);
 const svg=await h.blobs.get(h.get('svg').href).text();assert.match(svg,/tet-a/);assert.match(svg,/tet-b/);assert.ok(new Set([...svg.matchAll(/stroke="(#[0-9a-fA-F]{6})"/g)].map(m=>m[1])).size>=2);
 assert.match(h.get('status').textContent,/曲線: 2/);assert.match(h.get('status').textContent,/空白: 2/);
 assert.deepEqual(source,before);h.english();assert.match(h.get('status').textContent,/Curves: 2/);assert.match(h.get('preview').alt,/engineering stress/);assert.equal(h.get('input').value,JSON.stringify(source));
 assert.equal(h.get('file').multiple,true);assert.equal(h.get('run').type,'button');assert.equal(h.get('downloads').style.flexWrap,'wrap');
 assert.equal(h.get('open').textContent,'Open full-size graph');
 const links=[];const walk=n=>{if(n.tag==='a')links.push(n);for(const child of n.children??[])walk(child);};walk(h.ui.host);assert.equal(links.length,7);assert.ok(links.every(a=>a.style.color==='#67e8d9'&&a.style.textDecoration==='underline'));
 h.get('input').value='changed';h.get('input').oninput();assert.equal(h.revoked.length,3);assert.equal(h.get('preview').hidden,true);for(const kind of ['csv','json','svg'])assert.equal(h.get(kind).href,undefined);
 assert.equal(h.get('open').hidden,true);assert.equal(h.get('open').href,undefined);
});

test('both public references are individually real solver bundles with differing material/load paths and can be selected together',async()=>{
 const h=setup(),texts=['a','b'].map(id=>readFileSync(new URL('../public/examples/increment-comparison-'+id+'.json',import.meta.url),'utf8'));
 assert.equal(h.get('sample').href,'./examples/increment-comparison-a.json');assert.equal(h.get('sample-b').href,'./examples/increment-comparison-b.json');
 h.get('file').files=texts.map(text=>file(text));await h.get('file').onchange();assert.equal(h.get('preview').hidden,true);
 const parsed=JSON.parse(h.get('input').value);assert.notEqual(parsed.bundles[0].spec.curveId,parsed.bundles[1].spec.curveId);
 assert.notEqual(parsed.bundles[0].spec.input.materialProperties.youngModulus,parsed.bundles[1].spec.input.materialProperties.youngModulus);
 const comparison=await h.ui.validate();assert.ok(comparison,h.get('status').textContent);assert.equal(comparison.curves[0].steps[3].tensileForceN,20);assert.equal(comparison.curves[1].steps[3].tensileForceN,40);
 assert.equal(comparison.curves[0].steps[3].extensionMm,comparison.curves[1].steps[3].extensionMm,'double stiffness and double actual force solve yield the same extension');
});

test('duplicate ids, self-reported comparison/SVG, malformed JSON and oversized UTF8 input yield no downloadable output',async()=>{
 const h=setup(),duplicate=pair();duplicate.bundles[1].spec.curveId=duplicate.bundles[0].spec.curveId;
 for(const text of [JSON.stringify(duplicate),JSON.stringify({...pair(),comparison:{curves:[]},svg:'<svg onload="alert(1)"/>'}),'{',JSON.stringify({text:'あ'.repeat(INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES/2)})]){
  h.get('input').value=text;assert.equal(await h.ui.validate(),null);assert.equal(h.blobs.size,0);assert.equal(h.get('preview').hidden,true);assert.equal(h.get('input').attributes['aria-invalid'],'true');assert.equal(h.get('input').attributes['aria-errormessage'],h.get('status').id);
 }
});

test('four individual raw files retain all curve identities and both plot panels',async()=>{
 const h=setup(),bundles=Array.from({length:4},(_,i)=>syntheticIncrementUiBundle({curveId:'tet-'+i,loads:[0,10+i,15,20+i],youngModulus:1e9*(i+1)}));
 h.get('file').files=bundles.map(bundle=>file(JSON.stringify(bundle)));await h.get('file').onchange();
 const comparison=await h.ui.validate();assert.ok(comparison,h.get('status').textContent);assert.deepEqual(comparison.curves.map(curve=>curve.curveId),['tet-0','tet-1','tet-2','tet-3']);
 const svg=await h.blobs.get(h.get('svg').href).text();assert.match(svg,/data-panel="force-displacement"/);assert.match(svg,/data-panel="engineering-stress-strain"/);
});

test('file count and aggregate size refuse before reading; stale multi-file and validation completion cannot overwrite newer input',async()=>{
 const h=setup();let reads=0;const entry=size=>({size,text:async()=>{reads++;return '{}';}});
 for(const selected of [[entry(2)],Array.from({length:5},()=>entry(2)),[entry(INCREMENT_CURVE_COMPARISON_UI_MAX_BYTES),entry(1)]]){h.get('file').files=selected;await h.get('file').onchange();assert.equal(reads,0);assert.equal(h.get('file').attributes['aria-invalid'],'true');}
 let resolve;h.get('file').files=[{size:2,text:()=>new Promise(r=>resolve=r)},entry(2)];const pending=h.get('file').onchange();h.get('input').value='new';h.get('input').oninput();resolve('{}');await pending;assert.equal(h.get('input').value,'new');assert.equal(reads,0);
 h.get('input').value=JSON.stringify(pair());const validating=h.ui.validate();h.get('input').oninput();assert.equal(await validating,null);assert.equal(h.blobs.size,0);
 h.get('input').value=JSON.stringify(pair());await h.ui.validate();h.ui.destroy();assert.equal(h.revoked.length,3);assert.equal(h.ui.host.removed,true);
});

for(const rejectOld of [false,true])test('new multi-file selection survives old read '+(rejectOld?'rejection':'completion'),async()=>{
 const h=setup();let resolve,reject;h.get('file').files=[{size:2,text:()=>new Promise((a,b)=>{resolve=a;reject=b;})},file('{}')];const old=h.get('file').onchange();
 const fresh=pair();h.get('file').files=fresh.bundles.map(b=>file(JSON.stringify(b)));await h.get('file').onchange();await h.ui.validate();const text=h.get('input').value,href=h.get('open').href,status=h.get('status').textContent;
 if(rejectOld)reject(Error('obsolete read failed'));else resolve('{}');await old;
 assert.equal(h.get('input').value,text);assert.equal(h.get('open').href,href);assert.equal(h.get('status').textContent,status);assert.equal(h.get('file').attributes['aria-invalid'],undefined);assert.equal(h.get('run').disabled,false);
});

test('UI Blob artifact bytes match the formal stdio MCP output for the same public A/B inputs',async()=>{
 const h=setup(),source={bundles:['a','b'].map(id=>JSON.parse(readFileSync(new URL('../public/examples/increment-comparison-'+id+'.json',import.meta.url),'utf8')))},dir=await mkdtemp(join(tmpdir(),'curve-ui-mcp-'));
 try{
  const path=join(dir,'input.json'),outputPath=join(dir,'output.json'),text=JSON.stringify(source);await writeFile(path,text);h.get('input').value=text;assert.ok(await h.ui.validate());
  const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'studio_increment_curve',arguments:{path,outputPath}}}];
  const child=spawnSync(process.execPath,['scripts/studio-mcp.mjs'],{cwd:new URL('../',import.meta.url),input:messages.map(m=>JSON.stringify(m)).join('\n')+'\n',encoding:'utf8',timeout:30000,maxBuffer:1024*1024});assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
  const reply=child.stdout.trim().split('\n').map(JSON.parse).find(m=>m.id===2);assert.notEqual(reply.result.isError,true,JSON.stringify(reply.result));const saved=JSON.parse(await readFile(outputPath,'utf8'));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const format of ['csv','json','svg']){const actual=Buffer.from(await h.blobs.get(h.get(format).href).arrayBuffer());assert.equal(actual.toString('utf8'),saved[format]);assert.equal(hash(actual),reply.result.structuredContent.value.artifacts[format].sha256);}
 }finally{h.ui.destroy();await rm(dir,{recursive:true,force:true});}
});
