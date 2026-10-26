# Inspect saved finite material-point input history

[日本語](../finite-history-inspector.md) · [Input format](finite-visco-input-history.md)

Open Inspect finite material-point input history below the materials section. Paste existing saved JSON or press Load synthetic example, then Inspect history. The example preserves the input values of public/examples/finite-visco-input-history.json as explicit LF text; it is not measured data. Ctrl/Command+Enter also runs inspection.

The synthetic/provisional/uncalibrated warning remains visible. Explicit F/dt inputs replay from the existing reference's I/Z0. Output contains final time, F, Green–Lagrange E, second Piola–Kirchhoff S / first Piola–Kirchhoff P / Cauchy sigma in Pa, free energy / cumulative work / cumulative dissipation in J/m³-reference, dissipation rate in W/m³-reference and raw/canonical input SHA. A refused step displays its zero-based index and completed-step count without a successful summary. Full-trajectory curves and state resume are not provided.

Only the existing strict parser is used, retaining 1MiB/4096-step, units, synthetic flags, duplicate/unknown-key and numeric-envelope refusal. Character count and UTF8 bytes are checked before creating a worker. One owned module worker runs each request with a 10-second watchdog; suspended JavaScript cannot provide a hard wall-clock bound. Success, failure, worker error/messageerror, cancel, edit and disposal terminate that worker and settle the pending promise. Old generations cannot publish. Persisted pagehide cancels while preserving the BFcache entry; nonpersisted pagehide destroys it.

The worker sends no issued finalState, only a fixed-size final observation or refusal. The UI verifies displayed finite matrices, units, flags and hashes, then renders textContent only. Five 3×3 tables and fixed scalar fields do not grow with 4096 steps. No object URLs, downloads, external sends, project/case/material edits or MCP method/scope additions occur.

This is a synthetic material-point reference inspector, not measured data, identification, structural analysis, plasticity, damage/fracture prediction, calibration or completion of FINITEVISCO1. Existing solvers and visualization-scale animations remain separate. Actual UI verification has not been performed at implementation time.

Regression checks include independent hydrostatic and linear-E Maxwell ramp/hold stress/dissipation closed forms, strict-parser refusals, raw hashes, maximum4096 steps, real module-worker messages, cancellation/edit ABA/direct-value changes/disposal/watchdog/errors and malformed replies. See [evidence](../evidence/2026-10-27-finite-history-inspector.json).
