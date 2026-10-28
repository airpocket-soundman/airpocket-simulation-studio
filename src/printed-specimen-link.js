// Link measured dataset specimens (printed-measurement-dataset.js) to specimen plans re-read from 3MF
// (printed-measurement-specimen.js readSpecimen3mf). Work order 86. The dataset contract is unchanged:
// the link table is a separate input. Matching is against planned (nominal) values; it proves nothing about the print.
export const PRINTED_SPECIMEN_LINK_VERSION = 1;
const fail = message => { throw Object.assign(new Error(message), {code: 'PRINTED_SPECIMEN_LINK_INVALID'}); };
const exact = (value, names) => {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(key => !Object.hasOwn(value, key))) fail('Missing or unknown specimen link fields');
};
// Which specimen dimension lies along the build (bed normal) axis for each planned orientation.
const BUILD_DIMENSION = {flat: 'thickness', 'on-edge': 'narrowWidth', upright: 'length'};

/**
 * Compare a normalized dataset with specimen plan records. `links` maps each dataset specimen to a plan
 * {datasetSpecimenId, specimenId, specimenVersion, planSha256}. `tolerance.dimensionMm` must be given by the caller;
 * no measurement tolerance is built in. Assumes the dataset convention already used for stress:
 * dimensions[0]*dimensions[1] is the gauge cross-section and dimensions[2] the length along the load axis,
 * with buildDirection expressed in that same (dimension0, dimension1, dimension2) frame.
 */
export function checkDatasetAgainstSpecimenPlans(dataset, records, links, tolerance) {
 exact(tolerance, ['dimensionMm']);
 const tol = tolerance.dimensionMm;
 if (typeof tol !== 'number' || !Number.isFinite(tol) || tol < 0) fail('Dimension tolerance must be a finite nonnegative mm value');
 if (!Array.isArray(records) || !Array.isArray(links)) fail('Specimen records and links must be arrays');
 const plans = new Map();
 for (const r of records) {
  if (r?.kind !== 'airpocket-printed-measurement-specimen' || r.schemaVersion !== 1 || typeof r.planSha256 !== 'string') fail('Unsupported specimen plan record');
  const key = `${r.plan.specimenId}@${r.plan.specimenVersion}`;
  if (plans.has(key)) fail('Duplicate specimen plan record'); plans.set(key, r);
 }
 const linked = new Map();
 for (const l of links) {
  exact(l, ['datasetSpecimenId','specimenId','specimenVersion','planSha256']);
  if (linked.has(l.datasetSpecimenId)) fail('Duplicate link for dataset specimen'); linked.set(l.datasetSpecimenId, l);
 }
 const findings = [];
 const add = (code, specimen) => findings.push({code, specimen});
 for (const id of linked.keys()) if (!dataset.specimens.some(s => s.id === id)) add('link-without-dataset-specimen', id);
 for (const s of dataset.specimens) {
  const l = linked.get(s.id);
  if (!l) { add('dataset-specimen-unlinked', s.id); continue; }
  const r = plans.get(`${l.specimenId}@${l.specimenVersion}`);
  if (!r) { add('specimen-plan-missing', s.id); continue; }
  if (r.planSha256 !== l.planSha256) { add('plan-hash-mismatch', s.id); continue; }
  const d = r.plan.dimensionsMm, near = (a, b) => Math.abs(a - b) <= tol;
  const [a, b, length] = s.dimensionsMm;
  // Cross-section axis order is not fixed by the dataset; accept either assignment that matches.
  const orders = [['narrowWidth','thickness'], ['thickness','narrowWidth']].filter(([x, y]) => near(a, d[x]) && near(b, d[y]));
  if (!orders.length) add('cross-section-mismatch', s.id);
  if (!near(length, d.parallelLength)) add('parallel-length-mismatch', s.id);
  if (s.gaugeLengthMm > d.parallelLength) add('gauge-exceeds-parallel-section', s.id);
  if (orders.length) {
   const axisName = BUILD_DIMENSION[r.plan.orientation];
   // Indices of dataset axes that can carry the planned build axis under some accepted cross-section order.
   const axes = axisName === 'length' ? [2] : orders.map(o => o.indexOf(axisName));
   const dir = s.buildDirection.map(Math.abs);
   if (!axes.some(i => Math.abs(dir[i] - 1) <= 1e-8)) add('build-direction-mismatch', s.id);
  }
 }
 return {linkVersion: PRINTED_SPECIMEN_LINK_VERSION, compatible: findings.length === 0, printVerified: false, findings};
}

/** Reject a dataset whose specimens do not match their linked plans; returns the check result when all match. */
export function requireDatasetMatchesSpecimenPlans(dataset, records, links, tolerance) {
 const result = checkDatasetAgainstSpecimenPlans(dataset, records, links, tolerance);
 if (!result.compatible) throw Object.assign(new Error('Dataset specimens do not match their specimen plans: ' + result.findings.map(f => `${f.specimen}:${f.code}`).join(', ')), {code: 'PRINTED_SPECIMEN_LINK_MISMATCH', findings: result.findings});
 return result;
}
