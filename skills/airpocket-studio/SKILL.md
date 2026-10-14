---
name: airpocket-studio
description: Analyze saved Airpocket Simulation Studio projects, inspect validated cases and point measurements, and export model/result images or animations. Use for this application, not general CAD editing or unrelated FEM software.
---

Specialize the user's own LLM as a CAE agent; this application does not supply a proprietary AI subscription. Use the local `airpocket-studio` MCP server for saved JSON projects. The checkout normally lives at `D:/github/airpocket-soundman/airpocket-simulation-studio`; reuse its actual location if different.

- `studio_capabilities`: discover actual Node engine methods, candidate status, units and optional connector/export limits before choosing an execution path. Browser capability metadata does not prove a GPU adapter is available.
- `studio_diagnose_execution`: inspect a saved project for unsupported method/study/material combinations before solving. Stable codes and suggestions support repair, but `completePreflight:false` means units, physical inputs, constraints and mesh still need validation. Do not interpret an empty list as a safe or accurate model.
- `studio_progress`: implemented scope and outstanding tasks. Released features still have limits; consult corresponding `docs/*.md` when changing physics or constitutive models.
- `studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})`: validate saved inputs, inspect study/conditions and get compact dimension bounds. Explicit `meshIndex` requests face candidates (default 20, maximum 50) with area/centroid/bounds/normals and SHA-256 `displayMeshRevision`. Select a candidate through batch `selectCadFace(mesh,faceId)`. Face IDs belong to this display-mesh revision, including STEP; STL triangles/remeshed tags are not persistent CAD identities. Do not infer exact surface types. Prefer the user's project; do not silently substitute a demo or invent material properties.
- `studio_edit_project`: atomically edit an existing saved project into a new `outputPath`. Use `revision` from `studio_inspect_project` as `expectedRevision`, with `operations:[{method,args}]` (1–100 commands). Supported selection, condition, material, study, mesh, `setInputProvenance(document)` and `setAnalysisIntent({mode})` methods are listed in `docs/automation.md`; `args` uses each method's positional arguments. Stale revisions or failed commands reject the batch. Inputs and existing outputs remain intact. Required-input/provenance contracts do not cover every physical model.
- `studio_import_project({path,outputPath,scaleToMm?,name?})`: import STEP/STP through OCCT with mm normalization and preserved CAD-face mapping; STL requires explicit positive `scaleToMm` and the supported closed outward convex shell. Input limit: 50 MiB. Save to a new JSON path.
- `studio_create_builtin_project({source,outputPath,name?})`: create explicit mm-based box, boxes, fixed cylinder, sphere or tube geometry without inventing material values or boundaries. Read `docs/automation.md` for source parameters.
- `studio_preflight_project({path,method?,operation?,mode?})`: obtain required pointers and repair diagnostics before execution. `completePreflight:false` preserves the need for post-mesh and physical validation. Execution is gated by the same inspection.
- `studio_analyze`: same CPU Worker as the browser. Supply absolute `path` and a new `outputPath`, mesh `size` in mm and optional CPU `method`. Existing outputs are refused. The response contains metrics; the file contains mesh, input, result and calculation settings. Node execution does not verify browser/GPU behavior.
- `studio_start_analysis`, `studio_job_status`, `studio_job_events`, `studio_cancel_job`, `studio_release_job`: asynchronous CPU jobs with frozen input, bounded observations and optional provisional field artifacts. Use these for monitoring rather than blocking `studio_analyze`. See the workflow below.
- `studio_job_artifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})`: inspect a registered intermediate artifact with hash/input/mesh checks. Default to summaries; request point interpolation in mm or pages of up to 200 nodes/values when needed. It does not accept arbitrary paths, and released jobs lose their artifact registration.
- `studio_probe`: measure a saved analysis at `point:[x,y,z]` in mm. Fields carry physical units; outside points are refused. Specify the element to disambiguate multiple bodies. Saved results are validated first.
- `studio_validate_cases`: validate case archives and return comparison metrics.

Case/result validation recomputes assessment mode/provisional status from saved inputs and rejects archives that falsely remove provisional status. Old archives without assessment retain compatibility. CAD updates reset existing evidence entries to unconfirmed, clear assumptions and user confirmation; recheck regions and evidence before solving. The edit batch supports 18 methods; Default MCP exposes 27 tools; connector mode exposes 29.

If MCP tools have not loaded in the current chat, import `callStudioTool` from `scripts/studio-mcp.mjs` using a short Node script or the persistent Node tool. `npm run mcp` starts a protocol server, not an interactive shell. A fresh clone needs `npm ci` and `npm run build` to prepare WASM assets.

Prefer the optional MCP connector for implemented live result/case operations; use documented browser tools for remaining visual operations. Default MCP operates on saved files; the optional connector below invokes permitted browser operations. In **Save images and animations / 画像・アニメーションを保存**, choose surface, surface triangles, internal mesh and clipping before PNG/WebM export. Types: orbit, deformation cycle, stored transient acoustic frames, moving section. Check saved artifacts. Deformation cycles are visualization, not a loading/unloading solve; video time may differ from physical time.

Read `docs/automation.md` and `docs/visual-export.md` in the checkout for setup and limits. Preserve material provenance. Do not infer measured S-N curves or strengths from names. Distinguish solver residuals from physical accuracy and finite-box Stokes drag from infinite-domain sphere references.

- `studio_material_catalog`: search 91 preinstalled polymer references by family/filler/content or retrieve by id. Read `docs/polymer-library.md`; distinguish published tensile modulus from flexural modulus, user-assumed Poisson ratio, missing data and experimental formulations. Do not present the displayed 0.35 as a published measurement.

For iterative work, explain which inputs came from the user or measured sources and which remain assumptions. Confirm missing physical support/load/material information instead of making the model solvable by changing the intended physics. Preserve the input/result version and compare like-for-like cases.

The new `quantitative`/`exploratory` input contract covers static isotropic linear structure, thermal conduction, acoustic waves and supported channel/exterior Stokes flow; other study/material combinations may return `PREFLIGHT_CONTRACT_LIMITED`. Old projects without intent/evidence stay `legacy`, which waives new evidence registration but never fills missing material properties or certifies quantitative inputs. Missing solver-required Young's modulus, Poisson ratio or other properties still cause `MATERIAL_REQUIRED`. Old inputs with no gravity specification use zero gravity. Use the preflight report's `requiredPointers` rather than guessing which evidence is required. Store each exact value at its JSON Pointer in `project.inputProvenance={schemaVersion:1,entries:[{pointer,value,source:{kind,reference?,revision?},rationale,applicability,assumption:null|string,status:"confirmed"|"unconfirmed"}]}`. Sources distinguish user input, measured documents, CAD and agent proposals. Documents/CAD require a reference and revision; confirmed agent proposals also require `confirmation:{by:"user",note}`. LLM confidence is not physical evidence. Value changes invalidate old evidence. Quantitative runs reject unconfirmed required inputs; exploratory runs require an explicit value and assumption and retain provisional status. Successful preflight is not complete physical validation: mesh quality, transferred regions and constraint rank still need checks after meshing.

For iterative jobs:

1. Check capabilities, execution diagnostics and `studio_preflight_project` for the installed version. Inspect the saved input and missing physical assumptions. For a new quantitative/exploratory run, use `studio_edit_project` to set intent and evidence for every returned `requiredPointer`, then repeat preflight until `allowed:true`. Preserve actual sources and declared assumptions.
2. Start with absolute `path`, new `outputPath`, and a unique `requestId`. Retain `jobId` and `inputRevision`. An identical retry returns the same retained job; changed input/settings/output require a new request ID.
3. Poll `studio_job_events` at a frequency useful for the computation, passing the returned `nextSequence` as `afterSequence`. Drain pages while `hasMore`; `truncated` means observations were dropped. Empty pages do not mean completion: check `studio_job_status`.
4. Review summaries and needed artifacts through `studio_job_artifact`, `studio_job_artifacts`, matching job/input revision. `includeFields:true` writes provisional mesh/time fields under a new `outputPath + ".intermediate"` directory. Field files reference their saved corresponding mesh through `meshArtifact`. The default total is capped at 64 MB; an `observation-limit` event means summaries continue without further field storage.
5. Check terminal status and the final artifact before comparing results. Never treat provisional or unconverged observations as final validated physics. Inspect the next input's revision, use `studio_edit_project` to save intended setting changes to a new path, then start a new run with that path and a new request ID. Do not substitute a job's `inputRevision` for the inspected edit revision: normalization can make them differ. Do not modify a running job or silently change supports, loads, material or other physical intent to obtain convergence. Preserve the user's intended physics and request missing physical information when needed.

Default mode exposes 27 tools; connector mode exposes 29. Saved `output.analysisAssessment` and `result.analysisAssessment` retain input mode, assumptions/provisional status and remaining checks. `job.final:true` means publication completed; `job.provisional` can remain true for assumed inputs. Do not equate a saved final artifact with verified physics. Job metadata/events and request IDs live only in the same MCP/Node process (default 32 jobs, 256 events each); retain that process for direct Node calls. Release jobs only after terminal state and executionSettled:true (resourceState:"settled") to free retention slots; saved files remain, and a released request ID can execute again. Cancellation stops `running` jobs, but final file publication in `saving` cannot be cancelled. Computation times out after 120 seconds by default; restart recovery is unsupported. Intermediate observations depend on the solver and do not cover every iteration or field. Browser jobs provide summaries by default; includeFields:true retains bounded in-memory artifacts through the connector. See `docs/automation.md` for contracts and limits.

## Live browser connector

Start this MCP process with `--browser-origin=<exact page origin>`. Read endpoint/code from stderr; have the user grant intended scopes in **Connect your own LLM**. Never enable browser permissions or widen scopes silently. Only inspect is selected by default. Keep the code out of URLs, commits and project JSON. Connector mode exposes 29 tools; default mode exposes 27.

Use `studio_browser_sessions` to identify the paired session, then `studio_browser_call({sessionId,method,args})`. The connector exposes 80 methods: `inspect`, `inspectSurface`, `applyCaseSource`, `clearCaseSource`, `prepareFluidDomain`, `applyFluidDomainMesh`, `inputImportBegin`, `inputImportWrite`, `inputImportCommit`, `inputImportRelease`, `createBuiltinProject`, `geometry`, `preflight`, `edit`, `startJob`, `listJobs`, `jobStatus`, `jobEvents`, `jobArtifacts`, `jobArtifact`, `cancelJob`, `releaseJob`, `showJob`, `probe`, `getView`, `setView`, `getResultView`, `setResultView`, `caseList`, `caseSave`, `caseView`, `caseRestoreInput`, `caseRename`, `caseRemove`, `exportCapabilities`, `startExport`, `exportStatus`, `exportArtifact`, `cancelExport`, `releaseExport`, `namedViewList`, `namedViewSave`, `namedViewApply`, `namedViewRemove`, `namedViewExport`, `namedViewImport`, `caseArchiveExport`, `caseArchiveRead`, `caseArchiveImport`, `caseArchiveWrite`, `caseArchiveCommit`, `caseArchiveRelease`, `evaluateAssessment`, `getAssessment`, `previewCadUpdate`, `applyCadUpdate`, `printInspect`, `importPrint`, `getPrintData`, `setPrintView`, `printTransferExport`, `printTransferRead`, `printTransferImport`, `printTransferWrite`, `printTransferCommit`, `printTransferRelease`, `caseBundleList`, `caseBundleExport`, `caseBundleRead`, `caseBundleImport`, `caseBundleWrite`, `caseBundleCommit`, `caseBundleRelease`, `measurementList`, `measurementGet`, `measurementSave`, `measurementRemove`, `measurementExport`, `measurementImport`, `measurementVerify`. Read revision before edit; pass expectedRevision and the same 18 semantic operations. Use the refreshed revision as inputRevision and supply requestId for startJob. Observe terminal state and events before showJob; stale input refuses display. Probe results carry provisional assessment. Basic view settings cover sections/opacity/parts. Result cameras use getResultView/setResultView below; image/video export uses the jobs described below.

Disconnect cancels connection-owned jobs. Restart recovery is unsupported; optional browser field retention is described below. Public HTTPS-to-loopback connectivity/permissions remain unverified. Commands time out after 15 seconds: inspect before retrying mutations. See `docs/automation.md` for scopes and contracts.

With `includeFields:true` on a browser startJob, read `artifact.artifactId` from jobEvents and call `jobArtifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})`. Keep pages <=200; request summary/point instead of downloading complete arrays. Mesh/field hashes, input revision, units and physical seconds or load-step metadata are checked; intermediate values always remain provisional even after the job succeeds. Default shared serialized retention is 64 MB, not a heap-memory guarantee. Limits preserve summaries; malformed observations emit observation-error. Release retained jobs only when releaseAllowed:true (terminal and executionSettled:true) to return their retention allocation. Thermal/transient-acoustic scalars and plasticity/hyperelastic step displacement vectors are supported; other solvers may provide stage/iteration summaries only.

## Result views and saved cases

Prefer paired semantic MCP operations for implemented views/cases and the export jobs below for PNG/WebM. `getResultView` returns resultRevision, supported fields/display units and paged stored modes/times (limit <=50). `setResultView({expectedResultRevision,settings})` supports field/layers, nonnegative deformScale, camera position/target/up/fov, modeIndex, frameIndex or exact stored timeSeconds, and `{field,minimum,maximum}` colorRange (null = automatic). Use reported units: stress is displayed in MPa, temperature in degC. A different field resets automatic colors unless its new range is explicit. Capture/reapply state as JSON; case archives do not persist it automatically.

`probe` accepts optional expectedResultRevision and measures the displayed stored frame/mode, returning identity and assessment. Modes remain normalized shapes rather than dynamic response; deformation scale is visual only. Do not invent missing time frames or treat intermediate thermal retention as final-result playback.

`caseList` returns archiveRevision, compact IDs/revisions and metrics. Use `{caseId,expectedRevision}` for caseView/caseRestoreInput/caseRemove, add name for caseRename, or use `{name,expectedResultRevision}` for caseSave. Rename changes revision. External archive changes invalidate IDs; list again. Case display also restores saved input and therefore requires edit permission. Inspect scope can read, view scope changes settings, analyze scope saves and edit scope modifies/restores cases. Recheck state after a timeout before retrying any mutation. Chunked live case-archive transfers are described below. Bundling named views into case archives remains pending.

## PNG/WebM through the paired connector

Prefer `exportCapabilities` and semantic export jobs over browser code. Read capabilities first: WebM depends on browser recording support; MP4/GIF return false. With view scope, call `startExport({requestId,expectedResultRevision,format:"png"|"webm",animation:"orbit"|"deformation"|"time"|"slice",seconds})`; seconds is an integer 1..15 (default 5). Obtain expectedResultRevision from getResultView. The job freezes a copy of current view/settings and checks the result revision before rendering. Identical retained requests are idempotent; changed arguments need a new requestId.

Inspect scope permits exportCapabilities/exportStatus/exportArtifact. Poll `exportStatus({jobId})` to terminal state. Only completed jobs expose artifacts. Retrieve `exportArtifact({jobId,offset:0,length:65536})`, base64-decode data, follow nextOffset until null, concatenate bytes and verify totalBytes and SHA-256 against metadata (mimeType/name/sha256). Offset counts decoded bytes; length cannot exceed 65,536. No arbitrary browser scripts, arbitrary file paths or global filesystem access is needed. Jobs do not trigger downloads or persist output; save verified bytes only to a destination authorized by the user.

Use view scope for cancelExport/releaseExport; release retained output when finished. Default limits are 32 MiB total, four jobs and one active renderer including cancellation cleanup. Disconnect cancels connection-owned exports; late cancelled/released output is unavailable. Page exit loses output; case archives and restart recovery do not retain it.

WebM uses real-time recording targeting 24 fps, not deterministic fixed-frame output. Time playback uses stored transient-acoustic frames only; recording duration is not physical time. Deformation cycles change visualization scale, not the applied load or physical response. See docs/automation.md for the full contract.

Real-time recording requests 24 fps but does not guarantee frame counts; background tabs and load can drop frames. Deterministic fixed-frame export remains unimplemented.


## Portable named views

Use `namedViewList` (inspect) to read archiveRevision and viewId/revision/name/resultRevision. Read getResultView before saving. `namedViewSave({name,expectedResultRevision,expectedArchiveRevision})` (view) captures result settings/camera plus setup clipping/parts, field-defined units, ranges and selected frame/mode. Names are 1–100 characters, at most 16 views. No physical arrays or model are included.

`namedViewApply({viewId,expectedRevision,expectedResultRevision})` (view) requires the exact saved result revision, not another calculation's result. `namedViewRemove({viewId,expectedRevision})` requires view scope. Reinspect after conflicts/timeouts; do not reuse stale revisions blindly. Application failures attempt rollback.

`namedViewExport` (inspect) returns `{version:1,views:[{id,name,resultRevision,result,setup}]}`. Save JSON to a user-authorized destination, then use `namedViewImport({archive,expectedArchiveRevision})` (view) to transfer it back, replacing the entire current view list. Invalid schema, unknown keys, nonfinite values, bad cameras/ranges or duplicate IDs are rejected. There is no automatic localStorage persistence; use the case-view bundle below for combined transfer and export explicitly before page exit. Shared browser API: window.namedViewApi.list/save/apply/remove/export/import. The GUI panel offers equivalent save/restore/remove/import/export actions. Cross-result synchronization is unsupported.


## Transfer complete live case archives

Use caseArchiveExport({}) (inspect), then caseArchiveRead({transferId,offset,length}) to fetch base64 data/nextOffset. nextOffset:null marks the end. The export descriptor includes archiveRevision, totalBytes, sha256 and maxChunkBytes. Assemble all bytes and verify SHA-256 before saving to an authorized destination. Existing version 1 JSON includes complete physical results without truncation; named views remain separate.

For import, read caseList's archiveRevision, encode JSON as UTF-8 and compute totalBytes/sha256 (`sha256:` plus 64 lowercase hexadecimal digits; revisions use the same format). Use caseArchiveImport({expectedArchiveRevision,totalBytes,sha256}) (edit), sequential caseArchiveWrite({transferId,offset,data}) (edit) with at most 65,536 decoded bytes per base64 chunk, then caseArchiveCommit({transferId}) (edit). Commit validates completeness/hash/UTF-8/JSON/cases and archive revision before atomic replacement (eight-case limit). Import invalidates runtime case IDs; list again. Do not retry a timed-out commit blindly: inspect the current archive revision first.

Shared API: window.caseArchiveTransfer.beginExport/read/beginImport/write/commit/release. Shared retention limits are 100,000,000 bytes and four transfers. Invalid, incomplete, stale, expired or hash-mismatched imports preserve cases. Release staging/output via caseArchiveRelease({transferId}) (inspect), including after failures. Disconnect drops connection-owned imports; page exit loses unsaved transfers. No filesystem or arbitrary browser-code operation is exposed.

Archive staging limits bound retained buffers, not peak browser heap. Release completed imports too: their bytes remain retained to make commit retries idempotent.

### Fatigue and fracture assessments

Use `studio_assess_result({path,outputPath,expectedResultRevision,kind:"fatigue"|"fracture",options})` to validate a saved analysis and write a complete assessed analysis to a new exclusive output path. `studio_assessment({path,kind,expectedResultRevision?,offset?,limit?})` reads validated summary/provenance/units/limitations and pages of element data (default 50, maximum 200). For saved results, first call `studio_assessment({path,kind})` to discover the current `resultRevision`, then pass it to `studio_assess_result`. An eligible structural linear-elastic result without that assessment returns `available:false` with its revision and an empty element page; stored assessments return `available:true`. Prefer summaries and retrieve only needed pages.

For a permitted live session, call `evaluateAssessment` with the same kind/options and current expectedResultRevision (analyze scope), or `getAssessment({kind,expectedResultRevision?,offset?,limit?})` (inspect scope). Shared browser methods are `window.resultAssessmentApi.evaluate/get`. Evaluation returns previous/new result revisions and changes output metadata without changing original inputs, displacements or physical stresses. Refresh the result revision before further probes, export or saved-view operations; older saved view references become stale. Saved assessments must numerically match original inputs and preserve any valid assessment of the other kind.

Use only `materialProperties.fatigueData`/`fractureData` in the saved input. Do not invent missing measured S-N data, strength or toughness. Fatigue options: minLoadFactor, maxLoadFactor, appliedCycles, meanStressCorrection (`none` or `goodman`). Scope is proportional uniaxial isotropic linear elasticity within measured S-N bounds; no extrapolation, multiaxial or variable-amplitude history. Miner damage is usage, not failure probability. Fracture options: flawSizeRangeMm, geometryFactorRange, geometrySource, unit crackNormal, residualNormalStressRangePa, stressAssumption. Scope is mode-I LEFM using uncracked nominal stress; no mixed-mode shear, crack growth or remaining-life prediction. Bounds are deterministic, not confidence intervals. Thermal-stress, orthotropic and nonlinear results are refused. Consult `docs/automation.md`, `docs/fatigue.md` and `docs/brittle-fracture.md` for input provenance and physical limits; report refusal diagnostics rather than weakening the intended physical model.

## Update STEP geometry

Inspect saved input with `studio_inspect_project({path})`; pass its revision to `studio_preview_cad_update({path,replacementPath,expectedRevision,offset?,limit?})`. Use distinct absolute input/replacement paths. Replacement accepts STEP/STP (50 MiB, embedded units normalized to mm) or a saved STEP project JSON. Preview changes nothing and returns compact matched/pending counts, `replacementRevision` and condition reports (offset >=0; limit 1–50, default 50), without full triangle arrays. Review pending regions, then call `studio_apply_cad_update({path,replacementPath,outputPath,expectedRevision,expectedReplacementRevision})` with both exact revisions and a distinct new output path; existing files are never overwritten.

Matching is conservative face geometry, not persistent CAD identity. Changed, split, missing or ambiguous regions remain unresolved and block analysis until reselection. Condition values remain, but old provenance becomes unconfirmed, assumptions are cleared and user confirmation removed. Reconfirm sources/applicability/values, reselect unresolved regions, preflight and recompute; do not treat a successful update as permission to run with unconfirmed inputs.

Live `previewCadUpdate` (inspect scope) and `applyCadUpdate` (edit scope) accept an inline imported STEP project as `replacement`, using the same input/replacement revision arguments. Shared API: window.cadUpdateApi.preview/apply. The connector command limit remains 500,000 JSON characters; no chunked live CAD transfer exists. For larger STEP files, use the saved-file tools above. Preview is read-only; applying changes invalidates old input/result references. See docs/automation.md for the full operation contract and remaining verification limits.

Live replacement JSON must carry canonical imported STEP display meshes with `kind:"cad"`; allowed mesh keys are `positions`, `faceIds`, `kind` and optional nonempty `sourceHash`. Every position must be exactly Float32-representable. Do not round coordinates or strip additional mesh metadata to bypass rejection. The saved-JSON MCP flow is unaffected; prefer actual STEP file paths for engineering updates.

## Print imports and layer inspection

Use `studio_import_print({path,outputPath})` for original `.3mf`/`.gcode` files up to 50,000,000 bytes. It saves the same `{version:1,filename,data}` as GUI export to a distinct new JSON file, with exclusive creation. Inspect that file with `studio_inspect_print({path,expectedRevision?,viewId?,kind?,offset?,limit?,layerIndex?})`; omit kind for the compact summary, or request segments/triangles pages (maximum 200 items). Preserve warnings and references.

For live sessions, use `printInspect` (inspect scope) to get the snapshot revision and `geometry`/`plate:N` view IDs. Unloaded revision is null. `importPrint({expectedRevision,format,filename,text?,base64?})` requires edit scope: use text for gcode, base64 for 3mf. Whole commands are limited to 500,000 JSON characters; use printTransfer import/write/commit below for large live inputs. Invalid, stale, busy or expired imports preserve old data. `getPrintData({expectedRevision,viewId?,kind,offset,limit,layerIndex?})` is inspect-only and bounded to 200 segments/triangles. `setPrintView({expectedRevision,settings:{viewId,allLayers,layerIndex}})` requires view scope and leaves the document revision unchanged. Layer indices are language independent. Shared browser methods are `window.printOperations.inspect/import/get/set/export`.

Do not infer strength or infill material properties from import. Coordinate frames are not automatically registered to the CAE model. These operations do not execute G-code or control devices; arc extrusion and unsupported commands follow existing parser rejection rules.

## Observe GUI-started analysis

Use inspect-scoped `listJobs({offset:0,limit:50})` (limit at most 100) to discover retained jobs, including GUI starts. It returns compact `{jobs,total,nextOffset}` with `origin:"gui"|"api"`, without physical result arrays. Follow IDs with `jobStatus`, `jobEvents` and `jobArtifact`. The four GUI mesh/solve routes now use `guiAnalysisJobs.run` → `analysisApi.startJob`, with frozen input revisions and completion-time comparison before applying results; they enable intermediate fields. Old direct analyze/generateMesh APIs remain compatible. GUI history retains eight jobs and releases its oldest terminal, execution-settled job at the next GUI start, never MCP jobs. Disconnect cancels session-owned jobs only; GUI jobs continue. Local in-app-browser structural/thermal GUI jobs were verified with real Worker/WASM and MCP; all-route UI coverage, page restart recovery and public-HTTPS connectivity remain outstanding.

## Apply catalog references

After `studio_material_catalog`, apply references through `studio_edit_project` or live `edit` with `{method:"applyCatalogMaterial",args:[{id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,applicability,allowExperimental:false}]}`. The shared method is `studioApi.applyCatalogMaterial` with the same single object. Use the returned catalog version, explicit user-assumed Poisson ratio and nonempty applicability conditions; experimental entries require explicit allowExperimental:true. GUI application also requires applicability. Catalog sources, measurement conditions and missing data remain in the snapshot. Application invalidates old evidence for `/material`, `/materialProperties` and their child pointers even if values match: status becomes unconfirmed, assumption null and confirmation removed. Retain old source/value/rationale/applicability for reconfirmation. Other evidence and analysisIntent remain; no confirmed evidence is invented. Existing nonlinear preset replacement behavior is inherited: check the resulting material model and required inputs before solving.

## Transfer large print data

For live original G-code/3MF bytes exceeding inline command capacity, use edit-scoped printTransferImport({expectedRevision,format,filename,totalBytes,sha256}), sequential printTransferWrite({transferId,offset,data}) with base64 chunks up to 65,536 decoded bytes, then printTransferCommit({transferId}). Original input is capped at 50,000,000 bytes. Commit verifies hash, byte count, G-code UTF-8 and current revision/busy/guard before existing atomic import. Keep the 500,000-character command limit.

For a full version 1 GUI snapshot, use inspect-scoped printTransferExport({expectedRevision}); read transferId/direction/totalBytes/sha256/maxChunkBytes/revision, then printTransferRead({transferId,offset,length}) in chunks <=65,536 bytes. Verify the joined-byte hash before decoding JSON. Export limit is 100,000,000 bytes. Release with printTransferRelease({transferId}) (inspect). Four transfers share 100,000,000 retained bytes, not a peak-heap guarantee. Disconnect frees session-owned transfers; page exit loses them. No printing commands are executed and no material strength is inferred.

Shared transfer API: window.printTransfer.beginExport/read/beginImport/write/commit/release. Immediate identical chunk replay is accepted. Completed/failed transfers retain slots until release. Local actual-browser transfer was checked; maximum-size capacity, peak heap and public HTTPS remain unverified.

Transfer size limits do not relax parser restrictions: G-code retains the 25,000,000-character/200,000-segment caps, and existing 3MF ZIP/triangle and other caps remain in force.

## Case-view bundles

Use read-only studio_validate_case_bundle({path}) for v1 `{version:1,kind:"case-view-bundle",caseArchive:{version:1,cases},namedViewArchive:{version:1,views}}` or production v2 `{version:2,kind:"case-view-bundle",caseArchive,namedViewArchive,measurementArchive}`. Child archives use existing version 1 schemas. Each named-view resultRevision must equal the JSON-normalized display-prepared output hash from prepareCaseView(saved), matching createResultViewApi. Legacy mesh.summary recomputation can make raw saved-output hashes differ: do not remap supplied views or mutate the physical archive; display the case and resave a view that refers only to the raw hash. Then save its associated case or remove the orphan view before export. Do not silently discard it or remap to another result. Fields/modes/frames and setup mesh counts are validated.

Live caseBundleList (inspect) returns archiveRevision and case/view/measurement counts. Use caseBundleExport/Read/Release (inspect) and caseBundleImport/Write/Commit (edit) with the same arguments as caseArchive transfers. Four bundle transfer slots share 100,000,000 retained bytes, not a peak-heap bound. Hash/CAS/snapshot checks precede atomic synchronous replacement of all three stores for v2; no current-input change or automatic view application occurs. Named-view IDs survive but runtime case IDs may change: relist cases. Existing separate formats remain valid; dedicated GUI controls also handle bundles.

Shared bundle APIs are window.caseBundleApi.list/exportArchive/importArchive and window.caseBundleTransfer.beginExport/read/beginImport/write/commit/release.

Local actual-browser bundle export/import and case/view restoration were verified with real WASM/MCP. Public HTTPS, maximum capacity and all-result-kind GUI coverage remain unverified.

## Measurement history

Use measurementList/Get/Export (inspect scope) and measurementSave/Remove/Import (edit scope) to retain point samples with fixed resultRevision, point, options, current display/time/mode, measurements and assessment. Shared window.measurementApi methods are list/get/save/remove/exportArchive/importArchive. Options accept bodyIndex/elementIndex only: select the intended saved frame/mode through resultView first, then save its displayed sample. Never substitute modeIndex/frameIndex options.

History is capped at 100 entries and 300,000 UTF-8 bytes of strict archive JSON; full result bodies are absent. Export explicitly to preserve it. Imported values are historical records with schema validation, not independently verified numerical results. A history GUI is not included.

Read getResultView and measurementList first, then call `measurementSave({name:"Tip displacement",expectedResultRevision,expectedArchiveRevision,point:[5,5,40],options:{}})` with the actual returned revisions. `measurementGet({measurementId,expectedRevision?})` retrieves the fixed evidence; `measurementRemove({measurementId,expectedRevision,expectedArchiveRevision?})` removes it. Recorded entries report recordedEvidence:true and independentlyVerified:false.

measurementExport returns `{archiveRevision,archive:{version:1,measurements:[{id,name,resultRevision,point,options,evidence}]}}`; persist archive explicitly and restore with measurementImport({archive,expectedArchiveRevision}). Import replaces the whole list, preserves IDs and rejects duplicates. No timestamp is recorded; host guard callbacks are not JSON arguments.

## Check history against saved fields

Use `studio_verify_measurements({casesPath,measurementsPath})` to strictly validate both archives and recompute each sample through resultView.probe from matching display-prepared case output, retaining recorded field/time/mode/point/options. Orphan results or any canonical evidence mismatch refuse verification. Connected `measurementVerify({expectedArchiveRevision,expectedCaseArchiveRevision})` uses current history and raw-case-archive SHA; shared method is window.measurementApi.verify.

Successful verification reports verified:true, verification:"recomputed-from-saved-results", physicalAccuracyVerified:false and compact matches with measurementId/resultRevision/caseIndexes. This proves agreement with saved fields only; it is not independent numerical or physical validation and does not alter historical independentlyVerified:false flags.

Before live verification, read caseList and measurementList. Call `measurementVerify({expectedCaseArchiveRevision:cases.archiveRevision,expectedArchiveRevision:history.archiveRevision})` using those responses; no transfer is required. Returned archiveRevision/caseArchiveRevision identify the checked snapshots.

v2 bundles recompute every recorded measurement against the matching display-prepared case result and require full evidence equality; refuse orphan/tampered records rather than dropping them. The same seven bundle methods/100 MB transfer and GUI controls handle v2. Importing old v1 explicitly clears measurement history; export needed history first. Import does not apply current inputs/results or promote history flags to independent numerical verification.

On a measurement-enabled host, v1 import returns measurementsCleared:true and an effective v2 revision with empty history. v2 metadata includes measurementCount. Local actual-UI v1 clearing/v2 restoration and GUI/MCP export-byte equality were checked.

caseBundleExport() is read-only: it returns the captured snapshot revision, without an expectedArchiveRevision precondition. Keep expectedArchiveRevision mandatory for import/CAS.

## Recover from runtime termination

A V8 `jit_page_->allocations_.erase(addr) == 1` fatal is an unresolved runtime failure; do not label it physical invalidity or solver nonconvergence. After an stdio process stops, its in-memory jobs/events and retained request-id idempotency are lost. Do not assume old job IDs can be recovered. Before retrying, reread original inputs, existing output paths and published artifacts to establish what completed; use a new outputPath/requestId for recomputation. Do not overwrite files or silently change solver/tolerances.

For investigation, scripts/reproduce-wasm-runtime.mjs can fix target/runtime/concurrency and save an exclusive report with parent/child runtime identities and source fingerprints; consult docs/wasm-runtime-investigation.md. Node24.19.0 retains the old wrapper code and is not a fixed control. Node26 source contains the correction/successor implementation, making it a comparison candidate, not proof that this application's root cause is resolved.

Job cancellation/timeout can become terminal before execution exits. Check executionSettled/resourceState through existing status/list/events and wait for resource-state settlement before release or treating its slot as free; pending jobs keep requestId idempotency. Internal drain snapshots only currently pending executions; it is not a new MCP operation or V8 root-cause fix.

Use releaseAllowed:true as the release gate. resourceState:"settled" means the executor Promise settled after adapter cleanup, not confirmed OS-thread exit for void browser Worker.terminate(). A terminal-late rejection is executionError.code:"JOB_EXECUTION_REJECTED_AFTER_TERMINAL" while original cancel/timeout error remains; do not infer cleanup failure from this code alone. Service drain/closeAsync and normal EOF await cleanup; synchronous close remains compatible.

GUI run waits for terminal plus executionSettled, and history pruning requires releaseAllowed. Shared analysisApi.isBusy/drainJobs/closeJobsAsync expose host cleanup coordination; they add no wire methods. Connector mutations also check global busy state, so wait for settlement before retrying edits.

Cancellation can race completion: cancelled:false or terminal success does not mean the computation was cancelled. Inspect returned state and events before reporting cancellation.

## Discover retained artifacts

Before fetching an intermediate artifact, use studio_job_artifacts({jobId,offset:0,limit:50}) or inspect-scoped live jobArtifacts with the same page arguments (maximum100). Node service listArtifacts and browser analysisApi.listJobArtifacts return metadata only, total and nextOffset. Select an artifactId, then retrieve using existing studio_job_artifact/jobArtifact validation. This rediscovery works even after relevant events are truncated. Catalog listing does not rehash files; retrieval performs existing hash/revision/mesh checks. Released jobs are unavailable, and same-process retention does not provide persistent restart recovery.

## Select a body for intermediate samples

Intermediate jobArtifact/studio_job_artifact point reads accept bodyIndex or elementIndex with point; node pages retain available nodeBodies. If an interface point touches multiple bodies, an unspecified sample is ambiguous and refused: select the intended body/element explicitly. Final studio_probe also supports bodyIndex. Legacy meshes lacking body IDs cannot accept body selection; do not infer or reconstruct missing nodeBodies. Existing hash/mesh/revision checks remain.

Intermediate mesh summaries expose bodyIdentifiersAvailable:boolean and bodyCount:number|null; legacy missing IDs mean unknown bodyCount:null. Node pages include nodeBodies only when IDs exist.

## Create live built-in geometry

Read inspect for the current input revision, then edit-scoped createBuiltinProject({expectedRevision,source,name?}) creates new mm inputs with the saved-tool shape contract: box(bounds), up to10 nonoverlapping boxes, fixed cylinder(radius12/length60 along Y), sphere(center/radius), tube(center/axis/radii/length). Conditions [] and materialProperties {} replace current inputs without inheriting old physical settings; current results are invalidated. Case/view/measurement/print histories remain separate. Candidate/revision computation precedes commit; busy, expiry/revocation or input changes refuse it. Configure physics/evidence and preflight before solving.

The shared browser entry is window.builtinProjectApi.create({expectedRevision,source,name?}); connected MCP uses the same adapter.

## Select an observation-capable route

Inspect capabilities.observation.profiles and diagnoseExecution/preflight selectedObservation before requesting intermediate data. Profiles describe implemented solver/model/method observations, not physical validity or execution support: inspect allowed separately. CPU linear PCG iterations, modal residuals, nonlinear load steps and thermal/transient-acoustic fields differ; no internal Newton residuals/every-iteration fields are implied. MFEM/WebGPU paths can offer stage/text only. Harmonic acoustics and frequency sweeps expose BiCGStab residuals; channelFlow exposes PCG residuals. Zero iterations may emit no event. Supported fields still depend on includeFields, shared64 MB retention, successful observations and execution.

selectedObservation includes supported/profileId/profile/reasons, adaptive flags and fieldRetention(requested/available/maxBytes64000000/eventRetention256), with declarationOnly:true/physicalAccuracyVerified:false. acousticSweep emits frequency-step start/complete events; adaptiveSolve does not accept onObserve, so do not promise structured adaptive-round numerical events.

fieldRetention.available describes requested scalar/vector-field eligibility; inspect scalarFieldsSupported/vectorFieldsSupported/meshSupported/meshAvailable separately. Mesh may be available on CPU routes with no numerical fields; availabilityIsGuarantee:false applies. Catalog has13 browser/12 Node profiles (no Node WebGPU), including shared preparation/mesh/progress text stages. diagnose_execution accepts includeFields; preflight accepts adaptive/includeFields. Invalid diagnostic options fail, whereas preflight returns structured diagnostics with selectedObservation.supported:false. Existing saved analysisAssessment format is unchanged.

MCP capabilities/diagnose_execution/preflight_project include top-level runtime with only node/v8/platform/arch (missing values null), schemaVersion1/kind node. Exact observed Windows x64 Node24.11.1/V8 13.6.233.10-node.28 reports observed-risk and NODE_WASM_ALLOCATION_FATAL_OBSERVED unresolved evidence; others are not-assessed, not proven safe. compatibilityVerified/rootFixProven are false. This does not block execution, change defaults or alter physical-input allowed/assessment. Portable studioApi capabilities do not include host runtime.

## Import STEP/STL into live inputs

Read inspect input revision, then use edit-scoped inputImportBegin({expectedRevision,format:"step"|"stl",name?,scaleToMm?,totalBytes,sha256}), sequential inputImportWrite({transferId,offset,data}) canonical base64 chunks <=65,536 decoded bytes, inputImportCommit({transferId}) and inputImportRelease({transferId}). Immediate identical chunk retry and repeated commit are idempotent. Shared inputImportApi.import accepts bytes ArrayBuffer/Uint8Array; inputImportTransfer handles staging.

Original input limit is50 MiB/file, with100,000,000 retained staging bytes/four slots, not peak heap or arbitrary STEP processing guarantees. STEP retains source bytes/mm normalization. STL needs explicit positive scaleToMm and a closed outward convex single shell <=2,000 triangles. New inputs do not inherit material/conditions, invalidate current results and leave case/view/measurement/print stores separate. Candidate normalization/new revision precede CAS; busy/input changes/expired guards/release/disconnect refuse late commit.

Import transfers are session-owned; other sessions cannot use them. Commands have a15-second deadline, not an arbitrary50 MiB STEP completion guarantee. Cancellation keeps the lock until CAD Worker termination handling completes; void terminate does not prove OS-thread exit.

## Prepare live fluid domains

Use edit-scoped prepareFluidDomain({expectedRevision,mode,enclosure,paddingMm?,seedPoint?,portPlanes?,name?}) or window.fluidDomainApi.prepare. Exterior requires original STEP/built-in solid and box/sphere enclosure; internal accepts explicit [x,y,z,dx,dy,dz], seedPoint and portPlanes0..5 and may unwrap an existing domain. STL is unsupported. New inputs clear material/conditions/selection/provenance/intent and keep study fluidDomain.

Run mesh with the returned input revision, wait for succeeded plus executionSettled, then applyFluidDomainMesh({expectedRevision,jobId})/window.fluidDomainApi.applyMesh. Canonical input/revision/source fingerprint and mesh must match. A sourceHash-tagged gmsh surface updates display inputs without guessing physics; reread revision. domainSelection ports are bounded100/truncated with wall/channel summaries. Configure physical study/properties/conditions explicitly before solving; existing GUI demo automation is a separate path.

## Reuse saved coupling sources

Read inspect and caseList revisions, then edit-scoped applyCaseSource({expectedRevision,caseId,caseRevision,kind:"temperature"|"vibration",modeIndex?,amplitudeMm?,phaseDeg?})/window.caseSourceApi.apply. Temperature requires explicit structural/thermalStress:true and exact solid identity, including contact body IDs. Vibration requires acoustic/exteriorRadiation:true, no transient/sweep, exact saved box/current fluidDomain.solid, matching mode frequency, and explicit modeIndex/amplitudeMm/phaseDeg within existing bounds. Pressure boundary conflicts refuse application. Do not invent modal response amplitude or change physics to make a source fit.

clearCaseSource({expectedRevision,kind})/window.caseSourceApi.clear removes only that source, keeping other physics/settings/conditions. Input/case CAS and final host snapshot checks prevent stale application. Material evidence remains subject to ordinary snapshot checking, not automatic confirmation.

Source/ancestor /study provenance becomes unconfirmed, assumption:null and confirmation removed even for numerically identical replacement fields; other evidence/intent remain. Source caseReference:{schemaVersion:1,caseId,revision} preserves content-hash tracing, not persistent runtime-ID lookup after reload. Nonlegacy thermal/modal coupling evidence contracts remain limited/refused by preflight; application is not quantitative validation.

Multiple-box temperature sources also require nodeBodies, not just contact cases; legacy missing IDs are refused. Vibration application refuses manual impedance as well as pressure boundaries.

## Inspect surface defects

Use inspect-scoped live inspectSurface({meshIndex,toleranceMm?,problemOffset?,problemLimit?}) or studio_inspect_project({path,surfaceInspection:{meshIndex,toleranceMm?,problemOffset?,problemLimit?}}), reading report.surfaceInspection. meshIndex is explicit; pages default100/max200 over the full problem set, with problemTriangleCount/nextProblemOffset and problemTrianglesTruncated indicating more. Not limited to the legacy1,000 prefix. Use the returned project revision as edit expectedRevision for selectTriangles; indices are revision-scoped.

Boundary/nonmanifold/winding, degenerate/duplicate, component and signed-mm³ checks use display tessellation/tolerance, not exact CAD or self-intersection validation. closedEdgeTopology does not prove a single outward physical solid or volume-mesh success. No source mutation/automatic repair: fix original CAD/mesh and reload.

The flat report also includes full-project SHA-256 revision, meshIndex, units:{geometry:"mm",volume:"mm3"}, basis:"display-triangles", cadExactGeometryChecked:false, geometryModified:false and limitations. Shared function: inspectProjectSurface(project,options).

Aggregate signed-volume numerical overflow is refused, including finite-triangle cases; do not reinterpret range refusal as an ordinary open-surface null volume.

For page consistency, pin meshIndex and the first returned toleranceMm along with project revision; equal revisions alone do not guarantee equal problem sets when tolerance changes.

## Inspect nonlinear step displacements

includeFields:true enables converged plasticity/hyperelastic step structuralDisplacement fields; opt-out produces/transfers no new vector fields and final results are unchanged. Catalog/profile eligibility distinguishes scalarFieldsSupported and vectorFieldsSupported; available covers either, not guaranteed retention. Read field step/steps/loadFactor (actual unloading factor, not seconds), solver and min/max magnitude in mm. Pages expose displacementMm:[[x,y,z],...]; point samples expose displacementMm/magnitudeMm with step metadata. No time, stress or internal Newton residual is supplied. Step convergence is not final-job/physical accuracy validation; keep provisional labeling and existing body selectors/hash/retention/release rules.

## Thermal input evidence

Discover capabilities.preflight.requiredInputContracts and use preflight requiredPointers for quantitative/exploratory thermal-conduction. Explicitly set conductivity/transient/volumetricSource; transient also needs density/specificHeat/timeStep/steps/initialTemperature. Evidence covers thermal boundary type/value/regions, CAD specs and convection/radiation ambient temperature; contact is paired two-part conductance. Temperatures respect absolute zero and steady conduction needs an anchor. Required confirmed evidence enables quantitative, explicit assumptions keep exploratory provisional; missing values cannot be replaced by assumptions.

Runtime transient/volumetricSource/timeStep/steps/initialTemperature must match saved study, never silently override physics. Legacy thermal allowed/empty pointers/limited warning/schema1 assessment stay compatible. No full-source CAD authentication or radiation numerical-seed/iteration-limit evidence is added. Successful preflight remains incomplete; check meshing/boundary transfer/connected anchors/convergence/source applicability/physical accuracy.

Active temperature/vibration coupling carries schema1 sourceAssessment when available and OR-propagates upstream provisional:true to preflight/saved results, even for legacy destinations. Do not report a derived result as nonprovisional merely because its own mode is legacy. Mode/allowed/schema1/remainingChecks and old metadata-free sources remain compatible; malformed source assessments are refused. GUI and API share propagation.

heatPower boundary type/value/regions also require evidence; its unit is W. Saved-result validation refuses deleting source assessment metadata to erase inherited provisional status.

## Ground acoustic and limited-flow inputs

Read requiredInputContracts/requiredPointers rather than applying solver defaults. acoustic-wave requires explicit transient/sweep/radiation/directivity intent, medium/frequency/loss, active time/sweep/far-field settings and complete boundary evidence including impedance reactance/table. Vibration-source evidence includes scalars/caseReference and sourceAssessment; legacy sources without a reference require mesh/displacement evidence. initialPressure/radiationBoundary/normalVelocity runtime options are unsupported, not alternative source inputs.

fully-developed-channel-flow requires mu/rho/c/pressureDrop/axis and supported straight geometry; external-creeping-stokes-flow requires mu/rho/freeStreamVelocity/referenceLength/P1-or-P2 and exterior box/original-solid metadata. Conditions must explicitly be empty. Internal Stokes is not connected. Reject differing runtime physics, do not fill missing values with assumptions/defaults, and preserve legacy empty-contract compatibility. Geometry recognition, Re/Mach/flow balance, boundary coverage/source truth and physical accuracy still need separate checks.

studio_probe returns verified saved analysisAssessment when available; old absent-metadata outputs remain unchanged. Report its mode/provisional limits rather than inferring confirmation from point values.

Fluid runtime kind must also match saved study. Legacy empty-contract behavior refers to contract helpers; overall preflight still emits its existing PREFLIGHT_CONTRACT_LIMITED warning for these legacy disciplines.

## Interpret Stokes GMRES observations

Read iteration events with solver:stokes-gmres/velocityElement:P1|P2 and phase/residualKind. restart-check/preconditioned-relative measures the equilibrated left-ILU0 reduced system at outer-loop starts including0. arnoldi-estimate/preconditioned-relative-estimate is an estimate at first/each10th/break-before inner iterations. final-check/true-relative is the original nondimensional full-system free-equation residual divided by rawRhs norm after its1e-8 numerical check. All are dimensionless; no intermediate field arrays are added.

converged applies only to the named residual criterion. Later regime checks/job completion can still fail; preserve provisional labels and do not infer physical accuracy, flow balance or mesh independence. Zero-RHS skip still emits final-check at0.

## Interpret harmonic-acoustic and channel observations

Use existing jobEvents. acoustic-frequency exposes iteration/solver:bicgstab/kind:acoustic with frequencyHz/solvePhase:single|sweep and residualKind:recurrence-relative. Distinguish phase:s-check/r-check/zero-rhs. Sweeps add frequency-step/solver:acoustic-sweep start/complete with step/steps/frequencyHz; complete includes residual/iterations/peakPressurePa/splDb. A failed frequency may lack complete. Channel iteration/solver:pcg/kind:channelFlow has the same residualKind and no phase.

Residuals are dimensionless recurrence norms relative to the eliminated RHS, not independent true checks. Cadence is first/every25/convergence (BiCGStab also iteration limit); acoustic zero RHS emits iteration0, channel emits none. No physical-time axis or pressure/velocity field arrays are added. Check terminal state and later radiation/probe/Re/Mach validation; converged alone does not establish success or physical accuracy. Profiles remain13 browser/12 Node; these routes keep fields empty.

Nonfinite residuals/tolerances are omitted from telemetry, not normalized into valid numbers or JSON null. Sweep complete also requires finite residual/iterations/peakPressurePa/splDb metrics before notification. Computation, stopping rules and original errors remain unchanged; inspect terminal job failures even when no event is emitted.
