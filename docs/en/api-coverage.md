# User feature and API/MCP coverage

[日本語](../api-coverage.md)

As of 2026-10-14. The main differentiator is enabling the user's own LLM to operate every feature through a specialized SKILL. Closing the gaps below has the highest priority. This is an initial inventory by feature group; coverage of individual operations has not yet been measured.

Current entry points have 30 default/32 connected MCP tools and 86 browser operations; the minimal connector has three tools. Preserve historical counts below. Current comparison validation, actual-browser and publication completion remain pending.

| Feature group | Current shared/browser API | Current MCP | Next work |
|---|---|---|---|
| Operation contract discovery | studioApi.getBrowserOperationContracts | studio_browser_contracts (no session; maximum 10 entries/65,536 UTF-8 bytes) | Nested applicability/physical validation stays in adapters |
| Live sessions | browser-session and shared APIs | Optional studio_browser_sessions/studio_browser_call (82 scoped methods) | Local GUI job monitoring verified; continue public HTTPS connectivity and reconnection |
| Capabilities | studioApi.getCapabilities; diagnoseExecution/preflight.selectedObservation (profile selection) | studio_capabilities; selectedObservation in diagnosis/preflight and MCP-only runtime | Extend required inputs, validity limits and all combinations |
| Execution-combination diagnostics | studioApi.diagnoseExecution | studio_diagnose_execution | Extend structured diagnostics to units, required values, constraints and mesh |
| Edit candidate preview | studioApi.previewOperations | studio_preview_edit; inspect-scope previewEdit | Nested physical validation and full P0/P1/P3 remain |
| Preflight and provenance | studioApi.preflight/setInputProvenance/setAnalysisIntent, analysis execution gate | studio_preflight_project, studio_edit_project (evidence and intent persistence) | Remaining physical-combination contracts; integration with post-mesh checks |
| Saved-input inspection/restoration | studioApi.loadProject/exportProject/getSummary/getRevision/applyOperations, builtinProjectApi.create | studio_inspect_project (inspection/revision/dimensions/pages of up to 50 faces), studio_edit_project (atomic editing/new save), studio_create_builtin_project and connector createBuiltinProject (built-in geometry) | Verify individual operations and coverage of all creation paths |
| STEP/STL import | UI/CAD Worker, project-import, inputImportApi/Transfer | studio_import_project (saved JSON); connected inputImportBegin/Write/Commit/Release (STEP/STL) | Extend supported geometry and measure large inputs |
| Regions, conditions, materials and analysis settings | studioApi selection/condition/material/study operations, selectCadFace, applyOperations | studio_edit_project (18 operations including evidence/intent/display-face-ID selection, revision-conflict detection) | Evidence/input contracts for all physical models; verify remaining selection/setting-operation coverage |
| Volume mesh and analysis | guiAnalysisJobs.run, analysisApi.startJob/listJobs/getJob/getJobResult/releaseJob (legacy generateMesh/analyze retained) | studio_analyze, studio_start_analysis/studio_job_status/studio_release_job (CPU, saved JSON) | Live-browser connection and restart recovery |
| Intermediate observations | analysisApi.jobEvents/listJobArtifacts/getJobArtifact (optional thermal/acoustic scalar and nonlinear-step displacement fields) | studio_job_events, studio_job_artifacts (metadata catalog), studio_job_artifact (registered artifact hash verification, summaries, body-aware point interpolation and pages of up to 200 nodes/values with nodeBodies) | Extend solver observation coverage; finish operation breakdown and delivery contracts |
| Cancellation | analysisApi.cancel/cancelJob/isBusy/drainJobs/closeJobsAsync | studio_cancel_job (running only; unavailable during saving) | Connector cancelJob available; local GUI monitoring verified; continue public connection checks |
| Point measurements | analysisApi.probe, resultViewApi.probe, window.measurementApi (fixed revision/display snapshot history) | studio_probe, connector probe and seven measurement methods; studio_verify_measurements | History GUI and expanded result-kind coverage |
| Cases and comparison | caseApi/caseOperations/caseArchiveTransfer (IDs, content revisions, assessment checks, chunked transfers and v2 measurement bundling) | studio_validate_cases and connector caseList/caseSave/caseView/caseRestoreInput/caseRename/caseRemove and caseArchiveExport/caseArchiveRead/caseArchiveImport/caseArchiveWrite/caseArchiveCommit/caseArchiveRelease; caseBundleList and six transfer methods; studio_validate_case_bundle | Cross-result mapping and extended named views |
| Sections and part visibility | viewApi | Connector getView/setView | Shared view-setting, layer and camera contracts |
| Results, time, modes and camera | resultViewApi.get/set/probe, fixed colors and layers | Connector getResultView/setResultView/probe | Thermal stored frames and view synchronization across different results |
| Named views | namedViewApi.list/save/apply/remove/export/import | Connector namedViewList/namedViewSave/namedViewApply/namedViewRemove/namedViewExport/namedViewImport | Application to different results |
| PNG/WebM and animation | visualExportApi and shared renderer | Connector exportCapabilities/startExport/exportStatus/exportArtifact/cancelExport/releaseExport | Persistence, MP4/GIF and deterministic fixed-frame export |
| CAD updates | cadUpdateApi.preview/apply (input/replacement revisions), existing studioApi operations | studio_preview_cad_update / studio_apply_cad_update; live previewCadUpdate / applyCadUpdate | Chunked live transfer for large CAD; region reselection and evidence reconfirmation after updates |
| Material catalog | studioApi.applyCatalogMaterial; catalog UI requires applicability | studio_material_catalog; applyCatalogMaterial via studio_edit_project/connected edit | Extend applicability/evidence contracts to all material models |
| Fatigue and fracture evaluation | resultAssessmentApi.evaluate/get | studio_assess_result/studio_assessment and connector evaluateAssessment/getAssessment | Extend physical scope and verify live rendering |
| 3MF/G-code | printOperations inspect/import/get/set/export, printTransfer and UI | studio_import_print/studio_inspect_print; connected printInspect/importPrint/getPrintData/setPrintView and six printTransfer methods | Analysis using layer/infill properties |

The specialized SKILL at `skills/airpocket-studio/SKILL.md` describes current capabilities, diagnostics, sources and limits. Update it alongside new operations and validate successful examples as well as rejection/repair paths. Current MCP can retrieve intermediate summaries and optional mesh/time-field files for saved-input CPU jobs, and optional connector mode exposes 82 permitted browser operations. Retention is within the same Node process, with defaults of 32 jobs and 256 events per job. See the [operation specification](automation.md) for cursor-gap reporting, retained-request `requestId` idempotency, provisional labels, cancellation restrictions during saving and the 64 MB field-storage limit. Do not present target specifications as available operations.

P0 is in progress. Remaining work includes breaking every row down into individual operations, required inputs/validity limits, diagnostics with units, Japanese/English operation mappings and visual verification.

Face IDs are scoped to the display mesh's SHA-256 revision, not persistent CAD IDs for either STEP or STL. CAD updates reset existing evidence to unconfirmed, clear assumptions and confirmation records, and require rechecking.

Export start/cancel/release require view scope; capabilities/status/base64 artifacts require inspect scope. Retention is 32 MiB/four jobs, with chunks up to 65,536 bytes and SHA-256 verification. No automatic downloads or persistence. WebM records in real time at 24 fps, including stored transient-acoustic frame playback; deterministic fixed-frame export and MP4/GIF remain unsupported. See the [operation specification](automation.md).

Live CAD replacement JSON accepts canonical imported STEP display meshes only: `kind:"cad"`, with only `positions`, `faceIds`, `kind` and optional nonempty `sourceHash`. Positions must be exactly Float32-representable; there is no automatic rounding or removal of extra metadata. Saved-JSON MCP is unaffected. Prefer actual STEP paths for engineering updates.

Fluid-domain preparation/mesh-display application is shared through window.fluidDomainApi.prepare/applyMesh and connected prepareFluidDomain/applyFluidDomainMesh. Physical settings and general-flow solver coverage remain separate checks.

Saved thermal/modal coupling sources use caseSourceApi.apply/clear and connected applyCaseSource/clearCaseSource with revision/physics checks, without inferring domains or physical amplitudes.

Surface inspection is available through connected inspectSurface/studio_inspect_project.surfaceInspection with revision-bound pages over all problem indices. Exact CAD, self-intersections and automatic repair remain outside scope.

Structured P1/P2 Stokes GMRES residuals use existing jobEvents with phase/residualKind distinguishing measured preconditioned, estimated and final numerical checks; no intermediate fields are added.

Harmonic/sweep BiCGStab residuals and frequency-step start/complete, plus channel PCG residuals, use existing jobEvents. Profile counts remain13/12 and tool/live-operation counts are unchanged. Neither path adds field arrays; recurrence convergence is not physical accuracy or job success.

Saved-input jobs add an opt-in --analysis-isolation=process child-process route. Default worker/browser paths remain;runtime-failure containment is distinct from V8 root-cause resolution.

Nonlegacy preflight includes isotropic modal and static orthotropic linear-structure contracts, alongside static isotropic/thermal/acoustic/limited-flow contracts. Modal temperature-table interpolation is supported at an explicit uniform temperature. Explicit numerical mode counts/iteration limits need no physical evidence. See [contracts](automation.md) for material, boundary and applicability evidence; legacy behavior and completePreflight:false remain unchanged.

Nonlegacy evidence contracts also cover static temperature evaluation, thermal stress, small-strain J2 and compressible Neo-Hookean structure. Thermal source mesh/temperature evidence remains required with or without caseReference; source provisional status propagates. See [contracts](automation.md) for physical history versus numerical settings, CPU limits, field-snapshot size and authenticity limits.

Worker/shared hosts/GUI wrappers/jobs/MCP preserve bounded failure schema1 metadata (maximum 16,384 UTF-8 bytes), distinguishing typed constraint/boundary diagnostics from generic stage fallbacks. Paths include job.error.failure, executionError.failure, direct MCP structuredContent.error.failure and optional diagnostic events, without delivery/root-cause-repair/physical-accuracy guarantees. Legacy messages/JOB_* codes and counts (13/12 profiles, 27/29 tools, 80 live methods) remain. See [specification](automation.md).

Current counts are 28 default/30 connector MCP tools and 80 live operations. studio_browser_contracts accepts method/scope/offset/limit to discover schema1 argument envelopes, revisions, units, effects and limitations before pairing. declarationOnly grants no permission and does not guarantee complete JSON Schema validation or adapter availability. Direct thrown-operation failures retain failure metadata through the HTTP bridge, using the existing jobStatus diagnostic format. See [workflow](automation.md). Earlier 27/29 counts record the scope when those increments were added.

Edit preview returns changed pointers (maximum 100), candidate revision and preflight without changing input, saving files or running a solver. Optional expectedResultingRevision on edit/studio_edit_project requires the committed candidate to match the reviewed revision. Counts are 29 default/31 connector tools and 81 live operations. preflight.allowed:false still returns diagnostics; inspecting next settings during computation does not change the active job. See [workflow](automation.md); earlier counts record previous increments.

Preview preserves full-inspection allowed/provisional while compacting diagnostics to 50 and evidence pointers to 100 with explicit totals/omission. Returned value JSON is capped at 65,536 UTF-8 bytes. Review GUI-shared representation changes when browser normalization.requiresReview is true and commit only the final candidate revision; Node saved-input candidates can differ.

Input-value inspection uses studioApi.inspectInput/live inspectInput (inspect scope) and studio_inspect_project section opt-in. Section-scoped pointers and input revisions page material/study/boundary/evidence/selection/source/mesh inputs at maximum 50 object members or 200 array entries/string UTF-16 units; nested payloads become count/canonical-JSON-hash descriptors. Value replies are capped at 65,536 UTF-8 bytes and report only known units. Legacy no-section unbounded study replies are separate. Counts are 29/31 tools and 82 live methods. See [specification](automation.md) for CAS examples/compatibility limits.

## Saved-case comparison increment (validation record pending)

Shared `createCaseComparisonApi({cases}).compare`, browser inspect operation `caseCompare`, and MCP `studio_compare_cases` compare saved cases at the same optional global point in mm without changing display state. Pin revisions for 1–8 cases and explicitly select modes/stored frames. No deltas for normalized modal shapes or time interpolation are provided. Raw units include stress Pa and plastic strain ratio 1. Incompatible kind/field/unit/time/frequency yields no-delta reasons; corrupt cases, unknown bodies and stale leases/guards reject the batch.

MCP accepts version-1 saved-case archives. A path-only call without references lists snapshot-local IDs and case/archive revisions; comparison requires expectedArchiveRevision and checks source hashes before and after reading. Bundles are unsupported. Shared and MCP response JSON values are bounded to 64 KiB, not the entire MCP wire envelope. Missing calculation runtimeIdentity is not reconstructed from today's environment. See [automation](automation.md). Current successful counts, actual-browser and publication completion remain pending; P0–P6 remain incomplete.

Transient comparisons require exact equality of stored physical time (no interpolation, no tolerance). SPL comparisons with different `referencePressurePa` return `different-reference-pressure` and no delta; raw pressure in Pa can still be compared despite differing reference pressure.
