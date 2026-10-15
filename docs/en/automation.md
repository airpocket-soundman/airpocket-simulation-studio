# MCP and dedicated skill

[日本語](../automation.md)

`npm run mcp` starts a local stdio MCP server implementing the [2025-11-25 tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx), with no new library dependency. Run `npm ci` and `npm run build` first to prepare WASM assets.

Thirty-one tools: `studio_capabilities`, `studio_browser_contracts`, `studio_preview_edit`, `studio_diagnose_execution`, `studio_material_catalog`, `studio_progress`, `studio_inspect_project`, `studio_edit_project`, `studio_import_project`, `studio_create_builtin_project`, `studio_preflight_project`, `studio_preflight_mesh_boundaries`, `studio_analyze`, `studio_probe`, `studio_validate_cases`, `studio_validate_case_bundle`, `studio_verify_measurements`, `studio_compare_cases`, `studio_job_artifact`, `studio_job_artifacts`, `studio_assess_result`, `studio_assessment`, `studio_preview_cad_update`, `studio_apply_cad_update`, `studio_import_print`, `studio_inspect_print`, and the five job operations below. Use absolute local JSON paths. Analysis writes the complete result to a new `outputPath` and returns metrics. Input and existing outputs are not overwritten. The same browser CPU Worker runs in an isolated Node worker with a 120-second computation limit. Airpocket CPU and MFEM are supported; WebGPU is excluded.

Current entry points have 31 default/33 connected MCP tools and 88 browser operations; the minimal connector retains three tools. Historical counts below remain records of those increments. Current comparison validation, actual-browser and publication completion remain pending.

`studio_import_project({path,outputPath,scaleToMm?,name?})` normalizes STEP/STP to mm through OCCT and saves a new input JSON retaining original STEP data and CAD-face mappings. STL requires a positive explicit `scaleToMm` and follows the current outward, closed, convex single-shell and size restrictions. The input-file limit is 50 MiB. `studio_create_builtin_project({source,outputPath,name?})` creates mm-based `box` (bounds), `boxes` (boxes), fixed-size `cylinder` (kind only), `sphere` (center/radius), or `tube` (center/axis/innerRadius/outerRadius/length). It does not invent material values, supports or loads.

## Atomic saved-input editing

`studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})` defaults to compact overall dimensions in mm, triangle counts and face counts. Explicit `meshIndex` requests a face-ID-sorted page (default 20, maximum 50) with areas, centroids, bounds and average normals. Surface classification is not inferred. Retain the SHA-256 `displayMeshRevision` and face-ID scope; use `selectCadFace(mesh,faceId)` to select the corresponding display-face group. Even STEP face IDs are scoped to the display-mesh revision, not persistent CAD IDs across geometry/mapping changes. STL identities are triangle indices or remeshed surface tags.

Pass the `revision` returned by `studio_inspect_project({path})` as `expectedRevision` to `studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`. It applies 1–100 operations to a working copy and saves to a new `outputPath` only if all succeed. Stale revisions, unsupported operations and invalid inputs are rejected; input and existing output files are never overwritten. Responses include previous/new revisions, destination and a summary. Inspection revisions hash the exact input JSON independently of key order and may differ from a job's normalized `inputRevision`.

Supported methods are `selectTriangles`, `selectCadFace`, `selectPlanarRegion`, `selectCylindricalRegion`, `clearSelection`, `addCondition`, `removeCondition`, `selectCondition`, `replaceConditionRegion`, `reapplyConditionRegion`, `setMaterial`, `setMaterialProperties`, `setMaterialPreset`, `applyCatalogMaterial`, `setStudy`, `setMeshSettings`, `addSelectedMeshRefinements`, `setInputProvenance`, and `setAnalysisIntent`. Supply positional arguments of the corresponding `studioApi` method in `args`; for example, `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`. `setInputProvenance` takes the evidence document below; `setAnalysisIntent` takes `{mode:"quantitative"|"exploratory"}`. Provenance and required-input contracts do not yet cover every physical model.

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

`studio_job_artifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})` retrieves an intermediate artifact registered under the `artifactId` from an event. It accepts no arbitrary path and verifies hashes, job input revision and associated mesh. The default response is a summary. Current fields are thermal temperature/transient-acoustic pressure scalars and plasticity/hyperelastic load-step displacement vectors. For these, request interpolation at `point:[x,y,z]` in mm, or a node/value page using `offset` and `limit` (maximum 200), only when needed. Mesh-only artifacts provide coordinate pages; point interpolation requires a field. Registration is unavailable after job release. Final saved `job.final:true` means publication completed; assumed inputs can still retain `job.provisional:true`. Final publication does not mean non-provisional or physically validated results.

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

Run `node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` with the page's exact origin. The 29 default tools gain `studio_browser_sessions` and `studio_browser_call`. Details appear on stderr; stdout stays MCP-only. In **Connect your own LLM**, enter the endpoint/code, select inspect/edit/analyze/view scopes, and explicitly connect. Only inspect is selected by default. Never publish the code or store it in URLs/projects.

The server binds only 127.0.0.1 and checks Origin, Host and Bearer credentials. Sessions expire after ten minutes without browser polls; process termination loses all sessions. Disconnect cancels jobs started by that connection. Reconnection requires a new grant and does not restore running jobs.

`studio_browser_call({sessionId,method,args})` supports:

- Inspect: `inspect` (revision/methods), `geometry`, `preflight`, `jobStatus`, `jobEvents`, `jobArtifact`, `probe` (including provisional assessment).
- Edit: `edit({expectedRevision,operations})`, using the same 18 atomic operations; refuses revision conflicts, intervening changes, active jobs and revoked connections.
- Analysis: `startJob({inputRevision,requestId,operation,options})`, `cancelJob({jobId})`, `releaseJob({jobId})`, `showJob({jobId,name})`. Showing a solved result creates a case only when its input revision matches; mesh-only display is unsupported.
- View: `getView`/`setView` expose section/opacity/part settings; result cameras use the result-view API below; image/video export uses the jobs described below.

At most 16 commands are pending, with a 15-second reply timeout. A timeout does not prove non-execution: inspect before retrying mutations. Timeout errors (code BROWSER_COMMAND_TIMEOUT, message unchanged) carry `delivered:true|false`, exposed over MCP as `structuredContent.error.delivered`: `false` means the browser never fetched the command, so retrying is safe; `true` means it was handed to the page but no reply arrived, so inspect state before retrying. Local Chrome and real MCP verified edit→Worker solve→events→result display→0.04 mm probe→view change→disconnect. Restart recovery, all GUI-route monitoring and public HTTPS-to-loopback connectivity/permissions remain unverified.

### Single-file browser connector distribution (artifact verified, pairing unverified)

The browser-only entry builds to one file, `dist/assets/studio-browser-mcp.mjs`. It requires an existing Node 24 installation. Running the downloaded file requires no repository, npm install, native solver, or local CAD/Gmsh/OCCT assets. It is not an executable that bundles Node. Building it still requires the repository and npm dependencies.

First pin a trusted full commit revision or release tag, then obtain that version's `runtime-manifest.json`. Check that its `revision` matches the pinned commit and that `dirty` is false. Resolve a trusted tag to its full commit when pinning a tag. Matching a manifest and file from the same distribution alone does not establish trust in that distribution.

The optional manifest field `connector` is `{path:"assets/studio-browser-mcp.mjs",minimumNodeMajor:24,transport:"stdio"}`. Resolve `connector.path` against the manifest URL. Before execution, compare the downloaded file's byte length and SHA-256 of its raw bytes with `files[connector.path].bytes` and `.sha256` (lowercase hexadecimal). Older manifests may omit connector; its absence does not advertise this distribution. Its public path is `/airpocket-simulation-studio/assets/studio-browser-mcp.mjs`.

Configure the MCP client with, for example, `node studio-browser-mcp.mjs --browser-origin=https://airpocket-soundman.github.io`. Supply exactly one argument containing the actual page's exact Origin, without a path. The public page URL includes `/airpocket-simulation-studio/`; its Origin does not. stderr emits `Browser connector:` with endpoint, origin and pairingToken; stdout is JSON-RPC only. Enter these connection details in the app's connection UI and grant only the needed scopes. Inspect is selected by default. Loopback binding, Origin/Host/Bearer checks and expiration follow the existing connector rules above.

This entry exposes exactly three tools: `studio_browser_contracts`, `studio_browser_sessions` and `studio_browser_call`. Discovering contracts grants no permission; calls require the paired session's scopes. It is a separate entry from the existing server with 29 default tools or 31 tools in connector mode, which also handles saved files. To end a connection, disconnect in the app to cancel connection-owned jobs. Closing stdin (EOF) from the MCP client also closes the server, sessions and pending commands. Reconnection requires a fresh grant.

Source implementation and isolated Node 24 tests are complete: the tests place only the single file in a separate directory and exercise stdio, an HTTP fake browser, scope refusal and EOF shutdown. Verified public revision0e53638 manifest/bytes/SHA256, isolated startup using only the downloaded file, three-tool discovery and EOF. See [public file verification](../evidence/2026-10-15-public-browser-connector.json). The approved inspect-only actual HTTPS attempt failed with a reachability error and created no session; see [attempt evidence](../evidence/2026-10-15-public-https-inspect-failure.json).

### Browser intermediate fields

Use `startJob` with `includeFields:true` to retain intermediate meshes, thermal/transient-acoustic scalar fields and plasticity/hyperelastic step displacement fields in browser memory. Pass an `artifact.artifactId` from jobEvents to `jobArtifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})`, or use shared `analysisApi.getJobArtifact(jobId,artifactId,options)`. The default returns summaries only; pages contain at most 200 nodes. Point measurements require a field artifact.

Reads verify SHA-256, input revision and mesh identity, returning physical seconds, units and provisional:true. Remeshing changes subsequent mesh references while old fields keep their original mesh. All browser jobs share a default 64,000,000-byte serialized-data budget; this is not a heap-memory ceiling. Limits retain summaries and computation. Invalid observations produce observation-error without asserting that the final solve is invalid. releaseJob/closeJobs free artifacts; page exit loses them. Persistent files and every iteration field from all solvers are unsupported.

## Semantic result views and cases

Connector `getResultView({frameOffset?,frameLimit?,modeOffset?,modeLimit?})` returns a resultRevision, fields/display units, current settings and stored time/mode metadata pages (at most 50 each), without large result arrays. Use `setResultView({expectedResultRevision,settings})`.

Settings: field, deformScale, surface, surfaceWire, volumeWire, section, modeIndex, frameIndex or timeSeconds, camera and colorRange. Camera position/target are mm, up is a direction and fov is degrees. Fixed colorRange is `{field,minimum,maximum}` in the reported display unit (stress MPa, temperature degC, etc.); null selects automatic ranges. Values outside a fixed range use endpoint colors. Changing fields resets automatic range unless a valid new range is supplied.

Acoustic time selection uses stored frames only; unavailable times are refused. Displaying intermediate thermal fields from final results is unsupported. Modes are normalized shapes, not dynamic responses. Connector `probe({point,expectedResultRevision?,options?})` measures the selected frame/mode and returns result identity, selection and assessment. Display deformation does not change physical values. Shared API: window.resultViewApi.get/set/probe. Settings can be captured/reapplied as JSON but are not automatically persisted in case archives.

Use caseList's archiveRevision and per-case caseId/revision for `caseView`, `caseRestoreInput`, `caseRemove` with `{caseId,expectedRevision}`, or `caseRename` with an additional name. `caseSave({name,expectedResultRevision})` stores the current displayed result (eight-case limit). Shared API: window.caseOperations.list/saveCurrent/view/restoreInput/rename/remove. IDs are page-local and become invalid when an external archive change is observed; rename updates content revision.

Inspect scope permits lists/probes/view reads, view scope changes result settings, analyze scope saves results, and edit scope renames/removes/restores/views cases. Viewing a case restores its saved input, so it requires edit permission. Revocation, deadlines, intervening changes and calculation/playback conflicts are rechecked before committing. Use the chunked transfer API below for live case-archive import/export. Bundling named views into case archives remains pending.

## PNG/WebM export jobs

The optional connector exposes 82 methods (29 default tools, 31 connector tools). Call `exportCapabilities()` to inspect PNG/WebM and animation availability. WebM depends on the running browser's recording support. MP4/GIF are unsupported and reported as false.

Read the result revision with `getResultView`, then call `startExport({requestId,expectedResultRevision,format,animation,seconds})`. `format` is `png` or `webm`; `animation` is `orbit`, `deformation`, `time` or `slice`; `seconds` is an integer from 1 through 15 (default 5). Admission verifies the result revision and freezes a copy of result-view, camera, layer and section settings. Identical retained request IDs and arguments return the same job; changed arguments cause a conflict.

Poll `exportStatus({jobId})` for progress and running/completed/failed/cancelled state. Completed artifact metadata includes `mimeType`, `name`, `totalBytes` and `sha256`. Retrieve `exportArtifact({jobId,offset:0,length:65536})`, decode its base64 `data`, and follow the returned `nextOffset` until null. Length is at most 65,536 bytes; offsets count decoded bytes. Concatenate pages and verify byte count and SHA-256 against the metadata before using the artifact. This requires no arbitrary browser code, arbitrary-path reads or global filesystem access. Export jobs do not automatically download or persist files.

Use `cancelExport({jobId})` to stop and `releaseExport({jobId})` to free retained slots and bytes. Late output after cancellation/release is inaccessible. Default retention is 32 MiB across four jobs; only one renderer runs at a time, including cancellation cleanup. Disconnect also cancels exports started by that connection. Page exit loses artifacts; restart recovery and persistence in case archives are unsupported.

Capabilities/status/artifact reads require inspect scope; start/cancel/release require view scope. Video requests 24 fps through real-time recording, not deterministic fixed-frame export. Time playback supports stored transient-acoustic frames only; video duration and physical time differ. Deformation animation cycles display scale and does not solve a loading history.

Real-time recording requests 24 fps but does not guarantee frame counts; background tabs and load can drop frames. Deterministic fixed-frame export remains unimplemented.


## Portable named views

Shared API: `window.namedViewApi.list/save/apply/remove/export/import`. The GUI named-view panel also saves, restores, removes and imports/exports JSON. Connector methods `namedViewList` and `namedViewExport` require inspect scope; `namedViewSave`, `namedViewApply`, `namedViewRemove` and `namedViewImport` require view scope. Removing a named view removes display settings, separately from removing an analysis case.

First read `namedViewList()` for `archiveRevision` and `views` containing `viewId/revision/name/resultRevision`, and `getResultView()` for the current result revision. `namedViewSave({name,expectedResultRevision,expectedArchiveRevision})` captures result settings, camera and setup including clipping/parts. It uses field-defined display units and retains fixed ranges and selected frame/mode, without physical field arrays or model data. Names have 1–100 characters; the archive holds at most 16 views.

Apply with `namedViewApply({viewId,expectedRevision,expectedResultRevision})`. Only the exact saved result revision is supported; these are not synchronization presets for different results. Remove with `namedViewRemove({viewId,expectedRevision})`. After a conflict, reread the list and displayed result rather than replaying stale revisions.

`namedViewExport()` returns JSON `{version:1,views:[{id,name,resultRevision,result,setup}]}`. Save it explicitly and use `namedViewImport({archive,expectedArchiveRevision})` to transfer it back, replacing the entire current view list. Unknown keys, nonfinite numbers, invalid cameras/ranges/schema and duplicate IDs are rejected. A failed application attempts to restore the previous state. There is no automatic localStorage persistence; use the combined bundle below or export required views explicitly before closing the page.

## Chunked case-archive transfers

Connector `caseArchiveExport({})` returns transferId, archiveRevision, totalBytes, sha256 and maxChunkBytes. Fetch base64 data and nextOffset with `caseArchiveRead({transferId,offset,length})`, treat nextOffset:null as the end, assemble all bytes and verify SHA-256 before saving to an authorized destination. The export retains complete physical results without truncation in the existing version 1 case-archive JSON format. Export named views separately.

Before importing, read caseList's archiveRevision and compute the UTF-8 JSON byte count and SHA-256. Hashes and revisions use `sha256:` followed by 64 lowercase hexadecimal digits. Start with `caseArchiveImport({expectedArchiveRevision,totalBytes,sha256})`, then send sequential base64 chunks through `caseArchiveWrite({transferId,offset,data})`. Each chunk permits at most 65,536 decoded bytes. After sending all bytes, `caseArchiveCommit({transferId})` verifies completeness, hash, UTF-8, JSON and case contents, replacing the entire archive only if its revision still matches. The limit is eight cases. Import invalidates prior runtime case IDs; list cases again.

Export/read/release require inspect scope; begin-import/write/commit require edit scope. Shared API: window.caseArchiveTransfer.beginExport/read/beginImport/write/commit/release. Retention is shared across transfers: 100,000,000 bytes and at most four transfers. Incomplete, invalid, hash-mismatched, stale or expired imports are refused while preserving existing cases. Release unwanted or failed staging with `caseArchiveRelease({transferId})`. Page exit loses unsaved transfers; disconnect discards imports owned by that connection. This API provides neither filesystem operations nor arbitrary browser code execution.

The 100,000,000-byte limit bounds retained transfer buffers, not browser heap usage during JSON parsing, copying or validation. Completed imports retain their slot and bytes until release so commit retries do not apply the archive twice.

## Versioned fatigue and fracture assessment

`studio_assess_result({path,outputPath,expectedResultRevision,kind,options})` validates a saved analysis JSON and exclusively creates a new complete analysis JSON containing the `kind:"fatigue"|"fracture"` assessment. Existing destinations are refused. `studio_assessment({path,kind,expectedResultRevision?,offset?,limit?})` reads summary, provenance, units, limitations and element data without writing; pages default to 50 elements and are limited to 200. For saved results, first call `studio_assessment({path,kind})` and supply its `resultRevision` as `expectedResultRevision` when evaluating. An eligible structural linear-elastic result without that assessment returns `available:false`, its current revision and an empty element page. Stored assessments return `available:true`.

Browser callers use `window.resultAssessmentApi.evaluate({expectedResultRevision,kind,options})` and `get({kind,expectedResultRevision?,offset:0,limit:50})`. Connector `evaluateAssessment` requires analyze scope; `getAssessment` requires inspect scope. MCP `studio_assess_result` requires `options` and refuses to overwrite its output path, but browser-side `evaluate` replaces the stored assessment when the same kind is re-evaluated at the current revision (no overwrite refusal) and accepts omitted fatigue `options` with defaults (minLoadFactor0, maxLoadFactor1, meanStressCorrection none, appliedCycles1). Stale revisions are refused. Evaluation returns previous/new result revisions, summary, material provenance, limitations and element count. Inputs, displacements and physical stresses stay unchanged, but the output revision changes because it includes the assessment and calculation settings. Read the new revision before applying saved views or reusing old result references.

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

`importPrint({expectedRevision,format,filename,text?,base64?})` accepts `format:"gcode"` with text or `format:"3mf"` with base64. Supply null as expectedRevision when unloaded, otherwise the latest revision. Invalid input, stale revisions, busy state and expired commands preserve previous data. The entire live command must fit the 500,000-character JSON limit; use the chunked transfer below for large live print inputs.

`getPrintData({expectedRevision,viewId?,kind,offset:0,limit:200,layerIndex?})` returns bounded `kind:"segments"|"triangles"` pages with at most 200 items. `setPrintView({expectedRevision,settings:{viewId,allLayers,layerIndex}})` changes only preview settings and leaves the document revision unchanged. Retrieve full saved data through the shared export method or saved-file path.

Parser warnings and references are preserved. Print coordinates are not automatically registered to the CAE model. Import does not execute G-code, control devices, or establish strength or infill material properties. Arc extrusion and unsupported commands are rejected according to existing parser restrictions.

## Monitoring GUI mesh and analysis jobs

The four GUI mesh/solve entry routes use `guiAnalysisJobs.run` and the shared `analysisApi.startJob`. Inputs are cloned and frozen to a SHA-256 revision at start; completion checks the current input revision before applying results. GUI jobs enable `includeFields:true` for supported intermediate fields. Legacy `analysisApi.analyze/generateMesh` remain direct execution APIs for compatibility.

The inspect-scoped connector method `listJobs({offset:0,limit:50})` (maximum limit 100) returns `{jobs,total,nextOffset}`. It lists retained GUI/API jobs as compact metadata with `origin:"gui"|"api"`, without full result arrays. The shared API is `analysisApi.listJobs`. Use returned IDs with existing `jobStatus`, `jobEvents` and `jobArtifact` to read state and intermediate results. GUI history retains the latest eight jobs; the next GUI start releases the oldest terminal, execution-settled GUI job. This cleanup never releases MCP jobs.

Disconnect cancels only jobs started by that session; GUI jobs continue. Page-exit/restart recovery is unsupported. Local in-app-browser structural and thermal GUI jobs were verified with real Worker/WASM and MCP ([test record](testing.md)); this does not cover every GUI route or public HTTPS connectivity.

## Revision-bound catalog material application

`studioApi.applyCatalogMaterial({id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,allowExperimental:false,applicability})` accepts one object and applies installed catalog reference values to the input. Obtain id and expectedCatalogVersion from `studio_material_catalog`. Supply poissonRatio explicitly and accept the isotropic approximation with `isotropicApproximation:true`. Record applicability to the intended molding process, temperature, direction and other conditions in a nonempty applicability string; the GUI also requires this input. Experimental formulations require explicit `allowExperimental:true` (default false).

For saved-file MCP, use `studio_edit_project` with `operations:[{method:"applyCatalogMaterial",args:[{id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,applicability}]}]`. Connected `edit` supports the same operation among its 18 methods and requires the usual input revision. The snapshot preserves catalog sources, measurement conditions, missing fields and applicability. Application resets existing provenance for `/material`, `/materialProperties` and their child pointers to `unconfirmed`, with `assumption:null` and confirmation removed, even when numerical values are unchanged. Previous source, value, rationale and applicability remain for reconfirmation. Other provenance and analysisIntent remain unchanged; no new confirmed evidence is generated. It inherits existing replacement behavior for nonlinear material presets; inspect the resulting material model and required inputs after applying.

## Chunked live transfer for large print inputs

Inspect-scoped `printTransferExport({expectedRevision})` retains a frozen JSON transfer of the full version 1 GUI export. It returns compact transferId, direction, totalBytes, sha256, maxChunkBytes:65536 and revision metadata. Inspect-scoped `printTransferRead({transferId,offset,length})` reads at most 65,536 bytes per call. Concatenate all bytes, verify SHA-256, then decode UTF-8 JSON. Complete arrays are not included in one oversized reply. Export JSON is limited to 100,000,000 bytes.

Edit-scoped `printTransferImport({expectedRevision,format,filename,totalBytes,sha256})` reserves a transfer for original G-code/3MF bytes, up to 50,000,000 bytes. Use null as expectedRevision when unloaded, otherwise the current revision. Send sequential `printTransferWrite({transferId,offset,data})` calls with base64 chunks of at most 65,536 decoded bytes. Edit-scoped `printTransferCommit({transferId})` verifies total bytes, hash and G-code UTF-8, then uses existing printOperations.import. Commit rechecks revision, busy state and expiry; invalid input preserves previous print data.

Inspect-scoped `printTransferRelease({transferId})` frees retention. All transfers share a 100,000,000-byte budget and four transfer slots. This is a retained-buffer budget, not a peak-heap ceiling covering JSON/parsing/cloning. Disconnect releases transfers owned by that session; page exit loses them. The 500,000-character command limit remains; chunks fit within it. This adds no solver, material physics or device control.

Shared transfer API: `window.printTransfer.beginExport/read/beginImport/write/commit/release`. Write accepts replay of the immediately previous chunk with the same offset and data. Completed or failed imports retain their slots until release; free them when no longer needed. See the [test record](testing.md) for local actual-browser scope. Maximum capacity, peak heap and public HTTPS remain unverified.

Transfer size limits do not relax parser restrictions: G-code retains the 25,000,000-character/200,000-segment caps, and existing 3MF ZIP/triangle and other caps remain in force.

## Combined case and named-view bundles

The existing exact v1 format remains `{version:1,kind:"case-view-bundle",caseArchive:{version:1,cases},namedViewArchive:{version:1,views}}`. Production export uses v2 `{version:2,kind:"case-view-bundle",caseArchive,namedViewArchive,measurementArchive}` to include measurement history; each child archive retains its version 1 format. Existing case-only and view-only formats remain supported. Read-only `studio_validate_case_bundle({path})` validates physical case results and linked views, returning compact counts/revision metadata.

Inspect-scoped `caseBundleList()` returns archiveRevision and case/view/measurement counts. Inspect-scoped `caseBundleExport()`, `caseBundleRead({transferId,offset,length})` and `caseBundleRelease({transferId})`, plus edit-scoped `caseBundleImport({expectedArchiveRevision,totalBytes,sha256})`, `caseBundleWrite({transferId,offset,data})` and `caseBundleCommit({transferId})`, reuse case-archive transfer arguments/chunk contracts. Bundle transfers share 100,000,000 retained bytes and four slots; this is not a peak-heap ceiling.

Each named view resultRevision must exactly match the SHA-256 of the JSON-normalized, display-prepared output from `prepareCaseView(saved)`. Legacy cases may recompute mesh.summary for rendering, making this revision differ from raw stored JSON. Physical case archives remain unchanged and supplied views are never remapped. Reject legacy views referring only to the differing raw hash; display the case and resave the named view to repair it. Orphan views refuse export: save the associated case or remove the view first. They are never silently dropped. Unsupported fields/modes/frames or mismatched setup mesh counts are rejected.

Import verifies hashes, all relevant current archive revisions and snapshots before synchronously committing all three stores atomically for v2. Importing v1 explicitly clears existing measurement history because that file contains none; save needed history before import. It does not apply a view or change current inputs. Named-view IDs remain stable; runtime case IDs may regenerate when contents change, so relist cases afterward. Cross-result mapping/revision substitution is unsupported. Separate GUI controls import/export the combined format.

Shared API: `window.caseBundleApi.list/exportArchive/importArchive`; chunk transfer uses `window.caseBundleTransfer` with the existing caseArchiveTransfer beginExport/read/beginImport/write/commit/release contract. Dedicated GUI controls are installed by `installCaseBundleUi`.

Local actual-browser/real-WASM/real-MCP checks verified identical GUI download and MCP chunk export, GUI reimport and case/view restoration ([test record](testing.md)). Public HTTPS, maximum capacity and actual GUI coverage of every result kind are not established.

## Result-revision and display-bound measurement history

Shared `window.measurementApi` provides list/get/save/remove/exportArchive/importArchive. Connector measurementList, measurementGet and measurementExport require inspect scope; measurementSave, measurementRemove and measurementImport require edit scope. Saved entries freeze resultRevision, point, options, display context including selected time/mode, measurements and assessment. Options accept only bodyIndex/elementIndex; modeIndex/frameIndex overrides are refused in favor of current resultView context.

History is strict JSON with at most 100 entries and 300,000 UTF-8 bytes for the complete archive, fitting inline command/reply limits. Complete results are not included. Import schema/type validation does not establish independently recomputed numerical validity against original results. Switching current results does not rewrite historical revisions/values. This change adds no GUI; explicitly export history that should be saved.

`measurementList()` returns archiveRevision and each measurementId, content revision, name and resultRevision. Save with `measurementSave({name,expectedResultRevision,expectedArchiveRevision,point,options})`, obtaining both revisions from result-view/history reads first. Read using `measurementGet({measurementId,expectedRevision?})`; remove with `measurementRemove({measurementId,expectedRevision,expectedArchiveRevision?})`, preferably supplying both revisions. Responses explicitly report recordedEvidence:true and independentlyVerified:false.

`measurementExport()` returns `{archiveRevision,archive:{version:1,measurements:[{id,name,resultRevision,point,options,evidence}]}}`. `measurementImport({archive,expectedArchiveRevision})` replaces the complete list and reports imported:true. IDs persist in the archive; duplicate IDs are rejected. No timestamp is recorded. Guard callbacks are host-private, not public JSON arguments.

## Recompute measurement history from saved results

`studio_verify_measurements({casesPath,measurementsPath})` reads a saved case archive and measurement archive, strictly validates both, finds each display-prepared result matching resultRevision and interpolates through real resultView.probe using recorded field/time/mode/point/options. Complete recorded evidence must match canonical JSON; mismatches and orphan records are refused.

Success returns compact `{schemaVersion:1,caseCount,measurementCount,verified:true,verification:"recomputed-from-saved-results",physicalAccuracyVerified:false,matches:[{measurementId,resultRevision,caseIndexes}]}`. This establishes agreement with saved fields, not independent-solver or physical accuracy. Existing recordedEvidence/independentlyVerified flags are unchanged.

Connected `measurementVerify({expectedArchiveRevision,expectedCaseArchiveRevision})` checks current history/case versions. expectedCaseArchiveRevision hashes the complete raw caseArchive JSON, distinct from each display-prepared result revision. Shared API: window.measurementApi.verify.

For live verification, call caseList() and measurementList() first. Pass the former archiveRevision as expectedCaseArchiveRevision and the latter as expectedArchiveRevision; no case transfer is needed. Verification also returns archiveRevision for history and caseArchiveRevision for the checked cases.

v2 validation/export/import recomputes every bundled measurement from the case matching its display-prepared result revision and requires complete evidence agreement. Tampered/orphan records are refused, never silently dropped. The same seven bundle methods and 100 MB chunk transfer handle v2; GUI bundle controls include cases, views and measurements. Saved-field agreement is not independent-solver or physical accuracy, and historical flags remain unchanged.

A v2 host importing v1 returns measurementsCleared:true and the effective v2 revision including empty history. v2 count metadata includes measurementCount. See the [test record](testing.md) for local actual-UI v1 clearing, v2 restoration and identical export bytes.

Read-only caseBundleExport() freezes the current snapshot and returns its revision; it does not condition export on an expectedArchiveRevision argument. Import still requires expectedArchiveRevision and commit-time CAS checks.

## Job terminal state and execution-resource settlement

Existing status/list/event records include executionSettled and resourceState:"pending"|"settled". Cancel/timeout may report terminal request state first; terminal with executionSettled:false still requires waiting for execution settlement. A resource-state event is emitted in the execute chain finally. Release requires both terminal state and executionSettled:true; pending jobs retain their slot and requestId idempotency.

Internal drain() awaits a snapshot of currently pending jobs, excluding later starts. close() retains synchronous cancellation. These add no MCP methods; observe existing status/events/list. Combined with headless Worker termination waiting, this defines resource ownership, not resolution of the V8 crash.

Each view/list/event also reports releaseAllowed, true only for terminal plus settled execution. settled means executor Promise completion: adapters must settle after their own cleanup. Browser Worker.terminate() returning void does not confirm OS-thread exit. Core cannot distinguish normal Abort rejection from cleanup failure after terminal; preserve the original cancel/timeout error and report executionError:{code:"JOB_EXECUTION_REJECTED_AFTER_TERMINAL",message} separately. Service drain/closeAsync and normal-MCP-EOF waiting are added while synchronous close remains compatible.

Browser analysis-client keeps active ownership and ignores late replies until void terminate completes or its thenable settles; abort is rechecked after Worker creation. Shared analysisApi.isBusy()/drainJobs()/closeJobsAsync() are added, and connector mutations check global analysis busy state. No wire methods are added. GUI run waits for terminal plus executionSettled; eight-entry history cleanup selects only releaseAllowed jobs.

## Artifact catalog independent of event retention

`studio_job_artifacts({jobId,offset:0,limit:50})` lists registered artifact metadata for a retained job. Limit is at most100; replies include a page and total/nextOffset without field arrays. Node service listArtifacts, shared browser analysisApi.listJobArtifacts and inspect-scoped connected `jobArtifacts({jobId,offset:0,limit:50})` expose the catalog.

When events are truncated, rediscover artifactId through the catalog, then retrieve through existing studio_job_artifact/jobArtifact. Listing does not rehash files; existing retrieval verifies hashes, revisions and mesh identity. Listing/retrieval after release is refused. Same-process job/memory retention limits remain; this does not add persistent restart recovery.

## Body-aware point sampling of intermediate fields

Intermediate meshes retain available nodeBodies and include nodeBodies in node pages. Point reads through studio_job_artifact and connected jobArtifact accept optional bodyIndex/elementIndex with point. Unspecified points at a multi-body interface are refused as ambiguous, like final-result probing; explicitly select a body or element. Final studio_probe also accepts bodyIndex.

Body selection is unavailable for legacy intermediate meshes without body IDs. Missing nodeBodies are not reconstructed or inferred. Existing revision/mesh/hash/interpolation checks remain; explicit selection does not establish correct physical interface conditions.

Intermediate mesh summaries expose bodyIdentifiersAvailable:boolean and bodyCount:number|null; legacy missing IDs mean unknown bodyCount:null. Node pages include nodeBodies only when IDs exist.

## Create built-in geometry in live inputs

Edit-scoped `createBuiltinProject({expectedRevision,source,name?})` checks the current input revision and creates new inputs using the same geometry contract as saved-file studio_create_builtin_project. Shapes in mm are box(bounds), boxes (up to10, nonoverlapping), fixed cylinder (12 mm radius, 60 mm along Y), sphere(center/radius) and tube(center/axis/innerRadius/outerRadius/length).

Candidate creation and new-revision computation finish before commit. Busy, expired/revoked commands and intervening input changes are refused. New conditions are [] and materialProperties is {}; previous loads/materials are not silently inherited. Current results are invalidated like a normal input load. Existing case/view/measurement/print histories are not modified. Set intended materials/supports/loads and check evidence/preflight before solving.

Shared browser API: `window.builtinProjectApi.create({expectedRevision,source,name?})`. Connected MCP uses the same adapter.

## Solver-specific intermediate observation capabilities

capabilities.observation.profiles declares implemented observations by solver/model/execution method; diagnoseExecution and preflight selectedObservation report the selected profile. It distinguishes linear CPU PCG iterations, modal residuals, plastic/hyperelastic load steps, thermal steady time0/transient temperatures and decimated transient-acoustic pressures. This does not expose internal Newton residuals or every iteration field.

Paths without numerical iteration observers, including MFEM/WebGPU, provide stage/text progress only. Harmonic acoustics/frequency sweeps expose structured BiCGStab residuals and channelFlow exposes PCG residuals. Zero iterations may emit no corresponding events. Supported fields are not guaranteed available when includeFields retention is off, the shared64 MB budget is reached or observations/calculation fail. Observation declarations do not establish execution support or physical validity; check diagnostic/preflight allowed and required inputs/verification separately.

Profiles contain id/models/methods/events/textProgress/fields/limitations. Events declare stage, optional solver, cadence and metrics(name/unit); fields declare kind/name/unit/timeUnit/cadence. selectedObservation returns schemaVersion, target/operation/supported, profileId/profile, reasons, adaptive and fieldRetention, with declarationOnly:true and physicalAccuracyVerified:false. fieldRetention includes requested/available/maxBytes:64000000/eventRetention:256. adaptive reports enabled/structuredRoundEvents:false/meshPerRound/textProgressOnly. acousticSweep emits structured frequency-step events. adaptiveSolve does not accept onObserve and declares no structured adaptive-round numerical events.

The catalog has13 browser profiles and12 Node profiles (excluding WebGPU). Shared events declare preparation/mesh/progress; progress is client-converted Worker text. fieldRetention also includes scalarFieldsSupported/meshSupported/meshAvailable/availabilityIsGuarantee:false. available means scalar or vector retention was requested on a supporting route, not guaranteed retrieval; CPU routes without numerical fields may still have meshAvailable:true. MCP diagnosis accepts includeFields:boolean; preflight accepts adaptive/includeFields. Invalid diagnosis options produce isError; preflight returns structured diagnostics and selectedObservation.supported:false. Saved analysisAssessment format is unchanged.

## Read-only Node runtime metadata

MCP studio_capabilities, studio_diagnose_execution and studio_preflight_project attach top-level runtime host metadata: schemaVersion:1, kind:"node" and only allowlisted node(process.version), v8, platform and arch values, with missing values null. Environment variables, executable paths, PID and hostname are absent. Pure studioApi.getCapabilities remains portable capability metadata without this Node host report.

Only an exact Windows x64/Node v24.11.1/V8 13.6.233.10-node.28 match reports knownIssueAssessment:observed-risk, warning code NODE_WASM_ALLOCATION_FATAL_OBSERVED, unresolved status and saved evidence. Other environments are not-assessed, not declared safe/unaffected. compatibilityVerified:false and rootFixProven:false remain explicit. Reporting does not refuse execution, automatically change default runtime, or alter input-diagnostic allowed/saved analysisAssessment.

knownIssueAssessment is a string; the matching diagnostics array contains one code/severity:"warning"/status:"unresolved"/message/evidence/suggestions entry. evidence is an array containing docs/evidence/2026-10-14-observation-profiles-v8-failure.json. Unassessed environments have empty diagnostics; Node26 comparison success is not converted into safety proof.

## Chunked live STEP/STL import

Shared inputImportApi.import({expectedRevision,format,bytes,name?,scaleToMm?}) accepts format:"step"|"stl" and ArrayBuffer/Uint8Array to create new inputs. Four edit-scoped connector operations are used. inputImportBegin({expectedRevision,format,name?,scaleToMm?,totalBytes,sha256}) declares current input revision, original size and sha256:64hex. Send sequential inputImportWrite({transferId,offset,data}) with canonical base64 chunks up to65,536 decoded bytes. Immediate identical chunk retry is accepted; repeated inputImportCommit({transferId}) is idempotent. inputImportRelease({transferId}) frees retention. Shared transfer methods are inputImportTransfer.beginImport/write/commit/release.

Each file is capped at50 MiB; staging retains at most100,000,000 bytes/four transfers. This is not a peak-heap bound or a guarantee that arbitrary50 MiB STEP can be processed. STEP preserves original bytes and normalizes to mm. STL requires explicit positive scaleToMm and existing closed/outward/convex single-shell limits, at most2,000 triangles.

Candidate validation, browser normalization and new input-revision computation precede CAS commit. Previous material/conditions are not inherited; current results are invalidated like new input loading. Separate case/view/measurement/print stores remain. Intervening inputs, busy state, revocation/expiry, release or disconnect prevent late parser results from committing.

Only the owning session may use its import transfers; other sessions are refused. The command deadline is15 seconds, without guaranteeing arbitrary50 MiB STEP completes within it. Cancellation retains the lock through CAD Worker termination handling; void terminate is not proof of OS-thread exit.

## Prepare fluid domains and apply mesh surfaces

Shared window.fluidDomainApi.prepare(args) and edit-scoped prepareFluidDomain accept {expectedRevision,mode,enclosure,paddingMm?,seedPoint?,portPlanes?,name?}. Mode is exterior/internal. Exterior requires an original solid with enclosure:"box"|"sphere" and paddingMm. Internal uses explicit enclosure:[x,y,z,dx,dy,dz], seedPoint:[x,y,z] and portPlanes, and may unwrap an existing domain to its original solid. Coordinates are mm. Sources are STEP or supported built-in solids, excluding STL.

As new inputs, preparation sets study.kind:"fluidDomain" and clears material properties, conditions, selection, provenance and analysis intent. Old physics are not guessed into fluid settings. Current results are invalidated like other new inputs; separate histories remain. Current revision, busy state and revocation/expiry are checked.

Run startJob mesh with the updated input revision and wait for success plus executionSettled. Pass expectedRevision/jobId to shared fluidDomainApi.applyMesh or edit-scoped applyFluidDomainMesh. It validates input revision, canonical input, source fingerprint and mesh, applying a sourceHash-tagged gmsh-surface as display input. Study remains fluidDomain; no fluid properties/analysis type are inferred. Compact domainSelection includes at most100 ports/truncated, wall count and channel metadata. Read the new revision after application.

Internal port IDs0/1/2 are X/Y/Z minimum,3/4/5 maximum. Existing axis-aligned box-face and one seed-connected-region restrictions remain. This adds no general3D flow, arbitrary caps, boundary layers or turbulence. See [external](fluid-domains.md) and [internal](internal-fluid.md) domain contracts.

## Apply saved cases as temperature/vibration sources

Shared window.caseSourceApi.apply({expectedRevision,caseId,caseRevision,kind,modeIndex?,amplitudeMm?,phaseDeg?}) and edit-scoped applyCaseSource check both current input revision and the saved case revision from caseList. Kind is temperature/vibration. Source snapshots and candidates are validated before final synchronous comparison/commit; no implicit case substitution or physics inference occurs.

Temperature requires explicitly configured current study.kind:structural and thermalStress:true, exact saved/current solid identity and contact nodeBodies validation. Vibration requires acoustic/exteriorRadiation:true, no transient/sweep, current fluidDomain.solid matching the saved box solid, and current frequency matching the selected mode. Explicitly supply all three modeIndex/amplitudeMm/phaseDeg values and obey existing amplitude bounds. Conflicting pressure boundaries are refused. Modal shape does not determine physical response amplitude.

window.caseSourceApi.clear({expectedRevision,kind})/connected clearCaseSource remove only the requested source, preserving other physics/numbers/conditions. Existing material evidence continues ordinary value-snapshot checking; no automatic confirmation/promotion occurs. These share existing GUI thermal/modal coupling, adding no solver.

Existing provenance entries for the source and ancestor /study become unconfirmed with assumption:null and confirmation removed, even if field numbers match: a different source cannot inherit old confirmation. Other evidence/analysisIntent remain. Sources store caseReference:{schemaVersion:1,caseId,revision}; the revision content hash supports tracing, but runtime caseId does not guarantee persistent lookup after reload. Nonlegacy structural thermal-stress evidence with saved thermal fields is supported as described below; modal-to-acoustic coupling has separate applicability limits. Successful application does not guarantee quantitative validity.

Temperature sources require nodeBodies for multiple-box solids as well as contact; legacy cases without IDs are refused. Vibration-source boundary conflicts include manual impedance as well as pressure conditions.

## Revision-bound display-surface inspection

Inspect-scoped `inspectSurface({meshIndex,toleranceMm?,problemOffset?,problemLimit?})` and saved MCP `studio_inspect_project({path,surfaceInspection:{meshIndex,toleranceMm?,problemOffset?,problemLimit?}})` inspect one explicit meshIndex. Saved MCP adds report.surfaceInspection. problemLimit defaults100/max200. problemTriangleCount is the full problem count; problemTriangles pages that complete set with problemOffset/problemLimit/nextProblemOffset. Null nextProblemOffset means end; problemTrianglesTruncated means further entries remain. This does not page only the legacy inspector's1,000-item prefix.

Reports include boundary/nonmanifold/winding edges, degenerate/duplicate triangles, components, closed-edge topology and signed volume in mm³ when available. toleranceMm must be finite/positive; omission uses the existing display-size-derived tolerance. Source/display data remain unchanged. Triangle indices belong only to the returned project revision; use it as edit expectedRevision when selecting through selectTriangles.

Self-intersections and exact CAD are unchecked; no automatic repair occurs. closedEdgeTopology:true does not guarantee one outward valid physical solid or successful volume meshing. Repair holes/duplicates/winding in source CAD/mesh and reload.

The flat report also includes full-project SHA-256 revision, meshIndex, units:{geometry:"mm",volume:"mm3"}, basis:"display-triangles", cadExactGeometryChecked:false, geometryModified:false and limitations. Shared function: inspectProjectSurface(project,options).

Even when individual triangle calculations are finite, aggregate signed-volume overflow is refused rather than returning Infinity converted to JSON null.

When joining pages, keep meshIndex and toleranceMm fixed as well as revision. Explicitly reuse the first returned toleranceMm in later calls. Different tolerances can change the problem set at the same project revision; revision equality alone does not establish identical inspection conditions.

## Nonlinear load-step displacement fields

Converged plasticity/hyperelastic load steps emit/transfer structuralDisplacement fields only with includeFields:true. Opt-out generates/transfers no new displacement vectors and leaves final numerical results unchanged. fieldRetention.available now covers scalar or vector eligibility, with separate scalarFieldsSupported/vectorFieldsSupported; availability is not guaranteed.

Field summaries return displacement/mm, solver:"plasticity"|"hyperelastic", step/steps, actual loadFactor (including unloading0–1) and minimumMagnitudeMm/maximumMagnitudeMm. Steps are not physical time; no time is included. Pages use displacementMm:[[x,y,z],...] separately from existing scalar page.values. Point measurements return displacementMm/magnitudeMm/step/steps/loadFactor. Stress/internal Newton residuals are absent. A converged step does not guarantee final-job convergence, numerical accuracy or physical validity; intermediate artifacts remain provisional.

Existing nodeBodies/bodyIndex/elementIndex ambiguity rules, input/mesh/hash verification, shared64 MB/256-event retention and release conditions remain. Schema/units/3N vectors/steps/finite magnitudes are checked; illegal time/stress metadata and numerical overflow are refused.

## Thermal-conduction evidence and assumption contract

Quantitative/exploratory thermal conduction uses thermal-conduction required inputs. Explicit conductivity, study.transient and volumetricSource are required; transient also requires density/specificHeat/timeStep/steps/initialTemperature. Register evidence for each temperature/heatFlux/heatPower/convection/radiation/thermalContact type/value/regions, any CAD planar/cylindrical specifications and convection/radiation ambientTemperature. Contact requires paired regions on two parts and positive conductance. Temperatures must be at/above absolute zero. Steady conduction needs a temperature/convection/radiation anchor, with per-component transfer checked after meshing.

Quantitative requires confirmed required evidence; exploratory needs explicit values/assumptions and remains provisional. Assumptions cannot replace missing values. Runtime transient/volumetricSource/timeStep/steps/initialTemperature may equal saved study values but cannot override them differently. Radiation iteration seed/numerical iteration limits are not new mandatory evidence.

Legacy thermal inputs retain requiredPointers:[], requiredInputContract:"unsupported", limited warning and previous allowed/schema1 saved-assessment compatibility. capabilities.preflight.requiredInputContracts lists static isotropic/modal/orthotropic, temperature-dependent/thermal-stress and J2/Neo-Hookean structure, thermal conduction, acoustic waves and supported limited-flow contracts. No new evidence pointer covers the full sourceModel; CAD authenticity is not certified. completePreflight:false/remainingChecks stay unchanged: source applicability, mesh quality, boundary transfer, convergence, mesh dependence and physical accuracy remain checks.

Thermal units are degC, conductivity W/(m·K), specificHeat J/(kg·K), density kg/m³, volumetricSource W/m³, heatFlux W/m², convection/contact conductance W/(m²·K) and timeStep seconds. No automatic unit conversion or property inference is performed.

## Propagate provisional coupling-source assessment

Temperature/vibration sources copy available schema1 sourceAssessment. When coupling is active, sourceAssessment.provisional:true is OR-propagated to current preflight/saved-result provisional status, including legacy destinations, so explicit upstream assumptions cannot disappear. Mode, existing allowed, schemaVersion1 and remainingChecks stay compatible. Existing GUI thermal-case/modal-source actions use the same helper. Old sources without metadata remain supported; invalid sourceAssessment is refused by validators. This preserves provisional lineage, not quantitative confirmation.

heatPower boundary type/value/regions also require evidence; its unit is W. Saved-result validation refuses deleting source assessment metadata to erase inherited provisional status.

## Nonlegacy required inputs/evidence for limited flow

Quantitative/exploratory fully-developed-channel-flow and external-creeping-stokes-flow require study.kind/dynamicViscosity/fluidDensity, explicitly empty conditions and sourceModel.kind. Channel additionally needs flowAxis/pressureDropPa/fluidSoundSpeed and supported straight-channel geometry. Box uses bounds; fixed cylinder uses Y-axis1; internal CAD domains use enclosure/mode/seedPoint/portPlanes and compact original-solid dimensions.

Stokes requires freeStreamVelocity/referenceLengthMm/stokesVelocityElement(P1|P2), exterior box enclosure and original-solid dimensions. Full STEP data are not duplicated into evidence. Re≤0.1 is checked before execution; reference-length lower bounds against CAD bbox and boundary consistency also require postmesh checks. The separate internal-Stokes adapter is not connected and is explicitly unsupported.

Differing runtime kind/dynamicViscosity/fluidDensity/fluidSoundSpeed/pressureDropPa/flowAxis/freeStreamVelocity/referenceLengthMm/stokesVelocityElement are refused as FLUID_RUNTIME_OVERRIDE; equal values are accepted. Missing nonlegacy inputs cannot be supplied by implicit solver defaults or assumptions alone. Legacy contract-helper requiredPointers/diagnostics remain empty; overall preflight retains its existing PREFLIGHT_CONTRACT_LIMITED warning. Channel CAD recognition/Re/Mach/flow balance and Stokes boundaries/mesh dependence/physical accuracy remain subsequent checks, not guaranteed by allowed. Units are Pa·s,kg/m³,m/s,Pa and mm.

## Nonlegacy acoustic-wave inputs/evidence

acoustic-wave requires study.kind and explicit acousticTransient/sweep/exteriorRadiation/directivityEnabled booleans, plus frequency/soundSpeed/airDensity/lossFactor. Harmonic acoustics needs referencePressurePa; transient needs acousticDuration/pulseWidth/acousticTimeStep/dampingRate/receiverPoint, with0 explicitly selecting automatic time stepping. Sweep needs sweepStart/End/Count and receiver; directivity needs axis/points/distance; exterior radiation records its spherical enclosure.

Boundary type/value/regions, present CAD patches, explicit impedance reactance and any table require evidence. Vibration sources require scalar settings and caseReference identity when available; old sources without references need mesh/displacement-array evidence with duplication cost. Present sourceAssessment also requires evidence. This does not authenticate sources or postmesh boundary coverage.

Differing runtime physical values are refused. initialPressure/radiationBoundary/normalVelocity, ignored by the current public route, are always refused. Legacy contract helpers remain empty; overall preflight retains its existing PREFLIGHT_CONTRACT_LIMITED warning. Missing nonlegacy medium/boundary/time/frequency inputs are not filled by defaults or assumptions alone; preflight.allowed/confirmed evidence do not guarantee numerical/physical accuracy.

studio_probe additively returns verified saved analysisAssessment when available. Old metadata-free outputs have no extra assessment; point values alone do not establish confirmation/nonprovisional status.

## Structured Stokes GMRES residual observations

P1/P2 Stokes emit stage:"iteration", solver:"stokes-gmres", velocityElement, iteration/residual/tolerance/converged and phase/residualKind. All residuals are dimensionless; no intermediate velocity/pressure arrays are supplied. Existing jobEvents carry provisional observations.

restart-check/preconditioned-relative is measured at the GMRES outer-loop start, including initial iteration0, on the equilibrated left-ILU0-preconditioned reduced system. arnoldi-estimate/preconditioned-relative-estimate estimates that system's residual, emitted at the first inner iteration, each10th iteration and before tolerance/happy/limit/restart-end breaks without duplicates. Do not interpret it as the original momentum-equation residual.

final-check/true-relative follows the existing numerical check of original nondimensional full-system free-equation residual normalized by rawRhs norm at tolerance1e-8. Zero RHS may skip GMRES but still emits final-check iteration0. Each converged refers only to that residual criterion; later regime checks can still fail. It guarantees neither successful job completion nor flow balance, mesh independence or physical accuracy.

## Structured harmonic-acoustic/channel residuals and sweep progress

Use existing jobEvents/studio_job_events. Profile IDs remain acoustic-frequency/channel-flow, with13 browser/12 Node profiles,27/29 MCP tools and80 live operations. Both profiles retain empty fields arrays: no intermediate pressure or velocity field is added. includeFields does not enable numerical fields on these paths.

Harmonic iterations carry stage:iteration, solver:bicgstab, kind:acoustic, frequencyHz, solvePhase:single|sweep, iteration/residual/tolerance/converged and residualKind:recurrence-relative. phase:s-check means the intermediate s residual crossed tolerance; r-check is the normal updated residual; zero-rhs emits iteration:0/residual:0/converged:true. Normal updates emit on the first iteration, every25 iterations, convergence and the iteration limit.

Sweeps emit stage:frequency-step, solver:acoustic-sweep, kind:acoustic, phase:start|complete and step/steps/frequencyHz. start has converged:null; complete has true and metrics residual/iterations/peakPressurePa/splDb. Inner iterations carry solvePhase:sweep and step/steps, distinct from the preceding single harmonic solve. A failed frequency may emit start without complete. frequencyHz is Hz, pressure is Pa and SPL is dB; step is not physical time.

Channel iterations carry stage:iteration, solver:pcg, kind:channelFlow, residualKind:recurrence-relative and iteration/residual/tolerance/converged. Existing PCG cadence remains first iteration, every25 and tolerance crossing; zero right-hand side emits no iteration event.

Both dimensionless residuals use the recursively updated residual divided by the eliminated right-hand-side norm. They are not independently recomputed true residuals and differ from Stokes final-check. converged indicates only that numerical condition: later radiation/probe/channel Re or Mach checks can still fail the job. It does not establish physical accuracy, persistence or mesh independence. Respect the256-event retention limit/cursor gaps and inspect terminal state.

Nonfinite residuals/tolerances are omitted from telemetry, not normalized into valid numbers or JSON null. Sweep complete also requires finite residual/iterations/peakPressurePa/splDb metrics before notification. Computation, stopping rules and original errors remain unchanged; inspect terminal job failures even when no event is emitted.

## Optional Node analysis process isolation

Explicitly start MCP with `node scripts/studio-mcp.mjs --analysis-isolation=process` to run each saved-input job in a child process using the same Node executable. Default isolation remains worker. Browser native Workers and default runtime are unchanged; counts remain27 default/29 paired tools and80 methods.

This opt-in isolates abnormal job exit in its child while keeping the MCP host alive. It never retries. Failures expose a runtime-failure event with code:ANALYSIS_PROCESS_EXIT and bounded stderr tail/hash; cleanup awaits process close. Wire arguments cannot select arbitrary executables/shells. This is not a V8 root fix or a guarantee of model compatibility/physical accuracy. Inspect inputs/outputs/artifacts before rerunning as a new request.

Current containment tests use controlled exit86, not reproduction of an actual V8 native fatal. Child termination on parent disconnect is best effort: synchronous native work can delay the disconnect handler, so immediate exit is not guaranteed.

Child stdout/stderr forwarding retains at most the first64 KiB of each stream. Diagnostic stderr tails are at most4,096 UTF-8 bytes; SHA-256 and byte count cover the whole stderr stream. These are retention bounds,not child-heap limits. A result message alone does not authorize publication:the parent waits for child termination before publishing. Inspect capabilities.executionIsolation and saved calculation.execution.isolation for the selected mode.

## Required inputs and evidence for isotropic modes and static orthotropy

For quantitative/exploratory runs, `modal-isotropic-structure` covers the CPU isotropic linear-elastic eigenproblem with lumped Tet4 mass. Explicitly set study.kind:"structural", modalAnalysis:true, gravityEnabled:false and positive density. Without an elastic temperature table, record Young's modulus and Poisson ratio evidence (−1 < nu < 0.49). Save explicit modeCount (1–6) and modalIterations (1–100); these numerical settings do not require physical provenance pointers.

Supported uniform-temperature interpolation uses dependence.elasticTemperatureTable with 2–100 temperature-ordered rows, evidence for the table/dependence and explicit study.materialTemperature. Interpolation is linear within table bounds; extrapolation is refused. Separate base Young's modulus/Poisson ratio are not required in this case. Registered temperature bounds and any explicit evaluation temperature also require evidence. This does not include thermal stress or thermal prestress.

Modes require fixed or zero-displacement supports. Force, pressure and normalTraction conditions must be exactly zero. Record every condition's type/value/direction/regions and any frame/planarRegion/cylindricalRegion. Fixed value/direction remain finite serialized fields, but the solver interprets fixed as zero displacement in all directions. Gravity, nonzero loads/prescribed motion, plasticity, hyperelasticity, orthotropy, adaptive refinement and MFEM/WebGPU are unsupported. Shapes have arbitrary normalization to maximum displacement 1 mm; they are not dynamic response amplitudes or fatigue loads.

`static-orthotropic-linear-structure` covers static CPU orthotropic linear elasticity. Explicitly record all materialProperties.orthotropic fields: model, youngModuliPa, poissonRatios, shearModuliPa, right-handed orthonormal axes, source and testConditions. Constants, axes and compliance are validated without filling isotropic constants. Study kind/gravityEnabled and every structural condition's type/value/direction/regions plus existing selectors/local frames require evidence. Enabled gravity requires gravity and positive density. Registered temperature bounds or an explicit temperature require materialTemperature and applicable bounds; record dependence when present. Rate dependence, a positive minimum strain rate, isotropic temperature tables, thermal stress, modal/nonlinear models and MFEM/WebGPU are refused. Adaptive refinement remains available on supported CPU paths.

Runtime physical values cannot replace saved inputs. Modal study settings must match saved values; runtime material/load/boundary injection is refused. Orthotropic differing study/material/conditions are refused; direct solver boundary/fixed/forces and similar records are rejected even when empty. A null cannot override an absent physical input. Edit the provenance-bearing project and inspect again.

Unmeasured inputs require explicit values and applicability as exploratory assumptions and remain provisional; quantitative requires confirmed evidence. An assumption cannot fill a missing value. Legacy behavior and saved-assessment compatibility remain unchanged; contract helpers require no new evidence in legacy mode. Unimplemented physical/material combinations remain limited. completePreflight:false stays: mesh quality, transferred boundaries, constraint rank/rigid modes, mass, convergence, mesh dependence, source applicability and physical accuracy need subsequent checks.

## Nonlegacy static temperature, thermal stress and nonlinear contracts

`temperature-dependent-isotropic-structure` also applies to static isotropic projects using materialTemperature, material temperatureMin/Max or dependence. Explicitly set uniform study.materialTemperature and record E/nu or the elastic temperature table, existing dependence entries/temperature bounds, boundaries and gravity evidence. Tables interpolate only within bounds; rate dependence and a positive minimum strain rate are rejected.

`thermal-stress-isotropic-structure` requires study.thermalStress:true, finite expansion (negative/zero allowed) and explicit temperature/referenceTemperature at or above absolute zero. A saved temperatureSource supplies the transferred field, but the saved-project format still requires study.temperature. Source name, mesh and temperature always require evidence, even when caseReference exists; existing caseReference/sourceAssessment are additional evidence. A reference identifies lineage, not payload authenticity. Evidence duplicates field-array value snapshots, increasing project/transfer size. Source provisional:true propagates to the derived assessment and cannot be removed by confirmed receiving-side evidence. Multi-body/contact matching, transfer coverage and outside nodes remain post-mesh checks. Nonuniform fields cannot use an elastic temperature table. Fatigue/fracture screening is refused for thermal stress. Use supported CPU/MFEM/WebGPU structural paths, checking target capabilities and observation coverage separately.

`small-strain-j2-structure` requires explicit E/nu and plasticity.model/yieldStress/hardeningModulus/testConditions, positive yield/hardening and −1<nu<0.49. The study.plasticLoadFractions loading history requires physical evidence: 1–30 values in [0,1], positive first/last and peak 1, including unloading/reloading. If nonlinearLoadSteps exists it must match the history length. Without a history, explicit nonlinearLoadSteps (1–30) defines the monotonic path and requires evidence. The Newton iteration limit is numerical and needs no physical evidence.

`finite-strain-neo-hookean-structure` requires hyperelastic.model/shearModulus/bulkModulus/testConditions and any existing testCurve evidence. It is compressible, mu>0 and 2/3≤K/mu≤20; near-incompressibility is unsupported. Increments/Newton limits are numerical and retain existing defaults of 10/30 when omitted. Neo-Hookean supports dead force, fixed/prescribed displacement and gravity; pressure/normalTraction are refused.

Both nonlinear contracts require boundary/local-frame/selector evidence, explicit gravity intent and density/acceleration when enabled, plus existing dependence/temperature applicability and required evaluation temperature. They support only CPU pcg/pcg-strict/wasm-pcg, excluding adaptive/modal/thermal-stress/orthotropic/elastic-temperature-table/rate-dependent models and fatigue/fracture screening. Differing runtime physical values and direct solver loadSteps/loadFractions/boundary injection are refused; edit the saved input instead. J2 absolute principal strain ≤0.02, Neo-Hookean positive Jacobians, constraint rank, convergence, mesh dependence and physical accuracy remain subsequent checks.

Legacy behavior and saved-assessment format remain unchanged. Quantitative requires confirmed evidence; exploratory requires explicit values, assumptions and applicability and remains provisional. completePreflight:false continues to exclude guarantees of evidence truth/applicability or numerical/physical accuracy.

## Structured execution failures

Caught Worker execution failures preserve the legacy message and add failure:{schemaVersion:1,code,stage,message,diagnostics}. Each diagnostic has code/severity/stage/target/message/evidence/suggestions/requiresUserIntent. The complete failure is bounded to 16,384 UTF-8 bytes, with additional message/evidence/suggestion/diagnostic limits. Stacks, causes and arbitrary Error payloads are excluded. Invalid received metadata is discarded while the legacy message remains.

Selected constraint/boundary failures have core-tagged codes, target pointers and bounded evidence. Other failures use generic codes for preparation/mesh/boundary-transfer/constraints/temperature-transfer/material-evaluation/solve/postprocess/unknown. A stage fallback does not identify a root cause or prove a repair. Suggestions guide inspection; they do not authorize invented properties, extra supports or different physical load regions.

Async jobs retain legacy error.code (JOB_FAILED/JOB_CANCELLED/JOB_TIMEOUT) and message, adding available error.failure. Rejections after cancellation/timeout preserve JOB_EXECUTION_REJECTED_AFTER_TERMINAL and may include executionError.failure. Aggregate cleanup errors retain the first available primary diagnostic rather than relabelling cleanup as the solver cause. Direct MCP errors retain isError:true/text and add structuredContent.error.failure. GUI wrappers retain metadata; not every failure has a typed diagnostic.

With observations requested, a caught Worker failure emits stage:"diagnostic", failure, converged:false and provisional:true before its terminal error. Delivery is not guaranteed under cancellation, disconnection, callback exceptions or retention limits. A profile declaration does not prove an event arrived; inspect job status and retained diagnostics. Failed execution does not publish a final analysis JSON, but already-generated mesh/intermediate artifacts may remain. Diagnostic support proves neither root-cause repair nor convergence/physical accuracy. Counts stay 13 browser/12 Node profiles, 27 default/29 connector MCP tools and 80 live methods.

## Discovering browser operation contracts before pairing

studio_browser_contracts({method?,scope?,offset?,limit?}) is an always-available read-only default MCP tool. No session or pairing code is needed to inspect declarations for all 81 live operations. Start with {method:"setResultView"}, read required arguments, revisionFields, units, sideEffects, limitations and scope, then call studio_browser_call through an explicitly permitted paired session. Scope filters are inspect/edit/analyze/view and may combine with method. Offset defaults to 0; limit defaults to 5 and is capped at 10. Follow nextOffset until null. Responses are at most 65,536 UTF-8 bytes and may split before the requested count.

The shared API is studioApi.getBrowserOperationContracts(query). Responses declare schemaVersion/contractVersion:1, target:browser, declarationOnly:true, requiresBrowserGrant:true and a Draft 2020-12 schemaDialect. Input schemas describe command envelopes and documented nested fields; they do not encode complete physical/archive/cross-reference validation. Adapter argument, revision, applicability and physical checks remain authoritative. Inspect/capabilities expose discovery pointers rather than embedding the full registry.

Discovery grants no permissions and proves neither optional-adapter availability nor successful execution. Current counts become 29 default/31 connector tools; 81 live methods and 13/12 profiles remain. Earlier 27/29 references record counts when those features were added. Direct thrown browser-operation failures now retain validated failure metadata through connectBrowserSession and the HTTP bridge/MCP; jobStatus error.failure retention already existed. Nested diagnostic format and physical-validation scope are unchanged.

## Read-only edit preview

studio_preview_edit({path,expectedRevision,operations,method?,size?,operation?,mode?}) applies the same semantic batch to a saved-input candidate and returns changes/preflight without writing output or starting a solver. The shared API is studioApi.previewOperations(operations,{expectedRevision,options?,operation?,mode?}); live previewEdit({expectedRevision,operations,options?,operation?,mode?}) requires inspect scope. It can inspect the next configuration while a job runs, without changing active jobs or current input. Intervening current-input revision changes reject the preview.

The response contains schemaVersion:1, previousRevision, candidate revision, operationCount, changedPointers:{pointers,total,truncated,maxPointers:100}, summary and preflight. It does not return the full candidate or operations, and reports at most 100 changed pointers. A valid edit command can return preflight.allowed:false with diagnostics; successful preview transport is not execution permission or physical validation.

After reviewing the candidate, pass expectedResultingRevision:preview.revision with the same original expectedRevision/operations to edit or studio_edit_project. Commit is allowed only when the resulting candidate revision matches. Omitting this additional field preserves existing callers. Preview grants no edit permission; committing still requires edit scope, revision and busy checks. Current counts are 29 default/31 connector tools and 81 live methods. Full P0/P1/P3 gates, physical validation and the remaining plan are unfinished.

Preview preflight preserves allowed/provisional from the full inspection while limiting returned diagnostics to 50 and requiredPointers to 100; reportPage exposes totals/truncation. Evidence arrays return length/omitted rather than values, long strings return length, and objects beyond depth 3/16 keys explicitly omit detail. Use existing preflight APIs for complete diagnostics. The returned value JSON is capped at 65,536 UTF-8 bytes; EDIT_PREVIEW_RESPONSE_LIMIT rejects excess without changing input. This is not the entire MCP RPC byte size including duplicate content.text/structuredContent representations.

Browser preview shares a trusted pure normalizeProject hook with GUI serialization, applying study defaults and ms/µs display conversions before inspecting the actual saved candidate. Response normalization includes applied:true, previousRevision (unnormalized candidate), revision (final candidate), changedPointers, requiresReview and note. Review changes when requiresReview:true before accepting the final revision; do not commit using the unnormalized revision. Preflight/resulting-revision checks apply to the final candidate before commit. The hook is not wire-selectable. Saved-JSON Node MCP does not apply GUI conversions, so identical original input can produce different browser/Node candidate revisions. Do not assume defaults or inactive-field representation differences are absent.

## Inspect saved/live input in bounded pages

Use studioApi.inspectInput({section:"study",pointer?,expectedRevision?,offset:0,limit:20}) or inspect-scope live inspectInput to read current input without changing it. Saved-file MCP uses existing studio_inspect_project({path,section:"study",pointer?,expectedRevision?,offset?,limit?}). Sections are project/study/material/conditions/provenance/selection/source/meshes/meshSettings/units/intent; shared/live default is project. Explicit MCP section returns only this response, not legacy geometry/face/full-study payloads.

Responses include schemaVersion:1, input revision, section, pointer, exists, known units and limitations, with a descriptor for existing values and a page when applicable. Objects page sorted keys at maximum 50 members; arrays maximum 200, default 20, with offset/nextOffset. Nested objects/arrays expose length/keyCount/sha256/omitted summaries. Follow returned absolute JSON Pointers within the selected section and pass expectedRevision on later reads. Escape ~ as ~0 and / as ~1. Invalid/out-of-section pointers and stale revisions are refused; missing values return exists:false without invented defaults.

STEP/source data and large strings omit full descriptor values and expose length/opaque hashes; explicitly selected strings page at most 200 UTF-16 code units. Hashes cover canonical JSON values, not original STEP-file bytes. Units cover only known material/boundary/temperature-source/geometry inputs; unknown units are not inferred. Returned value JSON is bounded to 65,536 UTF-8 bytes; reduce limit after INPUT_INSPECTION_RESPONSE_LIMIT. No input mutation/save/full-payload reply occurs, but identity/hash computation still reads original input and is not constant-cost.

For example, inspect {path,section:"conditions",limit:20}, then {path,section:"conditions",pointer:"/conditions/0",expectedRevision:revision} using the returned revision. Review values/evidence before supplying that revision to preview/edit; optionally bind commit with preview.revision as expectedResultingRevision. Inspection does not authenticate physical sources or applicability.

Legacy studio_inspect_project without section preserves its old shape, potentially including huge study/source arrays; it is not bounded. pointer/offset/limit/expectedRevision require section, and section mode cannot mix meshIndex/faceOffset/faceLimit/surfaceInspection. Older registered servers may lack this extension; discover actual tools and deliberately use the local repository fallback only when needed. Counts remain 29/31 tools, with 82 live operations including inspectInput.

Edit/preview positional arguments share explicit JSON schemas for numbers,booleans,null,records and common nested arrays. Method-specific positional/physical validation remains runtime-owned. If an existing client projects an old args:string[] declaration,do not stringify numbers or records to fit it;refresh the registered schema or deliberately use the documented local callStudioTool path. Improved host projection is not yet verified and is distinct from successful raw MCP contracts.

## Retrieve intermediate mesh connectivity

Use `pageKind:"elements",offset:0,limit:200` with `studio_job_artifact` or live `jobArtifact` to retrieve tetrahedral connectivity for the same intermediate mesh. The page includes kind/offset/count/total/nextOffset/hasMore/tetrahedra and optional elementBodies. Each tetrahedron uses four global node indices; element identity is offset+i. Node-page identity is also offset+i, allowing reconstruction from the same artifact's coordinates/connectivity. Never substitute a later adaptive final mesh for an intermediate field.

The default pageKind remains nodes; default limit0 returns summary only. Element offsets use element count and pages are capped at200. Reject elements combined with point/bodyIndex/elementIndex measurements. Preserve hash/input/mesh identity checks and provisional status; retrieval does not establish physical validity.

Shared analysisApi.drainJobs also waits for legacy analyze/generateMesh executions present at invocation without cancellation. closeJobs requests their cancellation; closeJobsAsync waits for Worker termination. Returned jobIds identify registered jobs only; direct executions do not acquire invented IDs.

With `includeFields:false`, thermal/transient-acoustic intermediate field arrays are not generated/transferred by the Worker; time/metric summaries remain. Final results and stored snapshots are separate. Direct solver observation defaults remain compatible; explicit observeFields:false suppresses only observation fields. The64MB budget covers retained observation JSON, not pending event queues or peak heap.

## Save a complete successful job without displaying it

Inspect-scoped live jobResultExport({jobId,inputRevision}) stages the retained complete output(input/calculation/mesh/boundary/result) from a succeeded,executionSettled job. Retrieve A while current input remains B,without showJob,caseSave or input restoration. Check schemaVersion1,format analysis-output,jobId/inputRevision/kind,totalBytes/sha256 and hashBasis raw-utf8.

Decode base64 data from jobResultRead({transferId,offset:0,length:65536}) and follow nextOffset until null. Verify complete raw UTF-8 byte count/SHA256 before parsing/saving JSON. Defaults:four transfers,100MB total,65,536byte chunks. jobResultRelease frees staging; disconnect invalidates that session's transfers. Cross-session transfer IDs are rejected. This API does not display results,register cases,change inputs or recalculate.

Preserve units,assumptions,provisional assessment and settings already present. Do not attach today's deployment revision/WASM hashes to historical outputs missing build identity. Engine provenance,full saved-comparison acceptance and actual HTTPS remain outstanding.

## Preserve execution-time runtime identity

New outputs freeze calculation.runtimeIdentity schemaVersion1 with target(browser/node),isolation(web-worker/worker-thread/process),build,engine and assets. Production browser builds embed identity in the compiled Worker;Node collects it at host initialization. Project/options cannot choose it. Dev/unavailable builds report status unavailable. Available builds include version,Git revision,dirty and sourceFingerprint:SHA256 of actual src/scripts/native and package/lock/Vite/HTML source records. The dependency lock identifies declarations,not all executed node_modules/generated-public bytes.

Up to16 assets carry role(kernel/gmsh/mfem),bytes,sha256,status observed/declared. Observed means the same hashed WASM bytes were supplied to initialization. Node Gmsh uses the actual package binary;never substitute browser dist hashes. MFEM under Node remains WASM,not native machine code. Actual HTTP(S) browser paths and Node providers observe loaded WASM;unobserved file-fixture/provider-less assets remain omitted rather than inferred.

Engine requestedMethod and actualEngine are distinct;actualEngine is the returned engine label or null when unrecorded. CPU fallback is not labeled GPU execution. Cases,restoration,bundles,full job-output transfer and caseList preserve/expose existing identity. Invalid schema or method/result-engine contradictions are refused on save/restore. Legacy outputs remain unrecorded;never stamp them with today's manifest/build.

Identity/integrity records do not prove an atomic snapshot of every dynamic import,publisher signatures,environment attestation or physical accuracy. Actual public HTTPS,Skill-only end-to-end and full P0-P6 remain separate gates.

Embedding adapters connecting the shared client to a Node Worker explicitly provide constructor-only runtime.identityHost(target/isolation). The default remains browser/web-worker;preflight follows the actual host. Project/options values with the same name are ignored. This is not a wire argument for users to relabel execution.

## Diagnose reachability separately from authentication

The connection UI reports local-network permission and bridge reachability separately. After checking the configured Origin and loopback Host, unauthenticated `GET /health` returns only `{schemaVersion:1,kind:"airpocket-browser-bridge"}`. Success does not verify the pairing code, establish a session, or grant scopes; the diagnostic result keeps `authenticated:false`. The probe sends no credentials, code or model, accepts at most 1,024 UTF-8 response bytes, and times out after five seconds. Timeout, unreachable and invalid-response results are not authentication failures.

Call `studio_browser_sessions({diagnostics:true})` to add `diagnostics` alongside the existing `sessions` reply. Omission or `false` preserves the old shape. Diagnostics contain configured `origin` / `endpoint`, current `sessionCount`, and fixed counters for requests, preflights, health checks, pairing success/refusal, Origin/Host refusal, authentication refusal, disconnects, expiry, request errors, scope refusal and command timeouts. They retain no codes, Bearer tokens, incoming URLs/Origins/headers/bodies, models or individual session IDs. The ordinary sessions list still provides its existing IDs and granted scopes.

Counters record only traffic observed by this process. No increase cannot identify a browser-permission, mixed-content, network or stopped-server cause. Check reachability and pairing separately; users still explicitly grant operation scopes.

Browser requests specify `targetAddressSpace:"loopback"`; browser permission remains authoritative and support is not guaranteed. See the current [Local Network Access specification](https://wicg.github.io/local-network-access/) and [official Chrome explanation](https://developer.chrome.com/blog/local-network-access). This path does not depend on the paused legacy Private Network Access special preflight headers or unconditionally add `Access-Control-Allow-Private-Network`. Existing CORS, Origin/Host, Bearer and scope checks remain in place.

The distributed COI Service Worker leaves requests to `http://127.0.0.1` unintercepted so the browser handles them as ordinary page requests. Reissuing them inside a worker can require prior local-network permission and prevent an initial permission prompt. This does not bypass permission or CORS checks; Origin, pairing-code and scope validation still apply. Ordinary application assets retain their existing isolation-header processing. Successful public HTTPS pairing still requires separate real-browser verification; PUBLICHTTPS1 remains open.

When an Origin/Host check refuses a request, the bridge still returns a data-free 403. It adds `Access-Control-Allow-Origin` (with `Vary: Origin`) only when the request Origin exactly equals the configured Origin, so the page can report "refused (403)" instead of a generic network failure, for example on a Host mismatch. Other Origins get no CORS headers, and `*` is never used. The Origin, Host and Bearer checks are unchanged.

## Strict agent edits and saved-case validation

`studio_validate_cases` validates every case through the actual restoration path before returning its existing comparison summary. Mismatched field/node counts, invalid tetrahedra/surfaces and inconsistent runtime identity are rejected. Valid legacy archives remain compatible and source files are unchanged. Validation does not establish physical accuracy or source authenticity.

Explicit `rotationDegrees` in `selectPlanarRegion` requires a matching `frame:{origin,u,v}`. Rotation-only descriptors, including zero rotation, are rejected instead of silently selecting an axis-aligned region. Coherent GUI frame/rotation pairs, custom frames without controls and legacy axis/position descriptors without rotation remain supported. `min/max` are frame coordinates in mm and rotation controls are degrees. Rejection preserves selection, conditions and input revision.

Discover concrete positional schemas for `setInputProvenance` and `setAnalysisIntent` through `studio_browser_contracts({method:"previewEdit"})` or `edit`. Put the provenance document or intent in `operations[].args[0]`. Provenance schemaVersion:1/entries records pointer/value/source/rationale/applicability/assumption/status; CAD/document sources require reference/revision. Preflight remains authoritative for pointer applicability, exact-value freshness, mandatory evidence and confirmation. Schema validity does not authenticate evidence or user confirmation. Never mark an agent proposal user-confirmed without actual user confirmation. Explicit exploratory assumptions retain provisional status.

## Pending intermediate payload limits

Independently of the 64 MB retained store, pending mesh/field processing defaults to eight events and 8,000,000 estimated bytes, including the active consumer. The host reserves structural estimates before cloning/serialization; excess snapshots are dropped while summaries, diagnostics and final calculation continue. Read reasons and counters in `observation-queue-limit` / `observationQueue`, browser completion `intermediate.queue`, or Node `intermediateQueue`. Capabilities `observation.pendingPayloadQueue` declares host defaults; startup overrides may differ, so use actual job metadata.

Protocol-enabled browser/headless jobs bound Worker-to-host delivery with eight in-flight events / 8,000,000 estimated bytes plus a separate eight-event / 8,000,000-byte outbox. The combined maximum is 16 events / 16,000,000 estimated bytes. Solver callbacks never wait; ACKs pump the outbox in FIFO order. Scalar iterations with the same solver/phase/step/frequency coalesce to the latest queued value, while final-check and frequency-step start/complete events take priority over iterations. Overflow is reported as drops, and fields cannot cross mesh generations. Before a normal result or reported error, the Worker drains queued deliveries and sends at most one drop-summary control event estimated at 4,096 bytes. Inspect sequence, in-flight/outbox counts and peaks, accepted counts and drop reasons in `observation-transport`. These budgets are separate from the host `observationQueue`, 64 MB retained store and JOBEVENTBYTES1 limits, and do not apply to legacy direct Worker calls.

The summary is sent before a normal result or a Worker-caught and reported error. Cancellation and timeout terminate the Worker immediately, and abnormal Worker exit may also prevent the summary. When it is absent, treat final transport drop totals as unknown; the last event's provisional metadata does not establish zero total drops. Cancellation does not wait for a summary, preserving immediate stop behavior.

`observationSequence` records source order. Summaries/diagnostics bypass asynchronous storage and may precede older field publication. latestPolicy is last-accepted-snapshot, not replacement with the latest rejected field. Rejected meshes prevent subsequent fields binding to an old mesh. accepted/latestCompleted mean queue admission/consumer completion, not successful artifact retention; verify artifact references and integrity separately. Cancellation releases waiting payloads and drain waits for in-flight work.

The Worker transport estimate is a conservative structural estimate of the full envelope including metadata. This Worker observation budget does not bound progress notifications, final results, total JS heap or legacy direct Worker calls. The host queue estimate also does not bound total JS heap or arbitrary event-ring payload bytes. Report dropped observations and limits rather than claiming complete intermediate fields.

## Job event payload and page byte limits

Defaults: 32,768 UTF-8 bytes per event, 1,048,576 retained event bytes and 256 events per job, and 65,536 bytes for the entire jobEvents JSON value. Events are returned whole; fewer events than requested is valid, so follow nextSequence/hasMore. Count/byte eviction removes oldest entries and remains detectable through firstAvailableSequence/truncated. eventRetention reports effective budgets/current retained count/bytes; eventPageBytes reports actual JSON-value bytes.

Oversized or unsafe observations (cycles, non-finite numbers, accessors, etc.) become same-sequence `observation-event-gap` events with `payloadOmitted:true` and `gap.reason`. Getters are not invoked; missing physics is not filled with zero/null. Gaps do not mean solver failure or convergence. Ordinary small metrics and valid structured primary failures remain available. Oversized status summaries expose summaryOmissions; error messages are capped at 2,048 UTF-16 code units with messageTruncated/originalMessageLength. Cancellation, settlement and release semantics remain unchanged.

Capabilities observation.eventPayload declares defaults and scope. Internal startup budgets must fit valid failures/envelopes; tiny values are rejected. The 64 KiB limit covers jobEvents JSON values, not transport envelopes. MCP duplicates values in text/structuredContent, so complete JSON-RPC/HTTP wire payloads can exceed 64 KiB. Worker transport and total JS heap remain outside this guarantee. Retrieve complete final results through dedicated jobResultExport/Read chunked transfers; do not reconstruct them from event summaries.

### Child-process execution for distribution verification

`check-published` uses the same Node executable to run hash-verified distributed analysis/CAD modules and fixed STEP reference generation in child-process main threads. It preserves all 26 checks and numerical assertions, accepting a received result only after close 0 without a signal or observed native fatal. Checkpoints record checks and child execution; failures retain preceding partial results.

This isolation belongs to the publication verification script. It changes neither actual browser Workers nor default MCP execution architecture. It adds no Node switch, GC-setting change, skip, automatic retry or fallback. The known native fatal on Linux Node24.21.0/main badce2c is preserved, without a root-fix claim. Post-change full suite passed 977 of 980 tests with 3 skips and zero failures; build and all 26 local checks passed. Publication CI remains separately pending. See [testing](testing.md) and [WASM runtime investigation](wasm-runtime-investigation.md) for evidence and scope limits.

### Optional development insights

studio_progress({includeEstimate:true,includeHistory:true}) separates original progress, subjective estimate and Git history. Omitted/false flags preserve the default response. History declares unavailable on source/HEAD mismatch, missing Git or capacity limits, with a2MBresponse cap. Local checkout history is not proof of public-candidate acceptance. See [method](progress-dashboard.md).

## Read-only saved-case comparison (validation record pending)

The shared `createCaseComparisonApi({cases}).compare(request, {guard})` and connected browser `caseCompare` (inspect grant) read saved cases without changing inputs, display, time or history. Obtain case IDs and revisions from `caseList`; provide 1–8 distinct cases as `references:[{caseId,expectedRevision,field,modeIndex?,frameIndex?,bodyIndex?,elementIndex?}]`. Optional `point` is three global coordinates in mm. Without it, only metadata is compared and no numerical deltas are returned. Body/element selectors require point and are local to each case; equal indices across meshes do not establish matching parts.

Fields are displacement / stress / plasticStrain / temperature / heatFlux / instantPressure / pressure / spl / phase / speed / fluidPressure. Specify modeIndex for modal results and a stored frameIndex for transient results. There is no implicit current/final frame, time interpolation or spatial registration. Modal displacement is a shape normalized to maximum 1 mm, not dynamic response; modal deltas are unavailable.

Each row carries case/input/result revisions, kind, selection, calculation/mesh metadata, recorded runtimeIdentity and assessment availability. Never fill missing legacy identity from today's manifest. `selection.displayUnit` describes rendering; `measurement.units` and `comparison.deltas[].units` describe raw values. Stress is Pa rather than MPa; plastic strain is ratio 1 rather than percent. Check the returned units for mm, degC, W/m2, Pa, dB, rad and m/s as appropriate.

Transient comparisons require exact equality of the stored physical time: no interpolation and no tolerance; a mismatch returns `different-time` and no deltas. SPL comparisons with different `referencePressurePa` return `different-reference-pressure` and no deltas. Raw pressure in Pa (instantPressure/pressure/fluidPressure) can still be compared despite differing reference pressure.

Deltas are case minus the first reference, component-wise for vectors. Incompatible kind/field/unit/time/frequency, unrecorded frequency, modal shapes or unavailable measurements produce reasons without deltas. This does not establish equal inputs or physical accuracy. Outside a valid selected body or ambiguous bodies produce per-row unavailable results; unknown bodies, invalid selectors or corrupt cases reject the batch. Expired/stale read leases or guards also reject the whole response.

MCP `studio_compare_cases({path})` accepts version-1 saved-case archives only, not bundle v1/v2. With references omitted, pass path alone to list `cases`, snapshot-local IDs such as `saved-case:0`, case revisions, archiveRevision and source raw bytes/SHA-256. Comparison requires that archiveRevision as expectedArchiveRevision plus references and optional point. Do not reuse IDs alone with another archive. A final source hash check rejects file changes. No file write or solver execution occurs.

The entire response JSON value is bounded to 65536 UTF-8 bytes; reduce references if it exceeds the limit. This is not a 64 KiB bound on the complete wire envelope, which duplicates values in MCP text/structuredContent and adds HTTP/JSON-RPC wrappers. Current validation counts, actual-browser and publication completion remain pending; P0–P6 remain incomplete.

### Preflight with requested assessments

`studio_preflight_project({path,fractureAssessment?,fatigueAssessment?,...})` also checks the material data and options for assessments requested by a solve, matching the shared API's `preflight(options)`. Omitted (or `undefined`) assessments and mesh-only requests retain existing behavior. Omitted fatigue options retain their existing defaults; specify intended load factors, cycle count and mean-stress correction explicitly.

Missing data returns `ASSESSMENT_INPUT_REQUIRED`, malformed values return `ASSESSMENT_INPUT_INVALID`, and unsupported structural models return `ASSESSMENT_MODEL_UNSUPPORTED`, with target pointers. A fracture evaluation temperature outside the registered toughness range returns `ASSESSMENT_TEMPERATURE_OUT_OF_RANGE`. Compatible temperature-dependent linear isotropic materials are not excluded wholesale. Quantitative/exploratory modes include the assessment material data in existing provenance/assumption checks. Preflight runs neither solvers nor assessments and does not change the input file. Success does not guarantee the eventual stress state, elastic range, mesh, constraints, convergence or physical validity.

Use `addSelectedMeshRefinements({size,radius,baseSize})` as an edit/preview positional argument to refine the selected region. Values are mm; size must be 15–100% of baseSize. The GUI helper appends at most 80 selected-triangle centroids, with 160 total stored refinements. Existing settings and selection are retained; empty selection, invalid values, capacity overflow and revision conflicts leave input unchanged. baseSize does not change the later job size automatically.
