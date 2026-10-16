import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewCompareUi} from '../src/ui/view-compare-ui.js';

const fakeCtx = () => { const calls = []; return {calls, fillRect() {}, drawImage: (...a) => calls.push(['draw', ...a]), fillText: (t) => calls.push(['text', t]), createLinearGradient: () => ({addColorStop() {}}), set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}}; };
function el(tag) { const e = {tag, children: [], textContent: '', value: '', style: {}, append(...c) { this.children.push(...c); }, replaceChildren(...c) { this.children = [...c]; }, setAttribute() {}, addEventListener() {}, after() {}, ctx: tag === 'canvas' ? fakeCtx() : null, getContext() { return this.ctx; }}; return e; }
function setup({transient = false, field = 'stress', finalOnly = false} = {}) {
  const cases = [{name: 'A', output: {calculation: {options: {size: 5}}}}, {name: 'B', output: {calculation: {options: {size: 4}}}}];
  const renders = [], statuses = [], inspections = [];
  const ui = createViewCompareUi({
    $: () => null, document: {createElement: el}, anchor: el('div'), status: t => statuses.push(t),
    store: {list: () => cases, compare: () => cases.map(() => ({metrics: [{key: 'maxVonMisesPa', value: 2e6, unit: 'Pa'}]}))},
    inspectCase: (i, selectedField) => { inspections.push([i, selectedField]); return {frameTimes: transient ? [0, 0.1, 0.2].map(t => t + i * 0.01) : null, fields: [field]}; },
    renderCase: (i, spec) => { renders.push([i, spec]); return {canvas: {width: 100, height: 50}, min: i ? 1 : 0, max: i ? 20 : 10, unit: 'MPa', finalOnly}; },
    getField: () => field, getDeformScale: () => 25, getCamera: () => ({position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fov: 45})
  });
  return {ui, renders, statuses, cases, inspections};
}
test('final-only thermal fields are inspected by quantity and visibly exclude shared time', async () => {
  const {ui, renders, inspections} = setup({field: 'heatFlux', finalOnly: true});
  const plan = await ui.show();
  assert.deepEqual(inspections, [[0, 'heatFlux'], [1, 'heatFlux']]);
  assert.ok(plan.panels.every(p => !p.time.timeApplies));
  assert.ok(renders.every(([, spec]) => spec.frameIndex === null));
  const canvas = ui.host.children.find(e => e.id === 'compare-canvas');
  const text = canvas.ctx.calls.filter(c => c[0] === 'text').map(c => c[1]).join('\n');
  assert.match(text, /最終ステップのみ/);
});
test('static pair is rendered twice per case: auto range first, then one shared fixed range and scale', async () => {
  const {ui, renders} = setup();
  const plan = await ui.show();
  assert.equal(renders.length, 4);
  assert.equal(renders[0][1].colorRange, null);
  const fixed = renders.slice(2).map(r => r[1]);
  assert.deepEqual(fixed[0].colorRange, {field: 'stress', minimum: 0, maximum: 20});
  assert.deepEqual(fixed[0], {...fixed[1]});
  assert.equal(fixed[0].deformScale, 25);
  assert.equal(plan.panels.length, 2);
});
test('transient pair needs a shared time and shows the offset to the stored frame', async () => {
  const {ui, renders} = setup({transient: true});
  await assert.rejects(ui.show(), /物理時刻/);
  assert.equal(renders.length, 0);
});
test('transient pair snaps each case to its nearest stored frame and draws the offsets', async () => {
  const {ui, renders} = setup({transient: true});
  const find = (n, id) => n.id === id ? n : n.children?.map?.(c => find(c, id)).find(Boolean);
  find(ui.host, 'compare-time').value = '0.1';
  const plan = await ui.show();
  assert.deepEqual(renders.slice(2).map(r => r[1].frameIndex), [1, 1]);
  assert.ok(Math.abs(plan.panels[1].time.offsetSeconds - 0.01) < 1e-12);
  const texts = find(ui.host, 'compare-canvas').ctx.calls.filter(c => c[0] === 'text').map(c => c[1]).join('\n');
  assert.match(texts, /保存フレームとのずれ/);
  assert.match(texts, /100 ms/);
  assert.match(texts, /\+10 ms/);
  assert.doesNotMatch(texts, /\d{8,}/);
});
test('colour bar: gradient fillRect per panel with min/max labels and unit; hint line present', async () => {
  const {ui} = setup();
  const find = (n, id) => n.id === id ? n : n.children?.map?.(c => find(c, id)).find(Boolean);
  assert.match(find(ui.host, 'compare-hint').textContent, /過渡/);
  await ui.show();
  const texts = find(ui.host, 'compare-canvas').ctx.calls.filter(c => c[0] === 'text').map(c => c[1]);
  assert.equal(texts.filter(t => t === '0 MPa').length, 2);
  assert.equal(texts.filter(t => t === '20 MPa').length, 2);
});
