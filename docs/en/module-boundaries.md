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
- In layers with `dom: false` (contract/domain/operations/session/worker) these browser globals are forbidden: the narrow `document.*` DOM APIs, `localStorage`/`sessionStorage`, `navigator.gpu/serviceWorker`, `HTMLElement`, `requestAnimationFrame`, `window.`, `location`, `history.pushState` and friends, `fetch(`, `new Worker`/`new SharedWorker`. Comments, string/template/regex literal contents and property accesses (`x.location`, `api.fetch(`) are ignored. So "session = no DOM" means no DOM elements/UI; it does not guarantee browser independence (see the allowlist below).
- Imports are extracted by tokenizing, not by regexes over raw text. Static imports, `export ... from`, dynamic `import(...)` (string or substitution-free template literal, with or without an options argument), `new URL('./x.js', import.meta.url)` and `new Worker('./x.js')` all create edges, so worker/asset loading by URL is layer-checked too. CRLF/CR/BOM, and backslash separators in specifiers and table entries, are handled.
- A file missing from the table, or listed but absent, fails.
- Exceptions go in `allowlist` with a reason. A stale exception (violation already gone) also fails, forcing removal.

Current allowlist (pre-existing violations and deliberate exceptions, recorded with reasons rather than hidden):

1. `project-import.js` -> `three`, `three/addons/loaders/STLLoader.js` (operations layer uses three.js for STL loading).
2. `print-zip.js` -> `three/addons/libs/fflate.module.js` (3MF zip uses the fflate bundled with three).
3. `analysis-client.js` -> `analysis.worker.js` (edge) and `new Worker` (dom): the session starts the Web Worker via `new Worker(new URL(...))`. It is a process boundary; the worker layer is intentionally not in session's mayImport.
4. `main.js` -> `cad.worker.js` (edge): ui starts the CAD worker by URL.
5. `analysis.worker.js` `fetch()` (dom): the worker fetches its own WASM (worker-scope `fetch`, not DOM access).

Replacing 1-2 with a pure parser / direct dependency is follow-up work. A dom exception is given per global: `kind: "dom"`, `to: <global name>`.

## Running

```
node scripts/check-module-boundaries.mjs          # check
node scripts/check-module-boundaries.mjs --graph  # print the parsed import graph
npm run check:contracts                           # type-check declarations and fixture
node --test tests/module-boundaries.test.mjs tests/contracts.test.mjs tests/contracts-types.test.mjs
```

## Adding a file

1. Create the file under `src/`.
2. Add its `src/`-relative path to `layers.<name>.files` in `src/module-layers.json`. When unsure, place it above the highest layer it depends on.
3. Run `node scripts/check-module-boundaries.mjs`; fix forbidden edges. The allowlist is a last resort and needs a reason.

## Independent changes and integration

Discipline-specific control visibility belongs in `src/ui/discipline-controls-ui.js`; `src/main.js` supplies state through a getter and calls it. Make a UI change primarily in that module and `tests/discipline-controls-ui.test.mjs`, adding only state injection or event wiring in `main.js`. Discipline-specific solver behavior belongs in `src/solver-adapters/<discipline>-adapter.js`, while `src/analysis.worker.js` owns the shared execution flow and calls the adapter. For example, temperature-range postprocessing is in `src/solver-adapters/thermal-adapter.js`. After a change, update the layer table and run the boundary check and relevant feature tests. Shared execution control and behavior not yet moved into an adapter remain worker responsibilities.

## Shared type contract (`src/contracts/*.d.ts`)

`diagnostics.d.ts` (AnalysisFailure/AnalysisDiagnostic/JobErrorRecord), `job.d.ts` (JobView/JobEvent/pages), `case.d.ts` (Revision/RuntimeIdentity/case list/comparison response), and `project-input.d.ts` (the saved project envelope and representative source, condition, material, study, unit and provenance shapes). `npm run check:contracts` invokes the TypeScript compiler in strict/noEmit mode over these declarations and positive/negative examples in `tests/fixtures/contracts-types.ts`. `SavedProjectBase` also compares its required version/meshes/conditions envelope with runtime output. These checks cover declarations, the fixture and that limited runtime envelope; they do not type-check the JavaScript implementation as a whole. `SavedProject` is a representative common shape, not a complete saved-project schema. For example, condition-level `planarRegion` and `cylindricalRegion` remain `unknown`, and not every optional runtime field or nested descriptor is modeled. Study and material extension points also use `unknown` index signatures to allow saved-format extensions, so the types do not validate every nested schema, physical range, unit conversion or provenance claim. The representative material example in the fixture is checked by the runtime material validator, and represented `ProjectUnits` symbols are mechanically compared with runtime thermal input-contract tables. Separately, `tests/contracts.test.mjs` compares the existing runtime contract fields with declarations (optional fields must be observed or explained in `OPTIONAL_NOT_OBSERVED`; extra keys on index-signature interfaces are pinned in `INDEXED_EXTRAS`). Update the declarations and fixture when adding a represented runtime shape.

## What this does NOT cover

- MOD1 is not complete. This slice is only the mechanical dependency-direction check and a limited type contract.
- No React or WASM migration.
- Moving folders alone does not count as a boundary; passing the classification table and direction check does.
- Not checked: cycles inside one layer, function-level responsibilities, aliased or computed globals (`globalThis[...]`), runtime-computed specifiers (variable imports, templates with `${}`, `new Worker(variable)`). DOM detection is a set of named patterns over the comment/literal-stripped code, an approximation rather than a complete list.
- The tokenizer guesses regex literals from the previous token; unusual code (e.g. a regex right after `)`) can be misread. The whole real repository is cross-checked by an independent oracle test (every relative `.js` string literal must be a recognised import).
- The TypeScript compiler check covers only `.d.ts` files and the fixture; it does not establish type safety for all JavaScript. Runtime parity is a separate check and compares field names plus literal/primitive/union/template-literal types and arrays of them. It does not verify the contents of object, interface or `unknown` types, index-signature values (e.g. `CaseComparisonRow`), or the real shape of optional fields that no sample produces (see `OPTIONAL_NOT_OBSERVED`).
