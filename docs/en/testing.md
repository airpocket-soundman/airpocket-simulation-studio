# API and fast verification

[日本語](../testing.md)

`npm test` runs shared-core tests without a browser; deployment CI runs them too. `npm run check:project -- project.json` validates saved data and prints selected area and counts.

Import createStudioApi from src/studio-api.js in Node, or access window.studioApi in the browser. Commands affect only the local application state; no HTTP server or credentials are needed.

```js
const api = window.studioApi;
api.getSummary();
api.selectTriangles(0, [0, 1]);
api.addCondition({type: 'fixed'});
api.selectTriangles(0, [20, 21]);
api.addCondition({type: 'force', value: 100, direction: [0, -1, 0]});
api.setMaterial('金属');
api.setMaterialProperties({youngModulus: 2e11, poissonRatio: 0.3, source: 'test record'});
const project = api.exportProject();
api.loadProject(project);
```

API version 1 offers getSummary, exportProject, loadProject, selectTriangles, clearSelection, addCondition, removeCondition, selectCondition, setMaterial and setMaterialProperties. Triangle IDs refer to the current display mesh. Returned state is copied; rejected commands leave it unchanged. Changing category clears properties to avoid accidental reuse.

UI registration/removal/reselection/save/restore uses the same commands. Browser checks still verify brush projection/visibility, CAD WASM, rendering and interactions; headless tests do not establish solver accuracy. Add reference-solution execution tests with each future engine.

Progress: `npm run task:status -- ID STATUS "note" [evidence]`, then commit and push src/progress.json. The board fetches that public file every 20 seconds while visible. Candidate→implemented→validated→deployed must remain distinct; keep tasks checking/ready until their relevant verification/deployment completes. Task updates are recorded by active development, not by an autonomous background scheduler.

See the [analysis guide](analysis-guide.md) for calculation APIs and direct Node verification of meshing, structural/thermal solving and adaptation.

v0.33 [small-strain J2 plasticity](plasticity.md) supports positive linear isotropic hardening under monotonic loading. `tests/plasticity.test.mjs` checks material response, finite-difference consistent tangents, hydrostatic non-yielding, material-point unloading and analytical bar references. `node --test tests/plasticity-integration.test.mjs` uses the canonical worker with real Gmsh/WASM to verify a 10×10×40 mm bar: reference stress 251.7412935 MPa, equivalent plastic strain 0.0017412935 and top reaction 25174.12935 N. It also checks converged histories, archive roundtrips, point probes, atomic rejection of corrupted plastic state and refusal of MFEM/WebGPU, adaptation, modal analysis and thermal-stress combinations. Material-point unloading tests do not establish support for cyclic FE loading or fatigue. These Node checks are separate from deployed UI verification and do not certify Tet4 accuracy against plastic locking.

v0.35 [closed STL volume meshing](stl-meshing.md) supports one closed outward-facing convex shell with at most 2000 triangles. `tests/stl-source.test.mjs` validates the source, while `tests/stl-mesh.test.mjs` checks volume meshing and source-shell volume/boundary consistency. `node --test tests/stl-integration.test.mjs` runs the canonical worker with real Gmsh/WASM on a 10 mm cube at E=1 GPa, ν=0 and 100 N axial force, checking 0.01 mm displacement and −100 N reaction, triangle boundary transfer, project/case roundtrips, probes, atomic rejection of invalid input, and refusal of adaptation and exact CAD patches. STL boundary transfer is approximate. These checks do not establish general concave/multiple-shell meshing, self-intersection repair or arbitrary-shape accuracy. Source tests remain separate from deployed browser interaction checks.

v0.36 [S–N fatigue evaluation](fatigue.md) is limited to proportional uniaxial linear-elastic constant-amplitude loading. Measured fully reversed `stressRatio:-1` amplitude data, yield stress, ultimate strength, test conditions and provenance are required; absent data does not generate numeric life. `tests/fatigue-material.test.mjs` checks curve ordering, provenance and atomic rejection. `tests/fatigue.test.mjs` checks measured-range log interpolation, Goodman correction and refusal of yielding or out-of-range stresses. `node --test tests/fatigue-integration.test.mjs` verifies the real WASM worker against a synthetic uniaxial reference with one million life cycles and a single-amplitude Miner usage of 0.1 at 100,000 applied cycles, plus an independent Goodman formula, archive roundtrips and corrupted-result rejection. Plastic fatigue, multiaxial/nonproportional fatigue, variable-amplitude rainflow counting and crack growth are unsupported. The curve is not extrapolated and infinite life is not inferred; synthetic verification does not certify real component life.

v0.37 [external 3D Stokes flow](stokes-flow.md) supports steady viscous flow in an external box at Re≤0.1 using CPU GMRES, with at most 2000 nodes and 8000 tetrahedra. Viscosity, density and outer velocity are required. `tests/stokes.test.mjs` checks a sphere with analytical outer velocity, scaling/reversal and scope limits; `tests/stokes-study.test.mjs` checks atomic setting rejection and real Gmsh automatic boundaries/reference length. `node --test tests/stokes-integration.test.mjs` checks the real WASM worker with uniform outer-box velocity, probes, archives, and rejection of corrupted boundary velocities, pressure gauge, physical fields and original CAD dimensions. Even after refinement, the analytical-outer sphere has approximately 6.25% reaction-drag, 28.3% surface-drag and 27.7% nodal-pressure errors. This does not establish agreement of the finite uniform-box UI with unbounded drag. Inertia, turbulence, adaptation and MFEM/WebGPU are unsupported; final deployed verification is a separate check.

Run src/acoustic-sweep.js directly in Node for acoustic sweeps. Use sampleResult(mesh,result,[x,y,z]) from src/probe.js, or window.analysisApi.probe([x,y,z]) in the browser. Adaptive output retains every mesh/boundary/result in adaptive.iterations.

Runtime tests cover cancellation/restart, stale Worker responses, input snapshots, deadlines and resource cleanup after convergence/memory/start failure. Memory exhaustion is injected as a Worker failure rather than exhausting the machine. The real UI verifies cancellation/restart and local meshing.

### 2026-10-13 case regression validation
All 48 automated tests pass. Added coverage rejects mismatched disciplines, operations and invalid result ranges atomically; prevents worker leaks with uncloneable options; and freezes nested calculation settings. A real Gmsh mesh and structural solver produce 0.04 mm at E=1 GPa and 0.02 mm at E=2 GPa under 100 N axial loading, both with −100 N reaction. Replaying JSON archived inputs reproduces displacement arrays and reactions exactly. At this stage, public UI/CAD/3D workflow automation was incomplete.

`node --test tests/worker-pipeline.test.mjs` directly executes the canonical analysis.worker.js handler with real Gmsh/WASM, boundary transfer and solvers, covering structural adaptation, radiation, contact and flow in about 2.4 seconds. Node self/fetch adapters do not verify browser worker threads, isolation or 3D controls; those require separate deployed UI checks.


### Verify deployed runtime assets directly (v0.23)

`npm run test:published` downloads the GitHub Pages runtime and executes its deployed analysis/CAD workers and WASM in real Node Workers. This checks distributed bundles separately from source tests. It rejects a deployed commit that differs from local HEAD; run after the latest Pages deployment completes.

Checks cover Airpocket/MFEM structure, radiation, finite-strain rubber, laminar channels, insufficient constraints and restart, project/case archives, the deployed STEP reader and STEP volume meshing. The first run fetches about 60 MB uncompressed. Content-addressed caching preserves unchanged WASM across commits. Cached checks took approximately six seconds on this machine.

`runtime-manifest.json` records version, commit, lengths and SHA-256 hashes. Results go to `.qa/published-report.json`; `.qa/published-reference.step` is generated for browser checks. Failures replace earlier success reports. Project/case comparison helpers use local source; deployed calculation workers are the actual published bundles.

After `npm run build`, use `npm run test:published -- --local` to verify generated distribution files. CI runs the 242 source tests, builds, checks the distribution and publishes only after these pass. Node self/fetch/CAD adapters do not establish browser isolation, rendering or actual WebGPU operation.

### Browser regression recipe

`scripts/qa-browser.cua.js` uses only documented CUA operations to verify MFEM/rubber references, case text export/import/saved display, JP/EN, STEP face selection, orbit and repeated selection, and project restoration. Use a dedicated scratch tab: the recipe reloads it and replaces its test models/cases. Visible JSON text enables roundtrip testing where ordinary download events cannot be captured.

In a CUA JavaScript session, pass an existing test tab and the generated local reference file. Each `next()` executes one milestone, allowing progress and failures to be inspected. Adapt absolute paths to the local checkout.

```js
const fs = await import('node:fs/promises');
const qa = await import('file:///D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/qa-browser.cua.js');
const run = qa.runStudioBrowserQa(
  testTab,
  'D:/github/airpocket-soundman/airpocket-simulation-studio/.qa/published-reference.step',
  'https://airpocket-soundman.github.io/airpocket-simulation-studio/',
  {writeText: (path, text) => fs.writeFile(path, text)}
);
await run.next(); // Advance one milestone; the final done=true value is the report.
```

This recipe verifies the current in-app browser. It does not establish cross-browser performance or exhaustive UI coverage; PERF1 tracks separate measurements. It is not a standalone browser-control script for the ordinary Node CLI.

The transient acoustic distribution check verifies arrival time, pressure amplitude and archives using the deployed Worker. Unit tests verify WAV bandwidth filtering and physical duration.

The browser recipe now has 38 checks, including polymer comparison selection, preliminary source status, JP/EN labels and five engineering-polymer solves, plus transient traces/time controls/WAV UI, natural modes, saved-mode exterior sound and a large four-case JSON roundtrip. Large open export text is read through scoped DOM values rather than requesting the entire accessibility tree.

The public v0.42 run passed all 38 browser checks, including STEP update reconciliation, retained unresolved values, project roundtrips and real STEP reanalysis after region repair, including finite-box Stokes, PNG/WebM and four animation types with restored view settings. MCP tests verify clean CPU Worker execution, protocol initialization/listing and refusal to overwrite saved output.

Brittle fracture tests cover analytical mode-I bounds, closure, crack-plane rotation, parameter sensitivity, temperature scope, real WASM and recomputed archive fields. The browser recipe includes three fracture checks.

Public v0.43 passed all 42 browser checks, including four 3MF/G-code import, layer preview, export and atomic-refusal/language checks. Generate their fixtures with `node scripts/print-fixtures.mjs`.

### 2026-10-14 agent iteration infrastructure and independent modules

For this working tree, `npm test` completed 281 tests: 279 passed, two skipped, zero failed. The skips are optional host-native proof tests without a configured executable, not evidence of native success. Build and 26 local-distribution checks also passed. This does not verify newly deployed browser interactions or live-browser MCP.

- Analysis-job, service and real-process MCP tests verify frozen inputs/revisions, incremental events, retries, cancellation/release, stale replies, timeouts, exclusive output and storage limits. Thermal time fields match mesh references and final history. Browser lifecycle tests use replacement Workers; real browser interaction remains to be verified.
- Project-operation/MCP-edit tests verify atomic batches, SHA-256 revisions, input/existing-output preservation and rejection of invalid operations, partial failures and conflicts.
- The independent internal-Stokes boundary tests run real P1/P2 solvers against port/wall conditions, flux/divergence balance, pipe pressure loss and refinement trends. One P2 loss is about 0.388 Pa against 0.4 Pa; coarse P1 errors remain substantial. UI/Worker/saved-study integration is unfinished.
- The same fixed-bar C++ proof passed two additional WASM development tests. Output identifies `wasm-development-check`. Host machine-code execution remains unverified without host C++ standard-library headers; see `native/native-proof/README.md`.

The specialist SKILL passed `quick_validate.py`. Numerical/lifecycle checks do not establish LLM completion rates, real-GPU/rendering behavior or physical accuracy.

## 2026-10-14: browser intermediate artifacts and late connector replies

The complete suite with `node --test --test-concurrency=4 tests/*.test.mjs` passed 327 tests with three environment-dependent skips (330 total). The added acoustic unit/time test also passed separately. Real Chrome and stdio MCP verified a transient thermal reference with 94 nodes, 218 tetrahedra and three steps: retain one mesh/three temperature fields; verify hashes, input and mesh identity; read bounded pages; display the saved result; refuse reads after release.

At [5,5,20] mm, the intermediate temperature was 20.002566084871628 degC at one second and 20.027338600398892 degC at three seconds. The last sample matched the final result probe while intermediate artifacts remained provisional. No heat flux is invented from intermediate temperatures. Tests cover budgets, release, remeshing, units, revision conflicts and late replies; expired undispatched commands are refused, and late replies no longer disconnect the session.

One default-concurrency full run failed in the existing force-controlled Neo-Hookean bar's Newton line search. Forty isolated generated references did not reproduce it; the cause remains unresolved, tracked as NUMERICREFERENCE1 for failed-mesh/state capture and reproducibility. Solver tolerances were not changed. The 25 ms cancel/timeout test race now uses a controlled clock rather than wall-time scheduling.

## 2026-10-14: LLM result-view and saved-case operations

The full suite completed 356 tests: 353 passed, three skipped, zero failed, at concurrency four. Build and 26 local-distribution checks passed. Tests cover revisions, scopes, revocation and busy conflicts for result/case operations in the optional 22-method connector. Public HTTPS connector verification remains pending.

Real Chrome and stdio MCP verified thermal field selection, a fixed 20–100 degC range, wire visibility and camera replay; invalid ranges preserve the previous state, and the fixed-range legend follows Japanese/English switching. Saved-case create/rename/list/restore-input/view/remove succeeded; a stale removal revision was refused. Restoring inputs cleared the displayed result; viewing the saved case restored the original result revision.

For 61 stored acoustic frames, the zero-time probe returned zero seconds and zero Pa; the final frame returned 0.004 seconds and 2.5926219431124826e-11 Pa. Unstored times and foreign result revisions were refused. Selecting the second structural mode produced its matching 278.6660713516683 Hz probe frequency; normalized modes are not driven dynamic response.

Displayed frame/mode selection uses a shared sampling function. Unit tests cover versioned probes, validated atomic view changes/rollback, stable case IDs/content revisions and expired mutations. Named/persisted view settings, MCP PNG/WebM export jobs and thermal time display remain unfinished.

Additional NUMERICREFERENCE1 investigation passed 200 generated references and a default-concurrency instrumented full run (343 tests, 340 passed, three skipped). The 100 recorded converged steps had relative residuals from 2.01e-15 to 1.616e-14; all 300 recorded line-search trials accepted a full step. The original failure was not reproduced. Production solver, tolerances and existing tests were unchanged; failed-input capture and root-cause investigation remain open.

## 2026-10-14: LLM PNG/WebM export jobs

Real Chrome and stdio MCP exported a revision-pinned PNG: 77,944 bytes retrieved as 65,536 and 12,408 byte pages, concatenated and verified against SHA-256 f2ea64eca6a3bfca2a3a10b1758673535fdecd343583aad470f7344250bc537d. Visual inspection confirmed the model name, 20–100 degC legend and thermal field.

A one-second orbit WebM contained 8,795 verified bytes. ffprobe reported VP9, 1365×957, 0.970924 seconds and two frames. Background-tab real-time recording did not achieve requested 24 fps; this is not fixed-frame verification. Capabilities explicitly report recording:realtime, targetFrameRate:24 and frameCountGuaranteed:false.

Cancelling an active 15-second export restored the exact pre-export result view/camera/layers. Cancelled artifacts and released jobs refused retrieval. Unit tests cover non-downloading PNG/WebM returns, render/recorder errors, cancellation restoration, stream cleanup, disconnect controls, revisions/idempotence/expiry, retention budgets, 64 KiB paging/SHA-256 and disconnect during preparation. The optional connector now has 28 methods; default saved-file MCP capabilities remain distinct. Public HTTPS pairing, MP4/GIF, deterministic fixed-frame output and persistent export storage remain unfinished.

The final full suite passed 370 of 373 tests, with three skips and zero failures at concurrency four. Build, 26 distribution checks and specialist SKILL validation also passed.

## 2026-10-14: named result-view persistence and restoration

The full suite passed 386 of 389 tests, with three skips and zero failures at concurrency four. Build, 26 local-distribution checks and specialist SKILL validation passed. Tests cover schemas, revisions, serialization, expiry, atomic invalid import, failed-apply restoration and derived camera arithmetic overflow.

Real Chrome and stdio MCP saved a thermal view with a fixed 20–100 degC range, surface wire, camera [80,60,80], target [5,5,20], 35-degree field of view, Z=20 mm section and 0.7 opacity. After changing these settings, restoration exactly matched both complete result/setup snapshots. The separate view JSON was 1,146 bytes and contained no physical arrays or model.

GUI save also succeeded. Reload cleared the in-memory list; importing the saved case and separate view JSON through visible file labels restored the view. Reconnected MCP confirmed the same result revision and all settings. MCP remove/import/export reproduced the original JSON exactly. Invalid camera data and applying to a different result revision were refused; Japanese/English restore/remove controls were verified. Automatic persistence, bundling views with cases and synchronized application across different results remain unsupported.
