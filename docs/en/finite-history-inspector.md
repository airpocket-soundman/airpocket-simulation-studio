# Inspect saved finite material-point input history

[日本語](../finite-history-inspector.md) · [Input format](finite-visco-input-history.md)

Open Inspect finite material-point input history below the materials section. Paste existing saved JSON or press Load synthetic example, then Inspect history. The example preserves the input values of public/examples/finite-visco-input-history.json as explicit LF text; it is not measured data. Ctrl/Command+Enter also runs inspection.

The synthetic/provisional/uncalibrated warning remains visible. Explicit F/dt inputs replay from the existing reference's I/Z0. Output contains final time, F, Green–Lagrange E, second Piola–Kirchhoff S / first Piola–Kirchhoff P / Cauchy sigma in Pa, free energy / cumulative work / cumulative dissipation in J/m³-reference, dissipation rate in W/m³-reference and raw/canonical input SHA. A refused step displays its zero-based index and completed-step count without a successful summary. Full-trajectory curves and state resume are not provided.

Only the existing strict parser is used, retaining 1MiB/4096-step, units, synthetic flags, duplicate/unknown-key and numeric-envelope refusal. Character count and UTF8 bytes are checked before creating a worker. One owned module worker runs each request with a 10-second watchdog; suspended JavaScript cannot provide a hard wall-clock bound. Success, failure, worker error/messageerror, cancel, edit and disposal terminate that worker and settle the pending promise. Old generations cannot publish. Persisted pagehide cancels while preserving the BFcache entry; nonpersisted pagehide destroys it.

The worker sends no issued finalState, only a fixed-size final observation or refusal. The UI verifies displayed finite matrices, units, flags and hashes, then renders textContent only. Five 3×3 tables and fixed scalar fields do not grow with 4096 steps. No object URLs, downloads, external sends, project/case/material edits or MCP method/scope additions occur.

This is a synthetic material-point reference inspector, not measured data, identification, structural analysis, plasticity, damage/fracture prediction, calibration or completion of FINITEVISCO1. Existing solvers and visualization-scale animations remain separate. Actual UI verification has not been performed at implementation time.

Regression checks include independent hydrostatic and linear-E Maxwell ramp/hold stress/dissipation closed forms, strict-parser refusals, raw hashes, maximum4096 steps, real module-worker messages, cancellation/edit ABA/direct-value changes/disposal/watchdog/errors and malformed replies. See [evidence](../evidence/2026-10-27-finite-history-inspector.json).


## Bounded real-main verification (2026-10-27)

The [ordinary main/IAB GUI evidence](../evidence/2026-10-27-finite-history-inspector-gui/README.md) verifies button entry of the existing public synthetic example, real owned-worker replay and Japanese/English switching. Four steps end at4.7s; displayed work72.7319228, free energy39.9520031 and dissipation32.7799197 J/m³-reference, plus all45 cells of five matrices, match domain output at nine significant digits. Raw SHA is `6366950b1f9b41a412fa8f22f28ed6eab12f2937411588ecebd6e85188fc0d86`; canonical SHA is `8daace3d459a7e6d5288744c3fe6f3d2ff6a33c8136b0c3b21c791aa0adb5e71`. Editing immediately clears old results; `{` is refused by an actual worker; Clear restores empty input/results and idle.

Numerical/behavior verification used e972ce8. Subsequent4c02210 changes only table width/spacing: all45 real-GUI cells remain identical and captions fit one line. Source e972ce8 passed56focused/type28/build/local28 (46816.716ms);4c02210 passed16related tests including the4independent tests. No full build/local rerun is claimed for the later source. English baseline/final equality covers272protected DOM controls, condition display and case count; it does not establish formal in-memory API project/case/analysis equality or actual cancellation acceptance. Earlier pending statements retain implementation-stage history. General physics, calibration, structural analysis, parent completion and publication remain unproven.


## Narrow-sidebar follow-up (2026-10-27, 7d1e657)

The subsequent style-only7d1e657 changes paragraph/hash overflow wrapping and result max-width/horizontal overflow only. See [responsive evidence](../evidence/2026-10-27-finite-history-inspector-responsive/README.md). On the actual1280×900 desktop, the269px aside scroll width decreased495→269px; the233px result region decreased477→233px. All45cells remain identical and16related tests passed (1438.3942ms). Earlier e972ce8 and4c02210 evidence remains preserved. This verifies that desktop layout, not every viewport size or additional physics.
