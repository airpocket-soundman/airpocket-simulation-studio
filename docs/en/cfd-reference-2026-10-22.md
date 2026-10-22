# Fixed Re40 cylinder reference study (2026-10-22)

[日本語](../cfd-reference-2026-10-22.md)

Follow-up 02 executed four real SU2 runs. **The study failed overall.** CFD1 and the cow case remain unreleased and physically unvalidated.

The primary reference is [Economon, AIAA 2018-3111](https://economon.github.io/docs/AIAA-2018-3111.pdf), DOI 10.2514/6.2018-3111, IV.G, printed pages 19–20: incompressible isothermal laminar cylinder, D=1m, density=1kg/m³, speed=4m/s, viscosity=0.1Pa·s, Re=40, adiabatic no-slip wall, O-grid with growth 1.1. Cd=1.507 is a published SU2 numerical result, not experimental data or an analytic solution. Mach is not an incompressible-model input.

The [pre-run plan](../evidence/2026-10-22-cfd-reference-plan.json) fixed Cd error≤5%, every reported log10 residual≤−6, final-100-iteration Cd range≤0.5%, and nodal farfield mass imbalance≤0.1%. Mesh/domain Cd changes must be≤3%, iteration-budget changes≤1%. These are project QA tolerances, not uncertainty bounds from the paper.

| Scenario | Angular count / outer radius m / iteration cap | Seconds | Final-history Cd | Reference error | Assessment |
|---|---|---:|---:|---:|---|
| baseline | 64 / 50.5 / 1200 | 35.828 | 1.586440610 | 5.2714% | Outside tolerance |
| mesh | 128 / 50.5 / 1200 | 90.219 | 1.521037509 | 0.9315% | Killed at 90-second deadline; failed |
| domain | 64 / 100.5 / 1200 | 45.562 | 1.580804881 | 4.8975% | This scenario alone passed |
| iterations | 64 / 50.5 / 2400 | 23.812 | 1.586440610 | 5.2714% | Outside tolerance |

Baseline/domain/iterations exited normally at the pressure stopping target −10. Baseline and iterations both stopped at history index820: raising the cap did not increase actual iterations. The elapsed-time difference is not a performance-improvement claim. The partial mesh Cd changes by4.1226%, exceeding3%, and a completed fine-grid comparison remains missing. Domain change is0.3552%; iteration-budget change is0%.

Mass diagnostics integrate nodal farfield velocities using trapezoidal quadrature. They do not verify SU2's discrete internal face flux. Completed-run relative imbalance is0.04415% for baseline/iterations and0.02137% for domain. The interrupted mesh VTU can be an earlier checkpoint; final-state mass is null and the checkpoint observation is retained separately.

The [run record](../evidence/2026-10-22-cfd-reference-run.json) retains executable/plan/input/mesh/config/history/output hashes, commands, RSS, stop reasons, all residuals and acceptance checks. [Raw supporting files](../evidence/cfd-reference-20261022) contain histories, configurations, inputs and logs. Large VTUs and binaries are not committed. The existing SU2 8.5.0 cache matched the pinned executable SHA. Each run used one thread, a90-second deadline and1GiB RSS monitoring. No downloads or host/MCP input-allowlist changes occurred.

The first evaluator misread padded quoted CSV headers. Raw data was reassessed without rerunning SU2. Commit `bbd0241fd62a6ec05a9eb480dff0264e552cbec7` retains the original execution harness; the record distinguishes its SHA from the corrected assessment harness. `.gitattributes -text` preserves raw bytes.

Reproduce in a fresh dedicated worktree. In PowerShell set an unused label, `$env:QA_CFD_LABEL='replay-20261022-01'`, then `python scripts/qa-cfd-reference.py prepare`, inspect the plan, then `run`, then `assess`. Keep the same QA_CFD_LABEL environment variable for all three commands. All outputs go under `.qa/cfd-reference-<label>/`; historical published records are never overwritten. Only preparation with a new label was tested after the four runs; no additional solver run occurred. Reassessing the historical record without a label requires its original ignored QA artifacts, including VTUs. Committed supporting raw files alone cannot recheck all output hashes. SU2_EXE must identify a local executable matching the pinned SHA. Python psutil, Node and locked npm dependencies are required. Existing QA output is never overwritten. The five focused test files passed10 tests; the padded-CSV regression passed1. Mock tests are separate from real-solver accuracy evidence.

Remaining work includes a separately predeclared budget for a completed fine-mesh run, finer-grid convergence, discrete mass flux, and reference host/MCP equivalence. The cow retains116 unconverged wall points, failed velocity/turbulence residuals, and missing boundary-layer/domain/accuracy validation.
