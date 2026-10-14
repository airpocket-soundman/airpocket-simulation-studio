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

## 2026-10-14: chunked case archives and atomic import

The full suite passed 403 of 406 tests, with three skips and zero failures at concurrency four. Build, 26 local-distribution checks and specialist SKILL validation passed. Archives retain the existing version-1 JSON format; caseList now exposes an archive SHA-256 revision.

`tests/mcp-case-archive-protocol.test.mjs` connects a real stdio MCP process and HTTP loopback to the shared session/case-operation/transfer modules. A synthetic Japanese-text case archive larger than 65,536 bytes roundtrips through bounded pages with exact byte count, SHA-256 and JSON agreement. After removing its case, chunked import restores arrays with fresh IDs. Stale archive revisions, corrupt result arrays, read-only import and reads after release are refused.

Unit tests cover incomplete input, invalid base64/hash/UTF-8/JSON, byte/count budgets, chunk retries, commit deduplication, release/disconnect/expiry and final busy/revision checks before replacement. Retained-buffer limits are not peak browser heap limits.

This protocol test uses a Node-hosted semantic adapter and is not real-browser UI evidence. Computer Use stopped because it could not verify the current URL, so real-browser archive transfer remains unverified. Public HTTPS pairing, browser UI integration and large-case performance measurements remain open.

## 2026-10-14: revision-bound fatigue/fracture API and MCP

The full suite passed 415 of 418 tests, with three skips and zero failures at concurrency four. The final assessment API/MCP/session subset also passed all 12 tests. Default MCP has 20 tools; optional pairing has 22 tools/42 methods. Eligible unassessed structural results expose available:false plus the result revision before evaluation.

`tests/mcp-assessment.test.mjs` uses real stdio MCP and an actual WASM axial solve. Explicit synthetic S-N reference data yields 1e6 cycles and damage0.1; mode-I intensity agrees with sigma*sqrt(pi*a). Adding fracture assessment preserves existing fatigue, inputs and stresses. Tests verify provenance, original provisional/remaining-check metadata, units/limitations and pages up to200 elements. Synthetic references are not measured material design data.

Existing output/input overwrite, stale revisions, omitted settings, unknown options, oversized pages and tampered stored assessments are refused. Source changes, busy state and revocation prevent commit. Real-browser and public-HTTPS assessment rendering remain unverified; Node/MCP numerical and persistence evidence does not establish live UI behavior.

Build passed. The first local-distribution check, concurrent with the full suite, stopped in Node v24.11.1/V8 with fatal `jit_page_->allocations_.erase(addr) == 1`. An isolated rerun passed all26 checks in29.07 seconds. Solver and checker sources were unchanged; root cause remains unresolved, tracked as RUNTIMEWASM1 for failed-state capture and reproducibility. Specialist SKILL validation passed.

## 2026-10-14: revision-bound CAD update API/MCP

The full suite passed426 of429 tests with three skips and zero failures at concurrency four; the final browser-input validation subset also passed all eight tests. Default MCP has22 tools; optional pairing has24 tools/44 methods. Reports contain at most50 compact condition summaries, not triangle arrays or complete replacement geometry.

Real stdio MCP imports an actual STEP with OCCT, checks both revisions and publishes a distinct updated JSON. Material/condition values are retained and provenance becomes unconfirmed. Quantitative analysis refuses INPUT_UNCONFIRMED. The synthetic regression then explicitly records unconfirmed assumptions for every required input, runs an actual WASM exploratory solve, and verifies0.04 mm displacement and provisional status. No human confirmation record is invented. Renumbered JSON faces and moved geometry are correspondence/unresolved-condition fixtures, not numerical evidence for modified real STEP files.

Legacy JSON lacking selection now accepts the raw revision advertised by studio_inspect_project; the published output revision matches its JSON. Aliased/hardlinked paths, existing output, stale input/replacement revisions and invalid pagination are refused. Unresolved changed-geometry conditions prevent analysis.

Live JSON replacements validate Float32 coordinates, cad kind, retained mesh properties and optional string name, refusing silent rounding/property loss before application. A browser-storage adapter regression verifies the committed revision. New CAD methods remain unverified in real-browser/public-HTTPS operation; saved-file real MCP/WASM evidence is distinct. Specialist SKILL and build validation passed.

All26 local-distribution checks also passed against the latest build in an isolated30.76-second run.

## 2026-10-14: revision-bound print-data API/MCP

The final print-API targets passed all 12 tests: eight core, one real MCP and three session tests. Core/import coverage including existing import tests passed 19 tests; integration/MCP/bridge coverage passed 11. Shared-API tests cover unloaded state, G-code import, unchanged document revisions after display changes, language-independent layer indices, isolated array pages and view restoration after rendering failure. Stale revisions, invalid data/fields, out-of-range pages, busy state and expired operations refuse changes and preserve existing data.

Real stdio MCP imports synthetic G-code and 3MF files, publishes exclusively to new JSON paths and verifies the complete snapshot hash. Tests check three G-code segments, two layers and a 600 mm/min feed, 3MF inch-to-mm conversion (1 inch = 25.4 mm), and paged triangles. Input/existing-output overwrite, original inputs over 50,000,000 bytes, corrupt 3MF and invalid saved JSON are refused. These are synthetic parser/contract references, not evidence of physical printer extrusion or material strength.

Default MCP has 24 tools; optional pairing has 26 tools/48 methods. The new print operations remain unverified in an actual browser UI and over public HTTPS; shared-adapter and saved-file MCP evidence is distinct. Build and specialist SKILL validation passed; all 26 local-distribution checks passed in 28.08 seconds.

The initial full suite reported 441 tests: 435 passed, three skipped and three failed. `analysis-job-service` stopped with the known V8 fatal error `jit_page_->allocations_.erase(addr) == 1`; its isolated rerun passed three tests, but the cause remains unresolved. Two `visual-export` tests failed to observe completion within 100 setImmediate waits. Only test waiting was changed to a five-second deadline with five-millisecond intervals; all eight isolated tests passed. Product export and solver code were not changed for this workaround. The full-suite retry passed 438 of 441 tests with three skips and zero failures at concurrency four in 65.88 seconds. RUNTIMEWASM1 continues to track the V8 failure conditions and cause. Shared print operations also treat an active GUI file read as busy to prevent competing asynchronous imports.

## 2026-10-14: GUI/shared analysis-job integration

Four GUI mesh/solve routes now use shared jobs, with cloned inputs, frozen SHA-256 revisions and completion-time canonicalJson comparison of the complete input snapshot. Changed inputs prevent GUI result return while preserving the successful job and its original result. The change adds eight-entry GUI history, cleanup restricted to terminal GUI jobs and inspect-scoped listJobs metadata discovery.

The full suite passed 445 of 448 tests with three skips and zero failures at concurrency four in 65.06 seconds. Complete-snapshot checking before return and one regression test were added afterward; all 16 final related tests passed. The full-suite result therefore does not represent a complete rerun including that final addition. Build and specialist SKILL validation passed. All26 local-distribution checks passed against the final build in an isolated27.93-second run.

Real stdio MCP, real HTTP, the shared connector client and a simulated Worker verify GUI origin/input-revision discovery, a provisional thermal frame probe of 35 °C, inspect scope, continued GUI execution after disconnect and completion retention. Core tests cover cancellation during pending SHA computation, input comparison, Worker cancellation, late replies, pruning eight GUI entries without releasing API jobs, the overall 32-job limit and refusal of invalid list pages. Simulated Worker values are not evidence of real solver accuracy. The new routes remain unverified in an actual browser UI and over public HTTPS.

The [WASM runtime investigation](wasm-runtime-investigation.md) records 36 successful tests across 12 fresh processes, plus three successful tests from one investigation-script run. These use different source revisions and are not combined as one test population. Failure to reproduce the known V8 stop does not establish its cause or resolution.

## 2026-10-14: shared catalog-application API

Version-bound catalog application is exposed through the shared API and the eighteenth saved/connected MCP edit operation. All 28 targeted tests passed; final full-suite, build and latest distribution-check results are not yet included.

The Codex in-app browser opened local Vite (http://127.0.0.1:5174), using a real browser Worker, Airpocket WASM CPU and real stdio MCP/HTTP connector. The structural reference used 171 nodes and 428 tetrahedra with minimum quality 0.632. At [5,5,40], displacement was 0.03999999999944816 mm and von Mises stress 999999.999983 Pa; the UI showed 0.040000 mm. listJobs retained GUI origin, input hash and 14 events including intermediate mesh/iteration information.

The thermal GUI ran three steps at 10-second intervals and exposed fields at 10/20/30 seconds. At [5,5,20], measured intermediate temperatures were 21.08744876473551 °C at 10 seconds and 26.132058877604514 °C at 30 seconds, retaining provisional:true. These are reference-input execution checks, not real-material calibration.

Catalog UI refused missing applicability in Japanese. Applying RTP105CC with explicit Poisson ratio 0.35 and applicability produced a read-only exported JSON matching all createCatalogMaterial properties, including conditions, missing fields and sources, without fabricated confirmation evidence. Switching Japanese/English labels preserved the same connected session ID. Stopping the connector displayed the new network guidance in both languages.

Saved evidence includes the [machine-readable record](../evidence/2026-10-14-gui-jobs-catalog.json), [structural UI](../evidence/2026-10-14-gui-structural.jpg), [thermal UI](../evidence/2026-10-14-gui-thermal.jpg) and [catalog UI](../evidence/2026-10-14-catalog-apply.jpg). Sources were b3e77ad plus this change. This verifies local connectivity; actual public-HTTPS-to-loopback pairing still failed with Failed to fetch. Browser security settings were unchanged.

The final contract resets existing evidence for `/material`, `/materialProperties` and child pointers to unconfirmed, clears assumptions to null and removes confirmation, even when numerical values match. Previous source/value/rationale/applicability, unrelated evidence and analysisIntent remain; no new confirmed evidence is generated. The GUI check above used an input without existing evidence and does not prove this added reconfirmation contract.

The initial full suite reported 458 tests: 454 passed, three skipped and one failed. The failure was missing Japanese/English reciprocal links in the WASM investigation documents; both document tests passed after link repair. Build passed. The final evidence change was verified by the runs below.

After the final provenance fix, all29 related tests passed; the full suite passed456 of459 with three skips and zero failures at concurrency four in67.31seconds. The final build also passed. All26 local-distribution checks passed against the final build in an isolated28.31-second run.

## 2026-10-14: chunked live print-data transfers

Six connector operations add chunked original G-code/3MF import and version 1 GUI JSON export. Tool counts remain 24 default/26 connected; the connector has 55 methods. Final targets passed 18 core tests (ten transfer and eight print) plus one real MCP protocol test. The full suite passed 467 of 470 tests, with three skips and zero failures, at concurrency four in 70.61 seconds. Build passed; all 26 latest distribution checks passed in 29.82 seconds.

Core tests cover revision/byte/hash/UTF-8 checks, sequential chunks and identical immediate chunk replay, retention, release/expiry and existing atomic import. A real stdio MCP/HTTP protocol test with a simulated browser handles Japanese input exceeding 500,000 characters and exports 4,000 lines across multiple pages. A valid-triangle 3MF in a noncompressed ZIP exceeding 65,536 bytes was also parsed in Node unit tests; this does not establish actual-browser handling of that 3MF.

The local Codex in-app browser (http://127.0.0.1:5174) and real MCP imported 658,111 bytes in 11 chunks, yielding 4,002 segments and two layers. Selecting layerIndex:1 showed Z=0.4; English Layer 2 and Japanese layer 2 retained the same index. The complete 664,735-byte GUI JSON was read in 11 pages, verified against its full hash and released. Saved evidence includes the [machine-readable record](../evidence/2026-10-14-print-transfer.json) and [UI screenshot](../evidence/2026-10-14-print-transfer.jpg).

This evidence does not cover maximum-size 50 MB input/100 MB retention load tests or peak-heap measurement. Public HTTPS connectivity remains unverified and is distinct from local actual-browser confirmation.

The 50,000,000-byte transfer limit does not relax parser limits: G-code remains capped at 25,000,000 characters and 200,000 segments; existing 3MF ZIP/triangle and other limits still apply. Actual-browser evidence at 658,111 bytes is not maximum-capacity verification.

After the full run, the protocol test was strengthened to624,106 characters/1,504,110bytes and passed in isolation. Actual MCP refused inline importPrint at the500,000-character limit without loading data, then accepted the same source through23 chunks. Product code was unchanged by this stronger test.

## 2026-10-14: combined case and named-view bundles

Tool counts are 25 default/27 connected, with 62 connector methods. The full suite passed 481 of 484 tests, with three skips and zero failures, at concurrency four in 72.46 seconds. Twelve bundle-core plus 20 existing named/result tests passed (32 total), as did two new MCP tests using the display-prepared SHA contract. The final build and all26 local-distribution checks also passed (28.41seconds).

References use SHA-256 of JSON-normalized display-prepared output from prepareCaseView(saved), not raw saved JSON. Legacy mesh.summary differences do not trigger automatic view remapping or physical archive changes. Resave views referring only to a raw revision after displaying the case. Contextual modal/transient checks are covered by unit tests, not actual UI verification of every result kind.

The local Codex in-app browser and real WASM produced a structural reference with 171 nodes and 428 elements; real MCP saved its case and named view. Settings included displacement range 0–0.05 mm, deformation scale 25, wire display, camera position [80,60,80], target [5,5,20], up [0,0,1], fov35, a Z=20 section and opacity0.7. The 208,374-byte bundle was exported in four MCP pages and matched the actual GUI download byte-for-byte and by SHA-256.

After clearing both lists to zero, a GUI file chooser imported the downloaded file and restored one case/one view with the same composite revision. MCP caseView/namedViewApply restored all settings by deepEqual and a 0.03999999999944816 mm point displacement. After UI reload to the default cylinder, importing the same file left current cylinder inputs unchanged; GUI 3D display and view restoration recovered deformation scale 25. Japanese/English state and labels were checked.

Saved evidence includes the [reference bundle](../evidence/2026-10-14-case-view-bundle.json), [proof record](../evidence/2026-10-14-case-view-bundle-proof.json) and [UI screenshot](../evidence/2026-10-14-case-view-bundle.jpg). Bundle physics came from synthetic reference inputs computed by real WASM, not real-material calibration. Public HTTPS, 100 MB limit load tests and actual GUI coverage of every result kind remain unverified.

## 2026-10-14: revision/display-bound measurement history

All 18 new targets passed: eight core tests, five physics kinds using real resultView, four session tests and one real stdio/HTTP test. A 299,000-UTF-8-byte archive boundary test produced a largest reply of 743,559 bytes. This checks archive/reply contracts within the 300,000-byte cap, not browser peak heap. Tool counts remain 25 default/27 connected with 68 methods. The full suite passed499 of502 with three skips and zero failures (concurrency4,73.33seconds). Build, all26 local-distribution checks (28.54seconds) and SKILL validation also passed.

The local Codex in-app browser and real stdio MCP/HTTP imported the existing real-WASM reference bundle `docs/evidence/2026-10-14-case-view-bundle.json` and displayed it using caseView. No new solve was run in this verification. At [5,5,40], displacement 0.03999999999944816 mm was saved to history. get/export/remove-to-zero/import-to-one/get preserved the complete record identically; stale archive revisions were refused.

Saved evidence includes the [machine-readable record](../evidence/2026-10-14-measurement-history.json) and [screenshot](../evidence/2026-10-14-measurement-history.jpg). The screenshot shows the displayed result/connector; no history GUI was added. Records freeze result revision, point, options, display, values and assessment. Import does not promote historical values to independently verified numerical evidence. Public HTTPS is outside this check.

## 2026-10-14: measurement recomputation against saved results

This change re-interpolates history from saved fields matching display-prepared result revisions and compares complete evidence. Tool counts are 26 default/28 connected, with 69 methods. The final full suite passed514 of517 with three skips and zero failures (concurrency4,68.83seconds). Build,26 local-distribution checks (28.57seconds) and SKILL validation passed. Agreement with saved results does not establish independent-solver or physical accuracy.

All 15 new targets passed (nine core, five host/session and one real MCP), including modal/transient context recomputation. Existing real-WASM-derived case/measurement archives verified one record through both the real stdio saved-file tool and a Node-hosted live adapter. See the [machine-readable record](../evidence/2026-10-14-measurement-verification.json). This check ran no new solve or actual browser test; it demonstrates recomputation agreement with existing saved fields.

A race where history changed while hashing the final exported snapshot was fixed. A synchronous host-internal archive match immediately before return rejects stale verification responses; a regression test covers this case. The internal function is not exposed through the window API or connector.

## 2026-10-14: measurement history in v2 bundles

Six new v2 core tests were added; all 35 bundle/history/named tests and two updated MCP tests passed. Tool/method counts remain 26/28 and 69. The initial V8 failure remains recorded below. Full-suite retry passed520 of523 with three skips and zero failures (concurrency4,68.23seconds). Build,26distribution checks (28.44seconds) andSKILL validation passed.

The local Codex in-app browser and real stdio MCP/HTTP restored GUI v2 import from 0/0/0 cases/views/measurements to 1/1/1, with measurementVerify:true and a 0.03999999999944816 mm point displacement. The actual 209,414-byte GUI download matched all bytes from four MCP chunks. GUI v1 import cleared history to 1/1/0; reimporting the downloaded v2 restored 1/1/1 and the same composite revision.

Current default-cylinder inputs and their revision remained unchanged during import. Subsequent MCP caseView/namedViewApply restored the saved result and deformation scale25. Japanese/English labels, imported counts and the legacy-history-clear explanation were checked. Existing real-WASM saved fields were used; no new solve was run.

Saved evidence includes the [proof record](../evidence/2026-10-14-case-view-measurement-bundle-proof.json) and [screenshot](../evidence/2026-10-14-case-view-measurement-bundle.jpg). The record source field identifies two existing archives from which raw v2 is reconstructible, avoiding duplicated raw storage. This establishes recomputation agreement with saved fields, not independent-solver/physical accuracy, public HTTPS or maximum-capacity behavior.

### 2026-10-14: recurring V8 stop during v2 bundle validation

The first full suite reported 518 tests: 514 passed, one failed and three skipped in 68.639 seconds. Node v24.11.1/V8 again stopped with the known fatal `jit_page_->allocations_.erase(addr) == 1`, failing the `tests/material-catalog.test.mjs` process. An isolated rerun of that file passed seven tests in 2.945 seconds. This does not establish root-cause resolution; RUNTIMEWASM1 remains unresolved.

The [machine-readable recurrence evidence](../evidence/2026-10-14-wasm-material-catalog-failure.json) preserves trace, Node/V8 environment, source hashes, initial results and the isolated retry. The full-suite retry passed520 of523 with three skips and zero failures in68.23seconds. Both runs remain recorded andRUNTIMEWASM1 remains unresolved.

## 2026-10-14: WASM diagnostics and Worker exit ownership

Diagnostic CLI now selects target/runtime/concurrency and checkpoints; headless completion settles after Worker termination. Shared-job cancellation terminal state may precede resource release. v24.19.0 is not a fixed control; an official-hash-verified portable v26.10.0 under .qa is the comparison runtime. See the [investigation](wasm-runtime-investigation.md) for details/primary sources. Final tests/comparisons are recorded below; V8 root-cause resolution is unproven.

## 2026-10-14: identical-source comparison after ownership repair

Source fingerprint: `f5baf41cf567a5adb08d84229b84a44f2c0018abb1dfff2aa88d6e863594b595`. The same 128 test files ran at concurrency four in two fresh processes per runtime. Node v24.11.1 passed 538 of 541 tests with three skips and zero failures in each run (wall68,083/69,192 ms; test67,986.382/69,098.2428 ms). Node v26.10.0 passed identical counts (wall163,283/161,887 ms; test161,603.2054/160,084.9643 ms). The known native fatal did not reproduce in any of four runs.

All comparisons used the ownership repair; there is no pre-change full-suite control under identical conditions. Node26 was slower in this observation, but cold start/security/cache were uncontrolled: this is not a product performance benchmark or causal proof that a particular V8/ownership correction resolved the stop. Default Node remains unchanged and RUNTIMEWASM1 remains unresolved.

Saved evidence includes the [comparison summary](../evidence/2026-10-14-runtime-comparison.json), [Node24 report](../evidence/2026-10-14-runtime-node24-full.json) and [Node26 report](../evidence/2026-10-14-runtime-node26-full.json). The [deterministic FakeWorker before/after record](../evidence/2026-10-14-headless-worker-ownership.json) shows old settledBeforeExit:true versus new false, with terminateCalls:1 in both. It proves the exit-wait ownership contract, not native WASM crash reproduction.

All 18 new targets passed (12 lifecycle and six diagnostic CLI tests), as did ten real related tests. Build,26 local-distribution checks (27.87seconds) and SKILL validation passed.

## 2026-10-14: tracking execution settlement

Targets include executionSettled/resourceState and resource-state events, terminal/resource-exit distinction, pending release refusal and retained capacity/idempotency, plus drain waiting for a current-pending snapshot. Final implementation/tests remain under verification. This resource-ownership contract is separate from V8 root-cause resolution.

The final contract uses resourceState:pending|settled and releaseAllowed, never released. Settlement means executor Promise completion, not OS-exit confirmation for void browser termination. Terminal-late rejection is recorded separately as executionError without classifying Abort versus cleanup failure. Service drain/closeAsync and normal MCP EOF waiting are also targeted.

The 15 new targets (six browser settlement, seven core and two MCP tests) cover void/asynchronous termination, active ownership/late-reply handling, creation-time abort, GUI waiting/safe history pruning, capacity/idempotency/releaseAllowed after cancel/timeout, and drain/closeAsync/normal EOF waiting. Final source review and actual-UI checks completed.

The six browser tests additionally preserve cleanup rejection with five falsy values as failure, refuse new exports during global pending execution and retain retry behavior for existing exports. In the local Codex in-app browser, a cylinder mesh at size2 was started and cancelled through the GUI. Real MCP reported executionSettled:true/resourceState:settled/releaseAllowed:true; the earlier cancellation event was false/pending, with exactly one resource-state event. MCP release succeeded, followed by a successful GUI mesh of 3,480 nodes and 16,248 tetrahedra.

Saved evidence includes the [machine-readable record](../evidence/2026-10-14-job-settlement-browser.json) and [screenshot](../evidence/2026-10-14-job-settlement-browser.jpg). The first short mesh finished successfully between list and cancel; it was not counted as successful cancellation. GUI cancellation supplied the final check. This verifies early native-Worker cancellation, not direct OS exit or that WASM arithmetic began before cancellation. Full suite: 553 passed and three skipped of 556 (67.82s). The existing MCP test now waits for settlement before release. Build, 26 distribution checks (28.46s) and SKILL validation passed. The known V8 fatal did not recur; this does not prove its root cause is fixed.
