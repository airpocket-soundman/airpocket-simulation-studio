# Solver adapter boundary (MOD1, second slice)

[日本語](../solver-adapters.md)

The per-discipline if/else chain inside `solve()` of `src/analysis.worker.js` (creepingFlow / channelFlow / acoustic / thermal / structural) was moved into per-discipline execution adapters. Behavior, error messages and result payloads are unchanged.

## Layout

- `src/solver-adapters/index.js`: the registry. `resolveSolverAdapter(study)` looks an adapter up by `study.kind`. An unregistered or missing kind still runs as structural, as before (`legacyDefaultKind='structural'`).
- Adapters (each `{kind, progressMessage, execute(ctx)}`): `creeping-flow-adapter.js`, `channel-flow-adapter.js`, `acoustic-adapter.js`, `thermal-adapter.js`, `structural-adapter.js` (modal, plasticity, hyperelastic, MFEM, WebGPU and Tet4 PCG included).
- Adapters may also define an optional `validate({phase,data})` hook (all five do). Discipline-specific pre-dispatch validation moved there (see below).
- The worker keeps acceptance, generic validation, meshing, progress, failure stage, post-processing (fracture, fatigue, temperature-range checks) and result delivery.
- To add a discipline: add one adapter file and one entry in the `adapters` array of `index.js`.

## Deliberately unchanged

- `operation` is still special only for `mesh`; any other value runs the analysis (it is not rejected; pinned by a test).
- Where validation runs, its order, the error strings and the failure stage (`preparation`). `validate` is called at the worker's three original points: `pre-load` (before the gmsh import), `loaded` (right after it) and `configured` (after the "Simulation modules loaded" observation, before the mesh/solve closures are built). When several rules could fire, the same one wins as before.

## Pre-validation moved into adapters (slice 5)

Shared guards live in `src/solver-adapters/validation.js`; each adapter's `validate` calls them in its discipline's original order.

- creepingFlow (`pre-load`): `validateProject`, `validateStokesStudy`, Airpocket-CPU-solvers-only.
- All disciplines (`loaded`): orthotropic elasticity only for static linear CPU structure.
- All disciplines (`configured`): plastic load fractions, plasticity, modal, far-field / transient-acoustic / vibration validators (structural-only features carried by a non-structural study are still rejected as before).
- Per discipline (`configured`): material validation (structural and thermal only), boundary-condition type check (the "other discipline" error), rejection of adaptive refinement and WebGPU/MFEM for non-structural studies (flow, Stokes, thermal, acoustic), hyperelastic constraints (structural), spherical-radiation precondition (acoustic).

### What stays in the worker

- Acceptance, `requireResolvedCadConditions` (except for `operation==='mesh'`), STL source validation (`validateStlSource`/`validateProject`/geometry match/no adaptive or CAD patches): source-format checks independent of the discipline.
- The exterior fluid-domain "meshing only" rejection: it spans `source.kind`, `study.kind` and `mode`, so it is not a single discipline's rule.
- Fracture/fatigue assessment and the temperature-range checks (`postprocess` stage), meshing, the adaptive loop, progress, cancellation and result delivery.

## Not done (MOD1 is not complete)

- UI/state separation, TypeScript contracts and React/WASM migration are not part of this slice.
- Adapterizing `adaptiveSolve`/`build` is not started.

## Tests

`tests/solver-adapter-validation.test.mjs` (39 cases pinning rejection messages, failure stage/code and precedence with values recorded from the pre-move code), `tests/solver-adapter-registry.test.mjs` (registry lookup, fallback for unknown kinds, operation handling, rejection messages) plus the existing `tests/worker-pipeline.test.mjs`.
