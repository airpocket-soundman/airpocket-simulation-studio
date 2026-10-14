# MCP and dedicated skill

[日本語](../automation.md)

`npm run mcp` starts a local stdio MCP server implementing the [2025-11-25 tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx), with no new library dependency. Run `npm ci` and `npm run build` first to prepare WASM assets.

Twenty-four tools: `studio_capabilities`, `studio_diagnose_execution`, `studio_material_catalog`, `studio_progress`, `studio_inspect_project`, `studio_edit_project`, `studio_import_project`, `studio_create_builtin_project`, `studio_preflight_project`, `studio_analyze`, `studio_probe`, `studio_validate_cases`, `studio_job_artifact`, `studio_assess_result`, `studio_assessment`, `studio_preview_cad_update`, `studio_apply_cad_update`, `studio_import_print`, `studio_inspect_print`, and the five job operations below. Use absolute local JSON paths. Analysis writes the complete result to a new `outputPath` and returns metrics. Input and existing outputs are not overwritten. The same browser CPU Worker runs in an isolated Node worker with a 120-second computation limit. Airpocket CPU and MFEM are supported; WebGPU is excluded.

`studio_import_project({path,outputPath,scaleToMm?,name?})` normalizes STEP/STP to mm through OCCT and saves a new input JSON retaining original STEP data and CAD-face mappings. STL requires a positive explicit `scaleToMm` and follows the current outward, closed, convex single-shell and size restrictions. The input-file limit is 50 MiB. `studio_create_builtin_project({source,outputPath,name?})` creates mm-based `box` (bounds), `boxes` (boxes), fixed-size `cylinder` (kind only), `sphere` (center/radius), or `tube` (center/axis/innerRadius/outerRadius/length). It does not invent material values, supports or loads.

## Atomic saved-input editing

`studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})` defaults to compact overall dimensions in mm, triangle counts and face counts. Explicit `meshIndex` requests a face-ID-sorted page (default 20, maximum 50) with areas, centroids, bounds and average normals. Surface classification is not inferred. Retain the SHA-256 `displayMeshRevision` and face-ID scope; use `selectCadFace(mesh,faceId)` to select the corresponding display-face group. Even STEP face IDs are scoped to the display-mesh revision, not persistent CAD IDs across geometry/mapping changes. STL identities are triangle indices or remeshed surface tags.

Pass the `revision` returned by `studio_inspect_project({path})` as `expectedRevision` to `studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`. It applies 1–100 operations to a working copy and saves to a new `outputPath` only if all succeed. Stale revisions, unsupported operations and invalid inputs are rejected; input and existing output files are never overwritten. Responses include previous/new revisions, destination and a summary. Inspection revisions hash the exact input JSON independently of key order and may differ from a job's normalized `inputRevision`.

Supported methods are `selectTriangles`, `selectCadFace`, `selectPlanarRegion`, `selectCylindricalRegion`, `clearSelection`, `addCondition`, `removeCondition`, `selectCondition`, `replaceConditionRegion`, `reapplyConditionRegion`, `setMaterial`, `setMaterialProperties`, `setMaterialPreset`, `applyCatalogMaterial`, `setStudy`, `setMeshSettings`, `setInputProvenance`, and `setAnalysisIntent`. Supply positional arguments of the corresponding `studioApi` method in `args`; for example, `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`. `setInputProvenance` takes the evidence document below; `setAnalysisIntent` takes `{mode:"quantitative"|"exploratory"}`. Provenance and required-input contracts do not yet cover every physical model.

Including `selectCadFace` and `applyCatalogMaterial`, there are 18 methods; for example, `operations:[{"method":"selectCadFace","args":[0,2]}]`. CAD updates reset existing evidence entries to `unconfirmed` with `assumption:null` and remove confirmation. Recheck regions and evidence after updating geometry.

Browser callers use `await studioApi.getRevision()` and `await studioApi.applyOperations(operations,{expectedRevision})`. Changes are applied once after validation; intervening input changes also cause a conflict. MCP saved-input editing does not change an open browser.

## Evidence, assumptions and preflight

`studio_preflight_project({path,method?,operation?,mode?})` returns execution diagnostics, `requiredPointers`, `allowed`, `provisional`, and remaining checks. Browser callers use `studioApi.preflight(options,runtime)`. Register evidence and intent through an atomic edit, inspect again, and solve only when `allowed:true`. Node and browser execution are gated by this same inspection. Saved `output.analysisAssessment` and `result.analysisAssessment` carry the mode, provisional status and remaining checks.

Store `project.analysisIntent={mode:"quantitative"|"exploratory"}` and `project.inputProvenance={schemaVersion:1,entries:[...]}`. Each evidence entry contains a JSON `pointer`, an exact input `value` snapshot, `source:{kind,reference?,revision?}`, `rationale`, `applicability`, `assumption:null|string`, and `status:"confirmed"|"unconfirmed"`. Source kinds are `user-input`, `measured-document`, `cad`, and `agent-proposal`. Documents and CAD require references and revisions. Confirmed agent proposals additionally require `confirmation:{by:"user",note:"..."}`; LLM confidence is not evidence. Changed inputs invalidate old snapshots with `PROVENANCE_STALE`.

The static isotropic linear structural contract requires evidence for Young's modulus, Poisson ratio, study kind, gravity enablement, every support/load condition's type/value/direction/regions, and any local-frame/planar/cylindrical definitions. Enabled gravity also requires acceleration and density. Retrieve `requiredPointers` from preflight and record actual sources and values for each. Units are mm for geometry/displacement, Pa for modulus/pressure, N for force, kg/m3 for density and m/s2 for gravity. No automatic unit conversion or source-truth verification is performed.

`quantitative` rejects unconfirmed required inputs. `exploratory` can accept unconfirmed inputs with explicit values and assumptions as provisional. Assumptions cannot bypass missing values, invalid data or stale evidence. Old inputs without evidence or intent use `legacy`, which does not require new evidence registration, fill missing material values, or promote inputs to confirmed quantitative assessment. Even in legacy mode, missing required Young's modulus, Poisson ratio or other solver-required properties cause a `MATERIAL_REQUIRED` error. Old inputs without a gravity specification retain zero gravity. New-mode contracts for other physics/material combinations return `PREFLIGHT_CONTRACT_LIMITED` when not implemented. Successful inspection still reports `completePreflight:false`: mesh quality, boundary transfer, rigid-body modes/constraint rank and physical validity need subsequent checks.

Case restoration and saved-result inspection revalidate assessments against saved inputs, rejecting archives that falsely change mode or remove provisional status. Compatibility remains for old archives without assessments.

## Asynchronous jobs and intermediate results

Call `studio_start_analysis` with `path`, a new `outputPath`, required `requestId` (1–200 characters), and optional `operation: "solve" | "mesh"`, `size`, `method`, `adaptive`, and `includeFields`. It freezes the input and immediately returns a `jobId` and an `inputRevision` derived from the normalized project's SHA-256. Retrying the same request ID with identical input/settings/destination returns the retained job; reuse with different content is rejected.

- `studio_job_status({jobId})` returns `running`, `saving`, `succeeded`, `failed`, `cancelled`, or `timed_out`, plus the final artifact summary when available.
- `studio_job_events({jobId,afterSequence,limit})` retrieves events after a sequence cursor (default 50, maximum 100). Use the returned `nextSequence` as the next cursor and drain remaining pages when `hasMore` is true. An empty page does not mean completion.
- `studio_cancel_job({jobId})` stops a running Worker. Terminal jobs stay unchanged; the final publication stage `saving` cannot be cancelled.
- `studio_release_job({jobId})` frees a terminal job's metadata, events and request ID, retaining saved files. Retrying a released request ID can start a new job.

Jobs live only in the same MCP/Node process; restart recovery and reconnection are unsupported. Defaults retain 32 jobs and 256 events per job. Dropped events are reported through `truncated:true` and `firstAvailableSequence`; inspect status and available artifacts instead of guessing missing observations. Direct Node callers must also retain the same process. `studio_analyze` remains the final-response operation.

Events carry `jobId`, `inputRevision`, and `sequence`; intermediate snapshots carry `provisional:true`. Only observations actually emitted by the selected solver are available, including mesh/quality, iterative residuals, supported time fields and adaptive stages. This does not guarantee every iteration or field from every solver. With `includeFields:true`, provisional mesh/time-field JSON is saved in a new `outputPath + ".intermediate"` directory. Event artifact references contain a path, byte count and SHA-256; field JSON includes a `meshArtifact` reference when the corresponding mesh was saved, reset on remeshing. Existing directories are refused. The default aggregate limit is 64 MB (64,000,000 bytes); beyond it, an `observation-limit` event is emitted and summaries and computation continue without further field storage. Already written provisional files may remain after failure/cancellation. Even final saved results labeled `provisional:false` require convergence and physical-accuracy checks.

Browser `analysisApi.startJob`, `getJob`, `jobEvents`, `cancelJob`, `getJobResult`, and `releaseJob` use the same lifecycle. Callers supply `inputRevision` and `requestId` to `startJob`. Browser events contain summaries by default; includeFields:true retains the in-memory artifacts described below. The optional connector below exposes these APIs through live MCP.

`studio_job_artifact({jobId,artifactId,point?,offset?,limit?})` retrieves an intermediate artifact registered under the `artifactId` from an event. It accepts no arbitrary path and verifies hashes, job input revision and associated mesh. The default response is a summary. Current fields are thermal temperature and transient-acoustic pressure scalars. For these, request interpolation at `point:[x,y,z]` in mm, or a node/value page using `offset` and `limit` (maximum 200), only when needed. Mesh-only artifacts provide coordinate pages; point interpolation requires a field. Registration is unavailable after job release. Final saved `job.final:true` means publication completed; assumed inputs can still retain `job.provisional:true`. Final publication does not mean non-provisional or physically validated results.

Call `studio_analyze` with `{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`. Probe `point` coordinates are mm; fields carry physical units. Use UI-saved projects and documented material properties within their valid scope.

Register with Codex (adjust location):

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

See [official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Copy `skills/airpocket-studio` into personal `.codex/skills/airpocket-studio` to install the skill.

Default MCP works with saved JSON; connector mode also invokes permitted browser operations. Use connector export jobs or the UI for image/video exports. CPU execution does not verify browser rendering, GPU behavior or physical accuracy for arbitrary geometry.

`studio_material_catalog` retrieves installed polymer references; see [polymer library](polymer-library.md).

`studio_capabilities` returns Node execution capabilities and candidate engines. `studio_diagnose_execution` accepts a saved-project `path` and optional `method`/`adaptive` and returns execution-combination diagnostics with codes, severity, targets, evidence and suggestions. This is not complete unit/constraint/material/mesh preflight. Browser callers use `window.studioApi.getCapabilities()` and `diagnoseExecution(options)`.

## Temporary local connector (initial implementation)

Run `node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` with the page's exact origin. The 24 default tools gain `studio_browser_sessions` and `studio_browser_call`. Details appear on stderr; stdout stays MCP-only. In **Connect your own LLM**, enter the endpoint/code, select inspect/edit/analyze/view scopes, and explicitly connect. Only inspect is selected by default. Never publish the code or store it in URLs/projects.

The server binds only 127.0.0.1 and checks Origin, Host and Bearer credentials. Sessions expire after ten minutes without browser polls; process termination loses all sessions. Disconnect cancels jobs started by that connection. Reconnection requires a new grant and does not restore running jobs.

`studio_browser_call({sessionId,method,args})` supports:

- Inspect: `inspect` (revision/methods), `geometry`, `preflight`, `jobStatus`, `jobEvents`, `jobArtifact`, `probe` (including provisional assessment).
- Edit: `edit({expectedRevision,operations})`, using the same 18 atomic operations; refuses revision conflicts, intervening changes, active jobs and revoked connections.
- Analysis: `startJob({inputRevision,requestId,operation,options})`, `cancelJob({jobId})`, `releaseJob({jobId})`, `showJob({jobId,name})`. Showing a solved result creates a case only when its input revision matches; mesh-only display is unsupported.
- View: `getView`/`setView` expose section/opacity/part settings; result cameras use the result-view API below; image/video export uses the jobs described below.

At most 16 commands are pending, with a 15-second reply timeout. A timeout does not prove non-execution: inspect before retrying mutations. Local Chrome and real MCP verified edit→Worker solve→events→result display→0.04 mm probe→view change→disconnect. Restart recovery, all GUI-route monitoring and public HTTPS-to-loopback connectivity/permissions remain unverified.

### Browser intermediate fields

Use `startJob` with `includeFields:true` to retain intermediate meshes and thermal/transient-acoustic nodal scalar fields in browser memory. Pass an `artifact.artifactId` from jobEvents to `jobArtifact({jobId,artifactId,point?,offset?,limit?})`, or use shared `analysisApi.getJobArtifact(jobId,artifactId,options)`. The default returns summaries only; pages contain at most 200 nodes. Point measurements require a field artifact.

Reads verify SHA-256, input revision and mesh identity, returning physical seconds, units and provisional:true. Remeshing changes subsequent mesh references while old fields keep their original mesh. All browser jobs share a default 64,000,000-byte serialized-data budget; this is not a heap-memory ceiling. Limits retain summaries and computation. Invalid observations produce observation-error without asserting that the final solve is invalid. releaseJob/closeJobs free artifacts; page exit loses them. Persistent files and every iteration field from all solvers are unsupported.

## Semantic result views and cases

Connector `getResultView({frameOffset?,frameLimit?,modeOffset?,modeLimit?})` returns a resultRevision, fields/display units, current settings and stored time/mode metadata pages (at most 50 each), without large result arrays. Use `setResultView({expectedResultRevision,settings})`.

Settings: field, deformScale, surface, surfaceWire, volumeWire, section, modeIndex, frameIndex or timeSeconds, camera and colorRange. Camera position/target are mm, up is a direction and fov is degrees. Fixed colorRange is `{field,minimum,maximum}` in the reported display unit (stress MPa, temperature degC, etc.); null selects automatic ranges. Values outside a fixed range use endpoint colors. Changing fields resets automatic range unless a valid new range is supplied.

Acoustic time selection uses stored frames only; unavailable times are refused. Displaying intermediate thermal fields from final results is unsupported. Modes are normalized shapes, not dynamic responses. Connector `probe({point,expectedResultRevision?,options?})` measures the selected frame/mode and returns result identity, selection and assessment. Display deformation does not change physical values. Shared API: window.resultViewApi.get/set/probe. Settings can be captured/reapplied as JSON but are not automatically persisted in case archives.

Use caseList's archiveRevision and per-case caseId/revision for `caseView`, `caseRestoreInput`, `caseRemove` with `{caseId,expectedRevision}`, or `caseRename` with an additional name. `caseSave({name,expectedResultRevision})` stores the current displayed result (eight-case limit). Shared API: window.caseOperations.list/saveCurrent/view/restoreInput/rename/remove. IDs are page-local and become invalid when an external archive change is observed; rename updates content revision.

Inspect scope permits lists/probes/view reads, view scope changes result settings, analyze scope saves results, and edit scope renames/removes/restores/views cases. Viewing a case restores its saved input, so it requires edit permission. Revocation, deadlines, intervening changes and calculation/playback conflicts are rechecked before committing. Use the chunked transfer API below for live case-archive import/export. Bundling named views into case archives remains pending.

## PNG/WebM export jobs

The optional connector exposes 49 methods (24 default tools, 26 connector tools). Call `exportCapabilities()` to inspect PNG/WebM and animation availability. WebM depends on the running browser's recording support. MP4/GIF are unsupported and reported as false.

Read the result revision with `getResultView`, then call `startExport({requestId,expectedResultRevision,format,animation,seconds})`. `format` is `png` or `webm`; `animation` is `orbit`, `deformation`, `time` or `slice`; `seconds` is an integer from 1 through 15 (default 5). Admission verifies the result revision and freezes a copy of result-view, camera, layer and section settings. Identical retained request IDs and arguments return the same job; changed arguments cause a conflict.

Poll `exportStatus({jobId})` for progress and running/completed/failed/cancelled state. Completed artifact metadata includes `mimeType`, `name`, `totalBytes` and `sha256`. Retrieve `exportArtifact({jobId,offset:0,length:65536})`, decode its base64 `data`, and follow the returned `nextOffset` until null. Length is at most 65,536 bytes; offsets count decoded bytes. Concatenate pages and verify byte count and SHA-256 against the metadata before using the artifact. This requires no arbitrary browser code, arbitrary-path reads or global filesystem access. Export jobs do not automatically download or persist files.

Use `cancelExport({jobId})` to stop and `releaseExport({jobId})` to free retained slots and bytes. Late output after cancellation/release is inaccessible. Default retention is 32 MiB across four jobs; only one renderer runs at a time, including cancellation cleanup. Disconnect also cancels exports started by that connection. Page exit loses artifacts; restart recovery and persistence in case archives are unsupported.

Capabilities/status/artifact reads require inspect scope; start/cancel/release require view scope. Video requests 24 fps through real-time recording, not deterministic fixed-frame export. Time playback supports stored transient-acoustic frames only; video duration and physical time differ. Deformation animation cycles display scale and does not solve a loading history.

Real-time recording requests 24 fps but does not guarantee frame counts; background tabs and load can drop frames. Deterministic fixed-frame export remains unimplemented.


## Portable named views

Shared API: `window.namedViewApi.list/save/apply/remove/export/import`. The GUI named-view panel also saves, restores, removes and imports/exports JSON. Connector methods `namedViewList` and `namedViewExport` require inspect scope; `namedViewSave`, `namedViewApply`, `namedViewRemove` and `namedViewImport` require view scope. Removing a named view removes display settings, separately from removing an analysis case.

First read `namedViewList()` for `archiveRevision` and `views` containing `viewId/revision/name/resultRevision`, and `getResultView()` for the current result revision. `namedViewSave({name,expectedResultRevision,expectedArchiveRevision})` captures result settings, camera and setup including clipping/parts. It uses field-defined display units and retains fixed ranges and selected frame/mode, without physical field arrays or model data. Names have 1–100 characters; the archive holds at most 16 views.

Apply with `namedViewApply({viewId,expectedRevision,expectedResultRevision})`. Only the exact saved result revision is supported; these are not synchronization presets for different results. Remove with `namedViewRemove({viewId,expectedRevision})`. After a conflict, reread the list and displayed result rather than replaying stale revisions.

`namedViewExport()` returns JSON `{version:1,views:[{id,name,resultRevision,result,setup}]}`. Save it explicitly and use `namedViewImport({archive,expectedArchiveRevision})` to transfer it back, replacing the entire current view list. Unknown keys, nonfinite numbers, invalid cameras/ranges/schema and duplicate IDs are rejected. A failed application attempts to restore the previous state. There is no automatic localStorage persistence or case-archive bundling; export required views explicitly before closing the page.

## Chunked case-archive transfers

Connector `caseArchiveExport({})` returns transferId, archiveRevision, totalBytes, sha256 and maxChunkBytes. Fetch base64 data and nextOffset with `caseArchiveRead({transferId,offset,length})`, treat nextOffset:null as the end, assemble all bytes and verify SHA-256 before saving to an authorized destination. The export retains complete physical results without truncation in the existing version 1 case-archive JSON format. Export named views separately.

Before importing, read caseList's archiveRevision and compute the UTF-8 JSON byte count and SHA-256. Hashes and revisions use `sha256:` followed by 64 lowercase hexadecimal digits. Start with `caseArchiveImport({expectedArchiveRevision,totalBytes,sha256})`, then send sequential base64 chunks through `caseArchiveWrite({transferId,offset,data})`. Each chunk permits at most 65,536 decoded bytes. After sending all bytes, `caseArchiveCommit({transferId})` verifies completeness, hash, UTF-8, JSON and case contents, replacing the entire archive only if its revision still matches. The limit is eight cases. Import invalidates prior runtime case IDs; list cases again.

Export/read/release require inspect scope; begin-import/write/commit require edit scope. Shared API: window.caseArchiveTransfer.beginExport/read/beginImport/write/commit/release. Retention is shared across transfers: 100,000,000 bytes and at most four transfers. Incomplete, invalid, hash-mismatched, stale or expired imports are refused while preserving existing cases. Release unwanted or failed staging with `caseArchiveRelease({transferId})`. Page exit loses unsaved transfers; disconnect discards imports owned by that connection. This API provides neither filesystem operations nor arbitrary browser code execution.

The 100,000,000-byte limit bounds retained transfer buffers, not browser heap usage during JSON parsing, copying or validation. Completed imports retain their slot and bytes until release so commit retries do not apply the archive twice.

## Versioned fatigue and fracture assessment

`studio_assess_result({path,outputPath,expectedResultRevision,kind,options})` validates a saved analysis JSON and exclusively creates a new complete analysis JSON containing the `kind:"fatigue"|"fracture"` assessment. Existing destinations are refused. `studio_assessment({path,kind,expectedResultRevision?,offset?,limit?})` reads summary, provenance, units, limitations and element data without writing; pages default to 50 elements and are limited to 200. For saved results, first call `studio_assessment({path,kind})` and supply its `resultRevision` as `expectedResultRevision` when evaluating. An eligible structural linear-elastic result without that assessment returns `available:false`, its current revision and an empty element page. Stored assessments return `available:true`.

Browser callers use `window.resultAssessmentApi.evaluate({expectedResultRevision,kind,options})` and `get({kind,expectedResultRevision?,offset:0,limit:50})`. Connector `evaluateAssessment` requires analyze scope; `getAssessment` requires inspect scope. Evaluation returns previous/new result revisions, summary, material provenance, limitations and element count. Inputs, displacements and physical stresses stay unchanged, but the output revision changes because it includes the assessment and calculation settings. Read the new revision before applying saved views or reusing old result references.

Material data comes only from the original saved input's `materialProperties.fatigueData` or `fractureData`. Never infer missing S-N curves, strengths or toughness from names or an LLM guess. Saved assessments are numerically revalidated against their original input; a valid assessment of the other kind is preserved.

Fatigue options are `minLoadFactor`, `maxLoadFactor`, `appliedCycles` and `meanStressCorrection:"none"|"goodman"`. This is proportional uniaxial isotropic linear-elastic stress-life screening within measured S-N bounds, without extrapolation, variable-amplitude history or multiaxial evaluation. Miner damage is deterministic usage, not failure probability.

Fracture options are `flawSizeRangeMm`, `geometryFactorRange`, `geometrySource`, unit-vector `crackNormal:[x,y,z]`, `residualNormalStressRangePa` and `stressAssumption`. This is mode-I linear-elastic screening using uncracked nominal stress. Mixed-mode shear, crack growth, fatigue crack propagation and remaining-life prediction are unsupported. Ranges are deterministic bounds, not confidence intervals. Both assessments reject unsupported results including thermal stress, plasticity, hyperelasticity and orthotropy. API availability does not certify arbitrary models' physical validity or live rendering.

## Preview and commit CAD updates

Use `studio_preview_cad_update({path,replacementPath,expectedRevision,offset?,limit?})` to preview a STEP replacement in saved inputs. First obtain `revision` from `studio_inspect_project({path})`. `replacementPath` is an absolute STEP/STP path (50 MiB limit; embedded units normalized to mm) or a saved project JSON retaining STEP data. Input and replacement paths must be distinct. Preview changes no files and returns input/replacement revisions, matched/pending counts and paged condition reports, without full triangle arrays. `offset` is nonnegative; `limit` defaults to 50 and accepts 1–50.

After reviewing, pass both revisions to `studio_apply_cad_update({path,replacementPath,outputPath,expectedRevision,expectedReplacementRevision})`. It rechecks input and replacement contents and exclusively saves a complete new input JSON to a distinct `outputPath`, preserving input, replacement and existing output files. Matching uses the existing conservative face-geometry comparisons, not persistent CAD IDs. Changed, split, missing or ambiguous regions remain unresolved and prevent analysis until reselection. Physical condition values remain, but existing evidence becomes unconfirmed, assumptions are cleared and user confirmation records are removed. Reselect affected regions, reconfirm sources, applicability and values, then run preflight and recompute.

Shared browser API: `window.cadUpdateApi.preview({expectedRevision,replacement,offset:0,limit:50})` and `apply({expectedRevision,replacement,expectedReplacementRevision})`, where `replacement` is an already imported STEP project JSON. Connector `previewCadUpdate` requires inspect scope; `applyCadUpdate` requires edit scope. Preview preserves current inputs; commit checks input/replacement hashes, conflicts and permission state. Live commands retain the existing 500,000 JSON-character limit; chunked live CAD transfer is unsupported. Use the saved-file MCP flow above for larger STEP files. API availability does not imply matching accuracy for arbitrary CAD or completed live-rendering verification.

Live replacement JSON requires canonical imported STEP display meshes: each mesh has `kind:"cad"`, only `positions`, `faceIds`, `kind` and optional nonempty `sourceHash` keys, and every position must be exactly representable as Float32. Noncanonical meshes are rejected rather than silently rounding coordinates or dropping additional metadata. This restriction does not apply to the saved-JSON MCP flow. Prefer an actual STEP file path for engineering updates.

## 3MF/G-code import and layer-data APIs

`studio_import_print({path,outputPath})` reads an original `.3mf` or `.gcode` file and exclusively saves `{version:1,filename,data}`, matching GUI export, to a distinct new JSON path. It returns a revision and compact summary. Inputs and existing outputs are not overwritten. Original input is limited to 50,000,000 bytes. `studio_inspect_print({path,expectedRevision?,viewId?,kind?,offset?,limit?,layerIndex?})` inspects that saved JSON and returns a summary or array page.

The shared browser API is `window.printOperations.inspect/import/get/set/export`. Connected MCP requires inspect scope for `printInspect` and `getPrintData`, edit for `importPrint`, and view for `setPrintView`. Unloaded inspection returns `revision:null`. Once loaded, the revision hashes the complete version 1 GUI-export snapshot; compact views include `geometry` or `plate:N` identifiers and layer counts. Layer indices are independent of display language.

`importPrint({expectedRevision,format,filename,text?,base64?})` accepts `format:"gcode"` with text or `format:"3mf"` with base64. Supply null as expectedRevision when unloaded, otherwise the latest revision. Invalid input, stale revisions, busy state and expired commands preserve previous data. The entire live command must fit the 500,000-character JSON limit; chunked large live print inputs are unsupported.

`getPrintData({expectedRevision,viewId?,kind,offset:0,limit:200,layerIndex?})` returns bounded `kind:"segments"|"triangles"` pages with at most 200 items. `setPrintView({expectedRevision,settings:{viewId,allLayers,layerIndex}})` changes only preview settings and leaves the document revision unchanged. Retrieve full saved data through the shared export method or saved-file path.

Parser warnings and references are preserved. Print coordinates are not automatically registered to the CAE model. Import does not execute G-code, control devices, or establish strength or infill material properties. Arc extrusion and unsupported commands are rejected according to existing parser restrictions.

## Monitoring GUI mesh and analysis jobs

The four GUI mesh/solve entry routes use `guiAnalysisJobs.run` and the shared `analysisApi.startJob`. Inputs are cloned and frozen to a SHA-256 revision at start; completion checks the current input revision before applying results. GUI jobs enable `includeFields:true` for supported intermediate fields. Legacy `analysisApi.analyze/generateMesh` remain direct execution APIs for compatibility.

The inspect-scoped connector method `listJobs({offset:0,limit:50})` (maximum limit 100) returns `{jobs,total,nextOffset}`. It lists retained GUI/API jobs as compact metadata with `origin:"gui"|"api"`, without full result arrays. The shared API is `analysisApi.listJobs`. Use returned IDs with existing `jobStatus`, `jobEvents` and `jobArtifact` to read state and intermediate results. GUI history retains the latest eight jobs; the next GUI start releases the oldest terminal GUI job. This cleanup never releases MCP jobs.

Disconnect cancels only jobs started by that session; GUI jobs continue. Page-exit/restart recovery is unsupported. Local in-app-browser structural and thermal GUI jobs were verified with real Worker/WASM and MCP ([test record](testing.md)); this does not cover every GUI route or public HTTPS connectivity.

## Revision-bound catalog material application

`studioApi.applyCatalogMaterial({id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,allowExperimental:false,applicability})` accepts one object and applies installed catalog reference values to the input. Obtain id and expectedCatalogVersion from `studio_material_catalog`. Supply poissonRatio explicitly and accept the isotropic approximation with `isotropicApproximation:true`. Record applicability to the intended molding process, temperature, direction and other conditions in a nonempty applicability string; the GUI also requires this input. Experimental formulations require explicit `allowExperimental:true` (default false).

For saved-file MCP, use `studio_edit_project` with `operations:[{method:"applyCatalogMaterial",args:[{id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,applicability}]}]`. Connected `edit` supports the same operation among its 18 methods and requires the usual input revision. The snapshot preserves catalog sources, measurement conditions, missing fields and applicability. Application resets existing provenance for `/material`, `/materialProperties` and their child pointers to `unconfirmed`, with `assumption:null` and confirmation removed, even when numerical values are unchanged. Previous source, value, rationale and applicability remain for reconfirmation. Other provenance and analysisIntent remain unchanged; no new confirmed evidence is generated. It inherits existing replacement behavior for nonlinear material presets; inspect the resulting material model and required inputs after applying.
