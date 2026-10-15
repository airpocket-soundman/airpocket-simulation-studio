# Solver adapter boundary (MOD1, second slice)

[日本語](../solver-adapters.md)

The per-discipline if/else chain inside `solve()` of `src/analysis.worker.js` (creepingFlow / channelFlow / acoustic / thermal / structural) was moved into per-discipline execution adapters. Behavior, error messages and result payloads are unchanged.

## Layout

- `src/solver-adapters/index.js`: the registry. `resolveSolverAdapter(study)` looks an adapter up by `study.kind`. An unregistered or missing kind still runs as structural, as before (`legacyDefaultKind='structural'`).
- Adapters (each `{kind, progressMessage, execute(ctx)}`): `creeping-flow-adapter.js`, `channel-flow-adapter.js`, `acoustic-adapter.js`, `thermal-adapter.js`, `structural-adapter.js` (modal, plasticity, hyperelastic, MFEM, WebGPU and Tet4 PCG included).
- The worker keeps acceptance, validation, meshing, progress, failure stage, post-processing (fracture, fatigue, temperature-range checks) and result delivery.
- To add a discipline: add one adapter file and one entry in the `adapters` array of `index.js`.

## Deliberately unchanged

- `operation` is still special only for `mesh`; any other value runs the analysis (it is not rejected; pinned by a test).
- Pre-dispatch validation (cross-discipline constraints, etc.) stays in the worker.

## Not done (MOD1 is not complete)

- UI/state separation, TypeScript contracts and React/WASM migration are not part of this slice.
- Moving pre-validation into adapters and adapterizing `adaptiveSolve`/`build` are not started.
- Classifying `src/solver-adapters/` in the dependency rules is left to the lead.

## Tests

`tests/solver-adapter-registry.test.mjs` (registry lookup, fallback for unknown kinds, operation handling, rejection messages) plus the existing `tests/worker-pipeline.test.mjs`.
