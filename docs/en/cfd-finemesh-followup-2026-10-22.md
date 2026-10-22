# CFD fine-mesh deadline follow-up (2026-10-22)

[日本語](../cfd-finemesh-followup-2026-10-22.md)

The fine mesh from the [previous study](cfd-reference-2026-10-22.md) ran once with a240-second deadline,1GiB RSS limit and one thread. Mesh/input/config hashes were unchanged; only the wall-clock limit changed from90 to240 seconds. Historical plans and results remain intact.

**The fine-mesh scenario meets its existing QA criteria; the overall reference study and CFD1 remain incomplete.** Its4.1227% Cd difference from baseline exceeds the unchanged3% mesh-dependence tolerance.

| Item | Actual result |
|---|---|
| Execution | SU2 8.5.0; one run; exit0;89.078s; peak RSS36,368,384 bytes |
| Mesh | 7,296 nodes;7,168 quadrilaterals;128 angular points; outer radius50.5m |
| Stop reason | 1200-iteration budget, history index1199; pressure target−10 not reached |
| Cd / reference error | 1.521036488 /0.931419%; existing tolerance5% |
| P / U / V log10 residuals | −7.983410684 /−7.120148337 /−7.230978230 |
| Final100-iteration Cd range | 0.000388485%; existing tolerance0.5% |
| Nodal farfield mass imbalance | 0.0449777%; existing tolerance0.1%; not internal discrete face-flux verification |
| Difference from baseline | 4.1226959%; exceeds3% tolerance |

Completing in89.078 seconds after the earlier90-second timeout is not a performance-improvement claim. Actual timing varies with load; iteration cap, input and numerical settings were unchanged.

## Solver termination and QA acceptance

The fixed config uses `CONV_FIELD=RMS_PRESSURE` and `CONV_RESIDUAL_MINVAL=-10`. Officialv8.5.0 [configuration](https://github.com/su2code/SU2/blob/v8.5.0/config_template.cfg) and [COutput::ConvergenceMonitoring](https://github.com/su2code/SU2/blob/v8.5.0/SU2_CFD/src/output/COutput.cpp#L846-L927) combine only the requested convergence fields. A pressure-only configuration cannot establish convergence of every velocity/turbulence residual. This run did not reach even its pressure−10 target: its normal exit was caused by the iteration budget.

The separate, previously fixed QA criterion requires all P/U/V residuals≤−6. This run meets that criterion. The record also preserves the adapter's `numericallyConverged=false` assessment at−10. Scenario QA acceptance and solver stopping-criterion convergence are distinct.

The assessment implementation now refuses missing residual columns. Previously a pressure-only history could count every reported residual as converged and return numerical convergence. P/U/V are now required in2D, W additionally in3D, and nu additionally for SA. `allReportedResidualsMet` retains its literal meaning; missing required columns make `requiredResidualsPresent=false` and `numericallyConverged=false`. Fixed host input restrictions, solver configuration and cow warnings are unchanged.

## Evidence and reproduction

The [pre-run plan](../evidence/cfd-finemesh-followup-20261022/plan.json), [run record](../evidence/cfd-finemesh-followup-20261022/run.json), raw history/config/input/log are retained together. Executed helper-byte hashes are distinguished from canonical LF source hashes; exact helper bytes are retained. Binaries and large VTUs are not committed. All11 focused tests and2 Python regressions passed.

In a fresh dedicated worktree use `python scripts/replay-cfd-finemesh.py unique-label prepare`, inspect the plan, then `run` with the same label. New outputs remain under `.qa/cfd-finemesh-unique-label/`; published history is never overwritten. The executable must match its pinned hash; no downloads occur. The replay path was tested through preparation only, without launching a second solver.

Remaining work includes mesh-dependence acceptance, discrete mass flux, host/MCP equivalence, and the cow's116 unconverged wall points, velocity/turbulence residuals, boundary-layer/domain/accuracy verification. These results do not justify changing CFD1 to released or increasing the released count.
