// Pure bounded import contract. No fitting, calibration correction, or accuracy claim.
import {validatePrintedEquivalentMaterial} from './printed-equivalent-material.js';
export const PRINTED_DATASET_LIMITS = Object.freeze({bytes: 2_000_000, specimens: 100, samples: 10_000});
const fail = message => { throw Object.assign(new Error(message), {code: 'PRINTED_DATASET_INVALID'}); };
const record = (value, names) => {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(key => !Object.hasOwn(value, key))) fail('Missing or unknown dataset fields');
};
const text = value => { if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) fail('Invalid dataset identity or evidence'); };
const number = (value, min, max) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('Nonfinite or out-of-range measurement'); };
const unit = (value, choices) => { if (typeof value !== 'string' || !Object.hasOwn(choices, value)) fail('Unsupported explicit measurement unit'); return choices[value]; };
const finiteOutput = value => { if (!Number.isFinite(value)) fail('Nonfinite normalized measurement'); return value; };

/** Import exact UTF-8 JSON and retain its SHA-256 alongside normalized engineering curves. */
export async function importPrintedMeasurementDataset(raw) {
 if (typeof raw !== 'string' || raw.length > PRINTED_DATASET_LIMITS.bytes) fail('Dataset exceeds byte limit');
 const bytes = new TextEncoder().encode(raw);
 if (bytes.length > PRINTED_DATASET_LIMITS.bytes) fail('Dataset exceeds byte limit');
 let d; try { d = JSON.parse(raw); } catch { fail('Invalid dataset JSON'); }
 record(d, ['schemaVersion','id','revision','provenance','units','instrument','calibration','specimens']);
 if (d.schemaVersion !== 1 || !['synthetic','measured'].includes(d.provenance)) fail('Unsupported dataset version or provenance');
 text(d.id); text(d.revision);
 record(d.units, ['length','force','time','temperature','speed']);
 const length = unit(d.units.length, {mm: 1, m: 1000}), force = unit(d.units.force, {N: 1, kN: 1000});
 unit(d.units.time, {s: 1}); unit(d.units.temperature, {degC: 1});
 const speed = unit(d.units.speed, {'mm/s': 1, 'm/s': 1000});
 record(d.instrument, ['id','hardwareRevision','softwareRevision']); Object.values(d.instrument).forEach(text);
 record(d.calibration, ['status','forceEvidence','displacementEvidence','dimensionEvidence']);
 if (!['unverified','reported'].includes(d.calibration.status)) fail('Calibration status is a report, never verified accuracy');
 for (const key of ['forceEvidence','displacementEvidence','dimensionEvidence']) {
  if (d.calibration.status === 'reported') text(d.calibration[key]);
  else if (d.calibration[key] !== null) fail('Unverified calibration evidence must be explicit null');
 }
 if (d.provenance === 'synthetic' && d.calibration.status !== 'unverified') fail('Synthetic data cannot claim reported calibration');
 if (!Array.isArray(d.specimens) || !d.specimens.length || d.specimens.length > PRINTED_DATASET_LIMITS.specimens) fail('Invalid specimen count');
 const ids = new Set(); let sampleCount = 0;
 const specimens = d.specimens.map(s => {
  record(s, ['id','dimensions','gaugeLength','buildDirection','batch','temperature','speed','displacementKind','samples']);
  text(s.id); text(s.batch); if (ids.has(s.id)) fail('Duplicate specimen'); ids.add(s.id);
  if (!Array.isArray(s.dimensions) || s.dimensions.length !== 3) fail('Three specimen dimensions required');
  const dimensionsMm = s.dimensions.map(v => { number(v * length, 1e-6, 1e6); if (typeof v !== 'number') fail('Numeric dimensions required'); return v * length; });
  // Use the same normalized numerical protection range as specimen dimensions.
  number(s.gaugeLength, 1e-6 / length, 1e6 / length);
  const gaugeLengthMm = finiteOutput(s.gaugeLength * length);
  if (gaugeLengthMm > dimensionsMm[2]) fail('Gauge exceeds specimen length');
  if (!Array.isArray(s.buildDirection) || s.buildDirection.length !== 3 || s.buildDirection.some(v => typeof v !== 'number' || !Number.isFinite(v)) || Math.abs(Math.hypot(...s.buildDirection) - 1) > 1e-8) fail('Unit build direction required');
  number(s.temperature, -273.15, 2000); number(s.speed, Number.MIN_VALUE, 1e6 / speed);
  if (s.displacementKind !== 'gauge') fail('Engineering strain requires gauge displacement; crosshead correction is not inferred');
  if (!Array.isArray(s.samples) || s.samples.length < 2 || (sampleCount += s.samples.length) > PRINTED_DATASET_LIMITS.samples) fail('Invalid total sample count');
  let last = -1;
  const samples = s.samples.map(row => {
   if (!Array.isArray(row) || row.length !== 3) fail('Expected time, force, displacement');
   number(row[0], 0, 1e9); number(row[1], -1e9 / force, 1e9 / force); number(row[2], -1e6 / length, 1e6 / length);
   if (row[0] <= last) fail('Sample times must strictly increase'); last = row[0];
   const forceN = finiteOutput(row[1] * force), displacementMm = finiteOutput(row[2] * length);
   return {timeS: row[0], forceN, displacementMm, engineeringStressPa: finiteOutput(forceN / (dimensionsMm[0] * dimensionsMm[1]) * 1e6), engineeringStrain: finiteOutput(displacementMm / gaugeLengthMm)};
  });
  return {id:s.id, dimensionsMm, gaugeLengthMm, buildDirection:[...s.buildDirection], batch:s.batch, temperatureC:s.temperature, speedMmPerSecond:finiteOutput(s.speed * speed), samples};
 });
 const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
 const sourceSha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
 return {normalizationVersion:1, id:d.id, revision:d.revision, provenance:d.provenance, sourceSha256, rawJson:raw, instrument:d.instrument, calibration:d.calibration, accuracyVerified:false, specimens};
}

/** Validate raw datasets against the existing references; no project mutation. */
export async function importPrintedEquivalentDatasets(properties, rawDatasets) {
 const material = validatePrintedEquivalentMaterial(properties);
 if (!material || material.basis.kind !== 'identified') fail('An identified printed equivalent reference is required');
 const refs = [material.basis.identification, material.basis.independentValidation].filter(Boolean);
 if (!Array.isArray(rawDatasets) || rawDatasets.length !== refs.length) fail('Dataset/reference count mismatch');
 const result = [];
 for (let i = 0; i < refs.length; i++) {
  const d = await importPrintedMeasurementDataset(rawDatasets[i]), ref = refs[i];
  if (d.id !== ref.id || d.revision !== ref.revision || d.specimens.length !== ref.specimenIds.length || d.specimens.some(s => !ref.specimenIds.includes(s.id))) fail('Dataset/reference identity mismatch');
  if (d.specimens.some(s => s.batch !== material.material.batch)) fail('Dataset material batch differs from equivalent material');
  result.push(d);
 }
 return result;
}
