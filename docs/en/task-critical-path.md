# Whole-task audit and completion path

[日本語](../task-critical-path.md)

As of 2026-10-21, there are171 tasks,134 released and37 unfinished. Classification prioritizes work; it does not advance status without implementation and evidence.

2026-10-28: In `src/progress.json`, `depends` means prerequisites only (work that must be released first). Membership in an umbrella epic (P0–P6, MOD1) is recorded in `parents`, and non-blocking links in `related`. Every `depends` entry of a released task must itself be released; `validateProgress` enforces this. The 63 released children that preceded unfinished parents were split into `parents`/`related`; no status changed.

| Classification | Existing IDs | Conditions |
|---|---|---|
| Autonomous implementation/verification(15) | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, AGENTACP1, AGENTCHAT1, RESULTCURVE1 | Includes substantial physics work; autonomous does not mean finishable in one batch. Missing measurement conditions keep work open. |
| External/device conditions(7) | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, EXPORTBACKGROUND1, FINITEVISCO1 | Physical prototypes/material calibration, V8 reproduction/upstream fixes, registered SDK verification and public-browser version evidence. Continue independent software work while waiting. |
| Parent epics(15) | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | Publishing a slice does not complete its parent. Keep existing acceptance and common completion criteria. |

## 2026-10-21: Six started tasks outside the existing orders

Audited all six started tasks outside IDs21–40. MCPARGUMENTTYPES1 completes after actual registered SDK declarations and tool calls were verified ([evidence](../evidence/2026-10-21-registered-sdk-argument-types.json)). Five retain implementation, measurement or device conditions; [orders41–45](../opencode-release-work-orders-2026-10-21/README.md) specify their remaining work and release gates. The nine initial review rejections described below were repaired, re-reviewed and merged through PR148. A successful slice does not complete its parent.

## 2026-10-21: independent OpenCode PR review

All twenty exact PR heads were reviewed after user clarification: eleven accepted for integration, nine requiring changes. Integration resolves shared UI conflicts and passes129 targeted tests plus five contract declarations. Combined full CI, normal merge and publication verification remain distinct stages. See [review reproductions](../evidence/2026-10-21-opencode-pr-review.json) and [next twenty work orders](../opencode-work-orders-2026-10-21/README.md). Preserve171 tasks,133 released,38 unfinished; parent acceptance is not closed and unmerged physics/connectivity is not advertised.

## Dependencies and current batch

P0->P1->P3 and P0->P4 are key publication-workflow paths. P5 depends on all P1/P2/P3/P4. Five of six publication gates remain open; completed evidence is candidate-specific and must align on the final candidate before product publication is considered complete.

This batch groups REG2 spherical dimensional regions, VIEWCOMPARE time/deformation GIF and UIIMPROVE1 preflight-to-repair navigation. Verify CAD area/load conservation, physical time versus visualization scale, and consistency with existing preflight/input revisions before one publication. General curved faces, MP4, physical accuracy and parent-task completion are outside this evidence. The completed PR124/main CI baseline is1570(1567passed,3skipped,0failed);this candidate's final CI is recorded separately.

Reconciled four existing unpublished plans: AGENTACP1,AGENTCHAT1,RESULTCURVE1,FINITEVISCO1. Original working files and the existing MOD1 state are preserved; all four are queued. The previous34 unfinished plus four newly accounted tasks gives38,not a regression in completion. See the [reconciliation record](../evidence/2026-10-19-planning-reconciliation.json). Next work builds ACP/conversation connectivity and revisioned physical loading increments on existing APIs/MCP/module boundaries. Finite viscoelastic-plastic calibration and experimental comparisons need data and staged verification; existing J2,Neo-Hookean or visualization scaling are not substitutes.

## History: PR124 bounded openings and UI research

Published bounded CFDPORT1 half-space caps through GUI/API/MCP, separating localhost Chrome input/extraction/selection/JSON replay from formal MCP through a separate Node host. Arbitrary opening wires,local lids and general volume joins remain open. UIRESEARCH1 completed versioned primary-document comparison only;hands-on six-case and measured usability work remains UIIMPROVE1. There are133 released/34 unfinished(12autonomous/7external/15parents).

## History: PR123 time history/runtime/CFD research

Current three tracks are VIEWTIME storage-density/budget implementation,RUNTIMEWASM1 signature/explicit-flag diagnostic comparison,and completed CFDRESEARCH2/3 research acceptance. Close only the two research tasks;13 autonomous+7 external+15 parents=35 unfinished. VIEWTIME remains building with public HTTPS/general accuracy open;RUNTIMEWASM1 checking. No parent/product/Skill gate closes.1545 is the completed PR122/main baseline,not this candidate final CI count.

## History: earlier reset/background batch

Pause incremental comparison features. Prepare bounded connection-reset diagnosis/explicit recovery(BROWSERRESET1), finite background-video cancellation/cleanup(EXPORTBACKGROUND1) and real-Chrome timing/memory-availability/cancellation measurements(PERF1). Run CPU-heavy checks sequentially. Close only items meeting their existing acceptance. Missing other-browser,peak-RAM or support-limit observations do not complete PERF1.

Next batch addresses P3 restart requestId idempotency/real-MCP restart and P0/P1/Skill end-to-end gaps. Do not equate background export with reset causes or claim root fixes from successful retries. No new tasks are added; completion counts follow evidence.

Batch result: BROWSERRESET1 and PUBLICHTTPS1 are released with published evidence. EXPORTBACKGROUND1 remains checking: actual hidden behavior is unverified and the user cannot operate now. PERF1 remains building with three structural sizes measured,but thermal reset/timeout and absent memory/other-browser measurements. RUNTIMEWASM1 retains the initial Node24 V8 fatal separately from isolated success; final CI success does not prove a root fix. See [publication record](../evidence/2026-10-18-publication-8c57e16.json). No parent or publication gate is closed.

## 2026-10-18 next-batch evidence

P3 now refuses restored request IDs safely; real MCP restart tests cover same/changed replay,new IDs and reuse after explicit release. See [evidence](../evidence/2026-10-18-mcp-restart-request.json). This does not restore results or compare complete request contents. P0/P1/P4 gain a [local loop](../../skills/airpocket-studio/references/skill-loop.md) and [real-MCP evidence](../evidence/2026-10-18-skill-loop-real-mcp.json):100/200N produces0.04/0.08mm,PNG/archive hashes match,and four states survive output unchanged. The draft required study-normalization and response-wrapper repairs; independent reproduction using only final prose remains open. These advances belong to existing parents;167 total/130 released/37 unfinished and unfinished parent states are retained.

A fresh independent evaluation found and repaired missing local-app startup instructions. The revised recipe reached Vite startup and33 real-MCP tools,but GUI approval stopped because the target browser URL could not be established on Windows. Zero product operations occurred; owned services stopped. The [independent evaluation](../evidence/2026-10-18-skill-loop-independent.json) has not passed; a complete independent loop after connection remains open.

## 2026-10-18: input and recovery completion batch

Modal preflight now rejects invalid local frames/direction mismatches; modal/orthotropic invalid supports are excluded,matching solver rules. Restored jobs can be rediscovered without remembering jobId through bounded studio_restored_jobs; availability and explicit nextSteps prevent interpreting absent history as success. Saved-case input/provenance can be read with archive/case/input revision pins through studio_inspect_case. [Local verification](../evidence/2026-10-18-input-recovery-verification.json),[remeasurement](../evidence/2026-10-18-saved-case-remeasurement.json),[32 assumptions recovered through real MCP](../evidence/2026-10-18-saved-case-input-stdio.json). No new physical thresholds or parent/gate closure. Browser case restoration,missing build identity and independent Skill acceptance remain open; user cannot perform manual background QA now.

Current remaining-work classification is15 autonomous,7 external/manual and15 parent epics=37. EXPORTBACKGROUND1 moved to the manual group because actual hidden-tab verification requires user operation and the user cannot operate now; implementation remains published but acceptance stays checking.

## 2026-10-18: saved-input restoration and reanalysis

Added studio_restore_case_input:full archive validation,required archive/case/input revisions,raw-source recheck,atomic new-project publication and no overwrite. [Real-MCP loop](../evidence/2026-10-18-case-input-restore-real-mcp.json) restores two original inputs/provenance and separately reanalyzes with saved method/size;point vectors/magnitudes exactly match0.04/0.08mm. Old browser build remains unavailable,new Node dirty build identity is recorded separately. Browser scene/result restoration and general physical accuracy remain unverified.

Thermal strict preflight now matches solver initialTemperature and radiation-iteration refusals;related thermal/fluid/nonlinear/acoustic tests31passed. MCP protocol tests share an explicit public-tool-name baseline,avoiding repeated count-only edits. Full repository entry34default/36paired,live91unchanged. These are advances within existing P0/P1/P4/MOD1/AGENTINPUT1;130released/37unfinished remain. Manual background and independent Skill/publication gates remain open.

## 2026-10-18: persist new analysis results and replay

[Formal-MCP evidence](../evidence/2026-10-18-result-archive-real-mcp.json) completes input restoration,two Node analyses,SHA-pinned studio_archive_results publication and separate-process validation/list/point comparison. [New archive](../evidence/2026-10-18-node-result-archive.json):241900bytes,rawSHA8f01a5332d1cb7891cca693c1b54c4eb60f60fef102004a156f9eec9540ded31;0.04/0.08mm/ratio2. Source rawSHA is unchanged,overwrite/staleSHA refused. Old missing build stays unavailable;new Node dirty runtime is separate. Total/generated100MB boundaries remain unmeasured;existing case-store budgets still apply. General accuracy,browser restoration and parent/gate closure are not established.

Explicit transient-acoustic step counts above60000 now fail before meshing using solver rules;overflow evidence is JSON-safe. Automatic stepping and mesh-dependent work remain separate.35default/37paired and live91 tools/methods.130released/37unfinished remain;manual background QA waits.

## Current status: independent loop and validation recovery

Earlier independent-fresh failures are historical stage records. The latest [independent post-pair evaluation](../evidence/2026-10-18-skill-loop-independent-post-pair.json) passed synthetic input/provenance repair,two solves,comparison,SHA-verified PNG/archive,four-state preservation and three refusals using the Skill/public MCP contracts. GUI pairing remains a prerequisite;this recipe on public HTTPS,the full Skill gate and general physical accuracy remain open.

UIIMPROVE1 moves queued to building. [Real-Chrome evidence](../evidence/2026-10-18-comparison-input-recovery.json) confirms comparison/video errors focus the offending control and set aria-invalid/errormessage;editing clears them. Real Chrome verifies JP/EN,390px and keyboard recovery. Corrected-output success is unit-tested only;complete Chrome output reruns remain unperformed. Harmonic preflight matches existing solver wave-number/k² numerical refusals before meshing. No parent/gate promotion:130released/19queued/13building/5checking/0ready.

The latest [CFDRESEARCH2/3 sheets](compressible-cfd-plan.md) complete literature-research acceptance only. Adoption/build/physical validation remain separate;all candidates on hold. CFD2 still requires configuration/dependency pins,Linux builds,B1–B5 execution,implementation,conservation and stop/restart validation.

[Bounded VIEWTIME real-Chrome evidence](../evidence/2026-10-18-viewtime-storage.json):thermal11requested/2400byte budget gives94nodes/3frames/2256bytes,25degC at5s;thermal GUI5frames and acoustic GUI7frames/741nodes/41496bytes.336349byte archive full-byte/hash replay,input count7/budget65536 restoration and atomic invalid-input refusal passed. Scalar budgets do not guarantee peak RAM;public HTTPS/general accuracy remain open.

UIRESEARCH1 also completes [versioned literature comparison](ui-research.md). Hands-on common six cases,recovery/interaction burden and keyboard/locale checks remain UIIMPROVE1 work.Latest34unfinished=12autonomous/7external/15parents.
