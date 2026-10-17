# Whole-task audit and completion path

[日本語](../task-critical-path.md)

As of2026-10-18:167 tasks, 130 released and 37 unfinished. Classification prioritizes work; it does not advance status without implementation and evidence.

| Classification | Existing IDs | Conditions |
|---|---|---|
| Autonomous implementation/verification(15) | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIRESEARCH1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, CFDRESEARCH2, CFDRESEARCH3 | Includes substantial physics work; autonomous does not mean finishable in one batch. Missing measurement conditions keep work open. |
| External/device conditions(7) | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, MCPARGUMENTTYPES1, EXPORTBACKGROUND1 | Physical prototypes/material calibration, V8 reproduction/upstream fixes, registered SDK verification and public-browser version evidence. Continue independent software work while waiting. |
| Parent epics(15) | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | Publishing a slice does not complete its parent. Keep existing acceptance and common completion criteria. |

## Dependencies and current batch

P0->P1->P3 and P0->P4 are key publication-workflow paths. P5 depends on all P1/P2/P3/P4. Five of six publication gates remain open; completed evidence is candidate-specific and must align on the final candidate before product publication is considered complete.

Pause incremental comparison features. Prepare bounded connection-reset diagnosis/explicit recovery(BROWSERRESET1), finite background-video cancellation/cleanup(EXPORTBACKGROUND1) and real-Chrome timing/memory-availability/cancellation measurements(PERF1). Run CPU-heavy checks sequentially. Close only items meeting their existing acceptance. Missing other-browser,peak-RAM or support-limit observations do not complete PERF1.

Next batch addresses P3 restart requestId idempotency/real-MCP restart and P0/P1/Skill end-to-end gaps. Do not equate background export with reset causes or claim root fixes from successful retries. No new tasks are added; completion counts follow evidence.

Batch result: BROWSERRESET1 and PUBLICHTTPS1 are released with published evidence. EXPORTBACKGROUND1 remains checking: actual hidden behavior is unverified and the user cannot operate now. PERF1 remains building with three structural sizes measured,but thermal reset/timeout and absent memory/other-browser measurements. RUNTIMEWASM1 retains the initial Node24 V8 fatal separately from isolated success; final CI success does not prove a root fix. See [publication record](../evidence/2026-10-18-publication-8c57e16.json). No parent or publication gate is closed.

## 2026-10-18 next-batch evidence

P3 now refuses restored request IDs safely; real MCP restart tests cover same/changed replay,new IDs and reuse after explicit release. See [evidence](../evidence/2026-10-18-mcp-restart-request.json). This does not restore results or compare complete request contents. P0/P1/P4 gain a [local loop](../../skills/airpocket-studio/references/skill-loop.md) and [real-MCP evidence](../evidence/2026-10-18-skill-loop-real-mcp.json):100/200N produces0.04/0.08mm,PNG/archive hashes match,and four states survive output unchanged. The draft required study-normalization and response-wrapper repairs; independent reproduction using only final prose remains open. These advances belong to existing parents;167 total/130 released/37 unfinished and unfinished parent states are retained.

A fresh independent evaluation found and repaired missing local-app startup instructions. The revised recipe reached Vite startup and33 real-MCP tools,but GUI approval stopped because the target browser URL could not be established on Windows. Zero product operations occurred; owned services stopped. The [independent evaluation](../evidence/2026-10-18-skill-loop-independent.json) has not passed; a complete independent loop after connection remains open.

## 2026-10-18: input and recovery completion batch

Modal preflight now rejects invalid local frames/direction mismatches; modal/orthotropic invalid supports are excluded,matching solver rules. Restored jobs can be rediscovered without remembering jobId through bounded studio_restored_jobs; availability and explicit nextSteps prevent interpreting absent history as success. Saved-case input/provenance can be read with archive/case/input revision pins through studio_inspect_case. [Local verification](../evidence/2026-10-18-input-recovery-verification.json),[remeasurement](../evidence/2026-10-18-saved-case-remeasurement.json),[32 assumptions recovered through real MCP](../evidence/2026-10-18-saved-case-input-stdio.json). No new physical thresholds or parent/gate closure. Browser case restoration,missing build identity and independent Skill acceptance remain open; user cannot perform manual background QA now.

Current remaining-work classification is15 autonomous,7 external/manual and15 parent epics=37. EXPORTBACKGROUND1 moved to the manual group because actual hidden-tab verification requires user operation and the user cannot operate now; implementation remains published but acceptance stays checking.
