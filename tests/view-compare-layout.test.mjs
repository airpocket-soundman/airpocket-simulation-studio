import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeSharedRange, resolveSharedTime, sharedScalars, layoutPanels, panelLabel, planCompareView} from '../src/view-compare-layout.js';

const a = {caseId: 'a', label: 'Load 1 kN', field: 'vonMises', unit: 'MPa', minimum: 0, maximum: 10, conditions: [{name: 'Load', value: 1, unit: 'kN'}], frameTimes: [0, 0.1, 0.2]};
const b = {caseId: 'b', label: 'Load 2 kN', field: 'vonMises', unit: 'MPa', minimum: 1, maximum: 25, conditions: [{name: 'Load', value: 2, unit: 'kN'}], frameTimes: [0, 0.15, 0.3]};
const code = c => e => e.code === c;

test('shared range spans all cases and matches the colorRange shape', () => {
  const r = computeSharedRange([a, b]);
  assert.deepEqual(r.colorRange, {field: 'vonMises', minimum: 0, maximum: 25});
  assert.equal(r.unit, 'MPa'); assert.equal(r.padded, false);
});
test('shared range refuses mixed field or unit and bad input', () => {
  assert.throws(() => computeSharedRange([a, {...b, field: 'displacement'}]), code('VIEW_COMPARE_FIELD_MISMATCH'));
  assert.throws(() => computeSharedRange([a, {...b, unit: 'Pa'}]), code('VIEW_COMPARE_UNIT_MISMATCH'));
  assert.throws(() => computeSharedRange([a, {...b, maximum: NaN}]), code('VIEW_COMPARE_RANGE'));
  assert.throws(() => computeSharedRange([a, {...b, minimum: 9, maximum: 1}]), code('VIEW_COMPARE_RANGE'));
  assert.throws(() => computeSharedRange([a]), code('VIEW_COMPARE_COUNT'));
  assert.throws(() => computeSharedRange([a, {...b, caseId: 'a'}]), code('VIEW_COMPARE_CASE'));
});
test('degenerate equal range is padded and flagged', () => {
  const r = computeSharedRange([{...a, minimum: 5, maximum: 5}, {...b, minimum: 5, maximum: 5}]);
  assert.equal(r.padded, true); assert.ok(r.colorRange.minimum < 5 && r.colorRange.maximum > 5);
  const z = computeSharedRange([{...a, minimum: 0, maximum: 0}, {...b, minimum: 0, maximum: 0}]);
  assert.deepEqual([z.colorRange.minimum, z.colorRange.maximum], [-1, 1]);
});
test('shared time snaps to nearest stored frame and reports the offset', () => {
  const t = resolveSharedTime([a, b], {timeSeconds: 0.14});
  assert.deepEqual(t.map(x => x.frameIndex), [1, 1]);
  assert.ok(Math.abs(t[0].offsetSeconds + 0.04) < 1e-12 && Math.abs(t[1].offsetSeconds - 0.01) < 1e-12);
  assert.throws(() => resolveSharedTime([a, b], {timeSeconds: 0.14, toleranceSeconds: 0.02}), code('VIEW_COMPARE_TIME_TOLERANCE'));
  const mixed = resolveSharedTime([a, {...b, frameTimes: undefined}], {timeSeconds: 0.1});
  assert.equal(mixed[1].timeApplies, false); assert.equal(mixed[1].frameIndex, null);
  assert.throws(() => resolveSharedTime([a, {...b, frameTimes: [0.2, 0.1]}], {timeSeconds: 0}), code('VIEW_COMPARE_TIME'));
  assert.throws(() => resolveSharedTime([a, b], {timeSeconds: NaN}), code('VIEW_COMPARE_TIME'));
});
test('scalars validate deformation scale and load factor', () => {
  assert.deepEqual(sharedScalars({deformScale: 10, loadFactor: 0.5}), {deformScale: 10, loadFactor: 0.5});
  assert.deepEqual(sharedScalars({deformScale: 0}), {deformScale: 0});
  assert.throws(() => sharedScalars({deformScale: -1}), code('VIEW_COMPARE_SCALE'));
  assert.throws(() => sharedScalars({deformScale: 1, loadFactor: Infinity}), code('VIEW_COMPARE_LOAD_FACTOR'));
});
test('two-case layout is left/right and tiles without overlap inside the output', () => {
  const l = layoutPanels(2, {width: 1000, height: 500});
  const [p0, p1] = l.panels;
  assert.equal(p0.view.y, p1.view.y); assert.ok(p0.view.x + p0.view.width <= p1.view.x);
  assert.ok(p1.view.x + p1.view.width <= 1000);
  assert.ok(p0.view.y + p0.view.height <= l.legend.y); assert.equal(l.legend.y + l.legend.height, 500);
});
test('four-case layout is a 2x2 grid with no overlapping views', () => {
  const l = layoutPanels(4, {width: 800, height: 700, gap: 4});
  const rects = l.panels.map(p => p.view);
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const u = rects[i], v = rects[j];
    assert.ok(u.x + u.width <= v.x || v.x + v.width <= u.x || u.y + u.height <= v.y || v.y + v.height <= u.y);
  }
  assert.ok(Math.max(...rects.map(r => r.y + r.height)) <= l.legend.y);
});
test('layout rejects bad counts and sizes', () => {
  assert.throws(() => layoutPanels(1, {width: 100, height: 100}), code('VIEW_COMPARE_COUNT'));
  assert.throws(() => layoutPanels(5, {width: 100, height: 100}), code('VIEW_COMPARE_COUNT'));
  assert.throws(() => layoutPanels(2, {width: 5, height: 100}), code('VIEW_COMPARE_LAYOUT'));
  assert.throws(() => layoutPanels(2, {width: 100.5, height: 500}), code('VIEW_COMPARE_LAYOUT'));
  assert.throws(() => layoutPanels(2, {height: 500}), code('VIEW_COMPARE_LAYOUT'));
});
test('labels carry units and refuse missing ones', () => {
  assert.deepEqual(panelLabel(a), ['Load 1 kN', 'Load: 1 kN']);
  assert.throws(() => panelLabel({label: 'x', conditions: [{name: 'Load', value: 1}]}), code('VIEW_COMPARE_LABEL'));
  assert.throws(() => panelLabel({label: '', conditions: []}), code('VIEW_COMPARE_LABEL'));
});
test('plan assembles one shared camera, range, scale, time and layout', () => {
  const camera = {position: [0, 0, 5], target: [0, 0, 0], up: [0, 1, 0], fov: 45};
  const plan = planCompareView([a, b], {camera, deformScale: 20, timeSeconds: 0.1, output: {width: 1280, height: 720}});
  assert.equal(plan.colorRange.maximum, 25); assert.equal(plan.deformScale, 20);
  assert.equal(plan.panels.length, 2); assert.equal(plan.panels[0].time.frameIndex, 1);
  assert.deepEqual(plan.size, {width: 1280, height: 720});
  camera.fov = 90; assert.equal(plan.camera.fov, 45);
  assert.throws(() => planCompareView([a, b], {deformScale: 1, output: {width: 1280, height: 720}}), code('VIEW_COMPARE_CAMERA'));
  const stat = planCompareView([{...a, frameTimes: undefined}, {...b, frameTimes: undefined}], {camera, deformScale: 1, output: {width: 1280, height: 720}});
  assert.ok(stat.panels.every(p => p.time.timeApplies === false));
});

import {planCompareView as _plan, legendBars, formatQuantity, formatSeconds} from '../src/view-compare-layout.js';
test('legendBars: one bar per panel inside the legend band, aligned with the panel, labels at the bar ends', () => {
  const cams = {position: [0, 0, 1], target: [0, 0, 0], up: [0, 1, 0], fov: 45};
  const plan = _plan([{caseId: 'a', label: 'A', field: 'f', unit: 'u', minimum: 0, maximum: 1}, {caseId: 'b', label: 'B', field: 'f', unit: 'u', minimum: 0, maximum: 2}], {camera: cams, deformScale: 1, output: {width: 1000, height: 600, labelHeight: 60, legendHeight: 100}});
  const g = legendBars(plan);
  assert.equal(g.bars.length, 2);
  g.bars.forEach((b, i) => {
    const r = plan.panels[i].rects.label;
    assert.ok(b.bar.x >= r.x && b.bar.x + b.bar.width <= r.x + r.width);
    assert.ok(b.bar.y >= plan.legend.y && b.bar.y + b.bar.height < plan.legend.y + plan.legend.height);
    assert.equal(b.minLabel.x, b.bar.x); assert.equal(b.maxLabel.x, b.bar.x + b.bar.width); assert.equal(b.maxLabel.align, 'right');
  });
  assert.ok(g.textRows[1] < plan.legend.y + plan.legend.height);
  assert.ok(g.bars[0].bar.x + g.bars[0].bar.width <= g.bars[1].bar.x);
});
test('formatSeconds / formatQuantity use sensible significant digits and units', () => {
  assert.equal(formatSeconds(0.0020205799812909263), '2.0206 ms');
  assert.equal(formatSeconds(1.5), '1.5 s');
  assert.equal(formatSeconds(2.5e-7, {digits: 3}), '0.25 us');
  assert.equal(formatSeconds(0.01, {signed: true}), '+10 ms');
  assert.equal(formatSeconds(-0.01, {signed: true}), '-10 ms');
  assert.equal(formatSeconds(0), '0 s');
  assert.equal(formatQuantity(12.3456789), '12.346');
  assert.equal(formatQuantity(0), '0');
  assert.equal(formatQuantity(1.23456e-7), '1.2346e-7');
});
