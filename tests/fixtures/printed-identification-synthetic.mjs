// Synthetic curves with known parameters for work order 101. Values are invented test inputs, not material data.
export const SYNTHETIC_TRUTH = Object.freeze({
 youngsModulusPa: 2e9, yieldStressPa: 40e6, tangentModulusPa: 1e8,
 equilibriumModulusPa: 1.2e9, branchModulusPa: 0.8e9, relaxationTimeS: 5,
});
const AREA_MM2 = 40, GAUGE_MM = 50;
// Mulberry32 + Box-Muller: deterministic Gaussian noise.
export function gaussian(seed) {
 let a = seed >>> 0;
 const u = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297; };
 return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}
/** Raw dataset JSON; curves are [{t, strain, stressPa}], noise in Pa on stress and absolute on strain. */
export function syntheticDataset({curves, noisePa = 2e5, noiseStrain = 0, seed = 1, specimens = 1}) {
 const g = gaussian(seed);
 return JSON.stringify({schemaVersion:1,id:'synthetic-identification',revision:'1',provenance:'synthetic',
  units:{length:'mm',force:'N',time:'s',temperature:'degC',speed:'mm/s'},
  instrument:{id:'synthetic',hardwareRevision:'1',softwareRevision:'1'},
  calibration:{status:'unverified',forceEvidence:null,displacementEvidence:null,dimensionEvidence:null},
  specimens:Array.from({length:specimens},(_,k)=>({id:'synthetic-'+(k+1),dimensions:[4,10,80],gaugeLength:GAUGE_MM,buildDirection:[0,0,1],batch:'synthetic-no-physical-batch',temperature:23,speed:1,displacementKind:'gauge',
   samples:curves.map(c=>[c.t,(c.stressPa+noisePa*g())*AREA_MM2*1e-6,(c.strain+noiseStrain*g())*GAUGE_MM])}))});
}
export const ramp = (n, maxStrain, stress) => Array.from({length: n}, (_, i) => { const e = maxStrain * (i + 1) / n; return {t: i + 1, strain: e, stressPa: stress(e)}; });
export const linearStress = (E = SYNTHETIC_TRUTH.youngsModulusPa) => e => E * e;
export const bilinearStress = ({youngsModulusPa: E, yieldStressPa: sy, tangentModulusPa: Et} = SYNTHETIC_TRUTH) => e => e * E <= sy ? E * e : sy + Et * (e - sy / E);
/** Unloaded sample at t=0, then a hold at strain e0 sampled n times over `span` seconds. */
export function relaxationCurve({n = 200, span = 40, e0 = 0.005, tau = SYNTHETIC_TRUTH.relaxationTimeS, Einf = SYNTHETIC_TRUTH.equilibriumModulusPa, E1 = SYNTHETIC_TRUTH.branchModulusPa} = {}) {
 return [{t: 0, strain: 0, stressPa: 0}, ...Array.from({length: n}, (_, i) => { const t = 0.01 + span * i / (n - 1); return {t, strain: e0, stressPa: e0 * (Einf + E1 * Math.exp(-(t - 0.01) / tau))}; })];
}
