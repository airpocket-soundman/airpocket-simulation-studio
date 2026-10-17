# One local MCP-only linear-bar loop

This recipe uses explicit synthetic assumptions for workflow evaluation, not measured design data. Use it only with authorized localhost mutation permissions and preserve the actual user's physical intent. Never use this recipe against the public HTTPS page. A bounded revised run was completed on 2026-10-18; see the [evaluation evidence](../../../docs/evidence/2026-10-18-skill-loop-real-mcp.json). A fresh independent evaluation of these instructions remains uncompleted.

## Entry and connection

Start the local application from the repository directory. Install dependencies with `npm ci` if absent, then run `npm run build` once to prepare its geometry/kernel assets. In one terminal run `npm run dev -- --port 5174 --strictPort` and open `http://127.0.0.1:5174/?lang=en` in the standard browser. Keep that terminal running. If the port is occupied, stop and choose an unused localhost port explicitly; use that same port in both the browser URL and MCP origin.

In a second terminal, the full stdio entry is `node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174`. Connect the MCP client to that process as described in [browser session](browser-session.md) and [saved inputs](saved-inputs.md). Its stderr provides the local pairing endpoint and temporary code; stdout is MCP protocol only. Enter the endpoint/code in the app's connection panel and grant the four scopes for this synthetic local evaluation. Do not save credentials in a URL or transcript. At the end disconnect in the app, close MCP stdin and stop only the development server started for this evaluation.

Discover actually exposed tools. Current repository declares 31 default / 33 paired tools and 91 browser methods; declarations do not activate a registered tool. Prefer the registered `studio_browser_call` and `studio_browser_contracts`; if unavailable, use the Skill's documented local `callStudioTool` fallback with one retained process. State which environment was used. No direct window calls, raw CDP, custom QA bridge, fixture JSON import or source-private methods qualify as this evaluation.

Pair on localhost using explicitly selected inspect/edit/analyze/view permissions. Pairing is the prerequisite human GUI action, not part of the automation claim. Keep connection credentials out of transcripts and artifacts. After pairing, all project operations below must use MCP only. Preserve the exact returned `sessionId`.

Every live envelope is `studio_browser_call({sessionId,method,args})`. Request `studio_browser_contracts({method})` for the one next operation when its schema is unknown. Do not enumerate unrelated catalogs. Inspect capabilities only to select a supported execution path.


MCP tools/call may return structuredContent:{value:<semantic response>} (or JSON text containing that wrapper). Unwrap value once before reading revision, jobId or descriptors. Errors are structured {error:{code,message}}; preserve those fields instead of converting the object to a string.

## 1. Create explicit input

Call `inspect {}`. Save its revision R0, lifecycle and browser metadata. Call:

```json
{"method":"createBuiltinProject","args":{"expectedRevision":"<R0>","name":"Skill loop synthetic axial bar","source":{"kind":"box","bounds":[0,0,0,10,10,40]}}}
```

### Reconstruct the existing study before setStudy

Retain the createBuiltinProject response revision as R1. Read inspectInput({section:"study",pointer:"/study",expectedRevision:R1,offset:0,limit:50}). If descriptor owns value, use that exact scalar/null value, including false and0. Otherwise:

1. For object/array pages, read entries and continue from page.nextOffset until null. Keep the same expectedRevision on every request; reject a stale read.
2. An entry owning value is exact. For omitted nested object/array/string, recursively request its absolute pointer inside the same section. Decode object member keys with RFC6901 ~1→/ and ~0→~; array keys are numeric indices, not insertion-order guesses.
3. Strings lacking descriptor.value must be assembled from page.text using returned offsets until nextOffset=null. Offsets are UTF-16 units, not bytes. Do not assume an omitted value is empty.
4. Check descriptor keyCount/length against the reconstructed value. Keep the original JSON type. If any response cannot be reconstructed from this documented contract, stop and report the specific pointer instead of importing a fixture or reading private application state.
5. Merge only {kind:"structural",gravityEnabled:false} into the reconstructed study. Retain all other observed settings. The initial minimal replacement caused43 added normalization pointers. The revised preview had changedPointers.total0 and requiresReviewfalse; this difference is recorded in the linked evaluation evidence.

The tested fixture fit a single object page plus recursive small array pages. Multi-page nested strings were not exercised by this particular loop; that algorithm is the existing paging contract, not additional evidence.


With returned revision R1, first reconstruct the observed current study via the bounded-pointer algorithm above; keep inactive host settings rather than replacing the study with a minimal object. Use the reconstructed study merged with the explicit overrides kind=structural and gravityEnabled=false as the setStudy payload. Then preview and commit this batch (`previewEdit {expectedRevision:R1,operations}` then `edit {expectedRevision:R1,expectedResultingRevision:preview.revision,operations}`). If normalization.requiresReview is true, review its changed pointers before commit; do not copy a candidate revision across Node/browser targets.

```javascript
[
 {"method":"setMaterialProperties","args":[{"youngModulus":1000000000,"poissonRatio":0}]},
 {"method":"setStudy","args":[{...observedStudy,"kind":"structural","gravityEnabled":false}]},
 {"method":"selectPlanarRegion","args":[0,{"axis":2,"position":0,"min":[0,0],"max":[10,10]}]},
 {"method":"addCondition","args":[{"type":"fixed"}]},
 {"method":"selectPlanarRegion","args":[0,{"axis":2,"position":40,"min":[0,0],"max":[10,10]}]},
 {"method":"addCondition","args":[{"type":"force","value":100,"direction":[0,0,1]}]},
 {"method":"setAnalysisIntent","args":[{"mode":"exploratory"}]},
 {"method":"setInputProvenance","args":[{"schemaVersion":1,"entries":[]}]}
]
```

Units: geometry/mm, E/Pa, force/N, Poisson ratio dimensionless. Explicit assumptions: synthetic linear isotropic material, zero Poisson ratio, entire z=0 face fixed, total axial force on z=40, no gravity; no measured calibration. Expected analytical displacement is FL/(EA) = 0.04 mm. That reference tests this idealized axial fixture, not general geometry accuracy.

## 2. Diagnose and repair evidence without inventing confirmation

Call `preflight {options:{size:5,method:"pcg-strict"},context:{target:"browser",operation:"solve",mode:"exploratory"}}`. First verify this method is actually supported by current capabilities; use no GPU assumptions. Expect missing provenance with `allowed:false`; save the refusal.

Construct one provenance entry for each `PROVENANCE_REQUIRED` diagnostic using exactly its `target` and `evidence.value`. If a value is missing/omitted, inspect that exact pointer through `inspectInput` with the same revision; never infer a value. Do not turn other diagnostics into assumptions. Entry shape:

```json
{"pointer":"<diagnostic.target>","value":"<exact JSON evidence.value, preserving its actual type>","source":{"kind":"agent-proposal"},"rationale":"Explicit synthetic axial reference input for this workflow evaluation","applicability":"Only the 10x10x40 mm homogeneous axial bar; no measured material calibration","assumption":"Explicit unverified synthetic workflow assumption","status":"unconfirmed"}
```

Set `{schemaVersion:1,entries:[...]}` through `setInputProvenance` in preview/commit using a fresh inspected revision. Do not supply user confirmation. Re-run preflight. Require allowed=true, provisional=true, completePreflight=false and no blocking diagnostic. If not, stop and repair only the documented issue. Record remaining physical and convergence checks.

## 3. Mesh and inspect before solving

Use the current inspected input revision R2:

```json
{"method":"startJob","args":{"inputRevision":"<R2>","requestId":"<new run ID>-mesh-A","operation":"mesh","options":{"size":5,"method":"pcg-strict"}}}
```

Poll `jobStatus {jobId}` and paged `jobEvents {jobId,afterSequence:0,limit:20}` (discover cursor schema first; use the returned cursor). Wait for succeeded AND executionSettled:true; inspect failure otherwise. Call `meshBoundaryPreflight {jobId,inputRevision:R2}`. Require allowed=true, finite meshQuality, appropriate rigid-body constraints, transferred area and no missing-anchor errors. completePreflight stays false. This inspection must not change input or retained mesh. Do not release the mesh job before the inspection. Then `releaseJob {jobId}`.

## 4. Solve, observe and save case A

Start solve with the SAME current R2, a fresh requestId `<run>-solve-A`, `includeFields:true`, options size5/pcg-strict and operation solve. Read `jobStatus`, `jobEvents` and `jobArtifacts {jobId,offset:0,limit:20}`. Fetch one returned intermediate artifact with `jobArtifact {jobId,artifactId,pageKind:"nodes",offset:0,limit:1}` only if available. Zero iterations or absent snapshots are legitimate; record absence rather than claiming an intermediate field.

Wait for succeeded and executionSettled:true. `showJob {jobId,name:"Synthetic axial 100 N"}` already adds a saved case: do not append a duplicate using caseSave. Call `getResultView {}`; retain its resultRevision. Probe `{point:[5,5,40],expectedResultRevision:<returned>}`. Verify axial displacement near0.04mm and inherited exploratory/provisional status. List cases and retain exact caseId/revision. Only then release the solve job. Save user-requested outputs through the documented artifact routes; do not infer filesystem paths from job identities.

## 5. Adjust only the declared load and solve case B

Inspect fresh revision and preview/commit:

```json
[
 {"method":"removeCondition","args":[1]},
 {"method":"selectPlanarRegion","args":[0,{"axis":2,"position":40,"min":[0,0],"max":[10,10]}]},
 {"method":"addCondition","args":[{"type":"force","value":200,"direction":[0,0,1]}]},
 {"method":"setInputProvenance","args":[{"schemaVersion":1,"entries":[]}]}
]
```

This deliberately resets only the synthetic current input's evidence so the diagnostic-derived documentation is regenerated for the200N fixture. Case A retains its frozen100N input/evidence. Repeat sections2–4 with new request IDs and name `Synthetic axial 200 N`. Keep E/nu/support/geometry/mesh settings identical. Expected axial displacement0.08mm; no automatic physical optimization or hidden material changes.

## 6. Compare and export, then verify integrity

Read `caseList {}` again. Construct two exact references from the actual list, never from stale indices:

```json
{"method":"caseCompare","args":{"references":[{"caseId":"<A>","expectedRevision":"<A revision>","field":"displacement"},{"caseId":"<B>","expectedRevision":"<B revision>","field":"displacement"}],"point":[5,5,40]}}
```

Require like-for-like units/physical kind and expected2x displacement; numeric compatibility does not establish physical validity. Save baseline `getResultView`, `inspectInput`, `caseList`, `getCompareView` for output non-destruction. Check `exportCapabilities {}` then:

```json
{"method":"startCompareExport","args":{"requestId":"<run>-compare-png","references":[{"caseId":"<A>","expectedRevision":"<A revision>"},{"caseId":"<B>","expectedRevision":"<B revision>"}],"field":"displacement","deformScale":100,"format":"png"}}
```

Poll `exportStatus {jobId}`. For completed output fetch `exportArtifact {jobId,offset:0,length:65536}` and continue via returned offset until totalBytes. Base64-decode all chunks, SHA-256-verify against metadata; save PNG and manifest to the explicitly authorized output folder. Confirm original four baseline inspections are unchanged. `releaseExport {jobId}` after verified retrieval.

For case persistence use `caseArchiveExport {}` / `caseArchiveRead {transferId,offset,length}` and verify complete archive SHA, then `caseArchiveRelease {transferId}`. Do not claim a case is durable merely because it appears in memory. Explicit GUI Disconnect is connection teardown outside the MCP-only project-operation claim; afterwards use studio_browser_sessions and require sessions=[] before ending the stdio MCP server. Alternatively close the MCP transport/server using its documented EOF lifecycle, recording termination rather than claiming a post-shutdown sessions RPC.

## Refusal/repair checkpoints

A stale edit revision must refuse without changing input. A deliberately out-of-domain probe must refuse, followed by the valid tip probe. A repeated retained request with changed arguments must conflict. Timeout is uncertain delivery: inspect lifecycle with previousLifecycle identity triple and input revision, inspect jobs/status, then decide; never repeat a mutation automatically. A new pageInstanceId means page-reset, not proof of V8/extension cause. Never upgrade public permissions.

## Observed bounded result of this recipe

Real Chrome155.0.0.0 reported reduced precision (full installed version unverified), browser Web Worker JavaScript CPU pcg-strict, size5mm. Both meshes94nodes/218tet/4000mm³. Tip100N=0.04000000000002636mm, 200N=0.08000000000005272mm, exact numerical ratio2. Use absolute tolerance1e-8mm for this reference fixture; no general error bound follows.

Comparison PNG1280×640,84081 bytes, SHA256 2623ba20d14c8627626e13b5d597c77e796e173d488dbd0efbc9964c8d6906b1. Case archive241550bytes, SHA256 e63135d4d47d4e7d6dbed4d6d538e9fda78ae0b97331e0305329626faa20c515. Exact input/view/cases/panel equality after output. Stale edit, outside probe and changed retained request all refused. All jobs/export/transfer released.

Two instruction gaps were repaired during execution: unwrapping MCP value before using response fields, and preserving the complete observed study before setStudy instead of replacing it with a minimal object. The author adapted the first draft during this run. This demonstrates a revised real-MCP loop and captures the gaps; it does not yet prove a fresh independent agent can follow the final prose unaided. Perform that independent pass before declaring Skill-only acceptance complete. P0/P1/P3/P4 project scopes are not declared complete by this evaluation. Runtime source was 8c57e16750efe3f90aa588bebc3cf127828204df with no tracked dirty files; ignored QA artifacts were present. The recipe used here was revised during execution, not the untouched initial draft.

An independent attempt found the missing local-app startup command,now included above. It reached local app/MCP startup and tool discovery,but GUI target-URL verification blocked pairing on Windows; no product operation occurred. See [independent attempt](../../../docs/evidence/2026-10-18-skill-loop-independent.json). This attempt does not establish independent end-to-end acceptance.
