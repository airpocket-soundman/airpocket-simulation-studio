# Whole-task audit and completion path

[日本語](../task-critical-path.md)

As of2026-10-18:167 tasks,128 released and39 unfinished. Classification prioritizes work; it does not advance status without implementation and evidence.

| Classification | Existing IDs | Conditions |
|---|---|---|
| Autonomous implementation/verification(17) | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIRESEARCH1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, CFDRESEARCH2, CFDRESEARCH3, EXPORTBACKGROUND1, BROWSERRESET1 | Includes substantial physics work; autonomous does not mean finishable in one batch. Missing measurement conditions keep work open. |
| External/device conditions(7) | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, MCPARGUMENTTYPES1, PUBLICHTTPS1 | Physical prototypes/material calibration, V8 reproduction/upstream fixes, registered SDK verification and public-browser version evidence. Continue independent software work while waiting. |
| Parent epics(15) | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | Publishing a slice does not complete its parent. Keep existing acceptance and common completion criteria. |

## Dependencies and current batch

P0->P1->P3 and P0->P4 are key publication-workflow paths. P5 depends on all P1/P2/P3/P4. Five of six publication gates remain open; completed evidence is candidate-specific and must align on the final candidate before product publication is considered complete.

Pause incremental comparison features. Prepare bounded connection-reset diagnosis/explicit recovery(BROWSERRESET1), finite background-video cancellation/cleanup(EXPORTBACKGROUND1) and real-Chrome timing/memory-availability/cancellation measurements(PERF1). Run CPU-heavy checks sequentially. Close only items meeting their existing acceptance. Missing other-browser,peak-RAM or support-limit observations do not complete PERF1.

Next batch addresses P3 restart requestId idempotency/real-MCP restart and P0/P1/Skill end-to-end gaps. Do not equate background export with reset causes or claim root fixes from successful retries. No new tasks are added; completion counts follow evidence.

Batch result: BROWSERRESET1 reached ready on real-Chrome diagnostic/recovery evidence before publication. EXPORTBACKGROUND1 remains checking: CUA could not prove actual hidden transition and manual cooperation is unanswered. PERF1 remains building with three structural sizes measured,but thermal reset/timeout and absent memory/other-browser measurements. RUNTIMEWASM1 retains the initial Node24 V8 fatal separately from isolated success; final CI success does not prove a root fix. Only accepted items are promoted together after publication evidence.
