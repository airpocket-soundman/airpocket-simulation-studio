// Work order 101 (PRINTMEASURE3 first step): identify small-strain CAE parameters from engineering curves.
// Input is only raw dataset JSON passed through importPrintedMeasurementDataset; no other entry point.
// Models: linear elastic E, bilinear elastic-plastic (E, yield, tangent), one-branch standard linear solid relaxation.
// Results are never calibrated; uncertainty is the least-squares standard error, not measurement accuracy.
import {importPrintedMeasurementDataset} from './printed-measurement-dataset.js';
export const PRINTED_IDENTIFICATION_VERSION = 1;
export const PRINTED_IDENTIFICATION_MODELS = Object.freeze(['linear-elastic', 'bilinear-elastic-plastic', 'sls-relaxation']);
const fail = message => { throw Object.assign(new Error(message), {code: 'PRINTED_IDENTIFICATION_INVALID'}); };
const exact = (value, names) => {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== names.length || names.some(key => !Object.hasOwn(value, key))) fail('Missing or unknown identification fields');
};
const positive = (value, label) => { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) fail(label + ' must be a finite positive number'); return value; };
const sum = xs => xs.reduce((s, x) => s + x, 0);

// Linear least squares y ≈ X b via normal equations (≤3 columns); returns b, residual SS and covariance or null if singular.
function lsq(X, y) {
 const n = y.length, m = X[0].length, A = Array.from({length: m}, () => new Array(m).fill(0)), r = new Array(m).fill(0);
 for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { r[j] += X[i][j] * y[i]; for (let k = 0; k < m; k++) A[j][k] += X[i][j] * X[i][k]; }
 const inv = invert(A); if (!inv) return null;
 const b = inv.map(row => sum(row.map((v, k) => v * r[k])));
 const sse = sum(y.map((v, i) => (v - sum(X[i].map((x, j) => x * b[j]))) ** 2));
 const s2 = n > m ? sse / (n - m) : NaN;
 return {b, sse, cov: inv.map(row => row.map(v => v * s2))};
}
function invert(A) {
 const m = A.length, M = A.map((row, i) => [...row, ...A.map((_, j) => +(i === j))]), scale = Math.max(...A.map((row, i) => Math.abs(row[i])));
 for (let c = 0; c < m; c++) {
  let p = c; for (let i = c + 1; i < m; i++) if (Math.abs(M[i][c]) > Math.abs(M[p][c])) p = i;
  if (!(Math.abs(M[p][c]) > 1e-13 * scale)) return null;
  [M[c], M[p]] = [M[p], M[c]];
  const d = M[c][c]; M[c] = M[c].map(v => v / d);
  for (let i = 0; i < m; i++) if (i !== c) { const f = M[i][c]; M[i] = M[i].map((v, k) => v - f * M[c][k]); }
 }
 return M.map(row => row.slice(m));
}
const r2 = (y, sse) => { const mean = sum(y) / y.length, sst = sum(y.map(v => (v - mean) ** 2)); return sst > 0 ? 1 - sse / sst : NaN; };
const rejected = (reason, extra = {}) => ({identified: false, reason, ...extra});
const parameter = (value, se) => ({value, standardError: se, relativeStandardError: Math.abs(se / value)});

// σ = E ε through the origin on ε in [0, maxStrain].
function linear(samples, opts) {
 const pts = samples.filter(s => s.engineeringStrain >= 0 && s.engineeringStrain <= opts.maxStrain);
 if (pts.length < opts.minPoints) return rejected('too-few-points', {points: pts.length});
 const y = pts.map(s => s.engineeringStressPa), fit = lsq(pts.map(s => [s.engineeringStrain]), y);
 if (!fit) return rejected('degenerate-strain-span');
 const E = fit.b[0], se = Math.sqrt(fit.cov[0][0]); if (!(E > 0)) return rejected('nonpositive-modulus');
 if (!(se / E <= opts.maxRelativeStandardError)) return rejected('modulus-not-resolved', {relativeStandardError: se / E});
 return {identified: true, points: pts.length, parameters: {youngsModulusPa: parameter(E, se)}, rSquared: r2(y, fit.sse), residualRmsPa: Math.sqrt(fit.sse / pts.length)};
}

// Continuous bilinear σ = E ε (ε≤εy), σy + Et(ε-εy); monotonic loading only. Breakpoint scanned over sample strains.
function bilinear(samples, opts) {
 const pts = samples.filter(s => s.engineeringStrain >= 0 && s.engineeringStrain <= opts.maxStrain);
 for (let i = 1; i < pts.length; i++) if (pts[i].engineeringStrain < pts[i - 1].engineeringStrain) return rejected('non-monotonic-loading');
 if (pts.length < 2 * opts.minPoints) return rejected('too-few-points', {points: pts.length});
 const y = pts.map(s => s.engineeringStressPa), x = pts.map(s => s.engineeringStrain);
 const design = ey => x.map(e => [Math.min(e, ey), Math.max(e - ey, 0)]);
 let best = null;
 for (let k = opts.minPoints - 1; k <= pts.length - opts.minPoints; k++) {
  const fit = lsq(design(x[k]), y); if (fit && (!best || fit.sse < best.fit.sse)) best = {k, fit};
 }
 if (!best) return rejected('degenerate-strain-span');
 // Refine the breakpoint between neighbouring samples by golden section.
 const f = ey => lsq(design(ey), y)?.sse ?? Infinity;
 let a = x[Math.max(best.k - 1, 0)], b = x[Math.min(best.k + 1, x.length - 1)];
 for (let it = 0; it < 60; it++) { const c = b - (b - a) * .618034, d = a + (b - a) * .618034; if (f(c) < f(d)) b = d; else a = c; }
 const ey = (a + b) / 2, fit = lsq(design(ey), y);
 const below = x.filter(e => e <= ey).length, above = x.length - below;
 if (below < opts.minPoints || above < opts.minPoints) return rejected('yield-at-window-edge', {yieldStrain: ey});
 const [E, Et] = fit.b;
 if (!(E > 0)) return rejected('nonpositive-modulus');
 if (!(Et < E * opts.maxTangentRatio)) return rejected('no-distinct-yield', {tangentToElasticRatio: Et / E});
 // Yield stress σy = E εy; standard error from b covariance at fixed εy plus the breakpoint profile curvature.
 const h = Math.max(1e-6 * ey, 1e-12), s2 = fit.sse / (x.length - 3), curvature = (f(ey + h) - 2 * fit.sse + f(ey - h)) / (h * h);
 const varEy = curvature > 0 ? 2 * s2 / curvature : Infinity, sigmaY = E * ey;
 const seSy = Math.sqrt(ey * ey * fit.cov[0][0] + E * E * varEy);
 const lin = linear(pts, opts), improvement = lin.identified ? 1 - fit.sse / (lin.residualRmsPa ** 2 * pts.length) : 1;
 if (!Number.isFinite(seSy) || seSy / sigmaY > opts.maxRelativeStandardError) return rejected('yield-not-resolved', {yieldStrain: ey});
 return {identified: true, points: pts.length, parameters: {youngsModulusPa: parameter(E, Math.sqrt(fit.cov[0][0])), yieldStressPa: parameter(sigmaY, seSy), tangentModulusPa: parameter(Et, Math.sqrt(fit.cov[1][1]))}, yieldStrain: ey, residualSsReductionVsLinear: improvement, rSquared: r2(y, fit.sse), residualRmsPa: Math.sqrt(fit.sse / x.length)};
}

// Stress relaxation at held strain: σ(t) = ε0 (E∞ + E1 exp(-(t-t0)/τ)). The hold starts at the peak strain sample.
function relaxation(samples, opts) {
 let peak = 0; samples.forEach((s, i) => { if (s.engineeringStrain > samples[peak].engineeringStrain) peak = i; });
 const e0 = samples[peak].engineeringStrain;
 if (!(e0 > 0)) return rejected('no-held-strain');
 const hold = samples.slice(peak).filter(s => Math.abs(s.engineeringStrain - e0) <= opts.holdStrainTolerance * e0);
 if (hold.length < opts.minPoints || hold.length !== samples.length - peak) return rejected('hold-not-constant', {points: hold.length});
 const t0 = hold[0].timeS, t = hold.map(s => s.timeS - t0), y = hold.map(s => s.engineeringStressPa / s.engineeringStrain), span = t[t.length - 1];
 const dtMin = Math.min(...t.slice(1).map((v, i) => v - t[i]));
 const at = tau => lsq(t.map(v => [1, Math.exp(-v / tau)]), y);
 const sse = tau => at(tau)?.sse ?? Infinity;
 // Log-grid scan on τ, then golden section in log τ. τ at either end of the resolvable range is reported as unidentifiable.
 const lo = Math.log(dtMin / 10), hi = Math.log(span * 10), grid = Array.from({length: 121}, (_, i) => lo + (hi - lo) * i / 120);
 let k = 0; grid.forEach((g, i) => { if (sse(Math.exp(g)) < sse(Math.exp(grid[k]))) k = i; });
 if (k === 0 || k === grid.length - 1) return rejected('relaxation-time-outside-window', {relaxationTimeS: Math.exp(grid[k])});
 let a = grid[k - 1], b = grid[k + 1];
 for (let it = 0; it < 80; it++) { const c = b - (b - a) * .618034, d = a + (b - a) * .618034; if (sse(Math.exp(c)) < sse(Math.exp(d))) b = d; else a = c; }
 const tau = Math.exp((a + b) / 2), fit = at(tau), [Einf, E1] = fit.b;
 if (tau < dtMin || tau > span) return rejected('relaxation-time-outside-window', {relaxationTimeS: tau});
 if (!(Einf > 0) || !(E1 > 0)) return rejected('nonpositive-modulus');
 // Full 3-parameter Gauss-Newton covariance; Jacobian columns scaled by the parameter values (relative sensitivities).
 const J = t.map(v => { const x = Math.exp(-v / tau); return [Einf, E1 * x, E1 * x * v / tau]; });
 const JtJ = [0, 1, 2].map(i => [0, 1, 2].map(j => sum(J.map(r => r[i] * r[j])))), inv = invert(JtJ);
 if (!inv) return rejected('degenerate-relaxation');
 const s2 = fit.sse / (t.length - 3), se = i => Math.sqrt(inv[i][i] * s2) * [Einf, E1, tau][i];
 const result = {identified: true, points: t.length, heldStrain: e0, parameters: {equilibriumModulusPa: parameter(Einf, se(0)), branchModulusPa: parameter(E1, se(1)), relaxationTimeS: parameter(tau, se(2))}, rSquared: r2(y, fit.sse), residualRmsPa: Math.sqrt(fit.sse / t.length) * e0};
 if (Object.values(result.parameters).some(p => !(p.relativeStandardError <= opts.maxRelativeStandardError))) return rejected('relaxation-not-resolved', {relaxationTimeS: tau});
 return result;
}

const DEFAULTS_REQUIRED = ['model', 'maxStrain', 'minPoints', 'maxRelativeStandardError'];
function options(o) {
 if (!o || typeof o !== 'object') fail('Identification options required');
 const extra = {'linear-elastic': [], 'bilinear-elastic-plastic': ['maxTangentRatio'], 'sls-relaxation': ['holdStrainTolerance']}[o.model];
 if (!extra) fail('Unsupported identification model');
 exact(o, [...DEFAULTS_REQUIRED, ...extra]);
 positive(o.maxStrain, 'maxStrain'); positive(o.maxRelativeStandardError, 'maxRelativeStandardError');
 if (!Number.isInteger(o.minPoints) || o.minPoints < 3 || o.minPoints > 10000) fail('minPoints must be an integer in [3, 10000]');
 if (o.model === 'bilinear-elastic-plastic' && !(positive(o.maxTangentRatio, 'maxTangentRatio') < 1)) fail('maxTangentRatio must be below 1');
 if (o.model === 'sls-relaxation') positive(o.holdStrainTolerance, 'holdStrainTolerance');
 return {...o};
}

/**
 * Identify one model per specimen from raw dataset JSON. All thresholds are caller-supplied (no built-in defaults).
 * Returns per-specimen fits plus, when ≥2 specimens are identified, the across-specimen mean and sample standard deviation.
 */
export async function identifyPrintedParameters(rawDatasetJson, identificationOptions) {
 const opts = options(identificationOptions);
 const dataset = await importPrintedMeasurementDataset(rawDatasetJson);
 const fit = {'linear-elastic': linear, 'bilinear-elastic-plastic': bilinear, 'sls-relaxation': relaxation}[opts.model];
 const specimens = dataset.specimens.map(s => ({specimen: s.id, ...fit(s.samples, opts)}));
 const ok = specimens.filter(s => s.identified), across = {};
 if (ok.length >= 2) for (const key of Object.keys(ok[0].parameters)) {
  const v = ok.map(s => s.parameters[key].value), mean = sum(v) / v.length;
  across[key] = {mean, sampleStandardDeviation: Math.sqrt(sum(v.map(x => (x - mean) ** 2)) / (v.length - 1)), specimens: v.length};
 }
 return {identificationVersion: PRINTED_IDENTIFICATION_VERSION, model: opts.model, options: opts, dataset: {id: dataset.id, revision: dataset.revision, provenance: dataset.provenance, sourceSha256: dataset.sourceSha256},
  calibrated: false, accuracyVerified: false, identified: ok.length === specimens.length, specimens, across: ok.length >= 2 ? across : null};
}
