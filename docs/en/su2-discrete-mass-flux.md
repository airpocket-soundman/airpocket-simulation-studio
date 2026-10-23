# SU2 discrete boundary mass-flux availability (CFD1 / 61)

[日本語](../su2-discrete-mass-flux.md)

2026-10-23. **The adapter cannot export numerical boundary mass flux. CFD1 conservation acceptance remains unmet.** Capabilities and new run metadata explicitly return `supported:false` and `SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE`. `requireSu2DiscreteMassFlux` refuses nodal diagnostics and self-reported CSV. The authenticated native host exposes the same capability.

## Primary-source and executable investigation

The official v8.5.0 tag resolves to commit `12eb826f049ef7f67df974dfcb44cf36ee07c0f8`. [CFlowOutput.cpp](https://github.com/su2code/SU2/blob/12eb826f049ef7f67df974dfcb44cf36ee07c0f8/SU2_CFD/src/output/CFlowOutput.cpp#L194-L261) computes a nodal diagnostic. [CIncEulerSolver.cpp](https://github.com/su2code/SU2/blob/12eb826f049ef7f67df974dfcb44cf36ee07c0f8/SU2_CFD/src/solvers/CIncEulerSolver.cpp#L2215-L2303) assembles boundary numerical residuals separately. The [FDS implementation](https://github.com/su2code/SU2/blob/12eb826f049ef7f67df974dfcb44cf36ee07c0f8/SU2_CFD/src/numerics/flow/convection/fds.cpp#L219-L228) includes dissipation and two-sided states. These quantities cannot be interchanged.

The existing pinned executable ran only `-d discovery.cfg`, bounded to ten seconds and 2 MiB output. A missing-dimension first attempt exited 1; a dimension-only `NDIME=2` stub allowed discovery to exit 0. The stub is not a computational mesh. No solve, SDK download or physical validation occurred. Discovery listed the surface diagnostic but provided no verified numerical boundary-flux export. [Evidence](../evidence/2026-10-23-opencode-61-cfd1.json) preserves hashes and raw output.

## Missing instrumentation

A future solver extension must retain the exact contribution immediately after boundary `ComputeResidual`, consistent with `LinSysRes.AddBlock`. It must cover every boundary, avoid halo/thread/MPI duplication and bind marker totals to one completed iteration. The outward normal convention, residual component, physical unit conversion and two-dimensional span normalization require independent proof.

An export must preserve solver/source/config/input/result identities, iteration, dimensions, markers, sign, units, completeness and raw hashes. Only a proven real format should receive a bounded parser rejecting missing, duplicate, nonfinite or mismatched records. No solver patch/build or guessed parser was added.

Future balance uses outward-positive totals and max(inflow,outflow) as the relative denominator. If both are zero, only an absolute criterion applies. Absolute and relative tolerances must be fixed before that run using established units, precision and the reference case. No balance value or acceptance is reported without real numerical flux. Existing nodal quadrature and remaining CFD reference limitations remain unchanged.
