// Two-case left/right result comparison panel (VIEWCOMPARE increment 2). Every dependency is injected.
// It renders each saved case with the existing result renderer (via renderCase, supplied by main.js) and
// composes the snapshots on a 2D canvas using the pure rules in view-compare-layout.js.
import {computeSharedRange, planCompareView} from '../view-compare-layout.js';
const T = {
  '2ケース並べて比較': 'Compare two cases side by side',
  '左のケース': 'Left case', '右のケース': 'Right case',
  '共通の物理時刻（秒、過渡音響のみ）': 'Shared physical time (s, transient acoustics only)',
  '比較を表示': 'Show comparison', '比較画像をPNGで保存': 'Save comparison as PNG',
  '共通の色範囲・変形倍率・カメラ・保存フレームで左右に表示します。色範囲は同じ物理量・単位のときだけ共有します。': 'Shows both cases with a shared colour range, deformation scale, camera and stored frame. The colour range is shared only for the same quantity and unit.',
  '保存ケースが2件以上必要です。': 'Two or more saved cases are required.',
  '左右に別のケースを選んでください。': 'Choose two different cases.',
  '共通の物理時刻を入力してください。': 'Enter the shared physical time.',
  '比較を表示しました。': 'Comparison shown.',
  '共通色範囲': 'Shared colour range', '変形倍率': 'Deformation scale', '物理時刻': 'Physical time', '保存フレームとのずれ': 'Offset from stored frame', '時間軸なし': 'no time axis'
};
export function createViewCompareUi({$, document: doc = globalThis.document, anchor, store, status, translate = () => {}, language = () => 'ja', inspectCase, renderCase, getField, getDeformScale, getCamera, env = {}}) {
  const URLApi = env.URL || globalThis.URL, tr = (ja) => language() === 'en' ? (T[ja] ?? ja) : ja;
  translate(T);
  const host = doc.createElement('details');
  const el = (tag, id, text) => { const e = doc.createElement(tag); if (id) e.id = id; if (text) e.textContent = text; return e; };
  const summary = el('summary', null, '2ケース並べて比較'), note = el('p', null, '共通の色範囲・変形倍率・カメラ・保存フレームで左右に表示します。色範囲は同じ物理量・単位のときだけ共有します。');
  const a = el('select', 'compare-left'), b = el('select', 'compare-right'), time = el('input', 'compare-time');
  time.type = 'number'; time.step = 'any'; time.placeholder = '0.001';
  const run = el('button', 'compare-run', '比較を表示'), png = el('button', 'compare-png', '比較画像をPNGで保存'), out = el('p', 'compare-status'), canvas = el('canvas', 'compare-canvas');
  out.setAttribute('role', 'status'); canvas.style.maxWidth = '100%'; png.disabled = true;
  const label = (text, control) => { const l = el('label', null, text + ' '); l.append(control); return l; };
  host.append(summary, note, label('左のケース', a), label('右のケース', b), label('共通の物理時刻（秒、過渡音響のみ）', time), run, png, out, canvas);
  anchor.after(host);
  host.addEventListener('toggle', refresh);
  function refresh() {
    for (const s of [a, b]) { const keep = s.value; s.replaceChildren(); for (const [i, c] of store.list().entries()) { const o = doc.createElement('option'); o.value = i; o.textContent = c.name; s.append(o); } s.value = keep && Number(keep) < store.list().length ? keep : s === a ? '0' : '1'; }
  }
  const fmt = v => Number(v).toPrecision(4);
  function conditions(index) {
    const saved = store.list()[index], row = store.compare()[index], o = saved.output.calculation?.options ?? {};
    const items = [];
    if (Number.isFinite(o.size)) items.push({name: language() === 'en' ? 'Mesh size' : 'メッシュ寸法', value: o.size, unit: 'mm'});
    for (const m of row.metrics) items.push({name: m.key, value: Number(m.value.toPrecision(5)), unit: m.unit || '1'});
    return {label: saved.name, items: items.slice(0, 4)};
  }
  async function show() {
    refresh();
    const ia = Number(a.value), ib = Number(b.value);
    if (store.list().length < 2) throw Error(tr('保存ケースが2件以上必要です。'));
    if (!Number.isInteger(ia) || !Number.isInteger(ib) || ia === ib) throw Error(tr('左右に別のケースを選んでください。'));
    const field = getField(), deformScale = getDeformScale(), infos = [ia, ib].map(inspectCase);
    const transient = infos.some(i => i.frameTimes);
    const timeSeconds = transient ? Number(time.value) : undefined;
    if (transient && (time.value === '' || !Number.isFinite(timeSeconds))) throw Error(tr('共通の物理時刻を入力してください。'));
    // Resolve frames first (needs only time axes), then measure each case at its frame, then share one range.
    const stubs = [ia, ib].map((index, k) => ({caseId: String(index), label: conditions(index).label, field, unit: '-', minimum: 0, maximum: 1, frameTimes: infos[k].frameTimes ?? undefined}));
    const framePlan = planCompareView(stubs, {camera: getCamera(), deformScale, timeSeconds, output: {width: 1280, height: 640, labelHeight: 96, legendHeight: 60}}).panels.map(p => p.time);
    const auto = [ia, ib].map((index, k) => renderCase(index, {field, deformScale, frameIndex: framePlan[k].frameIndex, colorRange: null}));
    const described = auto.map((r, k) => ({caseId: String(k ? ib : ia), label: '', field, unit: r.unit, minimum: r.min, maximum: r.max}));
    const shared = computeSharedRange(described);
    const shots = [ia, ib].map((index, k) => renderCase(index, {field, deformScale, frameIndex: framePlan[k].frameIndex, colorRange: shared.colorRange}));
    const infoLabels = [ia, ib].map(conditions);
    const plan = planCompareView([ia, ib].map((index, k) => ({caseId: String(index), label: infoLabels[k].label, conditions: infoLabels[k].items, field, unit: shared.unit, minimum: auto[k].min, maximum: auto[k].max, frameTimes: infos[k].frameTimes ?? undefined})), {camera: getCamera(), deformScale, timeSeconds, output: {width: 1280, height: 640, labelHeight: 96, legendHeight: 60}});
    draw(plan, shots, shared);
    return plan;
  }
  function draw(plan, shots, shared) {
    canvas.width = plan.size.width; canvas.height = plan.size.height;
    const g = canvas.getContext('2d');
    g.fillStyle = '#102331'; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#edf6f8'; g.font = '14px sans-serif';
    plan.panels.forEach((p, k) => {
      const v = p.rects.view, src = shots[k].canvas, s = Math.min(v.width / src.width, v.height / src.height), w = src.width * s, h = src.height * s;
      g.drawImage(src, v.x + (v.width - w) / 2, v.y + (v.height - h) / 2, w, h);
      p.labelLines.forEach((text, i) => g.fillText(text, p.rects.label.x + 8, p.rects.label.y + 20 + 18 * i, p.rects.label.width - 16));
    });
    const L = plan.legend, c = plan.colorRange;
    const times = plan.panels.map(p => p.time.timeApplies ? `${p.time.timeSeconds} s (${tr('保存フレームとのずれ')} ${p.time.offsetSeconds >= 0 ? '+' : ''}${p.time.offsetSeconds.toPrecision(3)} s)` : tr('時間軸なし'));
    g.fillText(`${tr('共通色範囲')}: ${fmt(c.minimum)} → ${fmt(c.maximum)} ${shared.unit} · ${plan.field}${plan.rangePadded ? ' (padded)' : ''} · ${tr('変形倍率')} ${plan.deformScale}`, 8, L.y + 22, L.width - 16);
    g.fillText(`${tr('物理時刻')}: ${times.join(' | ')}`, 8, L.y + 44, L.width - 16);
    out.textContent = tr('比較を表示しました。'); png.disabled = false;
  }
  run.onclick = async () => { try { png.disabled = true; await show(); } catch (e) { out.textContent = e.message; status(e.message); } };
  png.onclick = () => canvas.toBlob(blob => { if (!blob) { out.textContent = 'PNG failed'; return; } const url = URLApi.createObjectURL(blob), link = doc.createElement('a'); link.href = url; link.download = 'case-comparison.png'; link.click(); setTimeout(() => URLApi.revokeObjectURL(url), 1000); }, 'image/png');
  return Object.freeze({refresh, show, host});
}
