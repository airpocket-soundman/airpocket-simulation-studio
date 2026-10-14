# User feature and API/MCP coverage

[日本語](../api-coverage.md)

As of 2026-10-14. The main differentiator is enabling the user's own LLM to operate every feature through a specialized SKILL. Closing the gaps below has the highest priority. This is an initial inventory by feature group; coverage of individual operations has not yet been measured.

| Feature group | Current shared/browser API | Current MCP | Next work |
|---|---|---|---|
| Live sessions | browser-session and shared APIs | Optional studio_browser_sessions/studio_browser_call (68 scoped methods) | Local GUI job monitoring verified; continue public HTTPS connectivity and reconnection |
| Capabilities | studioApi.getCapabilities | studio_capabilities | Extend required inputs, validity limits and all combinations |
| Execution-combination diagnostics | studioApi.diagnoseExecution | studio_diagnose_execution | Extend structured diagnostics to units, required values, constraints and mesh |
| Preflight and provenance | studioApi.preflight/setInputProvenance/setAnalysisIntent, analysis execution gate | studio_preflight_project, studio_edit_project (evidence and intent persistence) | Required-input contracts beyond static isotropic linear structure; integration with post-mesh checks |
| Saved-input inspection/restoration | studioApi.loadProject/exportProject/getSummary/getRevision/applyOperations | studio_inspect_project (inspection/revision/dimensions/pages of up to 50 faces), studio_edit_project (atomic editing/new save), studio_create_builtin_project (built-in geometry) | Verify individual operations and coverage of all creation paths |
| STEP/STL import | UI/CAD Worker, shared project-import creation functions | studio_import_project (STEP/STP, STL with explicit unit scale, new saved JSON) | Extend shared browser import paths and supported geometry |
| Regions, conditions, materials and analysis settings | studioApi selection/condition/material/study operations, selectCadFace, applyOperations | studio_edit_project (18 operations including evidence/intent/display-face-ID selection, revision-conflict detection) | Evidence/input contracts for all physical models; verify remaining selection/setting-operation coverage |
| Volume mesh and analysis | guiAnalysisJobs.run, analysisApi.startJob/listJobs/getJob/getJobResult/releaseJob (legacy generateMesh/analyze retained) | studio_analyze, studio_start_analysis/studio_job_status/studio_release_job (CPU, saved JSON) | Live-browser connection and restart recovery |
| Intermediate observations | analysisApi.jobEvents/getJobArtifact (optional browser-memory fields) | studio_job_events, studio_job_artifact (registered artifact hash verification, summaries, point interpolation and pages of up to 200 nodes/values) | Extend solver observation coverage; finish operation breakdown and delivery contracts |
| Cancellation | analysisApi.cancel/cancelJob | studio_cancel_job (running only; unavailable during saving) | Connector cancelJob available; local GUI monitoring verified; continue public connection checks |
| Point measurements | analysisApi.probe, resultViewApi.probe, window.measurementApi (fixed revision/display snapshot history) | studio_probe, connector probe and six measurement methods | History GUI; case bundling and validation against complete results |
| Cases and comparison | caseApi/caseOperations/caseArchiveTransfer (IDs, content revisions, assessment checks and chunked transfers) | studio_validate_cases and connector caseList/caseSave/caseView/caseRestoreInput/caseRename/caseRemove and caseArchiveExport/caseArchiveRead/caseArchiveImport/caseArchiveWrite/caseArchiveCommit/caseArchiveRelease; caseBundleList and six transfer methods; studio_validate_case_bundle | Cross-result mapping and extended named views |
| Sections and part visibility | viewApi | Connector getView/setView | Shared view-setting, layer and camera contracts |
| Results, time, modes and camera | resultViewApi.get/set/probe, fixed colors and layers | Connector getResultView/setResultView/probe | Thermal stored frames and view synchronization across different results |
| Named views | namedViewApi.list/save/apply/remove/export/import | Connector namedViewList/namedViewSave/namedViewApply/namedViewRemove/namedViewExport/namedViewImport | Case-archive bundling and application to different results |
| PNG/WebM and animation | visualExportApi and shared renderer | Connector exportCapabilities/startExport/exportStatus/exportArtifact/cancelExport/releaseExport | Persistence, MP4/GIF and deterministic fixed-frame export |
| CAD updates | cadUpdateApi.preview/apply (input/replacement revisions), existing studioApi operations | studio_preview_cad_update / studio_apply_cad_update; live previewCadUpdate / applyCadUpdate | Chunked live transfer for large CAD; region reselection and evidence reconfirmation after updates |
| Material catalog | studioApi.applyCatalogMaterial; catalog UI requires applicability | studio_material_catalog; applyCatalogMaterial via studio_edit_project/connected edit | Extend applicability/evidence contracts to all material models |
| Fatigue and fracture evaluation | resultAssessmentApi.evaluate/get | studio_assess_result/studio_assessment and connector evaluateAssessment/getAssessment | Extend physical scope and verify live rendering |
| 3MF/G-code | printOperations inspect/import/get/set/export, printTransfer and UI | studio_import_print/studio_inspect_print; connected printInspect/importPrint/getPrintData/setPrintView and six printTransfer methods | Analysis using layer/infill properties |

The specialized SKILL at `skills/airpocket-studio/SKILL.md` describes current capabilities, diagnostics, sources and limits. Update it alongside new operations and validate successful examples as well as rejection/repair paths. Current MCP can retrieve intermediate summaries and optional mesh/time-field files for saved-input CPU jobs, and optional connector mode exposes 68 permitted browser operations. Retention is within the same Node process, with defaults of 32 jobs and 256 events per job. See the [operation specification](automation.md) for cursor-gap reporting, retained-request `requestId` idempotency, provisional labels, cancellation restrictions during saving and the 64 MB field-storage limit. Do not present target specifications as available operations.

P0 is in progress. Remaining work includes breaking every row down into individual operations, required inputs/validity limits, diagnostics with units, Japanese/English operation mappings and visual verification.

Face IDs are scoped to the display mesh's SHA-256 revision, not persistent CAD IDs for either STEP or STL. CAD updates reset existing evidence to unconfirmed, clear assumptions and confirmation records, and require rechecking.

Export start/cancel/release require view scope; capabilities/status/base64 artifacts require inspect scope. Retention is 32 MiB/four jobs, with chunks up to 65,536 bytes and SHA-256 verification. No automatic downloads or persistence. WebM records in real time at 24 fps, including stored transient-acoustic frame playback; deterministic fixed-frame export and MP4/GIF remain unsupported. See the [operation specification](automation.md).

Live CAD replacement JSON accepts canonical imported STEP display meshes only: `kind:"cad"`, with only `positions`, `faceIds`, `kind` and optional nonempty `sourceHash`. Positions must be exactly Float32-representable; there is no automatic rounding or removal of extra metadata. Saved-JSON MCP is unaffected. Prefer actual STEP paths for engineering updates.
