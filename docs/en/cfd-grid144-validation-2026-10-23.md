# Additional N144 cylinder reference grid

[日本語](../cfd-grid144-validation-2026-10-23.md)

Work order60 allowed at most two additional launches. The preceding N128 iteration extension consumed one; the remaining launch was assigned to circumferential N144. The [pre-run plan](../evidence/cfd-grid144-20261023/plan.json) fixed240 seconds,1 GiB RSS,1 thread and one launch using existing SU2 8.5.0 executable SHA `3cb60646b31c08e468441be9f3497601960d4bb31349e6329982bcdeed599248`. No SDK download, executable replacement, restart or iteration-only retry occurred.

**The N128→144 small-step difference is0.2930436%, but the original N64→128 failure at4.1226447% remains. This is not general grid convergence, acceptance of the original baseline, or CFD1 completion.** The1.125 refinement ratio is small; no Richardson order or GCI is established.

| Grid | Cd | Numerical reference1.507 error | Comparison |
|---|---:|---:|---|
| Original N64 | 1.58644061 | 5.2714% | Fails unchanged5% reference tolerance |
| Previously converged N128 extension | 1.5210373 | 0.9314731% | Original N64 difference4.1226447% >3% |
| New N144 | 1.516579997 | 0.6356999% | N128 difference0.2930436% <3%;N64 difference4.4036072% |

The8,496-node/8,352-quad grid changes only N128→144 in the existing O-grid rule: outer radius50.5 m, wall radius0.5 m, first step pi/N and growth1.1. Derived radial layers change56→58. Config/input bytes remain identical to the preceding ITER2400 experiment; stopping criteria, tolerances and physics are unchanged. Full mesh/config/input, raw history/stdout and hashes are retained separately. Large VTU and executable have hashes only.

Observed128.453 seconds,40,423,424 bytes peak RSS,exit0. The configured pressure−10 target was reached at history index1953 and process.wait confirmed exit. Final P/U/V log10 residuals:−10.00209793/−9.265629508/−9.346017837. All satisfy unchanged QA−6; velocity did not reach−10. Last100 Cd range0.00000461565% passes unchanged0.5%. No wall nonconvergence warning. Timing differences from earlier runs are not claimed as performance improvement.

Nodal farfield imbalance0.0450510% passes unchanged0.1%, but this is trapezoidal integration of VTU nodal velocity, not solver discrete boundary-face flux or finite-volume conservation. Final VTU/history come from the same successfully exited process; there is no solver-supplied independent result revision.

Independent shoelace inspection confirms all8,352 signed quad areas positive and total8,008.5195202756895 m² matching the analytical144-sided annular polygon. Boundary geometry is polygonal, not an exact circle, and changes with N. See [results](../evidence/cfd-grid144-20261023/run.json), [evaluation](../evidence/cfd-grid144-20261023/evaluation.json), and raw mesh/history/log in the same directory. Local .gitattributes preserves measured bytes.

Replay driver: `python docs/evidence/cfd-grid144-20261023/driver.py prepare|run`. Existing plan/results prevent overwrite or relaunch here. Any further launch needs a separate explicit budget, plan and destination. Both additional launches are now consumed; no further grid/solver run followed.

Three new preparation/tamper/relaunch tests and five existing Python regressions, bilingual docs, types and diff checks pass. Discrete mass flux, host/MCP comparisons, cow accuracy/boundary layers, general3D/physical accuracy and parent grid-convergence acceptance remain incomplete. Shared progress and product source are unchanged.
