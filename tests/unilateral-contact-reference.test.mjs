import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {solveUnilateralContact} from '../src/unilateral-contact-reference.js';

const MODULE_URL = new URL('../src/unilateral-contact-reference.js', import.meta.url).href;
// Isolate the unbounded-iteration counterexample in a child process with a hard 2 s wall
// clock limit so the parent test process is never trapped by a non-terminating loop.
function runIsolated(input, timeout = 2000) {
  const script = `import {solveUnilateralContact} from ${JSON.stringify(MODULE_URL)};
const started = process.hrtime.bigint();
try {
  const result = solveUnilateralContact(${JSON.stringify(input)});
  console.log(JSON.stringify({outcome: 'success', result, latencyMs: Number(process.hrtime.bigint() - started) / 1e6}));
} catch (error) {
  console.log(JSON.stringify({outcome: 'refusal', code: error?.code, details: error?.details, latencyMs: Number(process.hrtime.bigint() - started) / 1e6}));
}`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {timeout, encoding: 'utf8', windowsHide: true});
}

// Synthetic reference problem (not measured data): k = 100 N/mm, stop gap = 1 mm, kp = 10000 N/mm.
const base = {springNPerMm: 100, penaltyNPerMm: 10000, gapMm: 1, forceN: 50, toleranceN: 1e-9, maxIterations: 50};
const solve = over => solveUnilateralContact({...base, ...over});
const close = (got, expected, tolerance = 1e-12) => Math.abs(got - expected) <= tolerance * Math.max(1, Math.abs(expected));
const refusal = code => error => error?.refusal === true && error?.code === code;

test('non-contact reference: F=50 N stays off the stop with u=F/k and zero contact reaction', () => {
  const result = solve({forceN: 50});
  assert.equal(result.converged, true);
  assert.ok(close(result.u, 0.5), `u=${result.u}`);
  assert.equal(result.penetrationMm, 0);
  assert.ok(Math.abs(result.contactReactionN) < 1e-15);
  assert.ok(close(result.gapRemainingMm, 0.5));
  assert.ok(close(result.springForceN, 50));
  assert.ok(Math.abs(result.residualN) <= 1e-9, `residual=${result.residualN}`);
  assert.ok(Number.isInteger(result.iterations) && result.iterations >= 1);
});

test('contact reference: F=200 N uses the analytic penalty solution u=(F+kp*gap)/(k+kp)', () => {
  const result = solve({forceN: 200});
  assert.equal(result.converged, true);
  assert.ok(close(result.u, 10200 / 10100), `u=${result.u}`);
  assert.ok(close(result.penetrationMm, 100 / 10100), `penetration=${result.penetrationMm}`);
  assert.ok(close(result.contactReactionN, (-10000 * 100) / 10100), `reaction=${result.contactReactionN}`);
  assert.ok(close(result.gapRemainingMm, 1 - 10200 / 10100));
  assert.ok(close(result.springForceN, (100 * 10200) / 10100));
  assert.ok(Math.abs(result.residualN) <= 1e-9, `residual=${result.residualN}`);
});

test('contact onset: F=100 N reaches exactly u=gap with zero penetration and zero reaction', () => {
  const result = solve({forceN: 100});
  assert.equal(result.converged, true);
  assert.ok(close(result.u, 1), `u=${result.u}`);
  assert.equal(result.penetrationMm, 0);
  assert.ok(Math.abs(result.contactReactionN) < 1e-15);
  assert.ok(Math.abs(result.gapRemainingMm) < 1e-15);
  assert.ok(Math.abs(result.residualN) <= 1e-9);
});

test('negative force keeps its sign: F=-50 N gives u=-0.5 mm and no contact', () => {
  const result = solve({forceN: -50});
  assert.equal(result.converged, true);
  assert.ok(close(result.u, -0.5), `u=${result.u}`);
  assert.ok(result.u < 0);
  assert.equal(result.penetrationMm, 0);
  assert.ok(Math.abs(result.contactReactionN) < 1e-15);
  assert.ok(close(result.gapRemainingMm, 1.5));
  assert.ok(close(result.springForceN, -50));
  assert.ok(Math.abs(result.residualN) <= 1e-9);
  const larger = solve({forceN: -200});
  assert.ok(close(larger.u, -2), `u=${larger.u}`);
  assert.ok(Math.abs(larger.contactReactionN) < 1e-15);
});

test('a zero gap is a stop at the origin and produces contact for any positive force', () => {
  const result = solve({gapMm: 0, forceN: 50});
  assert.equal(result.converged, true);
  assert.ok(close(result.u, 50 / 10100), `u=${result.u}`);
  assert.ok(close(result.penetrationMm, 50 / 10100));
  assert.ok(close(result.contactReactionN, (-10000 * 50) / 10100));
  assert.ok(Math.abs(result.residualN) <= 1e-9);
});

test('a stiffer penalty stop reduces penetration and approaches the -100 N ideal reaction', () => {
  const penalties = [1e4, 1e5, 1e6];
  const results = penalties.map(penaltyNPerMm => solve({forceN: 200, penaltyNPerMm}));
  for (const result of results) {
    assert.equal(result.converged, true);
    assert.ok(Math.abs(result.residualN) <= 1e-9, `residual=${result.residualN}`);
    assert.ok(result.u > 1, `u=${result.u}`);
    assert.ok(result.contactReactionN > -100 && result.contactReactionN < 0, `reaction=${result.contactReactionN}`);
  }
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i].penetrationMm < results[i - 1].penetrationMm, 'penetration must decrease with kp');
    assert.ok(results[i].u < results[i - 1].u, 'u must move toward the rigid stop with kp');
    assert.ok(Math.abs(results[i].contactReactionN + 100) < Math.abs(results[i - 1].contactReactionN + 100), 'reaction must approach -100 N');
  }
  assert.ok(Math.abs(results[2].contactReactionN + 100) < 0.1, `reaction=${results[2].contactReactionN}`);
  assert.ok(results[2].penetrationMm > 0 && results[2].penetrationMm < 1e-4);
});

test('invalid stiffness, gap, force, tolerance and iteration counts are refused', () => {
  assert.throws(() => solve({springNPerMm: 0}), refusal('CONTACT_SPRING_INVALID'));
  assert.throws(() => solve({springNPerMm: -1}), refusal('CONTACT_SPRING_INVALID'));
  assert.throws(() => solve({springNPerMm: Infinity}), refusal('CONTACT_SPRING_INVALID'));
  assert.throws(() => solve({springNPerMm: NaN}), refusal('CONTACT_SPRING_INVALID'));
  assert.throws(() => solve({penaltyNPerMm: 0}), refusal('CONTACT_PENALTY_INVALID'));
  assert.throws(() => solve({penaltyNPerMm: -5}), refusal('CONTACT_PENALTY_INVALID'));
  assert.throws(() => solve({penaltyNPerMm: Infinity}), refusal('CONTACT_PENALTY_INVALID'));
  assert.throws(() => solve({gapMm: -1}), refusal('CONTACT_GAP_INVALID'));
  assert.throws(() => solve({gapMm: NaN}), refusal('CONTACT_GAP_INVALID'));
  assert.throws(() => solve({gapMm: Infinity}), refusal('CONTACT_GAP_INVALID'));
  assert.throws(() => solve({forceN: NaN}), refusal('CONTACT_FORCE_INVALID'));
  assert.throws(() => solve({forceN: Infinity}), refusal('CONTACT_FORCE_INVALID'));
  assert.throws(() => solve({forceN: -Infinity}), refusal('CONTACT_FORCE_INVALID'));
  assert.throws(() => solve({toleranceN: 0}), refusal('CONTACT_TOLERANCE_INVALID'));
  assert.throws(() => solve({toleranceN: -1e-9}), refusal('CONTACT_TOLERANCE_INVALID'));
  assert.throws(() => solve({toleranceN: NaN}), refusal('CONTACT_TOLERANCE_INVALID'));
  assert.throws(() => solve({maxIterations: 0}), refusal('CONTACT_MAX_ITERATIONS_INVALID'));
  assert.throws(() => solve({maxIterations: -3}), refusal('CONTACT_MAX_ITERATIONS_INVALID'));
  assert.throws(() => solve({maxIterations: 1.5}), refusal('CONTACT_MAX_ITERATIONS_INVALID'));
  assert.throws(() => solve({maxIterations: Infinity}), refusal('CONTACT_MAX_ITERATIONS_INVALID'));
  assert.throws(() => solve({maxIterations: NaN}), refusal('CONTACT_MAX_ITERATIONS_INVALID'));
  assert.throws(() => solve({maxIterations: 1e20}), refusal('CONTACT_MAX_ITERATIONS_INVALID'));
  assert.throws(() => solveUnilateralContact(null), refusal('CONTACT_INPUT_INVALID'));
  assert.throws(() => solveUnilateralContact([]), refusal('CONTACT_INPUT_INVALID'));
  assert.throws(() => solve({frictionCoefficient: 0.3}), refusal('CONTACT_INPUT_UNKNOWN_KEY'));
  assert.throws(() => solve({tieBreak: 1}), refusal('CONTACT_INPUT_UNKNOWN_KEY'));
  const {gapMm, ...missing} = base;
  assert.throws(() => solveUnilateralContact({...missing, forceN: 50}), refusal('CONTACT_INPUT_MISSING_KEY'));
});

test('review counterexample is rejected in bounded time and never allowed to iterate 1e20 times', () => {
  const counterexample = {springNPerMm: 100, penaltyNPerMm: 10000, gapMm: 1, forceN: 200, toleranceN: 1e-30, maxIterations: 1e20};
  const child = runIsolated(counterexample);
  assert.equal(child.error, undefined, `child error: ${child.error?.message}`);
  assert.equal(child.status, 0, `child stderr: ${child.stderr}`);
  const observed = JSON.parse(child.stdout.trim());
  assert.equal(observed.outcome, 'refusal');
  assert.equal(observed.code, 'CONTACT_MAX_ITERATIONS_INVALID');
  assert.ok(observed.latencyMs < 2000, `child latency=${observed.latencyMs} ms`);
});

test('a within-budget stagnation (tolerance 1e-30 N) is refused finitely instead of looping', () => {
  const counterexample = {springNPerMm: 100, penaltyNPerMm: 10000, gapMm: 1, forceN: 200, toleranceN: 1e-30, maxIterations: 10000};
  const child = runIsolated(counterexample);
  assert.equal(child.error, undefined, `child error: ${child.error?.message}`);
  assert.equal(child.status, 0, `child stderr: ${child.stderr}`);
  const observed = JSON.parse(child.stdout.trim());
  assert.equal(observed.outcome, 'refusal');
  assert.equal(observed.code, 'CONTACT_NOT_CONVERGED');
  assert.equal(observed.details.reason, 'stagnation');
  assert.ok(Number.isInteger(observed.details.iterations) && observed.details.iterations < 100, `iterations=${observed.details.iterations}`);
  assert.ok(Number.isFinite(observed.details.residualN), `residual=${observed.details.residualN}`);
  assert.ok(Math.abs(observed.details.residualN) > 1e-30);
  assert.ok(observed.latencyMs < 2000, `child latency=${observed.latencyMs} ms`);
});

test('maxIterations budget boundary: 10000 is accepted, larger safe integers and 1e20 are refused', () => {
  const boundary = solve({maxIterations: 10000});
  assert.equal(boundary.converged, true);
  assert.ok(Math.abs(boundary.residualN) <= 1e-9);
  for (const maxIterations of [10001, 1e6, Number.MAX_SAFE_INTEGER, 1e20]) {
    assert.throws(() => solve({maxIterations}), error => {
      assert.equal(error.refusal, true);
      assert.equal(error.code, 'CONTACT_MAX_ITERATIONS_INVALID');
      assert.equal(error.details.limit, 10000);
      return true;
    });
  }
});

test('finite extreme stiffness/force that overflow residual or tangent are refused without NaN/Infinity details', () => {
  const assertFiniteDetails = details => {
    const walk = value => {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `non-finite detail ${value}`);
      else if (value && typeof value === 'object') for (const nested of Object.values(value)) walk(nested);
    };
    walk(details);
  };
  const overflowCases = [
    // residual and tangent are both finite at u=0, but the contact tangent 2e308 overflows.
    {springNPerMm: 1e308, penaltyNPerMm: 1e308, gapMm: 1, forceN: 1.5e308},
    // the second iteration residual 1e308 + 100*1e308 - 1e308 overflows.
    {springNPerMm: 1, penaltyNPerMm: 100, gapMm: 0, forceN: 1e308}
  ];
  for (const overflow of overflowCases) {
    assert.throws(() => solve({...overflow, maxIterations: 10}), error => {
      assert.equal(error.refusal, true);
      assert.equal(error.code, 'CONTACT_NON_FINITE');
      assertFiniteDetails(error.details);
      return true;
    });
  }
  const normal = solve({forceN: 200});
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(normal)));
});

test('fixed non-convergence condition (F=200 N, maxIterations=1) returns a typed refusal, not a success', () => {
  let result;
  assert.throws(() => { result = solve({forceN: 200, maxIterations: 1}); }, error => {
    assert.equal(error.refusal, true);
    assert.equal(error.code, 'CONTACT_NOT_CONVERGED');
    assert.equal(error.details.iterations, 1);
    assert.ok(Number.isFinite(error.details.residualN));
    assert.equal(error.details.toleranceN, 1e-9);
    return true;
  });
  assert.equal(result, undefined);
  // The same problem converges (in three active-set iterations) once the limit allows it.
  const converged = solve({forceN: 200, maxIterations: 3});
  assert.equal(converged.converged, true);
  assert.equal(converged.iterations, 3);
  assert.ok(close(converged.u, 10200 / 10100));
});

test('inputs are not mutated and the result carries no friction or history metadata', () => {
  const input = Object.freeze({...base, forceN: 200});
  const result = solveUnilateralContact(input);
  assert.equal(input.springNPerMm, 100);
  assert.equal(input.penaltyNPerMm, 10000);
  assert.equal(input.gapMm, 1);
  assert.equal(input.forceN, 200);
  assert.equal(input.toleranceN, 1e-9);
  assert.equal(input.maxIterations, 50);
  assert.deepEqual(Object.keys(result).sort(), ['contactReactionN', 'converged', 'gapRemainingMm', 'iterations', 'penetrationMm', 'residualN', 'springForceN', 'u']);
  assert.equal(result.frictionCoefficient, undefined);
  assert.equal(result.history, undefined);
});
