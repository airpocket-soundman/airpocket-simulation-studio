// Pure layout and shared-state rules for side-by-side case viewing (VIEWCOMPARE, increment 1).
// No DOM, no three.js, no case store. Callers pass plain descriptors; nothing here renders or exports.
const finite = Number.isFinite;
const fail = (code, message) => Object.assign(new Error(message), {code});
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const MAX_COMPARE_PANELS = 4;

function cases(list) {
  if (!Array.isArray(list) || list.length < 2 || list.length > MAX_COMPARE_PANELS) throw fail('VIEW_COMPARE_COUNT', `Compare 2 to ${MAX_COMPARE_PANELS} cases`);
  const ids = new Set();
  for (const c of list) {
    if (!plain(c) || typeof c.caseId !== 'string' || !c.caseId) throw fail('VIEW_COMPARE_CASE', 'Each case needs a caseId');
    if (ids.has(c.caseId)) throw fail('VIEW_COMPARE_CASE', 'Duplicate caseId');
    ids.add(c.caseId);
  }
  return list;
}

// Shared colour range over all cases for ONE field. Refuses mixed fields or units: a common scale
// across different quantities would be a fabricated comparison. Each case supplies the finite
// minimum/maximum of its displayed field in the unit it reports. Equal extremes are padded and flagged,
// because a fixed range must satisfy minimum < maximum.
export function computeSharedRange(list) {
  cases(list);
  const {field, unit} = list[0];
  let minimum = Infinity, maximum = -Infinity;
  for (const c of list) {
    if (typeof c.field !== 'string' || !c.field || typeof c.unit !== 'string' || !c.unit) throw fail('VIEW_COMPARE_FIELD', 'Each case needs field and unit');
    if (c.field !== field) throw fail('VIEW_COMPARE_FIELD_MISMATCH', 'Cases show different fields; cannot share a colour range');
    if (c.unit !== unit) throw fail('VIEW_COMPARE_UNIT_MISMATCH', 'Cases use different units; convert before sharing a colour range');
    if (!finite(c.minimum) || !finite(c.maximum) || c.minimum > c.maximum) throw fail('VIEW_COMPARE_RANGE', 'Invalid case value range');
    minimum = Math.min(minimum, c.minimum);
    maximum = Math.max(maximum, c.maximum);
  }
  let padded = false;
  if (minimum === maximum) { const pad = Math.abs(minimum) * 1e-6 || 1; minimum -= pad; maximum += pad; padded = true; }
  // Same shape as result-view-api colorRange, so it can be applied to each case's view settings.
  return {field, unit, colorRange: {field, minimum, maximum}, padded};
}

const noTime = id => ({caseId: id, timeApplies: false, frameIndex: null, timeSeconds: null, offsetSeconds: null});

// Physical time shared by transient cases. Each case lists its stored frame times (seconds, ascending).
// A case snaps to its nearest stored frame; the signed offset is reported, never hidden. A case beyond
// toleranceSeconds is refused rather than silently shown at a different time. Cases without frames
// (static results) are marked timeApplies:false.
export function resolveSharedTime(list, {timeSeconds, toleranceSeconds = Infinity} = {}) {
  cases(list);
  if (!finite(timeSeconds) || !(toleranceSeconds >= 0)) throw fail('VIEW_COMPARE_TIME', 'timeSeconds must be finite and tolerance nonnegative');
  return list.map(c => {
    const times = c.frameTimes;
    if (times === undefined || times === null) return noTime(c.caseId);
    if (!Array.isArray(times) || !times.length || !times.every((t, i) => finite(t) && (i === 0 || t > times[i - 1]))) throw fail('VIEW_COMPARE_TIME', 'frameTimes must be ascending finite seconds');
    let best = 0;
    for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - timeSeconds) < Math.abs(times[best] - timeSeconds)) best = i;
    const offsetSeconds = times[best] - timeSeconds;
    if (Math.abs(offsetSeconds) > toleranceSeconds) throw fail('VIEW_COMPARE_TIME_TOLERANCE', `Case ${c.caseId} has no stored frame within tolerance`);
    return {caseId: c.caseId, timeApplies: true, frameIndex: best, timeSeconds: times[best], offsetSeconds};
  });
}

// Shared deformation scale / load factor are single values applied to every panel; validate once.
export function sharedScalars({deformScale, loadFactor} = {}) {
  if (!finite(deformScale) || deformScale < 0) throw fail('VIEW_COMPARE_SCALE', 'deformScale must be finite and nonnegative');
  if (loadFactor !== undefined && (!finite(loadFactor) || loadFactor < 0)) throw fail('VIEW_COMPARE_LOAD_FACTOR', 'loadFactor must be finite and nonnegative');
  return {deformScale, ...(loadFactor === undefined ? {} : {loadFactor})};
}

// Pixel rectangles for the output image: a shared legend strip at the bottom, a label band above each
// panel. Panels use a 2-column grid (two cases sit left/right). Integer rectangles tile without
// overlap, so PNG and video frames of a given size are deterministic.
export function layoutPanels(count, {width, height, gap = 8, labelHeight = 48, legendHeight = 40} = {}) {
  if (!Number.isInteger(count) || count < 2 || count > MAX_COMPARE_PANELS) throw fail('VIEW_COMPARE_COUNT', `Compare 2 to ${MAX_COMPARE_PANELS} cases`);
  for (const v of [width, height, gap, labelHeight, legendHeight]) if (!Number.isInteger(v) || v < 0) throw fail('VIEW_COMPARE_LAYOUT', 'Layout sizes must be nonnegative integers');
  const columns = 2, rows = Math.ceil(count / columns);
  const cellW = Math.floor((width - gap * (columns - 1)) / columns), cellH = Math.floor((height - legendHeight - gap * (rows - 1)) / rows);
  if (cellW < 1 || cellH - labelHeight < 1) throw fail('VIEW_COMPARE_LAYOUT', 'Output size too small for this layout');
  const panels = [];
  for (let i = 0; i < count; i++) {
    const x = (i % columns) * (cellW + gap), y = Math.floor(i / columns) * (cellH + gap);
    panels.push({index: i, label: {x, y, width: cellW, height: labelHeight}, view: {x, y: y + labelHeight, width: cellW, height: cellH - labelHeight}});
  }
  return {width, height, panels, legend: {x: 0, y: height - legendHeight, width, height: legendHeight}};
}

// Label lines for one panel: case name plus each condition with its unit. A condition without a unit
// string is refused (unitless quantities must say '1' or '-') so a label never hides a missing unit.
export function panelLabel(c) {
  if (!plain(c) || typeof c.label !== 'string' || !c.label) throw fail('VIEW_COMPARE_LABEL', 'Panel needs a label');
  const lines = [c.label];
  for (const item of c.conditions ?? []) {
    if (!plain(item) || typeof item.name !== 'string' || !item.name || typeof item.unit !== 'string' || !item.unit || !(finite(item.value) || typeof item.value === 'string')) throw fail('VIEW_COMPARE_LABEL', 'Condition needs name, value and unit');
    lines.push(`${item.name}: ${item.value} ${item.unit}`);
  }
  return lines;
}

// One call assembling the shared state for a side-by-side view. The camera is one object reused by
// every panel (validated by result-view-api in the caller); here it is only required to be plain data.
export function planCompareView(list, {camera, deformScale, loadFactor, timeSeconds, toleranceSeconds, output} = {}) {
  cases(list);
  if (!plain(camera)) throw fail('VIEW_COMPARE_CAMERA', 'A shared camera object is required');
  const range = computeSharedRange(list);
  const scalars = sharedScalars({deformScale, loadFactor});
  const times = timeSeconds === undefined ? list.map(c => noTime(c.caseId)) : resolveSharedTime(list, {timeSeconds, toleranceSeconds});
  const layout = layoutPanels(list.length, output);
  return {
    schemaVersion: 1, field: range.field, unit: range.unit, colorRange: range.colorRange, rangePadded: range.padded,
    camera: structuredClone(camera), ...scalars,
    panels: list.map((c, i) => ({caseId: c.caseId, labelLines: panelLabel(c), time: times[i], rects: layout.panels[i]})),
    legend: layout.legend, size: {width: layout.width, height: layout.height}
  };
}
