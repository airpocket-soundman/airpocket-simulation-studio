// Pure validator for a declared tensile/compression machine profile. DIY and sold machines share it.
// It records what the owner declares; it never proves capacity, accuracy or that a stop actually fires.
export const PRINTED_MACHINE_PROFILE_VERSION = 1;
const MODES = ['tension', 'compression'];
const fail = message => { throw Object.assign(new Error(message), {code: 'PRINTED_MACHINE_PROFILE_INVALID'}); };
const record = (value, names) => {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(key => !Object.hasOwn(value, key))) fail('Missing or unknown machine profile fields');
};
const text = value => { if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 200) fail('Invalid machine identity or evidence'); };
const positive = value => { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1e9) fail('Nonfinite or nonpositive machine value'); return value; };
const unit = (value, choices) => { if (typeof value !== 'string' || !Object.hasOwn(choices, value)) fail('Unsupported explicit machine unit'); return choices[value]; };
const evidence = (block, keys) => {
 for (const key of keys) {
  if (block.status === 'reported') text(block[key]);
  else if (block[key] !== null) fail('Unreported evidence must be explicit null');
 }
};

/** Validate a machine profile object and return it normalized to N, mm and mm/s. */
export function validatePrintedMachineProfile(p) {
 record(p, ['schemaVersion','id','revision','origin','provenance','units','frame','loadCell','displacementSources','fixtures','limits','compliance','calibration']);
 if (p.schemaVersion !== PRINTED_MACHINE_PROFILE_VERSION) fail('Unsupported machine profile version');
 if (!['diy','vendor'].includes(p.origin) || !['synthetic','declared'].includes(p.provenance)) fail('Unsupported machine origin or provenance');
 text(p.id); text(p.revision);
 record(p.units, ['force','length','speed']);
 const force = unit(p.units.force, {N: 1, kN: 1000}), length = unit(p.units.length, {mm: 1, m: 1000});
 const speed = unit(p.units.speed, {'mm/s': 1, 'm/s': 1000});
 record(p.frame, ['hardwareRevision','softwareRevision','modes']);
 text(p.frame.hardwareRevision); text(p.frame.softwareRevision);
 if (!Array.isArray(p.frame.modes) || !p.frame.modes.length || p.frame.modes.some(m => !MODES.includes(m)) || new Set(p.frame.modes).size !== p.frame.modes.length) fail('Machine modes must be distinct tension/compression');
 record(p.loadCell, ['ratedCapacity','model']);
 const ratedCapacityN = positive(p.loadCell.ratedCapacity) * force;
 if (p.loadCell.model !== null) text(p.loadCell.model);
 if (!Array.isArray(p.displacementSources) || !p.displacementSources.length || p.displacementSources.length > 8) fail('Displacement source required');
 const sourceIds = new Set();
 const displacementSources = p.displacementSources.map(s => {
  record(s, ['id','kind']); text(s.id);
  if (!['crosshead','gauge'].includes(s.kind)) fail('Displacement source is crosshead or gauge');
  if (sourceIds.has(s.id)) fail('Duplicate displacement source'); sourceIds.add(s.id);
  return {id: s.id, kind: s.kind};
 });
 if (!Array.isArray(p.fixtures) || p.fixtures.length > 16) fail('Invalid fixture list');
 const fixtureIds = new Set();
 const fixtures = p.fixtures.map(f => {
  record(f, ['id','mode']); text(f.id);
  if (!p.frame.modes.includes(f.mode)) fail('Fixture mode is not offered by the frame');
  if (fixtureIds.has(f.id)) fail('Duplicate fixture'); fixtureIds.add(f.id);
  return {id: f.id, mode: f.mode};
 });
 for (const mode of p.frame.modes) if (!fixtures.some(f => f.mode === mode)) fail(`No fixture for ${mode}`);
 record(p.limits, ['enforcedBy','force','stroke','speed']);
 // Host software can disconnect; the plan requires the stop to live on the device.
 if (p.limits.enforcedBy !== 'device') fail('Force/stroke stop must be enforced by the device');
 const limits = {forceN: positive(p.limits.force) * force, strokeMm: positive(p.limits.stroke) * length, speedMmPerSecond: positive(p.limits.speed) * speed};
 if (limits.forceN > ratedCapacityN) fail('Force stop exceeds declared load cell capacity');
 record(p.compliance, ['status','value','evidence']);
 if (!['unmeasured','reported'].includes(p.compliance.status)) fail('Compliance status is unmeasured or reported');
 // Frame compliance in length/force units, i.e. mm per N after normalization.
 const complianceMmPerN = p.compliance.status === 'reported' ? positive(p.compliance.value) * length / force : (p.compliance.value === null ? null : fail('Unmeasured compliance value must be null'));
 evidence(p.compliance, ['evidence']);
 record(p.calibration, ['status','forceEvidence','displacementEvidence']);
 if (!['unverified','reported'].includes(p.calibration.status)) fail('Calibration status is a report, never verified accuracy');
 evidence(p.calibration, ['forceEvidence','displacementEvidence']);
 if (p.provenance === 'synthetic' && (p.calibration.status !== 'unverified' || p.compliance.status !== 'unmeasured')) fail('Synthetic profile cannot claim reported calibration or compliance');
 return {
  profileVersion: PRINTED_MACHINE_PROFILE_VERSION, id: p.id, revision: p.revision, origin: p.origin, provenance: p.provenance, accuracyVerified: false,
  hardwareRevision: p.frame.hardwareRevision, softwareRevision: p.frame.softwareRevision, modes: [...p.frame.modes],
  ratedCapacityN, loadCellModel: p.loadCell.model, displacementSources, fixtures, limits,
  compliance: {status: p.compliance.status, mmPerN: complianceMmPerN, evidence: p.compliance.evidence},
  calibration: {status: p.calibration.status, forceEvidence: p.calibration.forceEvidence, displacementEvidence: p.calibration.displacementEvidence},
 };
}

/**
 * Compare a normalized dataset (printed-measurement-dataset.js output) with a validated profile.
 * Returns findings instead of throwing so the caller can show every mismatch at once.
 */
export function checkDatasetAgainstMachineProfile(profile, dataset) {
 const findings = [];
 const add = (code, specimen = null) => findings.push(specimen === null ? {code} : {code, specimen});
 if (dataset.instrument.id !== profile.id) add('instrument-id-mismatch');
 if (dataset.instrument.hardwareRevision !== profile.hardwareRevision) add('hardware-revision-mismatch');
 if (dataset.instrument.softwareRevision !== profile.softwareRevision) add('software-revision-mismatch');
 if (dataset.calibration.status === 'reported' && profile.calibration.status !== 'reported') add('dataset-calibration-without-profile-calibration');
 if (!profile.displacementSources.some(s => s.kind === 'gauge')) add('no-gauge-displacement-source');
 for (const s of dataset.specimens) {
  if (s.speedMmPerSecond > profile.limits.speedMmPerSecond) add('speed-above-device-limit', s.id);
  if (s.samples.some(row => Math.abs(row.forceN) > profile.limits.forceN)) add('force-above-device-stop', s.id);
  if (s.samples.some(row => row.forceN > 0) && !profile.modes.includes('tension')) add('tension-not-offered', s.id);
  if (s.samples.some(row => row.forceN < 0) && !profile.modes.includes('compression')) add('compression-not-offered', s.id);
 }
 return {compatible: findings.length === 0, accuracyVerified: false, findings};
}
