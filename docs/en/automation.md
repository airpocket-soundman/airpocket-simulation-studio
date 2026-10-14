# MCP and dedicated skill

[日本語](../automation.md)

`npm run mcp` starts a local stdio MCP server implementing the [2025-11-25 tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx), with no new library dependency. Run `npm ci` and `npm run build` first to prepare WASM assets.

Eighteen tools: `studio_capabilities`, `studio_diagnose_execution`, `studio_material_catalog`, `studio_progress`, `studio_inspect_project`, `studio_edit_project`, `studio_import_project`, `studio_create_builtin_project`, `studio_preflight_project`, `studio_analyze`, `studio_probe`, `studio_validate_cases`, `studio_job_artifact`, and the five job operations below. Use absolute local JSON paths. Analysis writes the complete result to a new `outputPath` and returns metrics. Input and existing outputs are not overwritten. The same browser CPU Worker runs in an isolated Node worker with a 120-second computation limit. Airpocket CPU and MFEM are supported; WebGPU is excluded.

`studio_import_project({path,outputPath,scaleToMm?,name?})` normalizes STEP/STP to mm through OCCT and saves a new input JSON retaining original STEP data and CAD-face mappings. STL requires a positive explicit `scaleToMm` and follows the current outward, closed, convex single-shell and size restrictions. The input-file limit is 50 MiB. `studio_create_builtin_project({source,outputPath,name?})` creates mm-based `box` (bounds), `boxes` (boxes), fixed-size `cylinder` (kind only), `sphere` (center/radius), or `tube` (center/axis/innerRadius/outerRadius/length). It does not invent material values, supports or loads.

## Atomic saved-input editing

`studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})` defaults to compact overall dimensions in mm, triangle counts and face counts. Explicit `meshIndex` requests a face-ID-sorted page (default 20, maximum 50) with areas, centroids, bounds and average normals. Surface classification is not inferred. Retain the SHA-256 `displayMeshRevision` and face-ID scope; use `selectCadFace(mesh,faceId)` to select the corresponding display-face group. Even STEP face IDs are scoped to the display-mesh revision, not persistent CAD IDs across geometry/mapping changes. STL identities are triangle indices or remeshed surface tags.

Pass the `revision` returned by `studio_inspect_project({path})` as `expectedRevision` to `studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`. It applies 1–100 operations to a working copy and saves to a new `outputPath` only if all succeed. Stale revisions, unsupported operations and invalid inputs are rejected; input and existing output files are never overwritten. Responses include previous/new revisions, destination and a summary. Inspection revisions hash the exact input JSON independently of key order and may differ from a job's normalized `inputRevision`.

Supported methods are `selectTriangles`, `selectPlanarRegion`, `selectCylindricalRegion`, `clearSelection`, `addCondition`, `removeCondition`, `selectCondition`, `replaceConditionRegion`, `reapplyConditionRegion`, `setMaterial`, `setMaterialProperties`, `setMaterialPreset`, `setStudy`, `setMeshSettings`, `setInputProvenance`, and `setAnalysisIntent`. Supply positional arguments of the corresponding `studioApi` method in `args`; for example, `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`. `setInputProvenance` takes the evidence document below; `setAnalysisIntent` takes `{mode:"quantitative"|"exploratory"}`. Provenance and required-input contracts do not yet cover every physical model.

Including the additional `selectCadFace`, there are 17 methods; for example, `operations:[{"method":"selectCadFace","args":[0,2]}]`. CAD updates reset existing evidence entries to `unconfirmed` with `assumption:null` and remove confirmation. Recheck regions and evidence after updating geometry.

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

Browser `analysisApi.startJob`, `getJob`, `jobEvents`, `cancelJob`, `getJobResult`, and `releaseJob` use the same lifecycle. Callers supply `inputRevision` and `requestId` to `startJob`. Browser events contain summaries only, without intermediate mesh/field artifact storage. The optional connector below exposes these APIs through live MCP.

`studio_job_artifact({jobId,artifactId,point?,offset?,limit?})` retrieves an intermediate artifact registered under the `artifactId` from an event. It accepts no arbitrary path and verifies hashes, job input revision and associated mesh. The default response is a summary. Current fields are thermal temperature and transient-acoustic pressure scalars. For these, request interpolation at `point:[x,y,z]` in mm, or a node/value page using `offset` and `limit` (maximum 200), only when needed. Mesh-only artifacts provide coordinate pages; point interpolation requires a field. Registration is unavailable after job release. Final saved `job.final:true` means publication completed; assumed inputs can still retain `job.provisional:true`. Final publication does not mean non-provisional or physically validated results.

Call `studio_analyze` with `{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`. Probe `point` coordinates are mm; fields carry physical units. Use UI-saved projects and documented material properties within their valid scope.

Register with Codex (adjust location):

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

See [official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Copy `skills/airpocket-studio` into personal `.codex/skills/airpocket-studio` to install the skill.

Default MCP works with saved JSON; connector mode also invokes permitted browser operations. Use the UI for image/video exports. CPU execution does not verify browser rendering, GPU behavior or physical accuracy for arbitrary geometry.

`studio_material_catalog` retrieves installed polymer references; see [polymer library](polymer-library.md).

`studio_capabilities` returns Node execution capabilities and candidate engines. `studio_diagnose_execution` accepts a saved-project `path` and optional `method`/`adaptive` and returns execution-combination diagnostics with codes, severity, targets, evidence and suggestions. This is not complete unit/constraint/material/mesh preflight. Browser callers use `window.studioApi.getCapabilities()` and `diagnoseExecution(options)`.

## Temporary local connector (initial implementation)

Run `node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` with the page's exact origin. The 18 default tools gain `studio_browser_sessions` and `studio_browser_call`. Details appear on stderr; stdout stays MCP-only. In **Connect your own LLM**, enter the endpoint/code, select inspect/edit/analyze/view scopes, and explicitly connect. Only inspect is selected by default. Never publish the code or store it in URLs/projects.

The server binds only 127.0.0.1 and checks Origin, Host and Bearer credentials. Sessions expire after ten minutes without browser polls; process termination loses all sessions. Disconnect cancels jobs started by that connection. Reconnection requires a new grant and does not restore running jobs.

`studio_browser_call({sessionId,method,args})` supports:

- Inspect: `inspect` (revision/methods), `geometry`, `preflight`, `jobStatus`, `jobEvents`, `probe` (including provisional assessment).
- Edit: `edit({expectedRevision,operations})`, using the same 17 atomic operations; refuses revision conflicts, intervening changes, active jobs and revoked connections.
- Analysis: `startJob({inputRevision,requestId,operation,options})`, `cancelJob({jobId})`, `releaseJob({jobId})`, `showJob({jobId,name})`. Showing a solved result creates a case only when its input revision matches; mesh-only display is unsupported.
- View: `getView`/`setView` expose section/opacity/part settings; camera/image/video export is not connected.

At most 16 commands are pending, with a 15-second reply timeout. A timeout does not prove non-execution: inspect before retrying mutations. Local Chrome and real MCP verified edit→Worker solve→events→result display→0.04 mm probe→view change→disconnect. Browser intermediate-field retention, restart recovery, complete GUI job monitoring and public HTTPS-to-loopback connectivity/permissions remain unverified.
