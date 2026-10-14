# MCP and dedicated skill

[日本語](../automation.md)

`npm run mcp` starts a local stdio MCP server implementing the [2025-11-25 tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx), with no new library dependency. Run `npm ci` and `npm run build` first to prepare WASM assets.

Fourteen tools: `studio_capabilities`, `studio_diagnose_execution`, `studio_material_catalog`, `studio_progress`, `studio_inspect_project`, `studio_edit_project`, `studio_analyze`, `studio_probe`, `studio_validate_cases`, and the five job operations below. Use absolute local JSON paths. Analysis writes the complete result to a new `outputPath` and returns metrics. Input and existing outputs are not overwritten. The same browser CPU Worker runs in an isolated Node worker with a 120-second computation limit. Airpocket CPU and MFEM are supported; WebGPU is excluded.

## Atomic saved-input editing

Pass the `revision` returned by `studio_inspect_project({path})` as `expectedRevision` to `studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`. It applies 1–100 operations to a working copy and saves to a new `outputPath` only if all succeed. Stale revisions, unsupported operations and invalid inputs are rejected; input and existing output files are never overwritten. Responses include previous/new revisions, destination and a summary. Inspection revisions hash the exact input JSON independently of key order and may differ from a job's normalized `inputRevision`.

Supported methods are `selectTriangles`, `selectPlanarRegion`, `selectCylindricalRegion`, `clearSelection`, `addCondition`, `removeCondition`, `selectCondition`, `replaceConditionRegion`, `reapplyConditionRegion`, `setMaterial`, `setMaterialProperties`, `setMaterialPreset`, `setStudy`, and `setMeshSettings`. Supply positional arguments of the corresponding `studioApi` method in `args`; for example, `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`. A complete material/condition provenance schema and STEP import through MCP remain unsupported.

Browser callers use `await studioApi.getRevision()` and `await studioApi.applyOperations(operations,{expectedRevision})`. Changes are applied once after validation; intervening input changes also cause a conflict. MCP saved-input editing does not change an open browser.

## Asynchronous jobs and intermediate results

Call `studio_start_analysis` with `path`, a new `outputPath`, required `requestId` (1–200 characters), and optional `operation: "solve" | "mesh"`, `size`, `method`, `adaptive`, and `includeFields`. It freezes the input and immediately returns a `jobId` and an `inputRevision` derived from the normalized project's SHA-256. Retrying the same request ID with identical input/settings/destination returns the retained job; reuse with different content is rejected.

- `studio_job_status({jobId})` returns `running`, `saving`, `succeeded`, `failed`, `cancelled`, or `timed_out`, plus the final artifact summary when available.
- `studio_job_events({jobId,afterSequence,limit})` retrieves events after a sequence cursor (default 50, maximum 100). Use the returned `nextSequence` as the next cursor and drain remaining pages when `hasMore` is true. An empty page does not mean completion.
- `studio_cancel_job({jobId})` stops a running Worker. Terminal jobs stay unchanged; the final publication stage `saving` cannot be cancelled.
- `studio_release_job({jobId})` frees a terminal job's metadata, events and request ID, retaining saved files. Retrying a released request ID can start a new job.

Jobs live only in the same MCP/Node process; restart recovery and reconnection are unsupported. Defaults retain 32 jobs and 256 events per job. Dropped events are reported through `truncated:true` and `firstAvailableSequence`; inspect status and available artifacts instead of guessing missing observations. Direct Node callers must also retain the same process. `studio_analyze` remains the final-response operation.

Events carry `jobId`, `inputRevision`, and `sequence`; intermediate snapshots carry `provisional:true`. Only observations actually emitted by the selected solver are available, including mesh/quality, iterative residuals, supported time fields and adaptive stages. This does not guarantee every iteration or field from every solver. With `includeFields:true`, provisional mesh/time-field JSON is saved in a new `outputPath + ".intermediate"` directory. Event artifact references contain a path, byte count and SHA-256; field JSON includes a `meshArtifact` reference when the corresponding mesh was saved, reset on remeshing. Existing directories are refused. The default aggregate limit is 64 MB (64,000,000 bytes); beyond it, an `observation-limit` event is emitted and summaries and computation continue without further field storage. Already written provisional files may remain after failure/cancellation. Even final saved results labeled `provisional:false` require convergence and physical-accuracy checks.

Browser `analysisApi.startJob`, `getJob`, `jobEvents`, `cancelJob`, `getJobResult`, and `releaseJob` use the same lifecycle. Callers supply `inputRevision` and `requestId` to `startJob`. Browser events contain summaries only, without intermediate mesh/field artifact storage. This does not connect MCP to a live browser.

Call `studio_analyze` with `{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`. Probe `point` coordinates are mm; fields carry physical units. Use UI-saved projects and documented material properties within their valid scope.

Register with Codex (adjust location):

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

See [official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Copy `skills/airpocket-studio` into personal `.codex/skills/airpocket-studio` to install the skill.

MCP works with local saved JSON without changing an open browser. Use the UI for image/video exports. CPU execution does not verify browser rendering, GPU behavior or physical accuracy for arbitrary geometry.

`studio_material_catalog` retrieves installed polymer references; see [polymer library](polymer-library.md).

`studio_capabilities` returns Node execution capabilities and candidate engines. `studio_diagnose_execution` accepts a saved-project `path` and optional `method`/`adaptive` and returns execution-combination diagnostics with codes, severity, targets, evidence and suggestions. This is not complete unit/constraint/material/mesh preflight. Browser callers use `window.studioApi.getCapabilities()` and `diagnoseExecution(options)`.
