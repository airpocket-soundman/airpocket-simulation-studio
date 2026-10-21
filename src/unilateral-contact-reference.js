// Reference unilateral (one-sided) contact solver for a single degree of freedom.
// A linear spring (springNPerMm) carries a signed axial force (forceN) toward a rigid
// displacement stop at gapMm, with a penalty contact stiffness (penaltyNPerMm). The
// scalar problem is solved by an active-set / piecewise-Newton iteration.
//
// Scope: this is a bounded real-valued reference problem only. It is NOT a production
// 3D contact, friction or bolt solver, it is not connected to the Tet4 solver, the
// worker, the schema or the UI, and it must not be used as a mock for them. Thermal
// contact conductance (thermal-contact.js) is a different physical quantity and is not
// reused here. Only a converged result is returned as success; anything else is a typed
// refusal, and the applied force sign is preserved (never replaced by its absolute value).
//
// Sign convention (mm, N): +u moves toward the stop, so
//   penetration = max(0, u - gapMm)   and   contactReactionN = -penaltyNPerMm * penetration
//   residualN   = springNPerMm * u + penaltyNPerMm * max(0, u - gapMm) - forceN
// Independent analytic expectations used by the tests:
//   non-contact  u = forceN / springNPerMm
//   contact      u = (forceN + penaltyNPerMm * gapMm) / (springNPerMm + penaltyNPerMm)
const INPUT_KEYS = ['springNPerMm', 'penaltyNPerMm', 'gapMm', 'forceN', 'toleranceN', 'maxIterations'];
// Computational resource ceiling, not a physical convergence threshold. The reference
// fixture and its documented examples use maxIterations = 50 (50 above the 3 active-set
// iterations needed there). Other bounded solvers in this repository cap at 100 (modal),
// 2500 (PCG) and 5000 (Stokes), so a scalar Newton reference model never needs more than
// 10000; accepting larger values would only allow unbounded CPU use.
const MAX_ITERATION_BUDGET = 10000;

function refusal(code, message, details) {
  const error = new Error(message);
  error.name = 'UnilateralContactRefusal';
  error.code = code;
  error.refusal = true;
  if (details) error.details = details;
  return error;
}

function finite(code, key, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw refusal(code, `Unilateral contact requires a finite ${key}`, {key});
  return value;
}

function positive(code, key, value) {
  const number = finite(code, key, value);
  if (number <= 0) throw refusal(code, `Unilateral contact requires a positive ${key}`, {key});
  return number;
}

/** Solve the one-degree-of-freedom penalty contact problem. Returns only converged
 * results; invalid input and iteration-limit exhaustion throw a typed refusal. */
export function solveUnilateralContact(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw refusal('CONTACT_INPUT_INVALID', 'Unilateral contact requires a plain input object', {key: 'input'});
  for (const key of Object.keys(input)) if (!INPUT_KEYS.includes(key)) throw refusal('CONTACT_INPUT_UNKNOWN_KEY', `Unknown unilateral contact key: ${key}`, {key});
  for (const key of INPUT_KEYS) if (!Object.hasOwn(input, key)) throw refusal('CONTACT_INPUT_MISSING_KEY', `Missing unilateral contact key: ${key}`, {key});
  const springNPerMm = positive('CONTACT_SPRING_INVALID', 'springNPerMm', input.springNPerMm);
  const penaltyNPerMm = positive('CONTACT_PENALTY_INVALID', 'penaltyNPerMm', input.penaltyNPerMm);
  const gapMm = finite('CONTACT_GAP_INVALID', 'gapMm', input.gapMm);
  if (gapMm < 0) throw refusal('CONTACT_GAP_INVALID', 'Unilateral contact requires gapMm >= 0', {key: 'gapMm'});
  const forceN = finite('CONTACT_FORCE_INVALID', 'forceN', input.forceN);
  const toleranceN = positive('CONTACT_TOLERANCE_INVALID', 'toleranceN', input.toleranceN);
  const maxIterations = input.maxIterations;
  if (typeof maxIterations !== 'number' || !Number.isSafeInteger(maxIterations) || maxIterations < 1 || maxIterations > MAX_ITERATION_BUDGET) throw refusal('CONTACT_MAX_ITERATIONS_INVALID', `Unilateral contact requires a safe integer maxIterations in [1, ${MAX_ITERATION_BUDGET}]`, {key: 'maxIterations', limit: MAX_ITERATION_BUDGET});
  // A residual, tangent or iterate that overflows IEEE-754 is not a physical result and must
  // never reach the returned JSON as NaN/Infinity.
  const nonFinite = (key, iterations) => refusal('CONTACT_NON_FINITE', `Unilateral contact produced a non-finite ${key}`, {key, iterations});
  const stagnant = (iterations, residualN, reason) => refusal('CONTACT_NOT_CONVERGED', 'Unilateral contact iteration stagnated; no converged result returned', {iterations, residualN, toleranceN, reason});

  // Fixed initial iterate so the iteration count and non-convergence behaviour are reproducible.
  let u = 0;
  let iterations = 0;
  let residualN = 0;
  let converged = false;
  // Bounded stagnation guard: at most MAX_ITERATION_BUDGET states are retained.
  const seen = new Set();
  while (iterations < maxIterations) {
    iterations++;
    residualN = springNPerMm * u + penaltyNPerMm * Math.max(0, u - gapMm) - forceN;
    if (!Number.isFinite(residualN)) throw nonFinite('residualN', iterations);
    if (Math.abs(residualN) <= toleranceN) {
      converged = true;
      break;
    }
    seen.add(u);
    const penetration = Math.max(0, u - gapMm);
    const tangent = springNPerMm + (penetration > 0 ? penaltyNPerMm : 0);
    if (!Number.isFinite(tangent) || !(tangent > 0)) throw nonFinite('tangent', iterations);
    const next = u - residualN / tangent;
    if (!Number.isFinite(next)) throw nonFinite('u', iterations);
    if (next === u || seen.has(next)) throw stagnant(iterations, residualN, 'stagnation');
    u = next;
  }
  if (!converged) throw refusal('CONTACT_NOT_CONVERGED', 'Unilateral contact iteration limit reached; no converged result returned', {iterations, residualN, toleranceN, reason: 'iteration-limit'});

  const penetrationMm = Math.max(0, u - gapMm);
  const gapRemainingMm = gapMm - u;
  const springForceN = springNPerMm * u;
  const contactReactionN = penetrationMm === 0 ? 0 : -penaltyNPerMm * penetrationMm; // normalise -0 when penetration is exactly zero
  const finalResidualN = springNPerMm * u + penaltyNPerMm * penetrationMm - forceN;
  for (const [key, value] of [['u', u], ['gapRemainingMm', gapRemainingMm], ['penetrationMm', penetrationMm], ['springForceN', springForceN], ['contactReactionN', contactReactionN], ['residualN', finalResidualN]]) if (!Number.isFinite(value)) throw nonFinite(key, iterations);
  return {
    converged: true,
    iterations,
    u,
    gapRemainingMm,
    penetrationMm,
    springForceN,
    contactReactionN,
    residualN: finalResidualN
  };
}
