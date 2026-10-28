# Pending 37: candidate follow-up, 2026-10-24

[日本語](../pending37-reconciliation-2026-10-24.md)

Fixed base `46ccfcb`. Read-only inventory; original 171 tasks / 134 released / 37 pending and all parent acceptance conditions remain unchanged. Historical reconciliations remain intact.

[Machine-readable inventory](../evidence/2026-10-24-pending37-reconciliation.json) includes exact original acceptance, status, evidence and category for every ID. No tests, solver, GUI or network verification was run.

| ID | Remaining category | Limited progress and true gap |
|---|---|---|
| MESH1 | implementation | Bounded Tet checks exist; general CAD volume meshing, local sizing and region conformity remain. |
| REG2 | implementation | Blank/explicit cone-radius text and reapply checked in JA/EN; general UV rectangles and curved accuracy remain. |
| CFD1 | numerical-research | SU2 additional launch budget exhausted 2/2; N144 did not pass all gates. Discrete flux, mesh convergence and cow accuracy remain. |
| COUPLE1 | implementation | Bounded transfer kernels do not finish thermal-stress, radiation or conjugate-heat coupling. |
| FAIL1 | external-measurement | Failure models, calibrated materials and independent experiments remain; synthetic points are not substitutes. |
| CFDMESH1 | numerical-research | General wall resolution, quality and boundary mapping validation remain. |
| CFD2 | implementation | Turbulence applicability, convergence and mass balance remain. |
| CFD3 | implementation | Compressible/multiphase work remains a research plan, not an adopted implemented solver. |
| COUPLE3 | implementation | Planar arbitrary P1 nodal flux, reload rederivation and independent integrals checked; curved/temperature/iterative coupling absent. |
| COUPLE5 | implementation | Time synchronization, two-way conservative forces and stability remain. |
| CONTACT1 | numerical-research | General contact convergence, reaction and friction references remain. |
| PERF1 | validation | Bounded Chrome/IAB scale/cancel evidence exists; same-family IAB is not a second engine and whole-process peak RAM remains. |
| PRINT2 | external-measurement | Equivalent orthotropic UI/persistence/refusals checked; real slicing, material calibration and detailed layers/walls/infill remain. |
| COUPLE4B | implementation | Persisted facet-fixed complex pressure operator added; general curved transfer, complex response and fluid feedback remain. |
| CFDPORT1 | implementation | Candidate confirmation to pure cap conversion checked; main lacks indexed opening-mesh provider/version, so UI connection remains absent. |
| MOD1 | implementation | Export/selection/chat boundaries and types added; complete representative equivalence and cancellation coverage remain. |
| P0 | implementation | Capabilities and stable diagnostics are partial; all operation/runtime combinations and nested contracts remain. |
| P1 | implementation | Fresh synthetic linear two-mesh/two-solve Skill round trip checked; all-physics applicability and postmesh accuracy/convergence remain. |
| P2 | validation | Preparation/resource measurement is partial; network/device/engine, peak RAM and failure/release matrix remain. |
| P3 | validation | Confirmed stdio close and executionSettled added; both real disconnect attempts completed before cancellation. Full reconnect/termination matrix remains. |
| P4 | implementation | Bounded comparison GIF/fixed WebM checks added; single time, all output/cancel capabilities and publication remain. |
| P5 | implementation | SolidCraft exchange and three-design iteration with region tracking/convergence remain. |
| P6 | validation | Bounded native Tet4 selection/numerical checks added; general contract equivalence and publication remain. |
| UIIMPROVE1 | validation | REG2/focus/i18n/selection checks are bounded; full task-count/recovery/language/narrow/keyboard/public comparisons remain. |
| AGENTINPUT1 | implementation | Formal MCP three-pointer/focus, locale fix and fresh synthetic round trip checked; all-physics preflight and general quality/accuracy remain. |
| VIEWCOMPARE | validation | Thermal/acoustic GIF ledgers and acoustic fixed WebM 48 frames/2 seconds/96 panels/endpoints checked. Historical realtime loss retained; mixed axes, GUI downloads and cancellation remain. |
| VIEWTIME | validation | Stored time/display/export checked within bounds; general propagation accuracy and whole-process peak RAM remain. |
| PRINTMEASURE1 | external-measurement | Fixtures, hardware stop, calibration, compliance correction and measured logs remain. |
| PRINTMEASURE2 | external-measurement | Real Bambu slicing, setting comparison and print-condition tracking remain. |
| PRINTMEASURE3 | external-measurement | Calibrated tension/compression and independent-coupon identification remain. |
| BROWSEREXPORT1 | implementation | Fixed comparison time succeeds as a separate capability; single time uses old MediaRecorder, and slice/capacity/120-frame/GUI-save/MP4 gaps remain. |
| RUNTIMEWASM1 | runtime-investigation | PR187 isolated Linux nonreproduction is not a fix. PR193 job-store file failure is unexplained; no V8/OOM signature proves common cause. |
| EXPORTBACKGROUND1 | validation | 194/194b JA foreground disconnect probes are both partial. Background/nonselected/language expiry and cancelled partial-artifact refusal remain. |
| AGENTACP1 | external-integration | Bounded text sessions/discovery probes implemented; installed conversation authentication, production transport and standard-browser integration remain. |
| AGENTCHAT1 | external-integration | Explicit-provider controller/UI boundary only; production auth/transport/main mounting and complete conversation flow remain absent. |
| RESULTCURVE1 | implementation | Independent linear displacement-controlled steps/reaction curves added; nonlinear state histories, calibration and general structural paths remain separate. |
| FINITEVISCO1 | implementation | Finite Green material point and input-history replay are synthetic/provisional/uncalibrated; structural solver, plasticity, damage and experiments remain absent. |

## Limited checks and unresolved failures

The JSON links fixed candidate CI records for PR185–192. PR193 initial run39984626501 reported a job-store file failure (2107 passes, one failure, eight skips) without assertion, signal, V8 or OOM signatures. Follow-up normal run39986234059 at41a1645 succeeded (2123 total/2115 passed/0 failed/8 skipped); isolated run39986224476 ran exactly once with default flags and12 passes. This is nonreproduction, not resolution of the unknown cause. Raw follow-up is in `evidence/ci193-followup-20261024/summary.json`. Docs-head193 run39987901430 and PR194 run39988201881 are running at this inventory cutoff. PR187 isolated Linux success does not resolve historical failures. PR194 local build/asset success does not establish final CI or publication.

Thermal/acoustic GIFs have 24-frame stored-time ledgers. The new fixed comparison WebM checked one synthetic same-axis acoustic pair: 48 frames, two seconds, 96 panel selections, the 1.2 ms endpoint, all bytes/hash and external decode. This does not cover mixed axes, single view, another engine or completed GUI downloads. Historical comparison MediaRecorder endpoint loss remains recorded. The fresh Skill round trip starts after GUI pairing and uses synthetic linear inputs; it does not prove unattended GUI setup or material calibration.

194 and 194b each consumed one separate export. In 194b running progress and GUI lock were observed within one control invocation, but the click encountered a focus timeout and no pre-completion disconnect effect was established. Both remain partial; completed artifacts were available. Cancelled artifact refusal and restoration after cancellation were not verified.

## Exhausted budgets

SU2 additional launches: 2/2, zero remaining (N128 extension and N144). No automatic new grid/iteration/solver runs. GIF: 3/3; old realtime acoustic WebM: 1/1; fixed comparison WebM: 1/1; orbit194 and194b: one each. These are separate budgets and failures count as consumed. This inventory authorizes no new execution.

## Next implementation slices

1. **Explicit all-physics preflight stages.** Start from `analysis-preflight.js` and `preflight-physics-coverage.js`: separate input checks, postmesh checks and convergence/accuracy requirements. Steady thermal connected-component anchors including contact, acoustic wavelength checks and structural rigid-body rank are already implemented postmesh. First fix missing static-isotropic coverage metadata: requiredInputContract names it but physicsCoverage receives undefined on that path. Add exact existing/missing metadata for contracts, with no change to runtime permissions, allowed values or rigid-mode warning semantics. Keep `completePreflight:false`; magnitude warnings are not physical validation.
2. **Single-view stored-time fixed-frame export.** Reuse the comparison codec/container boundary with a separate capability, result lease, complete timestamp encode/decode proof and cancellation/hidden cleanup. Single-view endpoint loss has not been reproduced. Preserve orbit/deformation behavior; a real export needs a new explicit budget.
3. **Nonconnected FINITEVISCO reference.** Add a pure experiment-description/observation-comparison boundary while preserving synthetic/provisional/uncalibrated flags. Prescribed-F response is not a stress-free specimen, force or permanent plasticity. Design independent tensor/energy/tangent acceptance before any structural element connection; experimental calibration and dumbbell claims remain separate.
4. **Repair the control surface before another cutoff probe.** Investigate the CUA focus timeout without new exports. A requested-click timestamp is not a successful click. A semantic cancellation probe may be useful but is not real GUI disconnection evidence.

Merge, deployment manifest and public HTTPS remain separate external gates; no automatic merge is authorized. None of the 37 parent tasks becomes complete through this reconciliation.
