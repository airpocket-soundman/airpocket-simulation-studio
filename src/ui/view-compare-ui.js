// Two-case left/right result comparison panel (VIEWCOMPARE increment 2). Every dependency is injected.
// It renders each saved case with the existing result renderer (via renderCase, supplied by main.js) and
// composes the snapshots on a 2D canvas using the pure rules in view-compare-layout.js.
import {createComparisonRenderer} from '../view-compare-renderer.js';
const T = {
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
export function createViewCompareUi({$, document: doc = globalThis.document, anchor, store, status, translate = () => {}, language = () => 'ja', inspectCase, renderCase, colorAt = () => '#888', getField, getDeformScale, getCamera, env = {}}) {
  const URLApi = env.URL || globalThis.URL, tr = (ja) => language() === 'en' ? (T[ja] ?? ja) : ja;
  translate(T);
  const host = doc.createElement('details');
  const el = (tag, id, text) => { const e = doc.createElement(tag); if (id) e.id = id; if (text) e.textContent = text; return e; };
  const summary = el('summary', null, '2ケース並べて比較'), note = el('p', null, '共通の色範囲・変形倍率・カメラ・保存フレームで左右に表示します。色範囲は同じ物理量・単位のときだけ共有します。');
  const hint = el('p', 'compare-hint', '表示中の結果の物理量（結果の表示欄で選択中のもの）を左右とも表示します。過渡音響の組は、先に過渡の結果を表示してから比較してください。');
  hint.style.fontSize = '12px'; const syncHint = () => { hint.textContent = tr('表示中の結果の物理量（結果の表示欄で選択中のもの）を左右とも表示します。過渡音響の組は、先に過渡の結果を表示してから比較してください。'); };
  const a = el('select', 'compare-left'), b = el('select', 'compare-right'), time = el('input', 'compare-time');
  time.type = 'number'; time.step = 'any'; time.placeholder = '0.001';
  const run = el('button', 'compare-run', '比較を表示'), png = el('button', 'compare-png', '比較画像をPNGで保存'), out = el('p', 'compare-status'), canvas = el('canvas', 'compare-canvas');
  out.setAttribute('role', 'status'); canvas.style.maxWidth = '100%'; png.disabled = true;
  const label = (text, control) => { const l = el('label', null, text + ' '); l.append(control); return l; };
  host.append(summary, note, hint, label('左のケース', a), label('右のケース', b), label('共通の物理時刻（秒、保存済みの音響・温度フレーム）', time), run, png, out, canvas);
  anchor.after(host);
  host.addEventListener('toggle', refresh);
  // Per-case access when the store supports it (no whole-store clone); other stores keep the list() path.
  const at = i => typeof store.at === 'function' ? store.at(i) : store.list()[i];
  const count = () => typeof store.count === 'function' ? store.count() : store.list().length;
  const names = () => typeof store.names === 'function' ? store.names() : store.list().map(c => c.name);
  function refresh() {
    syncHint();
    for (const s of [a, b]) { const keep = s.value; s.replaceChildren(); for (const [i, name] of names().entries()) { const o = doc.createElement('option'); o.value = i; o.textContent = name; s.append(o); } s.value = keep && Number(keep) < count() ? keep : s === a ? '0' : '1'; }
  }
  function conditions(index) {
    const saved = at(index), row = store.compare()[index], o = saved.output.calculation?.options ?? {};
    const items = [];
    if (Number.isFinite(o.size)) items.push({name: language() === 'en' ? 'Mesh size' : 'メッシュ寸法', value: o.size, unit: 'mm'});
    for (const m of row.metrics) items.push({name: m.key, value: Number(m.value.toPrecision(5)), unit: m.unit || '1'});
    return {label: saved.name, items: items.slice(0, 4)};
  }
  async function show() {
    refresh();
    const ia = Number(a.value), ib = Number(b.value);
    if (count() < 2) throw Error(tr('保存ケースが2件以上必要です。'));
    if (!Number.isInteger(ia) || !Number.isInteger(ib) || ia === ib) throw Error(tr('左右に別のケースを選んでください。'));
    const renderer=createComparisonRenderer({inspectCase,renderCase,createCanvas:()=>canvas,colorAt,translate:tr});
    const result=renderer.render({cases:[ia,ib].map(index=>{const info=conditions(index);return {caseId:String(index),source:index,label:info.label,conditions:info.items};}),field:getField(),deformScale:getDeformScale(),camera:getCamera(),timeSeconds:time.value===''?undefined:Number(time.value)});
    out.textContent=tr('比較を表示しました。');png.disabled=false;return result.plan;
  }
  run.onclick = async () => { try { png.disabled = true; await show(); } catch (e) { out.textContent = e.message; status(e.message); } };
  png.onclick = () => canvas.toBlob(blob => { if (!blob) { out.textContent = 'PNG failed'; return; } const url = URLApi.createObjectURL(blob), link = doc.createElement('a'); link.href = url; link.download = 'case-comparison.png'; link.click(); setTimeout(() => URLApi.revokeObjectURL(url), 1000); }, 'image/png');
  return Object.freeze({refresh, show, host});
}
