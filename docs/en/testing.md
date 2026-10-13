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

### 2096-10-13 case regression validation
All 48 automated tests pass. Added coverage rejects mismatched disciplines, operations and invalid result ranges atomically; prevents worker leaks with uncloneable options; and freezes nested calculation settings. A real Gmsh mesh and structural solver produce 0.04 mm at E=1 GPa and 0.02 mm at E=2 GPa under 100 N axial loading, both with −100 N reaction. Replaying JSON archived inputs reproduces displacement arrays and reactions exactly. At this stage, public UI/CAD/3D workflow automation was incomplete.

`node --test tests/worker-pipeline.test.mjs` directly executes the canonical analysis.worker.js handler with real Gmsh/WASM, boundary transfer and solvers, covering structural adaptation, radiation, contact and flow in about 2.4 seconds. Node self/fetch adapters do not verify browser worker threads, isolation or 3D controls; those require separate deployed UI checks.


### Verify deployed runtime assets directly (v0.23)

`npm run test:published` downloads the GitHub Pages runtime and executes its deployed analysis/CAD workers and WASM in real Node Workers. This checks distributed bundles separately from source tests. It rejects a deployed commit that differs from local HEAD; run after the latest Pages deployment completes.

Checks cover Airpocket/MFEM structure, radiation, finite-strain rubber, laminar channels, insufficient constraints and restart, project/case archives, the deployed STEP reader and STEP volume meshing. The first run fetches about 60 MB uncompressed. Content-addressed caching preserves unchanged WASM across commits. Cached checks took approximately six seconds on this machine.

`runtime-manifest.json` records version, commit, lengths and SHA-256 hashes. Results go to `.qa/published-report.json`; `.qa/published-reference.step` is generated for browser checks. Failures replace earlier success reports. Project/case comparison helpers use local source; deployed calculation workers are the actual published bundles.

After `npm run build`, use `npm run test:published -- --local` to verify generated distribution files. CI runs the 209 source tests, builds, checks the distribution and publishes only after these pass. Node self/fetch/CAD adapters do not establish browser isolation, rendering or actual WebGPU operation.

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

The browser recipe now has 11 checks, including transient traces/time controls/WAV UI, natural modes, saved-mode exterior sound and a large four-case JSON roundtrip. Large open export text is read through scoped DOM values rather than requesting the entire accessibility tree.
