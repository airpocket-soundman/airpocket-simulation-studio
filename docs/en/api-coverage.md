# User feature and API/MCP coverage

[日本語](../api-coverage.md)

As of 2026-10-14. The main differentiator is enabling the user's own LLM to operate every feature through a specialized SKILL. Closing the gaps below has the highest priority. This is an initial inventory by feature group; coverage of individual operations has not yet been measured.

| Feature group | Current shared/browser API | Current MCP | Next work |
|---|---|---|---|
| Capabilities | studioApi.getCapabilities | studio_capabilities | Extend required inputs, validity limits and all combinations |
| Execution-combination diagnostics | studioApi.diagnoseExecution | studio_diagnose_execution | Extend structured diagnostics to units, required values, constraints and mesh |
| Saved-input inspection/restoration | studioApi.loadProject/exportProject/getSummary/getRevision/applyOperations | studio_inspect_project (inspection/revision), studio_edit_project (atomic editing of existing saved input into a new file) | New-model creation and STEP import through MCP |
| STEP/STL import | UI and CAD Worker | Unsupported | Shared file/byte-input operations |
| Regions, conditions, materials and analysis settings | studioApi selection/condition/material/study operations, applyOperations | studio_edit_project (14 selection/condition/material/study/mesh-setting operations with revision-conflict detection) | Complete provenance schema; verify remaining selection/setting-operation coverage |
| Volume mesh and analysis | analysisApi.generateMesh/analyze, startJob/getJob/getJobResult/releaseJob | studio_analyze, studio_start_analysis/studio_job_status/studio_release_job (CPU, saved JSON) | Live-browser connection and restart recovery |
| Intermediate observations | analysisApi.jobEvents (summaries only) | studio_job_events (job ID, input revision, sequence, provisional labels and optional mesh/time-field artifact references) | Extend solver observation coverage; finish operation breakdown and delivery contracts |
| Cancellation | analysisApi.cancel/cancelJob | studio_cancel_job (running only; unavailable during saving) | Live-browser cancellation through MCP |
| Point measurements | analysisApi.probe | studio_probe (saved results) | Associate live-result revisions and provisional values |
| Cases and comparison | caseApi | studio_validate_cases (saved-case validation/comparison) | MCP save, restore, add, remove and display |
| Sections and part visibility | viewApi | Unsupported | Shared view-setting, layer and camera contracts |
| Time and mode selection | UI | Unsupported | Semantic operations tied to result revisions |
| PNG/WebM and animation | visual-export UI handling | Unsupported | Export API, jobs, cancellation and artifact retrieval |
| CAD updates | studioApi.previewCadUpdate/applyCadUpdate | Unsupported | MCP import, matching and reselection |
| Material catalog | Catalog UI and shared data | studio_material_catalog | Shared application operations including assumptions and applicability |
| Fatigue and fracture evaluation | analysisApi.evaluateFatigue/evaluateFracture | Dedicated operations unsupported | Shared evaluation-input and result contracts |
| 3MF/G-code | printImportApi and UI | Unsupported | Shared import, layer-selection and export contracts |

The specialized SKILL at `skills/airpocket-studio/SKILL.md` describes current capabilities, diagnostics, sources and limits. Update it alongside new operations and validate successful examples as well as rejection/repair paths. Current MCP can retrieve intermediate summaries and optional mesh/time-field files for saved-input CPU jobs, but cannot connect to an open browser. Retention is within the same Node process, with defaults of 32 jobs and 256 events per job. See the [operation specification](automation.md) for cursor-gap reporting, retained-request `requestId` idempotency, provisional labels, cancellation restrictions during saving and the 64 MB field-storage limit. Do not present target specifications as available operations.

P0 is in progress. Remaining work includes breaking every row down into individual operations, required inputs/validity limits, diagnostics with units, Japanese/English operation mappings and visual verification.
