import {validateComparisonSettings} from '../comparison-view-settings.js';
// Two-case left/right result comparison panel (VIEWCOMPARE increment 2). Every dependency is injected.
// It renders each saved case with the existing result renderer (via renderCase, supplied by main.js) and
// composes the snapshots on a 2D canvas using the pure rules in view-compare-layout.js.
import {resolveSharedTime} from '../view-compare-layout.js';
import {createComparisonRenderer} from '../view-compare-renderer.js';
const T = {
  '比較動画を作る':'Create comparison video','動画作成を中止':'Cancel video creation','動画の長さ（秒）':'Video duration (seconds)','比較動画を保存':'Save comparison video',
  '比較動画は共通カメラの回転です。選択した保存時刻は固定されます。':'Comparison video rotates the shared camera. The selected stored time stays fixed.',
  'このブラウザでは比較動画を作成できません。':'This browser cannot create comparison videos.','動画を作成しています。':'Creating video.','動画作成を中止しています。':'Cancelling video creation.',
  '動画作成を中止しました。':'Video creation cancelled.','動画を作成しました。再生して確認し、保存リンクから保存してください。':'Video ready. Play it to review, then use the save link.',
  '長さは1〜15秒の整数で指定してください。':'Duration must be an integer from 1 through 15 seconds.',
  '比較設定ファイル': 'Comparison settings file', '比較設定JSON': 'Comparison settings JSON', '比較設定を書き出す': 'Export comparison settings', '比較設定を読み込む': 'Import comparison settings', '現在の表示設定を使う': 'Use current viewer settings', '読み込んだ比較設定を使用中（メイン表示は変更しません）。': 'Using imported comparison settings (the main viewer is unchanged).', '比較設定を読み込みました。比較を表示して確認してください。': 'Comparison settings imported. Show the comparison to review them.',
  '2ケース並べて比較': 'Compare two cases side by side',
  '左のケース': 'Left case', '右のケース': 'Right case',
  '共通の物理時刻（秒、保存済みの音響・温度フレーム）': 'Shared physical time (s, stored acoustic or temperature frames)',
  '比較を表示': 'Show comparison', '比較画像をPNGで保存': 'Save comparison as PNG',
  '共通の色範囲・変形倍率・カメラ・保存フレームで左右に表示します。色範囲は同じ物理量・単位のときだけ共有します。': 'Shows both cases with a shared colour range, deformation scale, camera and stored frame. The colour range is shared only for the same quantity and unit.',
  '保存ケースが2件以上必要です。': 'Two or more saved cases are required.',
  '左右に別のケースを選んでください。': 'Choose two different cases.',
  '共通の物理時刻を入力してください。': 'Enter the shared physical time.',
  '比較を表示しました。': 'Comparison shown.',
  '最終ステップのみ（共通時刻は適用されません）': 'Final step only (shared time does not apply)',
  '共通色範囲': 'Shared colour range', '変形倍率': 'Deformation scale', '物理時刻': 'Physical time', '保存フレームとのずれ': 'Offset from stored frame', '時間軸なし': 'no time axis',
  '表示中の結果の物理量（結果の表示欄で選択中のもの）を左右とも表示します。過渡音響の組は、先に過渡の結果を表示してから比較してください。': 'Both panels show the quantity selected in the main result viewer. For a transient pair, display a transient result in the viewer first, then compare.'
};
export function createViewCompareUi({$, document: doc = globalThis.document, anchor, store, status, translate = () => {}, language = () => 'ja', inspectCase, renderCase, colorAt = () => '#888', getField, getDeformScale, getCamera, presetApi, videoApi, env = {}}) {
  const URLApi = env.URL || globalThis.URL, tr = (ja) => language() === 'en' ? (T[ja] ?? ja) : ja;
  translate(T);
  const host = doc.createElement('details');
  const el = (tag, id, text) => { const e = doc.createElement(tag); if (id) e.id = id; if (text) e.textContent = text; return e; };
  const summary = el('summary', null, '2ケース並べて比較'), note = el('p', null, '共通の色範囲・変形倍率・カメラ・保存フレームで左右に表示します。色範囲は同じ物理量・単位のときだけ共有します。');
  const hint = el('p', 'compare-hint', '表示中の結果の物理量（結果の表示欄で選択中のもの）を左右とも表示します。過渡音響の組は、先に過渡の結果を表示してから比較してください。');
  let overrides=null;
  hint.style.fontSize = '12px'; const syncHint = () => { hint.textContent = overrides ? tr('読み込んだ比較設定を使用中（メイン表示は変更しません）。') : tr('表示中の結果の物理量（結果の表示欄で選択中のもの）を左右とも表示します。過渡音響の組は、先に過渡の結果を表示してから比較してください。'); };
  const a = el('select', 'compare-left'), b = el('select', 'compare-right'), time = el('input', 'compare-time');
  time.type = 'number'; time.step = 'any'; time.placeholder = '0.001';
  const run = el('button', 'compare-run', '比較を表示'), png = el('button', 'compare-png', '比較画像をPNGで保存'), out = el('p', 'compare-status'), canvas = el('canvas', 'compare-canvas');
  out.setAttribute('role', 'status'); canvas.style.maxWidth = '100%'; png.disabled = true;
  const label = (text, control) => { const l = el('label', null, text + ' '); l.append(control); return l; };
  host.append(summary, note, hint, label('左のケース', a), label('右のケース', b), label('共通の物理時刻（秒、保存済みの音響・温度フレーム）', time), run, png, out, canvas);
  const json=el('textarea','compare-settings-json'),save=el('button','compare-settings-export','比較設定を書き出す'),load=el('button','compare-settings-import','比較設定を読み込む'),reset=el('button','compare-settings-reset','現在の表示設定を使う');
  json.setAttribute('aria-label',tr('比較設定JSON'));json.rows=6;json.style.width='100%';
  save.disabled=load.disabled=!presetApi;
  const file=el('input','compare-settings-file');file.type='file';file.accept='.json,application/json';file.disabled=!presetApi;
  host.append(label('比較設定JSON',json),save,load,label('比較設定ファイル',file),reset);
  const videoSeconds=el('input','compare-video-seconds'),videoStart=el('button','compare-video-start','比較動画を作る'),videoCancel=el('button','compare-video-cancel','動画作成を中止'),videoStatus=el('p','compare-video-status'),videoPreview=el('video','compare-video-preview'),videoDownload=el('a','compare-video-download','比較動画を保存'),videoNote=el('p',null,'比較動画は共通カメラの回転です。選択した保存時刻は固定されます。');
  videoSeconds.type='number';videoSeconds.min=1;videoSeconds.max=15;videoSeconds.step=1;videoSeconds.value='2';
  videoStatus.setAttribute('role','status');videoPreview.controls=true;videoPreview.hidden=true;videoPreview.style.maxWidth='100%';videoDownload.hidden=true;videoCancel.disabled=true;
  host.append(videoNote,label('動画の長さ（秒）',videoSeconds),videoStart,videoCancel,videoStatus,videoPreview,videoDownload);
  let videoUrl,videoActive;
  function clearVideo(){videoPreview.pause?.();videoPreview.removeAttribute?.('src');videoPreview.src='';videoPreview.load?.();videoPreview.hidden=true;videoDownload.removeAttribute?.('href');videoDownload.href='';videoDownload.hidden=true;if(videoUrl){URLApi.revokeObjectURL(videoUrl);videoUrl=undefined;}}
  function videoCapability(){try{return videoApi?.capabilities?.()??{supported:false,reason:tr('このブラウザでは比較動画を作成できません。')};}catch(error){return {supported:false,reason:error.message};}}
  function syncVideoCapability(){const capability=videoCapability();videoStart.disabled=!!videoActive||!capability.supported;videoSeconds.disabled=!!videoActive;videoCancel.disabled=!videoActive;if(!capability.supported&&!videoActive)videoStatus.textContent=tr('このブラウザでは比較動画を作成できません。');}
  videoStart.onclick=async()=>{
    if(videoActive)return;
    clearVideo();const token={cancelled:false};videoActive=token;syncVideoCapability();
    try{
      const capability=videoCapability();if(!capability.supported)throw Error(tr('このブラウザでは比較動画を作成できません。'));
      const seconds=Number(videoSeconds.value);if(!Number.isInteger(seconds)||seconds<1||seconds>15)throw Error(tr('長さは1〜15秒の整数で指定してください。'));
      const state=capture({validate:true});videoStatus.textContent=tr('動画を作成しています。');
      const result=await videoApi.start(state,{seconds,onProgress:value=>{const fraction=typeof value==='number'?value:value?.fraction;if(videoActive===token&&!token.cancelled&&Number.isFinite(fraction))videoStatus.textContent=tr('動画を作成しています。')+' '+Math.round(Math.max(0,Math.min(1,fraction))*100)+'%';}});
      if(videoActive!==token||token.cancelled)return;
      if(!(result?.blob instanceof Blob)||!result.blob.size||!/^video\/webm(?:;|$)/.test(result.blob.type))throw Error('Invalid comparison video artifact');
      videoUrl=URLApi.createObjectURL(result.blob);videoPreview.src=videoUrl;videoPreview.hidden=false;videoDownload.href=videoUrl;videoDownload.download='case-comparison-orbit.webm';videoDownload.hidden=false;
      videoStatus.textContent=tr('動画を作成しました。再生して確認し、保存リンクから保存してください。');
    }catch(error){clearVideo();videoStatus.textContent=token.cancelled?tr('動画作成を中止しました。'):error.message;}
    finally{if(videoActive===token){videoActive=undefined;if(token.cancelled){clearVideo();videoStatus.textContent=tr('動画作成を中止しました。');}syncVideoCapability();}}
  };
  videoCancel.onclick=async()=>{if(!videoActive)return;videoActive.cancelled=true;clearVideo();videoStatus.textContent=tr('動画作成を中止しています。');try{await videoApi.cancel();}catch(error){videoStatus.textContent=error.message;}};
  syncVideoCapability();
  anchor.after(host);
  host.addEventListener('toggle', refresh);
  // Per-case access when the store supports it (no whole-store clone); other stores keep the list() path.
  const at = i => typeof store.at === 'function' ? store.at(i) : store.list()[i];
  const count = () => typeof store.count === 'function' ? store.count() : store.list().length;
  const names = () => typeof store.names === 'function' ? store.names() : store.list().map(c => c.name);
  function refresh() {
    syncHint();
    syncVideoCapability();
    for (const s of [a, b]) { const keep = s.value; s.replaceChildren(); for (const [i, name] of names().entries()) { const o = doc.createElement('option'); o.value = i; o.textContent = name; s.append(o); } s.value = keep && Number(keep) < count() ? keep : s === a ? '0' : '1'; }
  }
  function conditions(index) {
    const saved = at(index), row = store.compare()[index], o = saved.output.calculation?.options ?? {};
    const items = [];
    if (Number.isFinite(o.size)) items.push({name: language() === 'en' ? 'Mesh size' : 'メッシュ寸法', value: o.size, unit: 'mm'});
    for (const m of row.metrics) items.push({name: m.key, value: Number(m.value.toPrecision(5)), unit: m.unit || '1'});
    return {label: saved.name, items: items.slice(0, 4)};
  }
  function invalidate(){png.disabled=true;canvas.width=0;canvas.height=0;}
  function checked(value){
    const next=structuredClone(value);
    if(!next||Object.keys(next).some(k=>!['indices','settings'].includes(k))||!Array.isArray(next.indices)||next.indices.length!==2||next.indices.some(i=>!Number.isInteger(i)||i<0||i>=count())||next.indices[0]===next.indices[1])throw Error('Invalid comparison case selection');
    const s=validateComparisonSettings(next.settings);next.settings=s;
    const infos=next.indices.map(i=>inspectCase(i,s.field));if(infos.some(i=>!i.fields.includes(s.field)))throw Error('Field is unavailable for comparison');
    if(s.field==='heatFlux'&&s.timeSeconds!==undefined&&infos.some(i=>i.finalOnly))throw Error('Thermal heat flux is final-step only; omit timeSeconds');
    if(infos.some(i=>i.frameTimes)&&s.timeSeconds===undefined)throw Error(tr('共通の物理時刻を入力してください。'));
    if(s.timeSeconds!==undefined)resolveSharedTime(infos.map((info,k)=>({caseId:String(next.indices[k]),frameTimes:info.frameTimes??undefined})),s);
    return next;
  }
  function capture({validate=false}={}){const settings=structuredClone(overrides??{field:getField(),deformScale:getDeformScale(),camera:getCamera()});delete settings.timeSeconds;if(time.value!=='')settings.timeSeconds=Number(time.value);const captured=JSON.parse(JSON.stringify({indices:[Number(a.value||0),Number(b.value||1)],settings}));return validate?checked(captured):captured;}
  function apply(value){const next=checked(value);refresh();a.value=String(next.indices[0]);b.value=String(next.indices[1]);overrides=next.settings;time.value=next.settings.timeSeconds===undefined?'':String(next.settings.timeSeconds);invalidate();syncHint();out.textContent=tr('比較設定を読み込みました。比較を表示して確認してください。');}
  for(const control of [a,b,time])control.onchange=()=>invalidate();
  reset.onclick=()=>{overrides=null;invalidate();syncHint();};
  const report=e=>{out.textContent=e.message;status(e.message);};
  const parsed=text=>{if(new TextEncoder().encode(text).length>131072)throw Error('Comparison settings exceed 128 KiB');return JSON.parse(text);};
  save.onclick=async()=>{try{const current=await presetApi.get();if(!current.archive)throw Error(current.reason??'Comparison settings unavailable');json.value=JSON.stringify(current.archive,null,2);const link=doc.createElement('a');if(typeof link.click==='function'&&URLApi?.createObjectURL){const url=URLApi.createObjectURL(new Blob([json.value],{type:'application/json'}));link.href=url;link.download='comparison-settings.json';link.click();setTimeout(()=>URLApi.revokeObjectURL(url),1000);}}catch(e){report(e);}};
  load.onclick=async()=>{try{const current=await presetApi.get();await presetApi.set({archive:parsed(json.value),expectedRevision:current.revision});}catch(e){report(e);}};
  file.onchange=async()=>{try{const selected=file.files?.[0];if(!selected)return;const current=await presetApi.get();if(selected.size>131072)throw Error('Comparison settings exceed 128 KiB');const text=await selected.text();await presetApi.set({archive:parsed(text),expectedRevision:current.revision});json.value=text;}catch(e){report(e);}finally{file.value='';}};
  async function show() {
    refresh();
    const ia = Number(a.value), ib = Number(b.value);
    if (count() < 2) throw Error(tr('保存ケースが2件以上必要です。'));
    if (!Number.isInteger(ia) || !Number.isInteger(ib) || ia === ib) throw Error(tr('左右に別のケースを選んでください。'));
    png.disabled=true;
    const settings=capture({validate:true}).settings;
    const renderer=createComparisonRenderer({inspectCase,renderCase,createCanvas:()=>canvas,colorAt,translate:tr});
    const result=renderer.render({cases:[ia,ib].map(index=>{const info=conditions(index);return {caseId:String(index),source:index,label:info.label,conditions:info.items};}),...settings});
    out.textContent=tr('比較を表示しました。');png.disabled=false;return result.plan;
  }
  run.onclick = async () => { try { png.disabled = true; await show(); } catch (e) { out.textContent = e.message; status(e.message); } };
  png.onclick = () => canvas.toBlob(blob => { if (!blob) { out.textContent = 'PNG failed'; return; } const url = URLApi.createObjectURL(blob), link = doc.createElement('a'); link.href = url; link.download = 'case-comparison.png'; link.click(); setTimeout(() => URLApi.revokeObjectURL(url), 1000); }, 'image/png');
  return Object.freeze({refresh, show, capture, apply, host});
}
