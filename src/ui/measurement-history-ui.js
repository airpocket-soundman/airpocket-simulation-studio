// Measurement history panel: list / save current probe / remove / export / import and
// automatic per-result-revision persistence. All dependencies are injected; validation is
// delegated to the same archive validator and API that the connector uses.
import {validateMeasurementArchive} from '../measurement-history.js';
const MAX_COUNT=100,MAX_REVISIONS=20,KEY_PREFIX='archive:',INDEX_KEY='index';
const TRANSLATIONS={'測定履歴':'Measurement history','測定名':'Measurement name','現在のプローブ点を保存':'Save current probe','履歴をJSONで保存':'Export history as JSON','履歴JSONを読み込む':'Open history JSON','保存した履歴をすべて消去':'Clear all history and saved copy'};
export function describeMeasurement(record){
 const e=record.evidence,field=e.display.field,n=(v,d=5)=>Number(v).toPrecision(d);
 let value;
 switch(e.kind){
  case 'elastic':value=field==='stress'?[n(e.vonMisesPa/1e6),'MPa']:field==='plasticStrain'?[n(e.equivalentPlasticStrain*100,6),'%']:[n(e.magnitudeMm),'mm'];break;
  case 'modal':value=[n(e.frequencyHz),'Hz'];break;
  case 'thermal':value=field==='heatFlux'?[n(Math.hypot(...e.flux)),'W/m²']:[n(e.temperature),'°C'];break;
  case 'acousticTransient':value=[n(e.pressurePa),'Pa'];break;
  case 'acoustic':value=field==='spl'?[n(e.splDb),'dB']:field==='phase'?[n(e.phase),'rad']:[n(e.peakPressurePa),'Pa'];break;
  default:value=field==='fluidPressure'?[n(e.pressurePa),'Pa']:[n(e.speedMs),'m/s'];
 }
 const d=e.display,context=[];
 if(d.modeIndex!==null&&d.modeIndex!==undefined)context.push('mode '+d.modeIndex);
 if(d.frameIndex!==null&&d.frameIndex!==undefined)context.push('frame '+d.frameIndex+(d.physicalTimeSeconds!==undefined?' ('+(d.physicalTimeSeconds*1000).toPrecision(4)+' ms)':''));
 if(e.kind==='thermal'&&d.physicalTimeSeconds!==undefined)context.push('frame '+d.storedFrameIndex+' ('+Number(d.physicalTimeSeconds.toPrecision(6))+' s)');
 return {field,value:value[0],unit:value[1],context:context.join(' · ')};
}
export function installMeasurementHistoryUi({document:doc=globalThis.document,anchor,api,resultView,storage=null,translate=()=>{},language=()=>'ja',validateArchive=validateMeasurementArchive,env={}}){
 if(!anchor||!api||!resultView)throw TypeError('Invalid measurement history UI dependencies');
 const URLApi=env.URL||globalThis.URL,BlobApi=env.Blob||globalThis.Blob,t=(ja,en)=>language()==='en'?en:ja;
 const nodes={};
 function el(tag,id,props={},...children){const e=doc.createElement(tag);if(id){e.id=id;nodes[id]=e;}Object.assign(e,props);if(children.length)e.append(...children);return e;}
 const host=el('details','measurement-history');
 host.append(el('summary',null,{textContent:'測定履歴'}),
  el('label',null,{textContent:'測定名'},el('input','measurement-history-name',{value:'Probe 1',maxLength:100})),
  el('button','measurement-history-save',{textContent:'現在のプローブ点を保存'}),
  el('button','measurement-history-export',{textContent:'履歴をJSONで保存'}),
  el('label',null,{textContent:'履歴JSONを読み込む'},el('input','measurement-history-import',{type:'file',accept:'.json,application/json'})),
  el('button','measurement-history-clear',{textContent:'保存した履歴をすべて消去'}),
  el('p','measurement-history-note'),el('p','measurement-history-status',{role:'status'}),
  el('div','measurement-history-list'),el('p','measurement-history-other'));
 anchor.after(host);translate(TRANSLATIONS);
 const loaded=new Set();let probe=null,downloadUrl,storageOk=true;
 const setStatus=(ja,en)=>{nodes['measurement-history-status'].textContent=t(ja,en);};
 const fail=error=>{nodes['measurement-history-status'].textContent=error?.message||String(error);};
 const keyFor=revision=>KEY_PREFIX+revision;
 const currentRevision=async()=>{try{return (await resultView.get()).resultRevision;}catch{return null;}};
 const groupOf=(records,revision)=>records.filter(r=>r.resultRevision===revision);
 // ---- storage (never required for the page to work) ----
 async function readStored(revision){
  if(!storage)return [];
  let text;
  try{text=await storage.get(keyFor(revision));}catch{storageOk=false;return [];}
  if(text===null||text===undefined)return [];
  try{const archive=validateArchive(JSON.parse(text));if(archive.measurements.every(r=>r.resultRevision===revision))return archive.measurements;}catch{}
  try{await storage.remove(keyFor(revision));}catch{}
  return [];
 }
 async function restore(revision){
  if(!storage||loaded.has(revision))return;loaded.add(revision);
  try{
   const stored=await readStored(revision);if(!stored.length)return;
   const current=await api.exportArchive(),known=new Set(current.archive.measurements.map(r=>r.id)),extra=stored.filter(r=>!known.has(r.id));if(!extra.length)return;
   const archive=validateArchive({version:1,measurements:[...current.archive.measurements,...extra].slice(0,MAX_COUNT)});
   await api.importArchive({archive,expectedArchiveRevision:current.archiveRevision});
  }catch{loaded.delete(revision);}
 }
 async function persist(touched=[]){
  if(!storage)return;
  try{
   const {archive}=await api.exportArchive(),revisions=new Set([...touched,...archive.measurements.map(r=>r.resultRevision)]);
   let index=[];try{const text=await storage.get(INDEX_KEY);const parsed=text?JSON.parse(text):[];if(Array.isArray(parsed))index=parsed.filter(v=>typeof v==='string');}catch{}
   for(const revision of revisions){
    let records=groupOf(archive.measurements,revision);
    if(!loaded.has(revision)){const stored=await readStored(revision),ids=new Set(records.map(r=>r.id));records=[...records,...stored.filter(r=>!ids.has(r.id))].slice(0,MAX_COUNT);}
    index=index.filter(v=>v!==revision);
    if(!records.length){await storage.remove(keyFor(revision));continue;}
    await storage.set(keyFor(revision),JSON.stringify(validateArchive({version:1,measurements:records})));index.push(revision);
   }
   while(index.length>MAX_REVISIONS)await storage.remove(keyFor(index.shift()));
   await storage.set(INDEX_KEY,JSON.stringify(index));storageOk=true;
  }catch{storageOk=false;}
 }
 async function clearStored(){
  if(!storage)return;
  try{for(const key of await storage.keys())if(key===INDEX_KEY||key.startsWith(KEY_PREFIX))await storage.remove(key);storageOk=true;}catch{storageOk=false;}
 }
 // ---- rendering ----
 function note(){
  const base=t('この履歴は、この端末のこのブラウザ（このオリジン）だけに結果SHAごとに自動保存されます（最大100件・300,000バイト）。測定値は独立検証済みではありません。履歴JSONの保存で持ち出せます。','Saved automatically in this browser (this origin only), keyed by result SHA (up to 100 entries / 300,000 bytes). Values are not independently verified. Export JSON to move them elsewhere.');
  if(!storage)return base+' '+t('このブラウザでは自動保存を使えません。','Automatic saving is unavailable here.');
  return base+(storageOk?'':' '+t('ブラウザ保存に失敗しました。履歴は画面を閉じると失われます。','Saving to the browser failed; history is lost when the page closes.'));
 }
 async function render(){
  const current=await currentRevision();let archive;
  try{archive=(await api.exportArchive()).archive;}catch(error){fail(error);return;}
  nodes['measurement-history-note'].textContent=note();
  const list=nodes['measurement-history-list'];list.replaceChildren();
  const shown=current?groupOf(archive.measurements,current):[],others=archive.measurements.length-shown.length;
  if(!current)list.append(el('p',null,{textContent:t('表示中の解析結果がありません。','No analysis result is displayed.')}));
  for(const record of shown){
   const d=describeMeasurement(record),row=el('article',null);
   row.append(el('strong',null,{textContent:record.name}),el('p',null,{textContent:'['+record.point.map(v=>v.toFixed(3)).join(', ')+'] mm · '+d.field+' · '+d.value+' '+d.unit+(d.context?' · '+d.context:'')}));
   row.append(el('button',null,{textContent:t('削除','Remove'),onclick:()=>run(async()=>{const full=await api.get({measurementId:record.id});await api.remove({measurementId:record.id,expectedRevision:full.revision});await persist([record.resultRevision]);setStatus('履歴を削除しました。','History entry removed.');})}));
   list.append(row);
  }
  nodes['measurement-history-other'].textContent=others?t('他の結果に結び付く履歴が'+others+'件あります（この結果では一覧しません）。','There are '+others+' history entries bound to other results (not listed for this result).'):'';
  nodes['measurement-history-save'].disabled=!current;
 }
 async function run(action){try{await action();}catch(error){fail(error);}try{await render();}catch(error){fail(error);}}
 async function refresh(){const current=await currentRevision();if(current)await restore(current);await render();}
 // ---- actions ----
 nodes['measurement-history-save'].onclick=()=>run(async()=>{
  if(!probe){setStatus('先に結果上の点を測定してください。','Probe a point on the result first.');return;}
  const current=await resultView.get(),revision=await probe.revision;
  if(revision!==current.resultRevision){probe=null;setStatus('測定した点は別の結果のものです。もう一度測定してください。','The probed point belongs to a different result. Probe again.');return;}
  await restore(revision);
  const listing=await api.list();
  await api.save({name:nodes['measurement-history-name'].value,expectedResultRevision:revision,expectedArchiveRevision:listing.archiveRevision,point:probe.point,options:probe.options});
  await persist([revision]);setStatus('履歴を保存しました。','History entry saved.');
 });
 nodes['measurement-history-export'].onclick=()=>run(async()=>{
  const {archive}=await api.exportArchive();if(downloadUrl)URLApi.revokeObjectURL(downloadUrl);
  downloadUrl=URLApi.createObjectURL(new BlobApi([JSON.stringify(archive)],{type:'application/json'}));
  const link=doc.createElement('a');link.href=downloadUrl;link.download='simulation-measurements.json';link.click();setStatus('履歴をJSONへ書き出しました。','History exported as JSON.');
 });
 nodes['measurement-history-import'].onchange=event=>run(async()=>{
  const file=event.target.files[0];
  try{
   if(!file)return;if(file.size>1000000)throw Error('Measurement archive exceeds 1 MB');
   const archive=JSON.parse(await file.text()),listing=await api.list(),before=(await api.exportArchive()).archive.measurements.map(r=>r.resultRevision);
   await api.importArchive({archive,expectedArchiveRevision:listing.archiveRevision});
   await persist([...before,...archive.measurements.map(r=>r.resultRevision)]);setStatus('履歴JSONを読み込みました。','History JSON opened.');
  }finally{event.target.value='';}
 });
 nodes['measurement-history-clear'].onclick=()=>run(async()=>{
  const listing=await api.list();await api.importArchive({archive:{version:1,measurements:[]},expectedArchiveRevision:listing.archiveRevision});await clearStored();setStatus('履歴とこのブラウザの保存コピーを消去しました。','History and the saved copy in this browser were cleared.');
 });
 doc.addEventListener?.('studio-language',()=>{render().catch(fail);});
 const ready=refresh().catch(fail);
 return Object.freeze({
  ready,
  refresh:()=>refresh().catch(fail),
  // Called by the probe tool with the point/selector it just measured; bound to the displayed result.
  setProbe(point,options={}){const clean={};for(const key of ['bodyIndex','elementIndex'])if(options[key]!==undefined)clean[key]=options[key];probe={point:[...point],options:clean,revision:currentRevision()};}
 });
}
