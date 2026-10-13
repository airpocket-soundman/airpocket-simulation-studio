import { materialFields,materialReadiness } from './materials.js';
import { createStudioApi } from './studio-api.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { areaOfTriangle, brushTriangles, validateProject } from './regions.js';
import './style.css';

document.querySelector('#app').innerHTML=`
<header><div><h1>Airpocket <span style="color:#77dbd1">Simulation Studio</span></h1><small>3D上で、解析する場所を決める</small></div><span class="badge">領域設定プレビュー · v0.1</span><a class="dev-link" href="./development.html">開発管理 ↗</a></header>
<div class="layout"><aside><section><h2>01 モデル</h2><label class="file">STEP / STL を開く<input id="model" type="file" accept=".step,.stp,.stl"></label><div class="row"><button id="demo">曲面サンプル</button><button id="fit">全体表示</button></div><label>STLの長さ単位<select id="unit"><option value="1">mm</option><option value="10">cm</option><option value="1000">m</option></select></label><p>STEPはmmに変換。ファイルはこのブラウザで処理します。</p></section>
<section><h2>02 領域を選ぶ</h2><div class="row" id="modes"><button data-mode="orbit" class="active">回転</button><button data-mode="face">面</button><button data-mode="brush">ブラシ</button><button data-mode="erase">消しゴム</button></div><label>ブラシ半径 <span id="radiusText">6</span> mm<input id="radius" type="range" min="0.1" max="30" step="0.1" value="6"></label><div class="row"><button id="undo">戻す</button><button id="clear">選択解除</button></div><label><input id="wire" type="checkbox"> 表面の三角形を表示</label><div id="area">0 mm²</div><small id="count">選択なし</small><p>ブラシは空間距離による範囲です。見えている同じ面の三角形だけを選択。選択モードでは右ドラッグで回転します。</p></section>
<section><h2>保存・復元</h2><button id="save">プロジェクトを書き出す</button><label class="file">プロジェクトを開く<input id="restore" type="file" accept=".json"></label><small>表示形状・選択・設定条件を保存</small></section></aside>
<main class="viewport"><canvas id="canvas"></canvas><div class="overlay"><strong id="name">曲面サンプル</strong><div id="status" class="status" role="status">回転して、固定する場所を選んでください。</div></div><div class="hint">ホイール: 拡大縮小 / 右ドラッグ: 選択モードで回転 / 中ドラッグ: 移動<br>黄色: 選択中　青: 固定　橙: 荷重</div></main>
<aside><section><h2>03 解析条件</h2><label>解析分野<select id="physics"><option>構造</option><option disabled>熱（準備中）</option><option disabled>流体（準備中）</option><option disabled>振動・音響（準備中）</option></select></label><label>材料カテゴリ<select id="material"><option>金属</option><option>樹脂</option><option>ガラス</option><option>ゴム</option></select></label><details><summary>材料物性を入力</summary><div id="material-fields"></div><label>グレード<input id="material-grade" maxlength="200"></label><label>物性の出典<input id="material-source" maxlength="1000"></label><label>強度の意味・試験条件<input id="material-notes" maxlength="1000" placeholder="降伏強度、引張強度など"></label><button id="material-save">物性を登録</button><p id="material-status" role="status"></p></details><div class="row"><button id="fixed">選択範囲を固定</button></div><label>合計荷重（N）<input id="force" type="number" value="100" min="0" step="1"></label><label>全体座標での荷重方向 X / Y / Z</label><div class="direction"><input id="dx" type="number" value="0" aria-label="X方向"><input id="dy" type="number" value="-1" aria-label="Y方向"><input id="dz" type="number" value="0" aria-label="Z方向"></div><div class="row"><button id="load">選択範囲に荷重</button></div></section>
<section><h2>設定した条件</h2><div id="conditions"></div></section><section><h2>計算エンジン</h2><select disabled><option>ブラウザ版ソルバー検証中</option></select><p>CPU / WASM を基本に、対応ソルバーを追加予定。</p><button disabled>解析する（未実装）</button></section><div class="notice">現在は領域と条件を設定する試作版です。表示の三角形は解析用の体積メッシュではありません。変形・強度の計算はまだ行いません。</div></aside></div>`;

const $=id=>document.getElementById(id), status=text=>$('status').textContent=text;
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(40,1,.01,100000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xffffff,0x446079,2.3)); const light=new THREE.DirectionalLight(0xffffff,2.2); light.position.set(50,100,80);scene.add(light);
const group=new THREE.Group();scene.add(group);const markers=new THREE.Group();scene.add(markers);
let meshes=[], conditions=[], mode='orbit', selection=[], history=[], modelName='曲面サンプル', worker=null, pointerDown=false;
let materialProperties={};
const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
function geometryData(g,faceIds){if(g.index)g=g.toNonIndexed();g.computeVertexNormals();return {positions:Array.from(g.attributes.position.array),faceIds:faceIds||Array(g.attributes.position.count/3).fill(0)};}
function setModel(data,name){
 for(const m of meshes){m.geometry.dispose();m.material.dispose();}group.clear();markers.clear();
 meshes=data.map((d,index)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));g.computeVertexNormals();g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(d.positions.length),3));const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.18,side:THREE.DoubleSide}));m.userData={index,faceIds:d.faceIds,kind:d.kind||'cad'};group.add(m);return m;});
 selection=meshes.map(()=>new Set());conditions=[];materialProperties={};history=[];modelName=name;$('name').textContent=name;fit();repaint();renderConditions();
}
function fit(){controls.enableDamping=false;const box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),r=Math.max(size.x,size.y,size.z,1);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(r*1.4,r*.9,r*1.6));camera.near=r/10000;camera.far=r*100;camera.updateProjectionMatrix();controls.update();controls.enableDamping=true;$('radius').max=Math.max(r/2,1);$('radius').value=Math.min(6,r/10);$('radiusText').textContent=$('radius').value;}
function snapshot(){history.push(selection.map(s=>[...s]));if(history.length>30)history.shift();}
function selectedRegions(){return selection.map((s,mesh)=>({mesh,triangles:[...s]})).filter(r=>r.triangles.length);}
function repaint(){
 let area=0,count=0;
 meshes.forEach((m,mi)=>{const colors=m.geometry.attributes.color;for(let t=0;t<m.userData.faceIds.length;t++){
 let color=new THREE.Color('#91a8b7');for(const c of conditions)if(c.regions.some(r=>r.mesh===mi&&r.triangles.includes(t)))color.set(c.type==='fixed'?'#36b9da':'#f69d53');
 if(selection[mi].has(t)){color.set('#f9d76b');area+=areaOfTriangle(m.geometry.attributes.position.array,t);count++;}for(let v=0;v<3;v++)colors.setXYZ(t*3+v,color.r,color.g,color.b);
 }colors.needsUpdate=true;m.material.wireframe=$('wire').checked;});
 $('area').textContent=area.toLocaleString('ja-JP',{maximumFractionDigits:2})+' mm²';$('count').textContent=count+' 三角形を選択';$('fixed').disabled=$('load').disabled=!count;
 updateMarkers();
}
function updateMarkers(){for(const child of [...markers.children]){child.traverse(o=>{o.geometry?.dispose();if(o.material)for(const mat of [].concat(o.material))mat.dispose();});markers.remove(child);}
 const scale=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).length()*.13;
 for(const c of conditions){if(c.type!=='force')continue;const center=new THREE.Vector3();let n=0;for(const r of c.regions){const p=meshes[r.mesh].geometry.attributes.position;for(const t of r.triangles)for(let v=0;v<3;v++){center.add(new THREE.Vector3().fromBufferAttribute(p,t*3+v));n++;}}if(n){center.divideScalar(n);markers.add(new THREE.ArrowHelper(new THREE.Vector3(...c.direction).normalize(),center,scale,0xffac58));}}
}
function demo(){const g=new THREE.CylinderGeometry(12,12,60,64,24,false).toNonIndexed(),p=g.attributes.position.array;const ids=[];for(let t=0;t<p.length/9;t++){const i=t*9;ids.push(Math.abs(p[i+1]-30)<.001&&Math.abs(p[i+4]-30)<.001&&Math.abs(p[i+7]-30)<.001?1:Math.abs(p[i+1]+30)<.001&&Math.abs(p[i+4]+30)<.001&&Math.abs(p[i+7]+30)<.001?2:0);}setModel([geometryData(g,ids)],'曲面サンプル · Ø24 × 60 mm');g.dispose();status('曲面の一部分をブラシで選べます。');}
function hitAt(x,y){const rect=$('canvas').getBoundingClientRect();mouse.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);return ray.intersectObjects(meshes,false)[0];}
function paint(event){const hit=hitAt(event.clientX,event.clientY);if(!hit)return;const m=hit.object,mi=m.userData.index,t=hit.faceIndex,face=m.userData.faceIds[t],p=m.geometry.attributes.position.array;
 let candidates=mode==='face'?m.userData.faceIds.flatMap((f,i)=>f===face?[i]:[]):brushTriangles(p,hit.point,Number($('radius').value));
 const rect=$('canvas').getBoundingClientRect();
 for(const i of candidates){if(mode!=='face'){
 if(m.userData.kind==='cad'&&m.userData.faceIds[i]!==face)continue;
 const k=i*9,center=new THREE.Vector3((p[k]+p[k+3]+p[k+6])/3,(p[k+1]+p[k+4]+p[k+7])/3,(p[k+2]+p[k+5]+p[k+8])/3).project(camera);
 if(center.z < -1||center.z>1||Math.abs(center.x)>1||Math.abs(center.y)>1)continue;
 const visible=hitAt(rect.left+(center.x+1)*rect.width/2,rect.top+(1-center.y)*rect.height/2);
 if(!visible||visible.object!==m||visible.faceIndex!==i)continue;
 }if(mode==='erase')selection[mi].delete(i);else selection[mi].add(i);
 }repaint();}
$('canvas').addEventListener('pointerdown',e=>{if(e.button!==0||mode==='orbit')return;snapshot();pointerDown=true;$('canvas').setPointerCapture(e.pointerId);paint(e);});
$('canvas').addEventListener('pointermove',e=>{if(pointerDown&&mode!=='face')paint(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('canvas').addEventListener(type,()=>pointerDown=false);
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b===button));controls.mouseButtons.LEFT=mode==='orbit'?THREE.MOUSE.ROTATE:null;controls.mouseButtons.RIGHT=mode==='orbit'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;$('canvas').style.cursor=mode==='orbit'?'grab':'crosshair';};
$('radius').oninput=()=>$('radiusText').textContent=$('radius').value;
$('wire').onchange=repaint;$('fit').onclick=fit;$('demo').onclick=demo;
$('clear').onclick=()=>{snapshot();selection.forEach(s=>s.clear());repaint();};$('undo').onclick=()=>{if(history.length){selection=history.pop().map(a=>new Set(a));repaint();}};
function addCondition(type){try{api.addCondition({type,value:type==='force'?Number($('force').value):0,direction:['dx','dy','dz'].map(id=>Number($(id).value))});status('条件を登録しました。まだ解析計算は行っていません。');}catch(error){status(error.message);}}
$('fixed').onclick=()=>addCondition('fixed');$('load').onclick=()=>addCondition('force');
function renderConditions(){const root=$('conditions');root.replaceChildren();if(!conditions.length){root.textContent='条件はまだありません。';return;}conditions.forEach((c,i)=>{const div=document.createElement('div');div.className='condition';const strong=document.createElement('strong');strong.textContent=c.type==='fixed'?`固定 ${i+1}`:`荷重 ${i+1} · ${c.value} N`;div.append(strong);const text=document.createElement('small');text.textContent=c.type==='fixed'?'全方向の変位を拘束':`方向 (${c.direction.join(', ')}) · 全体座標`;div.append(text);const row=document.createElement('div');for(const [label,action]of [['領域を選択',()=>{snapshot();api.selectCondition(i);}],['削除',()=>{api.removeCondition(i);}]]){const b=document.createElement('button');b.textContent=label;b.onclick=action;row.append(b);}div.append(row);root.append(div);});}
function cadImport(buffer){return new Promise((resolve,reject)=>{worker=new Worker(new URL('./cad.worker.js',import.meta.url),{type:'classic'});const timer=setTimeout(()=>{worker?.terminate();worker=null;reject(Error('読み込みが時間制限（90秒）を超えました。'));},90000);const finish=()=>{clearTimeout(timer);worker?.terminate();worker=null;};worker.onmessage=({data})=>{finish();data.error?reject(Error(data.error)):resolve(data.result);};worker.onerror=e=>{finish();reject(Error(e.message));};worker.postMessage({buffer,base:new URL(import.meta.env.BASE_URL,location.href).href},[buffer]);});}
$('model').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>50*1024*1024)throw Error('初期版の上限は50 MBです。');$('model').disabled=true;status('モデルを読み込んでいます…');const buffer=await file.arrayBuffer();if(/\.stl$/i.test(file.name)){const g=new STLLoader().parse(buffer);g.scale(Number($('unit').value),Number($('unit').value),Number($('unit').value));const d=geometryData(g);d.kind='stl';d.faceIds=d.faceIds.map((_,i)=>i);validateProject({version:1,meshes:[d],conditions:[]});setModel([d],file.name);g.dispose();status('STL: 面選択は三角形単位です。ブラシで見えている範囲を選べます。');}else{const result=await cadImport(buffer);const data=result.meshes.map(m=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.attributes.position.array,3));g.setIndex(m.index.array);const ids=Array(m.index.array.length/3).fill(-1);m.brep_faces.forEach((f,fi)=>{for(let t=f.first;t<=f.last;t++)ids[t]=fi;});const d=geometryData(g,ids);g.dispose();return d;});validateProject({version:1,meshes:data,conditions:[]});setModel(data,file.name);status('STEP読み込み完了。CAD面またはブラシで領域を指定できます。');}}catch(error){status('読み込み失敗: '+error.message);}finally{$('model').disabled=false;e.target.value='';}};
function getProject(){return {version:1,name:modelName,material:$('material').value,materialProperties,meshes:meshes.map(m=>({positions:Array.from(m.geometry.attributes.position.array),faceIds:m.userData.faceIds,kind:m.userData.kind})),conditions,selection:selection.map(s=>[...s])};}
const api=createStudioApi({get:getProject,set:(p,reason)=>{if(reason==='load')setModel(p.meshes,typeof p.name==='string'?p.name:'復元モデル');materialProperties=p.materialProperties||{};renderMaterial();conditions=p.conditions;selection=p.selection.map(s=>new Set(s));if(['金属','樹脂','ガラス','ゴム'].includes(p.material))$('material').value=p.material;if(reason!=='selection')history=[];renderConditions();repaint();}});
window.studioApi=api;
for(const f of materialFields){const label=document.createElement('label');label.textContent=f.label+(f.unit?'（'+f.unit+'）':'');const input=document.createElement('input');input.id='mat-'+f.key;input.type='number';input.step='any';input.placeholder='未入力';label.append(input);$('material-fields').append(label);}
function renderMaterial(){for(const f of materialFields)$('mat-'+f.key).value=materialProperties[f.key]==null?'':materialProperties[f.key]/f.scale;for(const k of ['grade','source','notes'])$('material-'+k).value=materialProperties[k]||'';const r=materialReadiness($('material').value,materialProperties);$('material-status').textContent=(r.linearElasticMissing.length?'線形弾性の物性は不足しています。':'線形弾性の基本物性を登録済み。')+' '+r.note+' 解析ソルバーは未接続です。';}
$('material').onchange=()=>{api.setMaterial($('material').value);renderMaterial();};
$('material-save').onclick=()=>{try{const p={};for(const f of materialFields){const v=$('mat-'+f.key).value;p[f.key]=v===''?null:Number(v)*f.scale;}for(const k of ['grade','source','notes'])p[k]=$('material-'+k).value;api.setMaterialProperties(p);renderMaterial();status('材料物性を登録しました。');}catch(e){$('material-status').textContent=e.message;}};renderMaterial();

$('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(api.exportProject())],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='simulation-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('プロジェクトを書き出しました。');};
$('restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>200*1024*1024)throw Error('ファイルが大きすぎます。');api.loadProject(JSON.parse(await f.text()));status('プロジェクトを復元しました。');}catch(error){status('復元失敗: '+error.message);}finally{e.target.value='';}};
new ResizeObserver(()=>{const rect=$('canvas').parentElement.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();}).observe($('canvas').parentElement);
demo();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
