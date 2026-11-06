[日本語](../printed-sls-prony-independent-audit.md)

# Independent SLS→Prony audit (2026-11-07)

Read-only audit at fixed stage `9569625` found no mandatory defect. Four new independent regressions and27 related tests pass;43 contract declarations compile. No production source changed. See [report.json](../evidence/2026-11-07-printed-sls-prony-independent/report.json).

The oracle never invokes the production material-point model. From bulk modulus K and Young relaxation it independently derives μ=3KE/(9K−E) and τμ=τE(3K+μ∞)/(3K+μ0). Eliminating zero lateral traction gives q=E11−E22=A E11+B w and w′=(q−w)/τμ. Analytical scalar recurrence for each linear-Green-strain interval checks all41 S/P/Cauchy stresses, lateral strains and stored energies.

Maximum errors against the continuous finite-ramp SLS expression are17.54361597/4.38126303/1.09502535Pa for hold steps0.5/0.25/0.125s. This tests second-order discrete-hold convergence, not exact ideal-step reproduction at finite strain. Adding123.5Pa to validation stress preserves fitted parameters and every Prony trajectory while changing signed bias by−123.5Pa.

Aborting during the second hashing stage does not falsely settle the outer Promise before owned preparation resolves, and publishes no completed result. This does not claim interruptibility inside the synchronous driver. Synthetic/provisional/uncalibrated, unverified physical independence and accuracy limitations remain. No measurement, structural solve, GUI or external solver ran.
