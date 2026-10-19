import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createSphericalRegionUi} from '../src/ui/spherical-region-ui.js';
import {createStudioApi} from '../src/studio-api.js';import {createProjectFromBuiltin} from '../src/project-import.js';import {sphericalPatchArea} from '../src/spherical-cad.js';
const spec={exactCad:true,center:[0,0,0],axis:[0,0,1],reference:[1,0,0],radius:10,tolerance:.01,latitudeMin:-30,latitudeMax:30,startDegrees:315,sweepDegrees:90};
const DEFAULTS=['0','0','0','0','0','0','1','1','0','0','10','0.01','-30','30','315','90'];
function el(tag){return {tag,children:[],style:{},attributes:{},value:'',append(...children){for(const c of children){this.children.push(c);c.parent=this;}},replaceChildren(...children){this.children=[];this.append(...children);},setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},focus(){this.focused=true;}};}
const find=(e,id)=>e.id===id?e:e.children.map(c=>find(c,id)).find(Boolean);
const all=(e,tag)=>[...(e.tag===tag?[e]:[]),...e.children.flatMap(c=>all(c,tag))];
function setup({language='ja',onSelect=async()=>{}}={}){const host=el('div'),translations={},calls=[];const ui=createSphericalRegionUi({host,document:{createElement:el},language:()=>language,translate:map=>Object.assign(translations,map),onSelect:(mesh,value)=>{calls.push({mesh,spec:value});return onSelect(mesh,value);}});return {host,ui,calls,translations,add:find(host,'spherical-select'),status:find(host,'spherical-region-status')};}
const values=host=>all(host,'input').map(c=>c.value);
test('blank or non-finite drafts are refused before the API call and never become zero',async()=>{
 const f=setup(),radius=find(f.host,'spherical-radius');assert.deepEqual(values(f.host),DEFAULTS);
 radius.value='';await f.add.onclick();assert.equal(f.calls.length,0);assert.equal(radius.attributes['aria-invalid'],'true');assert.equal(radius.attributes['aria-errormessage'],'spherical-region-status');assert.equal(radius.focused,true);assert.match(f.status.textContent,/有限/);
 radius.oninput();assert.equal(radius.attributes['aria-invalid'],undefined);assert.equal(f.status.textContent,'');
 for(const bad of ['abc','Infinity',' ']){radius.value=bad;await f.add.onclick();assert.equal(f.calls.length,0);assert.equal(radius.value,bad);}
 radius.value='10';const mesh=find(f.host,'spherical-mesh');mesh.value='';await f.add.onclick();assert.equal(f.calls.length,0);assert.equal(mesh.attributes['aria-invalid'],'true');assert.match(f.status.textContent,/有限/);
 mesh.value='1.5';await f.add.onclick();assert.equal(f.calls.length,0);assert.match(f.status.textContent,/整数/);
 mesh.value='0';await f.add.onclick();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0],{mesh:0,spec});assert.equal(f.status.textContent,'球面の数値領域を選択しました。');
});
test('API/state restore fills every field, tolerates key reordering and rejects a corrupt spec without truncating',()=>{
 const f=setup(),reordered=Object.fromEntries(Object.entries({...spec,mesh:0}).reverse());f.ui.restore(reordered);
 assert.deepEqual(f.ui.read(),{mesh:0,spec});assert.deepEqual(values(f.host),DEFAULTS);
 const before=values(f.host);for(const bad of [{...spec,mesh:0,latitudeMax:'x'},{...spec,mesh:-1},{...spec,mesh:0,axis:[0,0]},{...spec,mesh:0,radius:null},null,[]])assert.throws(()=>f.ui.restore(bad));assert.deepEqual(values(f.host),DEFAULTS);assert.deepEqual(before,DEFAULTS);
});
test('reset restore(undefined) returns the documented defaults instead of keeping a previous model spec',()=>{
 const f=setup();f.ui.restore({...spec,mesh:0,radius:12,latitudeMin:10,latitudeMax:20,startDegrees:1,sweepDegrees:180,center:[1,2,3]});
 assert.deepEqual(f.ui.read(),{mesh:0,spec:{...spec,radius:12,latitudeMin:10,latitudeMax:20,startDegrees:1,sweepDegrees:180,center:[1,2,3]}});
 f.ui.restore(undefined);assert.deepEqual(f.ui.read(),{mesh:0,spec});assert.deepEqual(values(f.host),DEFAULTS);assert.equal(f.status.textContent,'');
});
test('a refused selection keeps the draft, the previous state and recovers on re-entry',async()=>{
 let refuse=true;const f=setup({onSelect:async(mesh,value)=>{if(refuse)throw Error('Spherical region does not intersect the display surface');return mesh+value.radius;}});
 await f.add.onclick();assert.equal(f.calls.length,1);assert.ok(f.status.textContent.includes('保持'));assert.ok(f.status.textContent.endsWith('Spherical region does not intersect the display surface'));assert.deepEqual(values(f.host),DEFAULTS);
 const radius=find(f.host,'spherical-radius');radius.value='9';await f.add.onclick();assert.deepEqual(f.calls.at(-1),{mesh:0,spec:{...spec,radius:9}});assert.equal(radius.value,'9');
 refuse=false;await f.add.onclick();assert.equal(f.status.textContent,'球面の数値領域を選択しました。');assert.deepEqual(values(f.host),DEFAULTS.map((v,i)=>i===10?'9':v));
});
test('JA/EN/JA labels and aria are reversible and the select control is a real button',()=>{
 const f=setup({language:'en'}),heading=all(f.host,'h3')[0];assert.equal(heading.textContent,'球面を緯度・経度で選ぶ');assert.equal(f.add.type,'button');assert.equal(f.add.onclick.constructor.name,'AsyncFunction');
 assert.equal(f.translations['球面を緯度・経度で選ぶ'],'Select sphere by latitude and longitude');
 assert.deepEqual(['半径（mm）','極軸X','経度幅','部品番号（0から）'].map(t=>f.translations[t]),['Radius (mm)','Polar axis X','Longitude span','Part index (from 0)']);
 const rendered=locale=>all(f.host,'input').map(c=>{const label=c.attributes['aria-label'];return locale==='en'?f.translations[label]??label:label;});
 const ja=rendered('ja');assert.ok(ja.includes('半径（mm）')&&ja.includes('極軸X')&&ja.includes('開始経度'));
 const en=rendered('en');assert.ok(en.includes('Radius (mm)')&&en.includes('Polar axis X')&&en.includes('Start longitude'));
 assert.deepEqual(rendered('ja'),ja);assert.ok(Object.values(f.translations).includes('Select spherical region'));
});
test('the panel drives the existing selectSphericalRegion and matches its triangles, area and saved spec',async()=>{
 const api=createStudioApi();api.loadProject(createProjectFromBuiltin({source:{kind:'sphere',center:[0,0,0],radius:10}}));
 const f=setup({onSelect:(mesh,value)=>api.selectSphericalRegion(mesh,value)});
 await f.add.onclick();
 const summary=api.getSummary(),exact=sphericalPatchArea(spec);assert.equal(summary.selectedTriangles,418);assert.ok(Math.abs(summary.selectedAreaMm2-exact)<1e-9);assert.ok(Math.abs(exact-157.07963267948966)<1e-9);
 assert.deepEqual(api.exportProject().sphericalRegion,{...spec,mesh:0});
 api.addCondition({type:'force',value:123,direction:[-1,0,0]});assert.deepEqual(api.exportProject().conditions[0].sphericalRegion,{...spec,mesh:0});
 for(const [id,value]of [['spherical-axis-x','0'],['spherical-latitude-min','30'],['spherical-sweep','361'],['spherical-radius','0']]){
  const before=JSON.stringify(api.exportProject());if(id==='spherical-axis-x'){find(f.host,'spherical-axis-y').value='0';find(f.host,'spherical-axis-z').value='0';}
  find(f.host,id).value=value;await f.add.onclick();assert.ok(f.status.textContent.includes('選択に失敗しました。入力は保持しています。'),id);assert.equal(JSON.stringify(api.exportProject()),before,id);f.ui.restore({...spec,mesh:0});
 }
 await f.add.onclick();assert.equal(api.getSummary().selectedTriangles,418);assert.deepEqual(api.exportProject().sphericalRegion,{...spec,mesh:0});
});
test('main.js mounts the panel in section 02 and delegates only to the existing selection API',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(source.includes('<div id="spherical-region-panel"></div>'));
 assert.ok(source.indexOf('id="spherical-region-panel"')<source.indexOf('<div id="area">'));
 assert.ok(source.includes("import {createSphericalRegionUi} from './ui/spherical-region-ui.js'"));
 assert.ok(source.includes('sphericalUi=createSphericalRegionUi({host:$(\'spherical-region-panel\')'));
 assert.ok(source.includes('api.selectSphericalRegion(mesh,spec)'));
 assert.ok(source.includes('sphericalUi?.restore(undefined)'));
 assert.ok(source.includes('if(sphericalRegion)sphericalUi?.restore(sphericalRegion)'));
});
