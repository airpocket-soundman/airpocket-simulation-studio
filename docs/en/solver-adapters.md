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

## build / adaptive loop moved (slice 7)

- Optional hook `buildOptions({data})`: returns discipline-specific mesh options that the worker's `build()` spreads after `data.options`. Only creepingFlow implements it (caps `maxElements` at `min(8000, options.maxElements ?? 8000)`), at the same position and with the same value as the former `stokes?{...}:{}` branch.
- Optional hook `adaptive({data,mesh,solve,progress,observe})`: invokes the adaptive refinement loop (including its default limits). Only structural implements it, because the indicators need structural stress/strain fields. Other disciplines never reach it since `validate` already rejects adaptive; as a guard the worker fails an adapter without `adaptive` with the same message ("Adaptive refinement currently supports structural analysis only").
- Stays in the worker: the `build`/`solve` closures, the mesh-generation call, merging of cylindrical/planar CAD regions and user refinements, mesh observation, the `operation==='mesh'` vs adaptive branching, the fracture/fatigue assessment calls. These are shared orchestration or post-processing, and hooking them would risk behavior drift. (Boundary-transfer skipping and the thermal temperature-range check moved out in the post-processing slice below.)
- Pinned by `tests/solver-adapter-build.test.mjs` (22 cases recorded from the pre-move code: structural adaptive, thermal/other adaptive rejection, mesh-only, STL, fluidDomain, flow/Stokes build and element cap; includes a digest of all non-timing messages).

## Not done (MOD1 is not complete)

- UI/state separation, TypeScript contracts and React/WASM migration are not part of this slice.
- The discipline-specific parts of `build` and the adaptive-loop call are adapterized (below). Mesh generation itself, progress, and the adaptive loop body (`src/adaptive.js`) stay shared.

## Tests

`tests/solver-adapter-validation.test.mjs` (39 cases pinning rejection messages, failure stage/code and precedence with values recorded from the pre-move code), `tests/solver-adapter-registry.test.mjs` (registry lookup, fallback for unknown kinds, operation handling, rejection messages) plus the existing `tests/worker-pipeline.test.mjs`.

## Post-processing hooks (slice 9)

- Optional flag `skipsBoundaryTransfer`: when `true` the worker still enters the `boundary-transfer` stage and emits the "Transferring boundary regions…" progress, but passes `{reports:[]}` instead of calling `transferConditions`. Set by `creepingFlow` and `channelFlow` (replaces the worker's `stokes||flow` test).
- Optional hook `postprocess({data,result})`: called in the worker's `postprocess` stage after the generic fracture/fatigue assessments and before `result.performance` is set. Implemented only by `thermal` (material temperature-range check of the final field, the transient initial temperature and each history min/max; same errors as before).
- Stays in the worker: the fracture/fatigue assessment calls and their `study.kind!=='structural'` guards. The guards reject every non-structural study (and thermal-stress/modal), so they are a shared assessment-support gate rather than one discipline's rule; moving them would force every other adapter to carry a rejecting hook (or a default) to keep the same error and ordering. Ordering is unchanged: fracture, fatigue, adapter `postprocess`, performance, delivery.
- Pinned by `tests/solver-adapter-post.test.mjs` (20 cases recorded from the pre-move code: flow/Stokes solves and their assessment guards, thermal steady/transient in/out of range, structural fracture/fatigue, acoustic; digest of all non-timing messages).
