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
  if (typeof maxIterations !== 'number' || !Number.isInteger(maxIterations) || maxIterations < 1) throw refusal('CONTACT_MAX_ITERATIONS_INVALID', 'Unilateral contact requires an integer maxIterations >= 1', {key: 'maxIterations'});

  // Fixed initial iterate so the iteration count and non-convergence behaviour are reproducible.
  let u = 0;
  let iterations = 0;
  let residualN = 0;
  let converged = false;
  while (iterations < maxIterations) {
    iterations++;
    residualN = springNPerMm * u + penaltyNPerMm * Math.max(0, u - gapMm) - forceN;
    if (Math.abs(residualN) <= toleranceN) {
      converged = true;
      break;
    }
    const penetration = Math.max(0, u - gapMm);
    const tangent = springNPerMm + (penetration > 0 ? penaltyNPerMm : 0);
    const next = u - residualN / tangent;
    if (!Number.isFinite(next)) break;
    u = next;
  }
  if (!converged) throw refusal('CONTACT_NOT_CONVERGED', 'Unilateral contact iteration limit reached; no converged result returned', {iterations, residualN, toleranceN});

  const penetrationMm = Math.max(0, u - gapMm);
  return {
    converged: true,
    iterations,
    u,
    gapRemainingMm: gapMm - u,
    penetrationMm,
    springForceN: springNPerMm * u,
    contactReactionN: penetrationMm === 0 ? 0 : -penaltyNPerMm * penetrationMm, // normalise -0 when penetration is exactly zero
    residualN: springNPerMm * u + penaltyNPerMm * penetrationMm - forceN
  };
}
