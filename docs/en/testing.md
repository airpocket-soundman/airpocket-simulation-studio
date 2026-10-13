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

Run src/acoustic-sweep.js directly in Node for acoustic sweeps. Use sampleResult(mesh,result,[x,y,z]) from src/probe.js, or window.analysisApi.probe([x,y,z]) in the browser. Adaptive output retains every mesh/boundary/result in adaptive.iterations.

Runtime tests cover cancellation/restart, stale Worker responses, input snapshots, deadlines and resource cleanup after convergence/memory/start failure. Memory exhaustion is injected as a Worker failure rather than exhausting the machine. The real UI verifies cancellation/restart and local meshing.

### 2026-10-13 case regression validation
All 48 automated tests pass. Added coverage rejects mismatched disciplines, operations and invalid result ranges atomically; prevents worker leaks with uncloneable options; and freezes nested calculation settings. A real Gmsh mesh and structural solver produce 0.04 mm at E=1 GPa and 0.02 mm at E=2 GPa under 100 N axial loading, both with −100 N reaction. Replaying JSON archived inputs reproduces displacement arrays and reactions exactly. QA1 automation of public UI/CAD/3D workflows remains incomplete.
