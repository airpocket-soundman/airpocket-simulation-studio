# Operation correspondence (GUI / API / MCP / Skill)

[日本語](../operation-correspondence.md)

Companion to [API and MCP coverage](api-coverage.md). One row per browser operation (88) and per MCP tool (33: 31 default plus 2 when a browser origin is configured). `tests/operation-correspondence.test.mjs` compares the table with the operation and tool names in the source so it cannot silently drift.

- Scope/permission: browser operations use the scope in `src/browser-operation-names.js` (inspect/edit/analyze/view). MCP tools use the read-only/write annotation.
- GUI: page element ids found by name search in `src/main.js`, `src/ui/*.js` and the other modules that build the page; per-row generated buttons are marked as having no id. "no GUI control" means no id was found, not that the capability is absent.
- Skill: files under `skills/airpocket-studio` that mention the name. "none" means no dedicated description.
- "saved-file counterpart" in the MCP column is a separate operation on saved JSON, not the same operation.

## Browser operations

| Operation | Scope | MCP | GUI | Skill |
|---|---|---|---|---|
| `inspect` | inspect | `studio_inspect_project` (saved-file counterpart); `studio_browser_call` method=inspect | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md`, `references/geometry-imports.md`, `references/jobs-observations.md`, `references/physics-provenance.md`, `references/result-views.md`, `references/saved-inputs.md`, `SKILL.md` |
| `inspectInput` | inspect | `studio_browser_call` method=inspectInput | no GUI control | `references/browser-session.md`, `references/saved-inputs.md` |
| `geometry` | inspect | `studio_browser_call` method=geometry | `#geometry-inspect` `#geometry-report` | `references/browser-session.md`, `references/case-archives-measurements.md`, `references/geometry-imports.md`, `references/physics-provenance.md`, `references/saved-inputs.md`, `SKILL.md` |
| `inspectSurface` | inspect | `studio_browser_call` method=inspectSurface | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `checkGpuEnvironment` | inspect | `studio_browser_call` method=checkGpuEnvironment | `#gpu-check` `#gpu-environment` | `references/browser-session.md` |
| `createBuiltinProject` | edit | `studio_create_builtin_project` (saved-file counterpart); `studio_browser_call` method=createBuiltinProject | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `prepareFluidDomain` | edit | `studio_browser_call` method=prepareFluidDomain | `#internal-create` `#exterior-create` `#fluid-domain-info` | `references/browser-session.md`, `references/geometry-imports.md` |
| `applyCaseSource` | edit | `studio_browser_call` method=applyCaseSource | `#thermal-case-apply` `#vibration-create` | `references/browser-session.md`, `references/geometry-imports.md` |
| `clearCaseSource` | edit | `studio_browser_call` method=clearCaseSource | `#thermal-case-clear` `#vibration-clear` | `references/browser-session.md`, `references/geometry-imports.md` |
| `applyFluidDomainMesh` | edit | `studio_browser_call` method=applyFluidDomainMesh | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `inputImportBegin` | edit | `studio_browser_call` method=inputImportBegin | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `inputImportWrite` | edit | `studio_browser_call` method=inputImportWrite | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `inputImportCommit` | edit | `studio_browser_call` method=inputImportCommit | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `inputImportRelease` | edit | `studio_browser_call` method=inputImportRelease | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `preflight` | inspect | `studio_preflight_project` (saved-file counterpart); `studio_browser_call` method=preflight | no GUI control | `references/browser-session.md`, `references/geometry-imports.md`, `references/jobs-observations.md`, `references/physics-provenance.md`, `references/saved-inputs.md`, `SKILL.md` |
| `meshBoundaryPreflight` | inspect | `studio_preflight_mesh_boundaries` (saved-file counterpart); `studio_browser_call` method=meshBoundaryPreflight | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `previewEdit` | inspect | `studio_preview_edit` (saved-file counterpart); `studio_browser_call` method=previewEdit | no GUI control | `references/browser-session.md`, `references/physics-provenance.md`, `references/saved-inputs.md` |
| `listJobs` | inspect | `studio_browser_call` method=listJobs | no GUI control | `references/browser-session.md` |
| `jobStatus` | inspect | `studio_job_status` (saved-file counterpart); `studio_browser_call` method=jobStatus | no GUI control | `references/browser-session.md` |
| `jobEvents` | inspect | `studio_job_events` (saved-file counterpart); `studio_browser_call` method=jobEvents | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `jobArtifacts` | inspect | `studio_job_artifacts` (saved-file counterpart); `studio_browser_call` method=jobArtifacts | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `jobArtifact` | inspect | `studio_job_artifact` (saved-file counterpart); `studio_browser_call` method=jobArtifact | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `jobResultExport` | inspect | `studio_browser_call` method=jobResultExport | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `jobResultRead` | inspect | `studio_browser_call` method=jobResultRead | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `jobResultRelease` | inspect | `studio_browser_call` method=jobResultRelease | no GUI control | `references/browser-session.md`, `references/jobs-observations.md` |
| `probe` | inspect | `studio_probe` (saved-file counterpart); `studio_browser_call` method=probe | `#probe-result` `#sweep-results` | `references/browser-session.md`, `references/case-archives-measurements.md`, `references/jobs-observations.md`, `references/result-views.md` |
| `edit` | edit | `studio_edit_project` (saved-file counterpart); `studio_browser_call` method=edit | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md`, `references/geometry-imports.md`, `references/physics-provenance.md`, `references/result-views.md`, `references/saved-inputs.md`, `SKILL.md` |
| `startJob` | analyze | `studio_start_analysis` (saved-file counterpart); `studio_browser_call` method=startJob | `#solve-run` `#mesh-run` `#adaptive-run` | `references/browser-session.md` |
| `cancelJob` | analyze | `studio_cancel_job` (saved-file counterpart); `studio_browser_call` method=cancelJob | `#cancel-run` | `references/browser-session.md` |
| `releaseJob` | analyze | `studio_release_job` (saved-file counterpart); `studio_browser_call` method=releaseJob | no GUI control | `references/browser-session.md` |
| `showJob` | analyze | `studio_browser_call` method=showJob | no GUI control | `references/browser-session.md` |
| `getView` | view | `studio_browser_call` method=getView | `#clip-enabled` `#clip-axis` `#clip-position` `#clip-flip` `#part-visibility` `#model-opacity` | `references/browser-session.md` |
| `setView` | view | `studio_browser_call` method=setView | `#clip-enabled` `#clip-axis` `#clip-position` `#clip-flip` `#part-visibility` `#model-opacity` | `references/browser-session.md` |
| `getResultView` | inspect | `studio_browser_call` method=getResultView | `#result-field` `#result-mode` `#color-fixed` `#color-min` `#color-max` `#deform-scale` `#result-surface` `#result-surface-wire` `#volume-wire` `#acoustic-time-frame` `#result-section` | `references/browser-session.md`, `references/case-archives-measurements.md`, `references/result-views.md` |
| `setResultView` | view | `studio_browser_call` method=setResultView | `#result-field` `#result-mode` `#color-fixed` `#color-min` `#color-max` `#deform-scale` `#result-surface` `#result-surface-wire` `#volume-wire` `#acoustic-time-frame` `#result-section` | `references/browser-session.md`, `references/result-views.md` |
| `caseList` | inspect | `studio_browser_call` method=caseList | `#case-list` | `references/browser-session.md`, `references/case-archives-measurements.md`, `references/geometry-imports.md`, `references/jobs-observations.md`, `references/result-views.md` |
| `caseCompare` | inspect | `studio_compare_cases` (saved-file counterpart); `studio_browser_call` method=caseCompare | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseView` | edit | `studio_browser_call` method=caseView | `#case-list` (row buttons without ids) | `references/browser-session.md`, `references/result-views.md` |
| `caseRestoreInput` | edit | `studio_browser_call` method=caseRestoreInput | `#case-list` (row buttons without ids) | `references/browser-session.md`, `references/result-views.md` |
| `caseRename` | edit | `studio_browser_call` method=caseRename | `#case-name` (row buttons without ids) | `references/browser-session.md`, `references/result-views.md` |
| `caseRemove` | edit | `studio_browser_call` method=caseRemove | `#case-list` (row buttons without ids) | `references/browser-session.md`, `references/result-views.md` |
| `caseSave` | analyze | `studio_browser_call` method=caseSave | `#case-add` `#case-name` | `references/browser-session.md`, `references/result-views.md` |
| `exportCapabilities` | inspect | `studio_browser_call` method=exportCapabilities | `#visual-export-status` | `references/browser-session.md`, `references/result-views.md` |
| `startExport` | view | `studio_browser_call` method=startExport | `#view-png` `#animation-kind` `#animation-seconds` | `references/browser-session.md`, `references/result-views.md` |
| `exportStatus` | inspect | `studio_browser_call` method=exportStatus | `#visual-export-status` | `references/browser-session.md`, `references/result-views.md` |
| `exportArtifact` | inspect | `studio_browser_call` method=exportArtifact | `#visual-export-download` | `references/browser-session.md`, `references/result-views.md` |
| `cancelExport` | view | `studio_browser_call` method=cancelExport | `#animation-stop` | `references/browser-session.md`, `references/result-views.md` |
| `releaseExport` | view | `studio_browser_call` method=releaseExport | no GUI control | `references/browser-session.md`, `references/result-views.md` |
| `namedViewList` | inspect | `studio_browser_call` method=namedViewList | `#named-view-list` | `references/browser-session.md`, `references/result-views.md` |
| `namedViewExport` | inspect | `studio_browser_call` method=namedViewExport | `#named-view-export` | `references/browser-session.md`, `references/result-views.md` |
| `namedViewSave` | view | `studio_browser_call` method=namedViewSave | `#named-view-save` `#named-view-name` | `references/browser-session.md`, `references/result-views.md` |
| `namedViewApply` | view | `studio_browser_call` method=namedViewApply | `#named-view-list` (row buttons without ids) | `references/browser-session.md`, `references/result-views.md` |
| `namedViewRemove` | view | `studio_browser_call` method=namedViewRemove | `#named-view-list` (row buttons without ids) | `references/browser-session.md`, `references/result-views.md` |
| `namedViewImport` | view | `studio_browser_call` method=namedViewImport | `#named-view-import` | `references/browser-session.md`, `references/result-views.md` |
| `caseArchiveExport` | inspect | `studio_browser_call` method=caseArchiveExport | `#case-export` | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseArchiveRead` | inspect | `studio_browser_call` method=caseArchiveRead | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseArchiveImport` | edit | `studio_browser_call` method=caseArchiveImport | `#case-import` | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseArchiveWrite` | edit | `studio_browser_call` method=caseArchiveWrite | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseArchiveCommit` | edit | `studio_browser_call` method=caseArchiveCommit | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseArchiveRelease` | inspect | `studio_browser_call` method=caseArchiveRelease | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `getAssessment` | inspect | `studio_assessment` (saved-file counterpart); `studio_browser_call` method=getAssessment | `#fatigue-summary` `#fracture-summary` | `references/browser-session.md`, `references/physics-provenance.md` |
| `evaluateAssessment` | analyze | `studio_assess_result` (saved-file counterpart); `studio_browser_call` method=evaluateAssessment | `#fatigue-evaluate` `#fracture-evaluate` | `references/browser-session.md`, `references/physics-provenance.md` |
| `previewCadUpdate` | inspect | `studio_preview_cad_update` (saved-file counterpart); `studio_browser_call` method=previewCadUpdate | `#cad-update` | `references/browser-session.md`, `references/geometry-imports.md` |
| `applyCadUpdate` | edit | `studio_apply_cad_update` (saved-file counterpart); `studio_browser_call` method=applyCadUpdate | `#cad-update` | `references/browser-session.md`, `references/geometry-imports.md` |
| `printInspect` | inspect | `studio_inspect_print` (saved-file counterpart); `studio_browser_call` method=printInspect | `#print-file` `#print-report` | `references/browser-session.md`, `references/geometry-imports.md` |
| `importPrint` | edit | `studio_import_print` (saved-file counterpart); `studio_browser_call` method=importPrint | `#print-file` `#print-import` | `references/browser-session.md`, `references/geometry-imports.md` |
| `getPrintData` | inspect | `studio_browser_call` method=getPrintData | `#print-text-show` `#print-text` | `references/browser-session.md`, `references/geometry-imports.md` |
| `setPrintView` | view | `studio_browser_call` method=setPrintView | `#print-view` `#print-layer` `#print-all-layers` | `references/browser-session.md`, `references/geometry-imports.md` |
| `printTransferExport` | inspect | `studio_browser_call` method=printTransferExport | `#print-export` | `references/browser-session.md`, `references/geometry-imports.md` |
| `printTransferRead` | inspect | `studio_browser_call` method=printTransferRead | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `printTransferImport` | edit | `studio_browser_call` method=printTransferImport | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `printTransferWrite` | edit | `studio_browser_call` method=printTransferWrite | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `printTransferCommit` | edit | `studio_browser_call` method=printTransferCommit | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `printTransferRelease` | inspect | `studio_browser_call` method=printTransferRelease | no GUI control | `references/browser-session.md`, `references/geometry-imports.md` |
| `caseBundleList` | inspect | `studio_browser_call` method=caseBundleList | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseBundleExport` | inspect | `studio_browser_call` method=caseBundleExport | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseBundleRead` | inspect | `studio_browser_call` method=caseBundleRead | no GUI control | `references/browser-session.md` |
| `caseBundleImport` | edit | `studio_browser_call` method=caseBundleImport | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `caseBundleWrite` | edit | `studio_browser_call` method=caseBundleWrite | no GUI control | `references/browser-session.md` |
| `caseBundleCommit` | edit | `studio_browser_call` method=caseBundleCommit | no GUI control | `references/browser-session.md` |
| `caseBundleRelease` | inspect | `studio_browser_call` method=caseBundleRelease | no GUI control | `references/browser-session.md` |
| `measurementList` | inspect | `studio_browser_call` method=measurementList | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `measurementGet` | inspect | `studio_browser_call` method=measurementGet | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `measurementSave` | edit | `studio_browser_call` method=measurementSave | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `measurementRemove` | edit | `studio_browser_call` method=measurementRemove | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `measurementExport` | inspect | `studio_browser_call` method=measurementExport | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `measurementImport` | edit | `studio_browser_call` method=measurementImport | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |
| `measurementVerify` | inspect | `studio_verify_measurements` (saved-file counterpart); `studio_browser_call` method=measurementVerify | no GUI control | `references/browser-session.md`, `references/case-archives-measurements.md` |

## MCP tools

| Tool | Permission | Matching browser operation | GUI | Skill |
|---|---|---|---|---|
| `studio_preview_edit` | read-only | `previewEdit` | no GUI control | `references/saved-inputs.md` |
| `studio_browser_contracts` | read-only | none | no GUI control | `references/browser-session.md`, `references/physics-provenance.md`, `SKILL.md` |
| `studio_job_artifacts` | read-only | `jobArtifacts` | no GUI control | `references/jobs-observations.md`, `references/saved-inputs.md` |
| `studio_verify_measurements` | read-only | `measurementVerify` | no GUI control | `references/case-archives-measurements.md` |
| `studio_validate_case_bundle` | read-only | none | no GUI control | `references/case-archives-measurements.md` |
| `studio_import_print` | write/execute | `importPrint` | no GUI control | `references/geometry-imports.md` |
| `studio_inspect_print` | read-only | `printInspect` | no GUI control | `references/geometry-imports.md` |
| `studio_preview_cad_update` | read-only | `previewCadUpdate` | no GUI control | `references/geometry-imports.md` |
| `studio_apply_cad_update` | write/execute | `applyCadUpdate` | no GUI control | `references/geometry-imports.md` |
| `studio_assess_result` | write/execute | `evaluateAssessment` | no GUI control | `references/physics-provenance.md` |
| `studio_assessment` | read-only | `getAssessment` | no GUI control | `references/physics-provenance.md` |
| `studio_import_project` | write/execute | none | no GUI control | `references/saved-inputs.md` |
| `studio_create_builtin_project` | write/execute | `createBuiltinProject` | no GUI control | `references/saved-inputs.md` |
| `studio_preflight_project` | read-only | `preflight` | no GUI control | `references/saved-inputs.md` |
| `studio_job_artifact` | read-only | `jobArtifact` | no GUI control | `references/jobs-observations.md`, `references/saved-inputs.md` |
| `studio_edit_project` | write/execute | `edit` | no GUI control | `references/saved-inputs.md` |
| `studio_start_analysis` | write/execute | `startJob` | no GUI control | `references/jobs-observations.md`, `references/saved-inputs.md` |
| `studio_job_status` | read-only | `jobStatus` | no GUI control | `references/jobs-observations.md`, `references/saved-inputs.md` |
| `studio_preflight_mesh_boundaries` | read-only | `meshBoundaryPreflight` | no GUI control | `references/jobs-observations.md` |
| `studio_job_events` | read-only | `jobEvents` | no GUI control | `references/saved-inputs.md` |
| `studio_cancel_job` | write/execute | `cancelJob` | no GUI control | `references/saved-inputs.md` |
| `studio_release_job` | write/execute | `releaseJob` | no GUI control | `references/saved-inputs.md` |
| `studio_capabilities` | read-only | none | no GUI control | `references/saved-inputs.md`, `SKILL.md` |
| `studio_diagnose_execution` | read-only | none | no GUI control | `references/saved-inputs.md` |
| `studio_material_catalog` | read-only | none | no GUI control | `references/saved-inputs.md` |
| `studio_progress` | read-only | none | no GUI control | `references/development-progress.md`, `references/saved-inputs.md`, `SKILL.md` |
| `studio_inspect_project` | read-only | `inspect` | no GUI control | `references/geometry-imports.md`, `references/saved-inputs.md` |
| `studio_analyze` | write/execute | none | no GUI control | `references/saved-inputs.md` |
| `studio_probe` | read-only | `probe` | no GUI control | `references/jobs-observations.md`, `references/physics-provenance.md`, `references/saved-inputs.md` |
| `studio_compare_cases` | read-only | `caseCompare` | no GUI control | `references/case-archives-measurements.md` |
| `studio_validate_cases` | read-only | none | no GUI control | `references/case-archives-measurements.md`, `references/saved-inputs.md` |
| `studio_browser_sessions` | read-only | none | `#agent-connection` | `references/browser-session.md` |
| `studio_browser_call` | live-write (scope per method) | none | `#agent-connection` | `references/browser-session.md`, `references/saved-inputs.md` |
