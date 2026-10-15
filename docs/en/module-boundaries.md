# Module boundary check (MOD1 first slice)

Japanese: [../module-boundaries.md](../module-boundaries.md)

This slice mechanically checks the ES-import dependency direction of `src/` and pins the already-existing shapes of diagnostics, job status/events and case/result identity as declaration-only types (`.d.ts`).

## Layers

The classification table is `src/module-layers.json`. Every `.js` file under `src/` (including subdirectories) must belong to exactly one layer.

| Layer | Role | May import |
| --- | --- | --- |
| contract | Pure contracts, identities, schemas (project-revision, runtime-identity, analysis-failure, job-event-payload, browser-operation-*, ...) | nothing |
| domain | Solvers, meshes, materials, regions, per-analysis input contracts, `solver-adapters/` | contract |
| operations | Project/case/job operation API (studio-api, analysis-preflight, cases, case-comparison, ...) | contract, domain |
| session | Browser session / MCP bridge, analysis-client (no DOM) | contract, domain, operations |
| ui | DOM/three.js presentation, `main.js`, `ui/` | contract, domain, operations, session |
| dashboard | Progress board (board*, progress*) | contract, ui |
| worker | `analysis.worker.js`, `cad.worker.js` | contract, domain |

## Rules

- Imports to any layer not listed above are forbidden (reverse and sideways edges included).
- External packages (e.g. `three`) are allowed only if listed in the layer's `externals`; today only ui.
- Non-JS imports (JSON, CSS, `?raw`) are allowed only if listed in the layer's `assets`.
- Browser globals such as `document.getElementById` are forbidden in layers with `dom: false`.
- A file missing from the table, or listed but absent, fails.
- Exceptions go in `allowlist` with a reason. A stale exception (violation already gone) also fails, forcing removal.

Current allowlist (pre-existing violations, recorded rather than hidden):

1. `project-import.js` -> `three`, `three/addons/loaders/STLLoader.js` (operations layer uses three.js for STL loading).
2. `print-zip.js` -> `three/addons/libs/fflate.module.js` (3MF zip uses the fflate bundled with three).

Replacing them with a pure parser / direct dependency is follow-up work.

## Running

```
node scripts/check-module-boundaries.mjs          # check
node scripts/check-module-boundaries.mjs --graph  # print the parsed import graph
node --test tests/module-boundaries.test.mjs tests/contracts.test.mjs
```

## Adding a file

1. Create the file under `src/`.
2. Add its `src/`-relative path to `layers.<name>.files` in `src/module-layers.json`. When unsure, place it above the highest layer it depends on.
3. Run `node scripts/check-module-boundaries.mjs`; fix forbidden edges. The allowlist is a last resort and needs a reason.

## Shared type contract (`src/contracts/*.d.ts`)

`diagnostics.d.ts` (AnalysisFailure/AnalysisDiagnostic/JobErrorRecord), `job.d.ts` (JobView/JobEvent/pages), `case.d.ts` (Revision/RuntimeIdentity/case list/comparison response). All are declarations derived from existing code; no compiler dependency. `tests/contracts.test.mjs` compares real runtime output with declared fields (missing required and undeclared fields fail) so the contract cannot drift silently. Add a shape only if it already exists in the implementation, together with its parity test.

## What this does NOT cover

- MOD1 is not complete. This slice is only the mechanical dependency-direction check and a limited type contract.
- No React or WASM migration.
- Moving folders alone does not count as a boundary; passing the classification table and direction check does.
- Not checked: cycles inside one layer, function-level responsibilities, dynamic globals such as `window.`, runtime-computed import specifiers. DOM detection is an approximation using a narrow regex.
- Type declarations are not compiler-verified. Parity checks field names only, not types or value ranges.
